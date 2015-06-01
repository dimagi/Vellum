require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/diffDataParent/parse.xml',
    'text!static/diffDataParent/sibling-as-child.xml',
    'text!static/diffDataParent/data-parent-mug-after.xml',
    'text!static/diffDataParent/data-parent-mug-before.xml',
    'text!static/diffDataParent/data-parent-mug-in-between.xml'
], function (
    chai, $,
    _,
    util,
    PARSE_XML,
    SIBLING_AS_CHILD,
    DATA_PARENT_MUG_AFTER,
    DATA_PARENT_MUG_BEFORE,
    DATA_PARENT_MUG_IN_BETWEEN
) {
    var assert = chai.assert,
        call = util.call;

    describe("Control elements with different data parents", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should not allow repeat group children to have other data parents", function() {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", 'repeat1'),
                text1 = util.addQuestion.bind({prevId: repeat.p.nodeID})("Text", 'text1'),
                text2 = util.addQuestion.bind({prevId: repeat.p.nodeID})("Text", 'text2');

            text2.p.dataParent = '/data';
            assert(util.isTreeNodeValid(text1), "text1 should be valid");
            assert(!util.isTreeNodeValid(text2), "text2 should not be valid");
        });

        it("should not allow a data parent to be an input", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                text2 = util.addQuestion("Text", 'text2');

            text2.p.dataParent = '/data/text1';
            assert(util.isTreeNodeValid(text1), "text1 should be valid");
            assert(!util.isTreeNodeValid(text2), "text2 should not be valid");
        });

        it("should keep the same data parent after a move", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                text2 = util.addQuestion("Text", 'text2'),
                form = call("getData").core.form;

            util.addQuestion("Group", 'group1');
            text2.p.dataParent = '/data/group1';

            form.moveMug(text2, 'before', text1);

            assert.equal(text2.p.dataParent, '/data/group1');
        });

        it("should update data tree after a change to data parent", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                group1 = util.addQuestion("Group", 'group1'),
                group2 = util.addQuestion.bind({prevId: text1.p.nodeID})("Group", 'group2'),
                form = call("getData").core.form;

            text1.p.dataParent = '/data/group1';
            assert.equal(text1.p.dataParent, "/data/group1");
            form.moveMug(group1, 'into', group2);
            assert.equal(text1.p.dataParent, "/data/group2/group1");
        });

        it("should clear the data parent when moving to a repeat group", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1');
            util.addQuestion("Group", 'group1');
            var repeat1= util.addQuestion.bind({prevId: text1.p.nodeID})("Repeat", 'repeat1'),
                form = call("getData").core.form;
            text1.p.dataParent = '/data/group1';
            form.moveMug(text1, 'into', repeat1);
            assert(util.isTreeNodeValid(text1), text1.getErrors().join("\n"));
            assert.isUndefined(text1.p.dataParent);
        });

        it("should have proper data parent after reloading the form", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                form = call("getData").core.form;

            util.addQuestion("Group", 'group1');

            text1.p.dataParent = '/data/group1';
            util.loadXML(call("createXML"));
            assert.equal(text1.p.dataParent, '/data/group1');
            util.assertTreeState(form.dataTree(),
                "group1",
                "  text1"
            );
        });

        it("should update mug path mapping on set data parent", function() {
            var form = util.loadXML(""),
                text = util.addQuestion("Text", 'text');
            util.addQuestion("Group", 'group');
            text.p.dataParent = '/data/group';
            var map = JSON.stringify(_.object(_.map(form.mugMap, function (mug, path) {
                if (path.startsWith("/")) {
                    return [path, mug.__className];
                }
                return ["", undefined];
            })));
            assert(util.getMug('/data/group/text'),
                   'cannot find "/data/group/text" in ' + map);
        });

        it("should parse and write XML to have the same order", function() {
            util.loadXML(PARSE_XML);
            util.assertXmlEqual(call("createXML"), PARSE_XML);
        });

        it("should have proper data parent after being loaded from xml", function() {
            util.loadXML(PARSE_XML);
            var diffChild = util.getMug("/data/parent/different-child");
            assert.equal(diffChild.p.dataParent, "/data/parent");
            util.assertJSTreeState(
                "different-child",
                "parent",
                "  normal-child"
            );
        });

        it("should use the control parent when inserting after a mug with different data parent", function() {
            util.loadXML("");
            var form = call("getData").core.form,
                text1 = util.addQuestion("Text", 'text1');
            util.addQuestion("Group", 'group');
            util.addQuestion("Text", 'text2');

            text1.p.dataParent = '/data/group';
            util.addQuestion.bind({prevId: text1.absolutePath})("Text", 'text3');
            // questions with alternate dataParent always come last in the data tree
            util.assertTreeState(form.dataTree(),
                "text3",
                "group",
                "  text2",
                "  text1"
            );
            util.assertJSTreeState(
                "text1",
                "text3",
                "group",
                "  text2"
            );
        });

        it("should properly load group before sibling/child", function() {
            util.loadXML(SIBLING_AS_CHILD);
            var text = util.getMug("/data/text");
            assert.equal(text.p.dataParent, "/data");
            util.assertJSTreeState(
                "group",
                "  text"
            );
            util.assertXmlEqual(call("createXML"), SIBLING_AS_CHILD);
        });

        it("should properly load mug after other mugs", function() {
            util.loadXML(DATA_PARENT_MUG_AFTER);
            var child = util.getMug("/data/parent/child");
            assert.equal(child.p.dataParent, "/data/parent");
            util.assertJSTreeState(
                "before-child",
                "child",
                "parent"
            );
            util.assertXmlEqual(call("createXML"), DATA_PARENT_MUG_AFTER);
        });

        it("should properly load mug before other mugs", function() {
            util.loadXML(DATA_PARENT_MUG_BEFORE);
            var child = util.getMug("/data/parent/child");
            assert.equal(child.p.dataParent, "/data/parent");
            util.assertJSTreeState(
                "child",
                "after-child",
                "parent"
            );
            util.assertXmlEqual(call("createXML"), DATA_PARENT_MUG_BEFORE);
        });

        it("should properly load mug in between other mugs", function() {
            util.loadXML(DATA_PARENT_MUG_IN_BETWEEN);
            var child = util.getMug("/data/parent/child");
            assert.equal(child.p.dataParent, "/data/parent");
            util.assertJSTreeState(
                "before-child",
                "child",
                "after-child",
                "parent"
            );
            util.assertXmlEqual(call("createXML"), DATA_PARENT_MUG_IN_BETWEEN);
        });
    });
});
