/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/all_question_types.xml',
    'text!static/all_question_types.tsv',
    'text!static/exporter/item-id.xml',
    'text!static/exporter/item-id.tsv',
    'text!static/javaRosa/multi-lang-trans.xml'
], function (
    chai,
    $,
    _,
    util,
    ALL_QUESTIONS_XML,
    ALL_QUESTIONS_TSV,
    ITEM_ID_XML,
    ITEM_ID_TSV,
    MULTI_LANG_TRANS_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The exporter", function () {
        beforeEach(function (done) {
            util.init({
                core: {
                    onReady: function () {
                        done();
                    }
                }
            });
        });

        it("should include question type in TSV", function () {
            util.loadXML(ALL_QUESTIONS_XML);
            assert.equal(call("getData").core.form.getExportTSV(), ALL_QUESTIONS_TSV);
        });

        it("should include item values in TSV", function () {
            util.loadXML(ITEM_ID_XML);
            assert.equal(call("getData").core.form.getExportTSV(), ITEM_ID_TSV);
        });

        it("should properly escape special characters", function () {
            util.loadXML(MULTI_LANG_TRANS_XML);
            assert.equal(call("getData").core.form.getExportTSV(),
                'Question\tType\tText (en)\tText (hin)\tAudio (en)\t' +
                'Audio (hin)\tImage (en)\tImage (hin)\tDisplay Condition\t' +
                'Validation Condition\tValidation Message\tCalculate Condition\tRequired\n' +
                '/text\tText\t"""Text"\t"""Text"\t\t\t\t\t\t\t\t\tno'
            );
        });
    });

// TODO test with newlines (should they be preserved? old vellum did not)
//    var TEST_XML_1 = util.xmlines('' +
//    '<?xml version="1.0" encoding="UTF-8"?>\
//    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
//        <h:head>\
//            <h:title>Untitled Form</h:title>\
//            <model>\
//                <instance>\
//                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
//                        <question1 />\
//                    </data>\
//                </instance>\
//                <bind nodeset="/data/question1" calculate="concat(&quot;Line 1&quot;,&quot;&#10;Line 2&quot;)" />\
//                <itext>\
//                    <translation lang="en" default=""/>\
//                </itext>\
//            </model>\
//        </h:head>\
//        <h:body></h:body>\
//    </h:html>');
//
//    var TEST_TSV_2 = ('' +
//    'Question	Type	Text (en)	Text (hin)	Audio (en)	Audio (hin)	Image (en)	Image (hin)	Display Condition	Validation Condition	Validation Message	Calculate Condition	Required\n' +
//    '/data/question1	Hidden Value										concat("Line 1","&#10;Line 2")	no');
});
