/**
 * This provides a robust parser for replacing hashtags with arbitrary derived
 * expressions (bubbles) as well as a light-weight delimit/transform system for
 * marking delimited ranges of text in a string that can later be transformed to
 * arbitrary derived expressions (bubbles).
 */
define([
    'underscore',
    'vellum/xpath',
], function (
    _,
    xpath,
) {
    var OUTSIDE_HASHTAG = 0,
        INSIDE_HASHTAG = 1,
        DELIMITER = "`",
        ID_CHAR = /^[\w.\-]/;

    /*
     * Escape delimiters in text
     *
     * Use to escape delimiters in an expression before escaping
     * sub-expressions with `escape`. `transform` can be used to
     * unescape the final result.
     *
     * example:
     *  expr = "{a} + {b}";
     *  subs = {a: "#form/a", b: "#form/b"};
     *  escapeDelimiters(expr).replace(/{(.*?)}/g, function (match, id) {
     *      return subs.hasOwnProperty(id) ? escape(subs[id]) : match;
     *  });  // -> "`#form/a` + `#form/b`"
     */
    function escapeDelimiters(text) {
        return text.replace(/`/g, "``");
    }

    /*
     * Wrap text with delimiters
     *
     * The given text must not contain the delimiter character.
     */
    function delimit(text) {
        if (text.indexOf(DELIMITER) !== -1) {
            throw new Error("cannot delimit: " + text);
        }
        return DELIMITER + text + DELIMITER;
    }

    /*
     * Transform delimited ranges based on transformFn
     *
     * Use to transform escaped (delimited) hashtags to bubbles in an
     * invalid xpath expression.
     *
     * transformFn -> function(input) where input will be text inside delimiters
     * and returns what you want that turned into without delimiters
     * allowRunOn -> If true, do not add extra space after transformed range
     * followed by identifier character. The default is false.
     *
     * example:
     * transform("(`#form/question` + 1", makeBubble);
     * // -> "(<bubble>question</bubble> + 1"
     */
    function transform(input, transformFn, allowRunOn) {
        if (!input) { return input; }
        var symbols = getSymbols(input);
        transformFn = transformFn || function (input) { return input; };
        var state = OUTSIDE_HASHTAG,
            strLen = symbols.length,
            text = "",
            currentReference = "";

        for (var i = 0; i < strLen; i++) {
            var current = symbols[i],
                next = symbols[i + 1];

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
                    if (!allowRunOn && next && ID_CHAR.test(next)) {
                        text += " ";
                    }
                    currentReference = "";
                } else if (next !== undefined) {
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
     * Get function to transform hashtags to arbitrary text
     *
     * Use to transform hashtags to bubbles in a valid xpath expression.
     *
     * example:
     * transform = makeHashtagTransform(form);
     * transform("#form/question + 1", makeBubble);
     * // -> "<bubble>question</bubble> + 1"
     */
    function makeHashtagTransform(hashtagInfo) {
        function decorateHashtagger(tagger) {
            var super_toHashtag = tagger.toHashtag;
            tagger.toHashtag = function (xpath_) {
                var expr = super_toHashtag(xpath_);
                return expr === null ? null : decorateHashtag(expr);
            };
            return tagger;
        }
        var escapingModels = xpath.makeXPathModels(hashtagInfo, decorateHashtagger),
            escapingParser = xpath.createParser(escapingModels),
            baseHashtagExpr = escapingModels.HashtagExpr,
            decorateHashtag = _.identity;

        escapingModels.HashtagExpr = function (definition) {
            baseHashtagExpr.call(this, definition);
            decorateHashtagger(this);
            return this;
        };

        return function (xpath, transformFn) {
            decorateHashtag = transformFn;
            try {
                return escapingParser.parse(xpath).toHashtag();
            } catch (err) {
                return xpath;
            } finally {
                decorateHashtag = _.identity;
            }
        };
    }

    return {
        escapeDelimiters: escapeDelimiters,
        delimit: delimit,
        transform: transform,
        makeHashtagTransform: makeHashtagTransform,
    };
});
