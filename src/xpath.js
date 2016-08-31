define([
    'underscore',
    'xpath',
], function (
    _,
    xpath
) {
    return {
        // hashtagInfo properties:
        //   hashtagMap: {hashtag expression: XPath expression}
        //   hashtagTransformations: {hashtag prefix: function to return property}
        // NOTE hashtagInfo is not the same as hashtagConfig passed to
        // `xpath.makeXPathModels(hashtagConfig)`
        makeXPathModels: function (hashtagInfo) {
            return xpath.makeXPathModels({
                isValidNamespace: function (namespace) {
                    return namespace === 'form' || namespace === 'case';
                },
                hashtagToXPath: function (hashtagExpr) {
                    if (hashtagInfo.hashtagMap.hasOwnProperty(hashtagExpr)) {
                        return hashtagInfo.hashtagMap[hashtagExpr];
                    }

                    // If full hashtag isn't recognized, remove the property name and check
                    // if this is a recognizable type, just with a property we haven't heard of
                    var lastSlashIndex = hashtagExpr.lastIndexOf("/");
                    if (lastSlashIndex !== -1) {
                        var prefix = hashtagExpr.substring(0, lastSlashIndex + 1),
                            property = hashtagExpr.substring(lastSlashIndex + 1);
                        if (hashtagInfo.hashtagTransformations.hasOwnProperty(prefix)) {
                            return hashtagInfo.hashtagTransformations[prefix](property);
                        }
                    }
                    return hashtagExpr;
                },
                toHashtag: function (xpath_) {
                    function toHashtag(xpathExpr) {
                        for (var key in hashtagInfo.hashtagMap) {
                            if (hashtagInfo.hashtagMap.hasOwnProperty(key)) {
                                if (hashtagInfo.hashtagMap[key] === xpathExpr)
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
