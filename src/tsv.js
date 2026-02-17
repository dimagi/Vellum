import _ from "underscore";

var specialChars = /[\r\n\u2028\u2029"\t]/;

/**
 * Get a function that returns the next row of tab-separated values
 * each time it is called. Returns null after last row is generated.
 */
function makeRowParser(value) {
    var simpleLine = /(.*)(?:\n|\r\n|\r|\u2028|\u2029)/mg,
        simpleField = /(.*?)(?:\t|(\n|\r\n|\r|\u2028|\u2029|$))/g,
        quotedField = /^("(?:[^"]|"")*")(?:\t|(\n|\r\n|\r|\u2028|\u2029|$))/,
        escapedQuote = /""/g,
        valueLength = value.length,
        lastIndex = 0;

    function setLastIndex(value) {
        if (value <= lastIndex) {
            // Prevent infinite row generation if somehow the last
            // index does not increase. This should never happen.
            throw new Error("last index " + lastIndex + " -> " + value);
        }
        lastIndex = value;
    }

    function next() {
        if (lastIndex >= valueLength) {
            return null;
        }
        simpleLine.lastIndex = lastIndex;
        var line = simpleLine.exec(value);
        if (line && line[1].indexOf('"') === -1) {
            setLastIndex(simpleLine.lastIndex);
            return line[1].split("\t");
        }
        return parseRow();
    }

    function parseRow() {
        var cell, qcell, row = [];
        simpleField.lastIndex = lastIndex;
        do {
            cell = simpleField.exec(value);
            if (cell[1][0] === '"') {
                // attempt to parse quoted cell
                qcell = quotedField.exec(value.slice(lastIndex));
                if (qcell && qcell[1]) {
                    cell = qcell;
                    cell[1] = cell[1].slice(1, -1).replace(escapedQuote, '"');
                    simpleField.lastIndex = lastIndex + cell[0].length;
                }
            }
            row.push(cell[1]);
            setLastIndex(simpleField.lastIndex);
        } while (lastIndex < valueLength && _.isUndefined(cell[2]));
        return row;
    }

    return next;
}

/**
 * Escape a TSV field value
 *
 * This will convert any object to a string, regardless of whether
 * the object has a nice string representation that would be
 * converted back to the original value by the parser. Null and
 * undefined values are converted to empty string.
 *
 * @param value - a field value.
 * @returns - a string, the escaped field value.
 */
function escape(value) {
    if (value === null || _.isUndefined(value)) {
        value = "";
    } else {
        value = String(value);
    }
    if (specialChars.test(value)) {
        value = '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

/**
 * Serialize an array of rows to a tab-delimited string
 *
 * Each row is expected to be an array of field values, which will
 * be converted to strings using the `escape` function.
 *
 * @param rows - an array of row arrays.
 * @returns - a string, the tab-delimited rows. One row per line.
 */
function tabDelimit(rows) {
    return _.map(rows, function (row) {
        return _.map(row, escape).join("\t");
    }).join("\n");
}

export default {
    escape: escape,
    makeRowParser: makeRowParser,
    tabDelimit: tabDelimit
};
