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
                }
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
            input.closest("div").siblings(".fd-edit-button").click();

            events.on("showXPathEditor", function () {
                events.unbind(events); // unregister this event handler first
                var textarea = $(".xpath-advanced").find("textarea");
                assert.equal(textarea.val(), value,
                             "textarea content should have newline");
                $(".fd-xpath-cancel-button").click();
                done();
            }, null, events);
        });

        it("xPath widget should escape newlines on save advanced mode", function (done) {
            // HACK this ugly test references a lot of implementation details
            util.loadXML("");
            var value = '"line 1 \n line 2"',
                escaped = '"line 1 &#10; line 2"';
            util.addQuestion("DataBindOnly", "hidden", {
                calculateAttr: ""
            });
            util.clickQuestion("/data/hidden");

            // click Edit button
            var input = $("[name=property-calculateAttr]");
            input.closest("div").siblings(".fd-edit-button").click();

            events.on("showXPathEditor", function () {
                events.unbind(events); // unregister this event handler first
                var textarea = $(".xpath-advanced").find("textarea");
                textarea.val(value).change();
                $(".fd-xpath-save-button").click();

                var input = $("[name=property-calculateAttr]");
                assert.equal(input.val(), escaped, "input value not escaped");
                done();
            }, null, events);
        });
    });
});
