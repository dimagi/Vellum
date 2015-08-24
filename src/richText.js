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
 *   <span contenteditable="false" draggable="true" 
 *         data-value="xpath" data-output-value=boolean>
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
    'vellum/logic'
], function(
    _,
    $,
    logic
){
    /*
     * formats specifies the serialization for different formats that can be
     * applied to bubbles.
     *
     * This uses underscore templates and returns
     * [templated_text, template values]
     *
     * serialize handles rich text -> xml and returns
     * deserialize handles xml -> rich text
     *
     * Example
     *   <span data-value='/data/value' data-output-value='true' />
     *   is equivalent to
     *   <output value='/data/value' />
     *
     *   deserialize would return
     *       ["<%=outputValue0%>",
     *        {outputValue0: {data-output-value: true, xpath: '/data/value'}}]
     *   serialize would return "<output value="/data/value" />
     *
     * Notes:
     *   uses outputValue as that's what $el.data() transforms data-output-value
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
                    return _.template('<output value="<%=xpath%>" />', {
                        xpath: currentValue
                    });
                },
            }
        },
        formatOrdering = ['dateFormat', 'outputValue'];

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
                        mug: mug
                    };
                }
            }

            return {classes: ['label-datanode-external', 'fcc fcc-help']};
        }

        var xpathInfo = _parseXPath(xpath, form),
            mug = xpathInfo.mug,
            bubbleClasses = xpathInfo.classes[0],
            iconClasses = xpathInfo.classes[1],
            dispValue = getBubbleDisplayValue(xpath),
            icon = $('<i>').addClass(iconClasses).html('&nbsp;'),
            bubble = $('<span>').addClass('label label-datanode ' + bubbleClasses)
                .attr({
                    contenteditable: false,
                    draggable: true,
                    'data-value': xpath,
                }).attr(extraAttrs).append(icon).append(dispValue);

        if (mug && mug.p && mug.p.labelItext) {
            var labelItext = mug.p.labelItext;
            bubble.attr('title', labelItext.forms[0].data[labelItext.itextModel.defaultLanguage]);
        }

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
     * Takes a value from xml and replaces xpaths with bubbles to display in the
     * editor
     *
     * This does not add any <p> or <br> tags, only newlines as used in xml
     *
     * @returns - html string to be displayed in editor
     */
    function toRichText(val, form, withClose) {
        if (!val) {return "";}
        val = val.replace('&lt;', '<').replace('&gt;', '>').replace('&nbsp;', ' ');
        var el = $('<div>').html(val);
        el.find('output').replaceWith(function() {
            return replacePathWithBubble(form, this.outerHTML, withClose);
        });
        var l = new logic.LogicExpression(val),
            // Uses top level paths, because filters should not be made to bubbles
            paths = _.chain(l.getTopLevelPaths())
                     .filter(function(path) {
                         var context = path.initial_context,
                             numFilters = _.reduce(path.steps, function(memo, step) {
                                return memo + step.predicates.length;
                             }, 0);

                         if (context === 'expr' && numFilters > 1 ||
                             context === 'abs' && numFilters > 0) {
                             return false;
                         }

                         return true;
                     })
                     .map(function(path) { return path.toXPath(); })
                     .uniq().value();

        _.each(paths, function(path) {
            var newPath = replacePathWithBubble(form, path, withClose);
            el.html(el.html().replace(new RegExp(RegExp.escape(path).replace(/ /g, '\\s*'), 'mg'),
                                      $('<div>').append(newPath).html()));
        });
        return el.html();
    }

    /**
     * Deconstructs html strings that have bubbles in them
     * This should preserve whitespace as it appears in the editor
     *
     * Dependent on CKEditor, which uses p, br and &nbsp; to format content
     *
     * Expects the html to only be at most two levels deep (considering a
     * bubble span as one level):
     *   <p>
     *     <br />
     *     <span /> (info)
     *   </p>
     *
     * @param val - HTML string that may or may not have bubble
     *
     * @returns - string with bubbles deconstructed into plain text
     */
    function fromRichText(val) {
        var el = $('<div>');

        val = val.replace(/<p>/ig,"")
                 .replace(/<\/p>/ig, "\n")
                 .replace(/(<br ?\/?>)/ig,"\n")
                 .replace(/&nbsp;/ig, ' ');

        el = el.html(val);
        el.find('.label-datanode').replaceWith(function() {
            return applyFormats($(this).data());
        });

        return el.html().replace(/&lt;/ig, '<')
                        .replace(/&gt;/ig, '>')
                        .replace(/&nbsp;/ig, ' ');
    }

    return {
        fromRichText: fromRichText,
        toRichText: toRichText,
    };
});
