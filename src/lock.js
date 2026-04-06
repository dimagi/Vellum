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

const LOCKED_BIND_ATTR = "vellum:lock"
const LOCKED_UNEDITABLE_MSG_KEY = "mug-locked-cannot-edit"

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
                            "This question is locked and can only be edited by a user with the locked "
                            + "questions permission."
                        ),
                    level: mug.INFO,
                };
                mug.addMessage('locked', message);
            }
        }
    },
    handleMugParseFinish: function (mug) {
        this.__callOld();
        if (mug.parentMug
            && mug.options.isControlOnly
        ) {
            mug.p.set('locked', mug.parentMug.p.locked);
        }
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
            enabled: function (mug) { return isEditable },
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
                mug.form.getChildren(mug).forEach(child => _this.handleMugParseFinish(child));
            },
        };
        return spec;
    },
    checkMove: function (srcId, srcType, dstId, dstType, position) {
        const canMove = this.__callOld();

        if (canMove) {
            const form = this.data.core.form;
            const destinationMug = form.getMugByUFID(dstId);
            if (destinationMug) {
            return !(destinationMug.p.locked && _.contains(['Select', 'MSelect'], dstType));
            }
        }
        return false;
    },
    isPropertyLocked: function (mug, propertyPath) {
        return this.__callOld() || mug.p.locked;
    },
    isMugPathMoveable: function (mug) {
        return this.__callOld() && !mug.p.locked;
    },
    isMugRemoveable: function (mug) {
        return this.__callOld() && !mug.p.locked;
    },
    isMugTypeChangeable: function (mug) {
        return this.__callOld() && !mug.p.locked;
    },
});
