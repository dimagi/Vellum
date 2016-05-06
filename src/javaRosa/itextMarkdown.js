define([
    'underscore',
    'jquery',
    'tpl!vellum/templates/markdown_help',
    'vellum/util',
    'vellum/javaRosa/itextLabel',
    'vellum/core'
], function (
    _,
    $,
    markdown_help,
    util,
    itextLabel
) {
    var looksLikeMarkdown = function(val) {
        /* Regex checks (in order):
         * ordered lists
         * unordered lists
         * strikethrough
         * headings
         * italics/bold/bold italics
         * links
         */
        return /^\d+[\.\)] |^\* |~~.+~~|# |\*{1,3}\S.*\*{1,3}|\[.+\]\(\S+\)/m.test(val);
    };

    var widget = function (mug, language, form, options) {
        options = options || {};
        var parent = options.parent;
        var widget = itextLabel.widget(mug, language, form, options),
            super_setValue = widget.setValue,
            super_getUIElement = widget.getUIElement,
            super_handleChange = widget.handleChange,
            wantsMarkdown = true,
            markdownOff, markdownOn, markdownOutput;

        widget.toggleMarkdown = function() {
            parent.toggleClass("has-markdown");
            widget.mug.form.fire('change');
        };

        markdownOutput = $('<div>').addClass("controls well markdown-output col-sm-9");

        widget.handleChange = function() {
            super_handleChange();
            var val = widget.getValue(),
                item = widget.getItextItem();
            if (looksLikeMarkdown(val)) {
                if (wantsMarkdown) {
                    parent.removeClass("markdown-ignorant");
                    parent.addClass("has-markdown");
                }
            } else if (!val) {
                parent.removeClass("has-markdown");
            }
            item.hasMarkdown = markdownOff.is(":visible");
            markdownOutput.html(util.markdown(val)).closest('.form-group').removeClass('hide');
        };

        widget.setValue = function (val, callback) {
            super_setValue(val, callback);
            if (!val) {
                markdownOutput.closest('.form-group').addClass('hide');
            }
            markdownOutput.html(util.markdown(val));
        };

        widget.getUIElement = function() {
            var elem = super_getUIElement(),
                val = widget.getValue(),
                markdownSpacer = $("<div />").addClass("col-sm-3"),
                markdownContainer = $("<div />").addClass("col-sm-9"),
                markdownRow = $("<div />").addClass("form-group").addClass("markdown-group");

            elem.detach('.markdown-output');
            markdownRow.append(markdownSpacer);
            markdownContainer.append(markdownOutput);
            markdownRow.append(markdownContainer);
            elem.append(markdownRow);
            elem.find('.control-label').append(markdown_help({title:options.lstring }));

            markdownOff = elem.find('.turn-markdown-off').click(function() {
                wantsMarkdown = false;
                widget.getItextItem().hasMarkdown = false;
                widget.toggleMarkdown();
                return false;
            });
            markdownOn = elem.find('.turn-markdown-on').click(function() {
                wantsMarkdown = true;
                widget.getItextItem().hasMarkdown = true;
                widget.toggleMarkdown();
                return false;
            });

            if (widget.getItextItem().hasMarkdown) {
                parent.addClass("has-markdown");
            }
            else {
                parent.addClass("markdown-ignorant");
            }
            if (looksLikeMarkdown(val)) {
                markdownOutput.html(util.markdown(val));
                markdownOff.removeClass('hide');
            }
            return elem;
        };

        return widget;
    };

    return {
        looksLikeMarkdown: looksLikeMarkdown,
        widget: widget,
    };
});
