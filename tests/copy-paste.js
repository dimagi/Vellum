require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'text!static/copy-paste/four-questions.xml',
    'text!static/copy-paste/many-itext-forms.xml',
    'text!static/copy-paste/text-question.xml',
    'text!static/copy-paste/two-choices.xml',
    'text!static/copy-paste/two-questions.xml',
    'vellum/copy-paste',
    'vellum/tsv'
], function (
    chai,
    $,
    _,
    util,
    FOUR_QUESTIONS_XML,
    MANY_ITEXT_FORMS_XML,
    TEXT_QUESTION_XML,
    TWO_CHOICES_XML,
    TWO_QUESTIONS_XML,
    mod,
    tsv
) {
    var assert = chai.assert,
        call = util.call,
        HEADER = ["Form Builder clip", "version 1"];

    function eq(serial, rows, message) {
        if (!_.isString(rows)) {
            rows = tsv.tabDelimit([HEADER].concat(rows));
        }
        util.assertEqual(serial + "\n", rows + "\n",
                         message || "cut or copy mismatch");
    }

    function paste(rows, errors, print) {
        if (!_.isString(rows)) {
            rows = tsv.tabDelimit([HEADER].concat(rows));
        }
        if (print) { window.console.log(rows); } // debugging helper
        assert.deepEqual(mod.paste(rows), errors || []);
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

        _.each([
            {
                message: "a text question",
                xml: TEXT_QUESTION_XML,
                serial: tsv.tabDelimit([
                    HEADER,
                    [
                        "id",
                        "type",
                        "labelItext:en-default",
                        "labelItext:hin-default",
                        "constraintMsgItext:en-default",
                        "constraintMsgItext:hin-default",
                        "constraintAttr",
                        "relevantAttr",
                        "requiredAttr",
                    ], [
                        "/txt",
                        "Text",
                        "English Text",
                        "Hindi Text",
                        "Nope",
                        "Nope",
                        "1 = 0",
                        "x = y",
                        "true",
                    ],
                ]),
            }, {
                message: "two text questions",
                xml: TWO_QUESTIONS_XML,
                select: ["text", "choice"],
                serial: tsv.tabDelimit([
                    HEADER,
                    [
                        "id",
                        "type",
                        "labelItext:en-default",
                        "labelItext:hin-default",
                        "labelItext",
                    ], [
                        "/text",
                        "Text",
                        "text with image",
                        "text with image",
                        "default-label",
                    ], [
                        "/choice",
                        "Select",
                        "Do you like it?",
                        "Do you like it?",
                        "null",
                    ], [
                        "/choice/true",
                        "Item",
                        "Yes",
                        "Yes",
                        "null",
                    ], [
                        "/choice/false",
                        "Item",
                        "No",
                        "No",
                        "null",
                    ],
                ]),
            }, {
                message: "two choices with shared itext",
                xml: TWO_CHOICES_XML,
                select: ["box", "fox"],
                serial: tsv.tabDelimit([
                    HEADER,
                    [
                        "id",
                        "type",
                        "labelItext:en-default",
                        "labelItext:hin-default",
                        "labelItext",
                    ], [
                        "/box",
                        "Select",
                        "In a box?",
                        "In a box?",
                        "null",
                    ], [
                        "/box/yes",
                        "Item",
                        "Yes",
                        "Yes",
                        "yes-label",
                    ], [
                        "/box/no",
                        "Item",
                        "No",
                        "No",
                        "no-label",
                    ], [
                        "/fox",
                        "Select",
                        "With a fox?",
                        "With a fox?",
                        "null",
                    ], [
                        "/fox/yes",
                        "Item",
                        "Yes",
                        "Yes",
                        "yes-label",
                    ], [
                        "/fox/no",
                        "Item",
                        "No",
                        "No",
                        "no-label",
                    ],
                ]),
            }, {
                message: "a question with many itext forms",
                xml: MANY_ITEXT_FORMS_XML,
                serial: tsv.tabDelimit([
                    HEADER,
                    [
                        "id",
                        "type",
                        "labelItext:en-default",
                        "labelItext:hin-default",
                        "labelItext:en-audio",
                        "labelItext:hin-audio",
                        "labelItext:en-custom",
                        "labelItext:hin-custom",
                        "labelItext:en-image",
                        "labelItext:hin-image",
                        "labelItext:en-long",
                        "labelItext:hin-long",
                        "labelItext:en-short",
                        "labelItext:hin-short",
                        "labelItext:en-video",
                        "labelItext:hin-video",
                        "labelItext",
                        "constraintMsgItext:en-default",
                        "constraintMsgItext:hin-default",
                        "helpItext:en-default",
                        "helpItext:hin-default",
                        "helpItext:en-audio",
                        "helpItext:hin-audio",
                        "helpItext:en-image",
                        "helpItext:hin-image",
                        "helpItext:en-video",
                        "helpItext:hin-video",
                        "helpItext",
                        "hintItext:en-default",
                        "hintItext:hin-default",
                        "hintItext",
                        "constraintAttr",
                        "hintLabel",
                    ], [
                        "/text",
                        "Text",
                        "default",
                        "default",
                        "jr://file/commcare/audio/data/text.mp3",
                        "jr://file/commcare/audio/data/text.mp3",
                        "custom",
                        "custom",
                        "jr://file/commcare/image/data/text.png",
                        "jr://file/commcare/image/data/text.png",
                        "long",
                        "long",
                        "short",
                        "short",
                        "jr://file/commcare/video/data/text.3gp",
                        "jr://file/commcare/video/data/text.3gp",
                        "default-label",
                        "valid",
                        "valid",
                        "help",
                        "help",
                        "jr://file/commcare/audio/help/data/text.mp3",
                        "jr://file/commcare/audio/help/data/text.mp3",
                        "jr://file/commcare/image/help/data/text.png",
                        "jr://file/commcare/image/help/data/text.png",
                        "jr://file/commcare/video/help/data/text.3gp",
                        "jr://file/commcare/video/help/data/text.3gp",
                        "default-help",
                        "hint",
                        "hint",
                        "default-hint",
                        "1 = 0",
                        "hint label",
                    ],
                ]),
            }
        ], function (item) {
            it("should copy " + item.message, function () {
                util.loadXML(item.xml);
                if (item.select) {
                    util.clickQuestion.apply(null, item.select);
                }
                eq(mod.copy(), item.serial);
            });

            it("should paste " + item.message, function () {
                util.loadXML("");
                assert.deepEqual(mod.paste(item.serial), []);
                util.assertXmlEqual(call("createXML"), item.xml, {normalize_xmlns: true});
            });
        });

        it("should copy two text questions in a group", function () {
            util.loadXML(FOUR_QUESTIONS_XML);
            util.clickQuestion("group/text", "group/choice");
            eq(mod.copy(), [
                [
                    "id",
                    "type",
                    "labelItext:en-default",
                    "labelItext:hin-default",
                    "labelItext:en-image",
                    "labelItext:hin-image",
                    "labelItext",
                ], [
                    "/group/text",
                    "Text",
                    "text with image",
                    "ひらがな",
                    "jr://file/commcare/image/data/en-text.png",
                    "jr://file/commcare/image/data/hin-text.png",
                    "text-label",
                ], [
                    "/group/choice",
                    "Select",
                    "Do you like it?",
                    "Do you like it?",
                    "null",
                    "null",
                    "null",
                ], [
                    "/group/choice/true",
                    "Item",
                    "Yes",
                    "Yes",
                    "null",
                    "null",
                    "null",
                ], [
                    "/group/choice/false",
                    "Item",
                    "No",
                    "No",
                    "null",
                    "null",
                    "null",
                ],
            ]);
        });

        it("should paste two questions with the same id", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text1", "text1"],
                ["/text", "Text", "text2", "text2"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text1", "text1"],
                ["/copy-1-of-text", "Text", "text2", "text2"],
            ]);
        });

        it("should auto-rename pasted question with duplicate id", function () {
            util.loadXML("");
            // setup
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text1", "text1"],
            ]);
            // paste duplicate
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text2", "text2"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text1", "text1"],
                ["/copy-1-of-text", "Text", "text2", "text2"],
            ]);
        });

        it("should copy conflicted question id", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text1", "text1"],
                ["/other", "Text", "text2", "text2"],
            ]);
            var mug = util.getMug("other");
            mug.p.nodeID = "text";
            assert(mug.messages.get("nodeID", "mug-conflictedNodeId-warning"),
                   "expected confict warning");
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "conflictedNodeId"],
                ["/text", "Text", "text1", "text1", "null"],
                ["/copy-1-of-text", "Text", "text2", "text2", "text"],
            ]);
        });

        it("should paste two questions with the same id (one in group)", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
                ["/group", "Group", "group", "group"],
                ["/group/text", "Text", "text", "text"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
                ["/group", "Group", "group", "group"],
                ["/group/text", "Text", "text", "text"],
            ]);
        });

        it("should paste three groups after text question", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
            ]);
            util.clickQuestion("text");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/group1", "Group", "group", "group"],
                ["/group2", "Group", "group", "group"],
                ["/group3", "Group", "group", "group"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
                ["/group1", "Group", "group", "group"],
                ["/group2", "Group", "group", "group"],
                ["/group3", "Group", "group", "group"],
            ]);
        });

        it("should paste three groups into group", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/group", "Group", "group", "group"],
            ]);
            util.clickQuestion("group");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/group1", "Group", "group", "group"],
                ["/group2", "Group", "group", "group"],
                ["/group3", "Group", "group", "group"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/group", "Group", "group", "group"],
                ["/group/group1", "Group", "group", "group"],
                ["/group/group2", "Group", "group", "group"],
                ["/group/group3", "Group", "group", "group"],
            ]);
        });

        it("should resolve pasted question with conflicting question ID", function () {
            util.loadXML("");
            paste([
                ["id", "type", "calculateAttr", "conflictedNodeId"],
                ["/radius", "DataBindOnly", "42", "null"],
                ["/copy-1-of-pi", "DataBindOnly", "3.1415", "pi"],
                ["/circumference", "DataBindOnly", "2 * /data/copy-1-of-pi * /data/radius", "null"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "calculateAttr"],
                ["/radius", "DataBindOnly", "42"],
                ["/pi", "DataBindOnly", "3.1415"],
                ["/circumference", "DataBindOnly", "2 * /data/pi * /data/radius"],
            ]);
        });

        it("should not paste item into tree root", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/select/item", "Item", "item1", "item1"],
            ], ["Cannot insert Choice into tree root"]);
            util.selectAll();
            eq(mod.copy(), "");
        });

        it("should not paste text into select", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/select", "Select", "select", "select"],
                ["/select/item1", "Item", "item1", "item1"],
            ]);
            util.clickQuestion("select/item1");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
            ], ["Cannot insert Text into Single Answer"]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/select", "Select", "select", "select"],
                ["/select/item1", "Item", "item1", "item1"],
            ]);
        });

        it("should paste question with empty id", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["", "Text", "text", "text"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/question1", "Text", "text", "text"],
            ]);
        });

        it("should paste question with / id", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/", "Text", "text", "text"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/question2", "Text", "text", "text"],
            ]);
        });

        it("should not paste item into or after text", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
            ]);
            util.selectAll();
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/select/item", "Item", "item1", "item1"],
            ], ["Cannot insert Choice into or after Text"]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "text", "text"],
            ]);
        });

        it("should not overwrite itext with auto-id", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "auto", "auto"],
            ]);
            util.clickQuestion("text");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "labelItext"],
                ["/text2", "Text", "non", "non", "text-label"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "labelItext"],
                ["/text", "Text", "auto", "auto", "null"],
                ["/text2", "Text", "non", "non", "text-label"],
            ]);
            call("createXML");
            var text = util.getMug("text"),
                text2 = util.getMug("text2");
            // NOTE which one gets auto-renamed is somewhat arbitrary
            assert.equal(text.p.labelItext.autoId, true);
            assert.equal(text.p.labelItext.id, "text-label");
            assert.equal(text.p.labelItext.get(), "auto");
            assert.equal(text2.p.labelItext.autoId, false);
            assert.equal(text2.p.labelItext.id, "text-label2");
            assert.equal(text2.p.labelItext.get(), "non");
        });

        it("should fill empty itext forms", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default"],
                ["/text1", "Text", "Label"],
                ["/text2", "Text", ""],
                ["/text3", "Text", "null"],
                ["/text4", "Text"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text1", "Text", "Label", "Label"],
                ["/text2", "Text", "text2", "text2"],
                ["/text3", "Text", "text3", "text3"],
                ["/text4", "Text", "text4", "text4"],
            ]);
        });

        it("should fill empty default itext forms", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "", "Label"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "Label", "Label"],
            ]);
        });

        it("should ignore extra cells in header row", function () {
            util.loadXML("");
            paste(tsv.tabDelimit([
                HEADER.concat(["", ""]),
                ["id", "type", "labelItext:en-default", "labelItext"],
                ["/text1", "Text", "text", "text-id"],
            ]));
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "labelItext"],
                ["/text1", "Text", "text", "text", "text-id"],
            ]);
        });

        it("should ignore empty itext ID", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext"],
                ["/text1", "Text", "text"],
                ["/text2", "Text"],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text1", "Text", "text", "text"],
                ["/text2", "Text", "text2", "text2"],
            ]);
        });

        it("should remove questions on cut", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext"],
                ["/text1", "Text", "text", "text-id"],
            ]);
            util.selectAll();
            eq(mod.cut(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "labelItext"],
                ["/text1", "Text", "text", "text", "text-id"],
            ]);
            util.selectAll();
            eq(mod.cut(), "");
        });

        it("should copy dynamic select with itemset data", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "itemsetData"],
                ["/select", "SelectDynamic", "select",
                 '[{"instance":null,"nodeset":"/items","labelRef":"@name","valueRef":"@id"}]'],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "itemsetData"],
                ["/select", "SelectDynamic", "select", "select",
                 '[{"instance":null,"nodeset":"/items","labelRef":"@name","valueRef":"@id"}]'],
            ]);
        });

        it("should not cut itemset (External Data)", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "itemsetData"],
                ["/select", "SelectDynamic", "select",
                 '[{"instance":null,"nodeset":"/items","labelRef":"@name","valueRef":"@id"}]'],
            ]);
            util.clickQuestion("select/itemset");
            eq(mod.cut(), "");
            assert(util.getMug("select/itemset"), "itemset should not be cut");
        });

        it("should show validation errors in tree after paste", function () {
            util.loadXML("");
            paste([
                ["id", "type", "calculateAttr"],
                ["/two", "DataBindOnly", "2"],
                ["/double_trouble", "DataBindOnly", "/data/two * /data/trouble"],
            ]);
            assert(util.isTreeNodeValid("two"), util.getMessages("two"));
            assert(!util.isTreeNodeValid("double_trouble"),
                   "double_trouble should not be valid");
        });

        it("should show warning on paste missing multimedia", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-audio"],
                ["/text", "Text", "jr://file/commcare/audio/data/question1.mp3"],
            ]);
            var mug = util.getMug("text");
            assert(mug.messages.get("labelItext", "missing-multimedia-warning"),
                   "text should have missing-multimedia-warning");
        });

        it("should copy questions in tree order", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default"],
                ["/text1", "Text", "text1"],
                ["/text2", "Text", "text2"],
                ["/text3", "Text", "text3"],
                ["/group", "Group", "group"],
                ["/group/text1", "Text", "text1"],
                ["/group/text2", "Text", "text2"],
                ["/group/text3", "Text", "text3"],
            ]);
            util.clickQuestion(
                "text3",
                "group/text2",
                "group/text1",
                "text1"
            );
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text1", "Text", "text1", "text1"],
                ["/text3", "Text", "text3", "text3"],
                ["/group/text1", "Text", "text1", "text1"],
                ["/group/text2", "Text", "text2", "text2"],
            ]);
        });

        it("should paste questions in tree order", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/question1", "Text", "question1", "question1"],
                ["/question2", "Select", "question2", "question2"],
                ["/question2/item1", "Item", "item1", "item1"],
                ["/question2/item2", "Item", "item2", "item2"],
                ["/question3", "Int", "question3", "question3"],
                ["/question4", "Date", "question4", "question4"],
                ["/question5", "DataBindOnly", "null", "null"],
            ]);
            util.clickQuestion(
                "question1",
                "question2",
                "question3",
                "question4",
                "question5"
            );
            mod.paste(mod.copy());
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/question1", "Text", "question1", "question1"],
                ["/question2", "Select", "question2", "question2"],
                ["/question2/item1", "Item", "item1", "item1"],
                ["/question2/item2", "Item", "item2", "item2"],
                ["/question3", "Int", "question3", "question3"],
                ["/question4", "Date", "question4", "question4"],
                ["/question5", "DataBindOnly", "null", "null"],
                ["/copy-1-of-question1", "Text", "question1", "question1"],
                ["/copy-1-of-question2", "Select", "question2", "question2"],
                ["/copy-1-of-question2/item1", "Item", "item1", "item1"],
                ["/copy-1-of-question2/item2", "Item", "item2", "item2"],
                ["/copy-1-of-question3", "Int", "question3", "question3"],
                ["/copy-1-of-question4", "Date", "question4", "question4"],
                ["/copy-1-of-question5", "DataBindOnly", "null", "null"],
            ]);
        });

        it("should warn about discarded languages", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:es-default", "labelItext:fr-default"],
                ["/text", "Text", "english", "spanish", "french"],
            ], ["Discarded languages: es, fr"]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/text", "Text", "english", "english"],
            ]);
            assert(util.isTreeNodeValid("text"), util.getMessages("text"));
        });

        it("should paste and copy a model iteration repeat group", function () {
            util.loadXML("");
            paste([
                ['id', 'type', 'labelItext:en-default', 'labelItext:hin-default', 'dataSource'],
                ['/repeat/item', 'Repeat', 'repeat', 'repeat',
                    '{"instance":' +
                        '{"id":"products","src":"jr://commtrack:products"},' +
                        '"idsQuery":"instance(\'products\')/products/product/@id"}'],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ['id', 'type', 'labelItext:en-default', 'labelItext:hin-default', 'dataSource'],
                ['/repeat/item', 'Repeat', 'repeat', 'repeat',
                    '{"instance":' +
                        '{"id":"products","src":"jr://commtrack:products"},' +
                        '"idsQuery":"instance(\'products\')/products/product/@id"}'],
            ]);
            assert(util.isTreeNodeValid("repeat/item"), util.getMessages("repeat/item"));
        });

        it("should paste and copy an Android App Callout", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "intent"],
                ["/app", "AndroidIntent", "app", "app", JSON.stringify({
                    path: "app-id",
                    xmlns: "commcare.org/xforms",
                    extra: {key1:"val1", key2:"val2"},
                    response: {key3: "val3"},
                    unknownAttributes: {type: "robin"}
                })],
            ]);
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "labelItext:en-default", "labelItext:hin-default", "intent"],
                ["/app", "AndroidIntent", "app", "app", JSON.stringify({
                    path: "app-id",
                    xmlns: "commcare.org/xforms",
                    extra: {key1:"val1", key2:"val2"},
                    response: {key3: "val3"},
                    unknownAttributes: {type: "robin"}
                })],
            ]);
            var messages = util.getMug("app").messages.get();
            chai.expect(messages[0]).to.include("works on Android devices");
            assert.equal(messages.length, 1, messages);
        });

        it("should paste and copy a Balance", function () {
            util.loadXML("");
            paste([
                ["id", "type", "entityId", "entryId", "quantity", "sectionId"],
                ["/bal", "Balance", "/case", "/product", "/qty", "/balance-id"],
            ]);
            util.loadXML(call("createXML"));
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "entityId", "entryId", "quantity",
                    "rawDataAttributes", "sectionId"],
                ["/bal", "Balance", "/case", "/product", "/qty",
                    '{"entity-id":"","date":""}', "/balance-id"],
            ]);
            var id = "balance[@type='bal']";
            assert(util.isTreeNodeValid(id), util.getMessages(id));
        });

        it("should paste and copy a Transfer", function () {
            util.loadXML("");
            paste([
                ["id", "type", "dest", "entryId", "quantity", "sectionId", "src"],
                ["/tx", "Transfer", "/dst", "/product", "/qty", "/balance", "/src"],
            ]);
            util.loadXML(call("createXML"));
            util.selectAll();
            eq(mod.copy(), [
                ["id", "type", "dest", "entryId", "quantity",
                    "rawDataAttributes", "sectionId", "src"],
                ["/tx", "Transfer", "/dst", "/product", "/qty",
                    '{"date":"","src":"","dest":""}', "/balance", "/src"],
            ]);
            var id = "transfer[@type='tx']";
            assert(util.isTreeNodeValid(id), util.getMessages(id));
        });

        it("should not overwrite manually typed question ID with copy-N-of-...", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default"],
                ["/text", "Text", "text"],
                ["/text", "Text", "text"],
            ]);
            var input = $("[name=property-nodeID]");
            input.val("other").change();
            assert.equal(input.val(), "other");
        });

        describe("with multimedia", function () {
            before(function (done) {
                util.init({
                    javaRosa: { langs: ['en', 'hin'] },
                    uploader: { objectMap: {
                        "jr://file/commcare/audio/data/question1.mp3": true
                    }},
                    core: {
                        onReady: function () {
                            assert(this.isPluginEnabled("copyPaste"),
                                   "copyPaste plugin should be enabled");
                            done();
                        }
                    }
                });
            });

            it("should not show warning on paste existing multimedia", function () {
                util.loadXML("");
                paste([
                    ["id", "type", "labelItext:en-audio"],
                    ["/text", "Text", "jr://file/commcare/audio/data/question1.mp3"],
                ]);
                var messages = util.getMessages("text");
                assert(!messages, messages);
            });
        });
    });



    describe("The copy-paste string conversions should", function () {
        function test(value, string) {
            var json = JSON.stringify(value),
                jstr = JSON.stringify(string);

            it("stringify(" + json + ") -> " + jstr, function () {
                assert.deepEqual(mod.stringify(value), string);
            });

            it(" valuify(" + jstr + ") -> " + json, function () {
                assert.deepEqual(mod.valuify(string), value);
            });
        }

        // primitives
        test(null, 'null');
        test(true, 'true');
        test(false, 'false');
        test("null", '"null"');
        test("true", '"true"');
        test("false", '"false"');

        // JSON-like values
        test([], '[]');
        test({}, '{}');
        test('', '');
        test('x', 'x');
        test('"', '"');
        test('[\n]', '"[\\n]"');
        test("{\n}", '"{\\n}"');
        test('"\n"', '"\\"\\n\\""');

        // numbers
        test(0, '0');
        test(1, '1');
        test(350, '350');
        test(0.5, '0.5');
        test(-1.2e-10, '-1.2e-10');
        test("0", '"0"');
        test("1", '"1"');
        test("350", '"350"');
        test("0.5", '"0.5"');
        test("-1.2e-10", '"-1.2e-10"');

        // edge cases
        (function (undefined) {
            // is this what we want? does it matter?
            test(undefined, undefined);
        })();
        test("{1} ", "{1} ");
        test("{1} {2}", '"{1} {2}"');
        test("[1] [2]", '"[1] [2]"');
        test("01", '"01"');
    });
});
