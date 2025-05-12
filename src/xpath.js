define([
    'underscore',
    'xpath',
], function (
    _,
    xpath,
) {
    return {
        // hashtagInfo properties:
        //   hashtagMap: {hashtag expression: XPath expression}
        //   invertedHashtagMap: {XPath expression: hashtag expression}
        //   hashtagTransformations: {hashtag prefix: function to return property}
        //   hashtagNamespaces: {namespace: true}
        // NOTE hashtagInfo is not the same as hashtagConfig passed to
        // `xpath.makeXPathModels(hashtagConfig)`
        makeXPathModels: function (hashtagInfo, configDecorator) {
            configDecorator = configDecorator || function (v) { return v; };
            return xpath.makeXPathModels(configDecorator({
                isValidNamespace: function (namespace) {
                    return Object.prototype.hasOwnProperty.call(hashtagInfo.hashtagNamespaces, namespace);
                },
                hashtagToXPath: function (hashtagExpr) {
                    var xpath_ = hashtagInfo.hashtagMap[hashtagExpr];
                    if (xpath_) {
                        return xpath_;
                    }

                    // If full hashtag isn't recognized, remove the property name and check
                    // if this is a recognizable type, just with a property we haven't heard of
                    var lastSlashIndex = hashtagExpr.lastIndexOf("/");
                    if (lastSlashIndex !== -1) {
                        var prefix = hashtagExpr.substring(0, lastSlashIndex + 1),
                            property = hashtagExpr.substring(lastSlashIndex + 1);
                        if (Object.prototype.hasOwnProperty.call(hashtagInfo.hashtagTransformations, prefix)) {
                            return hashtagInfo.hashtagTransformations[prefix](property);
                        }
                    }
                    return hashtagExpr;
                },
                toHashtag: function (xpath_) {
                    var expr = xpath_.toXPath();
                    if (Object.prototype.hasOwnProperty.call(hashtagInfo.invertedHashtagMap, expr)) {
                        return hashtagInfo.invertedHashtagMap[expr];
                    }
                    return null;
                },
            }));
        },
        createParser: function (xpathmodels) {
            var ret = new xpath.Parser();
            ret.yy.xpathmodels = xpathmodels;
            ret.models = ret.yy.xpathmodels;
            return ret;
        },
        parser: function (hashtagInfo, configDecorator) {
            var models = this.makeXPathModels(hashtagInfo, configDecorator);
            return this.createParser(models);
        },
    };
});
