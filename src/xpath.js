define([
    'xpath',
], function (
    xpath
) {
    return {
        // hashtagConfig has two properties:
        //   hashtagDictionary: {hashtag expression: XPath expression}
        //   hashtagTransformations: {hashtag prefix: function to return property}
        makeXPathModels: function (hashtagConfig) {
            return xpath.makeXPathModels({
                isValidNamespace: function (namespace) {
                    return namespace === 'form' || namespace === 'case';
                },
                hashtagToXPath: function (hashtagExpr) {
                    if (hashtagConfig.hashtagDictionary.hasOwnProperty(hashtagExpr)) {
                        return hashtagConfig.hashtagDictionary[hashtagExpr];
                    }

                    // If full hashtag isn't recognized, remove the property name and check
                    // if this is a recognizable type, just with a property we haven't heard of
                    var lastSlashIndex = hashtagExpr.lastIndexOf("/");
                    if (lastSlashIndex !== -1) {
                        var prefix = hashtagExpr.substring(0, lastSlashIndex + 1),
                            property = hashtagExpr.substring(lastSlashIndex + 1);
                        if (hashtagConfig.hashtagTransformations.hasOwnProperty(prefix)) {
                            return hashtagConfig.hashtagTransformations[prefix](property);
                        }
                    }
                    return hashtagExpr;
                },
                toHashtag: function (xpath_) {
                    function toHashtag(xpathExpr) {
                        for (var key in hashtagConfig.hashtagDictionary) {
                            if (hashtagConfig.hashtagDictionary.hasOwnProperty(key)) {
                                if (hashtagConfig.hashtagDictionary[key] === xpathExpr)
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
