define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/commander',
], function (
    util,
    chai,
    $,
    _,
    commander
) {
    var assert = chai.assert;

    describe("The commander plugin", function() {
        var vellum;
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: function() {
                    vellum = this;
                    done();
                }},
            });
        });

        beforeEach(function () { util.loadXML(); });

        _.each([
            {cmd: "text", type: "Text"},
            {cmd: "text before", type: "Text", index: 3},
            {cmd: "text after", type: "Text", index: 3, select: "group"},
            {cmd: "text before #form/group", type: "Text", index: 0},
            {cmd: "Text after #form/group", type: "Text", index: 3},
            {cmd: "Text in #form/group", type: "Text", index: 3, indent: "  "},
            {cmd: "Text before #form/group/select", type: "Text", index: 1, indent: "  "},
            {cmd: "Text after #form/group/select", type: "Text", index: 3, indent: "  "},
            //{cmd: "choice before #form/group/select/item", type: "Choice", index: 2, indent: "    "},
            //{cmd: "Choice after #form/group/select/item", type: "Choice", index: 3, indent: "    "},
            {cmd: "choice", type: "Choice", index: 3, indent: "    ", select: "group/select"},
            {cmd: "Choice in #form/group/select", type: "Choice", index: 3, indent: "    "},
            {cmd: "Choice first in #form/group/select", type: "Choice", index: 2, indent: "    "},
        ], function (args) {
            it("should add a " + args.type + " question with '" + args.cmd + "'", function () {
                util.paste([
                    ["id", "type", "labelItext:en-default"],
                    ["/group", "Group", "group"],
                    ["/group/select", "Select", "select"],
                    ["/group/select/item", "Choice", "item"],
                    ["/text", "Text", "text"],
                ]);
                if (args.select) {
                    util.clickQuestion(args.select);
                }
                var result = commander.doCommand(args.cmd, vellum);
                assert.isOk(result, "question not added");
                $("[name=property-nodeID]").val("new").change();
                vellum.ensureCurrentMugIsSaved();
                var items = [
                    "group",
                    "  select",
                    "    item",
                    "text",
                ];
                if (args.hasOwnProperty("index")) {
                    items.splice(args.index, 0, (args.indent || "") + "new");
                } else {
                    items.push("new");
                }
                util.assertJSTreeState.apply(null, items);
                assert.equal(result.__className, args.type);
            });
        });

        _.each([
            "#form/group",
            "#form/group/select",
            "#form/text",
        ], function (path) {
            it("should select " + path, function () {
                util.paste([
                    ["id", "type", "labelItext:en-default"],
                    ["/group", "Group", "group"],
                    ["/group/select", "Select", "select"],
                    ["/group/select/item", "Choice", "item"],
                    ["/text", "Text", "text"],
                ]);
                var result = commander.doCommand(path, vellum);
                assert.isOk(result, "question not selected");
                var mug = vellum.getCurrentlySelectedMug();
                assert.equal(mug.hashtagPath, path);
            });
        });

        _.each([
            "choice",
            "choice in #form/group",
        ], function (cmd) {
            it("should not execute bad command: " + cmd, function () {
                var result = commander.doCommand(cmd, vellum);
                assert.isUndefined(result, "unexpected result: " + result);
            });
        });

        _.each([
            ["txt", []],
            ["cho", ["Multiple Choice", "Multiple Choice Lookup Table", "Choice"]],
            ["choice ", ["...after", "...before", "...in", "...first in",
                "Multiple Choice Lookup Table"]],
            ["choice i", ["...in", "...first in"]],
        ], function (args) {
            var cmd = args[0],
                expectedItems = _.map(args[1], function (name) {
                    if (name.startsWith("...")) {
                        return {
                            name: name.slice(3),
                            full: /^.+ /.exec(cmd)[0] + name.slice(3),
                        };
                    }
                    return {name: name, full: name};
                });
            it("should get completions for: " + cmd, function () {
                var result = commander.getCompletions(cmd, vellum);
                assert.deepEqual(result, expectedItems);
            });
        });

        _.each([
            ["txt", undefined],
            ["Choice ", ["Choice", undefined, undefined]],
            ["Choice in ", ["Choice", "in", undefined]],
            ["choice in /data/blue", ["choice", "in", "/data/blue"]],
            ["text first in #form/group", ["text", "first in", "#form/group"]],
            ["#form/blue", ["#form/blue"]],
        ], function (args) {
            var cmd = args[0],
                expected = args[1];
            it("should tokenize: " + cmd, function () {
                var result = commander.tokenize(cmd, vellum);
                assert.deepEqual(result && result.tokens, expected);
            });
        });

        _.each(["text", "choice"], function (name) {
            it("should have '" + name + "' in it's question map", function () {
                assert.hasAnyKeys(commander.getQuestionMap(vellum), [name]);
            });
        });

        it("should not have 'itemset' in it's question map", function () {
            assert.doesNotHaveAnyKeys(commander.getQuestionMap(vellum), ["itemset"]);
        });
    });
});
