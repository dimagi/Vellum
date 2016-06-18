define([
    'xpath',
], function (
    xpath
) {
    return {
        makeXPathModels: function (hashtagToXPath, hashtagToTransformation) {
            return xpath.makeXPathModels({
                isValidNamespace: function (namespace) {
                    return namespace === 'form' || namespace === 'case';
                },
                hashtagToXPath: function (hashtagExpr) {
                    if (hashtagToXPath.hasOwnProperty(hashtagExpr)) {
                        return hashtagToXPath[hashtagExpr];
                    }

                    // If full hashtag isn't recognized, remove the property name and check
                    // if this is a recognizable type, just with a property we haven't heard of
                    var lastSlashIndex = hashtagExpr.lastIndexOf("/");
                    if (lastSlashIndex !== -1) {
                        var prefix = hashtagExpr.substring(0, lastSlashIndex + 1),
                            property = hashtagExpr.substring(lastSlashIndex + 1);
                        if (hashtagToTransformation.hasOwnProperty(prefix)) {
                            return hashtagToTransformation[prefix](property);
                        }
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
