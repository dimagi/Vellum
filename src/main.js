if (!window.gettext) {
    window.gettext = function (arg) { return arg; };
    window.ngettext = function (singular, plural, count) {
        return count === 1 ? singular : plural;
    };
}

define([
    'vellum/core',
    'vellum/ignoreButRetain',
    'vellum/intentManager',
    'vellum/itemset',
    'vellum/javaRosa/plugin',
    'vellum/datasources',
    'vellum/lock',
    'vellum/databrowser',
    'vellum/commtrack',
    'vellum/modeliteration',
    'vellum/saveToCase',
    'vellum/uploader',
    'vellum/window',
    'vellum/copy-paste',
    'vellum/commander',
    'vellum/commcareConnect',
    'vellum/jqueryCleanup',
], function () {
    // adds $.vellum as a side-effect
});
