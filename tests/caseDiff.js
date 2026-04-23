import chai from "chai";
import { compareCaseMappings, formatCaseMappingDiff } from "vellum/caseDiff";

const assert = chai.assert;

describe("The Case Management diff tool", function () {
    it("should return empty diff for empty mappings", function () {
        const baseline = {};
        const incoming = {};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {});
    });

    it("should add new mapping", function () {
        const baseline = {};
        const incoming = {one: [{question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            add: {one: [{question_path: "/data/first"}]}
        });
    });

    it("should add new question_path for existing key", function () {
        const baseline = {one: [{question_path: "/data/first"}]};
        const incoming = {one: [{question_path: "/data/first"}, {question_path: "/data/second"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            add: {one: [{question_path: "/data/second"}]}
        });
    });

    it("should update on update_mode added", function () {
        const baseline = {one: [{question_path: "/data/first"}]};
        const incoming = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first"}]},
            add: {one: [{question_path: "/data/first", update_mode: "edit"}]},
        });
    });

    it("should update on update_mode changed", function () {
        const baseline = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        const incoming = {one: [{question_path: "/data/first", update_mode: "always"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first", update_mode: "edit"}]},
            add: {one: [{question_path: "/data/first", update_mode: "always"}]},
        });
    });

    it("should update on update_mode removed", function () {
        const baseline = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        const incoming = {one: [{question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first", update_mode: "edit"}]},
            add: {one: [{question_path: "/data/first"}]},
        });
    });

    it("should delete mapping", function () {
        const baseline = {one: [{question_path: "/data/first"}]};
        const incoming = {};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first"}]}
        });
    });

    it("should delete question_path from existing key", function () {
        const baseline = {one: [{question_path: "/data/first"}, {question_path: "/data/second"}]};
        const incoming = {one: [{question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/second"}]}
        });
    });

    it("should add duplicate question mapping", function () {
        const baseline = {one: [{question_path: "/data/first"}]};
        const incoming = {one: [{question_path: "/data/first"}, {question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            add: {one: [{question_path: "/data/first"}]}
        });
    });

    it("should delete duplicate question mapping", function () {
        const baseline = {one: [{question_path: "/data/first"}, {question_path: "/data/first"}]};
        const incoming = {one: [{question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first"}]}
        });
    });

    it("should delete duplicate question mapping with differing update_modes", function () {
        const baseline = {one: [
            {question_path: "/data/first", update_mode: "always"},
            {question_path: "/data/first", update_mode: "edit"},
        ]};
        const incoming = {one: [
            {question_path: "/data/first", update_mode: "always"},
        ]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first", update_mode: "edit"}]}
        });
    });

    it("should add duplicate question mapping with differing update_modes", function () {
        const baseline = {one: [
            {question_path: "/data/first", update_mode: "always"},
        ]};
        const incoming = {one: [
            {question_path: "/data/first", update_mode: "always"},
            {question_path: "/data/first", update_mode: "edit"},
        ]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            add: {one: [{question_path: "/data/first", update_mode: "edit"}]}
        });
    });

    it("should add triplicate question mapping", function () {
        const baseline = {one: [{question_path: "/data/first"}]};
        const incoming = {one: [
            {question_path: "/data/first"},
            {question_path: "/data/first"},
            {question_path: "/data/first"},
        ]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            add: {one: [{question_path: "/data/first"}, {question_path: "/data/first"}]}
        });
    });

    it("should delete triplicate question mapping", function () {
        const baseline = {one: [
            {question_path: "/data/first"},
            {question_path: "/data/first"},
            {question_path: "/data/first"},
        ]};
        const incoming = {one: [{question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first"}, {question_path: "/data/first"}]}
        });
    });

    it("should add triplicate question mapping v2", function () {
        const baseline = {one: [
            {question_path: "/data/first"},
            {question_path: "/data/first"},
        ]};
        const incoming = {one: [
            {question_path: "/data/first"},
            {question_path: "/data/first"},
            {question_path: "/data/first"},
        ]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            add: {one: [{question_path: "/data/first"}]}
        });
    });

    it("should delete triplicate question mapping v2", function () {
        const baseline = {one: [
            {question_path: "/data/first"},
            {question_path: "/data/first"},
            {question_path: "/data/first"},
        ]};
        const incoming = {one: [
            {question_path: "/data/first"},
            {question_path: "/data/first"},
        ]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {one: [{question_path: "/data/first"}]}
        });
    });

    it("should handle duplicate question mappings for different case properties", function () {
        const baseline = {
            one: [
                {question_path: "/data/first"},
                {question_path: "/data/first"},
            ],
            two: [
                {question_path: "/data/first"},
                {question_path: "/data/first"},
            ],
        };
        const incoming = {
            one: [{question_path: "/data/first"}],
            two: [{question_path: "/data/first"}],
        };
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            delete: {
                one: [{question_path: "/data/first"}],
                two: [{question_path: "/data/first"}],
            }
        });
    });

    it("should return empty diff when mappings are identical", function () {
        const baseline = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        const incoming = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {});
    });
});

describe("The Case Management diff formatter", () => {
    it("should keep all mappings in 'update_case' for non-registration form", () => {
        const diff = {
            add: {name: [{question_path: "/data/one"}]},
            delete: {name: [{question_path: "/data/two"}]},
        };
        assert.deepEqual(formatCaseMappingDiff(diff), {
            "update_case": {
                add: {name: [{question_path: "/data/one"}]},
                delete: {name: [{question_path: "/data/two"}]},
            },
        });
    });

    it("should put 'name' mappings in 'open_case' for registration form", () => {
        const diff = {
            add: {
                name: [{question_path: "/data/one"}],
                age: [{question_path: "/data/two"}],
                dob: [{question_path: "/data/three"}],
            },
            delete: {
                name: [{question_path: "/data/four"}],
                age: [{question_path: "/data/five"}],
                dob: [{question_path: "/data/six"}],
            },
        };
        assert.deepEqual(formatCaseMappingDiff(diff, true), {
            "open_case": {
                add: [{question_path: "/data/one"}],
                delete: [{question_path: "/data/four"}],
            },
            "update_case": {
                add: {
                    age: [{question_path: "/data/two"}],
                    dob: [{question_path: "/data/three"}],
                },
                delete: {
                    age: [{question_path: "/data/five"}],
                    dob: [{question_path: "/data/six"}],
                },
            }
        });
    });

    it("should handle missing 'delete' for registration form", () => {
        const diff = {
            add: {
                name: [{question_path: "/data/one"}],
                age: [{question_path: "/data/two"}],
            },
        };
        assert.deepEqual(formatCaseMappingDiff(diff, true), {
            "open_case": {
                add: [{question_path: "/data/one"}],
            },
            "update_case": {
                add: {age: [{question_path: "/data/two"}]},
            }
        });
    });

    it("should handle missing 'add' for registration form", () => {
        const diff = {
            delete: {
                name: [{question_path: "/data/three"}],
                age: [{question_path: "/data/four"}],
            },
        };
        assert.deepEqual(formatCaseMappingDiff(diff, true), {
            "open_case": {
                delete: [{question_path: "/data/three"}],
            },
            "update_case": {
                delete: {age: [{question_path: "/data/four"}]},
            }
        });
    });
});
