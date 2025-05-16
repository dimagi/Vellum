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
    var path = 'src/../lib/ckeditor/';
    if (!window.CKEDITOR_BASEPATH) {
        window.CKEDITOR_BASEPATH = path;
    }
})();

define([
    'require',
    'underscore',
    'jquery',
    'vellum/templates/date_format_popover.html',
    'vellum/templates/easy_reference_popover.html',
    'vellum/dateformats',
    'vellum/escapedHashtags',
    'vellum/logic',
    'vellum/util',
    'vellum/xml',
    'vellum/hqAnalytics'
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
    analytics
){
    var FORM_REF_REGEX = /^#form\//;
    var INVALID_PREFIX = "#invalid/xpath ";

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
        var inputElement = input[0];
        if (options && options['disableNativeSpellChecker']) {
            inputElement.setAttribute('spellcheck', false);
        } else {
            inputElement.setAttribute('spellcheck', true)
        }
        
        // HACK use 1/4 em space to fix cursor movement/hiding near bubble
        var TRAILING_SPACE = "\u2005";

        let x, y;
        inputElement.addEventListener('mousemove', e => {
            x = e.clientX;
            y = e.clientY;
        });

        function htmlToElement(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            doc.body.firstChild.contentEditable = false;
            return doc.body.firstChild;
        }

        function insertHtmlWithSpace(content) {
            const hasFocus = document.activeElement === inputElement;
            console.log(`has focus ${hasFocus}`);
            let range;
            if (!hasFocus && x && y) {
                const elementAtDrop = document.elementFromPoint(x, y);
                const existingBubble = elementAtDrop ? elementAtDrop.closest('.label-datanode') : null;

                if (existingBubble) {
                    // If dropping on an existing bubble, position after it
                    range = document.createRange();
                    range.setStartAfter(existingBubble);
                    range.setEndAfter(existingBubble);
                } else {
                    const position = document.caretPositionFromPoint(x, y);
                    if (position) {
                        range = document.createRange();
                        range.setStart(position.offsetNode, position.offset);
                        range.collapse(true);

                        // Remove the paragraph so the inserted text does not create a new one.
                        const parentNode = position.offsetNode.parentNode;
                        if (parentNode && parentNode.tagName === 'P' &&
                            position.offsetNode.nodeType === Node.TEXT_NODE &&
                            position.offset === position.offsetNode.nodeValue.length) {
                            content = content.replace(/^<p>/i, '').replace(/<\/p>$/i, '');
                        }
                    }
                }
            } else if (!hasFocus) {
                range = document.createRange();
                range.selectNodeContents(inputElement);
                range.collapse();
            } else {
                range = window.getSelection().getRangeAt(0);
            }

            if (range) {

                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                const element = htmlToElement(content);
                range.deleteContents();
                range.insertNode(element);
                if (element.getAttribute('data-toggle')) {
                    createPopover(element);
                }
                inputElement.focus();

                const inputEvent = new Event('input', {
                    bubbles: true,
                    cancelable: true
                });
                inputElement.dispatchEvent(inputEvent);
            } else {
                console.log("no range")
            }
        }

        var getWidget = require('vellum/widgets').util.getWidget;

        function onVellumWidgetSet(element, callback, attempts = 0) {
            const maxAttempts = 5;
            const intervalTime = 500;

            if (attempts < maxAttempts) {
                var widget = getWidget($(element));
                if (widget !== null && widget !== undefined) {
                    callback();
                } else {
                    setTimeout(() => onVellumWidgetSet(element, callback, attempts + 1), intervalTime);
                }
            }
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
        let resolveEditorPromise;
        input.promise = new Promise((resolve) => {
          resolveEditorPromise = resolve;
        });
        var NOTSET = {};
        var newval = NOTSET,  // HACK work around async get/set
        wrapper = {
            getValue: function (callback) {
                if (callback) {
                    input.promise.then(function() {
                        callback(fromRichText(inputElement.innerHTML));// ??? why not data, form here?
                    });
                } else if (newval !== NOTSET) {
                    return newval;
                } else {
                    var data = inputElement.innerHTML;
                    var value = fromRichText(data, form, options.isExpression);
                    return value;
                }
            },
            setValue: function (value, callback) {
                newval = value;
                var richTextValue = toRichText(value, form, options);
                // console.log(`setValue: ${richTextValue}`);
                inputElement.innerHTML = richTextValue;
                onVellumWidgetSet(inputElement, () => {
                    inputElement
                        .querySelectorAll('[data-toggle="popover"]')
                        .forEach(element => createPopover(element));
                });

                newval = NOTSET;
                if (callback) {
                    setTimeout(callback, 0);
                }
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
                return wrapper;
            },
            focus: function() {
                inputElement.focus();
            },
            select: function (index, length) {
                console.log(`select ${inputElement.getAttribute('name')}`);
                divSelect.call(null, inputElement, index, length);
                // used in test???
                return wrapper;
            },
            on: function () {
                var args = Array.prototype.slice.call(arguments);
                if (args.length === 2 && args[0] === 'change' && typeof args[1] === 'function') {
                    const handleContentChange = function(e) {
                        // console.log(`editor change event`);
                        args[1].apply(); // callee in widgets.js does not take any arguments
                    };

                    inputElement.addEventListener('input', handleContentChange);
                    inputElement.addEventListener('paste', handleContentChange);
                    inputElement.addEventListener('cut', handleContentChange);

                }
                return wrapper;
            },
            destroy: function () {
                if (input !== null) {
                    input.removeData("ckwrapper");
                    input = null;
                }
            },
        };

        inputElement.addEventListener('copy', function(e) {
            e.preventDefault();
            const selection = window.getSelection();
            let selectedText = '';
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = document.createElement('div');
                container.appendChild(range.cloneContents());
                selectedText = fromRichText(container.innerHTML);
            }
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', selectedText);
            }
        });

        inputElement.addEventListener('paste', function(event) {
            event.preventDefault();
            if (event.clipboardData && event.clipboardData.getData("text/plain")) {
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
                // var text = data.dataTransfer.getData("Text");
                const text = event.clipboardData.getData("text/plain");
                const htmlText = document.createElement('div');
                htmlText.textContent = text; // This escapes the text
                const htmlContent = htmlText.innerHTML
                    .replace(/\n/g, "<br />")
                    .replace(/  /g, " &nbsp;");
                insertHTML(htmlContent);
            } else if (event.clipboardData.getData("text/html")){
                let htmlData = event.clipboardData.getData("text/html");
                const style = /<style[^>]*>.*?<\/style>/g;
                htmlData = htmlData.replace(style, "");
                insertHTML(htmlData);
            }
        });

        function insertHTML(html) {
            if (window.getSelection) {
                const sel = window.getSelection();
                if (sel.getRangeAt && sel.rangeCount) {
                    let range = sel.getRangeAt(0);
                    range.deleteContents();

                    const el = document.createElement("div");
                    el.innerHTML = html;
                    const frag = document.createDocumentFragment();
                    let node, lastNode;

                    while ((node = el.firstChild)) {
                        lastNode = frag.appendChild(node);
                    }
                    range.insertNode(frag);
                    if (lastNode) {
                        range = range.cloneRange();
                        range.setStartAfter(lastNode);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }
        }

        input.data("ckwrapper", wrapper);
        resolveEditorPromise()// probably can just set it to a resolved promise to beging with or remove the code that waits for it.
        return wrapper;
    };

    function divSelect(div, index, length) {
        function iterNodes(parent) {
            var i = 0,
                children = Array.from(parent.childNodes),
                count = children.length,
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
                child = children[i];
                i++;

                if (child.nodeType === Node.ELEMENT_NODE) {
                    var name = child.nodeName.toLowerCase();
                    if (name === "p") {
                        inner = iterNodes(child);
                        return next();
                    }
                    if (name === "span" || name === "br") {
                        return {node: child, length: 1, isText: false};
                    }
                    throw new Error("not implemented: " + name);
                } else if (child.nodeType === Node.TEXT_NODE) {
                    return {
                        node: child,
                        length: child.textContent.length,
                        isText: true,
                    };
                }
                throw new Error("unhandled element type: " + child.nodeType);
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

        div.focus();
        var sel = window.getSelection(),
            nextNode = iterNodes(div),
            node = getNodeOffset(index, nextNode),
            range = document.createRange();

        if (node.isText) {
            range.setStart(node.node, node.offset);
        } else {
            range.setStartAfter(node.node);
        }

        if (length) {
            nextNode = iterNodes(div);
            node = getNodeOffset(index + length, nextNode);
            if (node.isText) {
                range.setEnd(node.node, node.offset);
            } else {
                range.setEndAfter(node.node);
            }
        } else {
            range.collapse(true);
        }

        sel.removeAllRanges();
        sel.addRange(range);
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
                        classes: ['label-datanode-external-unknown', 'fa-solid fa-triangle-exclamation']
                    };
                }
            }

            var icon = form.getIconByPath(xpath);
            if (icon) {
                return {classes: ['label-datanode-internal', icon]};
            }
            return {classes: ['label-datanode-unknown', 'fcc fcc-help']};
        }

        var xpathInfo = _parseXPath(xpath, form);
        var bubbleClasses = xpathInfo.classes[0];
        var iconClasses = xpathInfo.classes[1];
        var dispValue = getBubbleDisplayValue(xpath, form.xpath);
        var icon = $('<i>').addClass(iconClasses).html('&nbsp;');
        var uniqueId = 'bubble-' + Math.random().toString(36).substr(2, 9);
        var $bubble = $('<span>')
            .addClass('label label-datanode ' + bubbleClasses)
            .attr('data-value', xpath)
            .attr('contenteditable', 'false')
            .attr('data-toggle', 'popover')
            .attr('id', uniqueId)
            .append(icon)
            .append(dispValue);

        return $bubble;
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
            replacer = function () {
                var id = util.get_guid();
                places[id] = outputToBubble(form, this);
                return "{" + id + "}";
            };
        } else {
            replacer = function () {
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
     * Similar to bubbleOutputs, without converting to bubble markup
     *
     * Regex matches any tags EXCEPT if it's an output tag (e.g. <output/>),
     * or if the '<' character is followed by a space (to avoid matching with
     * '<' or '>' characters used as attributes)
     */
    function sanitizeInput (text) {
        var regex = /<(?!output| )/g;
        if (!regex.test(text)) {
            return text;
        }

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
     * Get unescaped hashtag expression
     *
     * @return - expression with hashtags as they were
     *      originally typed if the given value is marked with the
     *      invalid xpath prefix, otherwise the given value
     */
    function unescapeHashtags(value, form) {
        if (isInvalid(value)) {
            value = escapedHashtags.transform(
                value.slice(INVALID_PREFIX.length),
                form.normalizeHashtag.bind(form)
            );
        }
        return value;
    }

    /**
     * Convert plain text to HTML
     *
     * Replace line breaks with <p> tags and preserve contiguous spaces.
     */
    function toHtml(text) {
        text = text.replace(/\n/g, "</p><p>")
                   .replace(/  /g, " &nbsp;");
        return "<p>" + text + "</p>";
    }

    /**
     * Convert HTML to plain text
     *
     * Replace <p> tags with newlines.
     */
    function fromHtml(html) {
        return html.replace(/<p>&nbsp;<\/p>/ig, "\n")
                   .replace(/<p>/ig,"")
                   .replace(/<\/p>/ig, "\n")
                   .replace(/<br \/>/ig, "\n")
                   .replace(/(&nbsp;|\xa0|\u2005)/ig, " ")
                   // While copying widgets with text, CKEditor adds these html elements
                   .replace(/<span\b[^>]*?id="?cke_bm_\d+\w"?\b[^>]*?>.*?<\/span>/ig, "")
                   .replace(/<span\b[^>]*?data-cke-copybin-(start|end)[^<]*?<\/span>/ig, "")
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

    function createPopover(element) {
        var $element = $(element);
        var $widget = $element .closest('.form-control')
        var xpath = element.getAttribute('data-value');
        var getWidget = require('vellum/widgets').util.getWidget;
        // TODO find out why widget is sometimes null (tests only?)
        var widget = getWidget($widget);
        if (widget) {
            var isFormRef = FORM_REF_REGEX.test(xpath);
            var isText = function () { return this.nodeType === 3; };
            var displayId = element.textContent.trim();
            var hashtag = widget.mug.form.normalizeHashtag(xpath);
            var title = util.escape(hashtag);
            var labelMug = widget.mug.form.getMugByPath(xpath);
            var description = labelMug && labelMug.p.labelItext ?
                labelMug.p.labelItext.get() : "";
            var isDate = labelMug && labelMug.__className.indexOf("Date") === 0;
            var dateFormatID = util.get_guid();
            var getTitle = function () {
                var title_ = title,
                    format = $element.attr("data-date-format");
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
            description = xml.normalize(description);

            $element.popover({
                trigger: 'hover',
                container: 'body',
                placement: 'bottom',
                title: getTitle(), // only needs to be called once
                html: true,
                sanitize: false, // bootstrap, don't remove data-ufid attribute
                content: easy_reference_popover({
                    text: description,
                    ufid: labelMug ? labelMug.ufid : "",
                }),
                template: '<div contenteditable="false" class="popover rich-text-popover">' +
                    '<div class="popover-inner">' +
                    '<div class="popover-title"></div>' +
                    (labelMug || description ?
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
                if (isDate || $widget.attr("data-date-format")) {
                    var pos = $(this).offset(),
                        x = pos.left,
                        y = pos.top + $(this).height();
                    $("#" + dateFormatID).click(function () {
                        $element.popover('hide');
                        dateformats.showMenu(x, y, function (format) {
                            $widget.attr("data-date-format", format);
                            // editor.fire("saveSnapshot");
                            // todo: save snapshot
                        }, true);
                        return false;
                    });
                }
            });

            element.classList.add('popover-initialized');

            $element.on('destroy', function (e)  {
                try {
                    $element.popover('destroy');
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
        unescapeHashtags: unescapeHashtags,
    };
});
