/* eslint-disable no-unused-expressions */

define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'static/caseManagement/baseline.xml',
    'static/caseManagement/baseline_no_mapping_block.xml'
], function (
    chai,
    $,
    _,
    util,
    BASELINE_XML,
    BASELINE_NO_MAPPING_XML
) {
    const assert = chai.assert;
    const call = util.call;

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
        });
    });
});
