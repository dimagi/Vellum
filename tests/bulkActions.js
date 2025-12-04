import chai from "chai";
import $ from "jquery";
import _ from "underscore";
import util from "tests/utils";
import "vellum/richText";
import "vellum/javaRosa/util";

var assert = chai.assert,
    CASE_DATA = [{
        id: "commcaresession",
        uri: "jr://instance/session",
        path: "/session",
        name: "Session",
        structure: {
            data: {
                merge: true,
                structure: {
                    "case_id": {
                        reference: {
                            hashtag: "#case",
                            source: "casedb",
                            subset: "case",
                            subset_key: "@case_type",
                            key: "@case_id",
                        },
                    },
                },
            },
            context: {
                merge: true,
                structure: {
                    "userid": {
                        reference: {
                            hashtag: "#user",
                            source: "casedb",
                            subset: "commcare-user",
                            subset_key: "@case_type",
                            subset_filter: true,
                            key: "hq_user_id",
                        },
                    },
                },
            },
        },
    }, {
        id: "casedb",
        uri: "jr://instance/casedb",
        path: "/casedb/case",
        name: "Cases",
        structure: {
            name: {},
        },
        subsets: [{
            id: "case",
            name: "release",
            key: "@case_type",
            structure: {
                release_date: {},
                release_length: {},
                contact_number: {},
                format: {},
                genres: {},
                case_name: {},
                quantity: {},
                footnote: {},
            },
        }, {
            id: "commcare-user",
            name: "user",
            key: "@case_type",
            structure: {
                role: {},
                footnote: {},
            },
        }],
    }];


describe("Bulk form actions", function() {

    describe("should make all applicable questions required", function () {
        function test(qType, isRequired) {
            var requiredStatus = isRequired ? " is marked as required" : " is ignored";
            it("question " + qType + requiredStatus, function () {
                var mug = map[qType];
                if (isRequired) {
                    assert(mug.p.requiredAttr, "required is false");
                } else {
                    assert(!mug.p.requiredAttr, "required is true");
                }
            });
        }
        var form, map = {};
        before(function () {
            form = util.loadXML("");
            map.Text = util.addQuestion("Text");
            map.PhoneNumber = util.addQuestion("PhoneNumber");
            map.HiddenValue = util.addQuestion("DataBindOnly");
            map.Select = util.addQuestion("Select");
            map.Choice = util.addQuestion("Choice");
            map.Label = util.addQuestion("Trigger");
            map.Group = util.addQuestion("Group", "groupA");
            map.TextInGroup = util.addQuestion.bind({prevId: "groupA"})("Text", 'text2');
            map.DataBindOnlyInGroup = util.addQuestion.bind({prevId: "groupA"})("DataBindOnly", 'hidden2');
            form.vellum.makeAllQuestionsRequired();
        });

        test("Text", true);
        test("PhoneNumber", true);
        test("HiddenValue", false);
        test("Select", true);
        test("Choice", false);
        test("Label", false);
        test("Group", false);
        test("TextInGroup", true);
        test("DataBindOnlyInGroup", false);
    });

    describe("should set matching case properties as default values on applicable question types", function () {
        var form, map = {};

        function test(qType, isMatching, existingDefault) {
            var defaultStatus = existingDefault ? " matched the existing default value" : " was not applicable",
                matchingStatus = isMatching ? " matches the expected case property" : defaultStatus;
            it("the default value for " + qType + matchingStatus, function () {
                var mug = map[qType];
                if (isMatching) {
                    assert(mug.p.defaultValue === '#case/' + mug.p.nodeID, "default value didn't match the case property");
                } else if (existingDefault) {
                    assert(mug.p.defaultValue === existingDefault, "the default value changed");
                } else {
                    assert(!mug.p.defaultValue, "the default value was set");
                }
            });
        }

        before(function (done) {
            util.init({
                javaRosa: { langs: ['en'] },
                core: {
                    dataSourcesEndpoint: function (callback) { callback(CASE_DATA); },
                    onReady: function () {
                        map.MatchingText = util.addQuestion("Text", "release_date", {defaultValue: "existing default"});
                        map.MatchingHiddenValue = util.addQuestion("DataBindOnly", "release_length");
                        map.MatchingPhoneNumber = util.addQuestion("PhoneNumber", "contact_number");
                        map.MatchingSelect = util.addQuestion("Select", "format");
                        map.ChoiceOfMatchingSelect = util.addQuestion("Choice", "vinyl");
                        map.Text = util.addQuestion("Text", 'no_match_01', {defaultValue: "already set"});
                        map.HiddenValue = util.addQuestion("DataBindOnly", "no_match_02", {defaultValue: "already set"});
                        map.Label = util.addQuestion("Trigger", "no_match_03");
                        map.Group = util.addQuestion("Group", "groupA");
                        map.MatchingTextInGroup = util.addQuestion.bind({prevId: "groupA"})("Text", 'quantity', {defaultValue: "existing default"});
                        map.MatchingHiddenValueInGroup = util.addQuestion.bind({prevId: "groupA"})("DataBindOnly", 'genres');
                        map.TextInGroup = util.addQuestion.bind({prevId: "groupA"})("Text", 'no_match_04', {defaultValue: "already set"});
                        map.HiddenValueInGroup = util.addQuestion.bind({prevId: "groupA"})("DataBindOnly", 'no_match_05', {defaultValue: "already set"});
                        map.userCaseProp = util.addQuestion("DataBindOnly", "role");
                        map.similarCaseProp = util.addQuestion("DataBindOnly", "footnote");
                        form = this.data.core.form;
                        form.vellum.defaultMatchingQuestionsToCaseProperties();
                        done();
                    },
                },
            });
        });

        test("MatchingText", true);
        test("MatchingHiddenValue", true);
        test("MatchingPhoneNumber", true);
        test("MatchingSelect", true);
        test("ChoiceOfMatchingSelect", false);
        test("Text", false, "already set");
        test("HiddenValue", false, "already set");
        test("Label", false);
        test("Group", false);
        test("MatchingTextInGroup", true);
        test("MatchingHiddenValueInGroup", true);
        test("TextInGroup", false, "already set");
        test("HiddenValueInGroup", false, "already set");

        it("user case properties are also matched with priority given to case properties", function () {
            assert(map.userCaseProp.p.defaultValue === '#user/' + map.userCaseProp.p.nodeID, "user case property was not set as default");
            assert(map.similarCaseProp.p.defaultValue === '#case/' + map.similarCaseProp.p.nodeID, "case property was not given priority over user case property");
        });

    });

});
