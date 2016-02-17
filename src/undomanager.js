define([
    'jquery',
    'underscore',
    'tpl!vellum/templates/undo_alert',
], function(
    $,
    _,
    UNDO_ALERT
) {
    var undoStack = [],
        alertShown = false;

    function createAlert() {
        alertShown = true;
        $('.fd-scrollable-tree').prepend(UNDO_ALERT).bind('closed.bs.alert', function() {
            alertShown = false;
        }).bind('close.bs.alert', function() {
            alertShown = false;
        });
    }

    function toggleAlert() {
        if (undoStack.length && !alertShown) {
            createAlert();
        } else if (undoStack.length === 0 && alertShown) {
            $('.fd-undo-delete').alert('close');
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

    $.vellum.plugin("undomanager", {},
        {
            init: function () {
                this.data.core.undomananger = { undoStack: [] };
            }
        }
    );

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
