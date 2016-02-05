define([], function() {
    var OUTSIDE_BANANA = 0,
        INSIDE_BANANA = 1,
        DELIMITER = "🍌";

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

    function parse(input, transform) {
        input = getSymbols(input);
        transform = transform || function (input) { return input; };

        var state = OUTSIDE_BANANA,
            strLen = input.length,
            text = "",
            references = [],
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
                    references.push(currentReference);
                    text += transform(currentReference);
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

        return {
            text: text,
            references: references,
        };
    }

    return parse;
});
