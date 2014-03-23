(function () {
// NOTE: timer mocking here doesn't actually work, it only handles timeouts,
// doesn't actually implement sleep-like functionality.
// Need to change things under test to be async if you need to ensure they've
// finished before testing something.  Use callbacks or
// https://github.com/cujojs/when.

var assert = chai.assert;

describe("The Lock plugin", function() {
    var c = formdesigner.controller,
        clock,
        plugin;

    before(function () {
        clock = sinon.useFakeTimers();
        c.loadXForm(TEST_XML);
        // ensure that form has loaded
        clock.tick(500);

        plugin = formdesigner.pluginManager.lock;
    });
    after(function () {
        clock.restore();
    });

    it("preserves XML with vellum:lock attributes", function () {
        var xml = c.form.writeXML();
        assertXmlEqual(TEST_XML, xml);
    });

    it("disallows renaming a locked node", function () {
        var locked = function (mugPath) {
            return plugin.isPropertyLocked(mugPath, 'dataElement/nodeID');
        };
        assert(locked('/data/node_locked'));
        assert(locked('/data/value_locked'));
        assert.isFalse(locked('/data/none_locked'));
        assert.isFalse(locked('/data/normal'));
    });

    it("disallows moving a locked node to a different parent", function () {
        var move = plugin.isMugPathMoveable;
        assert.isFalse(move('/data/node_locked'));
        assert.isFalse(move('/data/value_locked'));
        assert(move('/data/none_locked'));
        assert(move('/data/normal'));
    });

    it("disallows deleting a locked node", function () {
        var deleteable = plugin.isMugRemoveable;
        assert.isFalse(deleteable('/data/node_locked'));
        assert.isFalse(deleteable('/data/value_locked'));
        assert(deleteable('/data/none_locked'));
        assert(deleteable('/data/normal'));
    });

    it("disallows changing the type only of a 'value' locked node", function () {
        var change = plugin.isMugTypeChangeable;
        assert.isFalse(change('/data/value_locked'));
        assert(change('/data/node_locked'));
        assert(change('/data/none_locked'));
        assert(change('/data/normal'));
    });

    it("allows changing only the Itext IDs of a 'value' locked node", function () {
        var locked = plugin.isPropertyLocked;
        assert.isFalse(locked(
            '/data/value_locked', 'bindElement/constraintMsgItextID'));
        assert(locked('/data/value_locked', 'bindElement/constraintAttr'));
    });

    it("allows changing any property of a non-locked node", function () {
        var locked = function (mugPath) {
            return plugin.isPropertyLocked(mugPath, 'bindElement/constraintAttr');
        };
        assert.isFalse(locked('/data/node_locked'));
        assert.isFalse(locked('/data/none_locked'));
        assert.isFalse(locked('/data/normal'));
    });
});

var TEST_XML = '' + 
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
				<data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" \
                      xmlns="http://openrosa.org/formdesigner/4BE1309B-ABCF-4184-8175-9E381F3E0DD7"\
                      uiVersion="1" version="1" name="Untitled Form">\
					<node_locked />\
					<value_locked />\
                    <none_locked />\
                    <normal />\
				</data>\
			</instance>\
			<bind nodeset="/data/node_locked" type="xsd:string" vellum:lock="node" />\
			<bind nodeset="/data/value_locked" type="xsd:string" vellum:lock="value"/>\
            <bind nodeset="/data/none_locked" type="xsd:string" vellum:lock="none" />\
            <bind nodeset="/data/normal" type="xsd:string" />\
            <itext>\
				<translation lang="en" default="">\
					<text id="node_locked-label">\
						<value>node_locked</value>\
					</text>\
				</translation>\
			</itext>\
		</model>\
	</h:head>\
	<h:body>\
		<input ref="/data/node_locked">\
			<label ref="jr:itext(\'node_locked-label\')" />\
		</input>\
    </h:body>\
</h:html>';

// from jquery.simulate
function findCenter( elem ) {
	var offset,
		document = $( elem.ownerDocument );
	elem = $( elem );
	offset = elem.offset();

	return {
		x: offset.left + elem.outerWidth() / 2 - document.scrollLeft(),
		y: offset.top + elem.outerHeight() / 2 - document.scrollTop()
	};
};

// hack to make jstree drag and drop testing work. FML.
var _simulateEvent = $.simulate.prototype.simulateEvent,
    currentEl;
$.simulate.prototype.simulateEvent = function (elem, type, options) {
    var $el = $(document.elementFromPoint(options.clientX, options.clientY));
    
    _simulateEvent.call(this, $el, type, options);
    _simulateEvent.call(this, $el, type + '.jstree', options);

    if (type === 'mousemove') {
        if ($el[0] !== currentEl) {
            currentEl = $el[0];
            this.simulateEvent($el, 'mouseenter', options);
        }
    } else if (type === 'mouseup') {
        currentEl = null;
    }
};

// mocks a plugin method (the entire return value, not the per-plugin return
// value, in the case of a "return_all" method)
var PluginMock = function (method, mockFnOrValue) {
    var _orig = formdesigner.pluginManager.call;
    formdesigner.pluginManager.call = function () {
        var args = Array.prototype.slice.call(arguments),
            fn = args[0],
            fnArgs = args.slice(1);
        if (fn === method) {
            if (_.isFunction(mockFnOrValue)) {
                return mockFnOrValue.apply(formdesigner.pluginManager, fnArgs);
            } else {
                return mockFnOrValue;
            }
        } else {
            return _orig.apply(formdesigner.pluginManager, args);
        }
    };

    this.restore = function () {
        formdesigner.pluginManager.call = _orig;
    };
    return this;
};

describe("The question locking functionality in the core and UI", function () {
    var c = formdesigner.controller,
        clock,
        plugin;
    
    function beforeFn() {
        clock = sinon.useFakeTimers();
        c.loadXForm(BASIC_XML);
        // ensure that form has loaded
        clock.tick(500);

        plugin = formdesigner.pluginManager.lock;
    }
    function afterFn() {
        clock.restore();
    }

    describe("The edit locking", function () {
        before(beforeFn);
        after(afterFn);

        beforeEach(function () {
            // click question1, so we can mock internal methods, then click on
            // question2, and observe results
            clickQuestion('question1');
        });

        function clickQuestion2() {
            clickQuestion('question2');
        }

        it("shows the delete button for deleteable questions", function () {
            var mock = PluginMock("isMugRemoveable", [true]);
            clickQuestion2();
            mock.restore();
            assert($("button:contains(Delete)").length === 1);
        });
        
        it("hides the delete button for non-deletable questions", function () {
            mock = PluginMock("isMugRemoveable", [false]);
            clickQuestion2();
            mock.restore();
            assert($("button:contains(Delete)").length === 0);
        });

        function testTypeChangeable(bool) {
            var mock = PluginMock("isMugTypeChangeable", [bool]);
            clickQuestion2();
            mock.restore();
            var btn = $(".btn.current-question");
            assert(btn.length === 1);
            assert.equal(btn.hasClass('disabled'), !bool);
        }
        it("shows the type changer for type-changeable questions", function () {
            testTypeChangeable(true);
        });
        it("hides the type changer for non-type-changeable questions", function () {
            testTypeChangeable(false);
        });

        it("disables the checkbox (only) for a locked boolean property", function () {
            var mock = PluginMock('isPropertyLocked', [false]);
            clickQuestion2();
            mock.restore();
            assert(false === $("#bindElement-requiredAttr").prop('disabled'));

            mock = PluginMock('isPropertyLocked', [true]);
            clickQuestion2();
            mock.restore();
            var $r = $("#bindElement-requiredAttr");
            assert(true === $r.prop('disabled'));
            var val = $r.prop('checked');
            $r.click();
            assert(val === $r.prop('checked'));
        });

        it("disables the text input (only) for a locked text property", function () {
            var mock = PluginMock('isPropertyLocked', [false]);
            clickQuestion2();
            mock.restore();
            assert(false === $("#dataElement-nodeID").prop('disabled'));

            mock = PluginMock("isPropertyLocked", [true]);
            clickQuestion2();
            mock.restore();
            assert(true === $("#dataElement-nodeID").prop('disabled'));
        });

        function testEditButton(bool) {
            var mock = PluginMock('isPropertyLocked', [bool]);
            clickQuestion2();
            mock.restore();
            var $but = $("label[for='bindElement-relevantAttr']").next(':contains(Edit)');
            assert($but.length === 1);
            assert.equal(bool, $but.prop('disabled'));
            $but.click();
            assert((!bool) === $('#fd-xpath-editor').is(':visible'), "hjkl" + bool);
        }
        it("enables the edit button for non-locked logic properties", function () {
            testEditButton(false);
        });
       
        it("disables the edit button for locked logic properties", function () {
            testEditButton(true);
        });
    });

    describe("The move locking", function () {
        beforeEach(beforeFn);
        afterEach(afterFn);

        function doDrag(source, target) {
            var $source = $("li[rel]:contains(" + source + ")").find('a'),
                sourceCenter = findCenter($source),
                targetCenter = findCenter(
                    $("li[rel]:contains(" + target + ")").find('a'));

            $source.simulate("drag", {
                dx: targetCenter.x - sourceCenter.x,
                // ensure the drop is attempted *after* the target question
                dy: targetCenter.y - sourceCenter.y + 1,  
                moves: 10
            });
        }

        it("allows moving a non-locked question to a different parent", function () {
            var mock = PluginMock('isMugPathMoveable', [true]);
            doDrag('question1', 'question8');
            mock.restore();

            assert.deepEqual(c.form.dataTree.getStructure(), {
                'data': [
                    { 'question2': [] },
                    { 'question7': [ 
                        { 'question8': [] } ,
                        { 'question1': [] }
                    ] }
                ]
            });
        });
        
        it("disallows moving a locked question to a different parent", function () {
            var mock = PluginMock('isMugPathMoveable', [false]);
            doDrag('question1', 'question8');
            mock.restore();

            assert.deepEqual(c.form.dataTree.getStructure(), {
                'data': [
                    { 'question1': [] },
                    { 'question2': [] },
                    { 'question7': [ 
                        { 'question8': [] } 
                    ] }
                ]
            });
        });

        it("allows moving a locked question within its parent", function () {
            var mock = PluginMock('isMugPathMoveable', [false]);
            doDrag('question1', 'question2');
            mock.restore();

            assert.deepEqual(c.form.dataTree.getStructure(), {
                'data': [
                    { 'question2': [] },
                    { 'question1': [] },
                    { 'question7': [
                        { 'question8': [] }
                    ] }
                ]
            });
        });
    });
});


var BASIC_XML = '' + 
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
				<data xmlns:jrm="http://dev.commcarehq.org/jr/xforms" \
                      xmlns="http://openrosa.org/formdesigner/4BE1309B-ABCF-4184-8175-9E381F3E0DD7"\
                      uiVersion="1" version="1" name="Untitled Form">\
					<question1 />\
					<question2 />\
                    <question7 >\
                        <question8 />\
                    </question7>\
				</data>\
			</instance>\
			<bind nodeset="/data/question1" type="xsd:string" />\
			<bind nodeset="/data/question2" type="xsd:string" />\
            <bind nodeset="/data/question7" />\
            <bind nodeset="/data/question7/question8" type="xsd:string" />\
            <itext>\
				<translation lang="en" default="">\
					<text id="question1-label">\
						<value>question1</value>\
					</text>\
				</translation>\
				<translation lang="en" default="">\
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
        <group ref="/data/question7">\
			<label ref="jr:itext(\'question7-label\')" />\
            <input ref="/data/question7/question8">\
                <label ref="jr:itext(\'question8-label\')" />\
            </input>\
		</group>\
    </h:body>\
</h:html>';

})();
