/*jshint multistr: true */
require([
    'tests/options',
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/form',
    'text!static/markdown/markdown-test.xml',
    'text!static/markdown/simple-markdown.xml'
], function (
    options,
    util,
    chai,
    $,
    _,
    form,
    MARKDOWN_TEST_XML,
    SIMPLE_MARKDOWN_XML
) {

    // see note about controlling time in formdesigner.lock.js
    var assert = chai.assert,
        call = util.call,
        clickQuestion = util.clickQuestion;

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

        it("should write markdown if a form has markdown", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text", 'markdown_question');
            $('[name=itext-en-label]').val("**some markdown**").change();
            util.assertXmlEqual(call('createXML'), SIMPLE_MARKDOWN_XML, {normalize_xmlns: true});
        });

        it("should display markdown that includes markdown", function () {
            util.loadXML(MARKDOWN_TEST_XML);
        });
        it("should be able to disable markdown", function () {});

        it("should not display markdown that user has specified no markdown", function () {}); // also write

        it("should not display markdown when it contains no markdown characters", function () {}); // also write

        it("should detect markdown as user enters text", function () {});

        it("renders bold correctly", function () {});

        it("renders italics correctly", function () {});

        it("renders unordered list correctly", function () {});

        it("renders ordered list correctly", function () {});
    });
});
