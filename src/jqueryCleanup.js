define([
    'jquery',
], function (
    $
) {
    const _cleanData = $.cleanData;
    // add a hook to `cleanData` to allow elements to provide
    // their own teardown functionality whenever functions like
    // 'remove', 'empty', or 'html' are called.
    // add a 'remove' handler to child elements in order to
    // specify cleanup
    $.cleanData = function (elems) {
        for (const elem of elems) {
            try {
                $(elem).triggerHandler('remove');
            } catch (e) {
                window.console.error("Error in 'remove' handler for element:", elem, e);
            }
        }
        _cleanData(elems);
    };
});
