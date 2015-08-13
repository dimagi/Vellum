define([
    'underscore',
    'jquery',
    'vellum/logic'
], function(
    _,
    $,
    logic
){
    var formats = {
            'outputValue': {
                serialize: function(currentValue) {
                    return _.template('<output value="<%=xpath%>" />', {
                        xpath: currentValue
                    });
                },
            }
        },
        formatOrdering = ['date-format', 'outputValue'];

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
    function getBubblesDisplayValue(path) {
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

        var bubbleClasses = _parseXPath(xpath, form),
            mug = bubbleClasses.mug,
            dispValue = getBubblesDisplayValue(xpath),
            icon = $('<i>').addClass(bubbleClasses.classes[1]).html('&nbsp;'),
            bubble = $('<span>').addClass('label label-datanode ' + bubbleClasses.classes[0])
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

    function replaceOuputRef(form, value, withClose, noOutput) {
        function checkDate(xpath) {
            var regex = /format-date\(date\((.+)\), '(.+)'\)/,
                match = regex.exec(xpath);
            if (match) {
                var question = match[1],
                    dateFormat = match[2];
                return makeBubble(form, question, withClose, {
                                      'data-date-format': dateFormat,
                                      'data-output-value': true
                                  });
            }
            return false;
        }

        // only support absolute path right now
        if (!form.getMugByPath(value) && !/instance\(/.test(value)) {
            var date = checkDate(value);
            if (date) {
                return date;
            }
            return value;
        }

        return makeBubble(form, value, withClose, {'data-output-value': !noOutput});
    }

    function toRichText(val, form, withClose) {
        if (!val) {return "";}
        val = val.replace('&lt;', '<').replace('&gt;', '>').replace('&nbsp;', ' ');
        var el = $('<div>').html(val);
        el.find('output').replaceWith(function() {
            return replaceOuputRef(form, this.attributes.value.value, withClose);
        });
        var l = new logic.LogicExpression(val),
            paths = _.chain(l.getTopLevelPaths())
                     .map(function(path) { return path.toXPath(); })
                     .filter(function(path) {
                         return !/^instance\('commcaresession'\)/.test(path);
                     }).value();

        _.each(paths, function(path) {
            var newPath = replaceOuputRef(form, path, withClose, true);
            el.html(el.html().replace(new RegExp(RegExp.escape(path).replace(/ /g, '\\s*')),
                                      $('<div>').append(newPath).html()));
        });
        return el.html();
    }

    function fromRichText(val) {
        var el = $('<div>');
        val = val.replace(/(<p>)/ig,"").replace(/<\/p>/ig, "\n").replace(/(<br ?\/?>)/ig,"\n").replace('&nbsp;', ' ');
        el = el.html(val);
        el.find('.atwho-inserted .label').unwrap();
        el.find('.label-datanode').replaceWith(function() {
            return applyFormats($(this).data());
        });

        return el.html().replace('&lt;', '<', 'g').replace('&gt;', '>', 'g').replace('&nbsp;', ' ', 'g');
    }

    return {
        fromRichText: fromRichText,
        toRichText: toRichText,
    };
});
