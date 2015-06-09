define([
    'jquery',
    'underscore'
], function(
    $,
    _
) {
    var reference = function (mug, options) {
        var ref = {}, icon;

        ref.icon = mug.options.icon;
        ref.path = mug.absolutePath;
        ref.value = options.value;
        ref.type = mug.options.typeName;

        icon = $('<i>').addClass(ref.icon);

        var span = $('<span>')
            .attr('contenteditable', false)
            .attr('data-mug-type', ref.type)
            .addClass('label label-success')
            .append(icon)
            .append(" " + ref.path + " ")
            .append($("<button class='close'>").html("&times;"));

        return $('<div>').append(span).html();
    };

    return {
        reference: reference,
    };
});
