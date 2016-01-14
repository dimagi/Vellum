define([
    'xpath',
    'xpathmodels'
], function (
    xpath,
    makeXPathModels
) {
    return {
        parser: xpath,
        models: xpath.yy.xpathmodels,
    };
});
