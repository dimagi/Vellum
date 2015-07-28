/*
 * expected structure of a richtext widget:
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
 *   <span contenteditable="false" draggable="true" 
 *         data-value="what should be put into XML">
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
    'vellum/widgets'
], function(
    chai,
    $,
    _,
    util,
    widgets
) {
    var assert = chai.assert,
        formShim = {
            getMugByPath: function(path) {
                return {
                    "/data/text": {
                        options: { icon: 'fcc fcc-fd-text' },
                    }
                }[path];
            }
        };

    function icon(iconClass) { 
        return $('<i>').addClass('fcc ' + iconClass).html('&nbsp;');
    }

    function externalIcon () { return icon('fcc-fd-external-case'); }
    function unknownIcon () { return icon('fcc-help'); }

    function bubbleSpan(xpath, internal, templateFn) {
        var span = $('<span>').addClass('label label-datanode').attr({
            contenteditable: false,
            draggable: true,
            'data-value': templateFn(xpath),
        });
        if (internal) {
            span.addClass('label-datanode-internal');
        } else {
            span.addClass('label-datanode-external');
        }
        return span;
    }

    function makeBubble(xpath, dispValue, icon, internal, templateFn) {
        templateFn = templateFn || _.identity;
        return bubbleSpan(xpath, internal, templateFn).append(icon).append(dispValue);
    }

    function makeOutputValue(xpath, dispValue, icon, internal) {
        return makeBubble(xpath, dispValue, icon, internal, function(path) {
            return '<output value="' + path + '" />';
        });
    }

    function wrapWithDiv(el) { return $('<div>').append(el); }

    describe("Rich text utilities", function() {
        // path, display value, icon
        var conversions = [
            ['/data/text', 'text', icon('fcc-fd-text'), true],
            ["instance('casedb')/cases/case[@case_id = /data/case_id]/blah", 'blah', externalIcon(), false],
            ["instance('casedb')/cases/case[@case_id = /data/case_id]", 'case', externalIcon(), false],
            // ["/data/where-did-this-come-from", 'where-did-this-come-from', unknownIcon(), false],
        ];

        _.each(conversions, function(val) {
            it("from text to html: " + val[0], function() {
                assert.strictEqual(
                    wrapWithDiv(widgets.util.replaceOuputRef(formShim, val[0], false, true)).html(),
                    wrapWithDiv(makeBubble(val[0], val[1], val[2], val[3])).html()
                );
            });

            it("from text to html with output value: " + val[0], function() {
                assert.strictEqual(
                    wrapWithDiv(widgets.util.replaceOuputRef(formShim, val[0])).html(),
                    wrapWithDiv(makeOutputValue(val[0], val[1], val[2], val[3])).html()
                );
            });

            it("from html to text: " + val[0], function() {
                var bubble = $('<div>').append(makeBubble(val[0], val[1], val[2], val[3])).html();
                assert.strictEqual(widgets.util.fromRichText(bubble), val[0]);
            });
        });
    });
});
