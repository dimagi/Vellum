/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/util'
], function (
    chai,
    $,
    _,
    util,
    vellumUtil
) {
    var assert = chai.assert,
        call = util.call;

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
            var text,
                repeat,
                properties = [
                    "relevantAttr",
                    "calculateAttr",
                    "constraintAttr",
                    "dataParent",
                    "repeat_count"
                ];

            before(function () {
                util.loadXML("");
                text = util.addQuestion("Text", "text");
                repeat = util.addQuestion("Repeat", "repeat");
            });

            it("the same set of xpath references as util.XPATH_REFERENCES", function () {
                assert.deepEqual(vellumUtil.XPATH_REFERENCES, properties);
            });

            _.each(properties, function (attr) {
                it("invalid path in " + attr, function () {
                    var mug = attr.startsWith("repeat") ? repeat : text;
                    assert(util.isTreeNodeValid(mug), mug.messages.toString());
                    assert.deepEqual(mug.messages.get(attr), []);

                    mug.p[attr] = "/data/unknown";
                    assert(!util.isTreeNodeValid(mug), "mug should not be valid");
                    assert(mug.messages.get(attr).length,
                           attr + " should have messages");

                    mug.p[attr] = "";
                    assert(util.isTreeNodeValid(mug), mug.messages.toString());
                    assert.deepEqual(mug.messages.get(attr), []);
                });
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
