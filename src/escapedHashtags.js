/**
 * This provides a robust parser for xpaths, hashtags, and escaped hashtags.
 *
 * XPaths are valid XPaths: /data/text = /data/text2
 * Hashtags are valid XPaths with hasthags: #form/text = #form/text2
 * Escaped hashtags are hashtags but any hashtags are escaped by `: `#form/text` = `#form/text`
 *
 * If an xpath is invalid it will be written as: #invalid/xpath (`#form/text`
 *
 * Reasoning for this split:
 * Hashtags without escaping are useful for showing to users and hand editing
 *
 * Escaped hashtags are used to ensure we do not lose a bubble when copy/pasting
 * or when an expression becomes invalid.
 *
 * All expressions are stored as escaped hashtags internally and are written to
 * XML in two forms.
 *   ex: <bind vellum:calculate="#form/text" calculate="/data/text .../>
 *   The vellum namespaced attribute is the hashtag form. The non namespaced
 *   attribute is the valid xform syntax.
 *
 * When a user saves an invalid xpath we save it as:
 *   <bind vellum:calculate="#invalid/xpath (`#form/text`" .../>
 *
 * TODO: only use escaped hashtag form internally for invalid xpaths
 */
define([
    'underscore',
    'vellum/xpath',
], function(
    _,
    xpath
) {
    var OUTSIDE_HASHTAG = 0,
        INSIDE_HASHTAG = 1,
        DELIMITER = "`",
        ID_CHAR = /^[\w.-]/;

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
                if (current === DELIMITER) {
                    state = OUTSIDE_HASHTAG;
                    text += transformFn(currentReference);
                    if (next && ID_CHAR.test(next)) {
                        text += " ";
                    }
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
    function parser(hashtagInfo) {
        function decorateHashtagger(tagger) {
            var super_toHashtag = tagger.toHashtag;
            tagger.toHashtag = function (xpath_) {
                var expr = super_toHashtag(xpath_);
                if (expr !== null) {
                    expr = DELIMITER + expr + DELIMITER;
                }
                return expr;
            };
            return tagger;
        }
        var xpathParser = xpath.createParser(xpath.makeXPathModels(hashtagInfo)),
            escapingModels = xpath.makeXPathModels(hashtagInfo, decorateHashtagger),
            escapingParser = xpath.createParser(escapingModels),
            baseHashtagExpr = escapingModels.HashtagExpr;

        escapingModels.HashtagExpr = function (definition) {
            baseHashtagExpr.call(this, definition);
            decorateHashtagger(this);
            return this;
        };

        return {
            parse: function (input) {
                if (input.startsWith("#invalid/xpath ")) {
                    throw new Error("Invalid XPath");
                }
                // TODO eliminate transform(input) here; should not be needed.
                // transform should only be applied to data that is known to be
                // escaped instead of every expression before parsing.
                var parsed = xpathParser.parse(transform(input));
                parsed.toEscapedHashtag = function() {
                    var expr = this.toHashtag();
                    if (!expr) { return expr; }
                    try {
                        return escapingParser.parse(expr).toHashtag();
                    } catch (err) {
                        // a bad xpath. let's just return the given expr
                        return expr;
                    }
                };
                return parsed;
            },
            models: xpathParser.models,
        };
    }

    return {
        transform: transform,
        parser: parser,
    };
});
