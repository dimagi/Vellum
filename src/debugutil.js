/* global console */
import _ from "underscore";

let debugutil;

if (_.isUndefined(console)) {
    debugutil = {
        log: function () {},
        error: function () {}
    };
} else {
    debugutil = {
        log: function () { console.log.apply(console, arguments); },
        error: function () { console.error.apply(console, arguments); }
    };
}

export default debugutil;