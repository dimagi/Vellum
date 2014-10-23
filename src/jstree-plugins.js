define([
    'jquery',
    'underscore',
    'jquery.jstree'
], function (
    $,
    _
) {
    /**
     * Conditional events plugin
     *
     * Conditional handlers are called with the same arguments as the
     * JSTree function that they are gating, and they are bound to the
     * JSTree instance.
     *
     * based on https://github.com/vakata/jstree/blob/master/src/misc.js
     * see also http://stackoverflow.com/a/24499593/10840
     */
    "use strict";
    $.jstree.defaults.conditionalevents = {
        should_activate: function () { return true; },
        should_move: function () { return true; }
    };
    $.jstree.plugins.conditionalevents = function (options, parent) {
        this.activate_node = function () {
            var args = Array.prototype.slice.call(arguments);
            if(this.settings.conditionalevents.should_activate.apply(this, args)) {
                parent.activate_node.apply(this, args);
            }
        };
        this.move_node = function () {
            var args = Array.prototype.slice.call(arguments);
            if(this.settings.conditionalevents.should_move.apply(this, args)) {
                parent.move_node.apply(this, args);
            }
        };
    };
});
