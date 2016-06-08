define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/expressionEditor',
    'vellum/util'
], function (
    chai,
    $,
    _,
    util,
    expressionEditor,
    vellumUtil
) {
    var assert = chai.assert,
        real_showXPathEditor = expressionEditor.showXPathEditor,
        events = {};

    vellumUtil.eventuality(events);

    // setup event so we can hook into xpath editor show
    expressionEditor.showXPathEditor = function () {
        real_showXPathEditor.apply(null, arguments);
        events.fire("showXPathEditor");
    };

    describe("The widgets module", function () {
        before(function (done) {
            util.init({
                javaRosa: { langs: ['en'] },
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("modeliteration"),
                               "modeliteration plugin should be enabled");
                        done();
                    }
                },
                features: {rich_text: false},
            });
        });

        it("xPath widget should show newlines in advanced mode", function (done) {
            // HACK this ugly test references a lot of implementation details
            util.loadXML("");
            var value = '"line 1 \n line 2"',
                escaped = '"line 1 &#10; line 2"';
            util.addQuestion("DataBindOnly", "hidden", {
                calculateAttr: value
            });
            util.clickQuestion("/data/hidden");
            var input = $("[name=property-calculateAttr]");
            assert.equal(input.val(), escaped);

            // click Edit button
            input.closest(".form-group").find(".fd-edit-button").click();

            events.on("showXPathEditor", function () {
                var text = $(".xpath-advanced").find("textarea").val();
                $(".fd-xpath-cancel-button").click();
                assert.equal(text, value, "textarea content should have newline");
                done();
            }, null, "showXPathEditor");
        });

        it("xPath widget should escape newlines on save advanced mode", function (done) {
            // HACK this ugly test references a lot of implementation details
            util.loadXML("");
            var value = '"line 1 \n line 2"',
                escaped = '"line 1 &#10; line 2"',
                hidden = util.addQuestion("DataBindOnly", "hidden", {
                    calculateAttr: ""
                });
            util.clickQuestion("/data/hidden");

            // click Edit button
            var input = $("[name=property-calculateAttr]");
            input.closest(".form-group").find(".fd-edit-button").click();

            events.on("showXPathEditor", function () {
                var textarea = $(".xpath-advanced").find("textarea");
                textarea.val(value).change();
                $(".fd-xpath-save-button").click();

                var input = $("[name=property-calculateAttr]");
                assert.equal(input.val(), escaped, "input value not escaped");
                assert.equal(hidden.p.calculateAttr, value, "wrong mug value");
                done();
            }, null, "showXPathEditor");
        });

        it("xPath widget should show /data/ when in advanced editor without rich_text", function (done) {
            util.loadXML("");
            util.addQuestion("Text", "text");
            var value = '/data/text',
                escaped = '`#form/text`',
                hidden = util.addQuestion("DataBindOnly", "hidden", {
                    calculateAttr: escaped
                });
            assert.equal(hidden.p.calculateAttr, escaped);
            util.clickQuestion("/data/hidden");

            // click Edit button
            var input = $("[name=property-calculateAttr]");
            input.closest(".form-group").find(".fd-edit-button").click();

            events.on("showXPathEditor", function () {
                var textarea = $(".xpath-advanced").find("textarea");
                assert.equal(textarea.val(), value, "input value showing #form");
                assert.equal(hidden.p.calculateAttr, escaped, "value not in vellum internal form");
                done();
            }, null, "showXPathEditor");
        });
    });

    describe("The rich text widget", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {rich_text: true},
            });
        });

        describe("should preserve", function() {
            var data = [
                    ["id", "type", "labelItext:en-default"],
                    ["/newlines", "Text", "list\n\n* item\n* item\n"],
                    ["/spaces", "Text", "a  b   c    d"],
                ];
            before(function () {
                util.loadXML("");
                util.paste(data);
            });

            _.each(data.slice(1), function (row) {
                var name = row[0].slice(1);
                it(name, function (done) {
                    util.clickQuestion(name);
                    var widget = util.getWidget('itext-en-label');
                    widget.getValue(function (val) {
                        // async assert because ckEditor setData is async
                        util.assertEqual(val, row[2]);
                        done();
                    });
                });
            });
        });

        it("should return just-set value on get value", function () {
            util.loadXML("");
            util.paste([
                ["id", "type", "labelItext:en-default"],
                ["/text", "Text", ""],
            ]);
            util.clickQuestion('text');
            var widget = util.getWidget('itext-en-label'),
                text = '<output value="/data/text" />';
            widget.setValue(text);
            assert.equal(widget.getValue(), text);
        });

        it("should create reference to hidden value in display condition", function (done) {
            util.loadXML("");
            util.paste([
                ["id", "type", "labelItext:en-default"],
                ["/hidden", "DataBindOnly", "null"],
                ["/text", "Text", "test"],
            ]);
            util.clickQuestion('text');
            var text = util.getMug("text"),
                disp = util.getWidget("property-relevantAttr"),
                tree = $(".fd-question-tree").jstree(true);
            assert.equal(disp.input.length, 1);
            disp.input.promise.then(function () { // wait for editor to be ready
                util.findNode(tree, "hidden").data.handleDrop(disp.input);
                disp.handleChange();
                assert.equal(text.p.relevantAttr, '`#form/hidden`');
                done();
            });
        });
    });
});
