define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/form',
    'text!static/questionProperties/comment-test.xml'
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

    describe("Section Toggler", function() {
        before(function(done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
            });
        });

        it("should show and hide sections", function() {
            util.loadXML("");
            util.addQuestion("Text");

            var slug = 'logic',
                $section = $(".fd-question-fieldset[data-slug='" + slug + "']"),
                visible = $section.is(":visible"),
                $command = $(".fd-section-changer a[data-slug='" + slug + "']");

            assert.strictEqual($command.hasClass("selected"), visible);

            $command.click();
            assert.strictEqual($section.is(":visible"), !visible);
            assert.strictEqual($command.hasClass("selected"), !visible);

            $command.click();
            assert.strictEqual($section.is(":visible"), visible);
            assert.strictEqual($command.hasClass("selected"), visible);
        });
    });
});
