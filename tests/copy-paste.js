require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/copy-paste/text-question.xml',
    'vellum/copy-paste',
    'vellum/tsv'
], function (
    chai,
    $,
    _,
    util,
    TEXT_QUESTION_XML,
    mod,
    tsv
) {
    var assert = chai.assert,
        call = util.call;

    function eq(serial, rows, message) {
        util.assertEqual(serial + "\n", rows + "\n", message);
    }

    describe("The copy-paste plugin", function () {
        before(function (done) {
            util.init({
                javaRosa: { langs: ['en', 'hin'] },
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("copyPaste"),
                               "copyPaste plugin should be enabled");
                        done();
                    }
                }
            });
        });

        it("should copy a text question", function () {
            util.loadXML(TEXT_QUESTION_XML);
            eq(mod.copy(), TEXT_SERIAL);
        });

        it("should paste a text question", function () {
            util.loadXML("");
            assert.deepEqual(mod.paste(TEXT_SERIAL), []);
            util.assertXmlEqual(call("createXML"), TEXT_QUESTION_XML, {normalize_xmlns: true});
        });

        // TODO test each mug spec item
        // TODO test bad paste values
        // TODO insert question with same nodeID
        // TODO find a case where, when copying multiple questions, one
        //      ends up with a null value on a property that it did not
        //      return from mug.serialize(), and should not be passed
        //      to mug.deserialize().
        //      ALSO maybe find the converse: property serializes to null
        //      but that null value must be passed to mug.deserialize()
    });

    describe("The copy-paste string conversions should", function () {
        function test(value, string) {
            var json = JSON.stringify(value),
                jstr = JSON.stringify(string);

            it("stringify(" + json + ") -> " + jstr, function () {
                assert.deepEqual(mod.stringify(value), string);
            });

            it(" valuify(" + jstr + ") -> " + json, function () {
                assert.deepEqual(mod.valuify(string), value);
            });
        }

        // primitives
        test(null, 'null');
        test(true, 'true');
        test(false, 'false');
        test("null", '"null"');
        test("true", '"true"');
        test("false", '"false"');

        // JSON-like values
        test([], '[]');
        test({}, '{}');
        test('', '');
        test('x', 'x');
        test('"', '"');
        test('[\n]', '"[\\n]"');
        test("{\n}", '"{\\n}"');
        test('"\n"', '"\\"\\n\\""');

        // numbers
        test(0, '0');
        test(1, '1');
        test(350, '350');
        test(0.5, '0.5');
        test(-1.2e-10, '-1.2e-10');
        test("0", '"0"');
        test("1", '"1"');
        test("350", '"350"');
        test("0.5", '"0.5"');
        test("-1.2e-10", '"-1.2e-10"');

        // edge cases
        (function (undefined) {
            // is this what we want? does it matter?
            test(undefined, undefined);
        })();
        test("{1} ", "{1} ");
        test("{1} {2}", '"{1} {2}"');
        test("[1] [2]", '"[1] [2]"');
        test("01", '"01"');
    });

    var TEXT_SERIAL = tsv.tabDelimit([
        ["vellum copy/paste", "version 1"],
        [
            "type",
            "id",
            "relevantAttr",
            "constraintAttr",
            "requiredAttr",
            "labelItext:en-default",
            "labelItext:hin-default",
            "constraintMsgItext:en-default",
            "constraintMsgItext:hin-default",
        ], [
            "Text",
            "/txt",
            "x = y",
            "1 = 0",
            "true",
            "English Text",
            "Hindi Text",
            "Nope",
            "Nope",
        ]
    ]);
});
