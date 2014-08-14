require([
    'chai',
    'jquery',
    'underscore',
    'tests/utils'
], function (
    chai,
    $,
    _,
    util
) {
    var call = util.call,
        clickQuestion = util.clickQuestion,
        addQuestion = util.addQuestion,
        assert = chai.assert,
        questionTypes = [
            //{
            //    type: "QuestionType", // required
            //    nodeId: "questionN", // required
            //    attrs: { // optional
            //        // Any key here implies the same key inputs with a value of 1
            //        "attrName": value
            //    },
            //    inputs { // optional: add tests to check input counts
            //        "inputName": inputCount
            //    }
            //}
            {
                type: 'Text',
                nodeId: 'question1',
                attrs: {
                    keyAttr: 'jr preload key value',
                    dataValue: 'default data value',
                    constraintAttr: '/data/question20 = 2',
                    relevantAttr: '/data/question20',
                    requiredAttr: true,
                    preload: "jr preload",
                    preloadParams: "jr preload param"
                },
                inputs: {
                    calculateAttr: 0
                    //showOKCheckbox: 0
                }
            }, {
                type: 'Trigger',
                nodeId: 'question2',
                attrs: {showOKCheckbox: false},
                inputs: {
                    // TODO add more input counts for each question type
                    calculateAttr: 0,
                    constraintAttr: 1,
                    requiredAttr: 1,
                    relevantAttr: 1
                }
            }, {
                type: 'Trigger',
                nodeId: 'question30',
                attrs: {showOKCheckbox: true}
            }, {
                type: 'Select',
                nodeId: 'question3',
                inputs: {
                    // TODO add more input counts for each question type
                    calculateAttr: 0,
                    constraintAttr: 1,
                    requiredAttr: 1,
                    relevantAttr: 1
                }
            }, {
                type: 'MSelect',
                nodeId: 'question6'
            }, {
                type: 'Int',
                nodeId: 'question13'
            }, {
                type: 'PhoneNumber',
                nodeId: 'question14'
            }, {
                type: 'Double',
                nodeId: 'question15'
            }, {
                type: 'Long',
                nodeId: 'question16'
            }, {
                type: 'Date',
                nodeId: 'question17'
            }, {
                type: 'Time',
                nodeId: 'question18'
            }, {
                type: 'DateTime',
                nodeId: 'question19'
            }, {
                type: 'Group',
                nodeId: 'question21'
            }, { // get out of the repeat
                type: 'Repeat',
                nodeId: 'question31',
                attrs: {
                    requiredAttr: true,
                    no_add_remove: true, 
                    repeat_count: 2
                }
            }, { // insert before first data node
                type: 'DataBindOnly',
                nodeId: 'question20',
                inputs: {
                    calculateAttr: 1,
                    constraintAttr: 0,
                    requiredAttr: 0,
                }
            }, { // insert before first data node
                type: 'Repeat',
                nodeId: 'question22',
                attrs: {
                    no_add_remove: false
                }
            }, {
                type: 'FieldList',
                nodeId: 'question23'
            }, {
                type: 'Image',
                nodeId: 'question24'
            }, {
                type: 'Audio',
                nodeId: 'question25'
            }, {
                type: 'Video',
                nodeId: 'question26'
            }, {
                type: 'Geopoint',
                nodeId: 'question27'
            }, {
                type: 'Secret',
                nodeId: 'question28'
            }, {
                type: 'AndroidIntent',
                nodeId: 'question7'
            }, {
                type: 'DataBindOnly',
                nodeId: 'question32',
                attrs: {
                    calculateAttr: '1 + 2'
                },
                inputs: {
                    calculateAttr: 1,
                    constraintAttr: 0,
                    requiredAttr: 0,
                    relevantAttr: 1
                }
            }
        ];

    describe("Vellum", function () {
        describe("on load XML", function () {
            before(function (done) {
                util.init({
                    core: {
                        form: TEST_XML,
                        onReady: function () {
                            done();
                        }
                    }
                });
            });

            it("preserves all question types and attributes", function () {
                util.assertXmlEqual(util.call('createXML'), TEST_XML);
            });


            _.each(questionTypes, function(q, index) {
                var nodeId = q.nodeId;
                describe("with " + q.type + "[" + nodeId + "]", function () {
                    before(function (done) {
                        if (index > 0) {
                            clickQuestion(nodeId);
                        }
                        done();
                    });

                    it("should be selected when clicked", function() {
                        assert.equal(call("getCurrentlySelectedMug").p.nodeID, nodeId);
                    });

                    _.each(q.attrs || {}, function (val, name) {
                        it("should show 1 input for " + name, function() {
                            util.assertInputCount(name, 1, nodeId);
                        });
                    });

                    _.each(q.inputs || {}, function (num, name) {
                        if (q.attrs && q.attrs.hasOwnProperty(name)) {
                            assert.equal(num, 1,
                                "test configuration conflict for " + name);
                        } else {
                            it("should show " + num + " inputs for " + name, function() {
                                util.assertInputCount(name, num, nodeId);
                            });
                        }
                    });
                });
            });
        });

        it("adds all question types and attributes", function (done) {
            // This test takes way too long and needs to be broken up into
            // smaller subtests. LONG timeout is to prevent timeout on travis.
            this.timeout(10000);
            // this also tests
            // - that clicking add question buttons when other questions are
            //   selected adds questions correctly
            // - that a data node is added at the end, and adding a question
            //   when a data node is selected adds to the end of the non-data
            //   nodes
            // - adding standard and other itext
            // - changing itext label and updating question tree
            // - adding itext for multiple languages
            // - automatically creating Itext IDs for constraint and hint
            //   messages
            // - automatic adding of choices when you add a select
            // - automatic generation of media paths for regular questions and choices
            util.init({
                core: {
                    form: null,
                    onReady: function () {
                        _.each(questionTypes, function (q, i) {
                            var obj = {prevId: (i > 0 ? questionTypes[i - 1].nodeId : null)};
                            addQuestion.call(obj, q.type, q.nodeId, q.attrs);
                        });

                        function addAllForms() {
                            $(".btn:contains(image)").click();
                            $(".btn:contains(audio)").click();
                            $(".btn:contains(video)").click();
                            $(".btn:contains(long)").click();
                            $(".btn:contains(short)").click();
                            $(".btn:contains(custom)").click();
                            $(".fd-modal-generic-container").find("input")
                                .val("custom");
                            $(".fd-modal-generic-container").find(".btn:contains(Add)").click();
                        }

                        clickQuestion("question1");
                        addAllForms();
                        $("[name='itext-en-label']")
                            .val('question1 en label').change();
                        $("[name='itext-hin-label']")
                            .val('question1 hin label').change();
                        $("[name='itext-en-constraintMsg']")
                            .val('question1 en validation').change();
                        $("[name='itext-hin-constraintMsg']")
                            .val('question1 hin validation').change();
                        $("[name='itext-en-hint']")
                            .val('question1 hint en').change();
                        $("[name='itext-hin-hint']")
                            .val('question1 hin hint').change();
                        $("[name='itext-en-label-long']")
                            .val("question1 en long").change();
                        $("[name='itext-hin-label-long']")
                            .val("question1 hin long").change();
                        $("[name='itext-en-label-short']")
                            .val("question1 en short").change();
                        $("[name='itext-hin-label-short']")
                            .val("question1 hin short").change();
                        $("[name='itext-en-label-custom']")
                            .val("question1 en custom").change();
                        $("[name='itext-hin-label-custom']")
                            .val("question1 hin custom").change();

                        clickQuestion("question3", "item1");
                        addAllForms();
                        $("[name='itext-en-label-long']")
                            .val("item1 long en").change();
                        $("[name='itext-hin-label-long']")
                            .val("item1 long hin").change();
                        $("[name='itext-en-label-short']")
                            .val("item1 short en").change();
                        $("[name='itext-hin-label-short']")
                            .val("item1 short hin").change();
                        $("[name='itext-en-label-custom']")
                            .val("item1 custom en").change();
                        $("[name='itext-hin-label-custom']")
                            .val("item1 custom hin").change();

                        clickQuestion("question7");
                        $("[name='intent-app-id']").val("app_id").change();
                        $("[name='intent-extra'] .fd-kv-key").val('key1').change();
                        $("[name='intent-extra'] .fd-kv-val").val('value1').change();
                        $("[name='intent-response'] .fd-kv-key").val('key2').change();
                        $("[name='intent-response'] .fd-kv-val").val('value2').change();
                        util.assertXmlEqual(
                            call('createXML'),
                            util.xmlines(TEST_XML
                                .replace('foo="bar"', '')
                                .replace('spam="eggs"', '')
                                .replace('foo="baz"', '')
                                .replace(/<unrecognized>.+<\/unrecognized>/, '')
                                .replace('non-itext label', '')
                                .replace('non-itext hint', '')
                                .replace(/<instance[^>]+?casedb[^>]+?><\/instance>/, '')
                                .replace(/<setvalue[^>]+?>/, '')),
                            {normalize_xmlns: true}
                        );
                        
                        // should have updated question tree
                        clickQuestion("question1 en label");

                        
                        done();
                    }
                }
            });
        });

        describe("can change", function() {
            var changes = [
                ["Text", "Trigger"],
                ["Trigger", "Select"],
                ["Image", "Select"],
                ["Audio", "Select"],
                ["Video", "Select"]
            ];

            before(function (done) {
                util.init({
                    core: {
                        onReady: function () {
                            done();
                        }
                    }
                });
            });

            _.each(changes, function (change) {
                var from = change[0], to = change[1];
                it(from + " to " + to, function () {
                    var nodeId = (from + "_to_" + to).toLowerCase();
                    addQuestion(from, nodeId);
                    var mug = call("getMugByPath", "/data/" + nodeId);
                    assert.equal(mug.p.nodeID, nodeId, "got wrong mug before changing type");
                    assert.equal(mug.__className, from, "wrong mug type");
                    call("changeMugType", mug, to);
                    mug = call("getMugByPath", "/data/" + nodeId);
                    assert.equal(mug.__className, to);
                });
            });
        });

        it("question type change survives save + load", function (done) {
            function test() {
                addQuestion("Text", "question");
                var mug = call("getMugByPath", "/data/question");

                call("changeMugType", mug, "Trigger");

                util.saveAndReload(function () {
                    // verify type change
                    mug = call("getMugByPath", "/data/question");
                    assert.equal(mug.__className, "Trigger");
                    done();
                });
            }
            util.init({core: {onReady: test}});
        });
    });

/*jshint multistr: true */
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
                    <!-- arbitrary data attributes -->\
					<question6 foo="bar" />\
					<question13 />\
					<question14 />\
					<question15 />\
					<question16 />\
					<question17 />\
					<question18 />\
					<question19 />\
					<question21>\
						<question31 jr:template="" />\
					</question21>\
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
					<question20 />\
					<question32 />\
				</data>\
			</instance>\
			<instance src="jr://instance/casedb" id="casedb"></instance>\
			<bind nodeset="/data/question1" type="xsd:string" constraint="/data/question20 = 2" jr:constraintMsg="jr:itext(\'question1-constraintMsg\')" relevant="/data/question20" required="true()" jr:preload="jr preload" jr:preloadParams="jr preload param" />\
			<bind nodeset="/data/question2" />\
			<bind nodeset="/data/question30" />\
			<bind nodeset="/data/question3" />\
            <!-- arbitrary bind attributes -->\
			<bind nodeset="/data/question6" spam="eggs" />\
			<bind nodeset="/data/question13" type="xsd:int" />\
			<bind nodeset="/data/question14" type="xsd:string" />\
			<bind nodeset="/data/question15" type="xsd:double" />\
			<bind nodeset="/data/question16" type="xsd:long" />\
			<bind nodeset="/data/question17" type="xsd:date" />\
			<bind nodeset="/data/question18" type="xsd:time" />\
			<bind nodeset="/data/question19" type="xsd:dateTime" />\
			<bind nodeset="/data/question21" />\
			<bind nodeset="/data/question21/question31" required="true()" />\
			<bind nodeset="/data/question22" />\
			<bind nodeset="/data/question22/question23" />\
			<bind nodeset="/data/question22/question23/question24" type="binary" />\
			<bind nodeset="/data/question22/question23/question25" type="binary" />\
			<bind nodeset="/data/question22/question23/question26" type="binary" />\
			<bind nodeset="/data/question22/question23/question27" type="geopoint" />\
			<bind nodeset="/data/question22/question23/question28" type="xsd:string" />\
			<bind nodeset="/data/question22/question23/question7" type="intent" />\
			<bind nodeset="/data/question20" />\
			<bind nodeset="/data/question32" calculate="1 + 2" />\
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
					<text id="question30-label">\
						<value>question30</value>\
					</text>\
					<text id="question3-label">\
						<value>question3</value>\
					</text>\
					<text id="question3-item1-label">\
						<value>item1</value>\
						<value form="image">jr://file/commcare/image/data/question3-item1.png</value>\
						<value form="audio">jr://file/commcare/audio/data/question3-item1.mp3</value>\
						<value form="video">jr://file/commcare/video/data/question3-item1.3gp</value>\
						<value form="long">item1 long en</value>\
						<value form="short">item1 short en</value>\
						<value form="custom">item1 custom en</value>\
					</text>\
					<text id="question3-item2-label">\
						<value>item2</value>\
					</text>\
					<text id="question6-label">\
						<value>question6</value>\
					</text>\
					<text id="question6-item1-label">\
						<value>item1</value>\
					</text>\
					<text id="question6-item2-label">\
						<value>item2</value>\
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
					<text id="question21/question31-label">\
						<value>question31</value>\
					</text>\
					<text id="question22-label">\
						<value>question22</value>\
					</text>\
					<text id="question22/question23-label">\
						<value>question23</value>\
					</text>\
					<text id="question22/question23/question24-label">\
						<value>question24</value>\
					</text>\
					<text id="question22/question23/question25-label">\
						<value>question25</value>\
					</text>\
					<text id="question22/question23/question26-label">\
						<value>question26</value>\
					</text>\
					<text id="question22/question23/question27-label">\
						<value>question27</value>\
					</text>\
					<text id="question22/question23/question28-label">\
						<value>question28</value>\
					</text>\
                    <text id="question22/question23/question7-label">\
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
						<value>question1 hin hint</value>\
					</text>\
					<text id="question1-constraintMsg">\
						<value>question1 hin validation</value>\
					</text>\
					<text id="question2-label">\
						<value>question2</value>\
					</text>\
					<text id="question30-label">\
						<value>question30</value>\
					</text>\
					<text id="question3-label">\
						<value>question3</value>\
					</text>\
					<text id="question3-item1-label">\
						<value>item1</value>\
						<value form="image">jr://file/commcare/image/data/question3-item1.png</value>\
						<value form="audio">jr://file/commcare/audio/data/question3-item1.mp3</value>\
						<value form="video">jr://file/commcare/video/data/question3-item1.3gp</value>\
						<value form="long">item1 long hin</value>\
						<value form="short">item1 short hin</value>\
						<value form="custom">item1 custom hin</value>\
					</text>\
					<text id="question3-item2-label">\
						<value>item2</value>\
					</text>\
					<text id="question6-label">\
						<value>question6</value>\
					</text>\
					<text id="question6-item1-label">\
						<value>item1</value>\
					</text>\
					<text id="question6-item2-label">\
						<value>item2</value>\
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
                    <text id="question21/question31-label">\
                        <value>question31</value>\
                    </text>\
					<text id="question22-label">\
						<value>question22</value>\
					</text>\
					<text id="question22/question23-label">\
						<value>question23</value>\
					</text>\
					<text id="question22/question23/question24-label">\
						<value>question24</value>\
					</text>\
					<text id="question22/question23/question25-label">\
						<value>question25</value>\
					</text>\
					<text id="question22/question23/question26-label">\
						<value>question26</value>\
					</text>\
					<text id="question22/question23/question27-label">\
						<value>question27</value>\
					</text>\
					<text id="question22/question23/question28-label">\
						<value>question28</value>\
					</text>\
                    <text id="question22/question23/question7-label">\
						<value>question7</value>\
					</text>\
				</translation>\
			</itext>\
		</model>\
        &lt;!-- Intents inserted by Vellum: --&gt;\
		<odkx:intent xmlns:odkx="http://opendatakit.org/xforms" id="question7" class="app_id">\
			<extra key="key1" ref="value1" />\
			<response key="key2" ref="value2" />\
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
				<label ref="jr:itext(\'question3-item1-label\')" />\
				<value>item1</value>\
			</item>\
			<item>\
				<label ref="jr:itext(\'question3-item2-label\')" />\
				<value>item2</value>\
			</item>\
		</select1>\
        <!-- arbitrary control attributes -->\
		<select ref="/data/question6" foo="baz">\
			<label ref="jr:itext(\'question6-label\')" />\
			<item>\
				<label ref="jr:itext(\'question6-item1-label\')" />\
				<value>item1</value>\
			</item>\
			<item>\
				<label ref="jr:itext(\'question6-item2-label\')" />\
				<value>item2</value>\
			</item>\
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
				<label ref="jr:itext(\'question21/question31-label\')" />\
				<repeat jr:noAddRemove="true()"  nodeset="/data/question21/question31" jr:count="2" />\
			</group>\
		</group>\
        <group>\
            <label ref="jr:itext(\'question22-label\')" />\
            <repeat jr:noAddRemove="false()" nodeset="/data/question22">\
                <group ref="/data/question22/question23" appearance="field-list">\
                    <label ref="jr:itext(\'question22/question23-label\')" />\
                    <upload ref="/data/question22/question23/question24" mediatype="image/*">\
                        <label ref="jr:itext(\'question22/question23/question24-label\')" />\
                    </upload>\
                    <upload ref="/data/question22/question23/question25" mediatype="audio/*">\
                        <label ref="jr:itext(\'question22/question23/question25-label\')" />\
                    </upload>\
                    <upload ref="/data/question22/question23/question26" mediatype="video/*">\
                        <label ref="jr:itext(\'question22/question23/question26-label\')" />\
                    </upload>\
                    <input ref="/data/question22/question23/question27">\
                        <label ref="jr:itext(\'question22/question23/question27-label\')" />\
                    </input>\
                    <secret ref="/data/question22/question23/question28">\
                        <label ref="jr:itext(\'question22/question23/question28-label\')" />\
                    </secret>\
                    <input ref="/data/question22/question23/question7" appearance="intent:question7">\
                        <label ref="jr:itext(\'question22/question23/question7-label\')" />\
                    </input>\
                </group>\
            </repeat>\
        </group>\
        <unrecognized>\
            <raw control="xml" />\
        </unrecognized>\
	</h:body>\
</h:html>\
                        ';

});
