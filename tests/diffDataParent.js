require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/diffDataParent/parse.xml'
], function (
    chai,
    $,
    _,
    util,
    PARSE_XML
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

            form.moveMug(text2, text1, 'before');

            assert.equal(text2.p.dataParent, '/data/group1');
        });

        it("should update data tree after a change to data parent", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1'),
                group1 = util.addQuestion("Group", 'group1'),
                group2 = util.addQuestion.bind({prevId: text1.p.nodeID})("Group", 'group2'),
                form = call("getData").core.form;

            text1.p.dataParent = '/data/group1';
            form.moveMug(group1, group2, 'into');
            util.clickQuestion(text1.p.nodeID);
            assert(!util.isTreeNodeValid(text1), "text1 should not be valid");
        });

        it("should clear the data parent when moving to a repeat group", function() {
            util.loadXML("");
            var text1 = util.addQuestion("Text", 'text1');
            util.addQuestion("Group", 'group1');
            var repeat1= util.addQuestion.bind({prevId: text1.p.nodeID})("Repeat", 'repeat1'),
                form = call("getData").core.form;
            text1.p.dataParent = '/data/group1';
            form.moveMug(text1, repeat1, 'into');
            assert(util.isTreeNodeValid(text1), "text1 should be valid");
        });

        it("should parse and write XML to have the same order", function() {
            util.loadXML(PARSE_XML);
            util.assertXmlEqual(call("createXML"), PARSE_XML);
        });

        it("should have proper data parent after being loaded from xml", function() {
            util.loadXML(PARSE_XML);
            var question1 = call("getMugByPath", "/data/question4/question1");
            assert.equal(question1.p.dataParent, "/data/question4");
        });
    });
});
