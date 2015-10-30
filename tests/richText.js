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
    'ckeditor',
], function(
    chai,
    $,
    _,
    util,
    richText,
    javaRosa,
    CKEDITOR
) {
    var assert = chai.assert,
        formShim = {
            getMugByPath: function(path) {
                return {
                    "/data/text": {
                        options: { icon: 'fcc fcc-fd-text' },
                    },
                    "/data/othertext": {
                        options: { icon: 'fcc fcc-fd-text' },
                    },
                    "/data/date": {
                        options: { icon: 'fcc icon-calendar' },
                    },
                    "/data/group": {
                        options: { icon: 'fcc icon-folder-open' },
                    },
                }[path];
            }
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
                    ['/data/text', 'text', icon('fcc-fd-text'), true],
                    ["instance('casedb')/cases/case" +
                     "[@case_id = instance('commcaresession')/session/data/case_id]",
                     'case', externalIcon(), false],
                    ["instance('casedb')/cases/case[@case_id = instance('casedb')/cases/case" +
                     "[@case_id = instance('commcaresession')/session/data/case_id]" +
                     "/index/parent]/edd", 'edd', externalIcon(), false]
                ],
                opts = {isExpression: true};

            _.each(simpleConversions, function(val) {
                it("from text to html: " + val[0], function() {
                    assert.strictEqual(
                        wrapWithDiv(richText.toRichText(val[0], formShim, opts)).html(),
                        wrapWithDivP(makeBubble(val[0], val[1], val[2], val[3])).html()
                    );
                });

                it("from text to html with output value: " + val[0], function() {
                    assert.strictEqual(
                        wrapWithDiv(richText.toRichText(outputValueTemplateFn(val[0]), formShim)).html(),
                        wrapWithDivP(makeOutputValue(val[0], val[1], val[2], val[3])).html()
                    );
                });
            });
        });

        describe("date conversions", function() {
            var dates = [
                    {
                        xmlValue: "format-date(date(/data/date), '%d/%n/%y')",
                        valueInBubble: '/data/date',
                        bubbleDispValue: 'date',
                        icon: icon('icon-calendar'),
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
                    tag = javaRosa.getOutputRef("/data/text", fmt),
                    bubble = richText.toRichText(tag, formShim);
                assert.strictEqual($(bubble).find('span').data('date-format'), fmt);
            });
        });

        describe("equation conversions", function() {
            var f_1065 = "instance('casedb')/cases/case[" +
                            "@case_id = instance('commcaresession')/session/data/case_id" +
                         "]/f_1065",
                ico = icon('fcc-fd-text'),
                equations = [
                    [
                        "/data/text = /data/othertext",
                        wrapWithDiv(makeBubble('/data/text', 'text', ico, true)).html() + " = " +
                        wrapWithDiv(makeBubble('/data/othertext', 'othertext', ico, true)).html()
                    ],
                    [
                        "/data/text <= /data/othertext",
                        wrapWithDiv(makeBubble('/data/text', 'text', ico, true)).html() + " &lt;= " +
                        wrapWithDiv(makeBubble('/data/othertext', 'othertext', ico, true)).html()
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
            ];

            _.each(text, function(val){
                it("from html to text: " + val[1], function() {
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
                    ['<h1><output value="/data/text" /></h1>',
                     '&lt;h1&gt;{text}&lt;/h1&gt;'],
                    ['<output value="/data/text" /> <tag /> <output value="/data/othertext" />',
                     '{text} &lt;tag /&gt; {othertext}'],
                    ["{blah}", "{blah}"],
                ],
                ico = icon('fcc-fd-text');

            _.each(items, function (item) {
                it("to text: " + item[0], function () {
                    var result = richText.bubbleOutputs(item[0], formShim, true),
                        expect = item[1].replace(/{(.*?)}/g, function (m, name) {
                            if (formShim.getMugByPath("/data/" + name)) {
                                var output = makeOutputValue("/data/" + name, name, ico, true);
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
            var text = '<output value="/data/text" />';
            assert.notEqual(editor.getValue(), text);
            editor.setValue(text);
            assert.equal(editor.getValue(), text);
        });

        it("should insert expression into expression editor", function (done) {
            editor.setValue('one two', function () {
                assert.equal(editor.getValue(), 'one two');
                select(editor, 3);
                // temporarily change to expression editor
                options.isExpression = true;
                try {
                    editor.insertExpression('/data/text');
                    assert.equal(editor.getValue(), "one/data/text two");
                } finally {
                    options.isExpression = false;
                }
                done();
            });
        });

        it("should create output on insert expression into label editor", function (done) {
            var output = '<output value="/data/text" />';
            editor.setValue('one two', function () {
                assert.equal(editor.getValue(), 'one two');
                select(editor, 3);
                editor.insertExpression("/data/text");
                assert.equal(editor.getValue(), "one" + output + " two");
                done();
            });
        });

        it("should insert output into label editor", function (done) {
            var output = '<output value="/data/text" />';
            editor.setValue('one two', function () {
                assert.equal(editor.getValue(), 'one two');
                select(editor, 3);
                editor.insertOutput(output);
                assert.equal(editor.getValue(), "one" + output + " two");
                done();
            });
        });

        // TODO tests to make sure select() works in various scenarios
        // for example, with multiple lines

        // -- helpers ---------------------------------------------------------

        function select(editor, start) {
            function iterNodes(element) {
                var i = 0,
                    children = element.getChildren(),
                    count = children.count(),
                    inner = null;
                function next() {
                    var child;
                    if (inner) {
                        child = inner();
                        if (child !== null) {
                            return child;
                        }
                        inner = null;
                    }
                    if (i >= count) {
                        return null;
                    }
                    child = children.getItem(i);
                    i++;
                    if (child.type === CKEDITOR.NODE_ELEMENT) {
                        var name = child.getName().toLowerCase();
                        if (name === "p") {
                            inner = iterNodes(child);
                            return next();
                        }
                        throw new Error("not implemented: " + name);
                    } else if (child.type === CKEDITOR.NODE_TEXT) {
                        return {node: child, length: child.getText().length};
                    }
                    throw new Error("unhandled element type: " + child.type);
                }
                return next;
            }
            function getNodeOffset(index, nextNode) {
                var offset = index,
                    node = nextNode();
                while (node) {
                    if (node.length >= offset) {
                        return {node: node.node, offset: offset};
                    }
                    offset -= node.length;
                    node = nextNode();
                }
                throw new Error("index is larger than content: " + index);
            }
            editor = editor.editor;
            editor.focus();
            var sel = editor.getSelection(),
                nextNode = iterNodes(sel.root),
                node = getNodeOffset(start, nextNode),
                range = sel.getRanges()[0];
            range.setStart(node.node, node.offset);
            range.collapse(true);
            sel.selectRanges([range]);
        }
    });
});
