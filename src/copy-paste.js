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
    var PREAMBLE = ["Form Builder clip", "version 1"],
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

    function headerKey(item) {
        var rank = "1",
            itext = /^(.*)Itext(?::([^-]+)-(.*))?$/.exec(item);
        if (itext) {
            rank = "0"; // itext before other fields
            // label before all other itext types
            if (itext[1] === "label") { itext[1] = "!"; }
            if (itext[3] === "default") {
                itext[3] = "!"; // default form before other forms
            } else if (!itext[3]) {
                itext[3] = "~"; // itext ID after forms
            }
            // sort by itext type, then form, then language
            item = itext[1] + " " + itext[3] + " " + itext[2];
        }
        return rank + item;
    }

    function getInsertTargetAndPosition(node, values) {
        var pos;
        while (true) {
            if (!node.parent || values.id.startsWith(node.id + "/")) {
                // node is the paste root or a possible parent (by path)
                pos = vellum.getInsertTargetAndPosition(node.mug, values.type);
                break;
            }
            node = node.parent;
        }
        if (!pos) {
            pos = {};
            if (!node.mug) {
                pos.error = "Cannot insert " + values.type + " into tree root";
            } else {
                pos.error = "Cannot insert $1 into or after $2"
                        .replace("$1", values.type)
                        .replace("$2", node.mug.__className);
            }
        } else {
            // verify that item will be inserted inside the paste root
            while (node.mug !== pos.mug) {
                if (!node.parent) {
                    // valid insertion point was outside of the paste root
                    pos.error = "Cannot insert $1 into $2"
                        .replace("$1", values.type)
                        .replace("$2", node.mug.parentMug.__className);
                    break;
                }
                node = node.parent;
            }
        }
        return pos;
    }

    function copy() {
        var mugs = vellum.getCurrentlySelectedMug(true),
            seen = {};
        if (!mugs || !mugs.length) { return ""; }

        function serialize(mug) {
            if (seen.hasOwnProperty(mug.ufid)) {
                return;
            }
            seen[mug.ufid] = true;
            var row = mug.serialize(),
                children = form.getChildren(mug);
            _.each(row, function (value, key) {
                if (!headings.hasOwnProperty(key)) {
                    header.push(key);
                    headings[key] = true;
                }
            });
            if (children.length) {
                row = [row].concat(_.map(children, serialize));
            }
            return row;
        }

        var headings = {id: true, type: true},
            header = [],
            form = mugs[0].form,
            rows = _.filter(_.flatten(_.map(mugs, serialize)), _.identity);

        header = ["id", "type"].concat(_.sortBy(header, headerKey));
        return tsv.tabDelimit([PREAMBLE, header].concat(_.map(rows, function (row) {
            return _.map(header, function (key) {
                var val = row[key];
                return stringify(_.isUndefined(val) ? null : val);
            });
        })));
    }

    function paste(data) {
        var next = tsv.makeRowParser(data);
        if (!_.isEqual(next().slice(0, 2), PREAMBLE)) {
            return ["Unsupported paste format"];
        }
        var types = vellum.data.core.mugTypes.allTypes,
            form = vellum.data.core.form,
            mug = vellum.getCurrentlySelectedMug(),
            header = next(),
            row = next(),
            errors = [],
            node = {id: null, mug: mug, parent: null},
            into = {into: 1, last: 1},
            values, pos, parent;
        vellum.beforeBulkInsert(form);
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
            pos = getInsertTargetAndPosition(node, values);
            if (pos.hasOwnProperty("error")) {
                errors.push(pos.error);
                continue;
            }
            if (pos.position === "after") {
                parent = node.parent;
            } else if (into.hasOwnProperty(pos.position)) {
                parent = node;
            } else {
                // should never happen
                if (pos.position === "last") { pos.position = "into"; }
                errors.push("Cannot insert $1 $2 $3"
                    .replace("$1", values.type) // TODO user-friendly type names
                    .replace("$2", pos.position)
                    .replace("$3", pos.mug.__className));
                break;
            }
            mug = form.createQuestion(pos.mug, pos.position, values.type, true);
            mug.deserialize(values);
            node = {
                id: values.id,
                mug: mug,
                parent: parent,
            };
        }
        vellum.afterBulkInsert(form);
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
