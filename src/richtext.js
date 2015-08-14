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
                deserialize: function(string) {
                    var el = $('<div>').html(string), 
                        outputs = {}, currentLength = -1;
                    el.find('output').replaceWith(function() {
                        currentLength++;
                        outputs['outputValue' + currentLength] = {
                            xpath: this.attributes.value.value,
                            'data-output-value': true
                        };
                        return "<%=outputValue" + currentLength + "%>";
                    });
                    return [el.text(), outputs];
                },
                serialize: function(currentValue) {
                    return _.template('<output value="<%=xpath%>" />', {
                        xpath: currentValue
                    });
                },
            }
        },
        formatOrdering = ['outputValue'];

    function applyFormats(dataAttrs) {
        var currentValue = dataAttrs.value;
        _.each(formatOrdering, function(format) {
            if (dataAttrs[format]) {
                currentValue = formats[format].serialize(currentValue, dataAttrs);
            }
        });
        return currentValue;
    }

    function deserializeString(string, form) {
        var currentValue = string, templateArgs = {};
        _.each(formatOrdering, function(format) {
            var ret = formats[format].deserialize(currentValue);
            currentValue = ret[0];
            _.extend(templateArgs, _.object(_.map(ret[1], function(v, k) {
                return [k, v];
            })));
        });

        templateArgs = _.object(_.map(templateArgs, function(value, key) {
            return [key, $('<div>').html(makeBubble(form, value.xpath, false, _.omit(value, 'xpath'))).html()];
        }));
        return _.template(currentValue, templateArgs);
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

    function replaceOuputRef(form, value, withClose) {
        // only support absolute path right now
        if (!form.getMugByPath(value) && !/instance\(/.test(value)) {
            return value;
        }

        return makeBubble(form, value, withClose, {'data-output-value': false});
    }

    function toRichText(val, form, withClose) {
        if (!val) {return "";}
        val = val.replace('&lt;', '<').replace('&gt;', '>').replace('&nbsp;', ' ');
        val = deserializeString(val, form);
        var el = $('<div>').html(val);
        var l = new logic.LogicExpression(val),
            paths = _.chain(l.getTopLevelPaths())
                     .map(function(path) { return path.toXPath(); })
                     .filter(function(path) {
                         return !/^instance\('commcaresession'\)/.test(path);
                     }).value();

        _.each(paths, function(path) {
            var newPath = replaceOuputRef(form, path, withClose);
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
