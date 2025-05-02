define([
    'chai',
    'vellum/tsv'
], function (
    chai,
    tsv
) {
    var assert = chai.assert;

    function parseRows(value, limit) {
        var rows = [],
            next = tsv.makeRowParser(value),
            row = next();
        while (row) {
            rows.push(row);
            if (limit && rows.length >= limit) { break; }
            row = next();
        }
        return rows;
    }

    function eq(value, parsed, roundTrip) {
        var repr = value
                    .replace(/\r/g, "\\r")
                    .replace(/\n/g, "\\n")
                    .replace(/\t/g, "\\t");
        assert.deepEqual(parseRows(value, parsed.length + 5), parsed,
                         "parsed '" + repr + "'");
        if (roundTrip) {
            assert.strictEqual(tsv.tabDelimit(parsed), value);
        }
    }

    describe("The TSV parser", function () {

        it("should parse empty string", function () {
            eq("", [], true);
        });

        it("should parse simple TSV", function () {
            eq('a\tb', [['a', 'b']], true);
            eq('a\tb\r', [['a', 'b']]);
            eq('a\tb\n', [['a', 'b']]);
            eq('a\tb\u2028', [['a', 'b']]);
            eq('a\tb\u2029', [['a', 'b']]);
            eq('a\tb\r\n', [['a', 'b']]);
            eq('a\tb\n\r', [['a', 'b'], ['']]);
        });

        it("should parse simple mutli-line TSV", function () {
            eq('a\tb\nc', [['a', 'b'], ['c']], true);
            eq('a\tb\rc\r', [['a', 'b'], ['c']]);
            eq('a\tb\nc\n', [['a', 'b'], ['c']]);
            eq('a\tb\u2028c\u2028', [['a', 'b'], ['c']]);
            eq('a\tb\u2029c\u2029', [['a', 'b'], ['c']]);
            eq('a\tb\r\nc\r\n', [['a', 'b'], ['c']]);
            eq('a\tb\n\rc\n', [['a', 'b'], [''], ['c']]);
        });

        it("should parse quoted field", function () {
            eq('a\t"b\tc"', [['a', 'b\tc']], true);
            eq('"a"\t"b\tc"\r', [['a', 'b\tc']]);
            eq('"a"\t"b\tc"\n', [['a', 'b\tc']]);
            eq('"a"\t"b\tc"\u2028', [['a', 'b\tc']]);
            eq('"a"\t"b\tc"\u2029', [['a', 'b\tc']]);
            eq('"a"\t"b\tc"\r\n', [['a', 'b\tc']]);
            eq('"a"\t"b\tc"\n\r', [['a', 'b\tc'], ['']]);

            eq('"a"\t"b\tc"\n"a"\t"b\tc"\n', [['a', 'b\tc'], ['a', 'b\tc']]);
        });

        it("should parse empty quoted field", function () {
            eq('""\t""\n', [['', '']]);
        });

        it("should parse quoted field with escaped quotes", function () {
            eq('"a""x"\t"b""\t""c"', [['a"x', 'b"\t"c']], true);
            eq('"a""x"\t"b""""""c"', [['a"x', 'b"""c']], true);

            eq('"a""x"\t"b""\t""c"\n"a""x"\t"b""\t""c"',
                [['a"x', 'b"\t"c'], ['a"x', 'b"\t"c']], true);
        });

        it("should parse quoted multi-line field", function () {
            eq('"a""x"\t"b\nc\rd\r\ne"', [['a"x', 'b\nc\rd\r\ne']], true);
            eq('"a""x"\t"b\u2028c\u2029d"', [['a"x', 'b\u2028c\u2029d']], true);

            eq('"a""x"\t"b\nc\rd\r\ne"\n"a""x"\t"b\nc\rd\r\ne"',
                [['a"x', 'b\nc\rd\r\ne'], ['a"x', 'b\nc\rd\r\ne']], true);
        });

        it("should parse malformed quoted field", function () {
            eq('abc\t"def"ghi\t"jkl', [['abc', '"def"ghi', '"jkl']]);
            eq('abc\t"def"ghi"\t"jkl', [['abc', '"def"ghi"', '"jkl']]);
            eq('abc\t"def\t"ghi\t"jkl', [['abc', '"def', '"ghi', '"jkl']]);

            // Excel produces this, we do not
            //eq('abc\t"def"ghi""\t"jkl', [['abc', '"def"ghi""\t"jkl']]);
        });

    });

    describe("The TSV writer", function () {

        it("should convert null to empty string", function () {
            assert.strictEqual(tsv.escape(null), "");
        });

        it("should convert undefined to empty string", function () {
            (function (undefined) {
                assert.strictEqual(tsv.escape(undefined), "");
            })();
        });

        it("should not convert zero to empty string", function () {
            assert.strictEqual(tsv.escape(0), "0");
        });

        it("should escape special characters", function () {
            var rows = [
                    ['""', '\t\t\t', '\n\n\n', '\r\r\r', ''],
                    ['  '] // space is not a special character
                ],
                encoded = '""""""\t"\t\t\t"\t"\n\n\n"\t"\r\r\r"\t\n  ';
            assert.strictEqual(tsv.tabDelimit(rows), encoded);

            // test round-trip for good measure
            eq(encoded, rows, true);
        });
    });
});
