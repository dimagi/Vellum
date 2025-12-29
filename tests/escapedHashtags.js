import _ from "underscore";
import chai from "chai";
import escapedHashtags from "vellum/escapedHashtags";
import util from "tests/utils";
import INVALID_XPATH_XML from "static/escapedHashtags/invalid-xpath.xml";

var assert = chai.assert;

describe("The escaped hashtag parser", function () {
    function transformToProperty(input) {
        var ret = input.split('/');
        return ret[ret.length-1];
    }

    var hashtagMap = {
            "#form/text1": "/data/text1",
            "#form/text2": "/data/text2",
        },
        hashtagInfo = {
            hashtagMap: hashtagMap,
            invertedHashtagMap: _.invert(hashtagMap),
            hashtagNamespaces: {form: true, "case": true},
        };

    describe("#transform()", function() {
        var testCases = [
            ["`#case/type/prop`", "#case/type/prop", "prop"],
            ["`#case/type/prop`- 1", "#case/type/prop - 1", "prop - 1"],
            ["(`#case/type/prop`)", "(#case/type/prop)", "(prop)"],
            ["(`#case/type/prop`", "(#case/type/prop", "(prop"],
            [
                "`#case/type/prop` = `#case/type/prop2`",
                "#case/type/prop = #case/type/prop2",
                "prop = prop2",
            ],
            ["``", "`", "`"],
            ["🍊you glad I didn't use 🍌`", "🍊you glad I didn't use 🍌`", "🍊you glad I didn't use 🍌`"],
            ["`🍠", "`🍠", "`🍠"], // u1f360 conflicts with ` (u0060)
            ["`#case/type/prop` = `", "#case/type/prop = `",  "prop = `"],
            ["`#case/type/prop` = ``", "#case/type/prop = `", "prop = `"],
            ["`#case/prop1``#case/prop2` = ``", "#case/prop1#case/prop2 = `", "prop1prop2 = `"],
            ["``#case/type/``prop` = ``", "`#case/type/`prop = `", "`#case/type/`prop = `"],
        ];

        testCases.forEach(function (testCase) {
            var input = testCase[0],
                outputNoTransform = testCase[1],
                outputToProp = testCase[2];

            it("default transform should parse " + input + " into " + outputNoTransform, function() {
                assert.strictEqual(escapedHashtags.transform(input), outputNoTransform);
            });

            it("custom transform should parse " + input + " into " + outputToProp, function() {
                assert.strictEqual(escapedHashtags.transform(input, transformToProperty), outputToProp);
            });
        });
    });

    describe("#makeHashtagTransform() with #delimit()", function() {
        // Note: this combination is not currently used in production, but
        // it's a good test for makeHashtagTransform
        var testCases = [
                ["#form/text1", "`#form/text1`"],
                ["/data/text1", "`#form/text1`"],
                ["`#form/text1`", "`#form/text1`"],  // invalid xpath

                ["#form/text1 -1", "`#form/text1` - 1"],
                ["/data/text1 -1", "`#form/text1` - 1"],
                // invalid xpath, parse error -> no change
                ["`#form/text1`-1", "`#form/text1`-1"],
            ],
            transform = escapedHashtags.makeHashtagTransform(hashtagInfo),
            delimit = escapedHashtags.delimit;

        testCases.forEach(function(testCase) {
            it("should parse " + testCase[0] + " into " + testCase[1], function() {
                assert.strictEqual(transform(testCase[0], delimit), testCase[1]);
            });
        });
    });
});

describe("The form's escaped hashtag parser with rich_text disabled", function() {
    before(function (done) {
        util.init({
            javaRosa: { langs: ['en'] },
            core: {
                onReady: function () {
                    done();
                }
            },
            features: {rich_text: false},
        });
    });

    it("reads invalid xpath with #invalid", function () {
        util.loadXML(INVALID_XPATH_XML);
        var text = util.getMug('text'),
            hidden = util.getMug('hidden');
        assert.strictEqual(text.p.relevantAttr, '(/data/hidden');
        assert.strictEqual(hidden.p.calculateAttr, '#form/text');
    });
});

describe("The escaped hashtag", function () {
    before(function (done) {
        util.init({
            javaRosa: { langs: ['en'] },
            core: {
                onReady: function () {
                    done();
                }
            },
        });
    });

    it("writes invalid xpath with #invalid", function () {
        util.loadXML("");
        var text = util.addQuestion('Text', 'text'),
            hidden = util.addQuestion('DataBindOnly', 'hidden');
        text.p.relevantAttr = '#invalid/xpath (`#form/hidden`';
        hidden.p.calculateAttr = '#form/text';
        util.assertXmlEqual(
            util.call("createXML"),
            INVALID_XPATH_XML,
            {normalize_xmlns: true}
        );
    });
});
