/*
 * expected structure of a richText widget:
 *
 * <div contenteditable="true">
 *   <p>
 *      User input text
 *   </p>
 * </div>
 *
 * Possible values for user's input text:
 *
 * text
 *
 * newline: <br />
 *
 * rich text "bubble":
 *   <span data-value="xpath" data-output-value=boolean>
 *     <i class="icon">&nbsp;</i>
 *     text to display inside bubble
 *     <i class="close">&times;</i>
 *   </span>
 *
 * Any other HTML has undefined behavior
 */
import chai from "chai";
import $ from "jquery";
import _ from "underscore";
import util from "tests/utils";
import richText from "vellum/richText";
import javaRosa from "vellum/javaRosa/util";
import BURPEE_XML from "static/richText/burpee.xml";
import OUTPUT_REF_XML from "static/richText/output-ref.xml";
import OUTPUT_VALUE_XML from "static/richText/output-value.xml";

var assert = chai.assert,
    call = util.call,
    form,
    CASE_DATA = [{
        id: "commcaresession",
        uri: "jr://instance/session",
        path: "/session/data",
        name: 'Session',
        structure: {
            "case_id": {
                reference: {
                    hashtag: "#case",
                    source: "casedb",
                    subset: "case",
                    subset_key: "@case_type",
                    key: "@case_id",
                },
            },
        },
    }, {
        id: "casedb",
        uri: "jr://instance/casedb",
        path: "/cases/case",
        name: 'Cases',
        structure: {
            name: {},
        },
        subsets: [{
            id: "parent",
            name: "parent",
            key: "@case_type",
            structure: {
                edd: {},
            },
        }, {
            id: "case",
            name: "child",
            key: "@case_type",
            structure: {
                "case": {},
                dob: {},
                f_1065: {},
            },
            related: {
                parent: {
                    hashtag: "#case/parent",
                    subset: "parent",
                    subset_key: "@case_type",
                    key: "@case_id",
                },
            },
        }],
    }];
const ZWSP = "\u200B";

/**
 * Escape zero-width spaces and normalize non-breaking spaces in string
 *
 * If the passed value is a DOM node, it is converted to text.
 * Convert non-breaking space (\u00A0) to normal space to resolve
 * selection.toString() difference between Chrome and Firefox.
 *
 * @param {String or Node} val - String or DOM node to be escaped.
 * @returns String with visible {ZWSP} and NBSP normalized to space
 */
function escape(val) {
    if (val?.nodeType) {
        val = val.textContent;
    }
    return val.replace(/\u200B/g, '{ZWSP}').replace(/\u00A0/g, ' ');
}

function icon(iconClass) {
    if (iconClass.startsWith("fa-")) {
        return $('<i>').addClass(iconClass).html('&nbsp;');
    }
    return $('<i>').addClass('fcc ' + iconClass).html('&nbsp;');
}

function externalIcon () { return icon('fcc-fd-case-property'); }
function externalUnknownIcon () { return icon('fa-solid fa-triangle-exclamation'); }

function makeBubble(xpath, dispValue, icon, internal, id, attrs) {
    var span = $('<span>').addClass('label label-datanode').attr({
        'data-value': xpath,
        'contenteditable': false,
        'data-toggle': 'popover',
        'id': id,
    });
    if (internal && !_.isString(internal)) {
        span.addClass('label-datanode-internal');
    } else if (internal === "case" || form.isValidHashtag(xpath)) {
        span.addClass('label-datanode-external');
    } else if (form.hasValidHashtagPrefix(xpath)) {
        span.addClass('label-datanode-external-unknown');
    } else {
        span.addClass('label-datanode-unknown');
    }
    if (attrs) {
        span.attr(attrs);
    }
    return ZWSP + html(span.append(icon).append(dispValue)) + ZWSP;
}
function outputValueTemplateFn(path) {
    return '<output value="' + path + '"></output>';
}

function wrapWithDiv(el) { return $('<div>').append(el); }
function wrapWithDivP(el) { return wrapWithDiv($('<p>').append(el)); }
function html(value) { return wrapWithDiv(value).html(); }

function setupGlobalForm(done) {
    util.init({
        javaRosa: {langs: ['en']},
        core: {
            dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
            onReady: function () {
                util.addQuestion("Text", "text");
                util.addQuestion("Text", "othertext");
                util.addQuestion("Date", "date");
                util.addQuestion("Group", "group");
                form = this.data.core.form;
                done();
            },
        },
    });
}

function getSpanId(htmlString) {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlString;
    const spanElement = tempElement.querySelector('span[id]');
    return spanElement ? spanElement.id : null;
}

function removeSpanId(htmlString) {
    return htmlString.replace(/<span([^>]*)\s+id="[^"]*"([^>]*)>/g, '<span$1$2>');
}

describe("Rich text utilities", function() {
    before(setupGlobalForm);

    describe("simple conversions", function() {
        // path, display value, icon
        var simpleConversions = [
                ['#form/text', 'text', icon('fcc-fd-text'), true],
                ["#case/case", 'case', externalIcon(), false],
                ["#case/parent/edd", 'edd', externalIcon(), false],
                ["#case/parent/unknown", 'unknown', externalUnknownIcon(), false],
            ],
            opts = {isExpression: true};

        _.each(simpleConversions, function(val) {
            it("from text to html: " + val[0], function() {
                const richTextText = richText.toRichText(val[0], form, opts);
                const expectedHtml = wrapWithDivP(makeBubble(val[0], val[1], val[2], val[3], getSpanId(richTextText))).html();
                assert.strictEqual(richTextText, expectedHtml);
            });

            it("from text to html with output value: " + val[0], function() {
                const richTextText = richText.toRichText(outputValueTemplateFn(val[0]), form);
                const expectedHtml = wrapWithDivP(makeBubble(val[0], val[1], val[2], val[3], getSpanId(richTextText))).html();
                assert.strictEqual(richTextText, expectedHtml);
            });
        });
    });

    describe("date conversions", function() {
        var dates = [
                {
                    xmlValue: "format-date(date(#form/date), '%d/%n/%y')",
                    valueInBubble: '#form/date',
                    bubbleDispValue: 'date',
                    icon: icon('fa-solid fa-calendar-days'),
                    internalRef: true,
                    extraAttrs: {
                        'data-date-format': '%d/%n/%y',
                    }
                },
            ];

        _.each(dates, function(val) {
            it("from text to html with output value: " + val.xmlValue, function() {
                const richTextText = richText.toRichText(outputValueTemplateFn(val.xmlValue), form);
                assert.equal(
                    richTextText,
                    wrapWithDivP(makeBubble(
                        val.valueInBubble,
                        val.bubbleDispValue,
                        val.icon,
                        val.internalRef,
                        getSpanId(richTextText),
                        val.extraAttrs,
                    )).html()
                );
            });
        });

        it("bubble a drag+drop reference", function() {
            var fmt = "%d/%n/%y",
                tag = javaRosa.getOutputRef("#form/text", fmt),
                bubble = richText.toRichText(tag, form);
            assert.strictEqual($(bubble).find('span').data('date-format'), fmt);
        });
    });

    describe("equation conversions", function() {
        var f_1065 = "#case/f_1065",
            ico = icon('fcc-fd-text'),
            opts = {isExpression: true},
            equations = [
                [
                    "#form/text = #form/othertext",
                    makeBubble('#form/text', 'text', ico, true) + " = " +
                    makeBubble('#form/othertext', 'othertext', ico, true)
                ],
                [
                    "#form/text <= #form/othertext",
                    makeBubble('#form/text', 'text', ico, true) + " <= " +
                    makeBubble('#form/othertext', 'othertext', ico, true)
                ],
                [
                    f_1065 + " = " + f_1065,
                    makeBubble(f_1065, 'f_1065', icon('fcc-fd-case-property'), "case") + " = " +
                    makeBubble(f_1065, 'f_1065', icon('fcc-fd-case-property'), "case")
                ],
            ];

        _.each(equations, function(val) {
            it("from text to html: " + val[0], function() {
                assert.strictEqual(
                    removeSpanId(richText.toRichText(val[0], form, opts)),
                    "<p>" + val[1] + "</p>"
                );
            });
        });
    });

    describe("text conversions", function() {
        var widget_html = '<div ' +
            'contenteditable="true" ' +
            'name="property-dataParent" ' +
            'class="form-control jstree-drop fd-input" ' +
            'spellcheck="true" ' +
            'placeholder="Drag question here">' +
            '<span ' +
            'class="label label-datanode label-datanode-external popover-initialized" ' +
            'data-value="#case/dob" ' +
            'contenteditable="false" ' +
            'data-toggle="popover" ' +
            'id="bubble-yalqu945d" ' +
            'data-original-title="" ' +
            'title="" ' +
            '><i class="fcc fcc-fd-case-property">&nbsp;</i></span></div>',
        text = [
            ["blah\nblah", "<p>blah</p><p>blah</p>"],
            ["blah\nblah\n", "<p>blah</p><p>blah</p><p>&nbsp;</p>"],
            [
                "blah\n\nblah\n\n",
                "<p>blah</p><p>&nbsp;</p><p>blah</p><p>&nbsp;</p><p>&nbsp;</p>"
            ],
            [
                "list\n* item\n* item",
                "<p>list</p><p>* item</p><p>* item</p>"
            ],
            [
                "list\n\n* item\n* item",
                "<p>list</p><p></p><p>* item</p><p>* item</p>"
            ],
            [
                "list\n\n\n* item\n* item",
                "<p>list</p><p></p><p></p><p>* item</p><p>* item</p>"
            ],
            [" ", " "],
            ["   ", " \xa0 "],
            ["   ", " &nbsp; "],
            ['This dob: <output value="#case/dob" /> is of child', 'This dob:&nbsp;' + widget_html + ' is of child'],
            ['This dob: <output value="#case/dob" />', 'This dob:&nbsp;' + widget_html],
            ['<output value="#case/dob" /> is of child', widget_html + ' is of child'],
            ['<output value="#case/dob" />', widget_html],
            ['This dob: <output value="#case/dob" /> is of child', 'This dob: &lt;output value="#case/dob" /&gt; is of child'],
        ];

        _.each(text, function(val){
            it("from html to text: " + JSON.stringify(val[1]), function() {
                assert.strictEqual(removeSpanId(richText.fromRichText(val[1])), val[0]);
            });
        });

        _.each(text, function(val){
            it("(text -> html -> text): " + JSON.stringify(val[0]), function() {
                assert.strictEqual(
                    removeSpanId(richText.fromRichText(richText.toRichText(val[0], form))),
                    val[0]
                );
            });
        });
    });

    describe("doesn't convert", function() {
        var nonConversions = [
                "instance('casedb')/cases/case[" +
                    "@case_id = instance('casedb')/cases/case[" +
                        "@case_id = instance('commcaresession')/session/data/case_id" +
                    "]/index/parent]/edd[@other = 'blah']",
                "/data/group[@prop = 'something']",
                "instance('casedb')/cases/case[@case_id = /data/blah]",
            ],
            opts = {isExpression: true};

        _.each(nonConversions, function(val) {
            it("from text to html: " + val, function() {
                assert.strictEqual(
                    richText.toRichText(val, form, opts),
                    "<p>" + val + "</p>"
                );
            });
        });
    });

    describe("convert value with output and escaped HTML", function () {
        var items = [
                ['<h1><output value="#form/text" /></h1>',
                 '&lt;h1&gt;{text}&lt;/h1&gt;'],
                ['<output value="#form/text" /> <tag /> <output value="#form/othertext" />',
                 '{text} &lt;tag /&gt; {othertext}'],
                ["{blah}", "{blah}"],
                ['<output value="unknown(#form/text)" />', '&lt;output value="unknown(#form/text)" /&gt;'],
                ['<output value="#form/text + now()" />', '&lt;output value="#form/text + now()" /&gt;'],
                ['<output value="concat(1, 2" />', '&lt;output value="concat(1, 2" /&gt;'],
                ['<output value="#form/question,\'-label\')" />',
                 '&lt;output value="#form/question,\'-label\')" /&gt;'],
                ['<output />', '&lt;output /&gt;'],
            ],
            ico = icon('fcc-fd-text');

        _.each(items, function (item) {
            it("to text: " + item[0], function () {
                var result = removeSpanId(richText.bubbleOutputs(item[0], form, true)),
                    expect = item[1].replace(/{(.*?)}/g, function (m, name) {
                        if (form.getIconByPath("#form/" + name)) {
                            return makeBubble("#form/" + name, name, ico, true);
                        }
                        return m;
                    });
                assert.equal(escape(result), escape(expect));
            });
        });
    });

    describe("serialize formats correctly", function () {
        it("should handle output refs", function() {
            assert.equal(richText.applyFormats({
                value: "#case/f_2685",
            }), '&lt;output value="#case/f_2685" /&gt;');
        });

        it("should handle dates", function() {
            assert.equal(richText.applyFormats({
                dateFormat: "%d/%n/%y",
                value: "#form/question1",
            }), '&lt;output value="format-date(date(#form/question1), \'%d/%n/%y\')" /&gt;');
        });
    });

    describe("invalid xpath unescaper", function () {
        it("should pass through xpath not marked as invalid", function() {
            assert.equal(richText.unescapeXPath("/data/valid", form), "/data/valid");
        });

        _.each({
            "#invalid/xpath `#form/text` xpath": "/data/text xpath",
            "#invalid/xpath `#form/text`xpath": "/data/text xpath",
        }, function (expect, expr) {
            it("should unescape invalid xpath: " + expr + " -> " + expect, function() {
                assert.equal(richText.unescapeXPath(expr, form), expect);
            });
        });
    });
});

describe("The rich text editor", function () {
    before(setupGlobalForm);

    describe("", function() {
        var el = $(
                "<div id='cktestparent'>" +
                    "<div contenteditable></div>" +
                    "<div contenteditable></div>" +
                "</div>"),
            options = {isExpression: false},
            input, editor, exprInput, exprEditor;
        before(function (done) {
            $("body").append(el);
            input = el.children().first();
            editor = richText.editor(input, form, options);
            exprInput = $(el.children()[1]);
            exprEditor = richText.editor(exprInput, form, {isExpression: true});
            // wait for editor to be ready; necessary to change selection
            input.promise.then(function () {
                exprInput.promise.then(function () { done(); });
            });
        });
        beforeEach(function (done) {
            editor.setValue("", function () {
                exprEditor.setValue("", function () { done(); });
            });
        });
        after(function () {
            editor.destroy();
            exprEditor.destroy();
            assert.equal($("#cktestparent").length, 1);
            el.remove();
            assert.equal($("#cktestparent").length, 0);
        });

        it("should be accessible via various jquery paths", function (done) {
            var v0 = editor,
                v1 = richText.editor(input);
            assert.equal(v0, v1);
            v0.setValue("test", function () {
                assert.equal(v1.getValue(), "test");
                var div = $("#cktestparent").children().first();
                assert.equal(richText.editor(div), v0);
                done();
            });
        });

        it("should return just-set value on get value", function () {
            var text = '<output value="#form/text" />';
            assert.notEqual(editor.getValue(), text);
            editor.setValue(text);
            assert.equal(editor.getValue(), text);
        });

        it("should create output on insert expression into label editor", function (done) {
            var output = '<output value="#form/text" />';
            editor.setValue('one two', function () {
                assert.equal(editor.getValue(), 'one two');
                editor.select(3);
                editor.insertExpression("#form/text");
                assert.equal(editor.getValue(), "one" + output + "  two");
                done();
            });
        });

        it("should insert output into label editor", function (done) {
            var output = '<output value="#form/text" />';
            editor.setValue('one two', function () {
                assert.equal(editor.getValue(), 'one two');
                editor.select(3);
                editor.insertOutput(output);
                assert.equal(editor.getValue(), "one" + output + " two");
                done();
            });
        });

        it("should not copy output value from label to expression editor", function (done) {
            var output = '<output value="#form/text" />';
            editor.setValue(output, function () {
                assert.equal(editor.getValue(), output);
                var copyVal = input[0].innerHTML;
                assert(/^<p>​<span .*<.span>​<.p>​$/.test(copyVal), copyVal); // string contains zero width space
                exprInput[0].innerHTML = copyVal;
                assert.equal(exprEditor.getValue(), "#form/text");
                done();
            });
        });

        it("should copy output value from expression editor to label", function (done) {
            exprEditor.setValue("#form/text", function () {
                assert.equal(exprEditor.getValue(), "#form/text");
                var copyVal = exprInput[0].innerHTML;
                assert(/^<p>​<span .*<.span>​<.p>​$/.test(copyVal), copyVal); // string contains zero width space
                input[0].innerHTML = copyVal;
                assert.equal(editor.getValue(), '<output value="#form/text" />');
                done();
            });
        });

        it("should not paste style content into editor", function () {
            var html = '<style type="text/css"><!--td--></style><span>A</span>';
            input[0].focus();
            document.execCommand('insertHTML', false, html);
            assert.equal(editor.getValue(), 'A');
        });

        function assertCopy($editor, value) {
            const dataTransfer = new DataTransfer();
            const clipboardEvent = new ClipboardEvent('copy', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            $editor[0].dispatchEvent(clipboardEvent);

            assert.equal(dataTransfer.getData('text/plain'), value);
            assert.strictEqual(dataTransfer.getData("text/html"), '');
        }

        var TEST_LABEL = 'Weight: <output value="#form/text" /> grams',
            TEST_XPATH = "if(today() + (#case/dob - 3), #form/text, 0)";

        it("should copy output tag from rich text editor", function (done) {
            editor.setValue(TEST_LABEL, function () {
                editor.select(6, 4);
                assertCopy(input, ': <output value="#form/text" />');
                done();
            });
        });

        it("should copy expression with hashtags from expression editor", function (done) {
            exprEditor.setValue(TEST_XPATH, function () {
                exprEditor.select(11, 5);
                assertCopy(exprInput, "+ (#case/dob");
                done();
            });
        });

        // const OUTPUT = '<output value="#form/text" />';
        // const START_LABEL = TEST_LABEL.replace(OUTPUT, 'XXXX');
        const START_PATH = TEST_XPATH.replace('#case/dob', 'XXXX');
        _.each([
            /* No idea why these fail intermittently
            [0, START_LABEL, 8, 4, {text: OUTPUT}],
            [0, START_LABEL, 8, 4, {text: OUTPUT + " > 3"}],
            [0, START_LABEL, 8, 4, {text: "4 pounds\n\nLines..."}],
            */
            [1, START_PATH, 14, 4, {text: "#case/dob"}],
            [1, START_PATH, 11, 7, {text: "+ (#case/dob"}],
            [1, START_PATH, 11, 7, {text: "< (#case/dob"}],
            [1, START_PATH, 11, 7, {html: "<span>+ (#case/dob</span>"}],
            [1, START_PATH, 11, 7, {html: "<meta charset='utf-8'>+ (#case/dob"}],
        ], function (args) {
            const inputFlag = args[0];
            const initialExpr = args[1];
            const selStart = args[2];
            const selLength = args[3];
            const pasteValue = args[4];
            const pasteText = pasteValue.text ||
                pasteValue.html.replace(/<.*?>/g, '');
            const pasteRepr = JSON.stringify(pasteValue);
            const type = inputFlag ? "expression" : "text";
            const opts = {isExpression: true};
            it("should paste " + type + ": " + pasteRepr, function (done) {
                const input_ = inputFlag ? exprInput : input;
                const editor = richText.editor(input_);
                const find = initialExpr.substring(selStart, selStart + selLength);
                editor.setValue(initialExpr, function () {
                    editor.select(selStart, selLength);

                    const dataTransfer = new DataTransfer();
                    if (pasteValue.text) {
                        dataTransfer.setData('text/plain', pasteText);
                    } else {
                        dataTransfer.setData('text/html', pasteText);
                    }
                    const clipboardEvent = new ClipboardEvent('paste', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true
                    });
                    input_[0].dispatchEvent(clipboardEvent);

                    const text = removeSpanId(input_[0].innerHTML);
                    const expText = removeSpanId(richText
                        .toRichText(initialExpr, form, opts)
                        .replace(find, escapeHTML(pasteText)) + ZWSP);
                    assert.equal(escape(text), escape(expText));
                    assert.equal(editor.getValue(),
                        initialExpr.substring(0, selStart) + pasteText +
                        initialExpr.substring(selStart + selLength));
                    done();
                });
            });
        });

        function escapeHTML(html) {
            var reps = {'<': '&lt;', '>': '&gt;', '"': '&quot;', '\n': '<br />'};
            return html.replace(/[<>"&\n]/g, function (match) {
                return reps[match];
            });
        }

        function applyArgs(func) {
            return function (args) {
                return func.apply(this, args);
            };
        }
        var argsets = [
            ["= two", 0, "#form/text = two"],
            ["one two", 3, "#invalid/xpath one`#form/text`  two"],
            ["one two", 4, "#invalid/xpath one `#form/text` two"],
            ["one\n\ntwo", 3, "#invalid/xpath one`#form/text` \n\ntwo"],
            ["one\n\ntwo", 4, "#invalid/xpath one\n`#form/text` \ntwo"],
            ["one``two", 4, "#invalid/xpath one```#form/text` ``two"],
            ["`one  two", 5, "#invalid/xpath ``one `#form/text`  two"],
            // end padding added to work around bug in exprEditor.select(i)
            ["one =  ", 6, "one = #form/text  "],
            // TODO I think exprEditor.select(i) is breaking this one
            //["one\n\ntwo", 5, "#invalid/xpath one\n\n`#form/text` two"],
        ];

        _.each(argsets, applyArgs(function (expr, i, result) {
            var repr = JSON.stringify(result);
            it("should insert expression into expression at " + i + ": " + repr, function (done) {
                exprEditor.setValue(expr, function () {
                    assert.equal(exprEditor.getValue(), expr);
                    exprEditor.select(i);
                    exprEditor.insertExpression('#form/text');
                    assert.equal(exprEditor.getValue(), result);
                    done();
                });
            });
        }));

        _.each(argsets, applyArgs(function (expr, i, result) {
            var repr = JSON.stringify(result);
            it("should make bubbles on converting to rich text: " + repr, function () {
                var text = richText.toRichText(result, form, {isExpression: true}),
                    bubble = makeBubble('#form/text', 'text', icon('fcc-fd-text'), true),
                    expected = (expr.slice(0, i) + bubble + " " + expr.slice(i)),
                    expected2 = expected
                        .replace(/  $/, "")  // HACK for "one =  "
                        .replace(/  /g, " &nbsp;")
                        .replace(/\n/g, "</p><p>");
                assert.equal(removeSpanId(text), "<p>" + expected2 + "</p>");
            });
        }));

        describe("bubble selection", function () {

            it("should select bubble atom on mousedown", function (done) {
                exprEditor.setValue("#form/text", function () {
                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));

                    const selection = window.getSelection();
                    assert.equal(selection.rangeCount, 1, "selection range count");
                    const range = selection.getRangeAt(0);
                    assert.equal(
                        escape(range.toString()),
                        escape(`${ZWSP} text${ZWSP}`),
                        "selection covers leading ZWSP, bubble text, trailing ZWSP"
                    );
                    done();
                });
            });

            it("should mark a bubble as selected while the selection covers it", function (done) {
                exprEditor.setValue("#form/text", function () {
                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    document.dispatchEvent(new Event('selectionchange'));
                    assert.isTrue(bubble.classList.contains('selected'), "marked on click");

                    const tail = exprInput[0].lastChild;
                    window.getSelection().setBaseAndExtent(tail, 0, tail, 0);
                    document.dispatchEvent(new Event('selectionchange'));
                    assert.isFalse(bubble.classList.contains('selected'), "unmarked when selection moves away");
                    done();
                });
            });

            it("should not orphan a neighbor bubble when an adjacent bubble is deleted", function (done) {
                exprEditor.setValue("#invalid/xpath `#form/text``#form/othertext`", function () {
                    const before = exprInput[0].querySelectorAll('.label-datanode');
                    assert.equal(before.length, 2, "precondition: two bubbles");
                    const [first] = before;
                    first.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    window.getSelection().getRangeAt(0).deleteContents();
                    exprInput[0].dispatchEvent(new Event('input', {bubbles: true}));
                    const after = exprInput[0].querySelectorAll('.label-datanode');
                    assert.equal(after.length, 1, "only the clicked bubble is removed");
                    done();
                });
            });

            it("should copy a selected bubble as its hashtag", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    assertCopy(exprInput, "#form/text");
                    done();
                });
            });

            it("should cut a selected bubble leaving no orphan ZWSP", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));

                    const dataTransfer = new DataTransfer();
                    exprInput[0].dispatchEvent(new ClipboardEvent('cut', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true,
                    }));

                    assert.equal(dataTransfer.getData('text/plain'), "#form/text");
                    assert.equal(exprEditor.getValue(), "1 +  + 2");
                    done();
                });
            });

            it("should paste a copied bubble", function (done) {
                exprEditor.setValue("1 + #form/old + 2", function () {
                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));

                    const dataTransfer = new DataTransfer();
                    dataTransfer.setData('text/plain', '#form/new');
                    exprInput[0].dispatchEvent(new ClipboardEvent('paste', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true,
                    }));
                    assert.equal(exprEditor.getValue(), '1 + #form/new + 2');

                    // get -> set (reload) to convert hashtag to bubble
                    exprEditor.setValue(exprEditor.getValue(), function () {
                        assert.equal(exprInput[0].querySelectorAll('.label-datanode').length, 1);
                        done();
                    });
                });
            });

            it("should extend selection past bubble on shift+click", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const firstText = exprInput[0].querySelector('p').firstChild;
                    window.getSelection().setBaseAndExtent(firstText, 0, firstText, 0);

                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        shiftKey: true,
                    }));

                    const selection = window.getSelection();
                    assert.equal(escape(selection.toString()), "1 + {ZWSP} text{ZWSP}", "unexpected selection");
                    assert.equal(escape(selection.focusNode), "{ZWSP} + 2", "unexpected focus");
                    done();
                });
            });

            it("should extend selection backward past bubble on shift+click", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const paragraph = exprInput[0].querySelector('p');
                    const trailingText = paragraph.childNodes[2];
                    // Anchor just past the bubble's trailing ZWSP, selection extends to end.
                    window.getSelection().setBaseAndExtent(
                        trailingText, 3, trailingText, trailingText.nodeValue.length
                    );

                    const bubble = exprInput[0].querySelector('.label-datanode');
                    bubble.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true,
                        shiftKey: true,
                    }));

                    const selection = window.getSelection();
                    assert.equal(escape(selection.toString()), "{ZWSP} text{ZWSP} +", "unexpected selection");
                    assert.equal(escape(selection.focusNode), "1 + {ZWSP}", "unexpected focus");
                    done();
                });
            });

            it("should clean up neighbor bubble whose ZWSP boundary was clipped by cut", function (done) {
                exprEditor.setValue("#invalid/xpath `#form/text``#form/othertext`", function () {
                    const bubbles = exprInput[0].querySelectorAll('.label-datanode');
                    assert.equal(bubbles.length, 2, "precondition: two bubbles");
                    const [first] = bubbles;
                    first.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    // Extend the selection to consume both ZWSPs between the bubbles,
                    // clipping the second bubble's leading ZWSP.
                    window.getSelection().getRangeAt(0).setEnd(first.nextSibling, 2);

                    const dataTransfer = new DataTransfer();
                    exprInput[0].dispatchEvent(new ClipboardEvent('cut', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true,
                    }));
                    assert.equal(dataTransfer.getData('text/plain'), "#form/text#form/othertext");

                    assert.equal(
                        exprInput[0].querySelectorAll('.label-datanode').length, 0,
                        "the neighbor with broken ZWSP boundary is also removed"
                    );
                    done();
                });
            });

            it("should clean up neighbor bubble whose ZWSP boundary was clipped by paste", function (done) {
                exprEditor.setValue("#invalid/xpath `#form/text``#form/othertext`", function () {
                    const bubbles = exprInput[0].querySelectorAll('.label-datanode');
                    assert.equal(bubbles.length, 2, "precondition: two bubbles");
                    const [first] = bubbles;
                    first.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    window.getSelection().getRangeAt(0).setEnd(first.nextSibling, 2);

                    const dataTransfer = new DataTransfer();
                    dataTransfer.setData('text/plain', 'X');
                    exprInput[0].dispatchEvent(new ClipboardEvent('paste', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true,
                    }));

                    assert.equal(
                        exprInput[0].querySelectorAll('.label-datanode').length, 0,
                        "the neighbor with broken ZWSP boundary is also removed"
                    );
                    done();
                });
            });

            it("should extend selection past whole bubble on shift+ArrowRight", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const paragraph = exprInput[0].querySelector('p');
                    const firstText = paragraph.firstChild;
                    // Select two chars before the bubble's leading ZWSP.
                    exprInput[0].focus();
                    const sel = window.getSelection();
                    sel.setBaseAndExtent(firstText, 2, firstText, 4);
                    assert.equal(escape(sel.toString()), "+ ", "precondition failed");
                    // Simulate the browser's default one-char extension into the boundary.
                    sel.extend(firstText, firstText.nodeValue.length);
                    assert.equal(escape(sel.toString()), "+ {ZWSP}", "precondition failed");

                    exprInput[0].dispatchEvent(new KeyboardEvent('keyup', {
                        key: 'ArrowRight',
                        shiftKey: true,
                        bubbles: true,
                    }));

                    const selection = window.getSelection();
                    assert.equal(escape(selection.toString()), "+ {ZWSP} text{ZWSP}", "unexpected selection");
                    assert.equal(escape(selection.focusNode), "{ZWSP} + 2", "unexpected focus");
                    done();
                });
            });

            it("should extend selection past whole bubble on shift+ArrowLeft", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const paragraph = exprInput[0].querySelector('p');
                    const trailingText = paragraph.childNodes[2];
                    // Select two chars after the bubble's trailing ZWSP, focus on the left.
                    exprInput[0].focus();
                    const sel = window.getSelection();
                    sel.setBaseAndExtent(trailingText, 3, trailingText, 1);
                    assert.equal(escape(sel.toString()), " +", "precondition failed");
                    // Simulate the browser's default one-char extension into the boundary.
                    sel.extend(trailingText, 0);
                    assert.equal(escape(sel.toString()), "{ZWSP} +", "precondition failed");

                    exprInput[0].dispatchEvent(new KeyboardEvent('keyup', {
                        key: 'ArrowLeft',
                        shiftKey: true,
                        bubbles: true,
                    }));

                    const selection = window.getSelection();
                    assert.equal(escape(selection.toString()), "{ZWSP} text{ZWSP} +", "unexpected selection");
                    assert.equal(escape(selection.focusNode), "1 + {ZWSP}", "unexpected focus node");
                    done();
                });
            });

            it("should snap to atomic boundary when selection ends in bubble node", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const paragraph = exprInput[0].querySelector('p');
                    const firstText = paragraph.firstChild;
                    // bubbleText is 'text' node in <span><i>&nbsp;</i>text</span>
                    const bubbleText = paragraph.childNodes[1].childNodes[1];
                    // Simulate post-extension state: focus lies between leading ZWSP and bubble
                    // (e.g., after a Ctrl+Shift+ArrowRight word jump).
                    exprInput[0].focus();
                    const sel = window.getSelection();
                    sel.setBaseAndExtent(firstText, 0, bubbleText, 0);
                    assert.equal(escape(sel.toString()), "1 + {ZWSP}", "precondition failed");

                    exprInput[0].dispatchEvent(new KeyboardEvent('keyup', {
                        key: 'ArrowRight',
                        shiftKey: true,
                        ctrlKey: true,
                        bubbles: true,
                    }));

                    const selection = window.getSelection();
                    assert.equal(escape(selection.toString()), "1 + {ZWSP} text{ZWSP}", "unexpected selection");
                    assert.equal(escape(selection.focusNode), "{ZWSP} + 2", "unexpected focus");
                    done();
                });
            });

            it("should snap to atomic boundary when (reverse) selection ends in bubble node", function (done) {
                exprEditor.setValue("1 + #form/text + 2", function () {
                    const paragraph = exprInput[0].querySelector('p');
                    const trailingText = paragraph.childNodes[2];
                    // Simulate post-extension state: focus lies between bubble and trailing ZWSP.
                    exprInput[0].focus();
                    const sel = window.getSelection();
                    sel.setBaseAndExtent(trailingText, trailingText.nodeValue.length, trailingText, 0);
                    assert.equal(escape(sel.toString()), "{ZWSP} + 2", "precondition failed");

                    exprInput[0].dispatchEvent(new KeyboardEvent('keyup', {
                        key: 'ArrowLeft',
                        shiftKey: true,
                        ctrlKey: true,
                        bubbles: true,
                    }));

                    const selection = window.getSelection();
                    assert.equal(escape(selection.toString()), "{ZWSP} text{ZWSP} + 2", "unexpected selection");
                    assert.equal(escape(selection.focusNode), "1 + {ZWSP}", "unexpected focus");
                    done();
                });
            });
        });
    });

    describe("in vellum", function() {
        var widget;

        describe("", function () {
            beforeEach(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    form: "",
                    core: {
                        onReady: function() {
                            util.addQuestion("Text", 'text');
                            widget = util.getWidget('itext-en-label');
                            widget.input.promise.then(function () { done(); });
                        }
                    },
                    features: {rich_text: true},
                });
            });

            it("should show the markdown preview", function(done) {
                var super_handleChange = widget.handleChange;
                function handleChange() {
                    super_handleChange();
                    assert($('.has-markdown').length);
                    done();
                }
                widget.setValue('# blah', handleChange);
            });

            it("should allow editing of validation message", function () {
                var mug = util.getMug('text'),
                    msg = $('[name=itext-en-constraintMsg]');
                mug.p.constraintAttr = '.';
                msg.focus();
                assert(msg[0].isContentEditable);
            });

            it("should not write empty attributes", function () {
                util.loadXML(BURPEE_XML);
                var mug = util.getMug('total_num_burpees');
                mug.p.relevantAttr = '';
                util.assertXmlEqual(call('createXML'), BURPEE_XML);
            });

            it("cursor should be at end of input on focus", function () {
                var value = 'testing cursor';
                widget.setValue(value);
                // Make sure focus is elsewhere, then focus on the rich text input
                util.focus($('[name=property-nodeID]'));
                util.focus(widget.input);
                var selection = window.getSelection();
                assert.exists(selection);
                var range = selection.getRangeAt(0);
                assert.exists(range);
                assert.isTrue(range.collapsed);
                assert.strictEqual(range.startContainer, range.startContainer.parentNode.lastChild);
                assert.strictEqual(range.startContainer.textContent, ZWSP);
            });


            it("should change output ref to output value", function () {
                util.loadXML(OUTPUT_REF_XML);
                util.assertXmlEqual(call('createXML'), OUTPUT_VALUE_XML);
            });

            it("should bubble various case properties", async function () {
                util.loadXML("");
                var widget = util.getWidget('itext-en-label'),
                    $widget = $(".fd-textarea[name='itext-en-label']");
                await widget.input.promise;
                widget.setValue('<output value="#case/not_a_child" />' +
                    '<output value="#form/not_a_thing" />' +
                    '<output value="#case/dob" />'
                );
                assert.strictEqual($widget.find(".label-datanode-external-unknown").text().trim(), 'not_a_child');
                assert.strictEqual($widget.find(".label-datanode-external").text().trim(), 'dob');
                assert.strictEqual($widget.find(".label-datanode-unknown").text().trim(), 'not_a_thing');
            });

            it("should have native spellchecking on labels", function () {
                assert.strictEqual($('[name=itext-en-label]').attr('spellcheck'), 'true');
            });

            it("should not have native spellchecking on xpaths", function () {
                assert.strictEqual($('[name=property-relevantAttr]').attr('spellcheck'), 'false');
            });
        });

        describe("popovers", function () {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    form: "",
                    core: { onReady: function () { done(); } },
                    features: {
                        rich_text: true,
                        disable_popovers: false,
                    },
                });
            });

            const editorUpDelay = 500;

            it("should not change saved state", function (done) {
                util.loadXML(BURPEE_XML);
                assert(!util.saveButtonEnabled(), "Save button should not be enabled");
                util.clickQuestion("total_num_burpees");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    assert(!util.saveButtonEnabled(), "Save button should not be enabled");
                    done();
                });
            });

            it("should show xpath and tree reference link on popover", function (done) {
                util.loadXML(BURPEE_XML);
                util.clickQuestion("total_num_burpees");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content').last();
                            assert.strictEqual($popover.find('p').first().text(),
                                               "How many burpees did you do on #form/new_burpee_data/burpee_date ?");
                            var $link = $popover.find("a");
                            assert($link.length);
                            $link.click();
                            assert.strictEqual($(".jstree-hovered").length, 1);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should expand tree on click show in question list", function (done) {
                util.paste([
                    ["id", "type", "relevantAttr"],
                    ["/group", "Group", "null"],
                    ["/group/text", "Text", "null"],
                    ["/text", "Text", '#form/group/text'],
                ]);
                var group = util.getMug("group");
                util.collapseGroup(group);
                util.clickQuestion("text");
                var widget = util.getWidget('property-relevantAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last');
                            var $link = $popover.find("a");
                            assert.strictEqual($(".jstree-hovered").length, 0);
                            assert($link.length);
                            $link.click();
                            assert.strictEqual($(".jstree-hovered").length, 1);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should show case property description on popover", function (done) {
                util.loadXML();
                var mug = util.addQuestion("Text", "text");
                mug.p.calculateAttr = "#case/dob";
                util.clickQuestion("text");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last');
                            assert.equal($popover.find('p:first').text(), "Date of Birth");
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should split long text in case property descriptions", function (done) {
                util.loadXML();
                var mug = util.addQuestion("Text", "text");
                mug.p.calculateAttr = "#case/long";
                let expected = "Property with a_very_long_word_in_the_description_that_ex\n\nceeds_43_chars";
                util.clickQuestion("text");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last');
                            assert.equal($popover.find('p:first').text(), expected);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should destroy popover when moving mouse away", function (done) {
                util.loadXML(BURPEE_XML);
                util.clickQuestion("total_num_burpees");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last p:first');
                            assert.strictEqual($popover.text(),
                                "How many burpees did you do on #form/new_burpee_data/burpee_date ?");

                            bubble.mouseleave();
                            // popover destroy just fades the popover
                            assert.strictEqual($('.popover:not(.fade)').length, 0);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should expand tree on click show in question list", function (done) {
                util.paste([
                    ["id", "type", "relevantAttr"],
                    ["/group", "Group", "null"],
                    ["/group/text", "Text", "null"],
                    ["/text", "Text", '#form/group/text'],
                ]);
                var group = util.getMug("group");
                util.collapseGroup(group);
                util.clickQuestion("text");
                var widget = util.getWidget('property-relevantAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last');
                            var $link = $popover.find("a");
                            assert.strictEqual($(".jstree-hovered").length, 0);
                            assert($link.length);
                            $link.click();
                            assert.strictEqual($(".jstree-hovered").length, 1);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should show case property description on popover", function (done) {
                util.loadXML();
                var mug = util.addQuestion("Text", "text");
                mug.p.calculateAttr = "#case/dob";
                util.clickQuestion("text");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last');
                            assert.equal($popover.find('p:first').text(), "Date of Birth");
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should split long text in case property descriptions", function (done) {
                util.loadXML();
                var mug = util.addQuestion("Text", "text");
                mug.p.calculateAttr = "#case/long";
                let expected = "Property with a_very_long_word_in_the_description_that_ex\n\nceeds_43_chars";
                util.clickQuestion("text");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last');
                            assert.equal($popover.find('p:first').text(), expected);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should destroy popover on destroy widget", function (done) {
                util.loadXML(BURPEE_XML);
                util.clickQuestion("total_num_burpees");
                var widget = util.getWidget('property-calculateAttr');
                widget.input.promise.then(function () {
                    var bubble = $('div[contenteditable="true"] [data-toggle="popover"]').first();
                    assert(bubble.length, "No bubbles detected");
                    $(document).one('shown.bs.popover', function() {
                        try {
                            var $popover = $('.popover-content:last p:first');
                            assert.strictEqual($popover.text(),
                                "How many burpees did you do on #form/new_burpee_data/burpee_date ?");

                            widget.input.data("editorWrapper").destroy();
                            // popover destroy just fades the popover
                            assert.strictEqual($('.popover:not(.fade)').length, 0);
                            done();
                        } finally {
                            $(".popover").remove();
                        }
                    });
                    setTimeout(function() {
                        bubble.mouseenter();
                    }, editorUpDelay);
                });
            });

            it("should not error on unknown question ref", function (done) {
                util.loadXML("");
                util.addQuestion("Text", "text");
                var widget = util.getWidget('property-relevantAttr'),
                    editor = richText.editor(widget.input);
                setTimeout(function() {
                    editor.setValue("#form/unknown");
                    done();
                }, editorUpDelay);
            });

            describe("for date references", function () {
                var widget;
                before(function (done) {
                    util.loadXML("");
                    util.paste([
                        ["id", "type", "labelItext:en-default"],
                        ["/date", "Date", "dob"],
                        ["/text", "Text", ""],
                    ]);
                    util.clickQuestion("text");
                    widget = util.getWidget('itext-en-label');
                    widget.input.promise.then(done);
                });

                _.each({
                    "#form/date": "#form/date (no formatting)",

                    "format-date(date(#form/date), '%e/%n/%y')":
                        "#form/date (d/m/yy)",

                    "format-date(date(#form/date), '%a, %b %e, %Y')":
                        "#form/date (ddd, mmm d, yyyy)",

                }, function (desc, xpath) {
                    it("should show " + desc + " on popover", function (done) {
                        var editor = richText.editor(widget.input),
                            output = '<output value="' + xpath + '" />';
                        editor.setValue(output, function () {
                            var bubble = widget.input
                                    .find('[data-toggle="popover"]').first(),
                                $desc;
                            assert(bubble.length, "No bubbles detected");

                            $(document).one('shown.bs.popover', function() {
                                $desc = $('.popover-title .text-muted');
                                try {
                                    assert.equal($desc.text(), desc);

                                    // check for format selector link
                                    assert.equal($desc.find('a').text(), /\((.*)\)/.exec(desc)[1]);
                                    done();
                                } finally {
                                    $(".popover").remove();
                                }
                            });

                            bubble.mouseenter();
                        });
                    });
                });
            });
        });
    });
});

describe("htmlToFragment", function() {
    it("should convert a single tag", function() {
        var html = '<p>one</p>';
        var fragment = richText.htmlToFragment(html);
        const div = document.createElement('div');
        div.appendChild(fragment);
        assert.equal(div.innerHTML, html);
    });

    it("should mark spans as contenteditable=false", function() {
        var html = '<span contenteditable="false">one</span>';
        var fragment = richText.htmlToFragment('<span>one</span>');
        const div = document.createElement('div');
        div.appendChild(fragment);
        assert.equal(div.innerHTML, html);
    });

    it("should convert mulitple tags", function() {
        var html = '<p>one</p><span contenteditable="false">one</span>';
        var fragment = richText.htmlToFragment('<p>one</p><span>one</span>');
        const div = document.createElement('div');
        div.appendChild(fragment);
        assert.equal(div.innerHTML, html);
    });

    it("should work with zwsp", function() {
        var htmlInput = '​<span class="label label-datanode label-datanode-internal" data-value="#form/text" contenteditable="false" data-toggle="popover" id="bubble-ga3iiwmw"><i class="fcc fcc-fd-text">&nbsp;</i>text</span>​'; // string contains zero width space
        var fragment = richText.htmlToFragment(htmlInput);
        const div = document.createElement('div');
        div.append(fragment);

        assert.equal(div.childNodes.length, 3);
        assert.equal(div.innerHTML, '​<span class="label label-datanode label-datanode-internal" data-value="#form/text" contenteditable="false" data-toggle="popover" id="bubble-ga3iiwmw"><i class="fcc fcc-fd-text">&nbsp;</i>text</span>​'); // string contains zero width space
    });


});
