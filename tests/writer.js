define([
    'chai',
    'jquery',
    'tests/utils',
    'static/writer/ignore-richtext-and-markdown.xml',
    'static/writer/repeat-without-count.xml',
    'static/writer/repeat-noAddRemove-false.xml',
    'static/writer/repeat-with-count.xml',
    'static/writer/repeat-with-count-noAddRemove-false.xml',
    'static/writer/repeat-with-count-as-question.xml',
], function (
    chai,
    $,
    util,
    INGORE_RICHTEXT_AND_MARKDWON,
    REPEAT_WITHOUT_COUNT_XML,
    REPEAT_NO_ADD_REMOVE_FALSE_XML,
    REPEAT_WITH_COUNT_XML,
    REPEAT_WITH_COUNT_NO_ADD_REMOVE_FALSE_XML,
    REPEAT_WITH_COUNT_AS_QUESTION_XML
) {
    var assert = chai.assert;

    describe("The XML writer", function () {
        beforeEach(function (done) {
            util.init({
                core: {
                    onReady: function () {
                        done();
                    }
                },
            });
        });

        it("should not set jr:noAddRemove on repeat group without count", function () {
            util.addQuestion("Repeat", "group");
            util.assertXmlEqual(
                util.call("createXML"),
                REPEAT_WITHOUT_COUNT_XML,
                {normalize_xmlns: true}
            );
        });

        it("should not set jr:noAddRemove on repeat group without count even when jr:noAddRemove is true", function () {
            var group = util.addQuestion("Repeat", "group");
            group.p.no_add_remove = true;
            util.assertXmlEqual(
                util.call("createXML"),
                REPEAT_WITHOUT_COUNT_XML,
                {normalize_xmlns: true}
            );
        });

        it("should remove jr:noAddRemove attribute when its value was false()", function () {
            util.call("loadXML", REPEAT_NO_ADD_REMOVE_FALSE_XML);
            util.assertXmlEqual(
                util.call("createXML"),
                REPEAT_WITHOUT_COUNT_XML,
                {normalize_xmlns: true}
            );
        });

        it("should preserve jr:noAddRemove='true()' when jr:count has a value", function () {
            util.call("loadXML", REPEAT_WITH_COUNT_XML);
            util.assertXmlEqual(
                util.call("createXML"),
                REPEAT_WITH_COUNT_XML,
                {normalize_xmlns: true}
            );
        });

        it("should change jr:noAddRemove to 'true()' when jr:count has a value", function () {
            util.call("loadXML", REPEAT_WITH_COUNT_NO_ADD_REMOVE_FALSE_XML);
            util.assertXmlEqual(
                util.call("createXML"),
                REPEAT_WITH_COUNT_XML,
                {normalize_xmlns: true}
            );
        });

        it("should add hashtag reference to jr:count", function () {
            util.loadXML("");
            util.addQuestion("Int");
            var mug = util.addQuestion("Repeat");
            util.addQuestion("Text");
            mug.p.repeat_count = "#form/question1";
            util.assertXmlEqual(
                util.call("createXML"),
                REPEAT_WITH_COUNT_AS_QUESTION_XML,
                {normalize_xmlns: true}
            );
        });

        it("should be able to ignore both richText and markdown", function () {
            var form = util.loadXML(INGORE_RICHTEXT_AND_MARKDWON);
            assert(!form.richText, "richText should be disabled");
            assert(form.noMarkdown, "markdown should be disabled");
            util.assertXmlEqual(
                util.call("createXML"),
                INGORE_RICHTEXT_AND_MARKDWON,
                {normalize_xmlns: true}
            );
        });

        it("should still save more than once", function () {
            util.call("loadXML", "");
            util.addQuestion("FieldList", 'fieldlist');
            util.addQuestion("Text", 'text1');
            util.addQuestion("Text", 'text2');
            util.addQuestion("Text", 'text3');
            util.addQuestion("Text", 'text4');
            util.call("createXML");
            util.deleteQuestion("/data/fieldlist/text1");
            util.call("createXML");
        });

        it("should not write empty itext ref", function () {
            util.loadXML("");
            util.addQuestion("Select", "select");
            var choice = util.addQuestion("Choice", "blank", {labelItext: ""});
            assert.equal(choice.p.labelItext.get(), "");
            var xml = $(util.call('createXML'));
            assert.equal(xml.find("text[id=select-blank-label]").length, 0,
                "should not write select-blank-label itext item");
            assert.equal(xml.find("label").attr("ref"), undefined,
                "item label ref should not be defined");
        });
    });

});
