import chai from "chai";
import { compareCaseMappings } from "vellum/caseDiff";

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
            update: {one: [{question_path: "/data/first", update_mode: "edit"}]}
        });
    });

    it("should update on update_mode changed", function () {
        const baseline = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        const incoming = {one: [{question_path: "/data/first", update_mode: "always"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            update: {one: [{question_path: "/data/first", update_mode: "always"}]}
        });
    });

    it("should update on update_mode removed", function () {
        const baseline = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        const incoming = {one: [{question_path: "/data/first"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {
            update: {one: [{question_path: "/data/first"}]}
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

    it("should return empty diff when mappings are identical", function () {
        const baseline = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        const incoming = {one: [{question_path: "/data/first", update_mode: "edit"}]};
        assert.deepEqual(compareCaseMappings(baseline, incoming), {});
    });
});
