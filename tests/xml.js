require([
    'jquery',
    'chai',
    'vellum/xml'
], function (
    $,
    chai,
    xml
) {
    var assert = chai.assert;

    describe("The XML normalizer", function () {
        function eq(value, escaped) {
            assert.strictEqual(xml.normalize(value), escaped);
        }

        it("should preserve empty string", function () {
            eq('', '');
        });

        it("should preserve space", function () {
            eq(' ', ' ');
        });

        it("should preserve newline", function () {
            eq(' ', ' ');
        });

        it("should preserve empty XML node", function () {
            eq('<output />', '<output />');
        });

        it("should escape & character", function () {
            eq('Mother & Child Reunion', 'Mother &amp; Child Reunion');
        });

        it("should escape attribute value with < character", function () {
            eq('<output value="2 < 3" />', '<output value="2 &lt; 3" />');
        });

        it("should escape attribute value with > character", function () {
            eq('<output value="2 > 3" />', '<output value="2 &gt; 3" />');
        });

        it("should escape attribute value with <= character", function () {
            eq('<output value="2 <= 3" />', '<output value="2 &lt;= 3" />');
        });

        it("should escape attribute value with >= character", function () {
            eq('<output value="2 >= 3" />', '<output value="2 &gt;= 3" />');
        });

        it("should escape attribute value with < tight", function () {
            eq('<output value="2<3" />', '<output value="2&lt;3" />');
        });

        it("should escape attribute value with > tight", function () {
            eq('<output value="2>3" />', '<output value="2&gt;3" />');
        });

        it("should escape < character", function () {
            eq('your visit count must be < 5', 'your visit count must be &lt; 5');
        });

        it("should escape > character", function () {
            eq('your visit count must be > 5', 'your visit count must be &gt; 5');
        });

        it("should escape < character before tag", function () {
            // immortalizing https://github.com/dimagi/Vellum/pull/212
            eq('your visit count must be < <output value="/path" />',
               'your visit count must be &lt; <output value="/path" />');
        });

        it("should escape > character before tag", function () {
            eq('your visit count must be > <output value="/path" />',
               'your visit count must be &gt; <output value="/path" />');
        });

        it("should preserve attribute value with path", function () {
            eq('<output value="/path" />', '<output value="/path" />');
        });

        it("should preserve output node with text before", function () {
            eq('text <output value="/path" />', 'text <output value="/path" />');
        });

        it("should preserve output node with text after", function () {
            eq('<output value="/path" /> text', '<output value="/path" /> text');
        });

        it("should preserve attribute without value", function () {
            eq('<output attr />', '<output attr="" />');
        });

        it("should preserve attribute value with path, unterminated tag", function () {
            eq('<output value="/path">', '<output value="/path" />');
        });

        it("should preserve newline", function () {
            eq('line 1\nline2', 'line 1\nline2');
        });

        it("should preserve newline in attribute value", function () {
            eq('<output value="selected(/path,\n2)" />',
               '<output value="selected(/path,\n2)" />');
        });

        it("should preserve attribute with unquoted value", function () {
            eq('<output attr=value />', '<output attr="value" />');
        });

        it("should accept jquery node", function () {
            eq($('<output />'), '<output />');
        });

        /* -- The following are lossy -- */

        it("should handle malformed tag", function () {
            // big loss here
            eq('<output value="/path"', ''); //'<output value="/path" />');
        });

        it("should replace &nbsp; with space", function () {
            eq('a &nbsp; b', 'a   b');
        });
    });
});
