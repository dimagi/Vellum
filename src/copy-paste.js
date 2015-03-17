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
    var PREAMBLE = ["vellum copy/paste", "version 1"],
        vellum,
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
            var text = opts.copy();
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

    // matches strings that could be JSON; see http://json.org/
    var JSON_STRING = /^(null|true|false|\[[^]*\]|\{[^]*\}|"[^]*"|-?\d+(\.\d+)?([Ee][+-]?\d+)?)$/;

    /**
     * Convert value to string
     *
     * Does nothing to strings that do not look like JSON. The idea
     * behind this (along with valuify) is to make the output as human
     * readable as possible while maintaining lossless de/serialization.
     */
    function stringify(value) {
        if (_.isString(value) && !JSON_STRING.test(value)) {
            return value;
        }
        return JSON.stringify(value);
    }

    /**
     * Convert string to value
     *
     * Strings that look like JSON will be parsed as JSON, otherwise the
     * string value is passed through unchanged.
     */
    function valuify(string) {
        if (JSON_STRING.test(string)) {
            return JSON.parse(string);
        }
        return string;
    }

    function copy() {
        var mugs = [vellum.getCurrentlySelectedMug()],
            header = ["type", "id"],
            headings = {type: true, id: true},
            rows = _.map(mugs, function (mug) {
                var row = mug.serialize();
                _.each(row, function (value, key) {
                    if (!headings.hasOwnProperty(key)) {
                        header.push(key);
                        headings[key] = true;
                    }
                });
                return row;
            });

        return tsv.tabDelimit([PREAMBLE, header].concat(_.map(rows, function (row) {
            return _.map(header, function (key) {
                var val = row[key];
                return stringify(_.isUndefined(val) ? null : val);
            });
        })));
    }

    function paste(data) {
        var next = tsv.makeRowParser(data);
        if (!_.isEqual(next(), PREAMBLE)) {
            return ["Unsupported paste format"];
        }
        var types = vellum.data.core.mugTypes.allTypes,
            form = vellum.data.core.form,
            mug = vellum.getCurrentlySelectedMug(),
            header = next(),
            row = next(),
            errors = [],
            values, pos;
        for (; row; row = next()) {
            try {
                values = _.object(header, _.map(row, function (str) {
                    return valuify(str);
                }));
            } catch (err) {
                errors.push("Unsupported paste format: " + row.join(", "));
                continue;
            }
            if (!types.hasOwnProperty(values.type)) {
                errors.push("Unknown question type: " + row.join(", "));
                continue;
            }
            //path = mug ? mug.absolutePath : form.getBasePath();
            pos = "after"; // TODO calcualte position from path
            mug = form.createQuestion(mug, pos, values.type);
            mug.deserialize(values);
        }
        return errors;
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
        paste: paste,
        stringify: stringify,
        valuify: valuify
    };
});
