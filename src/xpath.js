define([
    'xpath',
], function (
    xpath
) {
    return {
        makeXPathModels: function (hashtagToXPath) {
            return xpath.makeXPathModels({
                isValidNamespace: function (namespace) {
                    return namespace === 'form';
                },
                hashtagToXPath: function (hashtagExpr) {
                    if (hashtagToXPath[hashtagExpr]) {
                        return hashtagToXPath[hashtagExpr];
                    }
                    return hashtagExpr;
                },
                toHashtag: function (xpath_) {
                    function toHashtag(xpathExpr) {
                        for (var key in hashtagToXPath) {
                            if (hashtagToXPath.hasOwnProperty(key)) {
                                if (hashtagToXPath[key] === xpathExpr)
                                    return key;
                            }
                        }
                        return null;
                    }

                    return toHashtag(xpath_.toXPath());
                }
            });
        },
        createParser: function (xpathmodels) {
            var ret = new xpath.Parser();
            ret.yy.xpathmodels = xpathmodels;
            ret.models = ret.yy.xpathmodels;
            return ret;
        },
    };
});
