/*
 * Locked Questions plugin.
 *
 * Lets you lock questions by setting vellum:lock on their bind.
 *
 *    'all': Nothing about this question can be changed.
 */
import $ from "jquery";
import "vellum/core";

const LOCKED_BIND_ATTR = "vellum:lock"

$.vellum.plugin("lock", {}, {
    parseBindElement: function (form, el, path) {
        this.__callOld();
        const locked = el.xmlAttr(LOCKED_BIND_ATTR);
        if (locked && locked === 'all') {
            const mug = form.getMugByPath(path);
            mug.p.set('locked', 'all');
        }
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
