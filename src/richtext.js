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
    ckeditor.config.removePlugins = 'toolbar,pastefromword,pastetext,liststyle,tabletools,contextmenu';
    ckeditor.config.allowedContent = true;

    var richtext = function(mug, options) {
        var widget = widgets.base(mug, options), editor;

        widget.input = $("<div />")
            .attr("contenteditable", true)
            .attr("name", widget.id)
            .addClass('fd-textarea input-block-level itext-widget-input');

        widget.input.ckeditor().promise.then(function() {
            editor = widget.input.ckeditor().editor;

            mug.on('teardown-mug-properties', function() {
                removePopovers(widget.input);
                if (editor) {
                    editor.destroy();
                }
            });

            editor.on('change', function() {widget.handleChange(); });
            editor.on('afterInsertHtml', function (e) { addPopovers(widget.input); });
            editor.on('dataReady', function (e) { addPopovers(widget.input); });
        });

        widget.getControl = function () {
            return widget.input;
        };

        widget.setValue = function (val) {
            widget.input.ckeditor().promise.then(function() {
                editor.setData(toRichHtml(val, mug.form, true));
            });
        };

        widget.getValue = function () {
            var val = "";
            widget.input.ckeditor().promise.then(function() {
                val = fromRichText(editor.getData());
            });
            return val;
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

    function addPopovers(input) {
        input.find('[contenteditable=false]').each(function () {
            var $this = $(this),
                value = $this.attr('value').match('output value="(.*)"')[1];
            $this.popout('destroy');
            $this.popout({
                title: '',
                content: value,
                template: '<div contenteditable="false" class="popover"><div class="arrow"></div><div class="popover-inner"><div class="popover-content"><p></p></div></div></div>',
                placement: 'bottom'
            });
        });
    }

    function removePopovers(input) {
        input.find('[contenteditable=false]').each(function () {
            $(this).popout('destroy');
        });
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
