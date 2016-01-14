define([
    'xpath',
], function (
    xpath
) {
    return {
        parser: xpath,
        models: xpath.yy.xpathmodels,
        createParser: function () {
            var ret = new xpath.Parser();
            ret.yy.xpathmodels = xpath.yy.xpathmodels;
            ret.models = ret.yy.xpathmodels;
            return ret;
        },
    };
});
