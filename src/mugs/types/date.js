import defaultOptions from "../mugDefaultOptions";
import util from "vellum/util";

var DateField = util.extend(defaultOptions, {
    typeName: gettext('Date'),
    dataType: 'xsd:date',
    icon: 'fa-solid fa-calendar-days',
    init: function (mug, form) {
    }
});

var DateTime = util.extend(defaultOptions, {
    typeName: gettext('Date and Time'),
    dataType: 'xsd:dateTime',
    icon: 'fcc fcc-fd-datetime',
    init: function (mug, form) {
    }
});

var Time = util.extend(defaultOptions, {
    typeName: gettext('Time'),
    dataType: 'xsd:time',
    icon: 'fa-regular fa-clock',
    init: function (mug, form) {
    }
});

export {DateField, DateTime, Time};
