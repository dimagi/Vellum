require([
    'tests/utils'
], function (
    util
) {

    describe("Vellum", function () {
        it("preserves all question types and attributes", function (done) {
            util.before({
                core: {
                    form: TEST_XML,
                    onReady: function () {
                        util.assertXmlEqual(util.call('createXML'), TEST_XML);
                        done();
                    }
                }
            });
        });
    });

var TEST_XML = '' +
'<?xml version="1.0" encoding="UTF-8" ?>\
<h:html xmlns:h="http://www.w3.org/1999/xhtml" xmlns:orx="http://openrosa.org/jr/xforms" xmlns="http://www.w3.org/2002/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:vellum="http://commcarehq.org/xforms/vellum">\
	<h:head>\
		<h:title>Untitled Form</h:title>\
		<model>\
			<instance>\
				<data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" xmlns="http://openrosa.org/formdesigner/526523F0-DA37-439C-B697-B620DB933526" uiVersion="1" version="1" name="Untitled Form">\
					<question1 key="jr preload key value">default data value</question1>\
					<question2 />\
					<question30 />\
					<question3 />\
                    <question3a />\
                    <!-- arbitrary data attributes -->\
					<question6 foo="bar" />\
					<question9 />\
					<question11 />\
					<question13 />\
					<question14 />\
					<question15 />\
					<question16 />\
					<question17 />\
					<question18 />\
					<question19 />\
					<question21>\
						<question31 jr:template="" />\
						<question22 jr:template="">\
							<question23>\
								<question24 />\
								<question25 />\
								<question26 />\
								<question27 />\
								<question28 />\
                                <question7 />\
							</question23>\
						</question22>\
					</question21>\
					<question20 />\
					<question32 />\
                    <question_foo />\
				</data>\
			</instance>\
			<instance src="jr://instance/casedb" id="casedb"></instance>\
			<bind nodeset="/data/question1" type="xsd:string" constraint="/data/question20 = 2" jr:constraintMsg="jr:itext(\'question1-constraintMsg\')" relevant="/data/question20" required="true()" jr:preload="jr preload" jr:preloadParams="jr preload param" />\
			<bind nodeset="/data/question2" />\
			<bind nodeset="/data/question30" />\
			<bind nodeset="/data/question3" />\
            <bind nodeset="/data/question3a" />\
            <!-- arbitrary bind attributes -->\
			<bind nodeset="/data/question6" spam="eggs" />\
			<bind nodeset="/data/question9" />\
			<bind nodeset="/data/question11" />\
			<bind nodeset="/data/question13" type="xsd:int" />\
			<bind nodeset="/data/question14" type="xsd:string" />\
			<bind nodeset="/data/question15" type="xsd:int" />\
			<bind nodeset="/data/question16" type="xsd:int" />\
			<bind nodeset="/data/question17" type="xsd:date" />\
			<bind nodeset="/data/question18" type="xsd:time" />\
			<bind nodeset="/data/question19" type="xsd:dateTime" />\
			<bind nodeset="/data/question21" />\
			<bind nodeset="/data/question21/question31" relevant="true()" />\
			<bind nodeset="/data/question21/question22" />\
			<bind nodeset="/data/question21/question22/question23" />\
			<bind nodeset="/data/question21/question22/question23/question24" type="binary" />\
			<bind nodeset="/data/question21/question22/question23/question25" type="binary" />\
			<bind nodeset="/data/question21/question22/question23/question26" type="binary" />\
			<bind nodeset="/data/question21/question22/question23/question27" type="geopoint" />\
			<bind nodeset="/data/question21/question22/question23/question28" type="xsd:string" />\
			<bind nodeset="/data/question21/question22/question23/question7" type="intent" />\
			<bind nodeset="/data/question20" />\
			<bind nodeset="/data/question32" calculate="1 + 2" />\
            <bind nodeset="/data/question_foo" />\
            <!-- setvalues -->\
            <setvalue event="xforms-ready" ref="/data/question1" value="2" />\
			<itext>\
				<translation lang="en" default="">\
					<text id="question1-label">\
						<value>question1 en label</value>\
						<value form="image">jr://file/commcare/image/data/question1.png</value>\
						<value form="audio">jr://file/commcare/audio/data/question1.mp3</value>\
						<value form="video">jr://file/commcare/video/data/question1.3gp</value>\
						<value form="long">question1 en long</value>\
						<value form="short">question1 en short</value>\
						<value form="custom">question1 en custom</value>\
					</text>\
					<text id="question1-hint">\
						<value>question1 hint en</value>\
					</text>\
					<text id="question1-constraintMsg">\
						<value>question1 en validation</value>\
					</text>\
					<text id="question2-label">\
						<value>question2</value>\
					</text>\
					<text id="question3-label">\
						<value>question3</value>\
					</text>\
					<text id="question3-item4-label">\
						<value>item4</value>\
						<value form="image">jr://file/commcare/image/data/question3-item4.png</value>\
						<value form="audio">jr://file/commcare/audio/data/question3-item4.mp3</value>\
						<value form="video">jr://file/commcare/video/data/question3-item4.3gp</value>\
						<value form="long">long en</value>\
						<value form="short">short en</value>\
						<value form="custom">custom en</value>\
					</text>\
					<text id="question3-item5-label">\
						<value>item5</value>\
					</text>\
					<text id="question6-label">\
						<value>question6</value>\
					</text>\
					<text id="question6-item7-label">\
						<value>item7</value>\
					</text>\
					<text id="question6-item8-label">\
						<value>item8</value>\
					</text>\
					<text id="question9-label">\
						<value>question9</value>\
					</text>\
					<text id="question11-label">\
						<value>question11</value>\
					</text>\
					<text id="question13-label">\
						<value>question13</value>\
					</text>\
					<text id="question14-label">\
						<value>question14</value>\
					</text>\
					<text id="question15-label">\
						<value>question15</value>\
					</text>\
					<text id="question16-label">\
						<value>question16</value>\
					</text>\
					<text id="question17-label">\
						<value>question17</value>\
					</text>\
					<text id="question18-label">\
						<value>question18</value>\
					</text>\
					<text id="question19-label">\
						<value>question19</value>\
					</text>\
					<text id="question21-label">\
						<value>question21</value>\
					</text>\
					<text id="question21/question22-label">\
						<value>question22</value>\
					</text>\
					<text id="question21/question22/question23-label">\
						<value>question23</value>\
					</text>\
					<text id="question21/question22/question23/question24-label">\
						<value>question24</value>\
					</text>\
					<text id="question21/question22/question23/question25-label">\
						<value>question25</value>\
					</text>\
					<text id="question21/question22/question23/question26-label">\
						<value>question26</value>\
					</text>\
					<text id="question21/question22/question23/question27-label">\
						<value>question27</value>\
					</text>\
					<text id="question21/question22/question23/question28-label">\
						<value>question28</value>\
					</text>\
					<text id="question21/question22/question23/question29-label">\
						<value>question29</value>\
					</text>\
					<text id="question30-label">\
						<value>question30</value>\
					</text>\
					<text id="question21/question22/question31-label">\
						<value>question31</value>\
					</text>\
                    <text id="question21/question22/question23/question7-label">\
						<value>question7</value>\
					</text>\
				</translation>\
				<translation lang="hin">\
					<text id="question1-label">\
						<value>question1 hin label</value>\
						<value form="image">jr://file/commcare/image/data/question1.png</value>\
						<value form="audio">jr://file/commcare/audio/data/question1.mp3</value>\
						<value form="video">jr://file/commcare/video/data/question1.3gp</value>\
						<value form="long">question1 hin long</value>\
						<value form="short">question1 hin short</value>\
						<value form="custom">question1 hin custom</value>\
					</text>\
					<text id="question1-hint">\
						<value>question1 hint hin</value>\
					</text>\
					<text id="question1-constraintMsg">\
						<value>question1 hin validation</value>\
					</text>\
					<text id="question2-label">\
						<value>question2</value>\
					</text>\
					<text id="question3-label">\
						<value>question3</value>\
					</text>\
					<text id="question3-item4-label">\
						<value>item4</value>\
						<value form="image">jr://file/commcare/image/data/question3-item4.png</value>\
						<value form="audio">jr://file/commcare/audio/data/question3-item4.mp3</value>\
						<value form="video">jr://file/commcare/video/data/question3-item4.3gp</value>\
						<value form="long">long hin</value>\
						<value form="short">short hin</value>\
						<value form="custom">custom hin</value>\
					</text>\
					<text id="question3-item5-label">\
						<value>item5</value>\
					</text>\
					<text id="question6-label">\
						<value>question6</value>\
					</text>\
					<text id="question6-item7-label">\
						<value>item7</value>\
					</text>\
					<text id="question6-item8-label">\
						<value>item8</value>\
					</text>\
					<text id="question9-label">\
						<value>question9</value>\
					</text>\
					<text id="question11-label">\
						<value>question11</value>\
					</text>\
					<text id="question13-label">\
						<value>question13</value>\
					</text>\
					<text id="question14-label">\
						<value>question14</value>\
					</text>\
					<text id="question15-label">\
						<value>question15</value>\
					</text>\
					<text id="question16-label">\
						<value>question16</value>\
					</text>\
					<text id="question17-label">\
						<value>question17</value>\
					</text>\
					<text id="question18-label">\
						<value>question18</value>\
					</text>\
					<text id="question19-label">\
						<value>question19</value>\
					</text>\
					<text id="question21-label">\
						<value>question21</value>\
					</text>\
					<text id="question21/question22-label">\
						<value>question22</value>\
					</text>\
					<text id="question21/question22/question23-label">\
						<value>question23</value>\
					</text>\
					<text id="question21/question22/question23/question24-label">\
						<value>question24</value>\
					</text>\
					<text id="question21/question22/question23/question25-label">\
						<value>question25</value>\
					</text>\
					<text id="question21/question22/question23/question26-label">\
						<value>question26</value>\
					</text>\
					<text id="question21/question22/question23/question27-label">\
						<value>question27</value>\
					</text>\
					<text id="question21/question22/question23/question28-label">\
						<value>question28</value>\
					</text>\
					<text id="question21/question22/question23/question29-label">\
						<value>question29</value>\
					</text>\
					<text id="question30-label">\
						<value>question30</value>\
					</text>\
                    <text id="question21/question22/question31-label">						                    <value>question31</value>\
                    </text>\
                    <text id="question21/question22/question23/question7-label">\
						<value>question7</value>\
					</text>\
				</translation>\
			</itext>\
		</model>\
        &lt;!-- Intents inserted by Vellum: --&gt;\
		<odkx:intent xmlns:odkx="http://opendatakit.org/xforms" id="question7" class="app_id">\
			<extra key="key1" ref="key2" />\
			<extra key="a" ref="b" />\
			<response key="c" ref="d" />\
		</odkx:intent>\
	</h:head>\
	<h:body>\
		<input ref="/data/question1">\
			<label ref="jr:itext(\'question1-label\')">non-itext label</label>\
			<hint ref="jr:itext(\'question1-hint\')">non-itext hint</hint>\
		</input>\
		<trigger ref="/data/question2" appearance="minimal">\
			<label ref="jr:itext(\'question2-label\')" />\
		</trigger>\
		<trigger ref="/data/question30">\
			<label ref="jr:itext(\'question30-label\')" />\
		</trigger>\
		<select1 ref="/data/question3">\
			<label ref="jr:itext(\'question3-label\')" />\
			<item>\
				<label ref="jr:itext(\'question3-item4-label\')" />\
				<value>item4</value>\
			</item>\
			<item>\
				<label ref="jr:itext(\'question3-item5-label\')" />\
				<value>item5</value>\
			</item>\
		</select1>\
        <select1 ref="/data/question3a">\
        </select1>\
        <!-- arbitrary control attributes -->\
		<select ref="/data/question6" foo="baz">\
			<label ref="jr:itext(\'question6-label\')" />\
			<item>\
				<label ref="jr:itext(\'question6-item7-label\')" />\
				<value>item7</value>\
			</item>\
			<item>\
				<label ref="jr:itext(\'question6-item8-label\')" />\
				<value>item8</value>\
			</item>\
		</select>\
		<select1 ref="/data/question9">\
			<label ref="jr:itext(\'question9-label\')" />\
			<itemset nodeset="instance(\'casedb\')/casedb/case">\
				<label ref="case_name" />\
				<value ref="@case_id" />\
			</itemset>\
		</select1>\
		<select ref="/data/question11">\
			<label ref="jr:itext(\'question11-label\')" />\
			<itemset nodeset="instance(\'casedb\')/casedb/case[@case_type=\'mother\']">\
				<label ref="edd" />\
				<value ref="@case_id" />\
			</itemset>\
		</select>\
		<input ref="/data/question13">\
			<label ref="jr:itext(\'question13-label\')" />\
		</input>\
		<input ref="/data/question14" appearance="numeric">\
			<label ref="jr:itext(\'question14-label\')" />\
		</input>\
		<input ref="/data/question15">\
			<label ref="jr:itext(\'question15-label\')" />\
		</input>\
		<input ref="/data/question16">\
			<label ref="jr:itext(\'question16-label\')" />\
		</input>\
		<input ref="/data/question17">\
			<label ref="jr:itext(\'question17-label\')" />\
		</input>\
		<input ref="/data/question18">\
			<label ref="jr:itext(\'question18-label\')" />\
		</input>\
		<input ref="/data/question19">\
			<label ref="jr:itext(\'question19-label\')" />\
		</input>\
		<group ref="/data/question21">\
			<label ref="jr:itext(\'question21-label\')" />\
			<group>\
				<label ref="jr:itext(\'question21/question22/question31-label\')" />\
				<repeat jr:noAddRemove="true()"  nodeset="/data/question21/question31" jr:count="2" />\
			</group>\
			<group>\
				<label ref="jr:itext(\'question21/question22-label\')" />\
				<repeat jr:noAddRemove="false()" nodeset="/data/question21/question22">\
					<group ref="/data/question21/question22/question23" appearance="field-list">\
						<label ref="jr:itext(\'question21/question22/question23-label\')" />\
						<upload ref="/data/question21/question22/question23/question24" mediatype="image/*">\
							<label ref="jr:itext(\'question21/question22/question23/question24-label\')" />\
						</upload>\
						<upload ref="/data/question21/question22/question23/question25" mediatype="audio/*">\
							<label ref="jr:itext(\'question21/question22/question23/question25-label\')" />\
						</upload>\
						<upload ref="/data/question21/question22/question23/question26" mediatype="video/*">\
							<label ref="jr:itext(\'question21/question22/question23/question26-label\')" />\
						</upload>\
						<input ref="/data/question21/question22/question23/question27">\
							<label ref="jr:itext(\'question21/question22/question23/question27-label\')" />\
						</input>\
						<secret ref="/data/question21/question22/question23/question28">\
							<label ref="jr:itext(\'question21/question22/question23/question28-label\')" />\
						</secret>\
                        <input ref="/data/question21/question22/question23/question7" appearance="intent:question7">\
							<label ref="jr:itext(\'question21/question22/question23/question7-label\')" />\
						</input>\
					</group>\
				</repeat>\
			</group>\
		</group>\
        <unrecognized>\
            <raw control="xml" />\
        </unrecognized>\
	</h:body>\
</h:html>\
                        '

});
