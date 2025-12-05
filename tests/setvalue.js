import util from "tests/utils";
import chai from "chai";
import xml from "vellum/xml";
import SET_VALUE_XML from "static/setvalue/set-value.xml";
import SET_VALUE_SPECIAL_XML from "static/setvalue/set-value-special.xml";

var assert = chai.assert,
    call = util.call;

describe("setvalues", function() {
    before(function (done) {
        util.init({
            javaRosa: {langs: ['en']},
            core: {onReady: function () { done(); }},
            features: {rich_text: false},
        });
    });

    it("should be associated with the correct mug on form load", function() {
        util.loadXML(SET_VALUE_XML);
        var text = util.getMug('text');
        assert.strictEqual(text.p.defaultValue, 'blah');
    });

    it("should have event jr-insert when added into repeat", function() {
        util.loadXML("");
        util.addQuestion("Repeat", 'repeat');
        var text = util.addQuestion("Text", 'text'),
            form, setvalue;

        text.p.defaultValue = 'blah';

        form = call("createXML");
        setvalue = xml.parseXML(form).find('setvalue');

        assert.strictEqual(setvalue.attr('event'), 'jr-insert');
        assert.strictEqual(setvalue.attr('ref'), '/data/repeat/text');
        assert.strictEqual(setvalue.attr('value'), 'blah');
    });

    it("should have event xforms-ready when added outside of repeat", function() {
        util.loadXML("");
        var text = util.addQuestion("Text", 'text'),
            form, setvalue;

        text.p.defaultValue = 'blah';

        form = call("createXML");
        setvalue = xml.parseXML(form).find('setvalue');

        assert.strictEqual(setvalue.attr('event'), 'xforms-ready');
        assert.strictEqual(setvalue.attr('ref'), '/data/text');
        assert.strictEqual(setvalue.attr('value'), 'blah');
    });

    it("should not be associated with a question if event is not xforms-ready or jr-insert", function() {
        util.loadXML(SET_VALUE_SPECIAL_XML);
        var form = call("createXML"),
            setvalue = xml.parseXML(form).find('setvalue');
        assert.strictEqual(setvalue.attr('event'), 'special-snowflake');
        assert.strictEqual(setvalue.attr('ref'), '/data/text');
        assert.strictEqual(setvalue.attr('value'), 'blah');
    });

    describe("with allow data reference enabled", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
                features: {
                    rich_text: false,
                    allow_data_reference_in_setvalue: true,
                },
            });
        });
        it("should not warn when referencing another node", function() {
            util.loadXML("");
            util.addQuestion("Text", 'text1');
            var text2 = util.addQuestion("Text", 'text2');
            text2.p.defaultValue = '#form/text1';
            assert.strictEqual(text2.spec.defaultValue.validationFunc(text2), 'pass');
        });

        it("should not warn when referencing a case", function() {
            util.loadXML("");
            util.addQuestion("Text", 'text1');
            var text2 = util.addQuestion("Text", 'text2');
            text2.p.defaultValue = "#case/case/attribute";
            assert.strictEqual(text2.spec.defaultValue.validationFunc(text2), 'pass');
        });

        it("should not warn when referencing a case with filter", function() {
            util.loadXML("");
            util.addQuestion("Text", 'text1');
            var text2 = util.addQuestion("Text", 'text2');
            text2.p.defaultValue = "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/facility_type";
            assert.strictEqual(text2.spec.defaultValue.validationFunc(text2), 'pass');
        });
    });

    describe("without allow data reference enabled", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function () { done(); }},
                features: {
                    rich_text: false,
                    allow_data_reference_in_setvalue: false,
                },
            });
        });
        it("should warn when referencing another node", function() {
            util.loadXML("");
            util.addQuestion("Text", 'text1');
            var text2 = util.addQuestion("Text", 'text2');
            text2.p.defaultValue = '#form/text1';
            assert.notStrictEqual(text2.spec.defaultValue.validationFunc(text2), 'pass');
        });

        it("should not warn when referencing a case", function() {
            util.loadXML("");
            util.addQuestion("Text", 'text1');
            var text2 = util.addQuestion("Text", 'text2');
            text2.p.defaultValue = "#case/case/attribute";
            assert.strictEqual(text2.spec.defaultValue.validationFunc(text2), 'pass');
        });

        it("should not warn when referencing a case with filter", function() {
            util.loadXML("");
            util.addQuestion("Text", 'text1');
            var text2 = util.addQuestion("Text", 'text2');
            text2.p.defaultValue = "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/facility_type";
            assert.strictEqual(text2.spec.defaultValue.validationFunc(text2), 'pass');
        });
    });
});
