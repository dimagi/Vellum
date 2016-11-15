define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/form',
    'vellum/tree',
    'text!static/form/alternate-root-node-name.xml',
    'text!static/form/question-referencing-other.xml',
    'text!static/form/group-with-internal-refs.xml',
    'text!static/form/hidden-value-in-group.xml',
    'text!static/form/name-template.xml',
    'text!static/form/nested-groups.xml',
    'text!static/form/select-questions.xml',
    'text!static/form/mismatch-tree-order.xml',
    'text!static/form/hidden-value-tree-order.xml',
    'text!static/form/instance-reference.xml',
    'text!static/form/manual-instance-reference.xml'
], function (
    util,
    chai,
    $,
    _,
    form_,
    Tree,
    ALTERNATE_ROOT_NODE_NAME_XML,
    QUESTION_REFERENCING_OTHER_XML,
    GROUP_WITH_INTERNAL_REFS_XML,
    HIDDEN_VALUE_IN_GROUP_XML,
    NAME_TEMPLATE,
    NESTED_GROUPS_XML,
    SELECT_QUESTIONS,
    MISMATCH_TREE_ORDER_XML,
    HIDDEN_VALUE_TREE_ORDER,
    INSTANCE_REFERENCE_XML,
    MANUAL_INSTANCE_REFERENCE_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The form component", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
            });
        });

        it("should get and fix serialization errors for mugs with matching paths", function () {
            var form = util.loadXML(""),
                one = util.addQuestion("Text", "question"),
                two = util.addQuestion("Text", "question");
            assert.notEqual(one.absolutePath, two.absolutePath);
            var errors = form.getSerializationWarnings();
            assert.equal(errors.length, 1, "missing serialization error message");
            assert.equal(errors[0].mug.ufid, two.ufid);

            form.fixSerializationWarnings(errors);
            assert.equal(one.p.nodeID, "question");
            assert.notEqual(one.absolutePath, two.absolutePath);
            errors = form.getSerializationWarnings();
            assert.deepEqual(errors, [], JSON.stringify(errors));
        });

        it("should retain expression meaning on rename matching path", function () {
            var blue = util.addQuestion("Text", "blue"),
                green = util.addQuestion("Text", "green"),
                black = util.addQuestion("DataBindOnly", "black");
            black.p.calculateAttr = "#form/blue + #form/green";
            green.p.nodeID = "blue";
            assert.notEqual(green.p.nodeID, "blue");
            assert(!util.isTreeNodeValid(green), "expected validation error");

            blue.p.nodeID = "orange";
            assert.equal(green.p.nodeID, "blue");
            assert.equal(black.p.calculateAttr, "#form/orange + #form/blue");
            assert(util.isTreeNodeValid(blue), blue.getErrors().join("\n"));
            assert(util.isTreeNodeValid(green), green.getErrors().join("\n"));
            assert(util.isTreeNodeValid(black), black.getErrors().join("\n"));
        });

        it("should retain conflicted mug ID on move", function () {
            var form = util.loadXML(""),
                hid = util.addQuestion("DataBindOnly", "hid"),
                text = util.addQuestion("Text", "text"),
                group = util.addQuestion("Group", "group");
            util.addQuestion("Text", "text");
            hid.p.calculateAttr = "#form/text + #form/group/text";
            form.moveMug(text, "into", group);
            assert.notEqual(hid.p.calculateAttr, "#form/text + #form/group/text");
            assert.notEqual(text.p.nodeID, "text");
            assert(!util.isTreeNodeValid(text), "expected #form/text error");

            form.moveMug(text, "into", null);
            assert.equal(text.p.nodeID, "text");
            assert.equal(hid.p.calculateAttr, "#form/text + #form/group/text");
            assert(util.isTreeNodeValid(text), text.getErrors().join("\n"));
        });

        describe("The form's ID generation", function() {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    core: {onReady: done},
                    features: {rich_text: false},
                });
            });

            it("should generate ID based on label", function () {
                util.loadXML("");
                var name = util.addQuestion("Text");
                $("[name='itext-en-label']").val('What is your name?').change();
                var question1 = util.addQuestion("Text"),
                    copy = util.addQuestion("Text");
                $("[name='itext-en-label']").val('What is your name?').change();
                var blank = util.addQuestion("Text");
                assert.equal(name.p.nodeID, 'what_is_your_name');
                assert.equal(question1.p.nodeID, 'question1');
                assert.equal(copy.p.nodeID, 'copy-1-of-what_is_your_name');
                assert.equal(blank.p.nodeID, undefined);
            });
        });

        it("should show warnings for broken references on delete mug", function () {
            util.loadXML(QUESTION_REFERENCING_OTHER_XML);
            var blue = call("getMugByPath", "/data/blue"),
                green = call("getMugByPath", "/data/green"),
                black = call("getMugByPath", "/data/black");
            assert(util.isTreeNodeValid(green), "sanity check failed: green is invalid");
            assert(util.isTreeNodeValid(black), "sanity check failed: black is invalid");
            util.clickQuestion("blue");
            blue.form.removeMugsFromForm([blue]);
            assert(util.isTreeNodeValid(green), "green should be valid");
            assert(!util.isTreeNodeValid(black), "black should not be valid");
        });

        it("should remove warnings when broken reference is fixed", function () {
            util.loadXML(QUESTION_REFERENCING_OTHER_XML);
            var blue = call("getMugByPath", "/data/blue"),
                black = call("getMugByPath", "/data/black");
            blue.form.removeMugsFromForm([blue]);
            assert(!util.isTreeNodeValid(black), "black should not be valid");
            blue = util.addQuestion("Text", "blue");
            assert(util.isTreeNodeValid(black), util.getMessages(black));
        });

        it("should show duplicate question ID warning inline", function () {
            util.loadXML("");
            util.addQuestion("Text", "text");
            var text = util.addQuestion("Text", "text"),
                messages = text.messages.get("nodeID");
            assert.equal(messages.length, 1, messages.join("\n"));
            // UI dependent, possibly fragile
            var div = $("[name=property-nodeID]").closest(".widget"),
                msg = div.find(".messages").children();
            assert.equal(msg.length, messages.length, msg.text());
            assert.equal(msg[0].text, messages[0].message);
        });

        it("should warn about top-level question named 'case'", function () {
            util.loadXML("");
            var mug = util.addQuestion("Text", "case");
            assert(mug.messages.get("nodeID", "mug-nodeID-case-warning"),
                "mug-nodeID-case-warning was expected but not present");
            mug.p.nodeID = "the-case";
            assert.equal(util.getMessages(mug), "");
        });

        it("should warn about question named 'Case' in group", function () {
            util.loadXML("");
            util.addQuestion("Group", "group");
            var mug = util.addQuestion("Text", "Case");
            assert(mug.messages.get("nodeID", "mug-nodeID-case-warning"),
                "mug-nodeID-case-warning was expected but not present");
            mug.p.nodeID = "the-case";
            assert.equal(util.getMessages(mug), "");
        });

        it("should preserve internal references in copied group", function () {
            util.loadXML(GROUP_WITH_INTERNAL_REFS_XML);
            var form = call("getData").core.form,
                group = util.getMug("group");
            form.duplicateMug(group);
            var green2 = util.getMug("copy-1-of-group/green");
            assert.equal(green2.p.relevantAttr,
                "#form/copy-1-of-group/blue = 'red' and #form/red = 'blue'");
        });

        it("should set non-standard form root node", function () {
            util.loadXML(ALTERNATE_ROOT_NODE_NAME_XML);
            var form = call("getData").core.form,
                blue = call("getMugByPath", "/other/blue");
            assert.equal(form.getBasePath(), "/other/");
            assert(blue !== null, "mug not found: /other/blue");
            assert.equal(form.hashtagMap['#form'], '/other');
        });

        it("should be able to move item from Select to MSelect", function () {
            util.loadXML(SELECT_QUESTIONS);
            var form = call("getData").core.form,
                item1 = util.getMug("question1/item1"),
                item2 = util.getMug("question2/item2");
            // should not throw an error
            form.moveMug(item1, 'before', item2);
        });

        it("should update reference to hidden value in group", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var group = call("getMugByPath", "/data/group"),
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("#form/group/hidden");
            group.p.nodeID = "x";
            assert.equal(group.absolutePath, "/data/x");
            assert.equal(label.absolutePath, "/data/x/label");
            assert.equal(hidden.absolutePath, "/data/x/hidden");
            chai.expect(label.p.relevantAttr).to.include("#form/x/hidden");
        });

        it("should update reference to moved hidden value in output tag", function () {
            util.loadXML(HIDDEN_VALUE_IN_GROUP_XML);
            var form = call("getData").core.form,
                label = call("getMugByPath", "/data/group/label"),
                hidden = call("getMugByPath", "/data/group/hidden");

            chai.expect(label.p.relevantAttr).to.include("#form/group/hidden");
            chai.expect(label.p.labelItext.defaultValue()).to.include("#form/group/hidden");
            form.moveMug(hidden, "first", null);
            assert.equal(hidden.absolutePath, "/data/hidden");
            chai.expect(label.p.relevantAttr).to.include("#form/hidden");
            chai.expect(label.p.labelItext.defaultValue()).to.include("#form/hidden");
        });

        it("should update repeat group reference", function () {
            util.loadXML("");
            var text = util.addQuestion("Text", 'text'),
                repeat = util.addQuestion("Repeat", 'repeat');
            repeat.p.repeat_count = '#form/text';
            assert.equal(repeat.p.repeat_count, '#form/text');
            text.p.nodeID = 'text2';
            assert.equal(repeat.p.repeat_count, '#form/text2');
        });

        it ("should show warnings for duplicate choice value", function() {
            util.loadXML("");
            var select = util.addQuestion("Select", 'select'),
                item1 = select.form.getChildren(select)[0],
                item2 = select.form.getChildren(select)[1];
            assert(util.isTreeNodeValid(item1), item1.getErrors().join("\n"));
            assert(util.isTreeNodeValid(item2), item2.getErrors().join("\n"));
            item2.p.nodeID = "choice1";
            assert(util.isTreeNodeValid(item1), "choice1 should be valid");
            assert(!util.isTreeNodeValid(item2), "choice2 should be invalid");
        });

        it("should preserve order of the control tree", function() {
            util.loadXML(MISMATCH_TREE_ORDER_XML);
            util.assertJSTreeState(
                "question1",
                "question4",
                "question2",
                "  question3",
                "question5",
                "question6"
            );
        });

        it("should merge data-only-nodes with control nodes", function() {
            util.loadXML(HIDDEN_VALUE_TREE_ORDER);
            util.assertJSTreeState(
                "question1",
                "question5",
                "question2",
                "  question3",
                "question6",
                "question4"
            );
        });

        it("should delete nested groups", function() {
            var form = util.loadXML(NESTED_GROUPS_XML),
                mugs = util.clickQuestion("group1", "group1/group2");
            form.removeMugsFromForm(mugs);
            util.assertJSTreeState("");
        });

        it("should delete nested groups v2", function() {
            var form = util.loadXML(NESTED_GROUPS_XML),
                mugs = util.clickQuestion("group1", "group1/group2/group3");
            form.removeMugsFromForm(mugs);
            util.assertJSTreeState("");
        });

        function assertInstanceSrc(id, form, expect, message) {
            var xml = _.isString(form) ? form : form.createXML(),
                $xml = $(xml),
                result = $xml.find("model > instance[id='" + id + "']").attr("src");
            assert.equal(result, expect, message ? message + "\n" + xml : "");
        }

        it("should not drop referenced instance on delete dynamic select", function() {
            var form = util.loadXML("");
            util.paste([
                ["id", "type", "labelItext:en-default", "calculateAttr", "itemsetData"],
                ["/hidden", "DataBindOnly", "null",
                 "instance('some-fixture')/some-fixture_list/some-fixture/@id", "null"],
                ["/select", "SelectDynamic", "select", "null",
                    '[{"instance":{"id":"some-fixture",' +
                                  '"src":"jr://fixture/item-list:some-fixture"},' +
                    '"nodeset":"instance(\'some-fixture\')/some-fixture_list/some-fixture",' +
                    '"labelRef":"name","valueRef":"@id"}]']
            ]);
            util.deleteQuestion("select");
            assertInstanceSrc("some-fixture", form,
                "jr://fixture/item-list:some-fixture",
                "some-fixture instance not found");
        });

        it("should drop instance on delete last reference", function() {
            var form = util.loadXML("");
            util.paste([
                ["id", "type", "calculateAttr", "instances"],
                ["/hidden", "DataBindOnly",
                 "instance('some-fixture')/some-fixture_list/some-fixture/@id",
                 '{"some-fixture":"jr://fixture/item-list:some-fixture"}'],
            ]);
            assertInstanceSrc("some-fixture", form,
                "jr://fixture/item-list:some-fixture");
            util.deleteQuestion("hidden");
            assertInstanceSrc("some-fixture", form, undefined,
                "some-fixture instance not found");
        });

        it("should maintain instance on delete and re-add last reference", function() {
            var form = util.loadXML("");
            util.paste([
                ["id", "type", "calculateAttr", "instances"],
                ["/hidden", "DataBindOnly",
                 "instance('some-fixture')/some-fixture_list/some-fixture/@id",
                 '{"some-fixture":"jr://fixture/item-list:some-fixture"}'],
            ]);
            util.deleteQuestion("hidden");
            assertInstanceSrc("some-fixture", form, undefined);
            var hid = util.addQuestion("DataBindOnly", "hid");
            hid.p.calculateAttr = "instance('some-fixture')/some-fixture_list/some-fixture/@id";
            assertInstanceSrc("some-fixture", form,
                "jr://fixture/item-list:some-fixture",
                "some-fixture instance not found");
        });

        it("should not delete instance from itemsets with nested filters", function() {
            var form = util.loadXML(INSTANCE_REFERENCE_XML);
            assertInstanceSrc("groups", form,
                "jr://fixture/user-groups",
                "groups instance not found");
        });

        it("should not delete manual instances when it's reference is updated", function() {
            util.loadXML(MANUAL_INSTANCE_REFERENCE_XML);
            util.clickQuestion('output');
            $('[name=property-calculateAttr]').change();
            util.assertXmlEqual(call('createXML'), MANUAL_INSTANCE_REFERENCE_XML);
        });

        it ("should warn on delete question", function() {
            util.loadXML("");
            util.paste([
                ["id", "type", "labelItext:en-default"],
                ["/q1", "Text", '<output value="#form/q2" /> <output value="#form/q3" />'],
                ["/q2", "DataBindOnly", "null"],
                ["/q3", "DataBindOnly", "null"],
            ]);
            var q1 = util.getMug("q1");
            assert(util.isTreeNodeValid(q1), q1.getErrors().join("\n"));
            util.deleteQuestion("q2");
            assert(!util.isTreeNodeValid(q1), "q1 should not be valid");
        });

        describe("with rich text disabled", function() {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    core: {onReady: done},
                    features: {rich_text: false},
                });
            });

            it("should update case hashtags on enabling rich text", function () {
                var form = util.loadXML("");
                util.addQuestion("Text", "text");
                assert(form.isValidHashtag("#form/text"), "not valid: #form/text");
                form.setAttr("richText", true);
                assert(form.isValidHashtag("#case/dob"), "not valid: #case/dob");
                assert(form.isValidHashtag("#form/text"), "not valid: #form/text");
            });
        });

        describe("naming logic", function () {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    core: {
                        formName: null,
                        onReady: done,
                    },
                });
            });

            it('should use default name for empty form', function() {
                var form = util.loadXML(""),
                    xml = $(call('createXML'));
                assert.equal(form.formName, "New Form");
                assert.equal(xml.find("h\\:title").text(), "New Form", "title");
                assert.equal(xml.find("data").attr("name"), "New Form", "data");
            });

            it('should use default name when no other name is specified', function() {
                var form = util.loadXML(
                        _.template(NAME_TEMPLATE)({title: '', dataName: ''}),
                        null,
                        /^Form does not have a Name!/
                    ),
                    xml = $(call('createXML'));
                assert.equal(form.formName, "New Form");
                assert.equal(xml.find("h\\:title").text(), "New Form", "title");
                assert.equal(xml.find("data").attr("name"), "New Form", "data");
            });

            it('should prefer <data name="..."> over <title>', function() {
                var form = util.loadXML(_.template(NAME_TEMPLATE)({
                        title: '<h:title>Title</h:title>',
                        dataName: 'name="Data Name"',
                    })),
                    xml = $(call('createXML'));
                assert.equal(form.formName, "Data Name");
                assert.equal(xml.find("h\\:title").text(), "Data Name", "title");
                assert.equal(xml.find("data").attr("name"), "Data Name", "data");
            });

            it('should use <title> if <data name="..."> is absent', function() {
                var form = util.loadXML(_.template(NAME_TEMPLATE)({
                        title: '<h:title>Title</h:title>',
                        dataName: '',
                    })),
                    xml = $(call('createXML'));
                assert.equal(form.formName, "Title");
                assert.equal(xml.find("h\\:title").text(), "Title", "title");
                assert.equal(xml.find("data").attr("name"), "Title", "data");
            });

            describe("with core.formName option", function () {
                before(function (done) {
                    util.init({
                        javaRosa: {langs: ['en']},
                        core: {
                            formName: "Optional Name",
                            onReady: done,
                        },
                    });
                });

                it('should override all other names', function() {
                    var form = util.loadXML(_.template(NAME_TEMPLATE)({
                            title: '<h:title>Title</h:title>',
                            dataName: 'name="Data Name"',
                        })),
                        xml = $(call('createXML'));
                    assert.equal(form.formName, "Optional Name");
                    assert.equal(xml.find("h\\:title").text(), "Optional Name", "title");
                    assert.equal(xml.find("data").attr("name"), "Optional Name", "data");
                });
            });
        });

        describe("instance tracker", function () {
            var form, mug, prop = "calculateAttr";
            before(function () {
                form = util.loadXML("");
                mug = util.addQuestion("DataBindOnly", "hid");
                prop = "calculateAttr";
                form.addInstanceIfNotExists(
                        {id: "old", src: "old://"}, mug, "relevantAttr");
                form.addInstanceIfNotExists({id: "blank"}, mug, "relevantAttr");
                form.updateKnownInstances({"known": "known://"});
            });

            _.each([
                // [attrs, expectId, expectSrc]
                [{id: "new0", src: null}, "new0", undefined],
                [{id: "new1", src: "new://1"}, "new1", "src"],
                [{id: "new2", src: "old://"}, "old", "src"],
                [{id: "old", src: null}, "old", "old://"],
                [{id: "old", src: "new://3"}, "old-1", "src"],
                [{id: "old", src: "old://"}, "old", "src"],
                [{id: "any", src: "old://"}, "old", "src"],
                [{id: "known", src: undefined}, "known", "known://"],
                [{id: "blank", src: "blank://"}, "blank", "src"],
                [{id: null, src: "new://5"}, "data-1", "src"],
                //[{id: null, src: null}, "data-1", "src"],     Error!
            ], function (item) {
                var attrs = item[0],
                    expectId = item[1],
                    expectSrc = item[2] === "src" ? attrs.src : item[2];
                it("should add instance " + JSON.stringify(attrs) + " -> " +
                        expectId + ": " + expectSrc, function () {
                    assertInstanceSrc(expectId, form,
                        expectId === "old" ? expectSrc : undefined);
                    var result = form.addInstanceIfNotExists(attrs, mug, prop);
                    if (_.isRegExp(expectId)) {
                        chai.expect(result).to.match(expectId);
                    } else {
                        assert.equal(result, expectId);
                    }
                    assertInstanceSrc(expectId, form, expectSrc,
                        expectId + " instance not found");
                    form.dropAllInstanceReferences(mug, prop);
                    if (expectId === "old" || expectId === "blank") {
                        assertInstanceSrc(expectId, form, expectSrc,
                            expectId + " instance should be removed");
                    } else {
                        assertInstanceSrc(expectId, form, undefined,
                            expectId + " instance should be removed");
                    }
                });
            });

        });
    });
});
