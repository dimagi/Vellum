import defaultOptions from "../defaultOptions";
import util from "vellum/util";

var Int = util.extend(defaultOptions, {
    typeName: gettext('Integer'),
    dataType: 'xsd:int',
    icon: 'fcc fcc-fd-numeric',
    init: function (mug, form) {
    }
});

// Deprecated. Users may not add new longs to forms,
// but must be able to view forms already containing longs.
var Long = util.extend(Int, {
    typeName: gettext('Long'),
    dataType: 'xsd:long',
    icon: 'fcc fcc-fd-long',
    init: function (mug, form) {
    }
});

var Double = util.extend(Int, {
    typeName: gettext('Decimal'),
    dataType: 'xsd:double',
    icon: 'fcc fcc-fd-decimal',
    init: function (mug, form) {
    }
});

export {Int, Long, Double};
