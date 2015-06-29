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
            .ckeditor();
        var editor = widget.input.ckeditor().editor;
        widget.input.on('change input', function () { widget.handleChange(); });
        editor.on('change dataReady afterInsertHtml', function () { widget.handleChange(); });

        widget.getControl = function () {
            return widget.input;
        };

        widget.setValue = function (val) {
            editor.setData(toRichText(val, mug.form, true));
        };

        widget.getValue = function () {
            return fromRichText(editor.getData());
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

    var fromRichText = function(val) {
        var el = $('<div>');
        val = val.replace(/(<\/?p>)/ig,"");
        val = val.replace(/(<br ?\/?>)/ig,"\n");
        el = el.html(val);
        el.find('.atwho-inserted .label').unwrap();
        el.find('.label-datanode').replaceWith(function() {
            return $(this).attr('value');
        });

        return el.html();
    };

    var toRichText = function(val, form, withClose) {
        val = val.replace('&lt;', '<').replace('&gt;', '>');
        var el = $('<div>').html(val);
        el.find('output').replaceWith(function() {
            var value = $(this).attr('value'),
                icon = form.getMugByPath(value).options.icon,
                richText = $('<span>').addClass('label label-datanode label-datanode-internal')
                              .attr({
                                contenteditable: false,
                                draggable: true,
                                value: "<output value='" + value +
                                    "' />"
                              }).append($('<i>').addClass(icon).html('&nbsp;')).append(value);
                if (withClose) {
                    richText.append($("<button>").addClass('close').html("&times;"));
                }
            return richText;
        });
        return el.html();
    };
    
    return {
        richtext: richtext,
        fromRichText: fromRichText,
        toRichText: toRichText
    };
});
