define([
    'tests/utils',
    'chai',
    'jquery',
    'vellum/form',
    'vellum/tree',
    'text!static/form/alternate-root-node-name.xml',
    'text!static/form/question-referencing-other.xml',
    'text!static/form/group-with-internal-refs.xml',
    'text!static/form/hidden-value-in-group.xml',
    'text!static/form/select-questions.xml',
    'text!static/form/mismatch-tree-order.xml'
], function (
    util,
    chai,
    $,
    form_,
    Tree,
    ALTERNATE_ROOT_NODE_NAME_XML,
    QUESTION_REFERENCING_OTHER_XML,
    GROUP_WITH_INTERNAL_REFS_XML,
    HIDDEN_VALUE_IN_GROUP_XML,
    SELECT_QUESTIONS,
    MISMATCH_TREE_ORDER_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The form component", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should show warnings for broken references on delete mug", function () {
            util.loadXML(QUESTION_REFERENCING_OTHER_XML);
            var blue = call("getMugByPath", "/data/blue"),
                green = call("getMugByPath", "/data/green"),
                black = call("getMugByPath", "/data/black");
            assert(util.isTreeNodeValid(green), "sanity check failed: green is invalid");
            assert(util.isTreeNodeValid(black), "sanity check failed: black is invalid");
            util.clickQuestion("blue");
            blue.form.removeMugFromForm(blue);
            assert(util.isTreeNodeValid(green), "green should be valid");
            assert(!util.isTreeNodeValid(black), "black should not be valid");
        });

        it("should remove warnings when broken reference is fixed", function () {
            util.loadXML(QUESTION_REFERENCING_OTHER_XML);
            var blue = call("getMugByPath", "/data/blue"),
                black = call("getMugByPath", "/data/black");
            blue.form.removeMugFromForm(blue);
            assert(!util.isTreeNodeValid(black), "black should not be valid");
            blue = util.addQuestion("Text", "blue");
            assert(util.isTreeNodeValid(black),
                   "black should be valid after blue is added");
        });

        it("should preserve internal references in copied group", function () {
            util.loadXML(GROUP_WITH_INTERNAL_REFS_XML);
            var form = call("getData").core.form,
                group = util.getMug("group");
            form.duplicateMug(group);
            var green2 = util.getMug("copy-1-of-group/green");
            assert.equal(green2.p.relevantAttr,
                "/data/copy-1-of-group/blue = 'red' and /data/red = 'blue'");
        });

        it("should set non-standard form root node", function () {
            util.loadXML(ALTERNATE_ROOT_NODE_NAME_XML);
            var form = call("getData").core.form,
                blue = call("getMugByPath", "/other/blue");
            assert.equal(form.getBasePath(), "/other/");
            assert(blue !== null, "mug not found: /other/blue");
        });

        it("should be able to move item from Select to MSelect", function () {
            util.loadXML(SELECT_QUESTIONS);
            var form = call("getData").core.form,
                item1 = util.getMug("question1/item1"),
                item2 = util.getMug("question2/item2");
            // should not throw an error
            form.moveMug(item1, item2, 'before');
        });

        it("should update reference to hidden value in group", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var group = call("getMugByPath", "/data/group"),
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("/data/group/hidden");
            group.p.nodeID = "x";
            assert.equal(group.getAbsolutePath(), "/data/x");
            assert.equal(label.getAbsolutePath(), "/data/x/label");
            assert.equal(hidden.getAbsolutePath(), "/data/x/hidden");
            chai.expect(label.p.relevantAttr).to.include("/data/x/hidden");
        });

        it("should update reference to moved hidden value in output tag", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var form = call("getData").core.form,
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("/data/group/hidden");
            chai.expect(label.p.labelItextID.defaultValue()).to.include("/data/group/hidden");
            form.moveMug(hidden, null, "first");
            assert.equal(hidden.getAbsolutePath(), "/data/hidden");
            chai.expect(label.p.relevantAttr).to.include("/data/hidden");
            chai.expect(label.p.labelItextID.defaultValue()).to.include("/data/hidden");
        });

        it("should preserve order of the control tree", function() {
            util.loadXML(MISMATCH_TREE_ORDER_XML);
            util.assertJSTreeState(
                "question1",
                "question5",
                "question6",
                "question4",
                "question2",
                "  question3"
            );
        });
    });
});
