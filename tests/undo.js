/*jshint multistr: true */
import chai from "chai";
import undo from "vellum/undo";

const assert = chai.assert;

describe("The UndoStack", function () {

    it("undo should return null if nothing is on the undo stack", function () {
        const undoStack = new undo.UndoStack();
        undoStack.undo(value => {
            assert.isNull(value);
        });
    });

    it("undo should return null if only one item is on the undo stack", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test', false);
        undoStack.undo(value => {
            assert.isNull(value);
        });
    });

    it("Trying to undo the first item should not take it off the stack", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test', false);
        undoStack.undo(value => {
            assert.isNull(value);
        });
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test');
        });
    });

    it("undo should return the previous item if at least two items are on the undo stack", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1', false);
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test1');
        });
    });

    it("redo should return null if nothing has been pushed", function () {
        const undoStack = new undo.UndoStack();
        undoStack.redo(value => {
            assert.isNull(value);
        });
    });

    it("redo should return null if nothing has been undone", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1', false);
        undoStack.push('test2', false);
        undoStack.redo(value => {
            assert.isNull(value);
        });
    });

    it("redo after undo should return the last pushed item", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1', false);
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test1');
        });
        undoStack.redo(value => {
            assert.equal(value, 'test2');
        });
    });

    it("undo after redo should return same item as first undo", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1', false);
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test1');
        });
        undoStack.redo(value => {
            assert.equal(value, 'test2');
        });
        undoStack.undo(value => {
            assert.equal(value, 'test1');
        });
    });


    it("push after undo empties redo stack", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1', false);
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test1');
        });
        undoStack.push('test1', false);
        undoStack.redo(value => {
            assert.isNull(value);
        });
    });

    it("cannot push during undo", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1', false);
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test1');
            assert.isFalse(undoStack.push('test3'));
        });
        undoStack.undo(value => {
            assert.isNull(value);
        });
    });

    it("pushing twice in fast succession only keeps the last one", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1a', true);
        undoStack.push('test1b', true);
        undoStack.push('test2', false);
        undoStack.undo(value => {
            assert.equal(value, 'test1b');
        });
        undoStack.undo(value => {
            assert.isNull(value);
        });
    });

    it("pushing twice with pause keeps both items", function () {
        const undoStack = new undo.UndoStack();
        undoStack.push('test1a', true);
        setTimeout(() => {
            undoStack.push('test1b', true);
            undoStack.push('test2', false);
            undoStack.undo(value => {
                assert.equal(value, 'test1b');
            });
            undoStack.undo(value => {
                assert.equal(value, 'test1a');
            });
        }, 550);
    });
});
