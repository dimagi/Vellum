require([
    'chai',
    'jquery',
    'tests/utils',
    'vellum/javaRosa'
], function (
    chai,
    $,
    util,
    jr
) {
    var assert = chai.assert,
        call = util.call,
        clickQuestion = util.clickQuestion;

    describe("The javaRosa plugin with multiple languages", function () {
        it("should not show itext errors when there is text in any language", function (done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {
                    form: TEST_XML_1, 
                    onReady: function () {
                        $("textarea[name=itext-en-constraintMsg]").val("").change();
                        util.saveAndReload(function () {
                            // there should be no errors on load
                            // todo: this should inspect the model, not UI
                            var errors = $(".alert-block");
                            assert.equal(errors.length, 0, errors.text());
                            done();
                        });
                    }
                }
            });
        });

        it("should preserve itext values on load + save", function (done) {
            util.init({core: {onReady: function () {
                util.addQuestion("Text", "question1");
                $(".btn:contains(image)").click();
                $(".btn:contains(audio)").click();
                $(".btn:contains(video)").click();
                $(".btn:contains(long)").click();
                $(".btn:contains(short)").click();
                $(".btn:contains(custom)").click();
                $(".fd-modal-generic-container").find("input").val("custom");
                $(".fd-modal-generic-container").find(".btn:contains(Add)").click();
                $("[name='itext-en-label']").val('question1 en label').change();
                $("[name='itext-hin-label']").val('question1 hin label').change();
                $("[name='itext-en-constraintMsg']").val('question1 en validation').change();
                $("[name='itext-hin-constraintMsg']").val('question1 hin validation').change();
                $("[name='itext-en-hint']").val('question1 hint en').change();
                $("[name='itext-hin-hint']").val('question1 hin hint').change();
                $("[name='itext-en-label-long']").val("question1 en long").change();
                $("[name='itext-hin-label-long']").val("question1 hin long").change();
                $("[name='itext-en-label-short']").val("question1 en short").change();
                $("[name='itext-hin-label-short']").val("question1 hin short").change();
                $("[name='itext-en-label-custom']").val("question1 en custom").change();
                $("[name='itext-hin-label-custom']").val("question1 hin custom").change();

                util.assertXmlEqual(
                    call('createXML'),
                    util.xmlines(TEST_XML_2),
                    {normalize_xmlns: true}
                );
                done();
            }}});
        });

        it("itext changes do not bleed back after copy", function (done) {
            util.init({core: {onReady: function () {
                var mug = util.addQuestion("Text", "question");
                    dup = mug.form.duplicateMug(mug);
                dup.p.labelItextID.setDefaultValue("q2");

                util.saveAndReload(function () {
                    // verify type change
                    var mug = call("getMugByPath", "/data/question");
                    assert.equal(mug.p.labelItextID.defaultValue(), "question");
                    done();
                });
            }}});
        });
    });

    /*jshint multistr: true */
    var TEST_XML_1 = '' + 
    '<?xml version="1.0" encoding="UTF-8" ?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml"\
            xmlns:orx="http://openrosa.org/jr/xforms"\
            xmlns="http://www.w3.org/2002/xforms"\
            xmlns:xsd="http://www.w3.org/2001/XMLSchema"\
            xmlns:jr="http://openrosa.org/javarosa"\
            xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms"\
                          xmlns="http://openrosa.org/formdesigner/8D6CF8A5-4396-45C3-9D05-64C3FD97A5D0"\
                          uiVersion="1"\
                          version="1"\
                          name="Untitled Form">\
                        <question1 />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1"\
                      type="xsd:string"\
                      constraint="1"\
                      jr:constraintMsg="jr:itext(\'question1-constraintMsg\')" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                    </translation>\
                    <translation lang="hin">\
                        <text id="question1-constraintMsg">\
                            <value>xyz</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')" />\
            </input>\
        </h:body>\
    </h:html>';

    /*jshint multistr: true */
    var TEST_XML_2 = '' + 
    '<h:html xmlns:h="http://www.w3.org/1999/xhtml"\
             xmlns:orx="http://openrosa.org/jr/xforms"\
             xmlns="http://www.w3.org/2002/xforms"\
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"\
             xmlns:jr="http://openrosa.org/javarosa"\
             xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms"\
                          xmlns="http://openrosa.org/formdesigner/8D6CF8A5-4396-45C3-9D05-64C3FD97A5D0"\
                          uiVersion="1" version="1" name="Untitled Form">\
                        <question1/>\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string"\
                      jr:constraintMsg="jr:itext(\'question1-constraintMsg\')"/>\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1 en label</value>\
                            <value form="image">jr://file/commcare/image/data/question1.png</value>\
                            <value form="audio">jr://file/commcare/audio/data/question1.mp3</value>\
                            <value form="video">jr://file/commcare/video/data/question1.3gp</value>\
                            <value form="long">question1 en long</value>\
                            <value form="short">question1 en short</value>\
                            <value form="custom">question1 en custom</value>\
                        </text>\
                        <text id="question1-hint">\
                            <value>question1 hint en</value>\
                        </text>\
                        <text id="question1-constraintMsg">\
                            <value>question1 en validation</value>\
                        </text>\
                    </translation>\
                    <translation lang="hin">\
                        <text id="question1-label">\
                            <value>question1 hin label</value>\
                            <value form="image">jr://file/commcare/image/data/question1.png</value>\
                            <value form="audio">jr://file/commcare/audio/data/question1.mp3</value>\
                            <value form="video">jr://file/commcare/video/data/question1.3gp</value>\
                            <value form="long">question1 hin long</value>\
                            <value form="short">question1 hin short</value>\
                            <value form="custom">question1 hin custom</value>\
                        </text>\
                        <text id="question1-hint">\
                            <value>question1 hin hint</value>\
                        </text>\
                        <text id="question1-constraintMsg">\
                            <value>question1 hin validation</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')"/>\
                <hint ref="jr:itext(\'question1-hint\')"/>\
            </input>\
        </h:body>\
    </h:html>';
});
