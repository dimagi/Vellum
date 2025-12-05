import util from "tests/utils";
import vellumUtil from "vellum/util";
import chai from "chai";
import $ from "jquery";
import MARKDOWN_TEST_XML from "static/markdown/markdown-test.xml";
import SIMPLE_MARKDOWN_XML from "static/markdown/simple-markdown.xml";
import SIMPLE_MARKDOWN_NO_CHARS_XML from "static/markdown/simple-markdown-no-chars.xml";
import NO_MARKDOWN_XML from "static/markdown/no-markdown.xml";
import NO_MARKDOWN_STARS_XML from "static/markdown/no-markdown-stars.xml";
import EXPLICIT_NO_MARKDOWN_XML from "static/markdown/explicit-no-markdown.xml";
import MARKDOWN_OUTPUT_VALUE_XML from "static/markdown/markdown-output-value.xml";

var assert = chai.assert,
    call = util.call,
    markdownVisible = util.markdownVisible;

function toggleMarkdown() {
    $('.markdown-trigger').first().click();
}

describe("The markdown widget", function () {
    function beforeFn(done) {
        util.init({
            javaRosa: {langs: ['en', 'hin']},
            core: {onReady: function () { done(); }},
            features: {rich_text: false},
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

        it("should support ordered list with parens", function() {
            util.loadXML("");
            util.addQuestion("Text", 'markdown_question');
            $('[name=itext-en-label]').val("1) first\n 2) second").change();
            assert(markdownVisible());
        });

        it("should write /data/ to output value", function() {
            util.loadXML("");
            util.addQuestion("Text", 'markdown_question');
            $('[name=itext-en-label]').val("**some markdown**").change();
            util.addQuestion("Text", 'question1');
            $('[name=itext-en-label]').val("* ").change();
            var label = $("[name=itext-en-label]"),
                tree = $(".fd-question-tree").jstree(true);
            vellumUtil.setCaretPosition(label[0], 2);
            util.findNode(tree, "**some markdown**").data.handleDrop(label);
            util.assertXmlEqual(call('createXML'), MARKDOWN_OUTPUT_VALUE_XML, {normalize_xmlns: true});
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

        it("should activate the save button", function() {
            assert(util.saveButtonEnabled(), "save button is disabled");
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

        it("should activate the save button", function() {
            assert(util.saveButtonEnabled(), "save button is disabled");
        });
    });

    it("should not include markdown with vellum:ignore='markdown'", function() {
        util.loadXML(EXPLICIT_NO_MARKDOWN_XML);
        util.assertXmlEqual(call('createXML'), EXPLICIT_NO_MARKDOWN_XML);
    });

    it("should remove markdown when no markdown is specified", function() {
        var form = util.loadXML(SIMPLE_MARKDOWN_XML);
        form.noMarkdown = true;
        util.assertXmlEqual(call('createXML'), EXPLICIT_NO_MARKDOWN_XML);
    });
});
