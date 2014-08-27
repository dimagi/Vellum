/*jshint multistr: true */
define([
    'tests/utils',
    'chai',
    'jquery'
], function (
    util,
    chai,
    $
) {
    var assert = chai.assert,
        assertXmlEqual = util.assertXmlEqual,
        call = util.call;

    describe("The Ignore-But-Retain plugin", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        var xmls = new XMLSerializer();

        var testXmlPair = function (rawXml, processedXml) {
            call('loadXML', rawXml);
            assertXmlEqual(rawXml, call('createXML'));

            call('getData').ignore.ignoredNodes = [];
            assertXmlEqual(processedXml, call('createXML'));
        };

        it("ignores data, bind, body, and setvalue nodes with various edge cases (see XML)", 
            function () {
                testXmlPair(COMMON, COMMON_IGNORED);
            }
        );

        it("handles multiple ignore nodes in a row", function () {
            testXmlPair(MULTIPLE_IGNORES, MULTIPLE_IGNORES_IGNORED);
        });

        it("handles an ignore node's reference node being renamed", function () {
            call('loadXML', UNRENAMED);
            call('getMugByPath', '/data/question9').p.nodeID = 'question9a';
            assertXmlEqual(util.xmlines(RENAMED), call('createXML'));
        });

        it("handles a node being renamed that's referenced in an ignore node's XML", function () {
            call('loadXML', REFERENCED_UNRENAMED);
            call('getMugByPath', '/data/question1').p.nodeID = 'foobar';
            assertXmlEqual(REFERENCED_RENAMED, call('createXML'));
        });

    });

    var COMMON = '' + 
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/B3D39778-3AF6-4163-8D51-52DC9A105662" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                        <question9>\
                            <question10 vellum:ignore="retain" />\
                            <question11 />\
                        </question9>\
                        <question4 vellum:ignore="retain" />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question9" />\
                <bind nodeset="/data/question9/question10" type="xsd:int" vellum:ignore="retain" />\
                <bind nodeset="/data/question9/question11" type="xsd:int" />\
                <bind nodeset="/data/question4" vellum:ignore="retain" />\
                \
                <setvalue event="xforms-revalidate" ref="/data/question1" value="0"/>\
                <setvalue event="xforms-ready" ref="/data/question1" value="1" vellum:ignore="retain"/>\
                <setvalue event="xforms-ready" ref="/data/question2" value="2" vellum:ignore="retain"/>\
                <setvalue event="xforms-ready" ref="/data/question3" value="3"/>\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                        <text id="question9-label">\
                            <value>question9</value>\
                        </text>\
                        <text id="question11-label">\
                            <value>question11</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <!-- body nodes, including nesting -->\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')" />\
            </input>\
            <group ref="/data/question9">\
                <label ref="jr:itext(\'question9-label\')" />\
                <!-- ignored node after an inner label -->\
                <input ref="/data/question9/question10" vellum:ignore="retain">\
                    <label ref="jr:itext(\'question10-label\')" />\
                </input>\
                <input ref="/data/question9/question11">\
                    <label ref="jr:itext(\'question11-label\')" />\
                </input>\
            </group>\
            <select1 ref="/data/question4" vellum:ignore="retain">\
                <label ref="jr:itext(\'question4-label\')" />\
                <item>\
                    <label ref="jr:itext(\'question4-item5-label\')" />\
                    <value>item5</value>\
                </item>\
                <item>\
                    <label ref="jr:itext(\'question4-item6-label\')" />\
                    <value>item6</value>\
                </item>\
            </select1>\
        </h:body>\
    </h:html>';

    var COMMON_IGNORED = '' + 
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/B3D39778-3AF6-4163-8D51-52DC9A105662" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                        <question9>\
                            <question11 />\
                        </question9>\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question9" />\
                <bind nodeset="/data/question9/question11" type="xsd:int" />\
                \
                <setvalue event="xforms-revalidate" ref="/data/question1" value="0"/>\
                <setvalue event="xforms-ready" ref="/data/question3" value="3"/>\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                        <text id="question9-label">\
                            <value>question9</value>\
                        </text>\
                        <text id="question11-label">\
                            <value>question11</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')" />\
            </input>\
            <group ref="/data/question9">\
                <label ref="jr:itext(\'question9-label\')" />\
                <input ref="/data/question9/question11">\
                    <label ref="jr:itext(\'question11-label\')" />\
                </input>\
            </group>\
        </h:body>\
    </h:html>';

    var MULTIPLE_IGNORES = '' + 
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                        <question9 vellum:ignore="retain" />\
                        <question4 vellum:ignore="retain" />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question9" vellum:ignore="retain" />\
                <bind nodeset="/data/question4" vellum:ignore="retain" />\
                <itext>\
                    <translation lang="en" default=""/>\
                </itext>\
            </model>\
        </h:head>\
        <h:body></h:body>\
    </h:html>';

    var MULTIPLE_IGNORES_IGNORED = '' + 
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
                <bind nodeset="/data/question1" type="xsd:string" />\
                <itext>\
                    <translation lang="en" default=""/>\
                </itext>\
            </model>\
        </h:head>\
        <h:body></h:body>\
    </h:html>';

    var UNRENAMED = '' +
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                        <question9>\
                            <question10 vellum:ignore="retain" />\
                            <question11 />\
                        </question9>\
                        <question4 vellum:ignore="retain" />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question9" />\
                <bind nodeset="/data/question9/question10" type="xsd:int" vellum:ignore="retain" />\
                <bind nodeset="/data/question9/question11" type="xsd:int" />\
                <bind nodeset="/data/question4" vellum:ignore="retain" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                        <text id="question9-label">\
                            <value>question9</value>\
                        </text>\
                        <text id="question10-label" vellum:ignore="retain">\
                            <value>question10</value>\
                        </text>\
                        <text id="question11-label">\
                            <value>question11</value>\
                        </text>\
                        <text id="question4-label" vellum:ignore="retain">\
                            <value>question4</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')" />\
            </input>\
            <group ref="/data/question9">\
                <label ref="jr:itext(\'question9-label\')" />\
                <input ref="/data/question9/question10" vellum:ignore="retain">\
                    <label ref="jr:itext(\'question10-label\')" />\
                </input>\
                <input ref="/data/question9/question11">\
                    <label ref="jr:itext(\'question11-label\')" />\
                </input>\
            </group>\
            <select1 ref="/data/question4" vellum:ignore="retain">\
                <label ref="jr:itext(\'question4-label\')" />\
                <item>\
                    <label ref="jr:itext(\'question4-item5-label\')" />\
                    <value>item5</value>\
                </item>\
                <item>\
                    <label ref="jr:itext(\'question4-item6-label\')" />\
                    <value>item6</value>\
                </item>\
            </select1>\
        </h:body>\
    </h:html>';

    var RENAMED = '' +  // renamed question9 -> question9a
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                        <question9a>\
                            <question10 vellum:ignore="retain" />\
                            <question11 />\
                        </question9a>\
                        <question4 vellum:ignore="retain" />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question9a" />\
                <bind nodeset="/data/question9a/question10" type="xsd:int" vellum:ignore="retain" />\
                <bind nodeset="/data/question9a/question11" type="xsd:int" />\
                <bind nodeset="/data/question4" vellum:ignore="retain" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="question10-label" vellum:ignore="retain">\
                            <value>question10</value>\
                        </text>\
                        <text id="question1-label">\
                            <value>question1</value>\
                        </text>\
                        <text id="question9-label">\
                            <value>question9</value>\
                        </text>\
                        <text id="question11-label">\
                            <value>question11</value>\
                        </text>\
                        <text id="question4-label" vellum:ignore="retain">\
                            <value>question4</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/question1">\
                <label ref="jr:itext(\'question1-label\')" />\
            </input>\
            <group ref="/data/question9a">\
                <!-- todo: renaming of itext IDs without requiring UI layer -->\
                <label ref="jr:itext(\'question9-label\')" />\
                <input ref="/data/question9a/question10" vellum:ignore="retain">\
                    <label ref="jr:itext(\'question10-label\')" />\
                </input>\
                <input ref="/data/question9a/question11">\
                    <label ref="jr:itext(\'question11-label\')" />\
                </input>\
            </group>\
            <select1 ref="/data/question4" vellum:ignore="retain">\
                <label ref="jr:itext(\'question4-label\')" />\
                <item>\
                    <label ref="jr:itext(\'question4-item5-label\')" />\
                    <value>item5</value>\
                </item>\
                <item>\
                    <label ref="jr:itext(\'question4-item6-label\')" />\
                    <value>item6</value>\
                </item>\
            </select1>\
        </h:body>\
    </h:html>';

    var REFERENCED_UNRENAMED = '' + 
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
                        <question1 />\
                        <question9 vellum:ignore="retain" />\
                    </data>\
                </instance>\
                <bind nodeset="/data/question1" type="xsd:string" />\
                <bind nodeset="/data/question9" calculate="1 + /data/question1" vellum:ignore="retain"/>\
            </model>\
        </h:head>\
        <h:body></h:body>\
    </h:html>';

    var REFERENCED_RENAMED = '' + 
    '<?xml version="1.0" encoding="UTF-8"?>\
    <h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
        <h:head>\
            <h:title>Untitled Form</h:title>\
            <model>\
                <instance>\
                    <data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/398C9010-61DC-42D3-8A85-B857AC3A9CA0" uiVersion="1" version="1" name="Untitled Form">\
                        <foobar />\
                        <question9 vellum:ignore="retain" />\
                    </data>\
                </instance>\
                <bind nodeset="/data/foobar" type="xsd:string" />\
                <bind nodeset="/data/question9" calculate="1 + /data/foobar" vellum:ignore="retain"/>\
                <itext>\
                    <translation lang="en" default=""/>\
                </itext>\
            </model>\
        </h:head>\
        <h:body></h:body>\
    </h:html>';
});
