var assert = chai.assert;

describe("The Ignore-But-Retain plugin", function() {
    var plugin = new formdesigner.plugins.ignoreButRetain(),
        xmls = new XMLSerializer();

    var assertXmlEqual = function (str1, str2) {
        var xml1 = EquivalentXml.xml(str1),
            xml2 = EquivalentXml.xml(str2);
        assert(EquivalentXml.isEquivalent(xml1, xml2, {element_order: true}));
    };

    var testXmlPair = function (rawXml, processedXml) {
        var xml = $($.parseXML(rawXml));
        xml = xmls.serializeToString(plugin.beforeParse(xml)[0]);
        assertXmlEqual(xml, processedXml);

        xml = plugin.afterSerialize(xml);
        assertXmlEqual(xml, rawXml);
    };

    it("ignores data nodes and binds", function () {
        testXmlPair(DATA_AND_BIND, DATA_AND_BIND_IGNORED);
    });

    it("ignores setvalues", function () {
        testXmlPair(SETVALUES, SETVALUES_IGNORED);
    });

    it("ignores body nodes, including nested nodes", function () {
        testXmlPair(BODY, BODY_IGNORED);
    });
    
    it("handles multiple ignore nodes in a row", function () {
        testXmlPair(MULTIPLE_IGNORES, MULTIPLE_IGNORES_IGNORED);
    });

    it("handles an ignore node's reference node being renamed", function () {
        var xml = $($.parseXML(UNRENAMED));
        plugin.beforeParse(xml);

        plugin.onMugRename("question9a", "question9", 
                           "/data/question9a", "/data/question9");

        xml = plugin.afterSerialize(RENAMED_IGNORED);
        assertXmlEqual(xml, RENAMED);
    });

    it("handles a node being renamed that's referenced in an ignore node's XML", function () {
        var xml = $($.parseXML(REFERENCED_UNRENAMED));
        plugin.beforeParse(xml);

        plugin.onMugRename("foobar", "question1", "/data/foobar", "/data/question1");

        xml = plugin.afterSerialize(REFERENCED_RENAMED_IGNORED);
        assertXmlEqual(xml, REFERENCED_RENAMED);
    });

});

var DATA_AND_BIND = '' + 
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9>\
						<question10 ignore="true" />\
						<question11 />\
					</question9>\
					<question4 ignore="true" />\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9" />\
			<bind nodeset="/data/question9/question10" type="xsd:int" ignore="true" />\
			<bind nodeset="/data/question9/question11" type="xsd:int" />\
			<bind nodeset="/data/question4" ignore="true" />\
		</model>\
	</h:head>\
</h:html>';

var DATA_AND_BIND_IGNORED = '' + 
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9>\
						<question11 />\
					</question9>\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9" />\
			<bind nodeset="/data/question9/question11" type="xsd:int" />\
		</model>\
	</h:head>\
</h:html>';

var SETVALUES = '' +
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
            <setvalue event="xforms-revalidate" ref="/data/question1" value="0"/>\
            <setvalue event="xforms-ready" ref="/data/question1" value="1" ignore="true"/>\
            <setvalue event="xforms-ready" ref="/data/question2" value="2" ignore="true"/>\
            <setvalue event="xforms-ready" ref="/data/question3" value="3"/>\
		</model>\
	</h:head>\
</h:html>';

var SETVALUES_IGNORED = '' +
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
            <setvalue event="xforms-revalidate" ref="/data/question1" value="0"/>\
            <setvalue event="xforms-ready" ref="/data/question3" value="3"/>\
		</model>\
	</h:head>\
</h:html>';

var BODY = '' +
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:body>\
		<input ref="/data/question1">\
			<label ref="jr:itext(\'question1-label\')" />\
		</input>\
		<group ref="/data/question9">\
			<label ref="jr:itext(\'question9-label\')" />\
			<input ref="/data/question9/question10" ignore="true">\
				<label ref="jr:itext(\'question10-label\')" />\
			</input>\
			<input ref="/data/question9/question11">\
				<label ref="jr:itext(\'question11-label\')" />\
			</input>\
		</group>\
		<select1 ref="/data/question4" ignore="true">\
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

var BODY_IGNORED = '' +
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
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
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9 ignore="true" />\
					<question4 ignore="true" />\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9" ignore="true" />\
			<bind nodeset="/data/question4" ignore="true" />\
		</model>\
	</h:head>\
</h:html>';

var MULTIPLE_IGNORES_IGNORED = '' + 
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
		</model>\
	</h:head>\
</h:html>';

var UNRENAMED = '' +
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9>\
						<question10 ignore="true" />\
						<question11 />\
					</question9>\
					<question4 ignore="true" />\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9" />\
			<bind nodeset="/data/question9/question10" type="xsd:int" ignore="true" />\
			<bind nodeset="/data/question9/question11" type="xsd:int" />\
			<bind nodeset="/data/question4" ignore="true" />\
		</model>\
	</h:head>\
	<h:body>\
		<input ref="/data/question1">\
			<label ref="jr:itext(\'question1-label\')" />\
		</input>\
		<group ref="/data/question9">\
			<label ref="jr:itext(\'question9-label\')" />\
			<input ref="/data/question9/question10" ignore="true">\
				<label ref="jr:itext(\'question10-label\')" />\
			</input>\
			<input ref="/data/question9/question11">\
				<label ref="jr:itext(\'question11-label\')" />\
			</input>\
		</group>\
		<select1 ref="/data/question4" ignore="true">\
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

var RENAMED_IGNORED = '' +
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9a>\
						<question11 />\
					</question9a>\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9a" />\
			<bind nodeset="/data/question9a/question11" type="xsd:int" />\
		</model>\
	</h:head>\
	<h:body>\
		<input ref="/data/question1">\
			<label ref="jr:itext(\'question1-label\')" />\
		</input>\
		<group ref="/data/question9a">\
			<label ref="jr:itext(\'question9a-label\')" />\
			<input ref="/data/question9a/question11">\
				<label ref="jr:itext(\'question11-label\')" />\
			</input>\
		</group>\
	</h:body>\
</h:html>';

var RENAMED = '' +  // renamed question9 -> question9a
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9a>\
						<question10 ignore="true" />\
						<question11 />\
					</question9a>\
					<question4 ignore="true" />\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9a" />\
			<bind nodeset="/data/question9a/question10" type="xsd:int" ignore="true" />\
			<bind nodeset="/data/question9a/question11" type="xsd:int" />\
			<bind nodeset="/data/question4" ignore="true" />\
		</model>\
	</h:head>\
	<h:body>\
		<input ref="/data/question1">\
			<label ref="jr:itext(\'question1-label\')" />\
		</input>\
		<group ref="/data/question9a">\
			<label ref="jr:itext(\'question9a-label\')" />\
			<input ref="/data/question9a/question10" ignore="true">\
				<label ref="jr:itext(\'question10-label\')" />\
			</input>\
			<input ref="/data/question9a/question11">\
				<label ref="jr:itext(\'question11-label\')" />\
			</input>\
		</group>\
		<select1 ref="/data/question4" ignore="true">\
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
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<question1 />\
					<question9 ignore="true" />\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question9" calculate="1 + /data/question1" ignore="true"/>\
		</model>\
	</h:head>\
</h:html>';

var REFERENCED_RENAMED_IGNORED = '' + 
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<foobar />\
				</data>\
			</instance>\
			<bind nodeset="/data/foobar" type="xsd:string" />\
		</model>\
	</h:head>\
</h:html>';

var REFERENCED_RENAMED = '' + 
'<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">\
	<h:head>\
		<model>\
			<instance>\
				<data>\
					<foobar />\
					<question9 ignore="true" />\
				</data>\
			</instance>\
			<bind nodeset="/data/foobar" type="xsd:string" />\
			<bind nodeset="/data/question9" calculate="1 + /data/foobar" ignore="true"/>\
		</model>\
	</h:head>\
</h:html>';
