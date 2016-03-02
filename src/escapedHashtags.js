define([
    'vellum/xpath',
], function(
    xpath
) {
    var OUTSIDE_HASHTAG = 0,
        INSIDE_HASHTAG = 1,
        DELIMITER = "`",
        defaultParser = xpath.createParser(xpath.makeXPathModels({}));

    function toXPath(input, xpathParser) {
        xpathParser = xpathParser || defaultParser;
        return transform(input, function(input) {
            return xpathParser.parse(input).toXPath();
        });
    }

    function toHashtag(input, xpathParser) {
        xpathParser = xpathParser || defaultParser;
        return transform(input, function(input) {
            return xpathParser.parse(input).toHashtag();
        });
    }

    /*
     * hopefully robust parser that transforms any input (whether hashtag,
     * xpath, or escaped hashtag) into escaped hashtag used by internal structures
     */
    function toEscapedHashtag(input, xpathParser) {
        if (!input) { return input; }
        xpathParser = xpathParser || defaultParser;

        var hashtag = transform(input);

        try {
            var parsed = xpathParser.parse(hashtag);
            parsed = xpathParser.parse(parsed.toHashtag());
            return transformHashtags(parsed, xpathParser.models, function(input) {
                return DELIMITER + input + DELIMITER;
            });
        } catch (err) {
            // a bad xpath. let's just return the given input
            return input;
        }
    }

    /*
     * This takes in a parsed object (from xpathParser.parse) and transforms
     * each hashtag into whatever is defined by transformFn
     */
    function transformHashtags(parsed, models, transformFn) {
        var queue = [parsed],
            EXPR = models.XPathInitialContextEnum.EXPR,
            node, i, children, j, predicates;
        while (queue.length > 0) {
            node = queue.shift();
            if (node instanceof models.XPathPathExpr) {
                if (node.initial_context === EXPR) {
                    queue.push(node.filter.expr);
                    predicates = node.filter.predicates;
                    for (i = 0; i < predicates.length; i++) {
                        queue.push(predicates[i]);
                    }
                }
            } else if (node instanceof models.HashtagExpr) {
                (function() {
                    var oldToHashtag = node.toHashtag;
                    node.toHashtag = function() {
                        return transformFn(oldToHashtag());
                    };
                })();
            }
            children = node.getChildren();
            for (i = 0; i < children.length; i++) {
                queue.push(children[i]);
                if (children[i].predicates && children[i].predicates.length) {
                    predicates = children[i].predicates;
                    for (j = 0; j < predicates.length; j++) {
                        queue.push(predicates[j]);
                    }
                }
            }
        }
        return parsed.toHashtag();
    }

    /*
     * transforms escaped hashtags based on transformFn
     * 
     * transformFn -> function(input) where input will be text inside delimiters
     * and returns what you want that turned into without delimiters
     *
     * example:
     * transform("`#form/question`", makeBubble) -> "<bubble>#form</bubble>"
     */
    function transform(input, transformFn) {
        if (!input) { return input; }
        var symbols = getSymbols(input);
        transformFn = transformFn || function (input) { return input; };
        var state = OUTSIDE_HASHTAG,
            strLen = symbols.length,
            text = "",
            currentReference = "";

        for (var i = 0; i < strLen; i++) {
            var current = symbols[i],
                next = symbols[i+1];

            if (state === OUTSIDE_HASHTAG) {
                if (current === DELIMITER && next === DELIMITER) {
                    text += DELIMITER;
                    i++;
                } else if (current === DELIMITER) {
                    state = INSIDE_HASHTAG;
                } else {
                    text += current;
                }
            } else if (state === INSIDE_HASHTAG) {
                if (current === DELIMITER && next === DELIMITER) {
                    currentReference += DELIMITER;
                    i++;
                } else if (current === DELIMITER) {
                    state = OUTSIDE_HASHTAG;
                    text += transformFn(currentReference);
                    currentReference = "";
                } else if (next !== undefined){
                    currentReference += current;
                }
            }
        }

        if (state === INSIDE_HASHTAG) {
            // end of string, shouldn't happen, but will not
            // overestimate users or Vellum devs
            text += DELIMITER + currentReference;
        }

        return text;
    }

    // handle 4 byte unicode properly. pulled from
    // https://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols
    function getSymbols(string) {
        var index = 0;
        var length = string.length;
        var output = [];
        for (; index < length - 1; ++index) {
            var charCode = string.charCodeAt(index);
            if (charCode >= 0xD800 && charCode <= 0xDBFF) {
                charCode = string.charCodeAt(index + 1);
                if (charCode >= 0xDC00 && charCode <= 0xDFFF) {
                    output.push(string.slice(index, index + 2));
                    ++index;
                    continue;
                }
            }
            output.push(string.charAt(index));
        }
        output.push(string.charAt(index));
        return output;
    }

    /*
     * extends xpath parser to be aware of escaped hashtags
     */
    function Parser(hashtagDictionary) {
        var xpathParser = xpath.createParser(xpath.makeXPathModels(hashtagDictionary));
        return {
            parse: function (input) {
                if (input.startsWith("#invalid/xpath ")) {
                    throw new Error("Invalid XPath");
                }
                var parsed = xpathParser.parse(toHashtag(input, xpathParser));
                parsed.toEscapedHashtag = function() {
                    return toEscapedHashtag(this.toHashtag(), xpathParser);
                };
                return parsed;
            },
            models: xpathParser.models,
        };
    }

    return {
        toEscapedHashtag: toEscapedHashtag,
        toXPath: toXPath,
        transform: transform,
        Parser: Parser,
    };
});
