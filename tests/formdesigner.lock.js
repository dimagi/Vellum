/*jshint multistr: true */
require([
    'chai',
    'tests/utils',
    'jquery'
], function (
    chai,
    util,
    $
) {
    // NOTE: timer mocking here doesn't actually work, it only handles timeouts,
    // doesn't actually implement sleep-like functionality.
    // Need to change things under test to be async if you need to ensure they've
    // finished before testing something (or make things under test not use
    // setTimeout/Interval.  Use callbacks or https://github.com/cujojs/when.

    var assert = chai.assert,
        clickQuestion = util.clickQuestion,
        call = util.call,
        getInput = util.getInput;
    
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
                        <group />\
                    </data>\
                </instance>\
                <bind nodeset="/data/node_locked" type="xsd:string" vellum:lock="node" />\
                <bind nodeset="/data/value_locked" type="xsd:string" vellum:lock="value"/>\
                <bind nodeset="/data/none_locked" type="xsd:string" vellum:lock="none" />\
                <bind nodeset="/data/normal" type="xsd:string" />\
                <bind nodeset="/data/group" />\
                <itext>\
                    <translation lang="en" default="">\
                        <text id="node_locked-label">\
                            <value>node_locked</value>\
                        </text>\
                        <text id="value_locked-label">\
                            <value>value_locked</value>\
                        </text>\
                        <text id="none_locked-label">\
                            <value>none_locked</value>\
                        </text>\
                        <text id="normal-label">\
                            <value>normal</value>\
                        </text>\
                    </translation>\
                </itext>\
            </model>\
        </h:head>\
        <h:body>\
            <input ref="/data/node_locked">\
                <label ref="jr:itext(\'node_locked-label\')" />\
            </input>\
            <input ref="/data/value_locked">\
                <label ref="jr:itext(\'value_locked-label\')" />\
            </input>\
            <input ref="/data/none_locked">\
                <label ref="jr:itext(\'none_locked-label\')" />\
            </input>\
            <input ref="/data/normal">\
                <label ref="jr:itext(\'normal-label\')" />\
            </input>\
            <group ref="/data/group"></group>\
        </h:body>\
    </h:html>';

    function beforeFn(done) {
        util.init({
            javaRosa: {langs: ['en']},
            core: {
                onReady: function () {
                    call('loadXFormOrError', TEST_XML, done);
                }
            }
        });
    }

    describe("The Lock plugin", function() {
        before(beforeFn);

        function locked(mugPath, property) {
            return call('isPropertyLocked', mugPath, property);
        }
        function moveable(mugPath) {
            return call('isMugPathMoveable', mugPath);
        }
        function deleteable(mugPath) {
            return call('isMugRemoveable', call('getMugByPath', mugPath), mugPath);
        }
        function changeable(mugPath) {
            return call('isMugTypeChangeable', call('getMugByPath', mugPath), mugPath);
        }

        it("preserves XML with vellum:lock attributes", function () {
            util.assertXmlEqual(TEST_XML, call('createXML'));
        });

        it("disallows renaming a locked node", function () {
            assert(locked('/data/node_locked', 'nodeID'));
            assert(locked('/data/value_locked', 'nodeID'));
            assert.isFalse(locked('/data/none_locked', 'nodeID'));
            assert.isFalse(locked('/data/normal', 'nodeID'));
        });

        it("disallows moving a locked node to a different parent", function () {
            assert.isFalse(moveable('/data/node_locked'));
            assert.isFalse(moveable('/data/value_locked'));
            assert(moveable('/data/none_locked'));
            assert(moveable('/data/normal'));
        });

        it("disallows deleting a locked node", function () {
            assert.isFalse(deleteable('/data/node_locked'));
            assert.isFalse(deleteable('/data/value_locked'));
            assert(deleteable('/data/none_locked'));
            assert(deleteable('/data/normal'));
        });

        it("disallows changing the type only of a 'value' locked node", function () {
            assert.isFalse(changeable('/data/value_locked'));
            assert(changeable('/data/node_locked'));
            assert(changeable('/data/none_locked'));
            assert(changeable('/data/normal'));
        });

        it("allows changing only the Itext IDs of a 'value' locked node", function () {
            assert.isFalse(locked('/data/value_locked', 'constraintMsgItext'));
            assert(locked('/data/value_locked', 'constraintAttr'));
        });

        it("allows changing any property of a non-locked node", function () {
            assert.isFalse(locked('/data/node_locked'));
            assert.isFalse(locked('/data/none_locked'));
            assert.isFalse(locked('/data/normal'));
        });
    });


    // hack to make jstree drag and drop testing work. FML.
    //var _simulateEvent = $.simulate.prototype.simulateEvent,
        //currentEl;
    //$.simulate.prototype.simulateEvent = function (elem, type, options) {
        //var $el = $(document.elementFromPoint(options.clientX, options.clientY));
        
        //_simulateEvent.call(this, $el, type, options);
        //_simulateEvent.call(this, $el, type + '.jstree', options);

        //if (type === 'mousemove') {
            //if ($el[0] !== currentEl) {
                //currentEl = $el[0];
                //this.simulateEvent($el, 'mouseenter', options);
            //}
        //} else if (type === 'mouseup') {
            //currentEl = null;
        //}
    //};


    describe("The question locking functionality in the core and UI", function () {
        before(beforeFn);

        describe("The edit locking", function () {
            it("shows the delete button for deleteable questions", function () {
                clickQuestion('normal');
                assert($("button:contains(Delete)").length === 1);
            });
            
            it("hides the delete button for non-deletable questions", function () {
                clickQuestion('node_locked');
                assert($("button:contains(Delete)").length === 0);
            });

            function testTypeChangeable(bool) {
                clickQuestion(bool ? "normal" : "value_locked");
                var btn = $(".btn.current-question");
                assert(btn.length === 1);
                btn.click();
                assert.equal(
                    btn.next().find('li:contains("Cannot Change Question Type")').length,
                    +!bool);
            }
            it("shows the type changer for type-changeable questions", function () {
                testTypeChangeable(true);
            });
            it("hides the type changer for non-type-changeable questions", function () {
                testTypeChangeable(false);
            });

            it("disables the checkbox (only) for a locked boolean property", function () {
                clickQuestion("value_locked");
                assert(getInput('requiredAttr').prop('disabled'));

                clickQuestion("normal");
                var $r = getInput('requiredAttr');
                assert.isFalse($r.prop('disabled'));
            });

            it("disables the text input (only) for a locked text property", function () {
                clickQuestion("normal");
                assert.isFalse(getInput('nodeID').prop('disabled'));

                clickQuestion("value_locked");
                assert(getInput("nodeID").prop('disabled'));
            });

            function testEditButton(bool) {
                clickQuestion(bool ? "value_locked" : "normal");
                var $but = getInput('relevantAttr').parents('.control-group').find('button:contains(Edit)');
                assert.equal(1, $but.length);
                assert.equal(bool, $but.prop('disabled'));
            }
            it("enables the edit button for non-locked logic properties", function () {
                testEditButton(false);
            });
           
            it("disables the edit button for locked logic properties", function () {
                testEditButton(true);
            });
        });

        return;
        /* todo 
        describe("The move locking", function () {
            beforeEach(beforeFn);

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
            }

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
                doDrag('normal', 'group');

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
                doDrag('node_locked', 'group');

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
                doDrag('node_locked', 'value_locked');

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
        }); */
    });
});
