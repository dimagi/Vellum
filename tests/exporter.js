/*jshint multistr: true */
/*
 Updating these tests can be hard due to whitespace differences.
 The following approach is recommended:
 * Edit the TSV files in VI with the following settings:
    * :set list  # display invisible chars
    * :set noeol  # don't add a trailing newline character when saving the file
 * If you're still having problems with the last line, maybe try another editor, like VSCode.
 */
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/all_question_types.xml',
    'text!static/all_question_types.tsv',
    'text!static/exporter/item-id.xml',
    'text!static/exporter/item-id.tsv',
    'text!static/javaRosa/multi-lang-trans.xml',
    'text!static/exporter/vid-ref.xml',
    'text!static/exporter/vid-ref.tsv'
], function (
    chai,
    $,
    _,
    util,
    ALL_QUESTIONS_XML,
    ALL_QUESTIONS_TSV,
    ITEM_ID_XML,
    ITEM_ID_TSV,
    MULTI_LANG_TRANS_XML,
    VID_REF_XML,
    VID_REF_TSV
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
                },
                features: {
                    rich_text: false,
                    case_micro_image: true
                },
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

        it("should include video references in TSV", function () {
            util.loadXML(VID_REF_XML);
            assert.equal(call("getData").core.form.getExportTSV(), VID_REF_TSV);
        });

        it("should properly escape special characters", function () {
            util.loadXML(MULTI_LANG_TRANS_XML);
            assert.equal(call("getData").core.form.getExportTSV(),
                'Question\tType\tText (en)\tText (hin)\tAudio (en)\t' +
                'Audio (hin)\tImage (en)\tImage (hin)\tVideo (en)\t' +
                'Video (hin)\tVideo Inline (en)\tVideo Inline (hin)\t' +
                'Display Condition\tValidation Condition\tValidation Message\t' + 
                'Calculate Condition\tRequired\tHint Text\tHelp Text\tComment\n' +
                '/text\tText\t"""Text"\t"""Text"\t\t\t\t\t\t\t\t\t\t\t\t\tno\t\t\t'
            );
        });
    });
});
