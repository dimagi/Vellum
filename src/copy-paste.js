define([
    'jquery',
    'vellum/core'
], function ($) {
    $.vellum.plugin('copyPaste', {
        copyCallback: function (vellum, $element) {
            if ($element.is('.jstree-anchor')) {
                var mug = vellum.data.core.form.getMugByUFID($element.parent().get(0).id);
                // serialize the mug
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
        },
        pasteCallback: function (vellum, $element, data) {
            console.log($element, data);
        }
    }, {
        init: function () {
            var opts = this.opts().copyPaste;
            var vellum = this;
            var offScreen = {top: -10000, left: -10000};
            var hiddenTextarea = $('<textarea></textarea>').css({
                position: 'absolute',
                width: 0,
                height: 0
            }).css(offScreen).appendTo('body');
            var focusTextarea = function ($element, value) {
                hiddenTextarea.css({top: $element.offset().top});
                hiddenTextarea.val(value);
                hiddenTextarea.focus();
                hiddenTextarea.select();
            };
            var unfocusTextarea = function ($element) {
                $element.focus();
                return hiddenTextarea.val();
            };
            // Firefox only fires copy/paste when it thinks it's appropriate
            // Chrome doesn't fire copy/paste after key down has changed the focus
            // So we need implement both copy/paste as catching keystrokes Ctrl+C/V
            $(document).on('copy paste keydown', function (e) {
                var $element, callback;
                if (e.type === 'copy' || e.metaKey && String.fromCharCode(e.keyCode) === 'C') {
                    $element = $(':focus');
                    var text = opts.copyCallback(vellum, $element);
                    if (text) {
                        focusTextarea($element, text);
                        setTimeout(function () {
                            unfocusTextarea($element);
                        }, 0);
                    }
                } else if (e.type === 'paste' || e.metaKey && String.fromCharCode(e.keyCode) === 'V') {
                    $element = $(':focus');
                    callback = opts.pasteCallback;
                    if (callback) {
                        focusTextarea($element);
                        setTimeout(function () {
                            var pasteValue = unfocusTextarea($element);
                            // part of the above hack
                            // on chrome this gets called twice,
                            // the first time with a blank value
                            if (pasteValue) {
                                callback(vellum, $element, pasteValue);
                            }
                        }, 0);
                    }
                }
            });
        }
    });
});
