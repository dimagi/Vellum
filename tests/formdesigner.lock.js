/*jshint multistr: true */
import chai from "chai";
import util from "tests/utils";
import $ from "jquery";
import TEST_XML from "tests/static/lock/test.xml";
import copyPaste from "vellum/copy-paste";

// NOTE: timer mocking here doesn't actually work, it only handles timeouts,
// doesn't actually implement sleep-like functionality.
// Need to change things under test to be async if you need to ensure they've
// finished before testing something (or make things under test not use
// setTimeout/Interval.  Use callbacks or https://github.com/cujojs/when.

const assert = chai.assert,
    clickQuestion = util.clickQuestion,
    getMug = util.getMug,
    call = util.call,
    getInput = util.getInput;

function beforeFn(done) {
    util.init({
        javaRosa: {langs: ['en']},
        plugins: ['lock'],
        core: {
            onReady: function () {
                call('loadXFormOrError', TEST_XML, done);
            }
        }
    });
}

describe("The Lock plugin", function() {
    before(beforeFn);

    function locked(path, propertyPath) {
        return call('isPropertyLocked', getMug(path), propertyPath);
    }
    function moveable(path) {
        return call('isMugPathMoveable', getMug(path));
    }
    function deleteable(path) {
        return call('isMugRemoveable', getMug(path));
    }
    function changeable(path) {
        return call('isMugTypeChangeable', getMug(path));
    }

    it("includes 'locked' in the main properties after 'requiredAttr'", function () {
        const props = call('getMainProperties');
        const requiredIdx = props.indexOf('requiredAttr');
        const lockedIdx = props.indexOf('locked');
        assert(lockedIdx !== -1, "'locked' should be in main properties");
        assert.equal(lockedIdx, requiredIdx + 1,
            "'locked' should be immediately after 'requiredAttr'");
    });

    it("preserves XML with vellum:lock attributes", function () {
        util.assertXmlEqual(TEST_XML, call('createXML'));
    });

    it("sets vellum:lock='all' on rawBindAttributes when locked", function () {
        const mug = getMug('/data/unlocked');
        try {
            mug.p.locked = true;
            assert.equal(mug.p.rawBindAttributes['vellum:lock'], 'all');
        } finally {
            mug.p.locked = false;
        }
    });

    it("removes vellum:lock from rawBindAttributes when unlocked", function () {
        const mug = getMug('/data/locked');
        try {
            mug.p.locked = false;
            assert.notProperty(mug.p.rawBindAttributes, 'vellum:lock');
        } finally {
            mug.p.locked = true;
        }
    });

    it("disallows moving a locked node", function () {
        assert.isFalse(moveable('/data/locked'));
        assert(moveable('/data/unlocked'));
    });

    it("disallows deleting a locked node", function () {
        assert.isFalse(deleteable('/data/locked'));
        assert(deleteable('/data/unlocked'));
    });

    it("disallows changing the type of a locked node", function () {
        assert.isFalse(changeable('/data/locked'));
        assert(changeable('/data/unlocked'));
    });

    it("disallows changing all properties of a locked node", function () {
        assert(locked('/data/locked'));
        assert(locked('/data/locked', 'constraintAttr'));
        assert(locked('/data/locked', 'relevantAttr'));
        assert(locked('/data/locked', 'requiredAttr'));
    });

    it("copies a locked question as unlocked", function () {
        clickQuestion('locked');
        const serialized = copyPaste.copy();
        copyPaste.paste(serialized);
        const pasted = getMug('/data/copy-1-of-locked');
        assert(pasted, "pasted mug should exist");
        assert(!pasted.p.locked);
        call('getData').core.form.removeMugsFromForm([pasted]);
    });

    it("does not lock based on unsupported vellum:lock values", function () {
        assert(!getMug('/data/unsupported_lock').p.locked);
    });

    describe("groups", function () {
        it("disallows moving a group that contains a locked question", function () {
            assert.isFalse(moveable('/data/group_with_nested_lock'));
            assert(moveable('/data/group_no_lock'));
        });

        it("disallows deleting a group that contains a locked question", function () {
            assert.isFalse(deleteable('/data/group_with_nested_lock'));
            assert(deleteable('/data/group_no_lock'));
        });

        it("disallows changing ID of a group that contains a locked question", function () {
            assert(locked('/data/group_with_nested_lock', 'nodeID'));
            assert.isFalse(locked('/data/group_no_lock', 'nodeID'));
        });

        it("adds a 'locked children' message to a group that contains a locked question", function () {
            locked('/data/group_with_nested_lock', 'nodeID');
            const mug = getMug('/data/group_with_nested_lock');
            const msg = mug.messages.get('nodeID', 'mug-has-locked-children');
            assert(msg, "expected locked children message on group");
        });

        it("allows moving a question into a locked group", function () {
            const src = getMug('/data/unlocked');
            const dst = getMug('/data/locked_group');
            assert(call('checkMove',
                src.ufid, src.__className,
                dst.ufid, dst.__className,
                0));
        });

        it("allows reordering a group with locked children within its parent", function () {
            const src = getMug('/data/group_with_nested_lock');
            assert(call('checkMove',
                src.ufid, src.__className,
                '#', '#',
                0));
        });

        it("prevents moving a group with locked children to a new parent", function () {
            const src = getMug('/data/group_with_nested_lock');
            const newParent = getMug('/data/group_no_lock');
            assert.isFalse(call('checkMove',
                src.ufid, src.__className,
                newParent.ufid, newParent.__className,
                0));
        });

        it("prevents a locked question from being reordered", function () {
            const src = getMug('/data/locked');
            assert.isFalse(call('checkMove',
                src.ufid, src.__className,
                '#', '#',
                0));
        });
    });

    describe("locked select questions", function () {
        it("propagates locked to control-only children when set", function () {
            const mug = getMug('/data/unlocked_select');
            const choice = getMug('/data/unlocked_select/choice1');

            mug.p.locked = true;
            assert(choice.p.locked);
            mug.p.locked = false;
            assert(!choice.p.locked);
        });

        it("prevents moving choices into a locked select", function () {
            const src = getMug('/data/unlocked_select/choice1');
            const dst = getMug('/data/locked_select');
            assert.isFalse(call('checkMove',
                src.ufid, src.__className,
                dst.ufid, dst.__className,
                0));
        });

        it("prevents pasting a choice into a locked select", function () {
            clickQuestion('/data/unlocked_select/choice1');
            const serialized = copyPaste.copy();
            clickQuestion('/data/locked_select/choice1');
            const errors = copyPaste.paste(serialized);
            assert(errors.length > 0, "expected paste errors");
        });

        it("allows pasting a choice into an unlocked select", function () {
            clickQuestion('/data/locked_select/choice1');
            const serialized = copyPaste.copy();
            clickQuestion('/data/unlocked_select/choice1');
            const errors = copyPaste.paste(serialized);
            assert.equal(errors.length, 0, "expected no paste errors");
        });

        it("removes the 'Add Choice' action for a locked select", function () {
            const lockedSelect = getMug('/data/locked_select');
            assert.isFalse(lockedSelect.options.canAddChoices);
        });
    });

    describe("tree icons", function () {
        function getLockIcon(path) {
            const mug = getMug(path);
            const node = call('jstree', 'get_node', mug.ufid);
            return node.data.extraIcons?.lock || null;
        }

        it("shows a lock icon on a locked question", function () {
            const icon = getLockIcon('/data/locked');
            assert(icon, "expected lock icon on locked question");
            assert.include(icon, 'fa-lock');
        });

        it("does not show a lock icon on an unlocked question", function () {
            assert.isNull(getLockIcon('/data/unlocked'));
        });

        it("does not show a lock icon on a locked choice", function () {
            assert.isNull(getLockIcon('/data/locked_select/choice1'));
        });

        it("updates the lock icon when toggling locked", function () {
            const mug = getMug('/data/unlocked');
            try {
                assert.isNull(getLockIcon('/data/unlocked'));
                mug.p.locked = true;
                assert(getLockIcon('/data/unlocked'), "expected lock icon after locking");
            } finally {
                mug.p.locked = false;
            }
        });

        it("shows a lock icon on a locked group with no unlocked children", function () {
            const icon = getLockIcon('/data/locked_group');
            assert(icon, "expected icon on locked group");
            assert.include(icon, 'fa-lock');
            assert.notInclude(icon, 'fa-unlock');
        });

        it("shows an unlock icon on a locked group with unlocked children", function () {
            const icon = getLockIcon('/data/locked_group_with_unlocked_children');
            assert(icon, "expected lock icon on locked select");
            assert.include(icon, 'fa-unlock');
            assert.notInclude(icon, 'fa-lock');
        });
    });

    describe("edit_locked_questions feature", function () {
        describe("with the feature enabled", function () {
            before(function (done) {
                util.init({
                    javaRosa: {langs: ['en']},
                    plugins: ['lock'],
                    features: {edit_locked_questions: true},
                    core: {
                        onReady: function () {
                            call('loadXFormOrError', TEST_XML, done);
                        }
                    }
                });
            });

            it("does not add the 'cannot edit' message to locked questions", function () {
                const mug = getMug('/data/locked');
                const msg = mug.messages.get('locked', 'mug-locked-cannot-edit');
                assert.isNull(msg);
            });

            it("makes the locked property visible for all questions", function () {
                const mug = getMug('/data/unlocked');
                const spec = mug.spec.locked;
                assert.equal(spec.visibility, 'visible');
            });

            it("makes the locked property editable", function () {
                const mug = getMug('/data/locked');
                const spec = mug.spec.locked;
                assert(spec.enabled(mug));
            });
        });

        describe("without the feature enabled", function () {
            before(beforeFn);

            it("adds the 'cannot edit' message to locked questions", function () {
                const mug = getMug('/data/locked');
                const msg = mug.messages.get('locked', 'mug-locked-cannot-edit');
                assert(msg, "expected 'cannot edit' message on locked mug");
            });

            it("makes the locked property visible only if present", function () {
                const mug = getMug('/data/unlocked');
                const spec = mug.spec.locked;
                assert.equal(spec.visibility, 'visible_if_present');
            });

            it("makes the locked property not editable", function () {
                const mug = getMug('/data/locked');
                const spec = mug.spec.locked;
                assert(!spec.enabled(mug));
            });
        });
    });
});


describe("The question locking functionality in the core and UI", function () {
    before(beforeFn);

    describe("The edit locking", function () {
        it("shows the delete button for deleteable questions", function () {
            clickQuestion('unlocked');
            assert($("button:contains(Delete)").length === 1);
        });

        it("hides the delete button for non-deletable questions", function () {
            clickQuestion('locked');
            assert($("button:contains(Delete)").length === 0);
        });

        function testTypeChangeable(bool) {
            clickQuestion(bool ? "unlocked" : "locked");
            const btn = $(".btn.current-question");
            assert(btn.length === 1);
            btn.click();
            const menu = btn.closest('.question-type-changer');
            assert.equal(!!menu.find('li:not(.dropdown-header)').length, bool);
        }

        it("shows the type changer for type-changeable questions", function () {
            testTypeChangeable(true);
        });

        it("hides the type changer for non-type-changeable questions", function () {
            testTypeChangeable(false);
        });

        it("disables the checkbox for a locked boolean property", function () {
            clickQuestion("locked");
            assert(getInput('requiredAttr').prop('disabled'));

            clickQuestion("unlocked");
            const $r = getInput('requiredAttr');
            assert.isFalse($r.prop('disabled'));
        });

        it("disables the text input for a locked text property", function () {
            clickQuestion("unlocked");
            assert.isFalse(getInput('nodeID').prop('disabled'));

            clickQuestion("locked");
            assert(getInput("nodeID").prop('disabled'));
        });

        function testEditButton(bool) {
            clickQuestion(bool ? "locked" : "unlocked");
            const $but = getInput('relevantAttr').parents('.form-group').find('button.fd-edit-button');
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
});
