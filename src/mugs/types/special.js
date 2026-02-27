import $ from "jquery";
import util from "vellum/util";
import widgets from "vellum/widgets";
import defaultOptions from "../mugDefaultOptions";

const DataBindOnly = util.extend(defaultOptions, {
    isDataOnly: true,
    typeName: gettext('Hidden Value'),
    icon: 'fcc fcc-fd-variable',
    isTypeChangeable: false,
    spec: {
        xmlnsAttr: { presence: "optional" },
        requiredAttr: { presence: "notallowed" },
        constraintAttr: { presence : "notallowed" },
        calculateAttr: { visibility: "visible" }
    }
});

const ReadOnly = util.extend(defaultOptions, {
    writesOnlyCustomXML: true,
    writeCustomXML: function (xmlWriter, mug) {
        return xmlWriter.writeXML($('<div>').append(mug.p.rawControlXML).clone().html());
    },
    spec: {
        readOnlyControl: {
            visibility: "visible",
            widget: widgets.readOnlyControl
        }
    }
});

const Trigger = util.extend(defaultOptions, {
    typeName: gettext('Label'),
    tagName: 'trigger',
    icon: 'fa fa-tag',
    init: function (mug, form) {
        mug.p.appearance = "minimal";
    },
    changeTypeTransform: function (mug) {
        mug.p.appearance = undefined;
    },
    spec: {
        dataValue: { presence: 'optional' },
        defaultValue: { presence: 'optional', visibility: 'hidden' },
        // Delete _required_ properties if changing from non-Trigger
        // to Trigger except for DataBindOnly, which is the initial
        // question type used when loading a form before control
        // nodes are parsed. Required properties are not allowed on
        // DataBindOnly (except during initial form loading).
        requiredAttr: {
            deleteOnCopy: function (attrs, oldMugType) {
                return attrs.appearance === "minimal" || oldMugType !== "DataBindOnly";
            },
            visibility: function (mug) {
                return mug.p.appearance !== "minimal";
            },
        },
        requiredCondition: {
            deleteOnCopy: function (attrs, oldMugType) {
                return attrs.appearance === "minimal" || oldMugType !== "DataBindOnly";
            },
        },
    }
});

export {
    DataBindOnly,
    ReadOnly,
    Trigger,
};
