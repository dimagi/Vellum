import chai from "chai";
import $ from "jquery";
import _ from "underscore";
import util from "tests/utils";
import expressionEditor from "vellum/expressionEditor";
import mugs from "vellum/mugs";
import richText from "vellum/richText";
import vellumUtil from "vellum/util";

var assert = chai.assert,
    real_showXPathEditor = expressionEditor.showXPathEditor,
    events = {};

vellumUtil.eventuality(events);

// setup event so we can hook into xpath editor show
expressionEditor.showXPathEditor = function () {
    real_showXPathEditor.apply(null, arguments);
    events.fire("showXPathEditor");
};

describe("The widgets module with rich text disabled", function () {
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

    it("xPath widget should allow drag/drop", function () {
        var spec = mugs.baseSpecs.databind;
        util.loadXML("");
        util.addQuestion("Text", "text");
        util.clickQuestion("text");
        assert.equal(spec.defaultValue.xpathType, "generic");
        assert($("[name=property-defaultValue]").hasClass("jstree-drop"),
            "defaultValue does not have jstree-drop class");
        assert.equal(spec.relevantAttr.xpathType, "bool");
        assert($("[name=property-relevantAttr]").hasClass("jstree-drop"),
            "relevantAttr does not have jstree-drop class");
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
            escaped = '#form/text',
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

    it("xPath widget should genuinely hide editor whenever it's exited", function (done) {
        util.loadXML("");
        util.addQuestion("Text", "text1");
        util.addQuestion("Text", "text2");

        var $right = $(".fd-content-right"),
            $props = $right.find(".fd-question-properties"),
            $editor = $right.find(".fd-xpath-editor");
        $props.find(".fd-edit-button:first").click();

        events.on("showXPathEditor", function () {
            assert($editor.is(":visible"), "Editor shown when clicked");
            assert(!$props.is(":visible"), "Properties hidden when entering editor");

            util.clickQuestion("/data/text1");
            assert($props.is(":visible"), "Properties shown as requested");
            assert(!$editor.is(":visible"), "Editor hidden when properties shown");
            done();
        }, null, "showXPathEditor");
    });

    it("xPath widget should change save button when dropdown is changed", function (done) {
        util.loadXML("");
        util.addQuestion("Text", "text");
        util.clickQuestion("text");

        var $right = $(".fd-content-right"),
            $props = $right.find(".fd-question-properties");
        $props.find(".fd-edit-button:first").click();

        events.on("showXPathEditor", function () {
            assert(!$('.fd-xpath-save-button').hasClass('btn-success'));
            $('.op-select').change();
            assert($('.fd-xpath-save-button').hasClass('btn-success'));
            done();
        }, null, "showXPathEditor");
    });
});

describe("The rich text widget", function () {
    before(function (done) {
        util.init({
            javaRosa: {langs: ['en']},
            core: {onReady: function () { done(); }},
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
                    util.assertEqual(val, row[2]);
                    done();
                });
            });
        });
    });

    it("should return just-set value on get value", function () {
        util.loadXML("");
        util.addQuestion("Text", "text");
        util.clickQuestion('text');
        var widget = util.getWidget('itext-en-label'),
            text = '<output value="#form/text" />';
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
            assert.equal(text.p.relevantAttr, '#form/hidden');
            done();
        });
    });

    it("should change save button on drag/drop into advanced xpath editor", function (done) {
        util.loadXML("");
        util.paste([
            ["id", "type", "labelItext:en-default"],
            ["/hidden", "DataBindOnly", "null"],
            ["/text", "Text", "test"],
        ]);
        util.clickQuestion("text");

        $(".fd-content-right .fd-question-properties [name=property-defaultValue]")
            .closest(".form-group")
            .find(".fd-edit-button").click();

        events.on("showXPathEditor", function () {
            var input = $('.fd-xpath-editor-text'),
                editor = richText.editor(input),
                tree = $(".fd-question-tree").jstree(true),
                saveButton = $('.fd-xpath-save-button');
            assert(!saveButton.hasClass('btn-success'), "save button should not be green");
            editor.on("change", function () {
                assert(saveButton.hasClass('btn-success'), "save button not green");
                done();
            });
                util.findNode(tree, "hidden").data.handleDrop(input);
        }, null, "showXPathEditor");
    });

    it("simple xpath editor should change save button on remove expression", function (done) {
        util.loadXML("");
        util.paste([
            ["id", "type", "labelItext:en-default"],
            ["/hidden", "DataBindOnly", "null"],
        ]);

        $(".fd-content-right .fd-question-properties [name=property-relevantAttr]")
            .closest(".form-group")
            .find(".fd-edit-button").click();

        events.on("showXPathEditor", function () {
            var saveButton = $('.fd-xpath-save-button');
            assert.equal(saveButton.length, 1, 'save button');
            assert(!saveButton.hasClass("btn-success"),
                "save button should not be active");

            var addButton = $('.fd-add-exp');
            assert.equal(addButton.length, 1, 'add button');
            assert.equal($('.xpath-expression-group').length, 1, 'before add');
            addButton.click();
            assert.equal($('.xpath-expression-group').length, 2, 'after add row');
            assert(!saveButton.hasClass("btn-success"),
                "should not activate save button on add expression");

            var removeButton = $('.xpath-delete-expression').last();
            assert.equal(removeButton.length, 1, 'remove button');
            removeButton.click();
            assert.equal($('.xpath-expression-group').length, 1, 'after remove row');
            assert(saveButton.hasClass("btn-success"),
                "did not activate save button after remove expression");
            done();
        }, null, "showXPathEditor");
    });
});
