/*
 * expected structure of a richText widget:
 *
 * <div contenteditable="true" ... ckeditor stuff...>
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
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/richText',
    'vellum/javaRosa',
    'vellum/bananas',
    'ckeditor',
    'text!static/richText/burpee.xml',
], function(
    chai,
    $,
    _,
    util,
    richText,
    javaRosa,
    bananas,
    CKEDITOR,
    BURPEE_XML
) {
    var assert = chai.assert,
        hashtagToXPath = {},
        formShim = {
            normalizeBanana: function (path) {
                 return path;
             },
            transform: function (path) {
                return bananas.transform(path, function (path) {
                    var mug = formShim.getMugByPath(path),
                        icon_ = mug ? icon(mug.options.icon) : externalIcon();
                    return $('<div>').html(makeBubble("🍌" + path + "🍌", path.split('/').slice(-1)[0], icon_, !!mug)).html();
                });
            },
            getMugByPath: function(path) {
                if (path.startsWith("🍌")) {
                    path = path.slice(2);
                }
                if (path.endsWith("🍌")) {
                    path = path.slice(0, -2);
                }
                return {
                    "#form/text": {
                        options: { icon: 'fcc fcc-fd-text' },
                    },
                    "#form/othertext": {
                        options: { icon: 'fcc fcc-fd-text' },
                    },
                    "#form/date": {
                        options: { icon: 'fcc fa fa-calendar' },
                    },
                    "#form/group": {
                        options: { icon: 'fcc icon-folder-open' },
                    },
                }[path];
            },
            xpath: bananas.Parser(hashtagToXPath),
        };

    function icon(iconClass) { 
        return $('<i>').addClass('fcc ' + iconClass).html('&nbsp;');
    }

    function externalIcon () { return icon('fcc-fd-external-case'); }

    function bubbleSpan(xpath, internal, output) {
        var span = $('<span>').addClass('label label-datanode').attr({
            'data-value': xpath,
            'data-output-value': output,
        });
        if (internal) {
            span.addClass('label-datanode-internal');
        } else {
            span.addClass('label-datanode-external');
        }
        return span;
    }

    function makeBubble(xpath, dispValue, icon, internal, output) {
        return bubbleSpan(xpath, internal, output || false).append(icon).append(dispValue);
    }
    function outputValueTemplateFn(path) {
        return '<output value="' + path + '"></output>';
    }

    function makeOutputValue(xpath, dispValue, icon, internal) {
        return makeBubble(xpath, dispValue, icon, internal, true);
    }

    function wrapWithDiv(el) { return $('<div>').append(el); }
    function wrapWithDivP(el) { return wrapWithDiv($('<p>').append(el)); }

    describe("Rich text utilities", function() {
        describe("simple conversions", function() {
            // path, display value, icon
            var simpleConversions = [
                    ['🍌#form/text🍌', 'text', icon('fcc-fd-text'), true],
                    ["🍌#case/child/case🍌", 'case', externalIcon(), false],
                    ["🍌#case/mother/edd🍌", 'edd', externalIcon(), false]
                ],
                opts = {isExpression: true};

            _.each(simpleConversions, function(val) {
                it("from text to html: " + val[0], function() {
                    assert.strictEqual(
                        richText.toRichText(val[0], formShim, opts),
                        wrapWithDivP(makeBubble(val[0], val[1], val[2], val[3])).html()
                    );
                });

                it("from text to html with output value: " + val[0], function() {
                    assert.strictEqual(
                        richText.toRichText(outputValueTemplateFn(val[0]), formShim),
                        wrapWithDivP(makeOutputValue(val[0], val[1], val[2], val[3])).html()
                    );
                });
            });
        });

        describe("date conversions", function() {
            var dates = [
                    {
                        xmlValue: "format-date(date(🍌#form/date🍌), '%d/%n/%y')",
                        valueInBubble: '🍌#form/date🍌',
                        bubbleDispValue: 'date',
                        icon: icon('fa fa-calendar'),
                        internalRef: true,
                        extraAttrs: {
                            'data-date-format': '%d/%n/%y',
                        }
                    },
                ];

            _.each(dates, function(val) {
                it("from text to html with output value: " + val.xmlValue, function() {
                    var real = richText.toRichText(outputValueTemplateFn(val.xmlValue), formShim),
                        test = makeOutputValue(val.valueInBubble, val.bubbleDispValue,
                                              val.icon, val.internalRef).attr(val.extraAttrs);
                    assert(wrapWithDiv(real)[0].isEqualNode(wrapWithDivP(test)[0]),
                          '\n' + real + '\n' + wrapWithDiv(test).html());
                });
            });

            it("bubble a drag+drop reference", function() {
                var fmt = "%d/%n/%y",
                    tag = javaRosa.getOutputRef("🍌#form/text🍌", fmt),
                    bubble = richText.toRichText(tag, formShim);
                assert.strictEqual($(bubble).find('span').data('date-format'), fmt);
            });
        });

        describe("equation conversions", function() {
            var f_1065 = "🍌#case/child/f_1065🍌",
                ico = icon('fcc-fd-text'),
                equations = [
                    [
                        "🍌#form/text🍌 = 🍌#form/othertext🍌",
                        wrapWithDiv(makeBubble('🍌#form/text🍌', 'text', ico, true)).html() + " = " +
                        wrapWithDiv(makeBubble('🍌#form/othertext🍌', 'othertext', ico, true)).html()
                    ],
                    [
                        "🍌#form/text🍌 <= 🍌#form/othertext🍌",
                        wrapWithDiv(makeBubble('🍌#form/text🍌', 'text', ico, true)).html() + " &lt;= " +
                        wrapWithDiv(makeBubble('🍌#form/othertext🍌', 'othertext', ico, true)).html()
                    ],
                    [
                        f_1065 + " = " + f_1065,
                        wrapWithDiv(makeBubble(f_1065, 'f_1065', icon('fcc-fd-external-case'))).html() + " = " +
                        wrapWithDiv(makeBubble(f_1065, 'f_1065', icon('fcc-fd-external-case'))).html()
                    ],
                ],
                opts = {isExpression: true};

            _.each(equations, function(val) {
                it("from text to html: " + val[0], function() {
                    assert.strictEqual(
                        richText.toRichText(val[0], formShim, opts),
                        "<p>" + val[1] + "</p>"
                    );
                });
            });
        });

        describe("text conversions", function() {
            var text = [
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
            ];

            _.each(text, function(val){
                it("from html to text: " + JSON.stringify(val[1]), function() {
                    assert.strictEqual(richText.fromRichText(val[1]), val[0]);
                });
            });

            _.each(text, function(val){
                it("(text -> html -> text): " + JSON.stringify(val[0]), function() {
                    assert.strictEqual(
                        richText.fromRichText(richText.toRichText(val[0])),
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
                        richText.toRichText(val, formShim, opts),
                        "<p>" + val + "</p>"
                    );
                });
            });
        });

        describe("convert value with output and escaped HTML", function () {
            var items = [
                    ['<h1><output value="🍌#form/text🍌" /></h1>',
                     '&lt;h1&gt;{text}&lt;/h1&gt;'],
                    ['<output value="🍌#form/text🍌" /> <tag /> <output value="🍌#form/othertext🍌" />',
                     '{text} &lt;tag /&gt; {othertext}'],
                    ["{blah}", "{blah}"],
                    ['<output value="unknown(#form/text)" />', '&lt;output value="unknown(#form/text)" /&gt;'],
                ],
                ico = icon('fcc-fd-text');

            _.each(items, function (item) {
                it("to text: " + item[0], function () {
                    var result = richText.bubbleOutputs(item[0], formShim, true),
                        expect = item[1].replace(/{(.*?)}/g, function (m, name) {
                            if (formShim.getMugByPath("🍌#form/" + name + "🍌")) {
                                var output = makeOutputValue("🍌#form/" + name + "🍌", name, ico, true);
                                return output[0].outerHTML;
                            }
                            return m;
                        });
                    assert.equal(result, expect);
                });
            });
        });
    });

    describe("The rich text editor", function () {
        describe("", function() {
            var el = $("<div id='cktestparent'><div contenteditable /></div>"),
                options = {isExpression: false},
                input, editor;
            before(function (done) {
                $("body").append(el);
                input = el.children().first();
                editor = richText.editor(input, formShim, options);
                // wait for editor to be ready; necessary to change selection
                input.promise.then(function () { done(); });
            });
            beforeEach(function (done) {
                editor.setValue("", function () { done(); });
            });
            after(function () {
                editor.destroy();
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
                    assert.equal(editor.getValue(), "one" + output + " two");
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

            function applyArgs(func) {
                return function (args) {
                    return func.apply(this, args);
                };
            }

            _.each([
                ["one two", 3, "one/data/text two"],
                ["one two", 4, "one /data/text two"],
                ["one\n\ntwo", 3, "one/data/text\n\ntwo"],
                ["one\n\ntwo", 4, "one\n/data/text\ntwo"],
                /* TODO make these tests pass
                ["one\n\ntwo", 5, "one\n\n/data/text two"],
                ["11\n\n22\n\n33", 5, "11\n\n2/data/text 2\n\n33"],
                ["11\n\n22\n\n33", 6, "11\n\n22/data/text\n\n33"],
                ["11\n\n22\n\n33", 7, "11\n\n22\n/data/text\n33"],
                ["11\n\n22\n\n33", 8, "11\n\n22\n\n/data/text 33"],
                ["11\n\n22\n\n33", 9, "11\n\n22\n\n3/data/text 3"],
                ["11\n\n22\n\n33", 10, "11\n\n22\n\n33/data/text"],
                */
            ], applyArgs(function (expr, i, result) {
                var repr = JSON.stringify(result);
                it("should insert expression into expression at " + i + ": " + repr, function (done) {
                    editor.setValue(expr, function () {
                        assert.equal(editor.getValue(), expr);
                        editor.select(i);
                        // temporarily change to expression editor
                        options.isExpression = true;
                        try {
                            editor.insertExpression('/data/text');
                            assert.equal(editor.getValue(), result);
                        } finally {
                            options.isExpression = false;
                        }
                        done();
                    });
                });
            }));
        });

        describe("in vellum", function() {
            var widget;

            describe("", function () {
                before(function (done) {
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
            });

            describe("popovers", function () {
                before(function (done) {
                    util.init({
                        javaRosa: {langs: ['en']},
                        form: "",
                        core: { onReady: done },
                        features: {rich_text: true},
                    });
                });

                it("should show xpath on popover", function (done) {
                    util.loadXML(BURPEE_XML);
                    util.clickQuestion("total_num_burpees");
                    widget = util.getWidget('property-calculateAttr');
                    widget.input.promise.then(function () {
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
                        assert(bubble, "No bubbles detected");
                        bubble.mouseenter();
                        assert.strictEqual($('.popover-content').text(),
                                           "How many burpees did you do on #form/new_burpee_data/burpee_date ?");
                        done();
                    });
                });
            });
        });
    });
});
