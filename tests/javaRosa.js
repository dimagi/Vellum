/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/javaRosa',
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
    'text!static/markdown/with-markdown.xml',
    'text!static/markdown/no-markdown.xml'
], function (
    chai,
    $,
    _,
    util,
    jr,
    vellum_util,
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
    WITH_MARKDOWN_XML,
    NO_MARKDOWN_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The javaRosa plugin with multiple languages", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en', 'hin']},
                core: {onReady: function () { done(); }}
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
                util.xmlines(TEST_XML_2),
                {normalize_xmlns: true}
            );
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

        it("should update output refs when question ids change", function () {
            util.loadXML("");
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
        });

        it("should only update exact output ref matches when question ids change", function () {
            util.loadXML("");
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
        });

        it("should escape inequality operators in output ref", function () {
            util.loadXML(OUTPUTREF_WITH_INEQUALITY_XML);
            var mug = util.getMug("product");
            assert.equal(mug.p.labelItext.get(),
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
            var mug1 = util.addQuestion("Text", "question1"),
                mug2 = util.addQuestion("Text", "question2");

            var target = $("[name='itext-en-label']"),
                sourceUid = mug1.ufid;
            target.val("test string").change();
            vellum_util.setCaretPosition(target[0], 4);
            call("handleDropFinish", target, sourceUid, mug1);
            var val = mug2.p.labelItext.get('default', 'en');
            assert.equal(val, 'test<output value="/data/question1" /> string');
        });

        it("output ref deleted with single backspace", function () {
            util.loadXML("");
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
            var val = mug.p.labelItext.get('default', 'en');
            assert.equal(val, 'question1  end');
        });

        it("output ref deleted with single delete keypress", function () {
            util.loadXML("");
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
            var val = mug.p.labelItext.get('default', 'en');
            assert.equal(val, 'question1  end');
        });

        it("should update output ref on group rename", function () {
            util.loadXML(OUTPUTREF_GROUP_RENAME_XML);
            var group = util.call("getMugByPath", "/data/question2"),
                q1 = util.call("getMugByPath", "/data/question1"),
                itext = q1.p.labelItext;

            assert(itext.get().indexOf('"/data/question2/question3"') > 0,
                '"/data/question2/question3" not in ' + itext.get());
            group.p.nodeID = "group";
            assert(itext.get('default', 'en').indexOf('"/data/group/question3"') > 0,
                '"/data/group/question3" not in ' + itext.get('default', 'en'));
            assert(itext.get('default', 'hin').indexOf('"/data/group/question3"') > 0,
                '"/data/group/question3" not in ' + itext.get('default', 'hin'));
        });

        it("should add warning on add Audio output ref to itext", function () {
            util.loadXML("");
            var audio = util.addQuestion("Audio", "audio"),
                text = util.addQuestion("Text", "text"),
                target = $("[name='itext-en-label']");
            call("handleDropFinish", target, audio.ufid, audio);
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
                         'label\tdefault-en\tdefault-hin\t' +
                         'audio-en\taudio-hin\timage-en\timage-hin\tvideo-en\tvideo-hin\n' +
                         'question1-label\t"First ""line\nSecond"" line\nThird line"\t' +
                         'Hindu trans\t\t\t\t\t\t');
        });

        it("should escape all languages when generating bulk translations", function () {
            var form = util.loadXML(MULTI_LANG_TRANS_XML),
                Itext = util.call("getData").javaRosa.Itext;
            assert.equal(jr.generateItextXLS(form, Itext),
                         'label\tdefault-en\tdefault-hin\taudio-en\taudio-hin\t' +
                         'image-en\timage-hin\tvideo-en\tvideo-hin\n' +
                         'text-label\t"""Text"\t"""Text"\t\t\t\t\t\t');
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

        it("should not create duplicate <help> node on select", function () {
            util.loadXML(SELECT1_HELP_XML);
            var xml = call("createXML"),
                $xml = $(xml);
            assert.strictEqual($xml.find("help").length, 1, "wrong <help> node count\n" + xml);
        });

        it("should rename itext item ID after move", function () {
            util.loadXML("");
            util.addQuestion("Select", "ns");
            util.addQuestion("Select", "ew");
            var north = util.getMug("ns/item1"),
                south = util.getMug("ew/item1");
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

        it("should not auto-update itext ID when multiple questions point to auto-ish-id", function () {
            util.loadXML(ITEXT_ITEM_NON_AUTO_ID_XML);
            var north = util.getMug("north");
            north.p.nodeID = "west";
            var xml = call("createXML"),
                $xml = $(xml);
            assert.strictEqual($xml.find("text#north-label").length, 2,
                               "wrong <text> node count\n" + xml);
        });

        it("should add markdown to existing help text", function() {
            util.loadXML(NO_MARKDOWN_XML);
            util.assertXmlEqual(call('createXML'), WITH_MARKDOWN_XML);
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
            util.addQuestion("Select", "select");
            util.clickQuestion('select/item1');
            $("[name='property-nodeID']").val("blah ' blah").change();
            assert.strictEqual($("[name='property-labelItext']").val(), 'select-blah___blah-labelItext');
        });
    });

    describe("The javaRosaplugin with one language", function() {
        before(function(done) {
            util.init({
                javaRosa: { langs: ['en'] },
                core: {
                    onReady: function () {
                        done();
                    }
                }
            });
        });

        it("should replace the default form with placeholder when cleared", function(){
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

        it("should show and hide the validation message as appropriate", function() {
            util.loadXML(GROUP_WITH_CONSTRAINT_XML);
            $("[name='property-constraintAttr']").val('true()').change();
            $("[name='itext-en-constraintMsg']").val('This is not possible').change();
            assert($("[name='itext-en-constraintMsg']").is(":visible"));
            $("[name='itext-en-constraintMsg']").val('').change();
            $("[name='property-constraintAttr']").val('').change();
            assert(!$("[name='itext-en-constraintMsg']").is(":visible"));
        });

    });

    describe("The javaRosa plugin language selector", function() {
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
                            <value form="markdown">question1 en help</value>\
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
                            <value form="markdown">question1 hin help</value>\
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
