/* eslint-disable no-unused-expressions */

import chai from "chai";
import $ from "jquery";
import util from "tests/utils";
import xmlLib from "vellum/xml";
import BASELINE_XML from "static/caseManagement/baseline.xml";
import BASELINE_NO_MAPPING_XML from "static/caseManagement/baseline_no_mapping_block.xml";
import MULTIPLE_PROPERTIES_XML from "static/caseManagement/multiple_properties.xml";
import EXTRA_QUESTION_ATTRS_XML from "static/caseManagement/extra_question_attrs.xml";
import PROPERTY_CONFLICT_XML from "static/caseManagement/property_conflict.xml";
import GROUP_MAPPINGS_XML from "static/caseManagement/group_mappings.xml";
import INVALID_MAPPING_XML from "static/caseManagement/invalid_mapping.xml";

const assert = chai.assert;
const call = util.call;

function getMappingAndQuestionElementsFromXML(xml) {
    const $xml = xmlLib.parseXML(xml);
    const mappings = $xml.find("vellum\\:case_mappings > mapping");
    const mappedQuestions = mappings.find("question");

    return [mappings, mappedQuestions];
}

function getCaseManagementSection() {
    const propertiesPane = $(".fd-content-right");
    return propertiesPane.find('fieldset[data-slug="caseManagement"]');
}

const CASE_PROPERTY_WIDGET_TYPE = "select";

describe("The Case Management plugin", function () {
    before(function (done) {
        util.init({
            features: {
            },
            core: {
                onReady: function () {
                    assert(this.isPluginEnabled("caseManagement"),
                           "caseManagement plugin should be enabled");
                    done();
                }
            }
        });
    });

    it("preserves case mapping between loading and writing XML", function () {
        util.loadXML(BASELINE_XML);
        const xml = call("createXML", true);
        util.assertXmlEqual(xml, BASELINE_XML);
    });

    it("outputs an empty mapping block if form lacks mappings data", function () {
        util.loadXML(BASELINE_NO_MAPPING_XML);
        const xml = call("createXML", true);
        const $xml = xmlLib.parseXML(xml);
        const mappings = $xml.find("vellum\\:case_mappings");

        // ensure the case mappings block is present, but that it contains no concrete mappings
        assert.equal(mappings.length, 1);
        assert.equal(mappings.children().length, 0);
    });

    it("should display the case management section for generic fields", function () {
        util.loadXML("");
        util.addQuestion("Text", "text");
        const caseManagementSection = getCaseManagementSection();

        assert.exists(caseManagementSection[0]);
    });

    it("should hide the case management section for labels", function () {
        util.loadXML("");
        util.addQuestion("Trigger", "label");

        assert.notExists(getCaseManagementSection()[0]);
    });

    it("should hide the case management section for normal groups" , function () {
        util.loadXML("");
        util.addQuestion("Group", "normal_group");

        assert.notExists(getCaseManagementSection()[0]);
    });

    it("should hide the case management section for repeat groups", function () {
        util.loadXML("");
        util.addQuestion("Repeat", "repeat_group");

        assert.notExists(getCaseManagementSection()[0]);
    });

    it("should hide the case management section for question lists", function () {
        util.loadXML("");
        util.addQuestion("FieldList", "question_list");

        assert.notExists(getCaseManagementSection()[0]);
    });

    it("should show the saved case property data", function () {
        util.loadXML(BASELINE_XML);

        const question1 = call("getMugByPath", "/data/question1");
        util.clickQuestion(question1);

        const caseManagementSection = getCaseManagementSection();
        const caseProperty = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);

        assert.equal(caseProperty.val(), "one");
    });

    it("should show the first property when multiple exist", function () {
        // and disable the select, display warning

        util.loadXML(MULTIPLE_PROPERTIES_XML);

        const question1 = call("getMugByPath", "/data/question1");
        util.clickQuestion(question1);

        const caseManagementSection = getCaseManagementSection();
        const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        // fetching by selected option, because jquery does not return disabled select values
        const selectedOption = casePropertySelect.find("option:checked");
        const messages = casePropertySelect.find("~ .messages");

        assert.isTrue(casePropertySelect.prop("disabled"));
        // this question should be mapped to both 'one' and 'two', but since 'one' is first, that is expected
        assert.equal(selectedOption.val(), "one");

        assert.include(messages.text(),
            "This question is used to update multiple case properties"
        );
        // but this is not an error state, so ensure that the mug is still valid
        assert.isTrue(util.isTreeNodeValid(question1));
    });

    it("should save the case property to the XML", function () {
        util.loadXML("");
        util.addQuestion("Text", "question");

        // set the value
        const caseManagementSection = getCaseManagementSection();
        const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("one").trigger("change");

        const xml = call("createXML", true);
        const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

        assert.equal(mappings.length, 1);
            assert.equal(mappings.attr("property"), "one");
            assert.equal(mappedQuestions.length, 1);
            assert.equal(mappedQuestions.attr("question_path"), "/data/question");
        });

    it("should modify the existing mapping", function () {
        util.loadXML(BASELINE_XML);

        const question1 = call("getMugByPath", "/data/question1");
        util.clickQuestion(question1);

        // set the value
        const caseManagementSection = getCaseManagementSection();
        const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("two").trigger("change");

        const xml = call("createXML", true);
        const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

        assert.equal(mappings.length, 1);
            assert.equal(mappings.attr("property"), "two");
            assert.equal(mappedQuestions.length, 1);
            assert.equal(mappedQuestions.attr("question_path"), "/data/question1");
        });

    it("should preserve additional question attributes", function () {
        util.loadXML(EXTRA_QUESTION_ATTRS_XML);

        const question1 = call("getMugByPath", "/data/question1");
        util.clickQuestion(question1);

        // set the value
        const caseManagementSection = getCaseManagementSection();
        const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("two").trigger("change");

        const xml = call("createXML", true);
        const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

        assert.equal(mappings.length, 1);
            assert.equal(mappings.attr("property"), "two");
            assert.equal(mappedQuestions.length, 1);
            assert.equal(mappedQuestions.attr("question_path"), "/data/question1");
            assert.equal(mappedQuestions.attr("update_mode"), "edit");
        });

    it("should display a dropdown of potential case management properties", function () {
        util.loadXML("");
        util.addQuestion("Text", "question1");

        const caseManagementSection = getCaseManagementSection();
        const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);

        const displayedOptions = [];
        $.each(casePropertySelect.prop("options"), function(i) {
            const $opt = $(this);
            displayedOptions.push($opt.text());
        });

        assert.deepEqual(displayedOptions, ["one", "two", "three", ""]);
        });

    it("should display a warning when multiple questions are saving to the same case property", function () {
        util.loadXML("");
        const question1 = util.addQuestion("Text", "question1");
        const question2 = util.addQuestion("Text", "question2");

        // set the case property on value 1, verify no warning
        util.clickQuestion(question1);
        let caseManagementSection = getCaseManagementSection();
        let casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("one").trigger("change");
        // verify no warning
        assert.isTrue(util.isTreeNodeValid(question1));

        // set the case property on value 2, now verify that this question displays a warning
        // and that the warning icon is next to both icons in the tree
        util.clickQuestion(question2);
        caseManagementSection = getCaseManagementSection();
        casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("one").trigger("change");
        let messages = casePropertySelect.find("~ .messages");
        assert.isFalse(util.isTreeNodeValid(question1));
        assert.isFalse(util.isTreeNodeValid(question2));
        const expectedMessage = (
            "\"one\" is assigned by another question. You can still save the form, " +
            "but will need to have only one question for any case property in order to " +
            "build the application"
        );
        assert.include(messages.text(), expectedMessage);

        // click back to the first question, verify that the warning is visible
        util.clickQuestion(question1);
        messages = casePropertySelect.find("~ .messages");
        assert.include(messages.text(), expectedMessage);
            assert.isFalse(util.isTreeNodeValid(question1));
        });
        
        it("should display a warning when loading xml with a property conflict", function () {
            util.loadXML(PROPERTY_CONFLICT_XML);
            const question1 = call("getMugByPath", "/data/question1");
            const question2 = call("getMugByPath", "/data/question2");
            assert.isFalse(util.isTreeNodeValid(question1));
            assert.isFalse(util.isTreeNodeValid(question2));

        util.clickQuestion(question1);
        const caseManagementSection = getCaseManagementSection();
        const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        const messages = casePropertySelect.find("~ .messages");

        assert.equal(messages.children().length, 1);
    });

    it("should clear the conflict warning when one of the affected questions changes its property",
        function () {
        util.loadXML("");
        const question1 = util.addQuestion("Text", "question1");
        const question2 = util.addQuestion("Text", "question2");

        // set the case property on value 1
        util.clickQuestion(question1);
        let caseManagementSection = getCaseManagementSection();
        let casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("one").trigger("change");

        // set the case property on value 2
        util.clickQuestion(question2);
        caseManagementSection = getCaseManagementSection();
        casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("one").trigger("change");

        // click back to the first question, verify that the warning is visible
        util.clickQuestion(question1);
        caseManagementSection = getCaseManagementSection();
        casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val("two").trigger("change");

        const messages = casePropertySelect.find("~ .messages");
        assert.equal(messages.children().length, 0); // no messages
        assert.isTrue(util.isTreeNodeValid(question1));
        assert.isTrue(util.isTreeNodeValid(question2));
    });

    it("should preserve mappings when a question is renamed", function () {
        util.loadXML(PROPERTY_CONFLICT_XML);
        const question1 = call("getMugByPath", "/data/question1");

        question1.p.nodeID = "question3";

        const vellum = $("#vellum").vellum("get");
            const caseManagementData = vellum.data.caseManagement;
            const question_paths = caseManagementData.caseMappings.one.map(
                questionObj => questionObj.question_path);
            assert.sameOrderedMembers(question_paths, ['/data/question3', '/data/question2']);
            assert.sameOrderedMembers(caseManagementData.caseMappingsByQuestion['/data/question3'], ['one']);
        assert.notExists(caseManagementData.caseMappingsByQuestion['/data/question1']);
    });

    it("should add custom options to future dropdowns", function () {
        util.loadXML();

        // Verify that custom options will be included for other questions
        const question1 = util.addQuestion("Text", "question1");

        let caseManagementSection = getCaseManagementSection();
        let casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        const newOption = new Option("newCaseProperty", "newCaseProperty", true, true);
        casePropertySelect.append(newOption).trigger("change");

        const question2 = util.addQuestion("Text", "question2");

        caseManagementSection = getCaseManagementSection();
        casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);

        let displayedOptions = [];
        $.each(casePropertySelect.prop("options"), function(i) {
            const $opt = $(this);
            displayedOptions.push($opt.text());
        });

        assert.deepEqual(displayedOptions, ["one", "two", "three", "newCaseProperty", ""]);

        // Verify that custom options will be removed when no longer in use
        util.clickQuestion(question1);
        caseManagementSection = getCaseManagementSection();
        casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
        casePropertySelect.val(null).trigger("change");

        util.clickQuestion(question2);

        caseManagementSection = getCaseManagementSection();
        casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);

        displayedOptions = [];
        $.each(casePropertySelect.prop("options"), function(i) {
            const $opt = $(this);
            displayedOptions.push($opt.text());
        });

        assert.deepEqual(displayedOptions, ["one", "two", "three", ""]);
        });

    it("should remove child mappings when parent group is deleted", function () {
        util.loadXML(GROUP_MAPPINGS_XML);
        const group1 = call("getMugByPath", "/data/group1");
        const form = group1.form;
        form.removeMugsFromForm([group1]);

        const vellum = $("#vellum").vellum("get");
            const assignedCaseProperties = Object.keys(vellum.data.caseManagement.caseMappings);
        assert.notInclude(assignedCaseProperties, "one");
        assert.notInclude(assignedCaseProperties, "two");
    });

    it("should restore mappings when a deletion is undone", function () {
        util.loadXML(GROUP_MAPPINGS_XML);
        const group1 = call("getMugByPath", "/data/group1");
        const form = group1.form;
        form.removeMugsFromForm([group1]);
        form.undo();

        const vellum = $("#vellum").vellum("get");
            const assignedCaseProperties = Object.keys(vellum.data.caseManagement.caseMappings);
        assert.include(assignedCaseProperties, "one");
        assert.include(assignedCaseProperties, "two");
    });

        it("should preserve child group mappings when the parent is renamed", function () {
            util.loadXML(GROUP_MAPPINGS_XML);
            const group1 = call("getMugByPath", "/data/group1");
            group1.p.nodeID = "group2";

        const vellum = $("#vellum").vellum("get");
            const caseManagementData = vellum.data.caseManagement;
            // assert that the group1 mappings were transferred to group2
            const one_paths = caseManagementData.caseMappings.one.map(question => question.question_path);
        assert.sameOrderedMembers(one_paths, ["/data/group2/q1"]);
        const two_paths = caseManagementData.caseMappings.two.map(question => question.question_path);
        assert.sameOrderedMembers(two_paths, ["/data/group2/q2"]);
    });

    it("should clear warnings when deleting a question", function () {
        util.loadXML(PROPERTY_CONFLICT_XML);
        const question2 = call("getMugByPath", "/data/question2");
        question2.form.removeMugsFromForm([question2]);

        const question1 = call("getMugByPath", "/data/question1");
        const CONFLICT_MSG_KEY = "mug-caseProperty-conflict";
        const message = question1.messages.get("caseProperty", CONFLICT_MSG_KEY);
        assert.isNull(message);
    });

    it("should remove invalid mappings", function () {
            // this XML only contains "question1",
            // but its sole mapping is for "question2"
            util.loadXML(INVALID_MAPPING_XML);

            const vellum = $("#vellum").vellum("get");
            const caseManagementData = vellum.data.caseManagement;

            assert.deepEqual(caseManagementData.caseMappings, {});
        });

        it("should preserve mappings for xml loaded without case mapping information", function () {
            // If the user pastes old xml into the edit xml modal, we don't want them accidentally
            // deleting all case mapping information
            util.loadXML(BASELINE_XML); // establishes a mapping: "one"->"/data/question1"
            // false does not reset the data, which is how the edit xml modal behaves
            util.loadXML(BASELINE_NO_MAPPING_XML, undefined, undefined, undefined, false);

            const vellum = $("#vellum").vellum("get");
            const caseManagementData = vellum.data.caseManagement;

            const one_paths = caseManagementData.caseMappings.one.map(question => question.question_path);
            assert.sameOrderedMembers(one_paths, ["/data/question1"]);
        });

        it("should override existing mappings", function () {
            util.loadXML(BASELINE_NO_MAPPING_XML);
            util.loadXML(BASELINE_XML, undefined, undefined, undefined, false);

            const vellum = $("#vellum").vellum("get");
            const caseManagementData = vellum.data.caseManagement;

            const one_paths = caseManagementData.caseMappings.one.map(question => question.question_path);
            assert.sameOrderedMembers(one_paths, ["/data/question1"]);
        });

        it("should replace case property spaces with underscores", function () {
            util.loadXML(BASELINE_XML);
            const question1 = call("getMugByPath", "/data/question1");
            util.clickQuestion(question1);

            const caseManagementSection = getCaseManagementSection();
            const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);

            // This will result in both "hello world" and "hello_world" being in the dropdown, but
            // it doesn't appear select2 has a clean way of mimicing entering a custom option
            var optionWithSpaces = new Option("hello world", "hello world", false, false);
            casePropertySelect.append(optionWithSpaces);
            casePropertySelect.val("hello world").trigger("change");

            const vellum = $("#vellum").vellum("get");
            const caseManagementData = vellum.data.caseManagement;

            const assignedProperties = caseManagementData.caseMappingsByQuestion["/data/question1"];
            assert.sameOrderedMembers(assignedProperties, ["hello_world"]);
        });

        it("should show an error for reserved case properties", function () {
            util.loadXML("");
            const question = util.addQuestion("Text", "question1");

            let caseManagementSection = getCaseManagementSection();
            let casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
            const reservedOption = new Option("case_id", "case_id", true, true);
            casePropertySelect.append(reservedOption).trigger("change");

            const messages = casePropertySelect.find("~ .messages");
            assert.include(messages.text(), "case_id is a reserved word");
            assert.isFalse(util.isTreeNodeValid(question));
        });

        describe("with no case management data", function () {
            beforeEach(function () {
                const vellum = $("#vellum").vellum("get");
                // NOTE: This is a half-measure. Init will have still occurred with the initial options
                // but this felt like a reasonable compromise to avoid having to do a full init for every test.
                this.oldActive = vellum.data.caseManagement.isActive;
                vellum.data.caseManagement.isActive = false;
            });

        afterEach(function () {
            const vellum = $("#vellum").vellum("get");
            vellum.data.caseManagement.isActive = this.oldActive;
            delete this.oldActive;
        });

        it ("should exclude case mappings from XML", function () {
            util.loadXML(BASELINE_XML);  // baseline includes case mappings

            const xml = call("createXML", true);
            const $xml = xmlLib.parseXML(xml);
            const mappings = $xml.find("vellum\\:case_mappings");

            // ensure no mappings are created in XML
            assert.equal(mappings.length, 0);
        });

        it ("should hide the case management section", function () {
            util.loadXML("");
            util.addQuestion("Text", "text");

            const caseManagementSection = getCaseManagementSection();

            assert.notExists(caseManagementSection[0]);
        });
    });
});
