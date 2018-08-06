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

        it('should update comment without reloading', function () {
            util.loadXML(COMMENT_TEST_XML);
            assert.strictEqual($('.fd-question-comment').text(), 'This is a comment');
            $('#property-comment').val('still a comment').change();
            assert.strictEqual($('.fd-question-comment').text(), 'still a comment');
        });

        it("should write the comment", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text", "mug");
            mug.p.comment = "This is a comment";
            util.assertXmlEqual(COMMENT_TEST_XML, call("createXML"), {normalize_xmlns: true});
        });

        it("should not show comment the comment if there isn't one", function() {
            util.loadXML("");
            util.addQuestion("Text", "mug");
            assert(!$('.fd-props-toolbar > .alert-info').is(':visible'));
        });

        it("should display a comment once it is specified", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text", "mug");
            mug.p.comment = 'this is a comment';
            assert($('.fd-props-toolbar > .alert-info').is(':visible'));
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

    describe("Required Condition", function() {
        it("should mark mug invalid if it has a required condition without being required", function () {
            var mug = util.getMug("text");
            assert(util.isTreeNodeValid(mug),
                    "precondition failed:\n" + util.getMessages(mug));
            try {
                mug.p["requiredCondition"] = "True()";
                assert(mug.messages.get("requiredCondition").length === 1, "requiredCondition doesn't have error");
                assert(mug.messages.get("requiredAttr").length === 1, "requiredAttr doesn't have error");

                mug.p["requiredAttr"] = "True()";
                assert(mug.messages.get("requiredCondition").length === 0, "requiredCondition has error");
                assert(mug.messages.get("requiredAttr").length === 0, "requiredAttr has error");
            } finally {
                mug.p["requiredCondition"] = "";
                mug.p["requiredAttr"] = "";
            }
        });

    });
});
