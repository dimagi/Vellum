define([
    'jquery',
    'underscore',
    'jquery.jstree'
], function (
    $,
    _
) {
    // conditional select plugin
    // from https://github.com/vakata/jstree/blob/master/src/misc.js
    // see also http://stackoverflow.com/a/24499593/10840
    "use strict";
    $.jstree.defaults.conditionalselect = function () { return true; };
    $.jstree.plugins.conditionalselect = function (options, parent) {
        // own function
        this.activate_node = function (obj, e) {
            if(this.settings.conditionalselect.call(this, this.get_node(obj))) {
                parent.activate_node.call(this, obj, e);
            }
        };
    };
});
