define([
    'jquery',
    'jquery.jstree',
], function (
    $,
) {
    /**
     * Conditional events plugin
     *
     * Conditional handlers are bound to the JSTree instance and are
     * called with the same arguments as the JSTree function that they
     * are gating. The boolean result of the handler will be used to
     * determine if the gated method should be called (true -> call).
     *
     * `redraw_node` is a special case: it overrides the super method,
     * and therefore is responsible for calling the super method.
     *
     * Based on https://github.com/vakata/jstree/blob/master/src/misc.js
     * See also http://stackoverflow.com/a/24499593/10840
     */
    
    $.jstree.defaults.conditionalevents = {
        should_activate: function () { return true; },
        //should_move: function () { return true; },
        redraw_node: function () {
            var args = Array.prototype.slice.call(arguments);
            return this.parent.redraw_node.apply(this.inst, args);
        },
    };
    $.jstree.plugins.conditionalevents = function (options, parent) {
        this.activate_node = function () {
            var args = Array.prototype.slice.call(arguments);
            if (this.settings.conditionalevents.should_activate.apply(this, args)) {
                parent.activate_node.apply(this, args);
            }
        };
        //this.move_node = function () {
        //    var args = Array.prototype.slice.call(arguments);
        //    if(this.settings.conditionalevents.should_move.apply(this, args)) {
        //        parent.move_node.apply(this, args);
        //    }
        //};
        this.redraw_node = function () {
            var args = Array.prototype.slice.call(arguments),
                base = {inst: this, parent: parent};
            return this.settings.conditionalevents.redraw_node.apply(base, args);
        };
        this.edit = function () {
            // do nothing: disable F2 -> rename node
        };
    };
});
