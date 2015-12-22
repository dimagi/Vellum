define([
    'xpath',
    'xpathmodels'
], function (
    xpath,
    makeXPathModels
) {
    /* global xpathmodels */
    /*jshint -W020 */
    xpathmodels = makeXPathModels();
    /*jshint +W020 */
    
    return {
        xpath: xpath,
        xpathmodels: xpathmodels
    };
});
