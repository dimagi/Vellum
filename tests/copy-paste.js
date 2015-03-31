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
        util.assertEqual(serial + "\n", rows + "\n", message);
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
                        "",
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

        it("should not paste item into tree root", function () {
            util.loadXML("");
            paste([
                ["id", "type", "labelItext:en-default", "labelItext:hin-default"],
                ["/select/item", "Item", "item1", "item1"],
            ], ["Cannot insert Item into tree root"]);
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
            ], ["Cannot insert Text into Select"]);
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
            ], ["Cannot insert Item into or after Text"]);
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
            assert.equal(text2.p.labelItext.autoId, false);
            assert.equal(text2.p.labelItext.id, "text-label2");
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

        // TODO test each mug spec item (don't forget exotic/plugin question types)
        // TODO test bad paste values
        // TODO find a case where, when copying multiple questions, one
        //      ends up with a null value on a property that it did not
        //      return from mug.serialize(), and should not be passed
        //      to mug.deserialize().
        //      ALSO maybe find the converse: property serializes to null
        //      but that null value must be passed to mug.deserialize()
        //      (seems less likely that this is a thing)

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
