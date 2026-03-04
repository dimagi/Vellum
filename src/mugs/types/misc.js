import $ from "jquery";
import defaultOptions from "../defaultOptions";
import widgets from "vellum/widgets";
import util from "vellum/util";

var DataBindOnly = util.extend(defaultOptions, {
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

var ReadOnly = util.extend(defaultOptions, {
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

var Geopoint = util.extend(defaultOptions, {
    typeName: gettext('GPS'),
    dataType: 'geopoint',
    icon: 'fa-solid fa-location-dot',
    init: function (mug, form) {
    }
});

var Barcode = util.extend(defaultOptions, {
    typeName: gettext('Barcode Scan'),
    dataType: 'barcode',
    icon: 'fa fa-barcode',
    init: function (mug, form) {
    }
});

var Trigger = util.extend(defaultOptions, {
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

export {DataBindOnly, ReadOnly, Geopoint, Barcode, Trigger};
