/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'tests/utils',
    'vellum/javaRosa',
    'vellum/util',
    'text!static/javaRosa/outputref-group-rename.xml',
    'text!static/javaRosa/text-question.xml',
    'text!static/javaRosa/multi-lang-trans.xml',
    'text!static/javaRosa/multi-line-trans.xml',
    'text!static/javaRosa/output-refs.xml',
    'text!static/javaRosa/outputref-with-inequality.xml',
    'text!static/javaRosa/text-with-constraint.xml'
], function (
    chai,
    $,
    util,
    jr,
    vellum_util,
    OUTPUTREF_GROUP_RENAME_XML,
    TEXT_QUESTION_XML,
    MULTI_LANG_TRANS_XML,
    MULTI_LINE_TRANS_XML,
    OUTPUT_REFS_XML,
    OUTPUTREF_WITH_INEQUALITY_XML,
    TEXT_WITH_CONSTRAINT_XML
) {
    var assert = chai.assert,
        call = util.call;

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

        it("should show warning on load for with unknown language", function (done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {
                    form: TEST_XML_3,
                    onReady: function () {
                        // todo: this should inspect the model, not UI
                        var errors = $(".alert-block"),
                            text = errors.text();
                        assert.equal(errors.length, 1, text);
                        assert(text.indexOf("You have languages in your form that are not specified") > -1, text);
                        assert(text.indexOf("page: es.") > -1, text);
                        done();
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
                $("[name='itext-en-hint']").val('question1 en hint').change();
                $("[name='itext-hin-hint']").val('question1 hin hint').change();
                $("[name='itext-en-help']").val('question1 en help').change();
                $("[name='itext-hin-help']").val('question1 hin help').change();
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

        it("itext widget should show placeholder when value is node ID (any language)", function () {
            util.loadXML(TEST_XML_1);
            util.addQuestion("Text", "temp");
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "");
            assert.equal(enLabel.attr("placeholder"), "question1");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "question1");

            util.clickQuestion("temp");
            util.clickQuestion("question1");
            enLabel = $("[name='itext-en-label']");
            hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "");
            assert.equal(enLabel.attr("placeholder"), "question1");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "question1");
        });

        it("itext widget should show placeholder when value matches default language value", function () {
            util.loadXML(TEST_XML_1);
            util.addQuestion("Text", "temp");
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            enLabel.val("English").change();
            assert.equal(enLabel.val(), "English");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "English");

            util.clickQuestion("temp");
            util.clickQuestion("question1");
            enLabel = $("[name='itext-en-label']");
            hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "English");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "English");
        });

        it("itext widget should show placeholder when empty", function () {
            util.loadXML(TEST_XML_1);
            util.addQuestion("Text", "temp");
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            enLabel.val("").change();
            assert.equal(enLabel.val(), "");
            assert.equal(enLabel.attr("placeholder"), "question1");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "question1");

            util.clickQuestion("temp");
            util.clickQuestion("question1");
            enLabel = $("[name='itext-en-label']");
            hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "");
            assert.equal(enLabel.attr("placeholder"), "question1");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "question1");
        });

        it("non-labelItext widget should show placeholder for non-default language", function () {
            util.loadXML(TEXT_WITH_CONSTRAINT_XML);
            util.clickQuestion("text");
            var enItext = $("[name='itext-en-constraintMsg']"),
                hinItext = $("[name='itext-hin-constraintMsg']");
            hinItext.val("").change();
            assert.equal(enItext.val(), "English");
            assert.equal(hinItext.val(), "");
            assert.equal(hinItext.attr("placeholder"), "English");
            assert(!enItext.attr("placeholder"), enItext.attr("placeholder"));

            enItext.val("").change();
            assert.equal(enItext.val(), "");
            assert.equal(hinItext.val(), "");
            assert(!enItext.attr("placeholder"), enItext.attr("placeholder"));
            assert(!hinItext.attr("placeholder"), hinItext.attr("placeholder"));
        });

        it("should display correct language for question that was collapsed when language changed", function () {
            util.loadXML("");
            var group = util.addQuestion("Group", "group");
            util.addQuestion("Text", "question2");
            util.clickQuestion("group/question2");
            $("[name='itext-en-label']").val('english').change();
            $("[name='itext-hin-label']").val('hindi').change();
            util.collapseGroup(group);
            assert.equal($(".fd-question-tree .jstree-anchor").length, 1);
            $(".fd-question-tree-lang select").val('hin').change();
            util.expandGroup(group);
            assert.equal($(".fd-question-tree .jstree-anchor:last").text(), "hindi");
        });

        it("itext widget should not overwrite label with question id", function () {
            util.loadXML("");
            var q1 = util.addQuestion("Text");
            util.addQuestion("Text");
            util.clickQuestion("question1");
            $("[name='itext-en-label']").val("English").change();
            q1.p.nodeID = "newid";

            util.clickQuestion("question2");
            util.clickQuestion("newid");

            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "English");
            assert.equal(hinLabel.val(), "");
            assert.equal(hinLabel.attr("placeholder"), "English");
        });

        it("tree should note when default language is being displayed instead of selected language", function() {
            util.loadXML("");
            util.addQuestion("Text", "question1");
            util.clickQuestion("question1");
            $("[name='itext-en-label']").val('english').change();
            var treeSelector = ".fd-question-tree .jstree-anchor";

            assert.equal($(treeSelector).text(), "english");
            $(".fd-question-tree-lang select").val('hin').change();
            assert.equal($(treeSelector).text(), "english [en]");
            $("[name='itext-hin-label']").val('hindi').change();
            assert.equal($(treeSelector).text(), "hindi");
        });

        it("non-labelItext widget should contain value on load", function () {
            util.loadXML(TEXT_WITH_CONSTRAINT_XML);
            util.clickQuestion("text");
            assert.equal($("[name='itext-en-constraintMsg']").val(), "English");
            assert.equal($("[name='itext-hin-constraintMsg']").val(), "Hindi");
        });

        it("should enable save button on itext label change", function () {
            util.loadXML(TEXT_QUESTION_XML);
            util.saveButtonEnabled(false);
            util.clickQuestion("question1");
            assert(!util.saveButtonEnabled(), "click should not cause change");
            $("[name='itext-en-label']").val("new").change();
            assert(util.saveButtonEnabled(), "save button is disabled");
        });

        it("should enable save button on itext constraintMsg change", function () {
            util.loadXML(TEXT_QUESTION_XML);
            util.saveButtonEnabled(false);
            util.clickQuestion("question1");
            assert(!util.saveButtonEnabled(), "click should not cause change");
            $("[name='itext-hin-constraintMsg']").val("new").change();
            assert(util.saveButtonEnabled(), "save button is disabled");
        });

        it("should update output refs when question ids change", function (done) {
            util.init({core: {onReady: function () {
                util.addQuestion("Text", "question1");
                util.addQuestion("Text", "question2");
                $("[name='itext-en-label']").val('<output value="/data/question1" /> a ' +
                    '<output value="/data/question1"/> b ' +
                    '<output value="/data/question1"></output> c ' +
                    '<output value="/data/question1" ></output> d ' +
                    '<output value="if(/data/question1 = \'\', \'\', format-date(date(/data/question1), \'%a%b%c\'))" />').change();
                $("[name='itext-hin-label']").val('<output value="/data/question1"></output>').change();
                util.clickQuestion("question1");
                $("[name='property-nodeID']").val('first_question').change();

                util.assertXmlEqual(
                    call('createXML'),
                    util.xmlines(TEST_XML_4),
                    {normalize_xmlns: true}
                );
                done();
            }}});
        });

        it("should only update exact output ref matches when question ids change", function (done) {
            util.init({core: {onReady: function () {
                util.addQuestion("Text", "question1");
                util.addQuestion("Text", "question2");
                $("[name='itext-en-label']").val('<output value="/data/question1" /> ' +
                    '<output value="/data/question11" /> ' +
                    '<output value="/data/question1/b" /> ' +
                    '<output value="/data/question1b" /> ').change();
                $("[name='itext-hin-label']").val('question2').change();
                util.clickQuestion("question1");
                $("[name='property-nodeID']").val('first_question').change();

                util.assertXmlEqual(
                    call('createXML'),
                    OUTPUT_REFS_XML,
                    {normalize_xmlns: true}
                );
                done();
            }}});
        });

        it("should escape inequality operators in output ref", function () {
            util.loadXML(OUTPUTREF_WITH_INEQUALITY_XML);
            var mug = util.getMug("product");
            assert.equal(mug.p.labelItextID.get("en"),
                '<output value="if(1 < 2 or 2 > 3 or 3 <= 3 or 4 >= 5, \'product\', \'other\')"/>');
            util.assertXmlEqual(
                call('createXML'),
                OUTPUTREF_WITH_INEQUALITY_XML,
                {normalize_xmlns: true}
            );
        });

        it("should only update exact output ref matches when question ids change (word boundary)", function () {
            util.loadXML("");
            util.addQuestion("Text", "load-one");
            var label = util.addQuestion("Trigger", "label"),
                text2 = util.addQuestion("Text", "text2");
            label.p.labelItextID.setDefaultValue('<output value="/data/load-one" />');
            text2.p.nodeID = "load";
            text2.p.nodeID = "load-two";
            assert.equal(label.p.labelItextID.getValue("default", "en"), '<output value="/data/load-one" />');
        });

        it("itext changes do not bleed back after copy", function (done) {
            util.init({core: {onReady: function () {
                var mug = util.addQuestion("Text", "question"),
                    dup = mug.form.duplicateMug(mug);
                dup.p.labelItextID.setDefaultValue("q2");

                util.saveAndReload(function () {
                    var mug = call("getMugByPath", "/data/question");
                    assert.equal(mug.p.labelItextID.defaultValue(), "question");
                    done();
                });
            }}});
        });

        it("itext changes do not bleed back from copy of copy", function (done) {
            util.init({core: {onReady: function () {
                var mug = util.addQuestion("Text", "question"),
                    dup = mug.form.duplicateMug(mug),
                    cpy = mug.form.duplicateMug(dup);
                cpy.p.labelItextID.setDefaultValue("copy");

                util.saveAndReload(function () {
                    var mug = call("getMugByPath", "/data/question"),
                        dup = call("getMugByPath", "/data/copy-1-of-question"),
                        cpy = call("getMugByPath", "/data/copy-2-of-question");
                    assert.equal(mug.p.labelItextID.defaultValue(), "question");
                    assert.equal(dup.p.labelItextID.defaultValue(), "question");
                    assert.equal(cpy.p.labelItextID.defaultValue(), "copy");
                    done();
                });
            }}});
        });

        it("drag question into label makes output ref in correct position", function (done) {
            util.init({core: {onReady: function () {
                var mug1 = util.addQuestion("Text", "question1"),
                    mug2 = util.addQuestion("Text", "question2");

                var target = $("[name='itext-en-label']"),
                    sourceUid = mug1.ufid;
                target.val("test string").change();
                vellum_util.setCaretPosition(target[0], 4);
                call("handleDropFinish", target, sourceUid, mug1);
                var val = mug2.p.labelItextID.getValue('default', 'en');
                assert.equal(val, 'test<output value="/data/question1" /> string');
                done();
            }}});
        });

        it("output ref deleted with single backspace", function (done) {
            util.init({core: {onReady: function () {
                var mug = util.addQuestion("Text", "question1");

                var target = $("[name='itext-en-label']");
                target.val('question1 <output value="/data/question2" /> end').change();
                vellum_util.setCaretPosition(target[0], 44);

                target.trigger({
                    type: "keydown",
                    which: 8,
                    ctrlKey: false
                });
                target.change();
                var val = mug.p.labelItextID.getValue('default', 'en');
                assert.equal(val, 'question1  end');
                done();
            }}});
        });

        it("output ref deleted with single delete keypress", function (done) {
            util.init({core: {onReady: function () {
                var mug = util.addQuestion("Text", "question1");

                var target = $("[name='itext-en-label']");
                target.val('question1 <output value="/data/question2" /> end').change();
                vellum_util.setCaretPosition(target[0], 10);

                target.trigger({
                    type: "keydown",
                    which: 46,
                    ctrlKey: false
                });
                target.change();
                var val = mug.p.labelItextID.getValue('default', 'en');
                assert.equal(val, 'question1  end');
                done();
            }}});
        });

        it("should update output ref on group rename", function (done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {
                    form: OUTPUTREF_GROUP_RENAME_XML,
                    onReady: function () {
                        var group = util.call("getMugByPath", "/data/question2"),
                            q1 = util.call("getMugByPath", "/data/question1"),
                            itext = q1.p.labelItextID;

                        assert(itext.getValue('default', 'en').indexOf('"/data/question2/question3"') > 0,
                            '"/data/question2/question3" not in ' + itext.getValue('default', 'en'));
                        group.p.nodeID = "group";
                        assert(itext.getValue('default', 'en').indexOf('"/data/group/question3"') > 0,
                            '"/data/group/question3" not in ' + itext.getValue('default', 'en'));

                        done();
                    }
                }
            });
        });

        it("should bulk update multi-line translation", function () {
            util.loadXML(TEXT_QUESTION_XML);
            var jr = util.call("getData").javaRosa,
                trans = ('label\tdefault-en\tdefault-hin\n' +
                         'question1-label\t"First ""line\n' +
                         'Second"" line\nThird line"\tHindu trans\n');
            jr.parseXLSItext(trans, jr.Itext);
            var q1 = util.getMug("question1");
            assert.equal(q1.p.labelItextID.get("en"),
                         'First "line\nSecond" line\nThird line');
            assert.equal(q1.p.labelItextID.get("hin"), 'Hindu trans');
        });

        it("should generate bulk multi-line translation with user-friendly newlines", function () {
            util.loadXML(MULTI_LINE_TRANS_XML);
            var jr = util.call("getData").javaRosa,
                fakeVellum = {beforeSerialize: function () {}};
            assert.equal(jr.generateItextXLS(fakeVellum, jr.Itext),
                         'label\tdefault-en\tdefault-hin\t' +
                         'audio-en\taudio-hin\timage-en\timage-hin\tvideo-en\tvideo-hin\n' +
                         'question1-label\t"First ""line\nSecond"" line\nThird line"\t' +
                         'Hindu trans\t\t\t\t\t\t');
        });

        it("should escape all languages when generating bulk translations", function () {
            util.loadXML(MULTI_LANG_TRANS_XML);
            var jr = util.call("getData").javaRosa,
                fakeVellum = {beforeSerialize: function () {}};
            assert.equal(jr.generateItextXLS(fakeVellum, jr.Itext),
                         'label\tdefault-en\tdefault-hin\taudio-en\taudio-hin\t' +
                         'image-en\timage-hin\tvideo-en\tvideo-hin\n' +
                         'text-label\t"""Text"\t"""Text"\t\t\t\t\t\t');
        });

        it("bulk translation tool should not create empty itext forms", function () {
            util.loadXML(TEXT_QUESTION_XML);
            var jr = util.call("getData").javaRosa,
                trans = ('label\tdefault-en\tdefault-hin\taudio-en\taudio-hin\n' +
                         'question1-label\t"First ""line\n' +
                         'Second"" line\nThird line"\t\t\t\n');
            jr.parseXLSItext(trans, jr.Itext);
            var q1 = util.getMug("question1");
            assert.equal(q1.p.labelItextID.get("en"),
                         'First "line\nSecond" line\nThird line');
            // existing translation should be cleared
            assert.equal(q1.p.labelItextID.get("hin"), '');
            // non-existent form should not be added
            assert(!q1.p.labelItextID.hasForm("audio"), "unexpected form: audio");
        });

        it("bulk translation tool should enable the save button on update", function () {
            util.loadXML(TEXT_QUESTION_XML);
            util.saveButtonEnabled(false);
            var jr = util.call("getData").javaRosa,
                trans = ('label\tdefault-en\tdefault-hin\taudio-en\taudio-hin\n' +
                         'question1-label\t"First ""line\n' +
                         'Second"" line\nThird line"\t\t\t\n');
            jr.parseXLSItext(trans, jr.Itext);
            assert(util.saveButtonEnabled(), "save button not enabled");
        });

        it("should highlight label after tab", function () {
            util.loadXML(TEST_XML_3, null, /You have languages in your form/);
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            enLabel.val("test string").change();
            enLabel.focus();
            hinLabel.val("hin test string").change();
            hinLabel.focus();
            assert.equal(enLabel[0].selectionStart, 0);
            assert.equal(enLabel[0].selectionEnd, 11);
            assert.equal(hinLabel[0].selectionStart, 0);
            assert.equal(hinLabel[0].selectionEnd, 15);
        });
    });

    describe("the language selector", function() {
        before(function(done) {
            util.init({
                javaRosa: { langs: ['en'] },
                core: {onReady: done}
            });
        });

        it("should have option to display IDs", function() {
            util.loadXML("");
            util.addQuestion("Text", "question1");
            util.clickQuestion("question1");
            var $dropdown = $(".fd-question-tree-lang select");
            var treeSelector = ".fd-question-tree .jstree-anchor";

            $("[name='itext-en-label']").val('x').change();
            assert.equal($(treeSelector).text(), "x");
            $("[name='itext-en-label']").val('').change();
            assert.equal($(treeSelector).text(), "question1");

            $dropdown.val('en').change();
            $("[name='itext-en-label']").val('english').change();
            assert.equal($(treeSelector).text(), "english");
            $dropdown.val('_ids').change();
            assert.equal($dropdown.find("option").length, 2);
            assert.equal($(treeSelector).text(), "question1");
        });
    });

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
                            <value>question1 en hint</value>\
                        </text>\
                        <text id="question1-help">\
                            <value>question1 en help</value>\
                            <value form="image">jr://file/commcare/image/help/data/question1.png</value>\
                            <value form="audio">jr://file/commcare/audio/help/data/question1.mp3</value>\
                            <value form="video">jr://file/commcare/video/help/data/question1.3gp</value>\
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
                        <text id="question1-help">\
                            <value>question1 hin help</value>\
                            <value form="image">jr://file/commcare/image/help/data/question1.png</value>\
                            <value form="audio">jr://file/commcare/audio/help/data/question1.mp3</value>\
                            <value form="video">jr://file/commcare/video/help/data/question1.3gp</value>\
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
                <help ref="jr:itext(\'question1-help\')"/>\
            </input>\
        </h:body>\
    </h:html>';

    var TEST_XML_3 = '' +
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
                <bind nodeset="/data/question1" type="xsd:string" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                    </translation>\
                    <translation lang="hin">\
                        <text id="question1-label">\
                            <value>xyz</value>\
                        </text>\
                    </translation>\
                    <translation lang="es">\
                        <text id="question1-label">\
                            <value>Spanish!</value>\
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

    var TEST_XML_4 = '' +
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
                        <first_question/>\
                        <question2/>\
                    </data>\
                </instance>\
                <bind nodeset="/data/first_question" type="xsd:string"/>\
                <bind nodeset="/data/question2" type="xsd:string"/>\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="first_question-label">\
                            <value>first_question</value>\
                        </text>\
                        <text id="question2-label">\
                            <value><output value="/data/first_question" /> a <output value="/data/first_question" /> b <output value="/data/first_question" /> c <output value="/data/first_question" /> d <output value="if(/data/first_question = \'\', \'\', format-date(date(/data/first_question), \'%a%b%c\'))" /></value>\
                        </text>\
                    </translation>\
                    <translation lang="hin">\
                        <text id="first_question-label">\
                            <value>first_question</value>\
                        </text>\
                        <text id="question2-label">\
                            <value><output value="/data/first_question" /></value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/first_question">\
                <label ref="jr:itext(\'first_question-label\')"/>\
            </input>\
            <input ref="/data/question2">\
                <label ref="jr:itext(\'question2-label\')"/>\
            </input>\
        </h:body>\
    </h:html>';
});
