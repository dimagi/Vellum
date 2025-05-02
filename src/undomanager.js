define([
    'jquery',
    'underscore',
    'vellum/util',
    'tpl!vellum/templates/undo_alert',
], function (
    $,
    _,
    util,
    undo_alert,
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

    function createAlert(mugs) {
        var refs = _.filter(_.map(mugs, function (mug) {
            return mug.isReferencedByOtherMugs(mugs) ? mug.p.nodeID : "";
        }), _.identity);
        $('.fd-undo-container').append(undo_alert({
            errors: refs,
            format: util.format,
        }));
    }

    function toggleAlert(undoStack) {
        if (undoStack.length && !alertShown()) {
            createAlert(_.map(undoStack, function (x) { return x[0]; }));
        } else if (undoStack.length === 0 && alertShown()) {
            $('.fd-undo-delete').remove();
        }
    }

    function UndoManager() {
        var _this = this;
        _this.undoStack = [];

        util.eventuality(this);
    }

    UndoManager.prototype = {
        resetUndo: function (mug, previousMug, position) {
            if (mug) {
                this.undoStack = [[mug, previousMug, position]];
            } else {
                this.undoStack = [];
            }
            toggleAlert(this.undoStack);
            this.fire({
                type: 'reset',
            });
        },
        setUndo: function (stack) {
            this.undoStack = this.undoStack.concat(stack);
            toggleAlert(this.undoStack);
        },
        undo: function () {
            _.each(this.undoStack, function (undo) {
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
