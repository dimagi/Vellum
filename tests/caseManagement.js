/* eslint-disable no-unused-expressions */

define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'static/caseManagement/baseline.xml',
    'static/caseManagement/baseline_no_mapping_block.xml',
    'static/caseManagement/multipleProperties.xml',
    'static/caseManagement/extra_question_attrs.xml'
], function (
    chai,
    $,
    _,
    util,
    BASELINE_XML,
    BASELINE_NO_MAPPING_XML,
    MULTIPLE_PROPERTIES_XML,
    EXTRA_QUESTION_ATTRS_XML
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
            const propertiesPane = document.querySelector(".fd-content-right");
            const caseManagementElement = propertiesPane.querySelector('fieldset[data-slug="caseManagement"]');

            assert.exists(caseManagementElement);
        });

        it("should hide the case management section for labels", function () {
            util.loadXML("");
            util.addQuestion("Trigger", "label");
            const propertiesPane = document.querySelector(".fd-content-right");
            const caseManagementElement = propertiesPane.querySelector('fieldset[data-slug="caseManagement"]');

            assert.notExists(caseManagementElement);
        });

        it("should show the saved case property data", function () {
            util.loadXML(BASELINE_XML);

            const question1 = call("getMugByPath", "/data/question1");
            util.clickQuestion(question1);

            const propertiesPane = $(".fd-content-right");
            const caseManagementSection = propertiesPane.find('fieldset[data-slug="caseManagement"]');
            const caseProperty = caseManagementSection.find("input");

            assert.equal(caseProperty.val(), 'one');
        });

        it("should show the first property when multiple exist", function () {
            util.loadXML(MULTIPLE_PROPERTIES_XML);

            const question1 = call("getMugByPath", "/data/question1");
            util.clickQuestion(question1);

            const propertiesPane = $(".fd-content-right");
            const caseManagementSection = propertiesPane.find('fieldset[data-slug="caseManagement"]');
            const caseProperty = caseManagementSection.find("input");

            // this question should be mapped to both 'one' and 'two', but since 'one' is first, that is expected
            assert.equal(caseProperty.val(), 'one');
        });

        it("should save the case property to the XML", function () {
            util.loadXML("");
            util.addQuestion("Text", "question");
            
            // set the value
            const propertiesPane = $(".fd-content-right");
            const caseManagementSection = propertiesPane.find('fieldset[data-slug="caseManagement"]');
            const casePropertySelect = caseManagementSection.find("input");
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
            const propertiesPane = $(".fd-content-right");
            const caseManagementSection = propertiesPane.find('fieldset[data-slug="caseManagement"]');
            const casePropertySelect = caseManagementSection.find("input");
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
            const propertiesPane = $(".fd-content-right");
            const caseManagementSection = propertiesPane.find('fieldset[data-slug="caseManagement"]');
            const casePropertySelect = caseManagementSection.find("input");
            casePropertySelect.val("two").trigger("change");

            const xml = call("createXML");
            const [mappings, mappedQuestions] = getMappingAndQuestionElementsFromXML(xml);

            chai.expect(mappings.length).to.equal(1);
            chai.expect(mappings.attr("property")).to.equal("two");
            chai.expect(mappedQuestions.length).to.equal(1);
            chai.expect(mappedQuestions.attr("question_path")).to.equal("/data/question1");
            chai.expect(mappedQuestions.attr("update_mode")).to.equal("edit");
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

                const propertiesPane = document.querySelector('.fd-content-right');
                const caseManagementElement = propertiesPane.querySelector('fieldset[data-slug="caseManagement"]');

                assert.notExists(caseManagementElement);
            });
        });
    });
});
