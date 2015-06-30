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
        widget.input.on('change input afterInsertHtml', function () { widget.handleChange(); });
        editor.on('change dataReady afterInsertHtml', function () { widget.handleChange(); });

        widget.getControl = function () {
            return widget.input;
        };

        widget.setValue = function (val) {
            editor.setData(toRichHtml(val, mug.form, true));
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

        mug.on('teardown-mug-properties', function() {
            if (editor) {
                editor.destroy();
            }
        });

        return widget;
    };

    var fromRichText = function(val) {
        var el = $('<div>');
        val = val.replace(/(<p>)/ig,"").replace(/<\/p>/ig, "\r\n").replace(/(<br ?\/?>)/ig,"\n");
        el = el.html(val);
        el.find('.atwho-inserted .label').unwrap();
        el.find('.label-datanode').replaceWith(function() {
            return $(this).attr('value');
        });

        return el.html();
    };

    function replaceOuputRef(form, value, withClose) {
        var v = value.split('/'),
            dispValue = v[v.length-1],
            mug = form.getMugByPath(value),
            icon = mug ? mug.options.icon: 'fcc fcc-flower',
            datanodeClass = mug ? 'label-datanode-internal' : 'label-datanode-external',
            richText = $('<span>').addClass('label label-datanode')
                          .addClass(datanodeClass)
                          .attr({
                            contenteditable: false,
                            draggable: true,
                            value: "<output value=\"" + value +
                                "\" />"
                          }).append($('<i>').addClass(icon).html('&nbsp;')).append(dispValue);
        if (withClose) {
            richText.append($("<button>").addClass('close').html("&times;"));
        }
        return richText;
    }

    var toRichHtml = function (val, form, withClose) {
        val = val.replace('&lt;', '<').replace('&gt;', '>');
        var el = $('<div>').html(val);
        el.find('output').replaceWith(function() {
            return replaceOuputRef(form, $(this).attr('value'), withClose);
        });
        return el.html().replace(/\r\n|\r|\n/ig, '<br />');
    };

    var toRichText = function(val, form, withClose) {
        val = val.replace('&lt;', '<').replace('&gt;', '>');
        var el = $('<div>').html(val);
        el.find('output').replaceWith(function() {
            return replaceOuputRef(form, $(this).attr('value'), withClose);
        });
        return el.html();
    };
    
    return {
        richtext: richtext,
        fromRichText: fromRichText,
        toRichText: toRichText
    };
});
