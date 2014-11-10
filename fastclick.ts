/// <reference path="typings/tsd.d.ts"/>

class EventListenerWrapper {
  constructor(private element:JQuery, private type:string, private callback) {
    this.element.on(this.type, this.callback);
  }

  public destroy() {
    this.element.off(this.type, this.callback);
  }
}

class EventsCollection {
  public events:EventListenerWrapper[] = [];

  constructor(private element:JQuery) {
  }

  public addEventListener(type:string, callback) {
    this.events.push(new EventListenerWrapper(this.element, type, callback));
  }

  public destroy() {
    angular.forEach(this.events, function (event: EventListenerWrapper) {
      event.destroy();
    });
  }
}

class ClickBuster {
  constructor(private $timeout, private $document, private delay:number = 2500) {
    $document.on("click", this.onClick);
    this.coordinates = [];
  }

  // Call preventGhostClick to bust all click events that happen within
  // 25px of the provided x, y coordinates in the next 2.5s.
  public preventGhostClick(clientX: number, clientY: number) {
    this.coordinates.push({
      clientX: clientX,
      clientY: clientY
    });

    this.$timeout(() => {
      this.coordinates.pop();
    }, this.delay);
  }

  private coordinates = [];

  // If we catch a click event inside the given radius and time threshold
  // then we call stopPropagation and preventDefault. Calling preventDefault
  // will stop links from being activated.
  onClick(event: JQueryEventObject) {
    var coordinatesIndex = 0;

    angular.forEach(this.coordinates, function (coordinate) {
      if (Math.abs(event.clientX - coordinate.clientX) < 25 &&
          Math.abs(event.clientY - coordinate.clientY) < 25) {

        event.stopPropagation();
        event.preventDefault();
      }
    });
  }
}

class FastClick {
  private touchEvents = [];

  private events:EventsCollection;

  private startX:number;
  private startY:number;

  constructor(private scope, private element:JQuery, public handler, private clickBuster:ClickBuster) {
    // collect functions to call to cleanup events
    if ("ontouchstart" in window) {
      this.events.addEventListener("touchstart", this.onTouchStart)
    }
    this.events.addEventListener("click", this.onClick);
  }

  public onTouchStart(event) {
    event.stopPropagation();

    this.events.addEventListener("touchend", this.onClick);
    this.events.addEventListener("touchmove", this.onTouchMove);

    this.startX = event.touches[0].clientX;
    this.startY = event.touches[0].clientY;
  }

  // reset if distance moved is greater than 10 pixels
  public onTouchMove(event) {
    if (Math.abs(event.touches[0].clientX - this.startX) > 10 ||
        Math.abs(event.touches[0].clientY - this.startY) > 10) {
      this.reset();
    }
  }

  public onClick(event: JQueryEventObject) {
    event.stopPropagation();

    this.reset();

    var callback = function () {
      this.handler(this.scope, {$event: event});
    };

    var result = callback.call(this.element, event);

    if (event.type === "touchend") {
      this.clickBuster.preventGhostClick(this.startX, this.startY);
    }

    return result;
  }

  private reset() {
    var eventsIndex = this.touchEvents.length;

    while (eventsIndex--) {
      this.touchEvents[eventsIndex].destroy();
    }

    this.touchEvents = [];
  }
}

angular.module("fastClick", [])
  .factory("clickBuster", function ($timeout, $document) {
    var clickbuster = new ClickBuster($timeout, $document);

    return clickbuster;
  })
  .directive("fastClick", function ($parse, clickbuster) : ng.IDirective {
    return {
      restrict: "A",
      link: function (scope, element:JQuery, attr) {
        var fn = $parse(attr.fastClick);

        new FastClick(scope, element, fn, clickbuster);
      }
    };
  });

