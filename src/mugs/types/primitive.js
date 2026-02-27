import util from "vellum/util";
import defaultOptions from "../mugDefaultOptions";

const TextField = util.extend(defaultOptions, {
    typeName: gettext("Text"),
    dataType: "xsd:string",
    icon: "fcc fcc-fd-text",
    init: function (mug, form) {
    }
});

const PhoneNumber = util.extend(TextField, {
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

const Secret = util.extend(defaultOptions, {
    typeName: gettext('Password'),
    dataType: 'xsd:string',
    tagName: 'secret',
    icon: 'fa fa-key',
    canOutputValue: false,
    init: function (mug, form) {
    }
});

const Int = util.extend(defaultOptions, {
    typeName: gettext('Integer'),
    dataType: 'xsd:int',
    icon: 'fcc fcc-fd-numeric',
    init: function (mug, form) {
    }
});

const Geopoint = util.extend(defaultOptions, {
    typeName: gettext('GPS'),
    dataType: 'geopoint',
    icon: 'fa-solid fa-location-dot',
    init: function (mug, form) {
    }
});

const Barcode = util.extend(defaultOptions, {
    typeName: gettext('Barcode Scan'),
    dataType: 'barcode',
    icon: 'fa fa-barcode',
    init: function (mug, form) {
    }
});

const DateField = util.extend(defaultOptions, {
    typeName: gettext('Date'),
    dataType: 'xsd:date',
    icon: 'fa-solid fa-calendar-days',
    init: function (mug, form) {
    }
});

const DateTime = util.extend(defaultOptions, {
    typeName: gettext('Date and Time'),
    dataType: 'xsd:dateTime',
    icon: 'fcc fcc-fd-datetime',
    init: function (mug, form) {
    }
});

const Time = util.extend(defaultOptions, {
    typeName: gettext('Time'),
    dataType: 'xsd:time',
    icon: 'fa-regular fa-clock',
    init: function (mug, form) {
    }
});

// Deprecated. Users may not add new longs to forms,
// but must be able to view forms already containing longs.
const Long = util.extend(Int, {
    typeName: gettext('Long'),
    dataType: 'xsd:long',
    icon: 'fcc fcc-fd-long',
    init: function (mug, form) {
    }
});

const Double = util.extend(Int, {
    typeName: gettext('Decimal'),
    dataType: 'xsd:double',
    icon: 'fcc fcc-fd-decimal',
    init: function (mug, form) {
    }
});

export {
    Barcode,
    DateField,
    DateTime,
    Double,
    Geopoint,
    Int,
    Long,
    PhoneNumber,
    Secret,
    TextField,
    Time,
};
