require([
    'chai',
    'jquery',
    'tests/utils',
    'vellum/javaRosa'
], function (
    chai,
    $,
    util,
    jr
) {
    var assert = chai.assert,
        call = util.call;

    describe("The logic manager", function () {
        it("should update expressions when a question ID changes", function (done) {
            util.init({core: {form: TEST_XML_1, onReady: function () {
                var expr, mug = call("getCurrentlySelectedMug");
                assert.equal(mug.p.nodeID, "question1",
                             "wrong question selected on load: " + mug.p.nodeID);
                $("input[name=property-nodeID]").val("question").change();
                util.clickQuestion("question2");
                mug = call("getCurrentlySelectedMug");
                expr = $("input[name=property-relevantAttr]").val();
                assert.equal(expr, "/data/question = 1");
                done();
            }}});
        });
    });

    /*jshint multistr: true */
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
