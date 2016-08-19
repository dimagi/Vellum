define(function () {
    if (!String.prototype.startsWith) {
      Object.defineProperty(String.prototype, 'startsWith', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function(searchString, position) {
          position = position || 0;
          return this.lastIndexOf(searchString, position) === position;
        }
      });
    }
    if (!String.prototype.endsWith) {
      Object.defineProperty(String.prototype, 'endsWith', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function(searchString, position) {
          var subjectString = this.toString();
          if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
          }
          position -= searchString.length;
          var lastIndex = subjectString.indexOf(searchString, position);
          return lastIndex !== -1 && lastIndex === position;
        }
      });
    }
});
