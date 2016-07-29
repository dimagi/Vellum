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
 *   <span data-value="xpath" data-output-value=boolean>
 *     <i class="icon">&nbsp;</i>
 *     text to display inside bubble
 *   </span>
 *
 * Any other HTML has undefined behavior
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
    'vellum/logic',
    'vellum/util',
    'vellum/xml',
    'ckeditor',
    'ckeditor-jquery'
], function(
    require,
    _,
    $,
    logic,
    util,
    xml,
    CKEDITOR
){
    var CASE_REF_REGEX = /^\`?#case\//,
        FORM_REF_REGEX = /^\`?#form\//,
        REF_REGEX = /^\`?#(form|case)\//,
        bubbleWidgetDefinition = {
        template:
            '<span class="label label-datanode label-datanode-internal">' +
              '<i class="fa fa-question-circle">&nbsp;</i>' +
              'example widget, not used' +
            '</span>',
        upcast: function ( element ) {
            return element.name === 'span' && element.hasClass('label-datanode');
        },
        downcast: function(element) {
            element.setHtml(applyFormats($(element.getOuterHtml()).data()));
            element.replaceWithChildren();
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
     *    normalizeEscapedHashtag - transforms to escaped hashtag form
     *    transform - transforms escaped hashtags
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
        var NOTSET = {},
            newval = NOTSET,  // HACK work around async get/set
            editor = input.ckeditor({
                contentsLangDirection: options.rtl ? 'rtl' : 'ltr',
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
                    return fromRichText(data);
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
            },
            insertExpression: function (xpath) {
                if (options.isExpression) {
                    editor.insertHtml(bubbleExpression(xpath, form) + ' ');
                } else {
                    var attrs = {'data-output-value': true},
                        output = makeBubble(form, xpath, attrs);
                    editor.insertHtml($('<p>').append(output).html() + ' ');
                }
            },
            insertOutput: function (xpath) {
                if (options.isExpression) {
                    throw new Error("cannot insert output into expression editor");
                }
                editor.insertHtml(bubbleOutputs(xpath, form) + ' ');
            },
            select: function (index) {
                ckSelect.call(null, editor, index);
            },
            on: function () {
                var args = Array.prototype.slice.call(arguments);
                editor.on.apply(editor, args);
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
            // highlight text
            var selection = editor.getSelection();
            if (selection.getRanges().length) {
                var range = editor.createRange();
                range.selectNodeContents( editor.editable() );
                selection.selectRanges( [ range ] );
            }
        });

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

    /**
     * Set selection in CKEditor
     */
    function ckSelect(editor, index) {
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
                        return {node: parent, length: 1};
                    }
                    throw new Error("not implemented: " + name);
                } else if (child.type === CKEDITOR.NODE_TEXT) {
                    return {node: child, length: child.getText().length};
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
                    return {node: node.node, offset: offset};
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
        range.setStart(node.node, node.offset);
        range.collapse(true);
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
            'outputValue': {
                serialize: function(currentValue) {
                    return _.template('&lt;output value="<%=xpath%>" /&gt;')({
                        xpath: currentValue
                    });
                },
            }
        },
        formatOrdering = ['dateFormat', 'outputValue'];

    /**
     * Takes in data attributes from a "bubble"
     *
     * Example
     *   serializing the rich text
     *     <span data-value='/data/value' data-output-value='true' ... />
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
            steps = parsed.getTopLevelPaths()[0].steps;
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
     * @param templateFn - function(xpath) returns what the bubble should be
     *                     transcribed to in XML
     *
     * @returns jquery object of the bubble
     */
    function makeBubble(form, xpath, extraAttrs) {
        function _parseXPath(xpath, form) {
            if (CASE_REF_REGEX.test(xpath)) {
                if (form.isValidHashtag(xpath)) {
                    return {
                        classes: ['label-datanode-external', 'fcc fcc-fd-case-property']
                    };
                } else if (form.hasValidHashtagPrefix(xpath)) {
                    return {
                        classes: ['label-datanode-external-unknown', 'fa fa-exclamation-triangle']
                    };
                }
            }

            var icon = form.getIconByPath(xpath);
            if (icon) {
                return {
                    classes: ['label-datanode-internal', icon],
                };
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
            .attr({'data-value': xpath})
            .attr(extraAttrs)
            .append(icon)
            .append(dispValue);
    }

    /**
     * @param value - a single xpath expression
     *
     * @returns - jquery object of xpath bubble
     */
    function replacePathWithBubble(form, value) {
        var info = extractXPathInfoFromOutputValue(value),
            xpath = form.normalizeEscapedHashtag(info.reference),
            extraAttrs = _.omit(info, 'reference');

        if (!REF_REGEX.test(xpath)) {
            return $('<span>').text(xml.normalize(value)).html();
        }

        return $('<div>').append(makeBubble(form, xpath, extraAttrs)).html();
    }

    /**
     * Replace <output> tags with bubble markup
     *
     * @param escape - If true, escape HTML except for bubble markup.
     */
    function bubbleOutputs(text, form, escape) {
        function transformToOldOuptut(output) {
            // this is to support vellum:value in extractXPathInfoFromOutputValue
            // as it uses regex for now
            var $output = $(output),
                attribute = $output.attr('vellum:value') || $output.attr('value');
            return $("<output>").attr('value', attribute)[0].outerHTML;
        }
        var el = $('<div>').html(text),
            places = {},
            replacer, result;
        if (escape) {
            replacer = function () {
                var id = util.get_guid();
                places[id] = replacePathWithBubble(form, transformToOldOuptut(this.outerHTML));
                return "{" + id + "}";
            };
        } else {
            replacer = function() {
                return replacePathWithBubble(form, transformToOldOuptut(this.outerHTML));
            };
        }
        el.find('output').replaceWith(replacer);
        result = el.html();
        if (escape) {
            result = $('<div />').text(xml.normalize(result)).html();
            result = result.replace(/{(.+?)}/g, function (match, id) {
                return places.hasOwnProperty(id) ?
                        $("<div>").append(places[id]).html() : match;
            });
        }
        return result;
    }

    /**
     * Wrap top-level expression nodes with bubble markup
     */
    function bubbleExpression(text, form) {
        text = xml.normalize(form.normalizeEscapedHashtag(text));
        return form.transform(text, _.partial(replacePathWithBubble, form));
    }

    function unwrapBubbles(text) {
        var el = $('<div>').html(text);
        el.find('.label-datanode').children().unwrap();
        return el.text();
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
                   .replace(/(&nbsp;|\xa0)/ig, " ")
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
    function fromRichText(html) {
        return unwrapBubbles(fromHtml(html));
    }

    function extractXPathInfoFromOutputValue(value) {
        // there's no differenc between ref and value, so just change them all
        // to value
        var outputValueRegex = /<output\s+(ref|value)="([^"]+)"/,
            dateFormatRegex = /format-date\(date\(([^)]+)\),\s*'([^']+)'\)/,
            dateMatch = dateFormatRegex.exec(value),
            outputValueMatch = outputValueRegex.exec(value);

        if (dateMatch) {
            return {
                'data-output-value': !!outputValueMatch,
                'data-date-format': dateMatch[2],
                reference: dateMatch[1],
            };
        } else if (outputValueMatch){
            return {
                'data-output-value': true,
                reference: outputValueMatch[2],
            };
        }

        return {
            'data-output-value': false,
            reference: value,
        };
    }

    function initEditor(input, form, options) {
        if (options && form.vellum && !form.vellum.opts().features.disable_popovers) {
            options = _.extend(options, {
                createPopover: function( editor, ckwidget ) {
                    var $this = $(ckwidget.element.$),
                        dragContainer = ckwidget.dragHandlerContainer;
                    // Setup popover
                    var datavalue = $this.attr('data-value'),
                        // WARNING does the wrong thing for value like "/data/q + 3"
                        xpath = extractXPathInfoFromOutputValue(datavalue).reference,
                        getWidget = require('vellum/widgets').util.getWidget,
                        // TODO find out why widget is sometimes null (tests only?)
                        widget = getWidget($this);
                    if (widget) {
                        var isFormRef = FORM_REF_REGEX.test(xpath),
                            isText = function () { return this.nodeType === 3; },
                            displayId = $this.contents().filter(isText)[0].nodeValue,
                            labelMug = widget.mug.form.getMugByPath(xpath),
                            labelText = labelMug && labelMug.p.labelItext ?
                                        labelMug.p.labelItext.get() : "",
                            $dragContainer = $(dragContainer.$),
                            $imgs = $dragContainer.children("img");
                        labelText = $('<div>').append(labelText);
                        labelText.find('output').replaceWith(function () {
                            return widget.mug.form.normalizeHashtag(extractXPathInfoFromOutputValue($(this).attr('value')).reference);
                        });

                        // Remove ckeditor-supplied title attributes, which will otherwise override popover title
                        $imgs.removeAttr("title");

                        $imgs.popover({
                            trigger: 'hover',
                            container: 'body',
                            placement: 'bottom',
                            title: '<h3>' + util.escape(displayId) + '</h3>' +
                                   '<div class="text-muted">' + util.escape(widget.mug.form.normalizeHashtag(xpath)) + '</div>',
                            html: true,
                            content: '<p>' + labelText.text() + '</p>',
                            template: '<div contenteditable="false" class="popover rich-text-popover">' +
                                '<div class="popover-inner">' +
                                '<div class="popover-title"></div>' +
                                (isFormRef ? '<div class="popover-content"><p></p></div>' : '') +
                                '</div></div>'
                        });

                        ckwidget.on('destroy', function (e)  {
                            try {
                                $imgs.popover('destroy');
                            } catch(err) {
                                // sometimes these are already destroyed
                            }
                        });
                    }
                },
            });
        }
        return editor(input, form, options);
    }

    return {
        REF_REGEX: REF_REGEX,
        applyFormats: applyFormats,
        bubbleOutputs: bubbleOutputs,
        editor: initEditor,
        fromRichText: fromRichText,
        toRichText: toRichText,
    };
});
