/* eslint-disable no-unused-expressions */

define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'static/caseManagement/baseline.xml',
    'static/caseManagement/baseline_no_mapping_block.xml',
    'static/caseManagement/multipleProperties.xml',
    'static/caseManagement/extra_question_attrs.xml',
    'static/caseManagement/property_conflict.xml'
], function (
    chai,
    $,
    _,
    util,
    BASELINE_XML,
    BASELINE_NO_MAPPING_XML,
    MULTIPLE_PROPERTIES_XML,
    EXTRA_QUESTION_ATTRS_XML,
    PROPERTY_CONFLICT_XML
) {
    const assert = chai.assert;
    const call = util.call;

    function getMappingAndQuestionElementsFromXML(xml) {
        const xmlDoc = $.parseXML(xml);
        const $xml = $(xmlDoc);
        const mappings = $xml.find("case_mappings > mapping");
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
            const xml = call("createXML");
            util.assertXmlEqual(xml, BASELINE_XML);
        });

        it("outputs an empty mapping block if form lacks mappings data", function () {
            util.loadXML(BASELINE_NO_MAPPING_XML);
            const xml = call("createXML");
            const xmlDoc = $.parseXML(xml);
            const $xml = $(xmlDoc);
            const mappings = $xml.find("case_mappings");

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
            const caseManagementSection = getCaseManagementSection();

            assert.notExists(caseManagementSection[0]);
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

            chai.expect(messages.text()).to.include(
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

            const xml = call("createXML");
            const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

            chai.expect(mappings.length).to.equal(1);
            chai.expect(mappings.attr("property")).to.equal("one");
            chai.expect(mappedQuestions.length).to.equal(1);
            chai.expect(mappedQuestions.attr("question_path")).to.equal("/data/question");
        });

        it("should modify the existing mapping", function () {
            util.loadXML(BASELINE_XML);

            const question1 = call("getMugByPath", "/data/question1");
            util.clickQuestion(question1);

            // set the value
            const caseManagementSection = getCaseManagementSection();
            const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
            casePropertySelect.val("two").trigger("change");

            const xml = call("createXML");
            const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

            chai.expect(mappings.length).to.equal(1);
            chai.expect(mappings.attr("property")).to.equal("two");
            chai.expect(mappedQuestions.length).to.equal(1);
            chai.expect(mappedQuestions.attr("question_path")).to.equal("/data/question1");
        });

        it("should preserve additional question attributes", function () {
            util.loadXML(EXTRA_QUESTION_ATTRS_XML);

            const question1 = call("getMugByPath", "/data/question1");
            util.clickQuestion(question1);

            // set the value
            const caseManagementSection = getCaseManagementSection();
            const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);
            casePropertySelect.val("two").trigger("change");

            const xml = call("createXML");
            const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

            chai.expect(mappings.length).to.equal(1);
            chai.expect(mappings.attr("property")).to.equal("two");
            chai.expect(mappedQuestions.length).to.equal(1);
            chai.expect(mappedQuestions.attr("question_path")).to.equal("/data/question1");
            chai.expect(mappedQuestions.attr("update_mode")).to.equal("edit");
        });

        it("should display a dropdown of potential case management properties", function () {
            util.loadXML("");
            util.addQuestion("Text", "question1");

            const caseManagementSection = getCaseManagementSection();
            const casePropertySelect = caseManagementSection.find(CASE_PROPERTY_WIDGET_TYPE);

            const optionValues = {};
            $.each(casePropertySelect.prop("options"), function(i) {
                const $opt = $(this);
                optionValues[$opt.prop("value")] = $opt.text();
            });

            chai.expect(Object.keys(optionValues)).to.deep.equal(["one", "two", "three", ""]);
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
            chai.expect(messages.text()).to.include(expectedMessage);

            // click back to the first question, verify that the warning is visible
            util.clickQuestion(question1);
            messages = casePropertySelect.find("~ .messages");
            chai.expect(messages.text()).to.include(expectedMessage);
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

                const xml = call("createXML");
                const xmlDoc = $.parseXML(xml);
                const $xml = $(xmlDoc);
                const mappings = $xml.find("case_mappings");

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
});
