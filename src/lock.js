/*
 * Locked Questions plugin.
 *
 * Lets you lock questions by setting vellum:lock on their bind.
 *
 *    'all': Nothing about this question can be changed.
 */
import $ from "jquery";
import "vellum/core";
import _ from "underscore";
import widgets from "vellum/widgets";

const LOCKED_BIND_ATTR = "vellum:lock";
const LOCKED_UNEDITABLE_MSG_KEY = "mug-locked-cannot-edit";
const LOCKED_CHILDREN_MSG_KEY = "mug-has-locked-children";
const SELECT_CLASSES = ["Select", "MSelect", "Choice"];

$.vellum.plugin("lock", {}, {
    parseBindElement: function (form, el, path) {
        this.__callOld();
        const locked = el.xmlAttr(LOCKED_BIND_ATTR);
        if (locked && locked === 'all') {
            const mug = form.getMugByPath(path);
            mug.p.set('locked', true);

            if (!this.opts().features.edit_locked_questions) {
                const message = {
                    key: LOCKED_UNEDITABLE_MSG_KEY,
                    message: gettext(
                            "This question is locked and can only be edited by a user with the locked " +
                            "questions permission."
                        ),
                    level: mug.INFO,
                };
                mug.addMessage('locked', message);
            }
        }
    },
    handleMugParseFinish: function (mug) {
        this.__callOld();
        this._setLockedFromParent(mug);
    },
    setTreeActions: function (mug) {
        if (mug.p.locked) {
            mug.options.canAddChoices = false;
        }
        this.__callOld();
    },
    getMainProperties: function () {
        const properties = this.__callOld();
        properties.splice(1 + properties.indexOf('requiredAttr'), 0, 'locked');
        return properties;
    },
    getMugSpec: function () {
        const _this = this;
        const spec = this.__callOld();
        const isEditable = this.opts().features.edit_locked_questions;

        spec.databind.locked = {
            lstring: gettext("Locked"),
            visibility: isEditable ? 'visible' : 'visible_if_present',
            presence: 'optional',
            widget: widgets.checkbox,
            enabled: () => isEditable,
            help: gettext("A locked question cannot be edited, moved, or deleted from the form."),
            helpURL: "https://www.example.com",  // placeholder for public documentation
            serialize: () => {},
            deserialize: () => {},
            setter: function (mug, attr, value) {
                if (value === true) {
                    mug.p.rawBindAttributes[LOCKED_BIND_ATTR] = 'all';
                } else {
                    delete mug.p.rawBindAttributes[LOCKED_BIND_ATTR];
                }
                mug.p.set(attr, value);
                mug.form.getChildren(mug).forEach(child => _this._setLockedFromParent(child));
            },
        };
        return spec;
    },
    checkMove: function (srcId, srcType, dstId, dstType, position) {
        const form = this.data.core.form;
        const sourceMug = form.getMugByUFID(srcId);
        if (sourceMug.p.locked) {
            return false;
        }

        const canMove = this.__callOld();
        if (canMove) {
            const destinationMug = form.getMugByUFID(dstId);
            if (destinationMug) {
                return !(destinationMug.p.locked && _.contains(SELECT_CLASSES, dstType));
            }
            return true;
        }
        return false;
    },
    getInsertTargetAndPosition: function (refMug, qType, after) {
        if (refMug?.p.locked && _.contains(SELECT_CLASSES, refMug.__className)) {
            return null;
        }
        return this.__callOld();
    },
    _hasLockedChildren: function (mug) {
        return mug.form.getChildren(mug).some(child =>
            child.p.locked || this._hasLockedChildren(child)
        );
    },
    _setLockedFromParent: function (mug) {
        if (mug.parentMug && mug.options.isControlOnly) {
            mug.p.set('locked', mug.parentMug.p.locked);
        }
    },
    isPropertyLocked: function (mug, propertyPath) {
        const locked = this.__callOld();
        if (locked || mug.p.locked) {
            return true;
        }

        if (propertyPath === 'nodeID' && !this.isMugPathMoveable(mug)) {
            const message = {
                key: LOCKED_CHILDREN_MSG_KEY,
                message: gettext(
                        "This group contains locked questions and cannot be moved or deleted from the form."
                    ),
                level: mug.INFO,
            };
            mug.addMessage('nodeID', message);
            return true;
        }
        return false;
    },
    isMugPathMoveable: function (mug) {
        return this.__callOld() && !mug.p.locked && !this._hasLockedChildren(mug);
    },
    isMugRemoveable: function (mug) {
        return this.__callOld() && !mug.p.locked && !this._hasLockedChildren(mug);
    },
    isMugTypeChangeable: function (mug) {
        return this.__callOld() && !mug.p.locked;
    },
});
