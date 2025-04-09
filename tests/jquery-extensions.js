/*jshint multistr: true */
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/jquery-extensions',
    'static/parser/required.xml',
], function (
    chai,
    $,
    _,
    util,
    ext,
    REQUIRED_XML
) {
    var assert = chai.assert,
        xml;

    describe("jQuery extensions", function () {
        beforeEach(function () {
            xml = $(REQUIRED_XML);
        });

        describe("xmlAttr() gets", function () {
            it("undefined when nothing is selected", function () {
                var node = xml.find("not[found]");
                assert.equal(node.xmlAttr("required"), undefined);
            });

            it("undefined value for missing attribute", function () {
                var node = xml.find("bind[nodeset$='question1']");
                assert.equal(node.xmlAttr("not-found"), undefined);
            });

            it("'required' attribute value", function () {
                var node = xml.find("bind[nodeset$='question1']");
                assert.equal(node.xmlAttr("required"), "true()");
            });

            it("'vellum:required' attribute value", function () {
                var node = xml.find("bind[nodeset$='question2']");
                assert.equal(node.xmlAttr("vellum:required"), "#form/question1 = 'hi'");
            });
        });

        describe("xmlAttr() sets", function () {
            it("does nothing when nothing is selected", function () {
                var node = xml.find("not[found]");
                node = node.xmlAttr("required", "ignored");
                assert.equal(node.xmlAttr("required"), undefined);
            });

            it("value of missing attribute", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr("required", "ignored");
                assert.equal(node.xmlAttr("required"), "ignored");
            });

            it("undefined and returns node", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr("required", undefined);
                assert.equal(node.xmlAttr("required"), "true()");
            });

            it("null and returns node with attribute removed", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr("required", null);
                assert.equal(node.xmlAttr("required"), undefined);
            });

            it("undefined 'vellum:required' and returns node", function () {
                var node = xml.find("bind[nodeset$='question2']");
                node = node.xmlAttr("vellum:required", undefined);
                assert.equal(node.xmlAttr("vellum:required"), "#form/question1 = 'hi'");
            });

            it("null 'vellum:required' and returns node with attribute removed", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr("vellum:required", null);
                assert.equal(node.xmlAttr("vellum:required"), undefined);
            });

            it("value of existing 'required' attribute", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr("required", "new-value");
                assert.equal(node.xmlAttr("required"), "new-value");
            });

            it("value of existing 'vellum:required' attribute", function () {
                var node = xml.find("bind[nodeset$='question2']");
                node = node.xmlAttr("vellum:required", "new-value");
                assert.equal(node.xmlAttr("vellum:required"), "new-value");
            });

            it("value and returns node", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node.xmlAttr("required", "new-value")
                    .xmlAttr("readonly", "books");
                assert.equal(node.xmlAttr("required"), "new-value");
                assert.equal(node.xmlAttr("readonly"), "books");
            });
        });

        describe("xmlAttr() set multiple", function () {
            it("does nothing when nothing is selected", function () {
                var node = xml.find("not[found]");
                node = node.xmlAttr({"required": "maybe", "readonly": "nope"});
                assert.equal(node.xmlAttr("required"), undefined);
                assert.equal(node.xmlAttr("readonly"), undefined);
            });

            it("values of missing attributes", function () {
                var node = xml.find("bind[nodeset$='question2']");
                node = node.xmlAttr({"not-set": "maybe", "readonly": "nope"});
                assert.equal(node.xmlAttr("not-set"), "maybe");
                assert.equal(node.xmlAttr("readonly"), "nope");
            });

            it("undefined and returns node", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr({"required": undefined});
                assert.equal(node.xmlAttr("required"), "true()");
            });

            it("null and returns node with attribute removed", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node = node.xmlAttr({"required": null});
                assert.equal(node.xmlAttr("required"), undefined);
            });

            it("values of existing attributes", function () {
                var node = xml.find("bind[nodeset$='question2']");
                node = node.xmlAttr({"required": "maybe", "vellum:required": "nope"});
                assert.equal(node.xmlAttr("required"), "maybe");
                assert.equal(node.xmlAttr("vellum:required"), "nope");
            });

            it("values and returns node", function () {
                var node = xml.find("bind[nodeset$='question1']");
                node.xmlAttr({"required": "maybe", "vellum:required": "nope"})
                    .xmlAttr("readonly", "books");
                assert.equal(node.xmlAttr("required"), "maybe");
                assert.equal(node.xmlAttr("vellum:required"), "nope");
                assert.equal(node.xmlAttr("readonly"), "books");
            });
        });
    });
});
