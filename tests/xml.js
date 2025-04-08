define([
    'jquery',
    'underscore',
    'chai',
    'vellum/xml',
    'static/xml/regexp-crashing-debug-itext.xml',
    'static/xml/regexp-crashing-debug-itext-parsed.xml',
    'static/xml/slow-regexp-itext.xml',
], function (
    $,
    _,
    chai,
    xml,
    REGEXP_CRASHING_DEBUG_ITEXT,
    REGEXP_CRASHING_DEBUG_ITEXT_PARSED,
    SLOW_REGEXP_ITEXT
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

        // Commenting out for now, tabled to fix later
        // it("should preserve newline in attribute value", function () {
        //     eq('<output value="selected(/path,\n2)" />',
        //        '<output value="selected(/path,\n2)" />');
        // });

        it("should preserve attribute with unquoted value", function () {
            eq('<output attr=value />', '<output attr="value" />', false);
        });

        it("should escape unquoted attribute value with <", function () {
            eq('<output value=2<3 />', '<output value="2&lt;3" />', false);
        });

        it("should fail on escape attribute value with />", function () {
            // known failure; mangled output:
            //   <output value="..&gt;&lt;/output&gt;.." />
            chai.expect(function () {
                eq('<output value="../>.." />', '<output value="..&gt;.." />', false);
            }).to.throw(Error);
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

        it("should not cause regexp engine to hang on many output values in jquery object", function () {
            // This is a pretty arcane test. The XML in this test caused
            // an exponential performance degredation (more tags made
            // normalization slower) in Chrome and Firefox.
            var parsedXml = xml.parseXML(REGEXP_CRASHING_DEBUG_ITEXT),
                value = parsedXml.find("value");
            eq(value, REGEXP_CRASHING_DEBUG_ITEXT_PARSED, false);
        });

        it("should not cause regexp engine to hang on many output values in string", function () {
            // similar to above test, but also tests fixGTBug, which uses a similar regexp
            // NOTE this test fails on Firefox because attribute order is changed
            var parsedXml = xml.parseXML(REGEXP_CRASHING_DEBUG_ITEXT),
                serializer = new XMLSerializer(),
                wrapper = /^<([\w:.-]+)(?:\s+[\w:.-]+=(["'])[^]*?\2)*\s*(?:\/>|>([^]*)<\/\1>)$/g,
                value = serializer.serializeToString(parsedXml.find("value")[0])
                    .replace(/(value="[^"]+)"/g, '$1 > 2"')
                    .replace(wrapper, "$3"),
                parsed = REGEXP_CRASHING_DEBUG_ITEXT_PARSED
                    .replace(/(value="[^"]+)"/g, '$1 &gt; 2"')
                    .replace(/"\/>/g, '" />');
            eq(value, parsed, false);
        });

        it("should not cause regexp engine to hang on many output values in string #2", function () {
            eq(SLOW_REGEXP_ITEXT, SLOW_REGEXP_ITEXT.replace(/><\/output>/g, " \/>"), false);
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

        it("should not unescape '&amp;' when part of a double escaped character", function () {
            eq('&amp;amp;', '&amp;amp;', true);
        });

        it("should not convert escaped tag with attribute", function () {
            eq('&lt;div class="injection"&gt;', '&lt;div class="injection"&gt;', true);
        });

        it("should convert empty tag", function () {
            eq('<tag attr="value"></tag>', '<tag attr="value" />');
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

        it("should not cause regexp engine to hang on many output values", function () {
            var parsedXml = xml.parseXML(REGEXP_CRASHING_DEBUG_ITEXT),
                value = parsedXml.find("value");
            eq(value, REGEXP_CRASHING_DEBUG_ITEXT_PARSED, false);
        });

        it("should not wrap trailing text in output refs", function () {
            var value = "<value>&amp; <output value='/path' /> " +
                "text-after *should* remain. ~&amp; not #disrupt the\nflow" +
                "</value>";
            eq($(value), "& <output value=\"/path\" /> text-after " +
                "*should* remain. ~& not #disrupt the\nflow");
        });
    });

    describe("The XML query", function () {
        var eq = assert.strictEqual;

        it("should round-trip XML", function () {
            eq(xml.query("<value>\n</value>").toString(), "<value>\n</value>");
        });

        it("should round-trip XML fragment with leading text", function () {
            eq(xml.query("def <value>abc</value>").toString(), "def <value>abc</value>");
        });

        it("should round-trip XML fragment with trailing text", function () {
            eq(xml.query("<value>abc</value> def").toString(), "<value>abc</value> def");
        });

        it("should escape invalid XML", function () {
            eq(xml.query("<h1>a > & < b</h1>").toString(), "<h1>a &gt; &amp; &lt; b</h1>");
        });

        it("should round-trip empty string", function () {
            eq(xml.query("").toString(), "");
        });

        it("should round-trip newline", function () {
            eq(xml.query("\n").toString(), "\n");
        });

        it("should not insert text inside output refs", function () {
            // this test is verifying a quirk of jQuery 3.5.0 that results in
            // invalid XML transformations. It is not necessary to preserve
            // the behavior if/when jQuery no longer mangles XML this way.
            eq(xml.query(
                "& <output value=\"/data/question1\" " +
                "vellum:value=\"#form/question1\"> " +
                "text-after *should* remain. ~& not #disrupt the\nflow</output>"
            ).toString(),
                "&amp; <output value=\"/data/question1\" " +
                "vellum:value=\"#form/question1\" /> " +
                "text-after *should* remain. ~&amp; not #disrupt the\nflow"
            );
        });
    });
});
