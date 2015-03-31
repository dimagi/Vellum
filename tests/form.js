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
    'text!static/form/mismatch-tree-order.xml',
    'text!static/form/hidden-value-tree-order.xml'
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
    MISMATCH_TREE_ORDER_XML,
    HIDDEN_VALUE_TREE_ORDER
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

        it("should get and fix serialization errors for mugs with matching paths", function () {
            var form = util.loadXML(""),
                one = util.addQuestion("Text", "question"),
                two = util.addQuestion("Text", "question");
            assert.notEqual(one.absolutePath, two.absolutePath);
            var errors = form.getSerializationWarnings();
            assert.equal(errors.length, 1, "missing serialization error message");
            assert.equal(errors[0].mug.ufid, two.ufid);

            form.fixSerializationWarnings(errors);
            assert.equal(one.p.nodeID, "question");
            assert.notEqual(one.absolutePath, two.absolutePath);
            errors = form.getSerializationWarnings();
            assert.deepEqual(errors, [], JSON.stringify(errors));
        });

        it("should retain expression meaning on rename matching path", function () {
            var blue = util.addQuestion("Text", "blue"),
                green = util.addQuestion("Text", "green"),
                black = util.addQuestion("DataBindOnly", "black");
            black.p.calculateAttr = "/data/blue + /data/green";
            green.p.nodeID = "blue";
            assert.notEqual(green.p.nodeID, "blue");
            assert(!util.isTreeNodeValid(green), "expected validation error");

            blue.p.nodeID = "orange";
            assert.equal(green.p.nodeID, "blue");
            assert.equal(black.p.calculateAttr, "/data/orange + /data/blue");
            assert(util.isTreeNodeValid(blue), blue.getErrors().join("\n"));
            assert(util.isTreeNodeValid(green), green.getErrors().join("\n"));
            assert(util.isTreeNodeValid(black), black.getErrors().join("\n"));
        });

        it("should retain conflicted mug ID on move", function () {
            var form = util.loadXML(""),
                hid = util.addQuestion("DataBindOnly", "hid"),
                text = util.addQuestion("Text", "text"),
                group = util.addQuestion("Group", "group");
            util.addQuestion("Text", "text");
            hid.p.calculateAttr = "/data/text + /data/group/text";
            form.moveMug(text, "into", group);
            assert.notEqual(hid.p.calculateAttr, "/data/text + /data/group/text");
            assert.notEqual(text.p.nodeID, "text");
            assert(!util.isTreeNodeValid(text), "expected /data/text error");

            form.moveMug(text, "into", null);
            assert.equal(text.p.nodeID, "text");
            assert.equal(hid.p.calculateAttr, "/data/text + /data/group/text");
            assert(util.isTreeNodeValid(text), text.getErrors().join("\n"));
        });

        it("should show warnings for broken references on delete mug", function () {
            util.loadXML(QUESTION_REFERENCING_OTHER_XML);
            var blue = call("getMugByPath", "/data/blue"),
                green = call("getMugByPath", "/data/green"),
                black = call("getMugByPath", "/data/black");
            assert(util.isTreeNodeValid(green), "sanity check failed: green is invalid");
            assert(util.isTreeNodeValid(black), "sanity check failed: black is invalid");
            util.clickQuestion("blue");
            blue.form.removeMugsFromForm([blue]);
            assert(util.isTreeNodeValid(green), "green should be valid");
            assert(!util.isTreeNodeValid(black), "black should not be valid");
        });

        it("should remove warnings when broken reference is fixed", function () {
            util.loadXML(QUESTION_REFERENCING_OTHER_XML);
            var blue = call("getMugByPath", "/data/blue"),
                black = call("getMugByPath", "/data/black");
            blue.form.removeMugsFromForm([blue]);
            assert(!util.isTreeNodeValid(black), "black should not be valid");
            blue = util.addQuestion("Text", "blue");
            assert(util.isTreeNodeValid(black), util.getMessages(black));
        });

        it("should show duplicate question ID warning inline", function () {
            util.loadXML("");
            util.addQuestion("Text", "text");
            var text = util.addQuestion("Text", "text"),
                messages = text.messages.get("nodeID");
            assert.equal(messages.length, 1, messages.join("\n"));
            // UI dependent, possibly fragile
            var div = $("[name=property-nodeID]").closest(".control-group"),
                msg = div.find(".messages").children();
            assert.equal(msg.length, messages.length, msg.text());
            assert.equal(msg[0].text, messages[0].message);
        });

        it("should add ODK warning to mug on create Audio question", function () {
            util.loadXML("");
            var mug = util.addQuestion("Audio"),
                messages = util.getMessages(mug);
            chai.expect(messages).to.include("Android");
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
            form.moveMug(item1, 'before', item2);
        });

        it("should update reference to hidden value in group", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var group = call("getMugByPath", "/data/group"),
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("/data/group/hidden");
            group.p.nodeID = "x";
            assert.equal(group.absolutePath, "/data/x");
            assert.equal(label.absolutePath, "/data/x/label");
            assert.equal(hidden.absolutePath, "/data/x/hidden");
            chai.expect(label.p.relevantAttr).to.include("/data/x/hidden");
        });

        it("should update reference to moved hidden value in output tag", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var form = call("getData").core.form,
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("/data/group/hidden");
            chai.expect(label.p.labelItext.defaultValue()).to.include("/data/group/hidden");
            form.moveMug(hidden, "first", null);
            assert.equal(hidden.absolutePath, "/data/hidden");
            chai.expect(label.p.relevantAttr).to.include("/data/hidden");
            chai.expect(label.p.labelItext.defaultValue()).to.include("/data/hidden");
        });

        it("should update repeat group reference", function () {
            util.loadXML("");
            var text = util.addQuestion("Text", 'text'),
                repeat = util.addQuestion("Repeat", 'repeat');
            repeat.p.repeat_count = '/data/text';
            assert.equal(repeat.p.repeat_count, '/data/text');
            text.p.nodeID = 'text2';
            assert.equal(repeat.p.repeat_count, '/data/text2');
        });

        it ("should show warnings for duplicate choice value", function() {
            util.loadXML("");
            var select = util.addQuestion("Select", 'select'),
                item1 = select.form.getChildren(select)[0],
                item2 = select.form.getChildren(select)[1];
            assert(util.isTreeNodeValid(item1), item1.getErrors().join("\n"));
            assert(util.isTreeNodeValid(item2), item2.getErrors().join("\n"));
            item2.p.defaultValue = "item1";
            assert(util.isTreeNodeValid(item1), "item1 should be valid");
            assert(!util.isTreeNodeValid(item2), "item2 should be invalid");
        });

        it("should preserve order of the control tree", function() {
            util.loadXML(MISMATCH_TREE_ORDER_XML);
            util.assertJSTreeState(
                "question1",
                "question4",
                "question2",
                "  question3",
                "question5",
                "question6"
            );
        });

        it("should merge data-only-nodes with control nodes", function() {
            util.loadXML(HIDDEN_VALUE_TREE_ORDER);
            util.assertJSTreeState(
                "question1",
                "question5",
                "question2",
                "  question3",
                "question6",
                "question4"
            );
        });
    });
});
