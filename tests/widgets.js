require([
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
            input.closest(".control-group").find(".fd-edit-button").click();

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
            input.closest(".control-group").find(".fd-edit-button").click();

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
    });

    describe("The rich text widget", function () {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
                features: {rich_text: true},
            });
        });

        it("should preserve newlines", function(done) {
            util.loadXML("");
            util.paste([
                ["id", "type", "labelItext:en-default"],
                ["/text", "Text", "list\n\n* item\n* item\n"],
            ]);
            util.clickQuestion('text');
            // NOTE async assert because ckEditor setData is async.
            // Without this we get an empty string from getValue().
            // This probably means there are bugs elsewhere because
            // we depend on widget.getValue() returning the correct
            // result immediately after widget.setValue(x) is called.
            var richItext = util.getWidget('itext-en-label');
            richItext.getValue(function (val) {
                util.assertEqual(val, "list\n\n* item\n* item\n");
                done();
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
    });
});
