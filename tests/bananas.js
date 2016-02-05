define([
    'chai',
    'vellum/bananas',
], function (
    chai,
    bananas
) {
    var assert = chai.assert;

    describe("The 🍌 parser", function () {
        var testCases = [
            ["🍌#case/type/prop🍌", "#case/type/prop", ["#case/type/prop"], "prop"],
            ["(🍌#case/type/prop🍌)", "(#case/type/prop)", ["#case/type/prop"], "(prop)"],
            ["(🍌#case/type/prop🍌", "(#case/type/prop", ["#case/type/prop"], "(prop"],
            [
                "🍌#case/type/prop🍌 = 🍌#case/type/prop2🍌",
                "#case/type/prop = #case/type/prop2",
                ["#case/type/prop", "#case/type/prop2"],
                "prop = prop2"
            ],
            ["🍌🍌", "🍌", []],
            ["🍊you glad I didn't use 🍌", "🍊you glad I didn't use 🍌", []],
            ["🍌#case/type/prop🍌 = 🍌", "#case/type/prop = 🍌", ["#case/type/prop"], "prop = 🍌"],
            ["🍌#case/type/prop🍌 = 🍌🍌", "#case/type/prop = 🍌", ["#case/type/prop"], "prop = 🍌"],
            ["🍌#case/type/🍌🍌prop🍌 = 🍌🍌", "#case/type/🍌prop = 🍌", ["#case/type/🍌prop"], "🍌prop = 🍌"],
            ["🍌🍌#case/type/🍌🍌prop🍌 = 🍌🍌", "🍌#case/type/🍌prop🍌 = 🍌", []],
        ];

        function transform(input) {
            var ret = input.split('/');
            return ret[ret.length-1];
        }

        testCases.forEach(function (testCase) {
            var input = testCase[0],
                output = testCase[1],
                references = testCase[2],
                transformed = testCase[3] || output;

            it("should parse " + input + " into " + output, function() {
                assert.strictEqual(bananas(input).text, output);
            });

            it("should return " + references + " from " + input, function() {
                assert.sameMembers(bananas(input).references, references);
            });

            it("should transform " + input + " to " + transformed, function() {
                assert.strictEqual(bananas(input, transform).text, transformed);
            });
        });
    });
});
