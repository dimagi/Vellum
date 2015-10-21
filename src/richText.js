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
    'underscore',
    'jquery',
    'vellum/logic',
    'xpathmodels',
    'ckeditor'
], function(
    _,
    $,
    logic,
    xpathmodels,
    CKEDITOR
){
    CKEDITOR.plugins.add('bubbles', {
        requires: 'widget',
        init: function (editor) {
            editor.widgets.add('bubbles', {
                template:
                    '<span class="label label-datanode label-datanode-internal">' +
                      '<i class="icon-question-sign">&nbsp;</i>' +
                      'test widget' +
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
                }
            });
        }
    });

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
     * @param withClose - boolean include the close button
     *
     * @param templateFn - function(xpath) returns what the bubble should be
     *                     transcribed to in XML
     *
     * @returns jquery object of the bubble
     */
    function makeBubble(form, xpath, withClose, extraAttrs) {
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
            icon = $('<i>').addClass(iconClasses).html('&nbsp;'),
            bubble = $('<span>').addClass('label label-datanode ' + bubbleClasses)
                .attr({
                    'data-value': xpath,
                }).attr(extraAttrs).append(icon).append(dispValue);

        if (withClose) {
            bubble.append($("<button>").addClass('close').html("&times;"));
        }

        return bubble;
    }

    /**
     * @param value - a single xpath expression
     *
     * @returns - jquery object of xpath bubble
     */
    function replacePathWithBubble(form, value, withClose) {
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

        return makeBubble(form, xpath, withClose, extraAttrs);
    }

    /**
     * Replace <output> tags with bubble markup
     *
     * @param withClose - Create bubbles with close buttons if true.
     */
    function bubbleOutputs(text, form, withClose) {
        var el = $('<div>').html(text);
        el.find('output').replaceWith(function() {
            return replacePathWithBubble(form, this.outerHTML, withClose);
        });
        return el.html();
    }

    /**
     * Wrap top-level expression nodes with bubble markup
     *
     * @param withClose - Create bubbles with close buttons if true.
     */
    function bubbleExpression(text, form, withClose) {
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
            var newPath = replacePathWithBubble(form, path, withClose);
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
     * Convert CKEditor HTML to plain text
     *
     * Replace <p> tags with newlines.
     */
    function fromHtml(html) {
        return html.replace(/<p>/ig,"")
                   .replace(/<\/p>/ig, "\n")
                   // maybe not necessary? ckeditor uses p tags for newlines
                   .replace(/<br ?\/?>/ig,"\n");
    }

    /**
     * Takes a value from xml and replaces xpaths with bubbles to display in the
     * editor
     *
     * This does not add any <p> or <br> tags, only newlines as used in xml
     *
     * @param options - An object containing options for the conversion:
     *      - withClose - Create bubbles with close buttons if true.
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
        return bubble(text, form, options.withClose);
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
        fromRichText: fromRichText,
        toRichText: toRichText,
    };
});
