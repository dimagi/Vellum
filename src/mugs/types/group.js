import $ from "jquery";
import _ from "underscore";
import Tree from "vellum/tree";
import util from "vellum/util";
import widgets from "vellum/widgets";
import defaultOptions from "../mugDefaultOptions";

const Group = util.extend(defaultOptions, {
    typeName: gettext('Group'),
    tagName: 'group',
    icon: 'fa fa-folder-open',
    isSpecialGroup: true,
    isNestableGroup: true,
    isTypeChangeable: false,
    possibleDataParent: true,
    canOutputValue: false,
    controlNodeChildren: function ($node) {
        return $node.children().not('label, value, hint, help, alert');
    },
    init: function (mug, form) {
    },
    spec: {
        hintLabel: { presence: "notallowed" },
        hintItext: { presence: "notallowed" },
        helpItext: { presence: "notallowed" },
        calculateAttr: { presence: "notallowed" },
        constraintAttr: { presence: "notallowed" },
        constraintMsgAttr: { presence: "notallowed" },
        dataValue: { presence: "notallowed" },
        requiredAttr: { presence: "notallowed" },
        defaultValue: { presence: 'optional', visibility: 'hidden' },
    }
});

// This is just a group, but appearance = 'field-list' displays it as a list
// of grouped questions.  It's a separate question type because it can't
// nest other group types and it has a very different end-user functionality
const FieldList = util.extend(Group, {
    typeName: gettext('Question List'),
    icon: 'fa fa-reorder',
    init: function (mug, form) {
        Group.init(mug, form);
        mug.p.appearance = 'field-list';
    },
    changeTypeTransform: function (mug) {
        mug.p.appearance = undefined;
    },
});

const Repeat = util.extend(Group, {
    typeName: gettext('Repeat Group'),
    icon: 'fa fa-retweet',
    possibleDataParent: 'limited',
    controlNodeChildren: function ($node) {
        var repeatChildren = $node.children('repeat').children();
        return repeatChildren.not('jr\\:addEmptyCaption, jr\\:addCaption');
    },
    getExtraDataAttributes: function (mug) {
        return {"jr:template": ""};
    },
    controlChildFilter: function (children, mug) {
        var hashtag = mug.hashtagPath,
            r_count = mug.p.repeat_count,
            attrs = _.object(_.filter(_.map(mug.p.rawRepeatAttributes, function (val, key) {
                return key.toLowerCase() !== "jr:noaddremove" ? [key, val] : null;
            }), _.identity));
        return [new Tree.Node(children, {
            getNodeID: function () {},
            getAppearanceAttribute: function () {},
            form: mug.form,
            p: {
                rawControlAttributes: attrs,
                addEmptyCaptionItext: mug.p.addEmptyCaptionItext,
                addCaptionItext: mug.p.addCaptionItext,
            },
            options: {
                tagName: 'repeat',
                writeRepeatItexts: mug.options.customRepeatButtonText,
                writeControlLabel: false,
                writeControlHint: false,
                writeControlHelp: false,
                writeControlAlert: false,
                writeControlRefAttr: null,
                writeCustomXML: function (xmlWriter, mug) {
                    if (r_count) {
                        util.writeHashtags(xmlWriter, 'jr:count', String(r_count));
                        xmlWriter.writeAttributeString("jr:noAddRemove", "true()");
                    }
                    util.writeHashtags(xmlWriter, 'nodeset', hashtag, mug);
                },
            }
        })];
    },
    writeControlRefAttr: null,
    init: function (mug, form) {
        mug.p.repeat_count = null;
    },
    spec: {
        repeat_count: {
            lstring: gettext('Repeat Count'),
            visibility: 'visible_if_present',
            presence: 'optional',
            widget: widgets.droppableText,
            validationFunc: function (mug) {
                function insideFieldList(mug) {
                    if (!mug) { return false; }

                    var parentMug = mug.parentMug;

                    if (parentMug && parentMug.__className === 'FieldList') {
                        return true;
                    }

                    return insideFieldList(parentMug);
                }

                if (!$.trim(mug.p.repeat_count) && insideFieldList(mug)) {
                    return gettext("Repeat Count is required.");
                }

                return "pass";
            },
        },
        rawRepeatAttributes: {
            presence: 'optional',
            lstring: gettext("Extra Repeat Attributes"),
        }
    }
});

export {
    FieldList,
    Group,
    Repeat,
};
