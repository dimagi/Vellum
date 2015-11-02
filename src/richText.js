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
 *     <i class="close">&times;</i>
 *   </span>
 *
 * Any other HTML has undefined behavior
 */
define([
    'require',
    'underscore',
    'jquery',
    'vellum/logic',
    'vellum/util',
    'vellum/xml',
    'xpathmodels',
    'ckeditor',
    'ckeditor-jquery'
], function(
    require,
    _,
    $,
    logic,
    util,
    xml,
    xpathmodels,
    CKEDITOR
){
    var bubbleWidgetDefinition = {
        template:
            '<span class="label label-datanode label-datanode-internal">' +
              '<i class="icon-question-sign">&nbsp;</i>' +
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
            // Leave 15px on the left side so that users can actually
            // interact with the close button
            var width = $(this.element.$).innerWidth() - 15;
            var height = $(this.element.$).outerHeight() + 4;
            this.dragHandlerContainer.setStyles({
                width: width + 'px',
                height: height + 'px',
                left: '0px'
            });

            // Add close button
            var that = this,
                buttons = this.element.getElementsByTag("button"),
                button;
            if (buttons.count()) {
                // sometimes the it's in the dom
                // apparently init can be called more than once for a widget!?
                button = buttons.getItem(0);
            } else {
                button = CKEDITOR.dom.element.createFromHtml(
                            "<button class='close'>&times;</button>");
                this.element.append(button);
            }
            button.on("click", function () {
                that.editor.widgets.del(that);
                that.editor.fire('saveSnapshot');
                return false;
            });

            // Setup popover
            var $this = $(this.element.$),
                datavalue = $this.attr('data-value'),
                // WARNING does the wrong thing for value like "/data/q + 3"
                match =  datavalue.match('output value="(.*)"'),
                xpath = match ? match[1] : datavalue,
                getWidget = require('vellum/widgets').util.getWidget,
                // TODO find out why widget is sometimes null (tests only?)
                widget = getWidget($this);
            if (/^\/data\//.test(xpath) && widget) {
                var isText = function () { return this.nodeType === 3; },
                    displayId = $this.contents().filter(isText)[0].nodeValue,
                    labelMug = widget.mug.form.getMugByPath(xpath),
                    labelText = labelMug ? labelMug.p.labelItext.get() : "";
                $(this.dragHandlerContainer.$).children("img").stickyover({
                    title: displayId + '<small>' + xpath + '</small>',
                    html: true,
                    content: '<p>' + labelText + '</p>',
                    template: '<div contenteditable="false" class="popover fd-popover">' +
                        '<div class="popover-inner">' +
                        '<h3 class="popover-title"></h3>' +
                        '<div class="popover-content"><p></p></div>' +
                        '</div></div>'
                });
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
     * @param form - form object; used for creating bubbles.
     * @param options - rich text bubble options.
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
        var NOTSET = {},
            newval = NOTSET,  // HACK work around async get/set
            editor = input.ckeditor().editor;
        options = options || {};
        wrapper = {
            editor: editor,
            getValue: function (callback) {
                if (callback) {
                    input.promise.then(function() {
                        callback(fromRichText(editor.getData()));
                    });
                } else if (newval !== NOTSET) {
                    return newval;
                } else {
                    return fromRichText(editor.getData());
                }
            },
            setValue: function (value, callback) {
                newval = value;
                value = toRichText(value, form, options);
                editor.setData(value, function () {
                    newval = NOTSET;
                    if (callback) { callback(); }
                });
            },
            insertExpression: function (value) {
                if (options.isExpression) {
                    editor.insertHtml(bubbleExpression(value, form) + ' ');
                } else {
                    var attrs = {'data-output-value': true},
                        output = makeBubble(form, value, attrs);
                    editor.insertHtml($('<p>').append(output).html() + ' ');
                }
            },
            insertOutput: function (value) {
                if (options.isExpression) {
                    throw new Error("cannot insert output into expression editor");
                }
                editor.insertHtml(bubbleOutputs(value, form) + ' ');
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
        input.data("ckwrapper", wrapper);
        return wrapper;
    };

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
                    return _.template("format-date(date(<%=xpath%>), '<%=dateFormat%>')", {
                        xpath: currentValue,
                        dateFormat: dataAttrs.dateFormat
                    });
                },
            },
            'outputValue': {
                serialize: function(currentValue) {
                    return _.template('&lt;output value="<%=xpath%>" /&gt;', {
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
    function getBubbleDisplayValue(path) {
        var steps = new logic.LogicExpression(path).getTopLevelPaths()[0].steps,
            dispValue = steps[steps.length-1].name;
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
            if (/instance\('casedb'\)/.test(xpath)) {
                return {
                    classes: ['label-datanode-external', 'fcc fcc-fd-external-case']
                };
            }

            if (form) {
                var mug = form.getMugByPath(xpath);
                if (mug) {
                    return {
                        classes: ['label-datanode-internal', mug.options.icon],
                    };
                }
            }

            return {classes: ['label-datanode-external', 'fcc fcc-help']};
        }

        var xpathInfo = _parseXPath(xpath, form),
            bubbleClasses = xpathInfo.classes[0],
            iconClasses = xpathInfo.classes[1],
            dispValue = getBubbleDisplayValue(xpath),
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
        var xpath = value,
            outputValueRegex = /<output\s+value="([^"]+)"/,
            dateFormatRegex = /<output\s+value="format-date\(date\(([^)]+)\),\s*'([^']+)'\)"/,
            match = dateFormatRegex.exec(value),
            extraAttrs = {
                'data-output-value': false,
            };

        if (match) {
            extraAttrs = {
                'data-output-value': true,
                'data-date-format': match[2],
            };
            xpath = match[1];
        } else {
            match = outputValueRegex.exec(value);
            if (match) {
                extraAttrs = { 'data-output-value': true };
                xpath = match[1];
            }
        }

        // only support absolute path right now
        if (!form.getMugByPath(xpath) && !/instance\('casedb'\)/.test(xpath)) {
            return value.replace('<', '&lt;').replace('>', '&gt;');
        }

        return makeBubble(form, xpath, extraAttrs);
    }

    /**
     * Replace <output> tags with bubble markup
     *
     * @param escape - If true, escape HTML except for bubble markup.
     */
    function bubbleOutputs(text, form, escape) {
        var el = $('<div>').html(text),
            places = {},
            replacer, result;
        if (escape) {
            replacer = function () {
                var id = util.get_guid();
                places[id] = replacePathWithBubble(form, this.outerHTML);
                return "{" + id + "}";
            };
        } else {
            replacer = function() {
                return replacePathWithBubble(form, this.outerHTML);
            };
        }
        el.find('output').replaceWith(replacer);
        result = el.html();
        if (escape) {
            result = $('<div />').text(xml.normalize(result)).html();
            result = result.replace(/{(.+?)}/g, function (match, id) {
                return places.hasOwnProperty(id) ? places[id][0].outerHTML : match;
            });
        }
        return result;
    }

    /**
     * Wrap top-level expression nodes with bubble markup
     */
    function bubbleExpression(text, form) {
        var el = $('<div>').html(text);
        var EXPR = xpathmodels.XPathInitialContextEnum.EXPR,
            ROOT = xpathmodels.XPathInitialContextEnum.ROOT,
            expr = new logic.LogicExpression(text),
            // Uses top level paths, because filters should not be made to bubbles
            paths = _.chain(expr.getTopLevelPaths())
                .filter(function(path) {
                    var context = path.initial_context,
                        numFilters = _.reduce(path.steps, function(memo, step) {
                           return memo + step.predicates.length;
                        }, 0),
                        hasSession = /commcaresession/.test(path.toXPath());

                    if (context === EXPR && (numFilters > 1 || !hasSession) ||
                        context === ROOT && numFilters > 0) {
                        return false;
                    }

                    return true;
                })
                .map(function(path) { return path.toXPath(); })
                .uniq().value();

        _.each(paths, function(path) {
            var newPath = replacePathWithBubble(form, path);
            el.html(el.html().replace(
                new RegExp(RegExp.escape(path).replace(/ /g, '\\s*'), 'mg'),
                $('<div>').append(newPath).html()
            ));
        });
        return el.html();
    }

    function unwrapBubbles(text) {
        var el = $('<div>').html(text);
        el.find('.label-datanode').children().unwrap();
        return el.text();
    }

    /**
     * Convert plain text to HTML to be edited in CKEditor
     *
     * Replace line breaks with <p> tags and &nbsp; with spaces.
     */
    function toHtml(text) {
        text = text.replace(/\n/g, "</p><p>");
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
                   // fixup final </p>, which is is not a newline
                   .replace(/\n$/, "")
                   // maybe not necessary? ckeditor uses p tags for newlines
                   .replace(/<br ?\/?>/ig,"\n");
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
        // HACK this is vulnerable to HTML injection. will need to change
        text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
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

    return {
        bubbleOutputs: bubbleOutputs,
        editor: editor,
        fromRichText: fromRichText,
        toRichText: toRichText,
    };
});
