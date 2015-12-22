define([
    'xpath',
    'xpathmodels'
], function (
    xpath,
    makeXPathModels
) {
    var models = makeXPathModels();
    window.xpathmodels = models;  // the xpath module uses this global
    xpath.models = models;
    return xpath;
});
