define([
    'jquery',
    'ckeditor',
    'vellum/widgets',
    'ckeditor-jquery'
], function(
    $,
    ckeditor,
    widgets
) {
    ckeditor.config.removePlugins = 'toolbar';
    ckeditor.config.allowedContent = true;

    var richtext = function(mug, options) {
        var widget = widgets.base(mug, options);

        widget.input = $("<div />")
            .attr("contenteditable", true)
            .attr("name", widget.id)
            .addClass('fd-textarea input-block-level itext-widget-input')
            .on('change input', function (e) { widget.handleChange(); })
            .keyup(function (e) {
                // workaround for webkit: http://stackoverflow.com/a/12114908
                if (e.which === 9) {
                    this.focus();
                }
            }).ckeditor();
        var editor = widget.input.ckeditor().editor;
        widget.input.on('change', function () { widget.handleChange(); });

        widget.getControl = function () {
            return widget.input;
        };

        widget.setValue = function (val) {
            editor.setData(val);
        };

        widget.getValue = function () {
            return editor.getData();
        };

        widget.getDefaultValue = function () {
            return null;
        };

        widget.save = function () {
            widget.saving = true;
            try {
                widget.mugValue(mug, widget.getValue());
            } finally {
                widget.saving = false;
            }
        };

        return widget;
    };
    
    return {
        richtext: richtext,
    };
});
