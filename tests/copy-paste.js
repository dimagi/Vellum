require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/copy-paste/text-question.xml',
    'vellum/copy-paste',
    'vellum/tsv'
], function (
    chai,
    $,
    _,
    util,
    TEXT_QUESTION_XML,
    mod,
    tsv
) {
    var assert = chai.assert,
        call = util.call;

    function eq(serial, rows, message) {
        util.assertEqual(serial + "\n", rows + "\n", message);
    }

    describe("The copy-paste plugin", function () {
        before(function (done) {
            util.init({
                javaRosa: { langs: ['en', 'hin'] },
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("copyPaste"),
                               "copyPaste plugin should be enabled");
                        done();
                    }
                }
            });
        });

        it("should copy a text question", function () {
            util.loadXML(TEXT_QUESTION_XML);
            eq(mod.copy(), TEXT_SERIAL);
        });

        // TODO test for each mug spec item
        // TODO test bad paste values
        // TODO insert question with same nodeID
    });

    TEXT_SERIAL = tsv.tabDelimit([
        ["vellum copy/paste", "version 1"],
        [
            "type",
            "id",
            "relevantAttr",
            "constraintAttr",
            "requiredAttr",
            "labelItext:en-default",
            "labelItext:hin-default",
            "constraintMsgItext:en-default",
            "constraintMsgItext:hin-default",
        ], [
            "Text",
            "/txt",
            "x = y",
            "1 = 0",
            "true",
            "English Text",
            "Hindi Text",
            "Nope",
            "Nope",
        ]
    ]);
});
