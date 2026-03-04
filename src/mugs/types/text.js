import defaultOptions from "../defaultOptions";
import util from "vellum/util";

var TextField = util.extend(defaultOptions, {
    typeName: gettext("Text"),
    dataType: "xsd:string",
    icon: "fcc fcc-fd-text",
    init: function (mug, form) {
    }
});

var PhoneNumber = util.extend(TextField, {
    typeName: gettext('Phone Number or Numeric ID'),
    icon: 'fa fa-signal',
    init: function (mug, form) {
        TextField.init(mug, form);
        mug.p.appearance = "numeric";
    },
    changeTypeTransform: function (mug) {
        mug.p.appearance = undefined;
    },
});

var Secret = util.extend(defaultOptions, {
    typeName: gettext('Password'),
    dataType: 'xsd:string',
    tagName: 'secret',
    icon: 'fa fa-key',
    canOutputValue: false,
    init: function (mug, form) {
    }
});

export {TextField, PhoneNumber, Secret};
