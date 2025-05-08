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
    'static/richText/burpee.xml',
    'static/richText/output-ref.xml',
    'static/richText/output-value.xml',
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

    function icon(iconClass) { 
        if (iconClass.startsWith("fa-")) {
            return $('<i>').addClass(iconClass).html('&nbsp;');
        }
        return $('<i>').addClass('fcc ' + iconClass).html('&nbsp;');
    }

    function externalIcon () { return icon('fcc-fd-case-property'); }
    function externalUnknownIcon () { return icon('fa-solid fa-triangle-exclamation'); }

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
                        icon: icon('fa-solid fa-calendar-days'),
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
            var prefix_html_1 = '<span data-cke-copybin-start="1">​</span><p>',
                prefix_html_2 = '<span id="cke_bm_909S" style="display: none;">&nbsp;</span>',
                prefix_html = prefix_html_1 + prefix_html_2,
                widget_html = '<span tabindex="-1" contenteditable="false" data-cke-widget-wrapper="1" data-cke-filter="off" ' +
                    'class="cke_widget_wrapper cke_widget_inline cke_widget_bubbles cke_widget_wrapper_label-datanode-external ' +
                    'cke_widget_wrapper_label-datanode cke_widget_wrapper_label cke_widget_selected" data-cke-display-name="span" ' +
                    'data-cke-widget-id="0" role="region" aria-label="span widget"><span class="label label-datanode label-datanode-external ' +
                    'cke_widget_element" data-value="#case/dob" data-cke-widget-data="%7B%22classes%22%3A%7B%22label-datanode-external' +
                    '%22%3A1%2C%22label-datanode%22%3A1%2C%22label%22%3A1%7D%7D" data-cke-widget-upcasted="1" data-cke-widget-keep-attr="0" ' +
                    'data-widget="bubbles"><i class="fcc fcc-fd-case-property">&nbsp;</i>dob</span><span class="cke_reset ' +
                    'cke_widget_drag_handler_container" style="background: url(&quot;http://localhost:8088/src/../lib/ckeditor/plugins/' +
                    'widget/images/handle.png&quot;) rgba(220, 220, 220, 0.5); width: 43px; height: 16px; left: 2px; top: -14px;">' +
                    '<img class="cke_reset cke_widget_drag_handler" data-cke-widget-drag-handler="1" src="data:image/gif;base64,R0lGODlhAQABAPABAP' +
                    '///wAAACH5BAEKAAAALAAAAAABAAEAAAICRAEAOw==" width="15" title="Click and drag to move" height="15" role="presentation" ' +
                    'draggable="true"></span></span>',
                suffix_html = '</p><span data-cke-copybin-end="1">​</span>';

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
                ["' ,", "'\u200B,"],
                ['This dob: <output value="#case/dob" /> is of child', prefix_html + 'This dob:&nbsp;' + widget_html + ' is of child' + suffix_html],
                ['This dob: <output value="#case/dob" />', prefix_html + 'This dob:&nbsp;' + widget_html +  suffix_html],
                ['<output value="#case/dob" /> is of child', prefix_html + widget_html + ' is of child' + suffix_html],
                ['<output value="#case/dob" />', prefix_html_1 + widget_html + suffix_html],
                ['This dob: <output value="#case/dob" /> is of child', 'This dob: &lt;output value="#case/dob" /&gt; is of child'],
            ];

            _.each(text, function(val){
                it("from html to text: " + JSON.stringify(val[1]), function() {
                    assert.strictEqual(richText.fromRichText(val[1]), val[0]);
                });
            });

            _.each(text, function(val){
                it("(text -> html -> text): " + JSON.stringify(val[0]), function() {
                    assert.strictEqual(
                        richText.fromRichText(richText.toRichText(val[0], form)),
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
                    assert.equal(editor.getValue(), "one" + output + "  two");
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

            it("should not paste style content into editor", function () {
                var html = '<style type="text/css"><!--td--></style><span>A</span>';
                input.ckeditor().editor.execCommand('paste', html);
                assert.equal(editor.getValue(), 'A');
            });

            function assertCKCopy($editor, value, callback) {
                // WARNING this is heavily dependent on CKEditor internals
                var domObject = new CKEDITOR.dom.domObject($editor[0]),
                    realDataTransfer = CKEDITOR.plugins.clipboard.dataTransfer,
                    data;
                function testDataTransfer(nativeDataTransfer, editor) {
                    realDataTransfer.call(this, nativeDataTransfer, editor);
                    data = this._.data;
                }
                testDataTransfer.prototype = realDataTransfer.prototype;
                CKEDITOR.plugins.clipboard.dataTransfer = testDataTransfer;
                try {
                    domObject.fire("copy", new CKEDITOR.dom.event({}));
                } finally {
                    CKEDITOR.plugins.clipboard.dataTransfer = realDataTransfer;
                }
                assert.equal(data.Text, value, 'text/plain');
                assert.strictEqual(data["text/html"], undefined, 'text/html');
                // Wait for CK Editor Async handler (copybin) to complete
                setTimeout(callback, 100);
            }

            function ckPaste($editor, data, callback) {
                // WARNING this is heavily dependent on CKEditor internals
                function mockDataTransfer() {
                    // borrowed from CKEditor tests
                    return {
                        types: [],
                        files: CKEDITOR.env.ie && CKEDITOR.env.version < 10 ? undefined : [],
                        _data: {},
                        // Emulate browsers native behavior for getDeta/setData.
                        setData: function( type, data ) {
                            if ( CKEDITOR.env.ie && type !== 'Text' && type !== 'URL' )
                                throw 'Unexpected call to method or property access.';

                            if ( CKEDITOR.env.ie && CKEDITOR.env.version > 9 && type === 'URL' )
                                return;

                            if ( type === 'text/plain' || type === 'Text' ) {
                                this._data[ 'text/plain' ] = data;
                                this._data.Text = data;
                            } else {
                                this._data[ type ] = data;
                            }

                            this.types.push( type );
                        },
                        getData: function( type ) {
                            if ( CKEDITOR.env.ie && type !== 'Text' && type !== 'URL' )
                                throw 'Invalid argument.';

                            if ( typeof this._data[ type ] === 'undefined' || this._data[ type ] === null )
                                return '';

                            return this._data[ type ];
                        }
                    };
                }
                function mockPasteEvent(_target, dataTransfer) {
                    // borrowed from CKEditor tests
                    var target = new CKEDITOR.dom.node(_target);
                    return {
                        $: {
                            ctrlKey: true,
                            clipboardData: CKEDITOR.env.ie ? undefined : dataTransfer
                        },
                        preventDefault: function() {
                            // noop
                        },
                        getTarget: function() {
                            return target;
                        },
                        setTarget: function( t ) {
                            target = t;
                        }
                    };
                }
                var editor = $editor.ckeditor().editor,
                    editable = editor.editable(),
                    dataTransfer = mockDataTransfer(),
                    evt = mockPasteEvent($editor[0], dataTransfer),
                    types = {
                        html: "text/html",
                        text: "Text",
                    };
                if (_.isEmpty(data)) {
                    throw new Error("bad paste: no data");
                }
                _.each(data, function (value, type) {
                    if (!types.hasOwnProperty(type)) {
                        throw new Error("bad paste type: " + type);
                    }
                    dataTransfer.setData(types[type], value);
                });
                editor.once("afterPaste", function () {
                    callback(editor.getData());
                }, null, null, 100);
                editable.fire("paste", evt);
            }

            function escapeHTML(html) {
                var reps = {'<': '&lt;', '>': '&gt;', '"': '&quot;', '\n': '<br />'};
                return html.replace(/[<>"&\n]/g, function (match) {
                    return reps[match];
                });
            }

            var TEST_LABEL = 'Weight: <output value="#form/text" /> grams',
                TEST_XPATH = "if(today() + (#case/dob - 3), #form/text, 0)";

            it("should copy output tag from rich text editor", function (done) {
                editor.setValue(TEST_LABEL, function () {
                    editor.select(6, 3);
                    assertCKCopy(input, ': <output value="#form/text" />', function () {
                        done();
                    });
                });
            });

            it("should copy expression with hashtags from expression editor", function (done) {
                exprEditor.setValue(TEST_XPATH, function () {
                    exprEditor.select(11, 4);
                    assertCKCopy(exprInput, "+ (#case/dob", function () {
                        done();
                    });
                });
            });

            var /*OUTPUT = '<output value="#form/text" />',
                START_LABEL = TEST_LABEL.replace(OUTPUT, 'XXXX'),*/
                START_PATH = TEST_XPATH.replace('#case/dob', 'XXXX');
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
                var inputFlag = args[0],
                    initialExpr = args[1],
                    selStart = args[2],
                    selLength = args[3],
                    pasteValue = args[4],
                    pasteText = pasteValue.text ||
                                pasteValue.html.replace(/<.*?>/g, ''),
                    pasteRepr = JSON.stringify(pasteValue),
                    type = inputFlag ? "expression" : "text",
                    opts = {isExpression: true};
                it("should paste " + type + ": " + pasteRepr, function (done) {
                    var input_ = inputFlag ? exprInput : input,
                        editor = richText.editor(input_),
                        find = initialExpr.substring(selStart, selStart + selLength);
                    editor.setValue(initialExpr, function () {
                        editor.select(selStart, selLength);
                        ckPaste(input_, pasteValue, function (text) {
                            assert.equal(text, richText
                                .toRichText(initialExpr, form, opts)
                                .replace(find, escapeHTML(pasteText)));
                            assert.equal(editor.getValue(),
                                initialExpr.substring(0, selStart) + pasteText +
                                initialExpr.substring(selStart + selLength));
                            done();
                        });
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
                    var editor = widget.input.editor,
                        value = 'testing cursor';
                    widget.setValue(value);
                    // Make sure focus is elsewhere, then focus on the rich text input
                    editor.on('instanceReady', function() {
                        $('[name=property-nodeID]').focus();
                        editor.focus();
                        var selection = editor.getSelection(true);
                        assert.strictEqual(selection.getNative().focusOffset, value.length);
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
                        core: { onReady: function () { done(); } },
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
                        bubble.mouseenter();
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
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
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
                        bubble.mouseenter();
                    });
                });

                it("should show case property description on popover", function (done) {
                    util.loadXML();
                    var mug = util.addQuestion("Text", "text");
                    mug.p.calculateAttr = "#case/dob";
                    util.clickQuestion("text");
                    var widget = util.getWidget('property-calculateAttr');
                    widget.input.promise.then(function () {
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
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
                        bubble.mouseenter();
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
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
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
                        bubble.mouseenter();
                    });
                });

                it("should destroy popover on destroy widget", function (done) {
                    util.loadXML(BURPEE_XML);
                    util.clickQuestion("total_num_burpees");
                    var widget = util.getWidget('property-calculateAttr');
                    widget.input.promise.then(function () {
                        var bubble = $('.cke_widget_drag_handler_container').children('img').first();
                        assert(bubble.length, "No bubbles detected");
                        $(document).one('shown.bs.popover', function() {
                            try {
                                var $popover = $('.popover-content:last p:first');
                                assert.strictEqual($popover.text(),
                                    "How many burpees did you do on #form/new_burpee_data/burpee_date ?");

                                widget.input.ckeditor().editor.widgets.destroyAll();
                                // popover destroy just fades the popover
                                assert.strictEqual($('.popover:not(.fade)').length, 0);
                                done();
                            } finally {
                                $(".popover").remove();
                            }
                        });
                        bubble.mouseenter();
                    });
                });

                it("should not error on unknown question ref", function (done) {
                    util.loadXML("");
                    util.addQuestion("Text", "text");
                    var widget = util.getWidget('property-relevantAttr'),
                        editor = richText.editor(widget.input);
                    editor.on("instanceReady", function () {
                        editor.setValue("#form/unknown");
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
});
