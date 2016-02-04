require([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/form',
    'text!static/comments/comment-test.xml'
], function (
    util,
    chai,
    $,
    _,
    form,
    COMMENT_TEST_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("Question Comments", function() {
        before(function(done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {rich_text: false},
            });
        });

        it("should parse the comment", function() {
            util.loadXML(COMMENT_TEST_XML);
            var mug = util.getMug("/data/mug");
            assert.strictEqual(mug.p.comment, "This is a comment");
        });

        it("should display the comment", function() {
            util.loadXML(COMMENT_TEST_XML);
            assert($('.fd-props-toolbar > .alert-info'));
        });

        it("should write the comment", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text", "mug");
            mug.p.comment = "This is a comment";
            util.assertXmlEqual(COMMENT_TEST_XML, call("createXML"), {normalize_xmlns: true});
        });
    });
});
