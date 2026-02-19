/*jshint multistr: true */
/*
 Updating these tests can be hard due to whitespace differences.
 The following approach is recommended:
 * Edit the TSV files in VI with the following settings:
    * :set list  # display invisible chars
    * :set noeol  # don't add a trailing newline character when saving the file
 * If you're still having problems with the last line, maybe try another editor, like VSCode.
 */
import chai from "chai";
import util from "tests/utils";
import ALL_QUESTIONS_XML from "static/all_question_types.xml";
import ALL_QUESTIONS_TSV from "static/all_question_types.tsv";
import ITEM_ID_XML from "static/exporter/item-id.xml";
import ITEM_ID_TSV from "static/exporter/item-id.tsv";
import MULTI_LANG_TRANS_XML from "static/javaRosa/multi-lang-trans.xml";
import VID_REF_XML from "static/exporter/vid-ref.xml";
import VID_REF_TSV from "static/exporter/vid-ref.tsv";

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
                use_custom_repeat_button_text: true,
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
