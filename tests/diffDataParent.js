define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/diffDataParent/parse.xml',
    'text!static/diffDataParent/sibling-as-child.xml',
    'text!static/diffDataParent/data-parent-mug-after.xml',
    'text!static/diffDataParent/data-parent-mug-before.xml',
    'text!static/diffDataParent/data-parent-mug-in-between.xml',
], function (
    chai, $,
    _,
    util,
    PARSE_XML,
    SIBLING_AS_CHILD,
    DATA_PARENT_MUG_AFTER,
    DATA_PARENT_MUG_BEFORE,
    DATA_PARENT_MUG_IN_BETWEEN,
) {
    var assert = chai.assert,
        call = util.call;

    describe("Control elements with different data parents", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
            });
        });

        it("should not allow repeat group children to have data parent outside of the repeat", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", 'repeat1'),
                text1 = util.addQuestion.bind({prevId: repeat.p.nodeID})("Text", 'text1'),
                text2 = util.addQuestion.bind({prevId: repeat.p.nodeID})("Text", 'text2');

            text2.p.dataParent = '#form';
            assert(util.isTreeNodeValid(text1), "text1 should be valid");
            assert(!util.isTreeNodeValid(text2), "text2 should not be valid");
        });

        it("should allow repeat group children to have data parent (in) the same repeat", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", 'repeat'),
                group = util.addQuestion.bind({prevId: 'repeat'})("Group", 'group'),
                text = util.addQuestion.bind({prevId: 'repeat/group'})("Text", 'text');

            text.p.dataParent = repeat.hashtagPath;
            assert.equal(group, text.parentMug, "group should be control parent of text");
            assert(util.isTreeNodeValid(text), "text should be valid");
        });

        it("should not allow nested repeat group children to have data parent in an outer repeat", function () {
            util.loadXML("");
            var repeat1 = util.addQuestion("Repeat", 'repeat1'),
                repeat2 = util.addQuestion.bind({prevId: 'repeat1'})("Repeat", 'repeat2'),
                text = util.addQuestion.bind({prevId: 'repeat1/repeat2'})("Text", 'text');

            text.p.dataParent = repeat1.hashtagPath;
            assert.equal(repeat2, text.parentMug, "repeat2 should be control parent of text");
            assert.match(util.getMessages(text),
                /Data parent of question in repeat group must be .... the same repeat group/);
        });

        it("should not allow a data parent to be an input", function () {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                text2 = util.addQuestion("Text", 'text2');

            text2.p.dataParent = '#form/text1';
            assert(util.isTreeNodeValid(text1), "text1 should be valid");
            assert(!util.isTreeNodeValid(text2), "text2 should not be valid");
        });

        it("should keep the same data parent after a move", function () {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                text2 = util.addQuestion("Text", 'text2'),
                form = call("getData").core.form;

            util.addQuestion("Group", 'group1');
            text2.p.dataParent = '#form/group1';

            form.moveMug(text2, 'before', text1);

            assert.equal(text2.p.dataParent, '#form/group1');
        });

        it("should update data tree after a change to data parent", function () {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                group1 = util.addQuestion("Group", 'group1'),
                group2 = util.addQuestion.bind({prevId: text1.p.nodeID})("Group", 'group2'),
                form = call("getData").core.form;

            text1.p.dataParent = '#form/group1';
            assert.equal(text1.p.dataParent, "#form/group1");
            form.moveMug(group1, 'into', group2);
            assert.equal(text1.p.dataParent, "#form/group2/group1");
        });

        it("should clear the data parent when moving to a repeat group", function () {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1');
            util.addQuestion("Group", 'group1');
            var repeat1 = util.addQuestion.bind({prevId: text1.p.nodeID})("Repeat", 'repeat1'),
                form = call("getData").core.form;
            text1.p.dataParent = '#form/group1';
            form.moveMug(text1, 'into', repeat1);
            assert(util.isTreeNodeValid(text1), text1.getErrors().join("\n"));
            assert.isUndefined(text1.p.dataParent);
        });

        it("should not clear the data parent when moving within a repeat group", function () {
            var form = util.loadXML("");
            var repeat1 = util.addQuestion("Repeat", 'repeat1'),
                group = util.addQuestion.bind({prevId: 'repeat1'})("Group", 'group1'),
                text1 = util.addQuestion.bind({prevId: 'repeat1'})("Text", 'text1');
            text1.p.dataParent = '#form/repeat1';
            assert.equal(text1.parentMug, repeat1, "repeat1 should be control parent of text");
            form.moveMug(text1, 'into', group);
            assert(util.isTreeNodeValid(text1), text1.getErrors().join("\n"));
            assert.equal(text1.p.dataParent, repeat1.hashtagPath);
            assert.equal(text1.parentMug, group, "group should be control parent of text");
        });

        it("should clear the data parent when moving into a nested repeat group", function () {
            var form = util.loadXML("");
            var repeat1 = util.addQuestion("Repeat", 'repeat1');
            util.addQuestion.bind({prevId: 'repeat1'})("Repeat", 'repeat2');
            var group = util.addQuestion.bind({prevId: 'repeat1/repeat2'})("Group", 'group1'),
                text1 = util.addQuestion.bind({prevId: 'repeat1'})("Text", 'text1');
            text1.p.dataParent = '#form/repeat1';
            assert.equal(text1.parentMug, repeat1, "repeat1 should be control parent of text");
            form.moveMug(text1, 'into', group);
            assert(util.isTreeNodeValid(text1), text1.getErrors().join("\n"));
            assert.isUndefined(text1.p.dataParent);
            assert.equal(text1.parentMug, group, "group should be control parent of text");
        });

        it("should have proper data parent after reloading the form", function () {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                form = call("getData").core.form;

            util.addQuestion("Group", 'group1');

            text1.p.dataParent = '#form/group1';
            util.loadXML(call("createXML"));
            assert.equal(text1.p.dataParent, '#form/group1');
            util.assertTreeState(form.dataTree(),
                "group1",
                "  text1",
            );
        });

        it("should update mug path mapping on set data parent", function () {
            var form = util.loadXML(""),
                text = util.addQuestion("Text", 'text');
            util.addQuestion("Group", 'group');
            text.p.dataParent = '#form/group';
            var map = JSON.stringify(_.object(_.map(form.mugMap, function (mug, path) {
                if (path.startsWith("/")) {
                    return [path, mug.__className];
                }
                return ["", undefined];
            })));
            assert(util.getMug('/data/group/text'),
                'cannot find "#form/group/text" in ' + map);
        });

        it("should parse and write XML to have the same order", function () {
            util.loadXML(PARSE_XML);
            util.assertXmlEqual(call("createXML"), PARSE_XML);
        });

        it("should have proper data parent after being loaded from xml", function () {
            util.loadXML(PARSE_XML);
            var diffChild = util.getMug("/data/parent/different-child");
            assert.equal(diffChild.p.dataParent, "#form/parent");
            util.assertJSTreeState(
                "different-child",
                "parent",
                "  normal-child",
            );
        });

        it("should use the control parent when inserting after a mug with different data parent", function () {
            util.loadXML("");
            var form = call("getData").core.form,
                text1 = util.addQuestion("Text", 'text1');
            util.addQuestion("Group", 'group');
            util.addQuestion("Text", 'text2');

            text1.p.dataParent = '#form/group';
            util.addQuestion.bind({prevId: text1.absolutePath})("Text", 'text3');
            // questions with alternate dataParent always come last in the data tree
            util.assertTreeState(form.dataTree(),
                "text3",
                "group",
                "  text2",
                "  text1",
            );
            util.assertJSTreeState(
                "text1",
                "text3",
                "group",
                "  text2",
            );
        });

        it("should properly load group before sibling/child", function () {
            util.loadXML(SIBLING_AS_CHILD);
            var text = util.getMug("/data/text");
            assert.equal(text.p.dataParent, "#form");
            util.assertJSTreeState(
                "group",
                "  text",
            );
            util.assertXmlEqual(call("createXML"), SIBLING_AS_CHILD);
        });

        it("should properly load mug after other mugs", function () {
            util.loadXML(DATA_PARENT_MUG_AFTER);
            var child = util.getMug("/data/parent/child");
            assert.equal(child.p.dataParent, "#form/parent");
            util.assertJSTreeState(
                "before-child",
                "child",
                "parent",
            );
            util.assertXmlEqual(call("createXML"), DATA_PARENT_MUG_AFTER);
        });

        it("should properly load mug before other mugs", function () {
            util.loadXML(DATA_PARENT_MUG_BEFORE);
            var child = util.getMug("/data/parent/child");
            assert.equal(child.p.dataParent, "#form/parent");
            util.assertJSTreeState(
                "child",
                "after-child",
                "parent",
            );
            util.assertXmlEqual(call("createXML"), DATA_PARENT_MUG_BEFORE);
        });

        it("should properly load mug in between other mugs", function () {
            util.loadXML(DATA_PARENT_MUG_IN_BETWEEN);
            var child = util.getMug("/data/parent/child");
            assert.equal(child.p.dataParent, "#form/parent");
            util.assertJSTreeState(
                "before-child",
                "child",
                "after-child",
                "parent",
            );
            util.assertXmlEqual(call("createXML"), DATA_PARENT_MUG_IN_BETWEEN);
        });

        it("should error on recursive data parent", function () {
            util.loadXML("");
            var mug = util.addQuestion("Text", 'mug');
            assert.equal(mug.absolutePath, "/data/mug");
            mug.p.dataParent = '#form/mug';
            assert.deepEqual(mug.getErrors(),
                [gettext("{path} is not a valid data parent")
                    .replace("{path}", "#form/mug")]);
        });
    });
});
