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
        form,
        CASE_DATA = [{
            id: "commcaresession",
            uri: "jr://instance/session",
            path: "/session/data",
            name: 'Session',
            structure: {
                "case_id": {
                    reference: {
                        source: "casedb",
                        subset: "case",
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
                    parent: "parent",
                },
            }],
        }];

    function icon(iconClass) { 
        if (iconClass.startsWith("fa-")) {
            return $('<i>').addClass('fa ' + iconClass).html('&nbsp;');
        }
        return $('<i>').addClass('fcc ' + iconClass).html('&nbsp;');
    }

    function externalIcon () { return icon('fcc-fd-case-property'); }
    function externalUnknownIcon () { return icon('fa-exclamation-triangle'); }

    function makeBubble(xpath, dispValue, icon, internal) {
        var span = $('<span>').addClass('label label-datanode').attr({
            'data-value': xpath,
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
        return span.append(icon).append(dispValue);
    }
    function outputValueTemplateFn(path) {
        return '<output value="' + path + '"></output>';
    }

    function wrapWithDiv(el) { return $('<div>').append(el); }
    function wrapWithDivP(el) { return wrapWithDiv($('<p>').append(el)); }
    function html(value) { return wrapWithDiv(value).html(); }

    before(function (done) {
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
    });

    describe("Rich text utilities", function() {
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
                    assert.strictEqual(
                        richText.toRichText(val[0], form, opts),
                        wrapWithDivP(makeBubble(val[0], val[1], val[2], val[3])).html()
                    );
                });

                it("from text to html with output value: " + val[0], function() {
                    assert.strictEqual(
                        richText.toRichText(outputValueTemplateFn(val[0]), form),
                        wrapWithDivP(makeBubble(val[0], val[1], val[2], val[3])).html()
                    );
                });
            });
        });

        describe("date conversions", function() {
            var dates = [
                    {
                        xmlValue: "format-date(date(#form/date), '%d/%n/%y')",
                        valueInBubble: '#form/date',
                        bubbleDispValue: 'date',
                        icon: icon('fa-calendar'),
                        internalRef: true,
                        extraAttrs: {
                            'data-date-format': '%d/%n/%y',
                        }
                    },
                ];

            _.each(dates, function(val) {
                it("from text to html with output value: " + val.xmlValue, function() {
                    assert.equal(
                        richText.toRichText(outputValueTemplateFn(val.xmlValue), form),
                        wrapWithDivP(makeBubble(
                            val.valueInBubble,
                            val.bubbleDispValue,
                            val.icon,
                            val.internalRef
                        ).attr(val.extraAttrs)).html()
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
                        html(makeBubble('#form/text', 'text', ico, true)) + " = " +
                        html(makeBubble('#form/othertext', 'othertext', ico, true))
                    ],
                    [
                        "#form/text <= #form/othertext",
                        html(makeBubble('#form/text', 'text', ico, true)) + " <= " +
                        html(makeBubble('#form/othertext', 'othertext', ico, true))
                    ],
                    [
                        f_1065 + " = " + f_1065,
                        html(makeBubble(f_1065, 'f_1065', icon('fcc-fd-case-property'), "case")) + " = " +
                        html(makeBubble(f_1065, 'f_1065', icon('fcc-fd-case-property'), "case"))
                    ],
                ];

            _.each(equations, function(val) {
                it("from text to html: " + val[0], function() {
                    assert.strictEqual(
                        richText.toRichText(val[0], form, opts),
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
                    ['<output value="concat(1, 2" />', '&lt;output value="concat(1, 2" /&gt;']
                ],
                ico = icon('fcc-fd-text');

            _.each(items, function (item) {
                it("to text: " + item[0], function () {
                    var result = richText.bubbleOutputs(item[0], form, true),
                        expect = item[1].replace(/{(.*?)}/g, function (m, name) {
                            if (form.getIconByPath("#form/" + name)) {
                                var output = makeBubble("#form/" + name, name, ico, true);
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
        describe("", function() {
            var el = $("<div id='cktestparent'><div contenteditable /><div contenteditable /></div>"),
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

            it("should not copy output value from label to expression editor", function (done) {
                var output = '<output value="#form/text" />';
                editor.setValue(output, function () {
                    assert.equal(editor.getValue(), output);
                    var copyVal = input.ckeditor().editor.getData();
                    assert(/^<p><span .*<.span><.p>$/.test(copyVal), copyVal);
                    exprInput.ckeditor().editor.setData(copyVal, function () {
                        assert.equal(exprEditor.getValue(), "#form/text");
                        done();
                    });
                });
            });

            it("should copy output value from expression editor to label", function (done) {
                exprEditor.setValue("#form/text", function () {
                    assert.equal(exprEditor.getValue(), "#form/text");
                    var copyVal = exprInput.ckeditor().editor.getData();
                    assert(/^<p><span .*<.span><.p>$/.test(copyVal), copyVal);
                    input.ckeditor().editor.setData(copyVal, function () {
                        assert.equal(editor.getValue(), '<output value="#form/text" />');
                        done();
                    });
                });
            });

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
                        if (expr === "one two" || i === 3) {
                            // BUG for some reason ckeditor.getData() replaces
                            // two spaces with one in this expression.
                            result = result.replace(/  /g, " ");
                        }
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
                        expected = (expr.slice(0, i) + html(bubble) + " " + expr.slice(i))
                            .replace(/  $/, "")  // HACK for "one =  "
                            .replace(/  /g, " &nbsp;")
                            .replace(/\n/g, "</p><p>");
                    assert.equal(text, "<p>" + expected + "</p>");
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

                    // Make sure focus is elsewhere, then focus on the rich text input
                    editor.on('instanceReady', function() {
                        $('[name=property-nodeID]').focus();
                        editor.focus();
                        var selection = editor.getSelection(true);
                        assert.strictEqual(selection.getNative().focusOffset, 14);
                    });
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
                        widget.setValue('<output value="#case/not_a_child" />' +
                            '<output value="#case/not_a_thing" />' +
                            '<output value="#case/dob" />'
                        );
                        assert.strictEqual($widget.find(".label-datanode-external-unknown").length, 1);
                        assert.strictEqual($widget.find(".label-datanode-external").length, 1);
                        assert.strictEqual($widget.find(".label-datanode-unknown").length, 1);
                    });
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
                        core: { onReady: done },
                        features: {
                            rich_text: true,
                            disable_popovers: false,
                        },
                    });
                });

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
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
                        assert(bubble.length, "No bubbles detected");
                        try {
                            bubble.mouseenter();
                            var $popover = $('.popover-content:last');
                            assert.strictEqual($popover.find('p:first').text(),
                                               "How many burpees did you do on #form/new_burpee_data/burpee_date ?");
                            var $link = $popover.find("a");
                            assert($link.length);
                            $link.click();
                            assert.strictEqual($(".jstree-hovered").length, 1);
                        } finally {
                            $(".popover").remove();
                        }
                        done();
                    });
                });

                it("should destroy popover on destroy widget", function (done) {
                    util.loadXML(BURPEE_XML);
                    util.clickQuestion("total_num_burpees");
                    var widget = util.getWidget('property-calculateAttr');
                    widget.input.promise.then(function () {
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
                        assert(bubble.length, "No bubbles detected");
                        try {
                            bubble.mouseenter();
                            var $popover = $('.popover-content:last p:first');
                            assert.strictEqual($popover.text(),
                                "How many burpees did you do on #form/new_burpee_data/burpee_date ?");

                            widget.input.ckeditor().editor.widgets.destroyAll();
                            // popover destroy just fades the popover
                            assert.strictEqual($('.popover:not(.fade)').length, 0);
                        } finally {
                            $(".popover").remove();
                        }
                        done();
                    });
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
                                        .find('.cke_widget_drag_handler_container')
                                        .children('img').first(),
                                    $desc;
                                assert(bubble.length, "No bubbles detected");
                                try {
                                    bubble.mouseenter();
                                    $desc = $('.popover-title .text-muted');
                                    assert.equal($desc.text(), desc);
                                    // check for format selector link
                                    assert.equal($desc.find('a').text(),
                                                 /\((.*)\)/.exec(desc)[1]);
                                } finally {
                                    $(".popover").remove();
                                }
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
});
