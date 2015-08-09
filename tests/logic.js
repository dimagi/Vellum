/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/logic'
], function (
    chai,
    $,
    _,
    util,
    logic
) {
    var assert = chai.assert,
        call = util.call;

    function getPath(expr) {
        return expr.toXPath();
    }

    describe("The logic manager", function () {
        before(function (done) {
            util.init({core: {onReady: function () { done(); }}});
        });

        it("should update expressions when a question ID changes", function () {
            util.loadXML(TEST_XML_1);
            util.getMug("question1").p.nodeID = 'question';
            var mug = util.getMug("/data/question2");
            assert.equal("/data/question = 1", mug.p.relevantAttr);
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
            var logicExpr = new logic.LogicExpression(expr[0]);

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
    });

    var TEST_XML_1 = '' + 
    '<?xml version="1.0" encoding="UTF-8" ?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml"\
            xmlns:orx="http://openrosa.org/jr/xforms"\
            xmlns="http://www.w3.org/2002/xforms"\
            xmlns:xsd="http://www.w3.org/2001/XMLSchema"\
            xmlns:jr="http://openrosa.org/javarosa"\
            xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms"\
                          xmlns="http://openrosa.org/formdesigner/BDBF500D-13AD-40F0-90B5-EE65A56F92E5"\
                          uiVersion="1"\
                          version="1"\
                          name="Untitled Form">\
                        <question1 />\
                        <question2 />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question2" type="xsd:string" relevant="/data/question1 = 1" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                        <text id="question2-label">\
                            <value>question2</value>\
                        </text>\
                    </translation>\
                    <translation lang="hin">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                        <text id="question2-label">\
                            <value>question2</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')" />\
            </input>\
            <input ref="/data/question2">\
                <label ref="jr:itext(\'question2-label\')" />\
            </input>\
        </h:body>\
    </h:html>';
});
