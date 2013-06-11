if (typeof define !== 'function') { var define = require('amdefine')(module); }
define([
    'underscore',
    './util',
    './controller',
    './model',
    './saveButton',
    './ui',
    './widgets'
], function(util, controller, model, saveButton, ui, widgets) {

    // Just gather up the pieces for export
    return {
        util: util,
        controller: controller,
        model: model,
        saveButton: saveButton,
        ui: ui,
        widgets: widgets
    };
});
