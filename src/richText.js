/*
 * expected structure of a richText widget:
 *
 * <div contenteditable="true" ... ckeditor stuff...>
 *   <p>
 *      User input text
 *   </p>
 * </div>
 *
 * Possible values for user's input text:
 *
 * text
 *
 * newline: <br />
 *
 * rich text "bubble":
 *   <span data-value="xpath">
 *     <i class="icon">&nbsp;</i>
 *     text to display inside bubble
 *   </span>
 *
 * Any other HTML has undefined behavior.
 *
 * Expression editng mode returns invalid xpath expressions with a special
 * "#invalid/xpath " prefix and bubbles are escaped with backticks. Example:
 *
 *   #invalid/xpath (`#form/text`
 */

(function () {
    // set CKEditor base path before loading ckeditor
    var path = window.requirejs.toUrl("vellum/../lib/ckeditor/").replace(/\?.*/, "");
    window.CKEDITOR_BASEPATH = path;
})();

define([
    'require',
    'underscore',
    'jquery',
    'tpl!vellum/templates/date_format_popover',
    'tpl!vellum/templates/easy_reference_popover',
    'vellum/dateformats',
    'vellum/escapedHashtags',
    'vellum/logic',
    'vellum/util',
    'vellum/xml',
    'vellum/hqAnalytics',
    'ckeditor',
    'ckeditor-jquery'
], function(
    require,
    _,
    $,
    date_format_popover,
    easy_reference_popover,
    dateformats,
    escapedHashtags,
    logic,
    util,
    xml,
    analytics,
    CKEDITOR
){
    var FORM_REF_REGEX = /^#form\//,
        INVALID_PREFIX = "#invalid/xpath ",
        // http://stackoverflow.com/a/16459606/10840
        bubbleWidgetDefinition = {
        template:
            '<span class="label label-datanode label-datanode-internal">' +
              '<i class="fa fa-question-circle">&nbsp;</i>' +
              'example widget, not used' +
            '</span>',
        upcast: function ( element ) {
            return element.name === 'span' && element.hasClass('label-datanode');
        },
        init: function() {
            // TODO: PR to ckeditor to make changing drag ui supported
            var $this = $(this.element.$),
                width = $this.innerWidth(),
                height = $this.outerHeight(),
                dragContainer = this.dragHandlerContainer,
                editor = this.editor;
            dragContainer.setStyles({
                width: width + 'px',
                height: height + 'px',
                left: '0px'
            });

            if (editor.commands.createPopover) {
                var _this = this;

                // Look for deleted bubbles
                editor.on('change', function(e) {
                    editor.widgets.checkWidgets({ initOnlyNew: 1 });
                });

                // if the editor is still being initialized then this command
                // won't be enabled until it is ready
                if (editor.status === "ready") {
                    editor.execCommand('createPopover', _this);
                } else {
                    editor.on('instanceReady', function () {
                        editor.execCommand('createPopover', _this);
                    });
                }
            }
        }
    };

    CKEDITOR.plugins.add('bubbles', {
        requires: 'widget',
        init: function (editor) {
            editor.widgets.add('bubbles', bubbleWidgetDefinition);
        }
    });

    CKEDITOR.config.allowedContent = true;
    CKEDITOR.config.customConfig = '';
    CKEDITOR.config.title = false;
    CKEDITOR.config.extraPlugins = 'bubbles';
    CKEDITOR.config.disableNativeSpellChecker = false;

    /**
     * Get or create a rich text editor for the given element
     *
     * Only the first argument is needed to get the editor once an
     * editor has been created for a given jQuery object. Calling
     * this function with a single argument is a good way to get an
     * editor that you expect to already exist; an error will be thrown
     * if the editor does not exist.
     *
     * @param input - editor jQuery HTML element.
     * @param form - form object, functions used:
     *    normalizeHashtag - get expression with normalized hashtags
     *    isValidHashtag - boolean if hashtag translation exists
     *    getIconByPath - only used for mug.options.icon
     *    xpath - xpath parser
     * @param options -
     *    rtl - use right to left text
     *    isExpression - treat input as xpath or itext
     *    createPopover - function to create a popover on the bubble.
     *        arguments are editor, ckwidget
     */
    var editor = function(input, form, options) {
        // HACK use 1/4 em space to fix cursor movement/hiding near bubble
        var TRAILING_SPACE = "\u2005";
        function insertHtmlWithSpace(content) {
            editor.insertHtml(content + TRAILING_SPACE);
        }
        var wrapper = input.data("ckwrapper");
        if (wrapper) {
            return wrapper;
        }
        if (arguments.length === 1) {
            throw new Error("editor not initialized: " +
                            $("<div>").append(input).html());
        }
        if (input.length !== 1) {
            throw new Error("input should reference exactly one element, " +
                            "got " + input.length);
        }
        options = options || {};
        if (!options.createPopover && !form.vellum.opts().features.disable_popovers) {
            options.createPopover = createPopover;
        }
        var NOTSET = {},
            newval = NOTSET,  // HACK work around async get/set
            editor = input.ckeditor({
                contentsLangDirection: options.rtl ? 'rtl' : 'ltr',
                disableNativeSpellChecker: options.disableNativeSpellChecker,
                placeholder: ' ',
            }).editor;
        wrapper = {
            getValue: function (callback) {
                if (callback) {
                    input.promise.then(function() {
                        callback(fromRichText(editor.getData()));
                    });
                } else if (newval !== NOTSET) {
                    return newval;
                } else {
                    var data;
                    try {
                        data = editor.getData();
                    } catch (err) {
                        if (err.name !== "IndexSizeError") {
                            throw err;
                        }
                        // HACK work around Chrome/CKEditor bug
                        // https://dev.ckeditor.com/ticket/13903
                        wrapper.select(0);
                        data = editor.getData();
                    }
                    return fromRichText(data, form, options.isExpression);
                }
            },
            setValue: function (value, callback) {
                newval = value;
                value = toRichText(value, form, options);
                editor.setData(value, {
                    callback: function () {
                        newval = NOTSET;
                        if (callback) { callback(); }
                    },
                    noSnapshot: true,
                });
                return wrapper;
            },
            insertExpression: function (xpath) {
                if (options.isExpression) {
                    insertHtmlWithSpace(bubbleExpression(xpath, form));
                } else {
                    var output = makeBubble(form, xpath);
                    insertHtmlWithSpace($('<p>').append(output).html());
                }
                return wrapper;
            },
            insertOutput: function (xpath) {
                if (options.isExpression) {
                    throw new Error("cannot insert output into expression editor");
                }
                insertHtmlWithSpace(bubbleOutputs(xpath, form));
                return wrapper;
            },
            change: function () {
                editor.fire("saveSnapshot");
                return wrapper;
            },
            focus: function() {
                if (editor.status === "ready") {
                    editor.focus();
                } else {
                    editor.removeListener('instanceReady', editor.focus);
                    editor.on('instanceReady', editor.focus);
                }
            },
            select: function (index, length) {
                ckSelect.call(null, editor, index, length);
                return wrapper;
            },
            on: function () {
                var args = Array.prototype.slice.call(arguments);
                editor.on.apply(editor, args);
                return wrapper;
            },
            destroy: function () {
                if (input !== null) {
                    input.removeData("ckwrapper");
                    input.promise.then(function () {
                        editor.destroy();
                        editor = null;
                    });
                    input = null;
                }
            },
        };

        editor.on('focus', function (e) {
            // workaround for https://code.google.com/p/chromium/issues/detail?id=313082
            editor.setReadOnly(false);
            // remove any placeholder text that may be in the text area
            var editable = e.editor.editable();
            if (editable.hasClass('placeholder')) {
                editable.removeClass('placeholder');
                editable.setHtml('');
            }
            // set the cursor to the end of text
            var selection = editor.getSelection();
            var range = selection.getRanges()[0];
            if (range) {
                var pCon = range.startContainer.getAscendant({p:2},true);
                if (pCon) {
                    var newRange = new CKEDITOR.dom.range(range.document);
                    newRange.moveToPosition(pCon, CKEDITOR.POSITION_BEFORE_END);
                    newRange.select();
                }
            }
        });

        editor._vellum_fromRichText = function (html) {
            return fromRichText(html, form, options.isExpression);
        };

        editor.on('paste', function(event) {
            var data = event.data;
            if (data.dataTransfer && data.dataTransfer.getData("Text")) {
                // Get plain text instead of HTML because HTML encoded
                // content from applications like Word or your text
                // editor often contains unwanted styling information.
                //
                // Insert HTML-ified plain text rather than HTML with
                // bubbles because we cannot reliably find hashtags in
                // text fragments that are not valid XPath expressions.
                // We need to know where the text is being pasted (is it
                // inside a string?), and finally put the cursor at the
                // end of the pasted content. It's hard, but maybe
                // possible? For now this tries to follow the law of
                // least surprise by inserting plain text. Unfortunately
                // a surprising thing happens later: hashtags are
                // automatically converted to bubbles the next time the
                // expression is loaded in a rich text editor.
                var text = data.dataTransfer.getData("Text");
                data.type = 'html';
                data.dataValue = $('<div />').text(text).html()
                    .replace(/\n/g, "<br />")
                    .replace(/  /g, " &nbsp;");
            } else {
                // fall back to HTML
                // Adapted from http://www.keyvan.net/2012/11/clean-up-html-on-paste-in-ckeditor/
                var style = /<style type="text\/css">.*?<\/style>/g;
                data.dataValue = data.dataValue.replace(style, "");
            }
        }, null, null, 2);

        if (_.isFunction(options.createPopover)) {
            editor.addCommand('createPopover', {
                exec: options.createPopover,
                editorFocus: false,
                canUndo: false,
            });
        }

        input.data("ckwrapper", wrapper);
        return wrapper;
    };

    function richTextDataTransfer(nativeDataTransfer, editor) {
        realDataTransfer.call(this, nativeDataTransfer);

        if (editor) {
            this.sourceEditor = editor;

            var html = editor.getSelectedHtml(1);
            if (html) {
                var text = editor._vellum_fromRichText(html);
                if (isInvalid(text)) {
                    text = escapedHashtags.transform(
                        text.slice(INVALID_PREFIX.length),
                        function (v) { return v; }
                    );
                }
                // always copy plain text, not HTML
                this.setData('text/plain', text);
            }
        }
    }
    // monkeypatch clipboard plugin to transform easy reference
    // bubbles to hashtags on copy/cut.
    var realDataTransfer = CKEDITOR.plugins.clipboard.dataTransfer;
    richTextDataTransfer.prototype = realDataTransfer.prototype;
    CKEDITOR.plugins.clipboard.dataTransfer = richTextDataTransfer;

    /**
     * Set selection in CKEditor
     */
    function ckSelect(editor, index, length) {
        function iterNodes(parent) {
            var i = 0,
                children = parent.getChildren(),
                count = children.count(),
                inner = null;
            function next() {
                var child;
                if (inner) {
                    child = inner();
                    if (child !== null) {
                        return child;
                    }
                    inner = null;
                }
                if (i >= count) {
                    return null;
                }
                child = children.getItem(i);
                i++;
                if (child.type === CKEDITOR.NODE_ELEMENT) {
                    var name = child.getName().toLowerCase();
                    if (name === "p") {
                        inner = iterNodes(child);
                        return next();
                    }
                    if (name === "span" || name === "br") {
                        return {node: child, length: 1, isText: false};
                    }
                    throw new Error("not implemented: " + name);
                } else if (child.type === CKEDITOR.NODE_TEXT) {
                    return {
                        node: child,
                        length: child.getText().length,
                        isText: true,
                    };
                }
                throw new Error("unhandled element type: " + child.type);
            }
            return next;
        }
        function getNodeOffset(index, nextNode) {
            var offset = index,
                node = nextNode();
            while (node) {
                if (node.length >= offset) {
                    return {
                        node: node.node,
                        offset: offset,
                        isText: node.isText,
                    };
                }
                offset -= node.length;
                node = nextNode();
            }
            throw new Error("index is larger than content: " + index);
        }
        editor.focus();
        var sel = editor.getSelection(),
            nextNode = iterNodes(sel.root),
            node = getNodeOffset(index, nextNode),
            range = sel.getRanges()[0];
        if (node.isText) {
            range.setStart(node.node, node.offset);
        } else {
            range.setStartAfter(node.node);
        }
        if (length) {
            nextNode = iterNodes(sel.root);
            node = getNodeOffset(index + length, nextNode);
            if (node.isText) {
                range.setEnd(node.node, node.offset);
            } else {
                range.setEndAfter(node.node);
            }
        } else {
            range.collapse(true);
        }
        sel.selectRanges([range]);
    }

    /*
     * formats specifies the serialization for different formats that can be
     * applied to bubbles.
     *
     * Notes:
     *   uses outputValue as that's what $el.data() transforms data-output-value
     *
     * For now, ordering matters.
     * TODO: should each bubble contain the correct ordering?
     */
    var formats = {
            'dateFormat': {
                serialize: function(currentValue, dataAttrs) {
                    return _.template("format-date(date(<%=xpath%>), '<%=dateFormat%>')")({
                        xpath: currentValue,
                        dateFormat: dataAttrs.dateFormat
                    });
                },
            },
            'value': {
                serialize: function(currentValue) {
                    return _.template('&lt;output value="<%=xpath%>" /&gt;')({
                        xpath: currentValue
                    });
                },
            }
        },
        formatOrdering = ['dateFormat', 'value'];

    /**
     * Takes in data attributes from a "bubble"
     *
     * Example
     *   serializing the rich text
     *     <span data-value='/data/value' ... />
     *   with
     *     applyFormats($bubble.data())
     *   would return
     *     <output value="/data/value" />
     */
    function applyFormats(dataAttrs) {
        var currentValue = dataAttrs.value;
        _.each(formatOrdering, function(format) {
            if (dataAttrs[format]) {
                currentValue = formats[format].serialize(currentValue, dataAttrs);
            }
        });
        return currentValue;
    }

    /**
     * @param path can be:
     *   form: /data/group/text
     *   instance: instance('blah')/blah_list/blah
     */
    function getBubbleDisplayValue(path, xpathParser) {
        var parsed = new logic.LogicExpression(path, xpathParser),
            topLevelPaths = parsed.getTopLevelPaths(),
            hashtags = parsed.getHashtags(),
            steps, dispValue;

        if (topLevelPaths.length) {
            steps = topLevelPaths[0].steps;
            dispValue = steps[steps.length-1].name;
        } else {
            steps = hashtags[0].toHashtag().split('/');
            dispValue = steps[steps.length-1];
        }
        return dispValue;
    }

    /**
     * Make a xpath bubble
     *
     * @param xpath - xpath expression to set as the bubble value.
     * @returns jquery object of the bubble
     */
    function makeBubble(form, xpath) {
        function _parseXPath(xpath, form) {
            if (!FORM_REF_REGEX.test(xpath)) {
                if (form.isValidHashtag(xpath)) {
                    return {
                        classes: ['label-datanode-external', 'fcc fcc-fd-case-property']
                    };
                } else if (form.hasValidHashtagPrefix(form.normalizeHashtag(xpath))) {
                    return {
                        classes: ['label-datanode-external-unknown', 'fa fa-exclamation-triangle']
                    };
                }
            }

            var icon = form.getIconByPath(xpath);
            if (icon) {
                return {classes: ['label-datanode-internal', icon]};
            }
            return {classes: ['label-datanode-unknown', 'fcc fcc-help']};
        }

        var xpathInfo = _parseXPath(xpath, form),
            bubbleClasses = xpathInfo.classes[0],
            iconClasses = xpathInfo.classes[1],
            dispValue = getBubbleDisplayValue(xpath, form.xpath),
            icon = $('<i>').addClass(iconClasses).html('&nbsp;');
        return $('<span>')
            .addClass('label label-datanode ' + bubbleClasses)
            .attr('data-value', xpath)
            .append(icon)
            .append(dispValue);
    }

    /**
     * @param output - <output ...> DOM element
     * @returns - jquery object of xpath bubble or string
     */
    function outputToBubble(form, output) {
        var info = extractXPathInfo($(output)),
            xpath = form.normalizeHashtag(info.value, true),
            attrs = _.omit(info, 'value'),
            startsWithRef = xpath && (FORM_REF_REGEX.test(xpath) ||
                                      form.hasValidHashtagPrefix(xpath)),
            containsWhitespace = /\s/.test(xpath);

        if (!startsWithRef || (startsWithRef && containsWhitespace)) {
            return $('<span>').text(xml.normalize(output)).html();
        }
        return $('<div>').append(makeBubble(form, xpath).attr(attrs)).html();
    }

    /**
     * Replace <output> tags with bubble markup
     *
     * @param escape - If true, escape HTML except for bubble markup.
     */
    function bubbleOutputs(text, form, escape) {
        var el = xml.xhtml(text),
            places = {},
            replacer, result;

        if (escape) {
            replacer = function() {
                var id = util.get_guid();
                places[id] = outputToBubble(form, this);
                return "{" + id + "}";
            };
        } else {
            replacer = function() {
                return outputToBubble(form, this);
            };
        }
        el.find('output').replaceWith(replacer);
        result = el.html();
        if (escape) {
            result = escapeReplace(result, places);
        }
        return result;
    }

    /**
     * Preserve <output> tag while encoding other HTML before saving to source XML
     * Similar to bubbleOutputs (without converting to bubble markup)
     */
    function sanitizeInput (text, form) {
        var el = xml.xhtml(text),
            places = {};

        function replacer() {
            var id = util.get_guid();
            places[id] = this;
            return "{" + id + "}";
        }
        el.find('output').replaceWith(replacer);
        return escapeReplace(el.html(), places);
    }

    function escapeReplace(text, places) {
        text = $('<div />').text(xml.humanize(text)).html();
        text = text.replace(/{(.+?)}/g, function (match, id) {
            return places.hasOwnProperty(id) ?
                    $("<div>").append(places[id]).html() : match;
        });
        return text;
    }

    /**
     * Wrap top-level expression nodes with bubble markup
     */
    function bubbleExpression(text, form) {
        var transform;
        if (isInvalid(text)) {
            text = text.slice(INVALID_PREFIX.length);
            transform = escapedHashtags.transform;
        } else {
            transform = form.transformHashtags;
        }
        function bubble(hashtag) {
            return makeBubble(form, hashtag).prop('outerHTML');
        }
        return transform(text, bubble, true);
    }

    function unwrapBubbles(text, form, isExpression) {
        var el = xml.xhtml(text),
            places = {},
            bubbles = el.find('.label-datanode'),
            replacer, result, expr;
        if (!bubbles.length) {
            return el.text();
        }
        if (isExpression) {
            replacer = function () {
                var id = util.get_guid();
                places[id] = $(this).data("value");
                return "{" + id + "}";
            };
        } else {
            replacer = function () {
                return applyFormats($(this).data());
            };
        }
        bubbles.replaceWith(replacer);
        result = el.text();
        if (isExpression) {
            expr = result.replace(/{(.+?)}([\w.\-]?)/g, function (match, id, after) {
                // `after` is a character following {id} that would fuse with
                // the bubble expression if we did not put a space between them
                return places.hasOwnProperty(id) ?
                    places[id] + (after ? " " + after : "") : match;
            });
            try {
                form.xpath.parse(expr);
            } catch (e) {
                expr = INVALID_PREFIX + escapedHashtags.escapeDelimiters(result)
                    .replace(/{(.+?)}/g, function (match, id) {
                        return places.hasOwnProperty(id) ?
                            escapedHashtags.delimit(places[id]) : match;
                    });
            }
            result = expr;
        }
        return result;
    }

    /**
     * Check for escaped invalid hashtag expression
     */
    function isInvalid(value) {
        return value.startsWith(INVALID_PREFIX);
    }

    /**
     * Convert escaped hashtag expression to xpath
     *
     * @return - unescaped expression with hashtags converted to
     *      equivalent xpath if the given value is marked with the
     *      invalid xpath prefix, otherwise the given value
     */
    function unescapeXPath(value, form) {
        if (isInvalid(value)) {
            value = escapedHashtags.transform(
                value.slice(INVALID_PREFIX.length),
                form.normalizeXPath.bind(form)
            );
        }
        return value;
    }

    /**
     * Convert plain text to HTML to be edited in CKEditor
     *
     * Replace line breaks with <p> tags and preserve contiguous spaces.
     */
    function toHtml(text) {
        text = text.replace(/\n/g, "</p><p>")
                   .replace(/  /g, " &nbsp;");
        return "<p>" + text + "</p>";
    }

    /**
     * Convert CKEditor HTML to plain text
     *
     * Replace <p> tags with newlines.
     */
    function fromHtml(html) {
        return html.replace(/<p>&nbsp;<\/p>/ig, "\n")
                   .replace(/<p>/ig,"")
                   .replace(/<\/p>/ig, "\n")
                   .replace(/<br \/>/ig, "\n")
                   .replace(/(&nbsp;|\xa0|\u2005)/ig, " ")
                   // CKEditor uses zero-width spaces as markers
                   // and sometimes they leak out (on copy/paste?)
                   .replace(/\u200b+/ig, " ")
                   // fixup final </p>, which is is not a newline
                   .replace(/\n$/, "");
    }

    /**
     * Takes a value from xml and replaces xpaths with bubbles to display in the
     * editor
     *
     * @param options - An object containing options for the conversion:
     *      - isExpression - Convert all top-level path elements to bubbles
     *          if true; otherwise convert <output ... /> elements to bubbles.
     * @returns - html string to be displayed in editor
     */
    function toRichText(text, form, options) {
        if (!text) {return "";}
        options = options || {};
        var bubble = options.isExpression ? bubbleExpression : bubbleOutputs;
        return toHtml(bubble(text, form));
    }

    /**
     * Deconstructs html strings that have bubbles in them
     * This should preserve whitespace as it appears in the editor
     *
     * Dependent on CKEditor, which uses p and &nbsp; to format content
     *
     * Expects the html to only be at most two levels deep (considering a
     * bubble span as one level):
     *   <p>
     *     <br />
     *     <span /> (info)
     *   </p>
     *
     * @param html - HTML string that may or may not have bubble
     * @returns - string with bubbles deconstructed into plain text
     */
    function fromRichText(html, form, isExpression) {
        return unwrapBubbles(fromHtml(html), form, isExpression);
    }

    /**
     * @param output - jQuery <output ...> element
     * @returns - object with value and maybe data-date-format
     */
    function extractXPathInfo(output) {
        var value = output.xmlAttr('vellum:value') ||
                output.xmlAttr('value') ||
                output.xmlAttr('ref'),
            dateMatch = /^format-date\(date\(([^)]+)\),\s*'([^']+)'\)$/.exec(value);
        if (dateMatch) {
            return {value: dateMatch[1], 'data-date-format': dateMatch[2]};
        }
        return {value: value};
    }

    var DATE_FORMATS = {
        // See format-date(date value, string format) at:
        // http://dimagi.github.io/xform-spec/#xpath-functions
        Y: "yyyy",  // 4-digit year
        y: "yy",    // 2-digit year
        m: "mm",    // 0-padded month
        n: "m",     // numeric month
        b: "mmm",   // short text month (Jan, Feb, etc)
        d: "dd",    // 0-padded day of month
        e: "d",     // day of month
        H: "HH",    // 0-padded hour (24-hr time)
        h: "H",     // hour (24-hr time)
        M: "MM",    // 0-padded minute
        S: "SS",    // 0-padded second
        3: "msec",  // 0-padded millisecond ticks
        a: "ddd",   // short text day (Sun, Mon, etc)
    };

    function getHumanReadableDateFormat(format) {
        // ""               -> "no format"
        // "%e/%n/%y"       -> "d/m/yy"
        // "%a, %b %e, %Y"  -> "ddd, mmm d, yyyy"
        if (!format) {
            return gettext("no formatting");
        }
        return format.replace(/(%[YymnbdeHhMS3a])/g, function (match, fmt) {
            return DATE_FORMATS.hasOwnProperty(fmt[1]) ? DATE_FORMATS[fmt[1]] : fmt;
        });
    }

    function createPopover(editor, ckwidget) {
        var $this = $(ckwidget.element.$),
            dragContainer = ckwidget.dragHandlerContainer;
        // Setup popover
        var xpath = $this.data('value'),
            getWidget = require('vellum/widgets').util.getWidget,
            // TODO find out why widget is sometimes null (tests only?)
            widget = getWidget($this);
        if (widget) {
            var isFormRef = FORM_REF_REGEX.test(xpath),
                isText = function () { return this.nodeType === 3; },
                displayId = $this.contents().filter(isText)[0].nodeValue,
                hashtag = widget.mug.form.normalizeHashtag(xpath),
                title = util.escape(hashtag),
                labelMug = widget.mug.form.getMugByPath(xpath),
                description = labelMug && labelMug.p.labelItext ?
                            labelMug.p.labelItext.get() : "",
                isDate = labelMug && labelMug.__className.indexOf("Date") === 0,
                $dragContainer = $(dragContainer.$),
                $imgs = $dragContainer.children("img"),
                dateFormatID = util.get_guid(),
                getTitle = function () {
                    var title_ = title,
                        format = $this.attr("data-date-format");
                    if (isDate || format) {
                        title_ += date_format_popover({
                            guid: dateFormatID,
                            text: util.escape(getHumanReadableDateFormat(format)),
                        });
                    }
                    return '<h3>' + util.escape(displayId) + '</h3>' +
                        '<div class="text-muted">' + title_ + '</div>';
                };
            if (!labelMug) {
                var datasources = widget.mug.form.vellum.datasources;
                description = datasources.getNode(hashtag, {}).description || "";
            }
            description = xml.xhtml(description);
            description.find('output').replaceWith(function () {
                var xpath = extractXPathInfo($(this)).value;
                return widget.mug.form.normalizeHashtag(xpath);
            });

            // Remove ckeditor-supplied title attributes, which will otherwise override popover title
            $imgs.removeAttr("title");

            $imgs.popover({
                trigger: 'hover',
                container: 'body',
                placement: 'bottom',
                title: getTitle,
                html: true,
                sanitize: false,  // bootstrap, don't remove data-ufid attribute
                content: easy_reference_popover({
                    text: description.text(),
                    ufid: labelMug ? labelMug.ufid : "",
                }),
                template: '<div contenteditable="false" class="popover rich-text-popover">' +
                    '<div class="popover-inner">' +
                    '<div class="popover-title"></div>' +
                    (labelMug || description.text() ?
                        '<div class="popover-content"><p></p></div>' : '') +
                    '</div></div>',
                delay: {
                    show: 350,  // be less annoying
                    hide: 200,  // allow time for user to move cursor into popover
                },
            }).on('shown.bs.popover', function() {
                var type = isFormRef ? 'form' : 'case';
                analytics.fbUsage("Hovered over easy " + type + " reference");
                analytics.workflow("Hovered over easy reference");
                if (isDate || $this.attr("data-date-format")) {
                    var pos = $(this).offset(),
                        x = pos.left,
                        y = pos.top + $(this).height();
                    $("#" + dateFormatID).click(function () {
                        $imgs.popover('hide');
                        dateformats.showMenu(x, y, function (format) {
                            $this.attr("data-date-format", format);
                            editor.fire("saveSnapshot");
                        }, true);
                        return false;
                    });
                }
            });

            ckwidget.on('destroy', function (e)  {
                try {
                    $imgs.popover('destroy');
                } catch(err) {
                    // sometimes these are already destroyed
                }
            });
        }
    }

    return {
        applyFormats: applyFormats,
        bubbleOutputs: bubbleOutputs,
        sanitizeInput: sanitizeInput,
        editor: editor,
        fromRichText: fromRichText,
        toRichText: toRichText,
        isInvalid: isInvalid,
        unescapeXPath: unescapeXPath,
    };
});
