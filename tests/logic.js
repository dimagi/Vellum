/*jshint multistr: true */
define([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/logic',
    'vellum/xpath',
    'text!tests/static/logic/test-xml-1.xml',
], function (
    chai,
    $,
    _,
    util,
    logic,
    xpath,
    TEST_XML_1
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
                features: {rich_text: false},
            });
        });

        it("should update expressions when a question ID changes", function () {
            util.loadXML(TEST_XML_1);
            util.getMug("question1").p.nodeID = 'question';
            var mug = util.getMug("/data/question2");
            assert.equal("#form/question = 1", mug.p.relevantAttr);
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

        describe("should add validation error for", function () {
            var properties = [
                    "relevantAttr",
                    "calculateAttr",
                    "constraintAttr",
                    "dataParent",
                    "repeat_count",
                    "filter",
                    "defaultValue"
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

            it("the same set of xpath references as logic module", function () {
                assert.deepEqual(logic.XPATH_REFERENCES, properties);
                assert.deepEqual(logic.NO_SELF_REFERENCES, noSelfProps);
            });

            function testReference(attr, value, bad) {
                var mug = util.getMug(mugMap[attr] || "text");
                assert(util.isTreeNodeValid(mug), util.getMessages(mug));
                assert.deepEqual(mug.messages.get(attr), []);

                mug.p[attr] = value;
                if (bad) {
                    assert(!util.isTreeNodeValid(mug), "mug should not be valid");
                    assert(mug.messages.get(attr).length,
                           attr + " should have messages");
                } else {
                    assert(util.isTreeNodeValid(mug), "mug should be valid");
                    assert(mug.messages.get(attr).length === 0,
                           attr + " should not have messages");
                }

                mug.p[attr] = "";
                assert(util.isTreeNodeValid(mug), util.getMessages(mug));
                assert.deepEqual(mug.messages.get(attr), []);
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
            translationDict = {
                "#form/text1": "/data/text1",
                "#form/text2": "/data/text2",
            },
            xpathParser = xpath.createParser(xpath.makeXPathModels(translationDict));

            function compareHashtags(expr, expected) {
                var tags = _.map(expr.getHashtags(), getHashtags);
                assert.sameMembers(tags, expected.hashtags);
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
