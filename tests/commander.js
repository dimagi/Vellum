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
        var vellum, mugTypes;
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                features: {rich_text: false},
                core: {onReady: function() {
                    vellum = this;
                    mugTypes = commander.getQuestionMap(vellum);
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
                assert.equal(result.name, "add question");
                assert.equal(result.value.__className, args.type);
            });
        });

        _.each([
            {cmd: "text", type: "Text"},
            {cmd: "text before", type: "Text"},
            {cmd: "text after", type: "Text"},
            {cmd: "text in", type: "Text"},
            {cmd: "text first in", type: "Text"},
        ], function (args) {
            it("should add a " + args.type + " question with '" + args.cmd + "' and empty tree", function () {
                var result = commander.doCommand(args.cmd, vellum);
                assert.isOk(result, "question not added");
                $("[name=property-nodeID]").val("new").change();
                vellum.ensureCurrentMugIsSaved();
                util.assertJSTreeState("new");
                assert.equal(result.name, "add question");
                assert.equal(result.value.__className, args.type);
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
                assert.equal(result.name, "select question");
                var mug = vellum.getCurrentlySelectedMug();
                assert.equal(mug.hashtagPath, path);
            });
        });

        // TODO decide if : is a good prefix for commands other than add or select
        // TODO fix selection after delete
        //  (two nodes selected in tree after delete non-adjacent to current)
        // TODO delete multiple
        //_.each([
        //    ":delete",
        //    ":delete #form/group",
        //    ":Delete #form/group/select",
        //    ":delete #form/text",
        //], function (path) {
        //    it("should delete " + path, function () {
        //        util.paste([
        //            ["id", "type", "labelItext:en-default"],
        //            ["/group", "Group", "group"],
        //            ["/group/select", "Select", "select"],
        //            ["/group/select/item", "Choice", "item"],
        //            ["/text", "Text", "text"],
        //        ]);
        //        var result = commander.doCommand(path, vellum);
        //        assert.isOk(result, "question not deleted");
        //        assert.isNotOk(vellum.data.core.form.getMugByUFID(result.ufid),
        //            "mug not deleted");
        //    });
        //});

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
            ["Date and Time ", ["...after", "...before", "...in", "...first in"]],
        ], function (args) {
            var cmd = args[0],
                items = args[1];
            it("should get completions for: " + cmd, function () {
                var expectedItems = _.map(items, function (name) {
                        if (name.startsWith("...")) {
                            return {
                                name: name.slice(3),
                                icon: undefined,
                                full: /^.+ /.exec(cmd)[0] + name.slice(3),
                            };
                        }
                        return {
                            name: name,
                            icon: mugTypes[name.toLowerCase()].icon,
                            full: name,
                        };
                    }),
                    result = commander.getCompletions(cmd, vellum);
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

        it("select after add bug", function () {
            util.paste([
                ["id", "type", "labelItext:en-default"],
                ["/text", "Text", "text"],
            ]);
            // add question with commander
            var result = commander.doCommand("Text after", vellum),
                mug = result && result.value;
            assert.equal(result && result.name, "add question");
            // set label
            $("[name=itext-en-label]").val("text2").change();
            assert.equal(mug.p.nodeID, undefined);
            // select a different question with commander
            result = commander.doCommand("#form/text", vellum);
            assert.equal(result && result.name, "select question");
            // original question should have nodeID assigned and can be selected
            assert.equal(mug.p.nodeID, "text2");
            result = commander.doCommand("#form/text2", vellum);
            assert.equal(result && result.name, "select question");
        });
    });
});
