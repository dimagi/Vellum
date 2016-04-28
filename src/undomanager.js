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
        var alert = $('.fd-undo-delete');
        // creating alert uses classes "fade in", removing alert removes in
        // This sometimes gets triggered after in is removed but before the
        // alert is removed from the page
        if (!alert.hasClass('in')) {
            return false;
        }
        return alert.length;
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
        appendMug: function (mug, previousMug, position) {
            this.undoStack = this.undoStack.concat([[mug, previousMug, position]]);
            toggleAlert(this.undoStack);
            mug.form.vellum.data.windowManager.adjustToWindow();
        },
        undo: function () {
            _.each(this.undoStack, function(undo) {
                var mug = undo[0],
                    sibling = undo[1],
                    position = undo[2];
                mug.form.insertQuestion(mug, sibling, position, true);
            });
            this.resetUndo();
        },
    };

    return UndoManager;
});
