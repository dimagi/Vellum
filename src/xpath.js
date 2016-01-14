define([
    'xpath',
    'xpathmodels'
], function (
    xpath,
    makeXPathModels
) {
    var hashtagToXPath = {},
        xpathmodels = makeXPathModels({
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

                if (xpath_ instanceof xpathmodels.HashtagExpr) {
                    return xpath_.toHashtag();
                }
                return toHashtag(xpath_.toXPath());
            }
        });

    xpath.setXPathModels(xpathmodels);

    return {
        parser: xpath,
        models: xpathmodels,
        setHashtagToXPathDict: function (translationDict) {
            hashtagToXPath = translationDict;
        },
        addHashtag: function(hashtag, xpath) {
            hashtagToXPath[hashtag] = xpath;
        },
        removeHashtag: function(hashtag) {
            delete hashtagToXPath[hashtag];
        },
        normalizeHashtag: function (xpath_) {
            // try catch is needed as workaround for having an itemset without
            // the itemset plugin enabled
            try {
                return xpath_ ? xpath.parse(xpath_).toHashtag() : xpath_;
            } catch (err) {
                return xpath_;
            }
        },
    };
});
