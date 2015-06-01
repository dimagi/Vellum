define([
    'jquery',
    'underscore',
    'tpl!vellum/templates/copy_paste_help',
    'vellum/mugs',
    'vellum/tsv',
    'vellum/core'
], function (
    $,
    _,
    copy_paste_help,
    mugs,
    tsv
) {
    var PREAMBLE = ["Form Builder clip", "version 1"],
        vellum,
        offScreen = {top: -10000, left: -10000},
        hiddenTextarea = $('<textarea></textarea>').css({
            position: 'absolute',
            width: 0,
            height: 0
        }).css(offScreen).appendTo('body'),
        isMac = /Mac/.test(navigator.platform);

    function focusTextarea($focus, value) {
        if ($focus.length === 0) {
            $focus = $("body");
        }
        hiddenTextarea.css({top: $focus.offset().top});
        hiddenTextarea.val(value);
        hiddenTextarea.focus();
        hiddenTextarea.select();
    }

    function unfocusTextarea($focus, clear) {
        $focus.focus();
        var value = hiddenTextarea.val();
        if (clear && value) {
            // HACK fix intermittent multiple-paste on Chrome (timing related?)
            hiddenTextarea.val("");
        }
        return value;
    }

    function onCut(opts) {
        var $focus = $(':focus');
        if ($focus.is('.jstree-anchor')) {
            var text = opts.cut();
            if (text) {
                focusTextarea($focus, text);
                setTimeout(function () {
                    unfocusTextarea($focus);
                }, 10);
            }
        }
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
        if ($focus.length === 0 || $focus.parents('.fd-tree').length ||
                                   $focus.is(hiddenTextarea)) {
            focusTextarea($focus);
            setTimeout(function () {
                var pasteValue = unfocusTextarea($focus, true);
                // on chrome this gets called twice,
                // the first time with a blank value
                if (pasteValue) {
                    var errors = opts.paste(pasteValue);
                    if (errors.length) {
                        vellum._resetMessages([{
                            level: "parse-warning",
                            message: errors,
                        }]);
                    }
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
        var TYPE = 1,
            LANG = 2,
            FORM = 3,
            rank = "1",
            itext = /^(.*)Itext(?::([^-]+)-(.*))?$/.exec(item);
        if (itext) {
            rank = "0"; // itext before other fields
            // label before all other itext types
            if (itext[TYPE] === "label") { itext[TYPE] = "!"; }
            if (itext[FORM] === "default") {
                itext[FORM] = "!"; // default form before other forms
            } else if (!itext[FORM]) {
                itext[FORM] = "~"; // itext ID after forms
            }
            // sort by itext type, then form, then language
            item = itext[TYPE] + " " + itext[FORM] + " " + itext[LANG];
        }
        return rank + item;
    }

    function nameOf(type) {
        var mugType = vellum.data.core.mugTypes.allTypes[type];
        return (mugType && mugType.typeName) || type;
    }

    function getInsertTargetAndPosition(node, values) {
        var pos, after;
        while (true) {
            if (!node.parent || values.id.startsWith(node.id + "/")) {
                // node is the paste root or a possible parent (by path)
                // insert after if path does not start with previous node path
                after = node.id && !values.id.startsWith(node.id + "/");
                pos = vellum.getInsertTargetAndPosition(node.mug, values.type, after);
                break;
            }
            node = node.parent;
        }
        if (!pos) {
            pos = {};
            if (!node.mug) {
                pos.error = "Cannot insert " +
                            nameOf(values.type) + " into tree root";
            } else {
                pos.error = "Cannot insert $1 into or after $2"
                        .replace("$1", nameOf(values.type))
                        .replace("$2", nameOf(node.mug.__className));
            }
        } else {
            // verify that item will be inserted inside the paste root
            while (node.mug !== pos.mug) {
                if (!node.parent) {
                    // valid insertion point was outside of the paste root
                    pos.error = "Cannot insert $1 into $2"
                        .replace("$1", nameOf(values.type))
                        .replace("$2", nameOf(node.mug.parentMug.__className));
                    return pos;
                }
                node = node.parent;
            }
            if (pos.position === "after") {
                pos.parent = node.parent;
            } else if (pos.position === "last" || pos.position === "into") {
                pos.parent = node;
            } else {
                // should never happen
                pos.error = "Cannot insert $1 $2 $3"
                    .replace("$1", nameOf(values.type))
                    .replace("$2", pos.position)
                    .replace("$3", nameOf(pos.mug.__className));
            }
        }
        return pos;
    }

    function cut() {
        var data = copy(true),
            mugs = vellum.getCurrentlySelectedMug(true);
        if (window.analytics) {
            window.analytics.usage("Copy Paste", "Cut", "# questions selected", mugs.length);
            window.analytics.workflow("Cut questions in form builder");
        }
        mugs = _.filter(mugs, function (mug) { return mug.options.isCopyable; });
        if (mugs && mugs.length) {
            vellum.data.core.form.removeMugsFromForm(mugs);
        }
        return data;
    }

    function copy(skip_analytics) {
        var mugs = vellum.getCurrentlySelectedMug(true, true),
            seen = {};
        if (window.analytics && !skip_analytics) {
            window.analytics.usage("Copy Paste", "Copy", "# questions selected", mugs.length);
            window.analytics.workflow("Copy questions in form builder");
        }
        if (!mugs || !mugs.length) { return ""; }

        function serialize(mug) {
            if (seen.hasOwnProperty(mug.ufid)) {
                return;
            }
            seen[mug.ufid] = true;
            if (!mug.options.isCopyable) {
                return;
            }
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

        if (rows.length === 0) {
            return "";
        }
        header = ["id", "type"].concat(_.sortBy(header, headerKey));
        return tsv.tabDelimit([PREAMBLE, header].concat(_.map(rows, function (row) {
            return _.map(header, function (key) {
                var val = row[key];
                return stringify(_.isUndefined(val) ? null : val);
            });
        })));
    }

    function paste(data) {
        if (window.analytics) {
            window.analytics.workflow("Paste questions in form builder");
        }
        var next = tsv.makeRowParser(data);
        if (!_.isEqual(next().slice(0, 2), PREAMBLE)) {
            return ["Unsupported paste format"];
        }
        var types = vellum.data.core.mugTypes.allTypes,
            form = vellum.data.core.form,
            selected = vellum.getCurrentlySelectedMug(true, true),
            mug = selected.length ? selected[selected.length - 1] : null,
            header = next(),
            row = next(),
            errors = new mugs.MugMessages(),
            node = {id: null, mug: mug, parent: null},
            later = [],
            pasted = 0,
            values, pos;
        errors.add = function (message) {
            errors.update(null, {
                key: message,
                level: mugs.ERROR,
                message: message
            });
        };
        vellum.beforeBulkInsert(form);
        for (; row; row = next()) {
            try {
                values = _.object(header, _.map(row, function (str) {
                    return valuify(str);
                }));
            } catch (err) {
                errors.add("Unsupported paste format: " + row.join(", "));
                continue;
            }
            if (!types.hasOwnProperty(values.type)) {
                errors.add("Unknown question type: " + row.join(", "));
                continue;
            }
            pos = getInsertTargetAndPosition(node, values);
            if (pos.hasOwnProperty("error")) {
                errors.add(pos.error);
                continue;
            }
            mug = form.createQuestion(pos.mug, pos.position, values.type, true);
            later.push(mug.deserialize(values, errors));
            node = {
                id: values.id,
                mug: mug,
                parent: pos.parent,
            };
            pasted++;
        }
        _.each(_.flatten(later), function (f) { f.execute(); });
        vellum.afterBulkInsert(form);
        if (mug && pos) {
            vellum.setCurrentMug(mug);
        }
        if (window.analytics) {
            window.analytics.usage("Copy Paste", "Paste", "# questions pasted", pasted);
        }
        return errors.get();
    }

    $.vellum.plugin('copyPaste', {
        cut: cut,
        copy: copy,
        paste: paste
    }, {
        init: function () {
            var opts = this.opts().copyPaste;
            vellum = this;

            function copyModifierKeyPressed(event) {
                return (isMac && event.metaKey) || (!isMac && event.ctrlKey);
            }

            // Firefox only fires copy/paste when it thinks it's appropriate
            // Chrome doesn't fire copy/paste after key down has changed the focus
            // So we need implement both copy/paste as catching keystrokes Ctrl+C/V
            $(document).on('cut copy paste keydown', function (e) {
                if (e.type === 'cut' ||
                    copyModifierKeyPressed(e) &&
                    String.fromCharCode(e.keyCode) === 'X') {
                    // Disable cut until undo feature is implemented
                    if (false) { onCut(opts); }
                } else if (e.type === 'copy' ||
                           copyModifierKeyPressed(e) &&
                           String.fromCharCode(e.keyCode) === 'C') {
                    onCopy(opts);
                } else if (e.type === 'paste' ||
                           copyModifierKeyPressed(e) &&
                           String.fromCharCode(e.keyCode) === 'V') {
                    onPaste(opts);
                }
            });
        },
        displayMultipleSelectionView: function () {
            this.__callOld();
            var html = $(copy_paste_help({"metachar": (isMac ? "\u2318" : "Ctrl+")}));
            this.$f.find(".fd-props-content").html(html);
        }
    });

    return {
        cut: cut,
        copy: copy,
        paste: paste,
        stringify: stringify,
        valuify: valuify
    };
});
