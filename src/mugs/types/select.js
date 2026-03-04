import _ from "underscore";
import defaultOptions from "../defaultOptions";
import widgets from "vellum/widgets";
import util from "vellum/util";

var Choice = util.extend(defaultOptions, {
    isControlOnly: true,
    typeName: gettext('Choice'),
    tagName: 'item',
    icon: 'fcc fcc-fd-single-circle',
    isTypeChangeable: false,
    canOutputValue: false,
    getIcon: function (mug) {
        if (mug.parentMug.__className === "Select") {
            return 'fcc fcc-fd-single-circle';
        } else {
            return 'fcc fcc-fd-multi-box';
        }
    },
    writeControlHint: false,
    writeControlHelp: false,
    writeControlAlert: false,
    writeControlRefAttr: null,
    writeCustomXML: function (xmlWriter, mug) {
        var value = mug.p.nodeID;
        if (value) {
            xmlWriter.writeStartElement('value');
            xmlWriter.writeString(value);
            xmlWriter.writeEndElement();
        }
    },
    init: function (mug, form) {
    },
    spec: {
        nodeID: {
            lstring: gettext('Choice Value'),
            visibility: 'visible',
            presence: 'required',
            widget: widgets.identifier,
            setter: null,
            validationFunc: function (mug) {
                if (/\s/.test(mug.p.nodeID)) {
                    return gettext("Whitespace in values is not allowed.");
                }
                if (mug.parentMug) {
                    var siblings = mug.form.getChildren(mug.parentMug),
                        dup = _.any(siblings, function(ele) {
                            return ele !== mug && ele.p.nodeID === mug.p.nodeID;
                        });
                    if (dup) {
                        return gettext("This choice value has been used in the same question");
                    }
                }
                return "pass";
            },
            serialize: function (value, key, mug, data) {
                var path = mug.parentMug.absolutePathNoRoot;
                data.id = path + "/" + value;
            },
            deserialize: function (data) {
                return data.id && data.id.slice(data.id.lastIndexOf("/") + 1);
            }
        },
        labelItext: { presence: 'required' },
        conflictedNodeId: { presence: 'notallowed' },
        hintLabel: { presence: 'notallowed' },
        hintItext: { presence: 'notallowed' },
        helpItext: { presence: 'notallowed' },
        defaultValue: { presence: 'optional', visibility: 'hidden' },
    }
});

var BaseSelect = util.extend(defaultOptions, {
    validChildTypes: ["Choice"],
    controlNodeChildren: function ($node) {
        return $node.children().not('label, value, hint, help, alert');
    },
    typeChangeError: function (mug, typeName) {
        if (mug.form.getChildren(mug).length > 0 && !typeName.match(/^M?Select$/)) {
            return gettext("Cannot change a Multiple/Single Choice " +
                  "question to a non-Choice question if it has Choices. " +
                  "Please remove all Choices and try again.");
        }
        return '';
    },
    canAddChoices: true,
    spec: {
        appearance: {
            deleteOnCopy: false,
        }
    },
    dataType: "",
});

var MSelect = util.extend(BaseSelect, {
    typeName: gettext('Checkbox'),
    tagName: 'select',
    icon: 'fcc fcc-fd-multi-select',
    defaultOperator: "selected"
});

var Select = util.extend(BaseSelect, {
    typeName: gettext('Multiple Choice'),
    tagName: 'select1',
    icon: 'fcc fcc-fd-single-select',
    defaultOperator: null
});

export {Choice, MSelect, Select};
