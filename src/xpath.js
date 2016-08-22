define([
    'xpath',
], function (
    xpath
) {
    return {
        makeXPathModels: function (form) {
            return xpath.makeXPathModels({
                isValidNamespace: function (namespace) {
                    return namespace === 'form' || namespace === 'case';
                },
                hashtagToXPath: function (hashtagExpr) {
                    if (form.hashtagDictionary.hasOwnProperty(hashtagExpr)) {
                        return form.hashtagDictionary[hashtagExpr];
                    }

                    // If full hashtag isn't recognized, remove the property name and check
                    // if this is a recognizable type, just with a property we haven't heard of
                    var lastSlashIndex = hashtagExpr.lastIndexOf("/");
                    if (lastSlashIndex !== -1) {
                        var prefix = hashtagExpr.substring(0, lastSlashIndex + 1),
                            property = hashtagExpr.substring(lastSlashIndex + 1);
                        if (form.hashtagTransformations.hasOwnProperty(prefix)) {
                            return form.hashtagTransformations[prefix](property);
                        }
                    }
                    return hashtagExpr;
                },
                toHashtag: function (xpath_) {
                    function toHashtag(xpathExpr) {
                        for (var key in form.hashtagDictionary) {
                            if (form.hashtagDictionary.hasOwnProperty(key)) {
                                if (form.hashtagDictionary[key] === xpathExpr)
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
