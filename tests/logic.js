/*jshint multistr: true */
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/logic',
    'vellum/xpath',
    'text!tests/static/logic/test-xml-1.xml',
    'text!tests/static/databrowser/mother-ref.xml',
], function (
    chai,
    $,
    _,
    util,
    logic,
    xpath,
    TEST_XML_1,
    MOTHER_REF_XML
) {
    var assert = chai.assert,
        call = util.call;

    function getPath(expr) {
        return expr.toXPath();
    }

    describe("The logic manager", function () {
        before(function (done) {
            util.init({
                core: {onReady: function () { done(); }},
                features: {rich_text: true},
            });
        });

        it("should update expressions when a question ID changes", function () {
            util.loadXML(TEST_XML_1);
            util.getMug("question1").p.nodeID = 'question';
            var mug = util.getMug("/data/question2");
            assert.equal(mug.p.relevantAttr, "#form/question = #case/dob");
        });

        it("should display error for invalid xpath expression", function () {
            util.loadXML(MOTHER_REF_XML);
            var mug = util.getMug("/data/mug");
            mug.p.calculateAttr = "#invalid/xpath dob`#case/dob`";
            assert(!util.isTreeNodeValid(mug), "mug should not be valid");
        });

        it("should not update expressions for model iteration", function () {
            util.loadXML("");
            var repeat = util.addQuestion("Repeat", "product");
            repeat.p.dataSource = {
                instance: {id: "products", src: "jr://fixture/commtrack:products"},
                idsQuery: "instance('products')/products/product/@id"
            };
            call("createXML");
            assert(util.isTreeNodeValid(repeat), "repeat should be valid");
        });

        describe("without rich text", function () {
            before(function (done) {
                util.init({
                    core: {onReady: function () { done(); }},
                    features: {rich_text: false},
                });
            });

            it("should remove references for labels after removal", function () {
                var form = util.loadXML(""),
                    logicManager = form._logicManager,
                    text;
                util.addQuestion('Text', 'mug');
                text = util.addQuestion('Text', 'text');
                $('[name=itext-en-label]').val('<output value="/data/mug" />').change();
                assert.equal(logicManager.forward[text.ufid].labelItext.length, 1);
                util.deleteQuestion('/data/text');
                assert.deepEqual(logicManager.forward[text.ufid], {});
            });
        });

        describe("should add validation error for", function () {
            var properties = [
                    "relevantAttr",
                    "calculateAttr",
                    "constraintAttr",
                    "dataParent",
                    "repeat_count",
                    "filter",
                    "defaultValue",
                    "requiredCondition"
                ],
                canSelfRef = ["constraintAttr"],
                noSelfProps = _.difference(properties, canSelfRef),
                mugMap = {
                    repeat_count: "repeat",
                    filter: "select/itemset",
                };

            before(function () {
                util.loadXML("");
                util.addQuestion("Text", "text");
                util.addQuestion("SelectDynamic", "select");
                util.addQuestion("Repeat", "repeat");
            });

            function testReference(attr, value, bad) {
                var mug = util.getMug(mugMap[attr] || "text");
                assert(util.isTreeNodeValid(mug),
                    "precondition failed:\n" + util.getMessages(mug));
                assert.deepEqual(mug.messages.get(attr), [],
                    "pre-check: mug has messages");

                mug.p[attr] = value;
                try {
                    if (bad) {
                        assert(!util.isTreeNodeValid(mug), "mug should not be valid");
                        assert(mug.messages.get(attr).length,
                               attr + " should have messages");
                    } else {
                        assert(util.isTreeNodeValid(mug), "mug should be valid");
                        assert(mug.messages.get(attr).length === 0,
                               attr + " should not have messages");
                    }
                } finally {
                    mug.p[attr] = "";
                }

                assert(util.isTreeNodeValid(mug),
                    "postcondition failed:\n" + util.getMessages(mug));
                assert.deepEqual(mug.messages.get(attr), [],
                    "post-check: mug has messages");
            }

            _.each(properties, function (attr) {
                it("invalid path in " + attr, function () {
                    testReference(attr, '/data/unknown', true);
                });
            });

            _.each(noSelfProps, function(attr) {
                it("self referencing path in " + attr, function () {
                    testReference(attr, '.', true);
                });
            });

            _.each(canSelfRef, function(attr) {
                it("self referencing path in " + attr, function () {
                    testReference(attr, '.', false);
                });
            });
        });

        describe("should not add validation error for", function() {
            var allowedReferences = [
                "meta/deviceID",
                "meta/instanceID",
                "meta/username",
                "meta/userID",
                "meta/timeStart",
                "meta/timeEnd",
                "meta/location",
            ];

            _.each(allowedReferences, function(ref) {
                it(ref, function () {
                    util.loadXML("");
                    var mug = util.addQuestion("Text", "text");
                    mug.p.calculateAttr = "/data/" + ref;
                    assert(util.isTreeNodeValid(mug), util.getMessages(mug));
                });
            });
        });

        describe("sends case references to HQ", function () {
            before(function (done) {
                util.init({core: {onReady: function () { done(); }}});
            });

            it("should be the correct format", function() {
                var form = util.loadXML(MOTHER_REF_XML),
                    manager = form._logicManager;
                assert.deepEqual(manager.caseReferences(),
                    {load: {"/data/mug": ["#case/parent/edd"]}, save: {}});
            });

            it("should not send deleted references", function () {
                var form = util.loadXML(MOTHER_REF_XML),
                    manager = form._logicManager;
                util.deleteQuestion('/data/mug');
                assert.deepEqual(manager.caseReferences(), {load: {}, save: {}});
            });

            it("should not write unknown case properties to xml", function () {
                var form = util.loadXML(""),
                    manager = form._logicManager,
                    mug = util.addQuestion('Text', 'text');
                mug.p.defaultValue = '#case/not-here';
                assert.deepEqual(manager.knownExternalReferences(), { });
            });

            it("should send parent path for choice", function () {
                var form = util.loadXML(""),
                    manager = form._logicManager;
                util.paste([
                    ["id", "type", "labelItext:en-default"],
                    ["/select", "Select", "select"],
                    ["/select/choice", "Choice", '<output value="#case/dob" />'],
                ]);
                assert.deepEqual(manager.caseReferences(),
                                 {load: {"/data/select": ["#case/dob"]}, save: {}});
            });

            it("should send all properties referenced by a question", function () {
                var form = util.loadXML(""),
                    manager = form._logicManager;
                util.paste([
                    ["id", "type", "labelItext:en-default"],
                    ["/select", "Select", '<output value="#case/name" />'],
                    ["/select/choice", "Choice", '<output value="#case/dob" />'],
                    ["/select/other", "Choice", '<output value="#user/role" />'],
                ]);
                assert.deepEqual(manager.caseReferences(),
                                 {load: {"/data/select": [
                                    "#case/name",
                                    "#case/dob",
                                    "#user/role",
                                 ]}, save: {}});
            });
        });

        describe("findUsages", function () {
            var form,
                expectedUsages = {
                    "#form/question1": {
                        "#form/question2": "Display Condition",
                        "#form/question3": "Display Condition",
                    },
                    "#form/question2": {"#form/question3": "Display Condition"}
                };
            before(function (done) {
                form = util.loadXML(TEST_XML_1);
                done();
            });

            it("should return dictionary of usages", function () {
                assert.deepEqual(form.findUsages(), expectedUsages);
            });

            it("should return dictionary of usages when filtered by path", function () {
                var q1 = "#form/question1",
                    q2 = "#form/question2";
                assert.deepEqual(form.findUsages(q1),
                    {"#form/question1": expectedUsages[q1]}
                );
                assert.deepEqual(form.findUsages(q2),
                    {"#form/question2": expectedUsages[q2]}
                );
            });

            it("should return empty dictionary when question not referenced", function () {
                assert.deepEqual(form.findUsages("#form/question3"), {});
            });

            it("should not error after deleting reference", function () {
                var mug = util.addQuestion("Text", "mug"),
                    q3 = util.getMug("question3");
                q3.p.relevantAttr = "#form/mug";
                form.removeMugsFromForm([mug]);
                q3.p.relevantAttr = "";
                assert.deepEqual(form.findUsages("#form/question3"), {});
            });
        });

        describe("hasBrokenReferences", function () {
            var form;
            beforeEach(function () {
                form = util.loadXML();
            });

            it("should return false for empty form", function () {
                assert.isNotOk(form.hasBrokenReferences());
            });

            it("should return true for form with broken reference", function () {
                util.addQuestion("Text", "text", {relevantAttr: "/data/unknown"});
                assert.isOk(form.hasBrokenReferences());
            });

            it("should return false after broken reference is fixed", function () {
                util.addQuestion("Text", "text", {relevantAttr: "/data/other"});
                assert.isOk(form.hasBrokenReferences(), "should have broken");
                util.addQuestion("Text", "other", {relevantAttr: "/data/other"});
                assert.isNotOk(form.hasBrokenReferences());
            });
        });
    });

    describe("Logic expression", function() {
        var expressions = [
            [
                "instance('casedb')/cases/case/property",
                ["instance('casedb')/cases/case/property"],
                ["instance('casedb')/cases/case/property"],
            ],
            [
                "instance('casedb')/cases/case/property[@case_id = /data/caseid]",
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]", "@case_id", "/data/caseid"],
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]"],
            ],
            [
                "instance('casedb')/cases/case/property[@case_id = /data/caseid] = /data/other_caseid",
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]", "@case_id", "/data/caseid", "/data/other_caseid"],
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]", "/data/other_caseid"],
            ],
            [
                "instance('casedb')/cases/case[@case_id = instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/index/parent]/edd = /data/other_caseid",
                [
                    "instance('casedb')/cases/case[@case_id = instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/index/parent]/edd",
                    "@case_id",
                    "instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/index/parent",
                    "instance('commcaresession')/session/data/case_id",
                    "/data/other_caseid"
                ],
                ["instance('casedb')/cases/case[@case_id = instance('casedb')/cases/case[@case_id = instance('commcaresession')/session/data/case_id]/index/parent]/edd", "/data/other_caseid"],
            ],
            [
                "selected(instance('casedb')/cases/case/property[@case_id = /data/caseid])",
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]", "@case_id", "/data/caseid"],
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]"],
            ],
            [
                "(instance('casedb')/cases/case/property[@case_id = /data/caseid] = /data/other_caseid) and (/other/thing = /this/thing)",
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]", "@case_id", "/data/caseid", "/data/other_caseid", "/other/thing", "/this/thing"],
                ["instance('casedb')/cases/case/property[@case_id = /data/caseid]", "/data/other_caseid", "/other/thing", "/this/thing"],
            ],
            [
                "/data/text1 = /data/text2",
                ["/data/text1", "/data/text2"],
                ["/data/text1", "/data/text2"],
            ],
        ];

        _.each(expressions, function(expr) {
            var logicExpr = new logic.LogicExpression(expr[0], xpath.createParser(xpath.makeXPathModels()));

            it("should return all paths: " + expr[0], function() {
                var paths = _.map(logicExpr.getPaths(), getPath);
                assert.deepEqual(_.difference(paths, expr[1]), []);
                assert.deepEqual(_.difference(expr[1], paths), []);
            });

            it("should return top level paths: " + expr[0], function() {
                var paths = _.map(logicExpr.getTopLevelPaths(), getPath);
                assert.deepEqual(_.difference(paths, expr[2]), []);
                assert.deepEqual(_.difference(expr[2], paths), []);
            });
        });

        describe("hashtags", function() {
            function getHashtags(expr) {
                return expr.toHashtag();
            }

            var hashtags = [
                {
                    path: "#form/text1 = #form/text2",
                    hashtags: ["#form/text1", "#form/text2"],
                    xpath: "/data/text1 = /data/text2",
                },
                {
                    path: "/data/not/in/form[#form/text1] = #form/text2",
                    hashtags: ["#form/text1", "#form/text2"],
                    xpath: "/data/not/in/form[/data/text1] = /data/text2",
                },
                {
                    path: "/data/not/in/form[#form/text1 = /data/also/not/in/form[#form/text2]] = #form/text2",
                    hashtags: ["#form/text1", "#form/text2"],
                    xpath: "/data/not/in/form[/data/text1 = /data/also/not/in/form[/data/text2]] = /data/text2",
                },
            ],
            incorrectHashtags = [
                {
                    path: "#wtf/mate",
                    hashtags: [],
                },
                {
                    path: "#wtf/mate[filter=filter]",
                    hashtags: [],
                },
            ],
            hashtagMap = {
                "#form/text1": "/data/text1",
                "#form/text2": "/data/text2",
            },
            hashtagInfo = {
                hashtagMap: hashtagMap,
                invertedHashtagMap: _.invert(hashtagMap),
                hashtagNamespaces: {form: true},
            },
            xpathParser = xpath.createParser(xpath.makeXPathModels(hashtagInfo));

            function compareHashtags(expr, expected) {
                var tags = _.map(expr.getHashtags(), getHashtags);
                assert.includeMembers(tags, expected.hashtags);
            }

            _.each(hashtags, function(hashtag) {
                var logicExpr = new logic.LogicExpression(hashtag.path, xpathParser);

                it("should return all hashtags: " + hashtag.path, function() {
                    compareHashtags(logicExpr, hashtag);
                });

                it("should translate " + hashtag.path + " to " + hashtag.xpath, function() {
                    assert.strictEqual(logicExpr.parsed.toXPath(), hashtag.xpath);
                });
            });

            _.each(incorrectHashtags, function (hashtag) {
                var logicExpr = new logic.LogicExpression(hashtag.path, xpathParser);

                it("should return all hashtags: " + hashtag.path, function() {
                    compareHashtags(logicExpr, hashtag);
                });

                it("should not be able to translate " + hashtag.path, function() {
                    // filtered hashtags will add an error and not parse
                    if (!logicExpr.error) {
                        assert.throws(logicExpr.parsed.toXPath, /translate the hashtag/);
                    }
                });
            });
        });
    });
});
