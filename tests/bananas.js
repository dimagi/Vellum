define([
    'chai',
    'vellum/bananas',
    'vellum/xpath',
], function (
    chai,
    bananas,
    xpath
) {
    var assert = chai.assert;

    describe("The 🍌 parser", function () {
        function transformToProperty(input) {
            var ret = input.split('/');
            return ret[ret.length-1];
        }

        var testCases = [
            ["🍌#case/type/prop🍌", "#case/type/prop", "prop"],
            ["(🍌#case/type/prop🍌)", "(#case/type/prop)", "(prop)"],
            ["(🍌#case/type/prop🍌", "(#case/type/prop", "(prop"],
            [
                "🍌#case/type/prop🍌 = 🍌#case/type/prop2🍌",
                "#case/type/prop = #case/type/prop2",
                "prop = prop2",
            ],
            ["🍌🍌", "🍌", "🍌"],
            ["🍊you glad I didn't use 🍌", "🍊you glad I didn't use 🍌", "🍊you glad I didn't use 🍌"],
            ["🍌#case/type/prop🍌 = 🍌", "#case/type/prop = 🍌",  "prop = 🍌"],
            ["🍌#case/type/prop🍌 = 🍌🍌", "#case/type/prop = 🍌", "prop = 🍌"],
            ["🍌#case/type/🍌🍌prop🍌 = 🍌🍌", "#case/type/🍌prop = 🍌", "🍌prop = 🍌"],
            ["🍌🍌#case/type/🍌🍌prop🍌 = 🍌🍌", "🍌#case/type/🍌prop🍌 = 🍌", "🍌#case/type/🍌prop🍌 = 🍌"],
        ];

        describe("#toBanana()", function() {
            var testCases = [
                    ["#form/text1", "🍌#form/text1🍌"],
                    ["/data/text1", "🍌#form/text1🍌"],
                    ["🍌#form/text1🍌", "🍌#form/text1🍌"],
                ],
                translationDict = {
                    "#form/text1": "/data/text1",
                    "#form/text2": "/data/text2",
                },
                xpathParser = xpath.createParser(xpath.makeXPathModels(translationDict));

            testCases.forEach(function(testCase) {
                it("should parse " + testCase[0] + " into " + testCase[1], function() {
                    assert.strictEqual(bananas.toBanana(testCase[0], xpathParser), testCase[1]);
                });
            });
        });

        describe("#toXPath()", function() {
            var testCases = [
                    ["🍌#form/text1🍌", "/data/text1"],
                ],
                translationDict = {
                    "#form/text1": "/data/text1",
                    "#form/text2": "/data/text2",
                },
                xpathParser = xpath.createParser(xpath.makeXPathModels(translationDict));

            testCases.forEach(function(testCase) {
                it("should parse " + testCase[0] + " into " + testCase[1], function() {
                    assert.strictEqual(bananas.toXPath(testCase[0], xpathParser), testCase[1]);
                });
            });
        });

        testCases.forEach(function (testCase) {
            var input = testCase[0],
                outputNoTransform = testCase[1],
                outputToProp = testCase[2];

            it("default transform should parse " + input + " into " + outputNoTransform, function() {
                assert.strictEqual(bananas.transform(input), outputNoTransform);
            });

            it("custom transform should parse " + input + " into " + outputToProp, function() {
                assert.strictEqual(bananas.transform(input, transformToProperty), outputToProp);
            });
        });
    });
});
