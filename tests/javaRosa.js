/*jshint multistr: true */
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/javaRosa/itext',
    'vellum/javaRosa/util',
    'vellum/util',
    'text!static/javaRosa/outputref-group-rename.xml',
    'text!static/javaRosa/text-question.xml',
    'text!static/javaRosa/multi-lang-trans.xml',
    'text!static/javaRosa/multi-line-trans.xml',
    'text!static/javaRosa/output-refs.xml',
    'text!static/javaRosa/outputref-with-inequality.xml',
    'text!static/javaRosa/group-with-constraint.xml',
    'text!static/javaRosa/text-with-constraint.xml',
    'text!static/javaRosa/itext-item-rename.xml',
    'text!static/javaRosa/itext-item-rename-group-move.xml',
    'text!static/javaRosa/itext-item-non-auto-id.xml',
    'text!static/javaRosa/select1-help.xml',
    'text!static/javaRosa/no-label-text-one-lang.xml',
    'text!static/javaRosa/test-xml-1.xml',
    'text!static/javaRosa/test-xml-2.xml',
    'text!static/javaRosa/test-xml-2-with-bind-constraint.xml',
    'text!static/javaRosa/test-xml-2-with-only-bind-constraint.xml',
    'text!static/javaRosa/test-xml-3.xml',
    'text!static/javaRosa/test-xml-4.xml',
    'text!static/javaRosa/non-default-lang-first.xml',
    'text!static/javaRosa/invalid-output-ref.xml'
], function (
    chai,
    $,
    _,
    util,
    jrItext,
    jr,
    vellumUtil,
    OUTPUTREF_GROUP_RENAME_XML,
    TEXT_QUESTION_XML,
    MULTI_LANG_TRANS_XML,
    MULTI_LINE_TRANS_XML,
    OUTPUT_REFS_XML,
    OUTPUTREF_WITH_INEQUALITY_XML,
    GROUP_WITH_CONSTRAINT_XML,
    TEXT_WITH_CONSTRAINT_XML,
    ITEXT_ITEM_RENAME_XML,
    ITEXT_ITEM_RENAME_GROUP_MOVE_XML,
    ITEXT_ITEM_NON_AUTO_ID_XML,
    SELECT1_HELP_XML,
    NO_LABEL_TEXT_ONE_LANG_XML,
    TEST_XML_1,
    TEST_XML_2,
    TEST_XML_2_WITH_BIND_CONSTRAINT,
    TEST_XML_2_WITH_ONLY_BIND_CONSTRAINT,
    TEST_XML_3,
    TEST_XML_4,
    NON_DEFAULT_LANG_FIRST_XML,
    INVALID_OUTPUT_REF_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The javaRosa plugin with multiple languages", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {onReady: function () { done(); }},
                features: {rich_text: false},
            });
        });

        describe("and non default language is first", function () {
            before(function (done) {
                util.init({
                    features: {rich_text: false},
                    javaRosa: {langs: ['hin', 'en']},
                    core: {onReady: function () { done(); }}
                });
            });

            it("should load xml", function() {
                util.loadXML(NON_DEFAULT_LANG_FIRST_XML);
            });
        });

        describe("with rich text enabled", function () {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en', 'hin']},
                    core: {onReady: function () { done(); }},
                });
            });

            it("should update output refs when question ids change", function (done) {
                util.loadXML("");
                util.addQuestion("Text", "question1");
                util.addQuestion("Text", "question2");
                var widget = util.getWidget('itext-en-label');
                widget.input.promise.then(function () {
                    var itext = '<output value="/data/question1" /> a ' +
                    '<output value="/data/question1"/> b ' +
                    '<output value="/data/question1"></output> c ' +
                    '<output value="/data/question1" ></output> d ' +
                    '<output value="if(/data/question1 = \'\', \'\', format-date(date(/data/question1), \'%a%b%c\'))" />';
                    widget.setItextValue(itext);
                    widget.setValue(itext);
                    var widget2 = util.getWidget('itext-hin-label');
                    widget2.input.promise.then(function () {
                        widget2.setValue('<output value="/data/question1"></output>');
                        util.clickQuestion("question1");
                        $("[name=property-nodeID]").val('first_question').change();
                        util.assertXmlEqual(
                            call('createXML'),
                            TEST_XML_4,
                            {normalize_xmlns: true}
                        );
                        done();
                    });
                });
            });

            it("should only update exact output ref matches when question ids change", function (done) {
                util.loadXML("");
                util.addQuestion("Text", "question1");
                util.addQuestion("Text", "question2");
                var widget = util.getWidget('itext-en-label');
                widget.input.promise.then(function () {
                    var itext = '<output value="/data/question1" /> ' +
                        '<output value="/data/question11" /> ' +
                        '<output value="/data/question1/b" /> ' +
                        '<output value="/data/question1b" /> ';
                    widget.setItextValue(itext);
                    widget.setValue(itext);
                    var widget2 = util.getWidget('itext-hin-label');
                    widget2.input.promise.then(function () {
                        widget2.setValue('question2');
                        util.clickQuestion("question1");
                        $("[name=property-nodeID]").val('first_question').change();
                        util.assertXmlEqual(
                            call('createXML'),
                            OUTPUT_REFS_XML,
                            {normalize_xmlns: true}
                        );
                        done();
                    });
                });
            });

            it("should rename itext item ID after move", function () {
                util.loadXML("");
                util.addQuestion("Select", "ns");
                util.addQuestion("Select", "ew");
                var north = util.getMug("ns/choice1"),
                    south = util.getMug("ew/choice1");
                north.p.nodeID = "north";
                south.p.nodeID = "south";
                north.form.moveMug(south, "after", north);
                util.assertXmlEqual(util.call("createXML"), ITEXT_ITEM_RENAME_XML,
                                    {normalize_xmlns: true});
            });

            it("should rename group's child itext item IDs after move group", function () {
                util.loadXML("");
                var green = util.addQuestion("Group", "green"),
                    blue = util.addQuestion("Group", "blue");
                util.addQuestion("Text", "text");
                blue.form.moveMug(blue, "before", green);
                util.assertXmlEqual(util.call("createXML"),
                                    ITEXT_ITEM_RENAME_GROUP_MOVE_XML,
                                    {normalize_xmlns: true});
            });

            it("should not erase invalid outputs", function (done) {
                util.loadXML("");
                util.addQuestion("Text", "question1");
                var widget = util.getWidget('itext-en-label');
                widget.input.promise.then(function () {
                    var itext = '<output value="concat(1, 2" />';
                    widget.setItextValue(itext);
                    widget.setValue(itext);
                    util.clickQuestion('question1');
                    widget = util.getWidget('itext-en-label');
                    widget.input.promise.then(function () {
                        assert.strictEqual(widget.getValue(), itext);
                        util.assertXmlEqual(call('createXML'),
                                            INVALID_OUTPUT_REF_XML,
                                            {normalize_xmlns: true});
                        done();
                    });
                });
            });
        });

        describe("and one has is right to left", function () {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en', 'heb']},
                    core: {
                        onReady: function () {
                            util.addQuestion("Text");
                            done();
                        }},
                    features: {rich_text: false},
                });
            });

            it("should have rtl attribute", function () {
                assert.isUndefined($('[name=itext-en-label]').attr('dir'));
                assert.strictEqual($('[name=itext-heb-label]').attr('dir'), 'rtl');
            });

            it("should have rtl attribute on markdown preview", function () {
                var $enInput = $('[name=itext-en-label]'),
                    $hebInput = $('[name=itext-heb-label]'), 
                    $enMarkdown = $enInput.closest('.form-group').parent().find('.markdown-output'),
                    $hebMarkdown = $hebInput.closest('.form-group').parent().find('.markdown-output');
                $enInput.val('* markdown');
                assert.isUndefined($enMarkdown.attr('dir'));
                assert.strictEqual($hebMarkdown.attr('dir'), 'rtl');
            });
        });

        it("should not show itext errors when there is text in any language", function (done) {
            util.loadXML(TEST_XML_1);
            $("textarea[name=itext-en-constraintMsg]").val("").change();
            util.saveAndReload(function () {
                // there should be no errors on load
                // todo: this should inspect the model, not UI
                var errors = $(".alert-block");
                assert.equal(errors.length, 0, errors.text());
                done();
            });
        });

        it("should show warning on load for with unknown language", function () {
            util.loadXML(TEST_XML_3, null, /You have languages in your form/);
            // todo: this should inspect the model, not UI
            var errors = $(".alert-block"),
                text = errors.text();
            assert.equal(errors.length, 1, text);
            assert(text.indexOf("You have languages in your form that are not specified") > -1, text);
            assert(text.indexOf("page: es.") > -1, text);
        });

        it("should preserve itext values on load + save", function () {
            util.loadXML("");
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
                TEST_XML_2,
                {normalize_xmlns: true}
            );
        });

        it("should prefer alert over constraintMsg", function() {
            util.loadXML(TEST_XML_2_WITH_BIND_CONSTRAINT);
            util.assertXmlEqual(
                call('createXML'),
                TEST_XML_2,
                {normalize_xmlns: true}
            );
        });

        it("should convert constraintMsg to alert", function() {
            util.loadXML(TEST_XML_2_WITH_ONLY_BIND_CONSTRAINT);
            util.assertXmlEqual(
                call('createXML'),
                TEST_XML_2,
                {normalize_xmlns: true}
            );
        });

        it("should correctly set alert's auto id", function() {
            util.loadXML(TEST_XML_2_WITH_BIND_CONSTRAINT);
            var mug = util.getMug('question1');
            assert(mug.p.constraintMsgItext.autoId);
        });

        it("itext widget should change as default language value changes when equal", function () {
            util.loadXML(TEST_XML_1);
            util.addQuestion("Text", "temp");
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            enLabel.val("English").change();
            assert.equal(enLabel.val(), "English");
            assert.equal(hinLabel.val(), "English");

            util.clickQuestion("temp");
            util.clickQuestion("question1");
            enLabel = $("[name='itext-en-label']");
            hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "English");
            assert.equal(hinLabel.val(), "English");
        });

        it("itext widget should be blank when empty", function () {
            util.loadXML(TEST_XML_1);
            util.addQuestion("Text", "temp");
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            enLabel.val("").change();
            assert.equal(enLabel.val(), "");
            assert.equal(hinLabel.val(), "");

            util.clickQuestion("temp");
            util.clickQuestion("question1");
            enLabel = $("[name='itext-en-label']");
            hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "");
            assert.equal(hinLabel.val(), "");
        });

        it("non-labelItext widget should allow non default language to be blank", function () {
            util.loadXML(TEXT_WITH_CONSTRAINT_XML);
            util.clickQuestion("text");
            var enItext = $("[name='itext-en-constraintMsg']"),
                hinItext = $("[name='itext-hin-constraintMsg']");
            hinItext.val("").change();
            assert.equal(enItext.val(), "English");
            assert.equal(hinItext.val(), "");

            enItext.val("").change();
            assert.equal(enItext.val(), "");
            assert.equal(hinItext.val(), "");
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
            $(".fd-question-tree-display").val('hin').change();
            util.expandGroup(group);
            assert.equal($(".fd-question-tree .jstree-anchor:last").text(), "hindi");
        });

        it("itext widget should not overwrite label with question id", function () {
            util.loadXML("");
            var q1 = util.addQuestion("Text", "question1");
            util.addQuestion("Text", "question2");
            util.clickQuestion("question1");
            $("[name='itext-en-label']").val("English").change();
            q1.p.nodeID = "newid";

            util.clickQuestion("question2");
            util.clickQuestion("newid");

            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            assert.equal(enLabel.val(), "English");
            assert.equal(hinLabel.val(), "English");
        });

        it("tree should note when default language is being displayed instead of selected language", function() {
            util.loadXML("");
            util.addQuestion("Text", "question1");
            util.clickQuestion("question1");
            $("[name='itext-en-label']").val('english').change();
            var treeSelector = ".fd-question-tree .jstree-anchor";

            assert.equal($(treeSelector).text(), "english");
            $(".fd-question-tree-display").val('hin').change();
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

        it("should escape inequality operators in output ref", function () {
            util.loadXML(OUTPUTREF_WITH_INEQUALITY_XML);
            var mug = util.getMug("product");
            assert.equal(mug.p.labelItext.get(),
                '<output value="if(1 < 2 or 2 > 3 or 3 <= 3 or 4 >= 5, \'product\', \'other\')" />');
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
            label.p.labelItext.set('<output value="/data/load-one" />');
            text2.p.nodeID = "load";
            text2.p.nodeID = "load-two";
            assert.equal(label.p.labelItext.get(), '<output value="/data/load-one" />');
        });

        it("itext changes do not bleed back after copy", function () {
            util.loadXML("");
            var mug = util.addQuestion("Text", "question"),
                dup = mug.form.duplicateMug(mug);
            dup.p.labelItext.set("q2");

            util.saveAndReload(function () {
                var mug = call("getMugByPath", "/data/question");
                assert.equal(mug.p.labelItext.defaultValue(), "question");
            });
        });

        it("itext changes do not bleed back from copy of copy", function () {
            util.loadXML("");
            var mug = util.addQuestion("Text", "question"),
                dup = mug.form.duplicateMug(mug),
                cpy = mug.form.duplicateMug(dup);
            cpy.p.labelItext.set("copy");

            util.saveAndReload(function () {
                var mug = call("getMugByPath", "/data/question"),
                    dup = call("getMugByPath", "/data/copy-1-of-question"),
                    cpy = call("getMugByPath", "/data/copy-2-of-question");
                assert.equal(mug.p.labelItext.defaultValue(), "question");
                assert.equal(dup.p.labelItext.defaultValue(), "question");
                assert.equal(cpy.p.labelItext.defaultValue(), "copy");
            });
        });

        it("drag question into label makes output ref in correct position", function () {
            util.loadXML("");
            var mug1 = util.addQuestion("Text", "question1"),
                mug2 = util.addQuestion("Text", "question2");

            var target = $("[name='itext-en-label']");
            target.val("test string").change();
            vellumUtil.setCaretPosition(target[0], 4);
            call("handleDropFinish", target, mug1.absolutePath, mug1);
            var val = mug2.p.labelItext.get('default', 'en');
            // wtf?? rich text is off
            assert.equal(val, 'test<output value="#form/question1" /> string');
            assert.equal(target.val(), 'test<output value="/data/question1" /> string');
        });

        it("output ref deleted with single backspace", function () {
            util.loadXML("");
            var mug = util.addQuestion("Text", "question1");

            var target = $("[name='itext-en-label']");
            target.val('question1 <output value="/data/question2" /> end').change();
            vellumUtil.setCaretPosition(target[0], 44);

            target.trigger({
                type: "keydown",
                which: 8,
                ctrlKey: false
            });
            target.change();
            var val = mug.p.labelItext.get('default', 'en');
            assert.equal(val, 'question1  end');
        });

        it("output ref deleted with single delete keypress", function () {
            util.loadXML("");
            var mug = util.addQuestion("Text", "question1");

            var target = $("[name='itext-en-label']");
            target.val('question1 <output value="/data/question2" /> end').change();
            vellumUtil.setCaretPosition(target[0], 10);

            target.trigger({
                type: "keydown",
                which: 46,
                ctrlKey: false
            });
            target.change();
            var val = mug.p.labelItext.get('default', 'en');
            assert.equal(val, 'question1  end');
        });

        it("should update output ref on group rename", function () {
            util.loadXML(OUTPUTREF_GROUP_RENAME_XML);
            var group = util.call("getMugByPath", "/data/question2"),
                q1 = util.call("getMugByPath", "/data/question1"),
                itext = q1.p.labelItext;

            assert(itext.get().indexOf('"#form/question2/question3"') > 0,
                '"#form/question2/question3" not in ' + itext.get());
            group.p.nodeID = "group";
            assert(itext.get('default', 'en').indexOf('"#form/group/question3"') > 0,
                '"#form/group/question3" not in ' + itext.get('default', 'en'));
            assert(itext.get('default', 'hin').indexOf('"#form/group/question3"') > 0,
                '"#form/group/question3" not in ' + itext.get('default', 'hin'));
        });

        it("should add warning on add Audio output ref to itext", function () {
            util.loadXML("");
            var audio = util.addQuestion("Audio", "audio"),
                text = util.addQuestion("Text", "text"),
                target = $("[name='itext-en-label']");
            call("handleDropFinish", target, audio.absolutePath, audio);
            chai.expect(util.getMessages(text))
                .to.include("Audio Capture nodes cannot be used in an output value");
        });

        it("should bulk update multi-line translation", function () {
            var form = util.loadXML(TEXT_QUESTION_XML),
                Itext = util.call("getData").javaRosa.Itext,
                trans = ('label\tdefault-en\tdefault-hin\n' +
                         'question1-label\t"First ""line\n' +
                         'Second"" line\nThird line"\tHindu trans\n');
            jr.parseXLSItext(form, trans, Itext);
            var q1 = util.getMug("question1");
            assert.equal(q1.p.labelItext.get("default", "en"),
                         'First "line\nSecond" line\nThird line');
            assert.equal(q1.p.labelItext.get("default", "hin"), 'Hindu trans');
        });

        it("should not get stuck on bulk update non-existent questions", function () {
            var form = util.loadXML(""),
                Itext = util.call("getData").javaRosa.Itext,
                trans = ('label\tdefault-en\tdefault-hin\n' +
                         'question1-label\tlabel\tHindu trans\n');
            jr.parseXLSItext(form, trans, Itext);
            assert(!util.getMug("question1"), "question1 should not exist");
        });

        it("should generate bulk multi-line translation with user-friendly newlines", function () {
            var form = util.loadXML(MULTI_LINE_TRANS_XML),
                Itext = util.call("getData").javaRosa.Itext;
            assert.equal(jr.generateItextXLS(form, Itext),
                         'label\tdefault_en\tdefault_hin\t' +
                         'audio_en\taudio_hin\timage_en\timage_hin\tvideo_en\tvideo_hin\tvideo-inline_en\tvideo-inline_hin\n' +
                         'question1-label\t"First ""line\nSecond"" line\nThird line"\t' +
                         'Hindu trans\t\t\t\t\t\t\t\t');
        });

        it("should escape all languages when generating bulk translations", function () {
            var form = util.loadXML(MULTI_LANG_TRANS_XML),
                Itext = util.call("getData").javaRosa.Itext;
            assert.equal(jr.generateItextXLS(form, Itext),
                         'label\tdefault_en\tdefault_hin\taudio_en\taudio_hin\t' +
                         'image_en\timage_hin\tvideo_en\tvideo_hin\tvideo-inline_en\tvideo-inline_hin\n' +
                         'text-label\t"""Text"\t"""Text"\t\t\t\t\t\t\t\t');
        });

        it("bulk translation tool should not create empty itext forms", function () {
            var form = util.loadXML(TEXT_QUESTION_XML),
                Itext = util.call("getData").javaRosa.Itext,
                trans = ('label\tdefault-en\tdefault-hin\taudio-en\taudio-hin\n' +
                         'question1-label\t"First ""line\n' +
                         'Second"" line\nThird line"\t\t\t\n');
            jr.parseXLSItext(form, trans, Itext);
            var q1 = util.getMug("question1");
            assert.equal(q1.p.labelItext.get("default", "en"),
                         'First "line\nSecond" line\nThird line');
            // existing translation should be cleared
            assert.equal(q1.p.labelItext.get("default", "hin"), '');
            // non-existent form should not be added
            assert(!q1.p.labelItext.hasForm("audio"), "unexpected form: audio");
        });

        it("bulk translation tool should enable the save button on update", function () {
            var form = util.loadXML(TEXT_QUESTION_XML);
            util.saveButtonEnabled(false);
            var Itext = util.call("getData").javaRosa.Itext,
                trans = ('label\tdefault-en\tdefault-hin\taudio-en\taudio-hin\n' +
                         'question1-label\t"First ""line\n' +
                         'Second"" line\nThird line"\t\t\t\n');
            jr.parseXLSItext(form, trans, Itext);
            assert(util.saveButtonEnabled(), "save button not enabled");
        });

        it("should highlight label after tab", function () {
            util.loadXML(TEST_XML_3, null, /You have languages in your form/);
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']"),
                tabKeyupEvent = $.Event('keyup');
            tabKeyupEvent.which = 9;
            enLabel.val("test string").change();
            enLabel.trigger(tabKeyupEvent);
            hinLabel.val("hin test string").change();
            hinLabel.trigger(tabKeyupEvent);
            assert.equal(enLabel[0].selectionStart, 0);
            assert.equal(enLabel[0].selectionEnd, 11);
            assert.equal(hinLabel[0].selectionStart, 0);
            assert.equal(hinLabel[0].selectionEnd, 15);
        });

        it("should not highlight label on focus", function () {
            util.loadXML(TEST_XML_3, null, /You have languages in your form/);
            util.clickQuestion("question1");
            var enLabel = $("[name='itext-en-label']"),
                hinLabel = $("[name='itext-hin-label']");
            enLabel.val("test string").change();
            enLabel.focus();
            hinLabel.val("hin test string").change();
            hinLabel.focus();
            assert.equal(enLabel[0].selectionStart, 0);
            assert.equal(enLabel[0].selectionEnd, 0);
            assert.equal(hinLabel[0].selectionStart, 0);
            assert.equal(hinLabel[0].selectionEnd, 0);
        });

        it("should not create duplicate <help> node on select", function () {
            util.loadXML(SELECT1_HELP_XML);
            var xml = call("createXML"),
                $xml = $(xml);
            assert.strictEqual($xml.find("help").length, 1, "wrong <help> node count\n" + xml);
        });

        it("should not auto-update itext ID when multiple questions point to auto-ish-id", function () {
            util.loadXML(ITEXT_ITEM_NON_AUTO_ID_XML);
            var north = util.getMug("north");
            north.p.nodeID = "west";
            var xml = call("createXML"),
                $xml = $(xml);
            assert.strictEqual($xml.find("text#north-label").length, 2,
                               "wrong <text> node count\n" + xml);
        });

        it("should unlink auto itext id from other questions with shared itext", function () {
            util.loadXML(ITEXT_ITEM_NON_AUTO_ID_XML);
            assert.equal($(ITEXT_ITEM_NON_AUTO_ID_XML).find("text#south-label").length, 0,
                         "wrong <text#south> node count\n" + ITEXT_ITEM_NON_AUTO_ID_XML);
            util.clickQuestion("south");
            var controls = $("[name='property-labelItext']").closest(".form-group"),
                autobox = controls.find("input[type=checkbox]");
            autobox.prop("checked", true).change();
            $("[name='itext-en-label']").val("south").change();
            assert.equal(util.getMug("north").p.labelItext.get(), "north");
            assert.equal(util.getMug("south").p.labelItext.get(), "south");
            var xml = call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find("text#north-label").length, 2,
                         "wrong <text#north> node count\n" + xml);
            assert.equal($xml.find("text#south-label").length, 2,
                         "wrong <text#south> node count\n" + xml);
        });

        _.each(["hint", "help", "constraintMsg"], function (tag) {
            it("should not serialize empty " + tag + " itext item with non-empty id and autoId = true", function() {
                util.loadXML("");
                var mug = util.addQuestion("Text"),
                    itext = mug.p[tag + "Itext"];
                itext.id = tag;
                itext.autoId = true;
                var xml = call("createXML"),
                    $xml = $(xml);
                if (tag === "constraintMsg") {
                    assert.strictEqual($xml.find("[jr\\:" + tag + "]").length, 0,
                                       "wrong " + tag + " count\n" + xml);
                } else {
                    assert.strictEqual($xml.find(tag).length, 0,
                                       "wrong <" + tag + "> node count\n" + xml);
                }
            });
        });

        it("should not allow apostrophes in item labels", function() {
            util.loadXML("");
            util.addQuestion("Select", "select");
            util.clickQuestion('select/choice1');
            $("[name='property-nodeID']").val("blah ' blah").change();
            assert.strictEqual($("[name='property-labelItext']").val(), 'select-blah___blah-labelItext');
        });

        it("should not allow > in item labels", function() {
            util.loadXML("");
            util.addQuestion("Select", "select");
            util.clickQuestion('select/choice1');
            $("[name='property-nodeID']").val("blah > blah").change();
            assert.strictEqual($("[name='property-labelItext']").val(), 'select-blah___blah-labelItext');
        });

        it("should not change with node id when blank", function() {
            util.loadXML("");
            util.addQuestion("Text", "text");
            util.clickQuestion("text");
            $('[name=itext-en-label]').val('').change();
            $('[name=itext-hin-label]').val('').change();
            $('[name=property-nodeID]').val('nodeid').change();
            assert.strictEqual($('[name=itext-en-label]').val(), '');
            assert.strictEqual($('[name=itext-hin-label]').val(), '');
        });
    });

    describe("The javaRosaplugin with one language", function() {
        before(function(done) {
            util.init({
                features: {rich_text: false},
                javaRosa: { langs: ['en'] },
                core: {
                    onReady: function () {
                        done();
                    }
                }
            });
        });

        it("should allow a value to be blank", function(){
            util.loadXML("");
            util.addQuestion('Trigger', 'label');
            util.clickQuestion('label');
            $('[name=itext-en-label]').val('blah').change();
            $('.itext-block-label-add-form-image').click();
            $('[name=itext-en-label]').val('').change();
            util.assertXmlEqual(call("createXML"), 
                                NO_LABEL_TEXT_ONE_LANG_XML,
                                {normalize_xmlns: true});
        });
    });

    describe("The javaRosa plugin itext widgets", function() {
        before(function(done) {
            util.init({
                features: {rich_text: false},
                javaRosa: { langs: ['en'] },
                core: {
                    onReady: function () {
                        var form = util.loadXML(""),
                            Itext = form.vellum.data.javaRosa.Itext;
                        mug = util.addQuestion("Text");
                        // trigger itext id population
                        jr.parseXLSItext(form, "", Itext);
                        done();
                    }
                }
            });
        });
        var mug;

        it ("should detect whether or not readable itext labels are present", function() {
            var model = new jrItext.model(),
                item = new jrItext.item({
                    itextModel: model,
                });
            assert(!item.hasHumanReadableItext(), "No recognized forms");
            item.addForm('short');
            assert(item.hasHumanReadableItext(), "Recognized form");
            model.addLanguage('en');
            assert(!item.hasHumanReadableItext(), "No English text");
            item.getForm('short').setValue('en', 'thing');
            assert(item.hasHumanReadableItext(), "Has English text");
            model.addLanguage('hin');
            assert(!item.hasHumanReadableItext(), "No Hindi text");
        });

        function testItextIdValidation(property) {
            it("should not display " + property + " validation error for autoId itext", function() {
                var itext = mug.p[property],
                    spec = mug.spec[property],
                    before = itext.id;
                itext.autoId = true;

                assert(itext.id, property + ".id should have a value");
                assert.equal(spec.validationFunc(mug), "pass");

                itext.id = "";
                try {
                    assert.equal(spec.validationFunc(mug), "pass");
                } finally {
                    itext.id = before;
                }
            });

            it("should display " + property + " validation error for non-autoId non-empty itext with blank ID", function() {
                var itext = mug.p[property],
                    spec = mug.spec[property],
                    before = [itext.id, itext.get()];
                itext.autoId = false;
                itext.id = "";
                itext.set("not empty");
                try {
                    assert.notEqual(spec.validationFunc(mug), "pass", property);
                } finally {
                    itext.id = before[0];
                    itext.set(before[1]);
                }
            });

            it("should not display " + property + " validation error for non-autoId empty itext with blank ID", function() {
                var itext = mug.p[property],
                    spec = mug.spec[property],
                    before = [itext.id, itext.get()];
                itext.autoId = false;
                itext.id = "";
                itext.set("");
                try {
                    assert.equal(spec.validationFunc(mug), "pass");
                } finally {
                    itext.id = before[0];
                    itext.set(before[1]);
                }
            });

            it("should not display " + property + " validation error for non-autoId valid itext id", function() {
                var itext = mug.p[property],
                    spec = mug.spec[property],
                    before = [itext.id, itext.get(), mug.p.constraintAttr];
                if (property === "constraintMsgItext") {
                    mug.p.constraintAttr = "x = y";
                }
                itext.autoId = false;
                itext.id = "node-id-label-itext";
                itext.set("node-id-label-itext");
                try {
                    assert.equal(spec.validationFunc(mug), "pass");
                } finally {
                    itext.id = before[0];
                    itext.set(before[1]);
                    mug.p.constraintAttr = before[2];
                }
            });

            it("should display " + property + " validation error for non-autoId invalid itext id", function() {
                var itext = mug.p[property],
                    spec = mug.spec[property],
                    before = [itext.id, itext.get(), mug.p.constraintAttr];
                if (property === "constraintMsgItext") {
                    mug.p.constraintAttr = "x = y";
                }
                itext.autoId = false;
                itext.id = "node-id-label-itext'&";
                itext.set("node-id-label-itext'&");
                try {
                    assert.notEqual(spec.validationFunc(mug), "pass", property);
                } finally {
                    itext.id = before[0];
                    itext.set(before[1]);
                    mug.p.constraintAttr = before[2];
                }
            });

            it("should not have " + property + "ID validator (it will not be invoked)", function() {
                assert(!mug.spec[property + "ID"].validationFunc,
                       property + "ID virtual property validator will not be invoked");
            });
        }

        testItextIdValidation("labelItext");
        testItextIdValidation("hintItext");
        testItextIdValidation("helpItext");
        testItextIdValidation("constraintMsgItext");

        it("should display constraintMsgItext validation error for non-autoId itext without validation condition", function() {
            var itext = mug.p.constraintMsgItext,
                spec = mug.spec.constraintMsgItext,
                before = mug.p.constraintAttr;
            itext.autoId = false;
            mug.p.constraintAttr = "";
            try {
                assert(itext.id, "constraintMsgItext.id should have a value");
                assert.equal(spec.validationFunc(mug),
                    "Can't have a Validation Message Itext ID without a Validation Condition");
            } finally {
                mug.p.constraintAttr = before;
            }
        });

        it("should not display constraintMsgItext validation error for autoId itext with validation condition", function() {
            var itext = mug.p.constraintMsgItext,
                spec = mug.spec.constraintMsgItext,
                before = mug.p.constraintAttr;
            itext.autoId = true;
            mug.p.constraintAttr = "x = y";
            try {
                assert.equal(spec.validationFunc(mug), "pass");
            } finally {
                mug.p.constraintAttr = before;
            }
        });

        it("should not display constraintMsgItext validation error after removing validation message and condition", function() {
            util.loadXML("");
            util.paste([
                ["id", "type", "constraintMsgItext:en-default", "constraintAttr", "constraintMsgAttr"],
                ["/text", "Text", "message!", ". = 'a'", "jr:itext('question1-constraintMsg')"],
            ]);
            $("[name='itext-en-constraintMsg']").val('').change();
            $("[name='property-constraintAttr']").val('').change();
            var message = $("[name='property-constraintAttr']").siblings(".messages").text();
            assert(!message, "unexpected message: " + message);
        });

        it("should show and hide the validation message as appropriate", function() {
            util.loadXML(GROUP_WITH_CONSTRAINT_XML);
            $("[name='property-constraintAttr']").val('true()').change();
            $("[name='itext-en-constraintMsg']").val('This is not possible').change();
            assert($("[name='itext-en-constraintMsg']").is(":visible"));
            $("[name='itext-en-constraintMsg']").val('').change();
            $("[name='property-constraintAttr']").val('').change();
            assert(!$("[name='itext-en-constraintMsg']").is(":visible"));
        });

        it("should show a validation error when dropping a self reference", function() {
            util.loadXML("");
            var mug = util.addQuestion("Text", "question1"),
                property = 'itext-en-label';
            util.clickQuestion("question1");

            assert.deepEqual(mug.messages.get(property), []);
            mug.form.vellum.handleDropFinish($('[name='+property+']'), '.', mug);
            assert.equal(mug.messages.get(property).length, 1,
                         util.getMessages(mug));

                mug.dropMessage(property, "core-circular-reference-warning");
                assert.deepEqual(mug.messages.get(property), []);
        });

        it("should show a validation error for choices without labels", function() {
            util.loadXML("");
            var select = util.addQuestion("Select", "question1"),
                item = select.form.getChildren(select)[0];
            util.clickQuestion("question1/choice1");

            var messages = item.messages.get('labelItext');
            assert.equal(messages.length, 0);

            $("[name='itext-en-label']").val('').change();

            messages = item.messages.get('labelItext');
            assert.equal(messages.length, 1);
            assert(messages[0].match(/required/i));
        });

        it("should not show a validation error for manually added choices", function() {
            util.loadXML("");
            var select = util.addQuestion("Select", "question1"),
                item = select.form.getChildren(select)[0];

            util.clickQuestion("question1/choice1");

            var messages = item.messages.get('labelItext');
            assert.equal(messages.length, 0);

            util.clickQuestion("question1");
            util.addQuestion("Choice", "choice3");
            messages = item.messages.get('labelItext');
            assert.equal(messages.length, 0);
        });

        it('should replace output values with $ on mug rename', function () {
            util.loadXML("");
            util.addQuestion('Text', 'text');
            util.addQuestion('Text', 'text2');
            util.clickQuestion('text');
            $('[name=itext-en-label]').val('<output value="regex(/data/text2, \'$[0-9]+\.[0-9]$\')" />').change();
            util.clickQuestion('text2');
            $('[name=property-nodeID]').val('text3').change();
            util.clickQuestion('text');
            assert.strictEqual($('[name=itext-en-label]').val(), '<output value="regex(/data/text3, \'$[0-9]+\.[0-9]$\')" />');
        });
    });

    describe("The javaRosa markdown detector", function() {
        _.each([
            "**Word!**",
            "**a bold phrase**",
        ], function (text) {
            it("should recognize " + JSON.stringify(text), function() {
                assert(jr.looksLikeMarkdown(text), "fail");
            });
        });

        _.each([
            "**not\nbold**",
        ], function (text) {
            it("should NOT recognize " + JSON.stringify(text), function() {
                assert(!jr.looksLikeMarkdown(text), "fail");
            });
        });
    });

    describe("The javaRosa plugin language selector", function() {
        before(function(done) {
            util.init({
                features: {rich_text: false},
                javaRosa: { langs: ['en'] },
                core: {onReady: done}
            });
        });

        it("should have option to display IDs", function() {
            util.loadXML("");
            util.addQuestion("Text", "question1");
            util.clickQuestion("question1");
            var $display = $(".fd-question-tree-display");
            var treeSelector = ".fd-question-tree .jstree-anchor";

            $("[name='itext-en-label']").val('x').change();
            assert.equal($(treeSelector).text(), "x");
            $("[name='itext-en-label']").val('').change();
            assert.equal($(treeSelector).text(), "question1");

            $display.val('en').change();
            $("[name='itext-en-label']").val('english').change();
            assert.equal($(treeSelector).text(), "english");
            $display.val('_ids').change();
            assert.equal($(treeSelector).text(), "question1");
        });

        it("should only display once after multiple load xml", function() {
            assert.strictEqual($('#fd-questions-dropdown-menu li:contains("Display")').length, 1);
            util.loadXML("");
            assert.strictEqual($('#fd-questions-dropdown-menu li:contains("Display")').length, 1);
            util.loadXML("");
            assert.strictEqual($('#fd-questions-dropdown-menu li:contains("Display")').length, 1);
        });
    });
});
