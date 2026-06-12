import $ from "jquery";
import "vellum/core";
import _ from "underscore";
import widgets from "vellum/widgets";

const LOCKED_XML_ATTR = "vellum:lock";
const LOCKED_UNEDITABLE_MSG_KEY = "mug-locked-cannot-edit";
const LOCKED_CHILDREN_MSG_KEY = "mug-has-locked-children";

const STATIC_SELECT_CLASSES = ["Select", "MSelect"];
const SELECT_AND_CHOICE_CLASSES = [...STATIC_SELECT_CLASSES, "Choice"];
const DYNAMIC_SELECT_CLASSES = ["SelectDynamic", "MSelectDynamic"];
const SELECT_CLASSES = [...STATIC_SELECT_CLASSES, ...DYNAMIC_SELECT_CLASSES];
const GROUP_CLASSES = ["Group", "Repeat", "FieldList"];

$.vellum.plugin("lock", {}, {
    init: function () {
        const data = this.data.lock;
        data.locks = {};
    },
    loadXML: function () {
        this.__callOld();

        // we don't know whether there are any locks until XML is loaded
        // tools menu items are already defined at this point, so target what we want and remove them here
        if (_.some(this.data.lock.locks) && !this.opts().features.edit_locked_questions) {
            const $menu = this.$f.find('.fd-tools-menu').parent();
            $menu.find('a:contains("' + gettext("Edit Source XML") + '")').parent().remove();
            $menu.find('a:contains("' + gettext("Edit Bulk Translations") + '")').parent().remove();
        }

    },
    parseBindElement: function (form, el, path) {
        this.__callOld();
        const locked = el.xmlAttr(LOCKED_XML_ATTR);
        if (locked && locked === 'all') {
            const mug = form.getMugByPath(path);
            mug.p.set('locked', true);

            if (!this.opts().features.edit_locked_questions) {
                addLockedUneditableMessage(mug);
            }
        }
    },
    parseDataElement: function (form, el, parentMug, role) {
        const mug = this.__callOld();
        // Data-only mugs have no bind, so their lock lives on the <data> node.
        if (mug.options.isDataOnly && $(el).xmlAttr(LOCKED_XML_ATTR) === 'all') {
            mug.p.set('locked', true);

            if (!this.opts().features.edit_locked_questions) {
                addLockedUneditableMessage(mug);
            }
        }
        return mug;
    },
    handleMugParseFinish: function (mug) {
        this.__callOld();
        if (_.contains(SELECT_CLASSES, mug.__className)) {
            propagateLockToControlOnlyChildren(mug);
        }
    },
    setTreeActions: function (mug) {
        if (_.contains(STATIC_SELECT_CLASSES, mug.__className)) {
            mug.options.canAddChoices = !mug.p.locked;
        }
        this.__callOld();
    },
    setTreeExtraIcons: function (mug) {
        this.__callOld();
        const node = mug.ufid && this.jstree('get_node', mug.ufid);
        if (!node) { return; }

        let icon = null;
        if (mug.p.locked) {
            icon = treeLockIcon(mug);
        }

        if (node.data.extraIcons?.lock !== icon) {
            node.data.extraIcons = node.data.extraIcons || {};
            node.data.extraIcons.lock = icon;
            this.jstree('redraw_node', node);
        }
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
            helpURL: "https://dimagi.atlassian.net/wiki/spaces/commcarepublic/pages/3946381318/Locked+Admin+Questions",
            serialize: () => {},
            deserialize: (data, key, mug, context) => {
                const rawAttrsProp = lockedAttrsProp(mug);
                if (mug.p[rawAttrsProp] && mug.p[rawAttrsProp][LOCKED_XML_ATTR]) {
                    delete mug.p[rawAttrsProp][LOCKED_XML_ATTR];
                }
            },
            setter: function (mug, attr, value) {
                if (!isEditable && !mug.form.isLoadingXForm) {
                    return;
                }

                const rawAttrsProp = lockedAttrsProp(mug);
                if (value === true) {
                    mug.p[rawAttrsProp] = mug.p[rawAttrsProp] || {};
                    mug.p[rawAttrsProp][LOCKED_XML_ATTR] = 'all';
                    _this.data.lock.locks[mug.ufid] = 'all';
                } else {
                    delete mug.p[rawAttrsProp][LOCKED_XML_ATTR];
                    delete _this.data.lock.locks[mug.ufid];
                }
                mug.p.set(attr, value);
                _this.setTreeExtraIcons(mug);

                if (_.contains(SELECT_CLASSES, mug.__className)) {
                    propagateLockToControlOnlyChildren(mug);
                }

                if (!mug.form.isLoadingXForm) {
                    if (_.contains(GROUP_CLASSES, mug.__className)) {
                        cascadeLockToDescendants(mug, value);
                    } else if (_.contains(STATIC_SELECT_CLASSES, mug.__className)) {
                        _this.setTreeActions(mug);
                    }
                    if (_this.getCurrentlySelectedMug() === mug) {
                        _this.displayMugProperties(mug);
                    }
                    updateAncestorTreeIcons(mug);
                }
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
                return !(destinationMug.p.locked && _.contains(SELECT_AND_CHOICE_CLASSES, dstType));
            }
            return true;
        }
        return false;
    },
    getInsertTargetAndPosition: function (refMug, qType, after) {
        if (refMug?.p.locked && _.contains(SELECT_AND_CHOICE_CLASSES, refMug.__className)) {
            return null;
        }
        return this.__callOld();
    },
    isPropertyLocked: function (mug, propertyPath) {
        const locked = this.__callOld();
        if (locked) {
            return true;
        }

        if (mug.p.locked) {
            // never lock the "Locked" checkbox based on itself
            return propertyPath !== "locked";
        }

        if (propertyPath === 'nodeID') {
            if (!this.isMugPathMoveable(mug)) {
                const message = {
                    key: LOCKED_CHILDREN_MSG_KEY,
                    message: gettext(
                            "This group contains locked questions and cannot be moved or deleted from the form."
                        ),
                    level: mug.INFO,
                };
                mug.addMessage('nodeID', message);
                return true;
            } else {
                mug.dropMessage('nodeID', LOCKED_CHILDREN_MSG_KEY);
            }
        }
        return false;
    },
    isMugPathMoveable: function (mug) {
        return this.__callOld() && !mug.p.locked && !hasLockedDescendants(mug);
    },
    isMugRemoveable: function (mug) {
        return this.__callOld() && !mug.p.locked && !hasLockedDescendants(mug);
    },
    isMugTypeChangeable: function (mug) {
        return this.__callOld() && !mug.p.locked;
    },
});

function lockedAttrsProp(mug) {
    return mug.options.isDataOnly ? 'rawDataAttributes' : 'rawBindAttributes';
}

function addLockedUneditableMessage(mug) {
    mug.addMessage('locked', {
        key: LOCKED_UNEDITABLE_MSG_KEY,
        message: gettext(
                "This question is locked and can only be edited by a user with the locked " +
                "questions permission."
            ),
        level: mug.INFO,
    });
}

function hasLockedDescendants(mug) {
    return mug.form.getChildren(mug).some(child =>
        child.p.locked || hasLockedDescendants(child)
    );
}

function hasUnlockedDescendants(mug) {
    return mug.form.getChildren(mug).some(child =>
        !child.p.locked || hasUnlockedDescendants(child)
    );
}

function propagateLockToControlOnlyChildren(mug) {
    mug.form.getChildren(mug).forEach(child => {
        if (child.options.isControlOnly) {
            child.p.set('locked', mug.p.locked);
        }
    });
}

function cascadeLockToDescendants(mug, value) {
    mug.form.getChildren(mug).forEach(child => {
        if (child.p.locked !== value) {
            child.p.locked = value;
        } else if (_.contains(GROUP_CLASSES, child.__className)) {
            cascadeLockToDescendants(child, value);
        }
    });
}

function updateAncestorTreeIcons(mug) {
    let parent = mug.parentMug;
    while (parent) {
        if (parent.p.locked && _.contains(GROUP_CLASSES, parent.__className)) {
            parent.form.vellum.setTreeExtraIcons(parent);
        }
        parent = parent.parentMug;
    }
}

function treeLockIcon(mug) {
    if (mug.options.isControlOnly) {
        return;
    }

    let iconClass = "fa-lock";
    let tooltipText = gettext("Only a user with permission can edit this question.");
    if (_.contains(GROUP_CLASSES, mug.__className)) {
        if (hasUnlockedDescendants(mug)) {
            iconClass = "fa-unlock";
            tooltipText = gettext(
                "Only a user with permission can edit this group. " +
                "Some questions are unlocked."
            );
        } else {
            tooltipText = gettext(
                "Only a user with permission can edit this group. " +
                "All questions are locked."
            );
        }
    }
    return `<i class="fa ${iconClass}" title="${tooltipText}"></i>&nbsp;`;
}
