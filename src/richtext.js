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
    };
});
