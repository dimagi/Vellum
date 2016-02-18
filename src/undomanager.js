define([
    'jquery',
    'underscore',
    'tpl!vellum/templates/undo_alert',
], function(
    $,
    _,
    UNDO_ALERT
) {
    function alertShown() {
        return $('.fd-undo-delete').length;
    }

    function createAlert() {
        $('.fd-undo-container').append(UNDO_ALERT);
    }

    function toggleAlert(undoStack) {
        if (undoStack.length && !alertShown()) {
            createAlert();
        } else if (undoStack.length === 0 && alertShown()) {
            $('.fd-undo-delete').alert('close');
        }
    }

    function UndoManager() {
        this.undoStack = [];
    }

    UndoManager.prototype = {
        resetUndo: function (mug, previousMug, position) {
            if (mug) {
                this.undoStack = [[mug, previousMug, position]];
            } else {
                this.undoStack = [];
            }
            toggleAlert(this.undoStack);
        },
        prependMug: function (mug, previousMug, position) {
            this.undoStack = [[mug, previousMug, position]].concat(this.undoStack);
            toggleAlert(this.undoStack);
        },
        appendMug: function (mug, previousMug, position) {
            this.undoStack = this.undoStack.concat([[mug, previousMug, position]]);
            toggleAlert(this.undoStack);
        },
        undo: function () {
            _.each(this.undoStack, function(undo) {
                var mug = undo[0],
                    sibling = undo[1],
                    position = undo[2];
                mug.form.insertQuestion(mug, sibling, position);
            });
            this.resetUndo();
        },
    };

    return UndoManager;
});
