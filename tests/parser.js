/*jshint multistr: true */
require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils',
    'vellum/parser',
    'text!static/parser/other_item.xml',
    'text!static/parser/label-without-itext.xml',
    'text!static/parser/missing-bind.xml'
], function (
    chai,
    $,
    _,
    util,
    parser,
    OTHER_ITEM_XML,
    LABEL_WITHOUT_ITEXT_XML,
    MISSING_BIND_XML
) {
    var assert = chai.assert,
        call = util.call,
        plugins = util.options.options.plugins || [],
        pluginsWithItemset = _.union(plugins, ["itemset"]),
        pluginsWithoutItemset = _(plugins).without("itemset");

    describe("The parser", function () {
        it("can detect when the itemset plugin is enabled", function (done) {
            util.init({
                plugins: pluginsWithItemset,
                core: {
                    onReady: function () {
                        assert(this.isPluginEnabled("itemset"),
                               "itemset plugin should be enabled");
                        done();
                    }
                }
            });
        });

        it("can detect when the itemset plugin is disabled", function (done) {
            util.init({
                plugins: pluginsWithoutItemset,
                core: {
                    onReady: function () {
                        assert(!this.isPluginEnabled("itemset"),
                               "itemset plugin should be disabled");
                        done();
                    }
                }
            });
        });

        it("should gracefully handle itemset when the itemset plugin is disabled", function (done) {
            util.init({
                plugins: pluginsWithoutItemset,
                core: {
                    form: TEST_XML_1, 
                    onReady: function () {
                        var mug = call("getMugByPath", "/data/state");
                        assert.equal(mug.__className, "Select");
                        var xml = call("createXML"),
                            doc = $($.parseXML(xml));
                        assert.equal(doc.find("instance[id=states]").length, 1, xml);
                        assert.equal(doc.find('itemset').attr('nodeset'),
                                     "instance('states')/state_list/state");
                        done();
                    }
                }
            });
        });

        it("should not drop newlines in calculate conditions", function () {
            util.loadXML(TEST_XML_2);
            var mug = call("getMugByPath", "/data/question1");
            assert.equal(mug.p.calculateAttr, 'concat("Line 1","\nLine 2")');
        });

        var ignoreWarnings = /Form (JRM namespace|does not have a (Name|(UI)?Version))/;

        it("should load select item without itext", function () {
            util.loadXML(OTHER_ITEM_XML, null, ignoreWarnings);
            var mug = call("getMugByPath", "/ClassroomObservationV3/Q0003"),
                // HACK how to reference items in select?
                item = mug._node_control.children[1].value;
            assert.equal(item.p.nodeID, 'other');
        });

        it("should load mugs with relative paths and label without itext", function () {
            util.loadXML(LABEL_WITHOUT_ITEXT_XML, null, ignoreWarnings);
            var grp = call("getMugByPath", "/data/group"),
                mug = call("getMugByPath", "/data/group/a"),
                txt = call("getMugByPath", "/data/text");
            assert.equal(grp.p.labelItext.defaultValue(), 'The group');
            assert.equal(mug.p.labelItext.defaultValue(), 'The label');
            assert.equal(txt.p.labelItext.defaultValue(), 'The text');

            // should not raise an error
            util.assertXmlNotEqual(call("createXML"), LABEL_WITHOUT_ITEXT_XML);
        });

        it("should load question without bind element", function () {
            util.loadXML(MISSING_BIND_XML);
        });
    });

    var TEST_XML_1 = '' + 
    '<?xml version="1.0" encoding="UTF-8" ?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Vellum testing</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms"\
                          xmlns="http://openrosa.org/formdesigner/FFD00941-A932-471A-AEC8-87F6EFEF767F"\
                          uiVersion="1" version="1" name="Vellum testing">\
                        <state />\
                    </data>\
                </instance>\
                <instance id="states" src="jr://fixture/item-list:state"></instance>\
                <bind nodeset="/data/state" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="state-label">\
                            <value>State</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <select1 ref="/data/state">\
                <label ref="jr:itext(\'state-label\')" />\
                <itemset nodeset="instance(\'states\')/state_list/state">\
                  <label ref="name"></label>\
                  <value ref="id"></value>\
                </itemset>\
            </select1>\
        </h:body>\
    </h:html>';

    var TEST_XML_2 = util.xmlines('' +
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" calculate="concat(&quot;Line 1&quot;,&quot;&#10;Line 2&quot;)" />\
                <itext>\
                    <translation lang="en" default=""/>\
                </itext>\
            </model>\
        </h:head>\
        <h:body></h:body>\
    </h:html>');
});
