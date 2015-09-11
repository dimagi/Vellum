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
    'vellum/javaRosa'
], function(
    chai,
    $,
    _,
    util,
    richText,
    javaRosa
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

    describe("Rich text utilities", function() {
        describe("simple conversions", function() {
            // path, display value, icon
            var simpleConversions = [
                ['/data/text', 'text', icon('fcc-fd-text'), true],
                ["instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]", 'case', externalIcon(), false],
                ["instance('casedb')/cases/case[@case_id = instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/index/parent]/edd", 'edd', externalIcon(), false]
            ];

            _.each(simpleConversions, function(val) {
                it("from text to html: " + val[0], function() {
                    assert.strictEqual(
                        wrapWithDiv(richText.toRichText(val[0], formShim)).html(),
                        wrapWithDiv(makeBubble(val[0], val[1], val[2], val[3])).html()
                    );
                });

                it("from text to html with output value: " + val[0], function() {
                    assert.strictEqual(
                        wrapWithDiv(richText.toRichText(outputValueTemplateFn(val[0]), formShim)).html(),
                        wrapWithDiv(makeOutputValue(val[0], val[1], val[2], val[3])).html()
                    );
                });

                it("from html to text: " + val[0], function() {
                    var bubble = $('<div>').append(makeBubble(val[0], val[1], val[2], val[3])).html();
                    assert.strictEqual(richText.fromRichText(bubble), val[0]);
                });

                it("from html to text with ouput value: " + val[0], function() {
                    var bubble = $('<div>').append(makeBubble(val[0], val[1], val[2], val[3], true)).html();
                    assert.strictEqual(richText.fromRichText(bubble), outputValueTemplateFn(val[0]));
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
                    assert(wrapWithDiv(real)[0].isEqualNode(wrapWithDiv(test)[0]),
                          '\n' + real + '\n' + wrapWithDiv(test).html());
                });

                it("from html to text with output value: " + val.xmlValue, function() {
                    var bubble = $('<div>').append(
                        makeBubble(val.valueInBubble, val.bubbleDispValue, val.icon,
                                   val.internalRef, true).attr(val.extraAttrs)
                    ).html();
                    assert.strictEqual(richText.fromRichText(bubble),
                                       outputValueTemplateFn(val.xmlValue));
                });
            });

            it("bubble a drag+drop reference", function() {
                var fmt = "%d/%n/%y",
                    tag = javaRosa.getOutputRef("/data/text", fmt),
                    bubble = richText.toRichText(tag, formShim, false);
                assert.strictEqual($(bubble).data('date-format'), fmt);
            });
        });

        describe("equation conversions", function() {
            var equations = [
                [
                    "/data/text = /data/othertext",
                    wrapWithDiv(makeBubble('/data/text', 'text', icon('fcc-fd-text'), true)).html() + " = " +
                    wrapWithDiv(makeBubble('/data/othertext', 'othertext', icon('fcc-fd-text'), true)).html()
                ],
                [
                    "/data/text <= /data/othertext",
                    wrapWithDiv(makeBubble('/data/text', 'text', icon('fcc-fd-text'), true)).html() + " &lt;= " +
                    wrapWithDiv(makeBubble('/data/othertext', 'othertext', icon('fcc-fd-text'), true)).html()
                ],
                [
                    "instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/f_1065 = instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/f_1065",
                    wrapWithDiv(makeBubble("instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/f_1065", 'f_1065', icon('fcc-fd-external-case'))).html() + " = " +
                    wrapWithDiv(makeBubble("instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/f_1065", 'f_1065', icon('fcc-fd-external-case'))).html()
                ],
            ];

            _.each(equations, function(val) {
                it("from text to html: " + val[0], function() {
                    assert.strictEqual(
                        richText.toRichText(val[0], formShim),
                        val[1]
                    );
                });
            });
        });

        describe("text conversions", function() {
            var text = [
                ["blah\nblah\n", "<p>blah<br />blah</p>"],
            ];

            _.each(text, function(val){
                it("from html to text: " + val[1], function() {
                    assert.strictEqual(
                        val[0], richText.fromRichText(val[1]));
                });
            });
        });

        describe("doesn't convert", function() {
            var nonConversions = [
                "instance('casedb')/cases/case[@case_id = instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/index/parent]/edd[@other = 'blah']",
                "/data/group[@prop = 'something']",
                "instance('casedb')/cases/case[@case_id = /data/blah]",
            ];

            _.each(nonConversions, function(val) {
                it("from text to html: " + val, function() {
                    assert.strictEqual(val, richText.toRichText(val, formShim));
                });
            });
        });
    });
});
