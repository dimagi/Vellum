define([
    'jquery',
    'underscore',
    'tpl!vellum/templates/copy_paste_help',
    'vellum/mugs',
    'vellum/tsv',
    'vellum/util',
    'vellum/hqAnalytics',
    'vellum/core'
], function (
    $,
    _,
    copy_paste_help,
    mugsModule,
    tsv,
    util,
    analytics
) {
    var PREAMBLE = ["Form Builder clip", "version 1"],
        vellum,
        offScreen = {top: -10000, left: -10000},
        hiddenTextarea = $('<textarea></textarea>').css({
            position: 'absolute',
            width: 0,
            height: 0
        }).css(offScreen).appendTo('body'),
        isChrome = /Chrome/.test(navigator.userAgent),
        isSafari = /Safari/.test(navigator.userAgent) && !isChrome;

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
                pos.error = util.format(
                    gettext("Cannot insert {type} into tree root"),
                    {type: nameOf(values.type)}
                );
            } else {
                pos.error = gettext("Cannot insert $1 into or after $2")
                        .replace("$1", nameOf(values.type))
                        .replace("$2", nameOf(node.mug.__className));
            }
        } else {
            // verify that item will be inserted inside the paste root
            while (node.mug !== pos.mug) {
                if (!node.parent) {
                    // valid insertion point was outside of the paste root
                    pos.error = gettext("Cannot insert $1 into $2")
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
        analytics.usage("Copy Paste", "Cut", mugs.length);
        analytics.workflow("Cut questions in form builder");
        mugs = _.filter(mugs, function (mug) { return mug.options.isCopyable; });
        if (mugs && mugs.length) {
            vellum.data.core.form.removeMugsFromForm(mugs);
        }
        return data;
    }

    function copy(skip_analytics) {
        var mugs = vellum.getCurrentlySelectedMug(true, true),
            seen = {};
        if (!skip_analytics) {
            analytics.usage("Copy Paste", "Copy", mugs.length);
            analytics.workflow("Copy questions in form builder");
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
        analytics.workflow("Paste questions in form builder");
        var next = tsv.makeRowParser(data);
        if (!_.isEqual(next().slice(0, 2), PREAMBLE)) {
            return [gettext("Unsupported paste format")];
        }
        var types = vellum.data.core.mugTypes.allTypes,
            form = vellum.data.core.form,
            pasted = pasteContext(form),
            context = pasted.context,
            selected = vellum.getCurrentlySelectedMug(true, true),
            mug = selected.length ? selected[selected.length - 1] : null,
            header = next(),
            row = next(),
            node = {id: null, mug: mug, parent: null},
            values, pos;
        vellum.beforeBulkInsert(form);
        for (; row; row = next()) {
            try {
                values = _.object(header, _.map(row, function (str) {
                    return valuify(str);
                }));
            } catch (err) {
                context.addError(gettext("Unsupported paste format:") + " " + row.join(", "));
                continue;
            }
            if (!types.hasOwnProperty(values.type)) {
                context.addError(gettext("Unknown question type:") + " " + row.join(", "));
                continue;
            }
            pos = getInsertTargetAndPosition(node, values);
            if (pos.hasOwnProperty("error")) {
                context.addError(pos.error);
                continue;
            }
            mug = form.createQuestion(pos.mug, pos.position, values.type, true);
            mug.deserialize(values, context);
            pasted.addMug(values.id, mug);
            node = {
                id: values.id,
                mug: mug,
                parent: pos.parent,
            };
        }
        pasted.finish();
        vellum.afterBulkInsert(form);
        if (mug && pos) {
            vellum.setCurrentMug(mug);
        }
        analytics.usage("Copy Paste", "Paste", pasted.length);
        return pasted.getErrors();
    }

    function pasteContext(form) {
        function addError(message) {
            errors.update(null, {
                key: message,
                level: mugsModule.ERROR,
                message: message
            });
        }

        function addMug(id, mug) {
            self.length++;
        }

        function doLater(fn) {
            later.push(fn);
        }

        function finish() {
            _.each(later, function (fn) { fn(); });
        }

        var errors = new mugsModule.MugMessages(),
            later = [],
            context = {
                addError: addError,
                errors: errors,
                later: doLater,
            },
            self = {
                length: 0,
                context: context,
                addMug: addMug,
                getErrors: errors.get.bind(errors),
                finish: finish,
            };

        return self;
    }

    $.vellum.plugin('copyPaste', {
        cut: cut,
        copy: copy,
        paste: paste
    }, {
        init: function () {
            var opts = this.opts().copyPaste;
            vellum = this;

            // Firefox only fires copy/paste when it thinks it's appropriate
            // Chrome doesn't fire copy/paste after key down has changed the focus
            // So we need implement both copy/paste as catching keystrokes Ctrl+C/V
            $(document).on('cut copy paste keydown', function (e) {
                if (e.type === 'cut' || util.getKeyChord(e) === 'Ctrl+X') {
                    // Disable cut until undo feature is implemented
                    if (false) { onCut(opts); }
                } else if (e.type === 'copy' || util.getKeyChord(e) === 'Ctrl+C') {
                    onCopy(opts);
                } else if (e.type === 'paste' || util.getKeyChord(e) === 'Ctrl+V') {
                    onPaste(opts);
                }
            });
        },
        displayMultipleSelectionView: function () {
            this.__callOld();
            function showCopyPasteBox() {
                copyPasteHelp.hide();
                copyPasteBox.removeClass("hide");
                copyPasteArea.val(copy(true));
            }
            var html = $(copy_paste_help({
                    "metachar": (util.isMac ? "\u2318" : "Ctrl+"),
                    "format": util.format,
                })),
                copyPasteHelp = html.find(".copy-paste-help"),
                copyPasteBox = html.find(".copy-paste-box"),
                copyPasteArea = copyPasteBox.find("textarea");
            if (isSafari) {
                // HACK show textarea for copy/paste because the hidden
                // textarea dance doesn't work in Safari
                showCopyPasteBox();
                setTimeout(function () {
                    copyPasteArea.focus().select();
                }, 1);
            } else {
                // hidden feature: show copy/paste box on click help div
                copyPasteHelp.click(function () {
                    showCopyPasteBox();
                    copyPasteArea.focus().select();
                });
            }
            copyPasteArea.focus(function () {
                copyPasteArea.select().mouseup(function() {
                    copyPasteArea.off('mouseup');
                    return false;
                });
            }).keyup(function (e) {
                // workaround for webkit: http://stackoverflow.com/a/12114908
                if(e.which === 9) { // tab
                    copyPasteArea.select();
                }
            });
            html.find(".insert-questions").click(function () {
                paste(copyPasteArea.val());
            });
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
