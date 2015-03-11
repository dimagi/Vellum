define([
    'jquery',
    'underscore',
    'vellum/tsv',
    'vellum/core'
], function (
    $,
    _,
    tsv
) {
    var vellum,
        offScreen = {top: -10000, left: -10000},
        hiddenTextarea = $('<textarea></textarea>').css({
            position: 'absolute',
            width: 0,
            height: 0
        }).css(offScreen).appendTo('body');

    function focusTextarea($focus, value) {
        if ($focus.length === 0) {
            $focus = $("body");
        }
        hiddenTextarea.css({top: $focus.offset().top});
        hiddenTextarea.val(value);
        hiddenTextarea.focus();
        hiddenTextarea.select();
    }

    function unfocusTextarea($focus) {
        $focus.focus();
        return hiddenTextarea.val();
    }

    function onCopy(opts) {
        var $focus = $(':focus');
        if ($focus.is('.jstree-anchor')) {
            var mugs = [vellum.getCurrentlySelectedMug()],
                text = opts.copy(mugs);
            if (text) {
                focusTextarea($focus, text);
                setTimeout(function () {
                    unfocusTextarea($focus);
                }, 10);
            }
        }
    }

    function onPaste(opts) {
        var $focus = $(':focus');
        if ($focus.length === 0 || $focus.parents('.fd-tree').length) {
            focusTextarea($focus);
            setTimeout(function () {
                var pasteValue = unfocusTextarea($focus);
                // on chrome this gets called twice,
                // the first time with a blank value
                if (pasteValue) {
                    opts.paste(pasteValue);
                }
            }, 0);
        }
    }

    function copy(mugs) {
        // serialize mugs
        var mug = mugs[0]; // TODO support for more than one mug
        return JSON.stringify({
            type: 'Mug',
            content: {
                // These, plus the form itself,
                // are the arguments to pass into Mug
                options: mug.options,
                baseSpec: mug._baseSpec,
                attrs: mug.p.getAttrs()
            }
        }, function (key, value) {
            var type = (function () {
                if (!value) {
                    return null;
                } else if (value.getNonEmptyItems) {
                    return 'ItextModel';
                } else {
                    return null;
                }
            }());
            if (type === 'ItextModel') {
                return {_skipped: type};
            } else {
                return value;
            }
        });
    }

    function paste(data) {
        console.log("paste data:", data);
    }

    $.vellum.plugin('copyPaste', {
        copy: copy,
        paste: paste
    }, {
        init: function () {
            var opts = this.opts().copyPaste;
            vellum = this;
            // Firefox only fires copy/paste when it thinks it's appropriate
            // Chrome doesn't fire copy/paste after key down has changed the focus
            // So we need implement both copy/paste as catching keystrokes Ctrl+C/V
            $(document).on('copy paste keydown', function (e) {
                if (e.type === 'copy' ||
                    e.metaKey && String.fromCharCode(e.keyCode) === 'C') {
                    onCopy(opts);
                } else if (e.type === 'paste' ||
                           e.metaKey && String.fromCharCode(e.keyCode) === 'V') {
                    onPaste(opts);
                }
            });
        }
    });

    return {
        copy: copy,
        paste: paste
    };
});
