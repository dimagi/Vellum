/*
 * Locked Questions plugin.
 *
 * Lets you lock questions by setting vellum:lock on their bind.
 *
 *    'all': Nothing about this question can be changed.
 */
import $ from "jquery";
import "vellum/core";
import widgets from "vellum/widgets";

const LOCKED_BIND_ATTR = "vellum:lock"

$.vellum.plugin("lock", {}, {
    parseBindElement: function (form, el, path) {
        this.__callOld();
        const locked = el.xmlAttr(LOCKED_BIND_ATTR);
        if (locked && locked === 'all') {
            const mug = form.getMugByPath(path);
            mug.p.set('locked', true);
        }
    },
    getMainProperties: function () {
        const properties = this.__callOld();
        properties.splice(1 + properties.indexOf('requiredAttr'), 0, 'locked');
        return properties;
    },
    getMugSpec: function () {
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
            },
        };
        return spec;
    },
    isPropertyLocked: function (mug, mugPath, propertyPath) {
        return this.__callOld() || mug.p.locked;
    },
    isMugPathMoveable: function (mug, mugPath) {
        return this.__callOld() && !mug.p.locked;
    },
    isMugRemoveable: function (mug, mugPath) {
        return this.__callOld() && !mug.p.locked;
    },
    isMugTypeChangeable: function (mug, mugPath) {
        return this.__callOld() && !mug.p.locked;
    },
});
