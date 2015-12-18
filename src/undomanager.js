define([
    'jquery',
    'underscore',
], function(
    $,
    _
) {
    var undoStack = [],
        alertShown = false;

    function toggleAlert() {
        if (undoStack.length && !alertShown) {
            $('.fd-undo-delete').show();
            alertShown = true;
        } else if (undoStack.length === 0 && alertShown) {
            $('.fd-undo-delete').hide();
            alertShown = false;
        }
    }

    function resetUndo(mug, previousMug, position) {
        if (mug) {
            undoStack = [[mug, previousMug, position]];
        } else {
            undoStack = [];
        }
        toggleAlert();
    }

    return {
        resetUndo: resetUndo,
        prependMug: function (mug, previousMug, position) {
            undoStack = [[mug, previousMug, position]].concat(undoStack);
            toggleAlert();
        },
        appendMug: function (mug, previousMug, position) {
            undoStack = undoStack.concat([[mug, previousMug, position]]);
            toggleAlert();
        },
        undo: function () {
            _.each(undoStack, function(undo) {
                var mug = undo[0],
                    sibling = undo[1],
                    position = undo[2];
                mug.form.insertQuestion(mug, sibling, position);
            });
            resetUndo();
        },
    };
});
