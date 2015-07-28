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

    function makeBubble(xpath, dispValue, icon, templateFn) {
        templateFn = templateFn || _.identity;
        return $('<span>').attr({
            contenteditable: false,
            draggable: true,
            'data-value': templateFn(xpath),
        }).append(icon).append(dispValue);
    }

    function makeOutputValue(xpath, dispValue, icon) {
        return makeBubble(xpath, dispValue, icon, function(path) {
            return '<output value="' + path + '" />';
        });
    }

    describe("Rich text utilities", function() {
        // path, display value, icon
        var conversions = [
            ['/data/text', 'text', icon('fcc-fd-text')],
            ["instance('casedb')/cases/case[@case_id = /data/case_id]/blah", 'blah', externalIcon()],
            ["instance('casedb')/cases/case[@case_id = /data/case_id]", 'case', externalIcon()],
            ["/data/where-did-this-come-from", 'where-did-this-come-from', unknownIcon()],
        ];

        _.each(conversions, function(val) {
            it("from text to html: " + val[0], function() {
                assert.strictEqual(
                    widgets.util.replaceOuputRef(formShim, val[0]).html(),
                    makeBubble(val[0], val[1], val[2]).html()
                );
            });

            it("from text to html with output value: " + val[0], function() {
                assert.strictEqual(
                    widgets.util.replaceOuputRef(formShim, val[0], false, true).html(),
                    makeOutputValue(val[0], val[1], val[2]).html()
                );
            });
        });
    });
});
