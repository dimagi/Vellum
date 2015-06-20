require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/form',
    'text!static/markdown/markdown-test.xml',
    'text!static/markdown/simple-markdown.xml',
    'text!static/markdown/simple-markdown-no-chars.xml',
    'text!static/markdown/no-markdown.xml',
    'text!static/markdown/no-markdown-stars.xml'
], function (
    options,
    util,
    chai,
    $,
    _,
    form,
    MARKDOWN_TEST_XML,
    SIMPLE_MARKDOWN_XML,
    SIMPLE_MARKDOWN_NO_CHARS_XML,
    NO_MARKDOWN_XML,
    NO_MARKDOWN_STARS_XML
) {
    var assert = chai.assert,
        call = util.call;

    function markdownVisible() {
        return $('.itext-block-label-group-default')
            .find('.markdown-output')
            .is(':visible');
    }

    function toggleMarkdown() {
        $('.markdown-trigger').first().click();
    }

    describe("The markdown widget", function () {
        function beforeFn(done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {onReady: done}
            });
        }
        before(beforeFn);

        it("should parse form that has markdown", function() {
            util.loadXML(MARKDOWN_TEST_XML);
            var mug = util.getMug('/data/markdown_question');
            assert(mug.p.labelItext.hasMarkdown);
        });

        it("should use the markdown form when there are conflicting strings", function() {
            util.loadXML(MARKDOWN_TEST_XML);
            var mug = util.getMug('/data/markdown_question');
            assert.strictEqual(mug.p.labelItext.get(), "**some markdown**");
        });

        describe("when a user has not defined markdown usage", function() {
            it("should not show markdown with nothing in the text", function() {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                assert(!markdownVisible());
            });

            it("should allow turning off markdown if markdown characters are input", function() {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                $('[name=itext-en-label]').val("**markdown**").change();
                assert(markdownVisible());
                $('.markdown-trigger').first().click();
                assert(!markdownVisible());
            });

            it("should not show markdown if non markdown characters are not input", function() {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                assert(!markdownVisible());
                $('[name=itext-en-label]').val("no markdown here").change();
                assert(!markdownVisible());
            });

            it("should write any markdown if markdown characters are input", function() {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                $('[name=itext-en-label]').val("**some markdown**").change();
                util.assertXmlEqual(call('createXML'), SIMPLE_MARKDOWN_XML, {normalize_xmlns: true});
            });

            it("should not write any markdown if markdown characters are not input", function() {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                $('[name=itext-en-label]').val("no markdown").change();
                util.assertXmlEqual(call('createXML'), NO_MARKDOWN_XML, {normalize_xmlns: true});
            });
        });

        describe("when a user explicitly wants no markdown", function() {
            beforeEach(function (done) {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                $('[name=itext-en-label]').val("**no markdown**").change();
                toggleMarkdown();
                done();
            });

            it("should not show markdown when there are markdown characters", function() {
                assert(!markdownVisible());
                $('[name=itext-en-label]').val("~~more markdown~~").change();
                assert(!markdownVisible());
            });

            it("should allow re-enabling markdown", function() {
                toggleMarkdown();
                assert(markdownVisible());
            });

            it("should not write any markdown", function() {
                util.assertXmlEqual(call('createXML'), NO_MARKDOWN_STARS_XML, {normalize_xmlns: true});
            });
        });

        describe("when a user explicitly wants markdown", function() {
            function beforeFn(done) {
                util.loadXML("");
                util.addQuestion("Text", 'markdown_question');
                $('[name=itext-en-label]').val("**some markdown**").change();
                toggleMarkdown();
                toggleMarkdown();
                done();
            }
            beforeEach(beforeFn);

            it("should show markdown when there are no markdown characters", function () {
                $('[name=itext-en-label]').val("some markdown").change();
                assert(markdownVisible());
            });

            it("should allow turning off markdown", function() {
                assert(markdownVisible());
                toggleMarkdown();
                assert(!markdownVisible());
            });

            it("should write markdown even if there are no markdown characters", function() {
                $('[name=itext-en-label]').val("some markdown").change();
                util.assertXmlEqual(call('createXML'), SIMPLE_MARKDOWN_NO_CHARS_XML, {normalize_xmlns: true});
            });
        });
    });
});
