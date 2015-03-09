require([
    'jquery',
    'underscore',
    'chai',
    'vellum/xml'
], function (
    $,
    _,
    chai,
    xml
) {
    var assert = chai.assert;

    describe("The XML normalizer", function () {
        function eq(value, escaped, humanize) {
            var normal = xml.normalize(value);
            assert.strictEqual(normal, escaped);
            if (_.isUndefined(humanize) || humanize) {
                assert.strictEqual(xml.humanize(normal), value);
            }
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
            eq('<output value="2<3" />', '<output value="2&lt;3" />', false);
        });

        it("should escape attribute value with > tight", function () {
            eq('<output value="2>3" />', '<output value="2&gt;3" />', false);
        });

        it("should escape < character", function () {
            eq('your visit count must be < 5', 'your visit count must be &lt; 5');
        });

        it("should escape > character", function () {
            eq('your visit count must be > 5', 'your visit count must be &gt; 5');
        });

        it("should escape attribute value with > and trailing text (v1)", function () {
            eq('<output value="2 > 3" /> text',
               '<output value="2 &gt; 3" /> text');
        });

        it("should escape attribute value with > and trailing text (v2)", function () {
            eq("<output value='2 > 3' /> text",
               '<output value="2 &gt; 3" /> text', false);
        });

        it("should escape attribute value with > and trailing text (v3)", function () {
            eq('<output value="2 > 3"/>text',
               '<output value="2 &gt; 3" />text', false);
        });

        it("should escape attribute value with > and trailing text (v4)", function () {
            eq('<output value="2 > 3"></output> text',
               '<output value="2 &gt; 3" /> text', false);
        });

        it("should escape attribute value with > and trailing text (v5)", function () {
            eq('<out:p_3-6. h:v-1._="2 > 3" />text',
               '<out:p_3-6. h:v-1._="2 &gt; 3" />text');
        });

        it("should escape attribute value with < and trailing text", function () {
            eq('<output value="2 < 3" /> text',
               '<output value="2 &lt; 3" /> text');
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
            eq('<output attr />', '<output attr="" />', false);
        });

        it("should preserve attribute value with path, unterminated tag", function () {
            eq('<output value="/path">', '<output value="/path" />', false);
        });

        it("should preserve newline", function () {
            eq('line 1\nline2', 'line 1\nline2');
        });

        it("should preserve newline in attribute value", function () {
            eq('<output value="selected(/path,\n2)" />',
               '<output value="selected(/path,\n2)" />');
        });

        it("should preserve attribute with unquoted value", function () {
            eq('<output attr=value />', '<output attr="value" />', false);
        });

        it("should accept jquery node", function () {
            eq($('<value><output /></value>'), '<output />', false);
        });

        /* -- The following are lossy -- */

        it("should handle malformed tag", function () {
            // big loss here
            eq('<output value="/path"', '', false);
        });

        it("should replace &nbsp; with space", function () {
            eq('a &nbsp; b', 'a   b', false);
        });
    });

    describe("The XML humanizer", function () {
        function eq(value, humanized, normalize) {
            var human = xml.humanize(value);
            assert.strictEqual(human, humanized);
            if (normalize) {
                assert.strictEqual(xml.normalize(human), value);
            }
        }

        it("should convert free < character", function () {
            eq('2 &lt; 3', '2 < 3', true);
        });

        it("should convert free > character", function () {
            eq('2 &gt; 3', '2 > 3', true);
        });

        it("should convert free & character", function () {
            eq('2 &amp; 3', '2 & 3', true);
        });

        it("should not convert escaped tag", function () {
            eq(' &lt;div&gt; ', ' &lt;div&gt; ', true);
        });

        it("should convert output tag", function () {
            eq('<output value="1 &amp; 2 &lt; 3" />',
               '<output value="1 & 2 < 3" />', true);
        });

        it("should convert child nodes", function () {
            var value = "<value>1 &amp; 2 &lt; 3 <output value='/path' /></value>";
            eq($(value), '1 & 2 < 3 <output value="/path" />');
        });

        it("should convert child output node", function () {
            var value = "<value><output value='1 &amp; 2 &lt; 3' /></value>";
            eq($(value), '<output value="1 & 2 < 3" />');
        });

        it("should convert empty child nodes", function () {
            eq($("<value />"), "");
        });

        it("should space child node", function () {
            eq($("<value> </value>"), " ");
        });

        it("should newline child node", function () {
            eq($("<value>\n</value>"), "\n");
        });
    });
});
