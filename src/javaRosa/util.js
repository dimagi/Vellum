define([
    'underscore',
    'jquery',
    'vellum/tsv',
    'vellum/richText',
    'vellum/xml',
    'vellum/util',
], function (
    _,
    $,
    tsv,
    richText,
    xml,
    util,
) {
    var SUPPORTED_MEDIA_TYPES = ['image', 'audio', 'video', 'video-inline'],
        ITEXT_TYPES = ['default', 'audio', 'image', 'video', 'video-inline'],
        ITEXT_PROPERTIES = [
            'labelItext',
            'hintItext',
            'helpItext',
            'constraintMsgItext',
            'addEmptyCaptionItext',
            'addCaptionItext',
        ];

    var getDefaultItextRoot = function (mug) {
        if (mug.__className === "Choice") {
            var regex = new RegExp(util.invalidAttributeRegex.source, 'g');
            return getDefaultItextRoot(mug.parentMug) + "-" +
                mug.getNodeID().replace(regex, '_');
        } else {
            var path = mug.absolutePathNoRoot;
            if (!path) {
                if (mug.parentMug) {
                    path = mug.parentMug.absolutePathNoRoot +
                            "/" + mug.getNodeID();
                } else {
                    // fall back to nodeID if mug path still not found
                    // this can happen with malformed XForms
                    path = "/" + mug.getNodeID();
                }
            }
            return path.slice(1);
        }
    };

    var getDefaultItextId = function (mug, property) {
        return getDefaultItextRoot(mug) + "-" + property;
    };

    var looksLikeMarkdown = function (val, supportTables) {
        /* Regex checks (in order):
         * ordered lists
         * unordered lists
         * strikethrough
         * headings
         * italics/bold/bold italics
         * links
         * tables (hasTable regex) 
         */
        var hasMarkdown = /^\d+[.)] |^\* |~~.+~~|# |\*{1,3}\S.*\*{1,3}|\[.+\]\(\S+\)/m.test(val),
            hasTable = false;
        if (supportTables) {
            hasTable = /^(\|[^\n]+\|\r?\n)((?:\|\s*:?[-]+:?\s*)+\|)(\n(?:\|[^\n]+\|\r?\n?)*)?$/m.test(val);
        }
        return hasMarkdown || hasTable;
    };

    /**
     * Call visitor function for each Itext item in the form
     */
    var forEachItextItem = function (form, visit) {
        var seen = {};

        form.tree.walk(function (mug, nodeID, processChildren) {
            if (mug) { // skip root node
                _.each(ITEXT_PROPERTIES, function (property) {
                    var item = mug.p[property];
                    if (item && !item.key) {
                        // this should never happen
                        window.console.log(
                            "ignoring ItextItem without a key: " + item.id);
                        return;
                    } else if (item && !Object.prototype.hasOwnProperty.call(seen, item.key)) {
                        seen[item.key] = true;
                        visit(item, mug, property);
                    }
                });
            }
            processChildren();
        });
    };

    /**
     * Walks the tree and grabs Itext items from mugs
     *
     * This updates the ID of each returned Itext item according to it's
     * autoId property. IDs of items with autoId turned off will not be
     * modified unless the ID is blank or it conflicts with another item.
     * NOTE because this mutates itext IDs it could cause subtle side
     * effects if anything depends on Itext IDs not changing at random
     * times such as save, copy, paste, export translations, etc.
     *
     * @param form - the vellum instance's Form object.
     * @param asObject - if true, return all items in an object keyed by id;
     *                   otherwise return a list of non-empty Itext items.
     * @returns - a list or object containing Itext items (see `asObject`).
     */
    var getItextItemsFromMugs = function (form, asObject) {
        var empty = asObject,
            items = [],
            byId = {},
            props = _.object(_.map(ITEXT_PROPERTIES, function (thing) {
                return [thing, thing.replace("Itext", "")];
            }));

        forEachItextItem(form, function (item, mug, property) {
            var itemIsEmpty = item.isEmpty();
            if (!itemIsEmpty || empty) {
                var id = item.autoId || !item.id ?
                        getDefaultItextId(mug, props[property]) : item.id,
                    origId = id,
                    count = 2;
                if (Object.prototype.hasOwnProperty.call(byId, id) && (itemIsEmpty || item === byId[id])) {
                    // ignore same or empty item with duplicate ID
                    return;
                }
                while (Object.prototype.hasOwnProperty.call(byId, id)) {
                    id = origId + count;
                    count++;
                }
                item.id = id;
                byId[id] = item;
                if (!asObject) {
                    items.push(item);
                }
            }
        });
        return asObject ? byId : items;
    };

    var parseXLSItext = function (form, str, Itext) {
        var forms = ITEXT_TYPES,
            languages = Itext.getLanguages(),
            nextRow = tsv.makeRowParser(str),
            header = nextRow(),
            i, cells, head, item;

        if (header) {
            header = _.map(header, function (val) {
                var formlang = val.split(/[-_]/);
                if (forms.indexOf(formlang[0]) === -1 ||
                        languages.indexOf(formlang[1]) === -1) {
                    return null;
                }
                return {form: formlang[0], lang: formlang[1]};
            });
        }

        var items = getItextItemsFromMugs(form, true);
        for (cells = nextRow(); cells; cells = nextRow()) {
            item = items[cells[0]];
            if (!item) {
                // TODO alert user that row was skipped
                continue;
            }
            for (i = 1; i < cells.length; i++) {
                head = header[i];
                if (head) {
                    if (item.hasForm(head.form)) {
                        item.getForm(head.form).setValue(head.lang, cells[i]);
                    } else if ($.trim(cells[i])) {
                        item.getOrCreateForm(head.form).setValue(head.lang, cells[i]);
                    }
                }
            }
        }
        Itext.fire("change");
    };

    var generateItextXLS = function (form, Itext) {
        function rowify(firstVal, languages, forms, func) {
            var row = [firstVal];
            _.each(forms, function (form) {
                _.each(languages, function (language) {
                    row.push(func(language, form));
                });
            });
            return row;
        }

        function makeRow(item, languages, forms) {
            return rowify(item.id, languages, forms, function (language, form) {
                return item.hasForm(form) ? item.get(form, language) : "";
            });
        }

        function makeHeadings(languages, forms) {
            return rowify("label", languages, forms, function (language, form) {
                return form + '_' + language;
            });
        }

        // TODO: should this be configurable?
        var forms = ITEXT_TYPES,
            languages = Itext.getLanguages(),
            rows = [];

        if (languages.length > 0) {
            var items = getItextItemsFromMugs(form);
            rows.push(makeHeadings(languages, forms));
            _.each(items, function (item) {
                rows.push(makeRow(item, languages, forms));
            });
        }
        return tsv.tabDelimit(rows);
    };

    var warnOnNonOutputableValue = function (form, mug, path) {
        if (!mug.options.canOutputValue) {
            // TODO display message near where it was dropped
            // HACK should be in the itext widget, which has the mug and path
            var current = form.vellum.getCurrentlySelectedMug(),
                typeName = mug.options.typeName;
            if (current) {
                current.addMessage(null, {
                    key: "javaRosa-output-value-type-error",
                    level: mug.WARNING,
                    message: util.format(gettext(
                        "{type} nodes cannot be used in an output value. " +
                        "Please remove the output value for '{path}' or " +
                        "your form will have errors.",
                    ), {type: typeName, path: path}),
                });
            }
        }
    };

    var getOutputRef = function (path, dateFormat) {
        if (dateFormat) {
            return '<output value="format-date(date(' + path + '), \'' + dateFormat + '\')"/>';
        } else {
            return '<output value="' + path + '" />';
        }
    };

    var warnOnCircularReference = function (property, mug, path, refName, propName) {
        // TODO track output refs in logic manager
        if (path === "." && property === 'label') {
            var fieldName = mug.p.getDefinition(property).lstring;
            mug.addMessage(propName, {
                key: "core-circular-reference-warning",
                level: mug.WARNING,
                message: util.format(gettext(
                    "The {field} for a question is not allowed to reference " +
                    "the question itself. Please remove the {ref} from the " +
                    "{field} or your form will have errors.",
                ), {field: fieldName, ref: refName}),
            });
        }
    };

    var insertOutputRef = function (vellum, target, path, mug, dateFormat) {
        var output = getOutputRef(path, dateFormat),
            form = vellum.data.core.form;
        if (form.richText) {
            richText.editor(target).insertOutput(output);
        } else {
            util.insertTextAtCursor(target, output, true);
        }
        if (mug) {
            warnOnCircularReference(
                'label', mug, path, gettext('output value'), target.attr('name'));
            warnOnNonOutputableValue(form, mug, path);
        }
    };

    function _outputToXPathOrHashtag(functionName) {
        return function (text, xpathParser, escape) {
            if (text) {
                var xquery = xml.query(text);
                xquery.find('output').each(function () {
                    var $this = $(this),
                        value = $this.xmlAttr('value') || $this.xmlAttr('ref');
                    try {
                        var parsedValue = xpathParser.parse(value);
                        $this.xmlAttr('value', parsedValue[functionName]());
                    } catch (e) {
                        $this.xmlAttr('value', value);
                    }
                });
                text = xquery.toString();
                if (escape) {
                    text = text.replace(/(<)|>/g, function (match, lt) {
                        return lt ? "&lt;" : "&gt;";
                    });
                }
            }
            return text;
        };
    }


    return {
        ITEXT_PROPERTIES: ITEXT_PROPERTIES,
        SUPPORTED_MEDIA_TYPES: SUPPORTED_MEDIA_TYPES,
        forEachItextItem: forEachItextItem,
        generateItextXLS: generateItextXLS,
        getDefaultItextRoot: getDefaultItextRoot,
        getDefaultItextId: getDefaultItextId,
        getItextItemsFromMugs: getItextItemsFromMugs,
        getOutputRef: getOutputRef,
        insertOutputRef: insertOutputRef,
        looksLikeMarkdown: looksLikeMarkdown,
        parseXLSItext: parseXLSItext,
        outputToXPath: _outputToXPathOrHashtag('toXPath'),
        outputToHashtag: _outputToXPathOrHashtag('toHashtag'),
    };
});
