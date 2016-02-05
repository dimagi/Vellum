define([
    'chai',
    'vellum/bananas',
], function (
    chai,
    bananas
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

        testCases.forEach(function (testCase) {
            var input = testCase[0],
                outputNoTransform = testCase[1],
                outputToProp = testCase[2];

            it("should parse " + input + " into " + outputNoTransform, function() {
                assert.strictEqual(bananas(input), outputNoTransform);
            });

            it("should parse " + input + " into " + outputToProp, function() {
                assert.strictEqual(bananas(input, transformToProperty), outputToProp);
            });
        });
    });
});
