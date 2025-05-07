/* global console */
define(["underscore"], function (_) {
    if (_.isUndefined(console)) {
        return {
            log: function () {},
            error: function () {},
        };
    } else {
        return {
            log: function () { console.log.apply(console, arguments); },
            error: function () { console.error.apply(console, arguments); },
        };
    }
});
