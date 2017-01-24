define([
    'chai',
    'tests/utils',
    'jquery',
], function (
    chai,
    util,
    $
) {
    var assert = chai.assert;

    describe("The undo manager", function () {
        beforeEach(function(done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: { onReady: done },
                features: {rich_text: false},
            });
        });

        it("should show an alert when deleting questions", function () {
            util.addQuestion('Text', 'text');
            $('.fd-button-remove').click();
            assert($('.fd-undo-delete').length);
        });

        it("should undelete one question properly", function () {
            util.addQuestion('Text', 'text');
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('text');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('text');
            assert(true, "Woo! text restored");
        });

        it("should undelete two questions properly", function () {
            util.addQuestion('Text', 'text');
            util.addQuestion('Text', 'text2');
            util.clickQuestion('text', 'text2');
            util.assertJSTreeState("text", "text2");
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('text');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('text');
            util.assertJSTreeState("text", "text2");
        });

        it("should undelete a nested question properly", function () {
            util.addQuestion('Group', 'group');
            util.addQuestion('Text', 'text2');
            util.assertJSTreeState("group", "  text2");
            util.clickQuestion('group/text2');
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('text2');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('group/text2');
            util.assertJSTreeState("group", "  text2");
        });

        it("should undelete a group properly", function () {
            util.addQuestion('Group', 'group');
            util.addQuestion('Text', 'text2');
            util.assertJSTreeState("group", "  text2");
            util.clickQuestion('group');
            $('.fd-button-remove').click();
            util.assertJSTreeState();
            try {
                util.clickQuestion('text2');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('group/text2');
            util.assertJSTreeState("group", "  text2");
        });

        it("should undelete a nested group properly", function () {
            util.addQuestion('Group', 'group');
            util.addQuestion('Group', 'group2');
            util.addQuestion('Text', 'text2');
            util.assertJSTreeState("group", "  group2", "    text2");
            util.clickQuestion('group/group2');
            $('.fd-button-remove').click();
            util.assertJSTreeState("group");
            try {
                util.clickQuestion('group2');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('group/group2/text2');
            util.assertJSTreeState("group", "  group2", "    text2");
        });

        it("should undelete a question with question after it", function () {
            util.addQuestion('Text', 'text');
            util.addQuestion('Text', 'text2');
            util.clickQuestion('text');
            util.assertJSTreeState("text", "text2");
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('text');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('text');
            util.assertJSTreeState("text", "text2");
        });

        it("should undelete the first question", function () {
            util.addQuestion('Text', 'text');
            util.clickQuestion('text');
            util.assertJSTreeState("text");
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('text');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            assert(!$('.fd-default-panel').is(':visible'), "New Form dialog showing");
            util.assertJSTreeState("text");
        });

        it("should undelete a multiple choice question with correct number of children", function () {
            util.addQuestion('Select', 'select');
            util.addQuestion('Choice', 'choice1');
            util.addQuestion('Choice', 'choice2');
            util.clickQuestion('select');
            util.assertJSTreeState("select", "  choice1", "  choice2");
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('select');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('select');
            util.assertJSTreeState("select", "  choice1", "  choice2");
        });

        it("should undelete multiple questions when selected out of order", function () {
            util.addQuestion('Text', 'text');
            util.addQuestion('Text', 'text2');
            util.addQuestion('Text', 'text3');
            util.clickQuestion('text3', 'text2');
            util.assertJSTreeState("text", "text2", "text3");
            $('.fd-button-remove').click();
            util.assertJSTreeState("text");
            $('.fd-undo').click();
            util.assertJSTreeState("text", "text2", "text3");
        });

        it("should reset the undo manager after a delete", function () {
            util.addQuestion('Text', 'text');
            util.addQuestion('Select', 'select');
            util.addQuestion('Choice', 'choice1');
            util.addQuestion('Choice', 'choice2');
            util.assertJSTreeState('text', 'select', '  choice1', '  choice2');
            util.clickQuestion('text');
            $('.fd-button-remove').click();
            util.assertJSTreeState('select', '  choice1', '  choice2');
            util.clickQuestion('select');
            $('.fd-button-remove').click();
            util.assertJSTreeState();
            $('.fd-undo').click();
            util.assertJSTreeState('select', '  choice1', '  choice2');
        });

        it("should reset the undo manager after adding a question", function () {
            util.addQuestion('Text', 'text');
            util.addQuestion('Select', 'select');
            util.addQuestion('Choice', 'choice1');
            util.addQuestion('Choice', 'choice2');
            util.assertJSTreeState('text', 'select', '  choice1', '  choice2');
            util.clickQuestion('text');
            $('.fd-button-remove').click();
            util.assertJSTreeState('select', '  choice1', '  choice2');
            util.addQuestion('Text', 'text');
            assert.strictEqual($('.fd-undo-delete').length, 0);
        });

        it("should undelete a multiple choice question when selected with others", function() {
            util.addQuestion('Text', 'text');
            util.addQuestion('Select', 'select');
            util.addQuestion('Choice', 'choice1');
            util.addQuestion('Choice', 'choice2');
            util.clickQuestion('text', 'select');
            util.assertJSTreeState('text', "select", "  choice1", "  choice2");
            $('.fd-button-remove').click();
            try {
                util.clickQuestion('select');
                assert(false, "this better not work");
            } catch (err) {
                assert(true, "text doesn't exist");
            }
            $('.fd-undo').click();
            util.clickQuestion('select');
            util.assertJSTreeState('text', "select", "  choice1", "  choice2");
        });

        it("should adjust the tree's height to accommodate the undo alert message", function () {
            var getHeight = function() { return $(".fd-tree .fd-scrollable").outerHeight(); };
            util.addQuestion('Text', 'text');
            util.addQuestion('Select', 'select');
            util.clickQuestion('text');

            var heightWithoutAlert = getHeight();
            $('.fd-button-remove').click();
            var heightWithAlert = getHeight();

            assert(heightWithAlert !== heightWithoutAlert, "Height changed with addition of alert.");
            $(".fd-undo").click();
            assert(getHeight() === heightWithoutAlert, "Height restored after undoing deletion.");
            $('.fd-button-remove').click();
            assert(getHeight() === heightWithAlert, "Height changed with addition of alert.");
            $(".fd-undo-delete .close").click();
            assert(getHeight() === heightWithoutAlert, "Height restored after closing alert.");
        });
    });
});
