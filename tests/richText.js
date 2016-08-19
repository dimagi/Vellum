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
    'vellum/javaRosa/util',
    'vellum/escapedHashtags',
    'ckeditor',
    'text!static/richText/burpee.xml',
    'text!static/richText/output-ref.xml',
    'text!static/richText/output-value.xml',
], function(
    chai,
    $,
    _,
    util,
    richText,
    javaRosa,
    escapedHashtags,
    CKEDITOR,
    BURPEE_XML,
    OUTPUT_REF_XML,
    OUTPUT_VALUE_XML
) {
    var assert = chai.assert,
        call = util.call,
        hashtagToXPath = {},
        formShim = {
            isValidHashtag: function (path) {
                return _.contains([
                    '#form/text',
                    '#form/othertext',
                    '#form/date',
                    '#form/group',
                    '#case/mother/edd',
                    '#case/child/case',
                    '#case/child/f_1065',
                ], this.normalizeHashtag(path));
            },
            isValidHashtagPrefix: function (path) {
                return _.contains([
                    '#case/mother/',
                    '#case/child/',
                ], this.normalizeHashtag(path));
            },
            hasValidHashtagPrefix: function (path) {
                return _.contains([
                    '#case/mother/edd',
                    '#case/child/case',
                    '#case/child/f_1065',
                ], this.normalizeHashtag(path));
            },
            normalizeEscapedHashtag: function (path) {
                 return path;
            },
            normalizeHashtag: function (path) {
                if (path.startsWith("`")) {
                    path = path.slice(1);
                }
                if (path.endsWith("`")) {
                    path = path.slice(0, -1);
                }
                 return path;
            },
            transform: function (path) {
                return escapedHashtags.transform(path, function (path) {
                    var icon_ = formShim.getIconByPath(path),
                        iconExists = !!icon_;
                    icon_ = iconExists ? icon(icon_) : (formShim.isValidHashtag(path) ? externalIcon() : unknownIcon());
                    return $('<div>').html(makeBubble("`" + path + "`", path.split('/').slice(-1)[0], icon_, iconExists)).html();
                });
            },
            getIconByPath: function(path) {
                var icon = {
                    "#form/text": 'fcc fcc-fd-text',
                    "#form/othertext": 'fcc fcc-fd-text',
                    "#form/date": 'fcc fa fa-calendar',
                    "#form/group": 'fcc icon-folder-open',
                }[this.normalizeHashtag(path)];
                return icon || null;
            },
            xpath: escapedHashtags.parser(hashtagToXPath),
        };

    function icon(iconClass) { 
        return $('<i>').addClass('fcc ' + iconClass).html('&nbsp;');
    }

    function externalIcon () { return icon('fcc-fd-case-property'); }
    function unknownIcon () { return icon('fcc fcc-help'); }

    function bubbleSpan(xpath, internal, output) {
        var span = $('<span>').addClass('label label-datanode').attr({
            'data-value': xpath,
            'data-output-value': output,
        });
        if (internal) {
            span.addClass('label-datanode-internal');
        } else if (formShim.isValidHashtag(xpath)){
            span.addClass('label-datanode-external');
        } else {
            span.addClass('label-datanode-unknown');
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
                    ['`#form/text`', 'text', icon('fcc-fd-text'), true],
                    ["`#case/child/case`", 'case', externalIcon(), false],
                    ["`#case/mother/edd`", 'edd', externalIcon(), false],
                    ["`#case/mother/unknown`", 'unknown', unknownIcon(), false],
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
                        xmlValue: "format-date(date(`#form/date`), '%d/%n/%y')",
                        valueInBubble: '`#form/date`',
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
                    tag = javaRosa.getOutputRef("`#form/text`", fmt),
                    bubble = richText.toRichText(tag, formShim);
                assert.strictEqual($(bubble).find('span').data('date-format'), fmt);
            });
        });

        describe("equation conversions", function() {
            var f_1065 = "`#case/child/f_1065`",
                ico = icon('fcc-fd-text'),
                equations = [
                    [
                        "`#form/text` = `#form/othertext`",
                        wrapWithDiv(makeBubble('`#form/text`', 'text', ico, true)).html() + " = " +
                        wrapWithDiv(makeBubble('`#form/othertext`', 'othertext', ico, true)).html()
                    ],
                    [
                        "`#form/text` <= `#form/othertext`",
                        wrapWithDiv(makeBubble('`#form/text`', 'text', ico, true)).html() + " &lt;= " +
                        wrapWithDiv(makeBubble('`#form/othertext`', 'othertext', ico, true)).html()
                    ],
                    [
                        f_1065 + " = " + f_1065,
                        wrapWithDiv(makeBubble(f_1065, 'f_1065', icon('fcc-fd-case-property'))).html() + " = " +
                        wrapWithDiv(makeBubble(f_1065, 'f_1065', icon('fcc-fd-case-property'))).html()
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
                    ['<h1><output value="`#form/text`" /></h1>',
                     '&lt;h1&gt;{text}&lt;/h1&gt;'],
                    ['<output value="`#form/text`" /> <tag /> <output value="`#form/othertext`" />',
                     '{text} &lt;tag /&gt; {othertext}'],
                    ["{blah}", "{blah}"],
                    ['<output value="unknown(#form/text)" />', '&lt;output value="unknown(#form/text)" /&gt;'],
                ],
                ico = icon('fcc-fd-text');

            _.each(items, function (item) {
                it("to text: " + item[0], function () {
                    var result = richText.bubbleOutputs(item[0], formShim, true),
                        expect = item[1].replace(/{(.*?)}/g, function (m, name) {
                            if (formShim.getIconByPath("`#form/" + name + "`")) {
                                var output = makeOutputValue("`#form/" + name + "`", name, ico, true);
                                return output[0].outerHTML;
                            }
                            return m;
                        });
                    assert.equal(result, expect);
                });
            });
        });

        describe("serialize formats correctly", function () {
            it("should handle output refs", function() {
                assert.equal(richText.applyFormats({
                    outputValue: 1,
                    value: "`#case/child/f_2685`",
                }), '&lt;output value="`#case/child/f_2685`" /&gt;');
            });

            it("should handle dates", function() {
                assert.equal(richText.applyFormats({
                    dateFormat: "%d/%n/%y",
                    outputValue: 1,
                    value: "`#form/question1`",
                }), '&lt;output value="format-date(date(`#form/question1`), \'%d/%n/%y\')" /&gt;');
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
                ["one\n\ntwo", 3, "one/data/text \n\ntwo"],
                ["one\n\ntwo", 4, "one\n/data/text \ntwo"],
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
                    var editor = widget.input.editor;
                    widget.setValue('testing cursor');
                    editor.focus();
                    var selection = editor.getSelection(true);
                    assert.strictEqual(selection.getNative().focusOffset, 14);
                });

                it("should change output ref to output value", function () {
                    util.loadXML(OUTPUT_REF_XML);
                    util.assertXmlEqual(call('createXML'), OUTPUT_VALUE_XML);
                });

                it("should bubble various case properties", function () {
                    util.loadXML("");
                    var widget = util.getWidget('itext-en-label'),
                        $widget = $(".fd-textarea[name='itext-en-label']");
                    widget.input.promise.then(function () {
                        widget.setValue('<output value="#case/child/not_a_child" />' +
                            '<output value="#case/not_a_thing" />' +
                            '<output value="#case/child/dob" />'
                        );
                        assert.strictEqual($widget.find(".label-datanode-external-unknown").length, 1);
                        assert.strictEqual($widget.find(".label-datanode-external").length, 1);
                        assert.strictEqual($widget.find(".label-datanode-unknown").length, 1);
                    });
                });
            });

            describe("popovers", function () {
                before(function (done) {
                    util.init({
                        javaRosa: {langs: ['en']},
                        form: "",
                        core: { onReady: done },
                        features: {
                            rich_text: true,
                            disable_popovers: false,
                        },
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

                it("should destroy popover after destroy", function (done) {
                    util.loadXML(BURPEE_XML);
                    util.clickQuestion("total_num_burpees");
                    widget = util.getWidget('property-calculateAttr');
                    widget.input.promise.then(function () {
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
                        assert(bubble, "No bubbles detected");
                        bubble.mouseenter();
                        var $popover = $('.popover-content');
                        assert.strictEqual($popover.text(),
                                           "How many burpees did you do on #form/new_burpee_data/burpee_date ?");
                        var bubbles = widget.input.ckeditor().editor.widgets.instances;

                        _.each(bubbles, function(bubble) {
                            bubble.fire('destroy');
                        });

                        // popover destroy just fades the popover
                        assert.strictEqual($('.popover:not(.fade)').length, 0);

                        done();
                    });
                });

                it("should not change saved state", function (done) {
                    util.loadXML(BURPEE_XML);
                    assert(!util.saveButtonEnabled(), "Save button should not be enabled");
                    util.clickQuestion("total_num_burpees");
                    widget = util.getWidget('property-calculateAttr');
                    widget.input.promise.then(function () {
                        assert(!util.saveButtonEnabled(), "Save button should not be enabled");
                        done();
                    });
                });
            });
        });
    });
});
