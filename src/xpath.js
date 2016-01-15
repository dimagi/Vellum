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
        normalizeHashtag: function (xpath_, xpathParser) {
            // try catch is needed as workaround for having an itemset without
            // the itemset plugin enabled
            try {
                return xpath_ ? xpathParser.parse(xpath_).toHashtag() : xpath_;
            } catch (err) {
                return xpath_;
            }
        },
        normalizeXPath: function (xpath_, xpathParser) {
            // if it's not an xpath just return the original string
            try {
                return xpath_ ? xpathParser.parse(xpath_).toXPath() : xpath_;
            } catch (err) {
                return xpath_;
            }
        },
        createParser: function (xpathmodels) {
            var ret = new xpath.Parser();
            ret.yy.xpathmodels = xpathmodels;
            ret.models = ret.yy.xpathmodels;
            return ret;
        },
    };
});
