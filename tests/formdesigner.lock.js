/*jshint multistr: true */
import chai from "chai";
import util from "tests/utils";
import $ from "jquery";
import TEST_XML from "tests/static/lock/test.xml";

// NOTE: timer mocking here doesn't actually work, it only handles timeouts,
// doesn't actually implement sleep-like functionality.
// Need to change things under test to be async if you need to ensure they've
// finished before testing something (or make things under test not use
// setTimeout/Interval.  Use callbacks or https://github.com/cujojs/when.

var assert = chai.assert,
    clickQuestion = util.clickQuestion,
    call = util.call,
    getInput = util.getInput;

function beforeFn(done) {
    util.init({
        javaRosa: {langs: ['en']},
        core: {
            onReady: function () {
                call('loadXFormOrError', TEST_XML, done);
            }
        }
    });
}

describe("The Lock plugin", function() {
    before(beforeFn);

    function locked(mugPath, property) {
        return call('isPropertyLocked', mugPath, property);
    }
    function moveable(mugPath) {
        return call('isMugPathMoveable', mugPath);
    }
    function deleteable(mugPath) {
        return call('isMugRemoveable', call('getMugByPath', mugPath), mugPath);
    }
    function changeable(mugPath) {
        return call('isMugTypeChangeable', call('getMugByPath', mugPath), mugPath);
    }

    it("preserves XML with vellum:lock attributes", function () {
        util.assertXmlEqual(TEST_XML, call('createXML'));
    });

    it("disallows renaming a locked node", function () {
        assert(locked('#form/node_locked', 'nodeID'));
        assert(locked('#form/value_locked', 'nodeID'));
        assert.isFalse(locked('#form/none_locked', 'nodeID'));
        assert.isFalse(locked('#form/normal', 'nodeID'));
    });

    it("disallows moving a locked node to a different parent", function () {
        assert.isFalse(moveable('#form/node_locked'));
        assert.isFalse(moveable('#form/value_locked'));
        assert(moveable('#form/none_locked'));
        assert(moveable('#form/normal'));
    });

    it("disallows deleting a locked node", function () {
        assert.isFalse(deleteable('#form/node_locked'));
        assert.isFalse(deleteable('#form/value_locked'));
        assert(deleteable('#form/none_locked'));
        assert(deleteable('#form/normal'));
    });

    it("disallows changing the type only of a 'value' locked node", function () {
        assert.isFalse(changeable('#form/value_locked'));
        assert(changeable('#form/node_locked'));
        assert(changeable('#form/none_locked'));
        assert(changeable('#form/normal'));
    });

    it("allows changing only the Itext IDs of a 'value' locked node", function () {
        assert.isFalse(locked('#form/value_locked', 'constraintMsgItext'));
        assert(locked('#form/value_locked', 'constraintAttr'));
    });

    it("allows changing any property of a non-locked node", function () {
        assert.isFalse(locked('#form/node_locked'));
        assert.isFalse(locked('#form/none_locked'));
        assert.isFalse(locked('#form/normal'));
    });
});


describe("The question locking functionality in the core and UI", function () {
    before(beforeFn);

    describe("The edit locking", function () {
        it("shows the delete button for deleteable questions", function () {
            clickQuestion('normal');
            assert($("button:contains(Delete)").length === 1);
        });
        
        it("hides the delete button for non-deletable questions", function () {
            clickQuestion('node_locked');
            assert($("button:contains(Delete)").length === 0);
        });

        function testTypeChangeable(bool) {
            clickQuestion(bool ? "normal" : "value_locked");
            var btn = $(".btn.current-question");
            assert(btn.length === 1);
            btn.click();
            var menu = btn.closest('.question-type-changer');
            assert.equal(!!menu.find('li:not(.dropdown-header)').length, bool);
        }
        it("shows the type changer for type-changeable questions", function () {
            testTypeChangeable(true);
        });
        it("hides the type changer for non-type-changeable questions", function () {
            testTypeChangeable(false);
        });

        it("disables the checkbox (only) for a locked boolean property", function () {
            clickQuestion("value_locked");
            assert(getInput('requiredAttr').prop('disabled'));

            clickQuestion("normal");
            var $r = getInput('requiredAttr');
            assert.isFalse($r.prop('disabled'));
        });

        it("disables the text input (only) for a locked text property", function () {
            clickQuestion("normal");
            assert.isFalse(getInput('nodeID').prop('disabled'));

            clickQuestion("value_locked");
            assert(getInput("nodeID").prop('disabled'));
        });

        function testEditButton(bool) {
            clickQuestion(bool ? "value_locked" : "normal");
            var $but = getInput('relevantAttr').parents('.form-group').find('button.fd-edit-button');
            assert.equal(1, $but.length);
            assert.equal(bool, $but.prop('disabled'));
        }
        it("enables the edit button for non-locked logic properties", function () {
            testEditButton(false);
        });
       
        it("disables the edit button for locked logic properties", function () {
            testEditButton(true);
        });
    });
});
