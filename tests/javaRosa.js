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
});
