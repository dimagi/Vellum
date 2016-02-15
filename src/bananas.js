define([
    'vellum/xpath',
], function(
    xpath
) {
    var OUTSIDE_BANANA = 0,
        INSIDE_BANANA = 1,
        DELIMITER = "🍌",
        defaultParser = xpath.createParser(xpath.makeXPathModels({}));

    function toXPath(input, xpathParser) {
        xpathParser = xpathParser || defaultParser;
        return transform(input, function(input) {
            return xpathParser.parse(input).toXPath();
        });
    }

    function toBanana(input, xpathParser) {
        if (!input) { return input; }
        xpathParser = xpathParser || defaultParser;

        var parsedBanana = transform(input);

        try {
            // we should really only accept bananas, but if they supply a nice
            // looking xpath. let's turn them into pretty bananas
            var parsed = xpathParser.parse(parsedBanana);
            // success! now let's turn that input into bananas
            parsed = xpathParser.parse(parsed.toHashtag());
            return transformHashtags(parsed, xpathParser.models, function(input) {
                return DELIMITER + input + DELIMITER;
            });
        } catch (err) {
            // a bad xpath. let's just return the given input
            return input;
        }
    }

    function transformHashtags(parsedHashtags, models, transformFn) {
        var queue = [parsedHashtags],
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
                    var oldToHashtag = node.toHashtag();
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
        return parsedHashtags.toHashtag();
    }

    function transform(input, transformFn) {
        if (!input) { return input; }
        input = getSymbols(input);
        transformFn = transformFn || function (input) { return input; };
        var state = OUTSIDE_BANANA,
            strLen = input.length,
            text = "",
            currentReference = "";

        for (var i = 0; i < strLen; i++) {
            var current = input[i],
                next = input[i+1];

            if (state === OUTSIDE_BANANA) {
                if (current === DELIMITER && next === DELIMITER) {
                    text += DELIMITER;
                    i++;
                } else if (current === DELIMITER) {
                    state = INSIDE_BANANA;
                } else {
                    text += current;
                }
            } else if (state === INSIDE_BANANA) {
                if (current === DELIMITER && next === DELIMITER) {
                    currentReference += DELIMITER;
                    i++;
                } else if (current === DELIMITER) {
                    state = OUTSIDE_BANANA;
                    text += transformFn(currentReference);
                    currentReference = "";
                } else if (next !== undefined){
                    currentReference += current;
                } else {
                    // end of string, shouldn't happen, but will not
                    // overestimate users or Vellum devs
                    text += DELIMITER + currentReference;
                    currentReference = "";
                }
            }
        }

        return text;
    }

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

    function Parser(hashtagDictionary) {
        var xpathParser = xpath.createParser(xpath.makeXPathModels(hashtagDictionary));
        return {
            parse: function (input) {
                var parsed = xpathParser.parse(toXPath(input, xpathParser));
                parsed.toBanana = function() {
                    return toBanana(input, xpathParser);
                };
                return parsed;
            },
            models: xpathParser.models,
        };
    }

    return {
        toBanana: toBanana,
        toXPath: toXPath,
        transform: transform,
        Parser: Parser,
    };
});
