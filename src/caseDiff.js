import _ from "underscore";

export function compareCaseMappings (baseline, incoming) {
    // Case mappings are a dictionary linking a case property to a
    // list of questions that populate it. This function compares
    // the original with the incoming mappings to produce a diff.
    const additions = {};
    const deletions = {};
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(incoming)]);

    allKeys.forEach(key => {
        if (Object.hasOwn(baseline, key) && Object.hasOwn(incoming, key)) {
            const cache = {};
            incoming[key].forEach(item => {
                const num = countExactMatches(item, baseline[key], incoming[key], cache);
                if (num === null || num > 0) {
                    push(key, item, additions);
                } else if (num < 0) {
                    push(key, item, deletions);
                }
            });
            baseline[key].forEach(item => {
                const num = countExactMatches(item, baseline[key], incoming[key], cache);
                if (num === null || num < 0) {
                    push(key, item, deletions);
                }
            });
        } else if (Object.hasOwn(incoming, key)) {  // not in baseline
            incoming[key].forEach(item => {
                push(key, item, additions);
            });
        } else {  // key in baseline, not in incoming
            baseline[key].forEach(item => {
                push(key, item, deletions);
            });
        }
    });

    const diff = {};
    if (Object.keys(additions).length) {
        diff.add = additions;
    }
    if (Object.keys(deletions).length) {
        diff.delete = deletions;
    }
    return diff;
}

function push(key, item, mapping) {
    mapping[key] = mapping[key] || [];
    mapping[key].push(item);
}

/**
 * Count exact matches of item in baseline and incoming
 *
 * Returns null if there are no other exact matches.
 * Returns a positive number if incoming has more exact matches.
 * Returns a negative number if baseline has more exact matches.
 * If not null, the difference is moved toward zero and cached each
 * time this function is called. Once cached, the cached difference
 * (which remains zero once zero) is returned.
 */
function countExactMatches(item, baseline, incoming, cache) {
    const key = Object.keys(item)
        .sort()
        .map(k => {
            const v = item[k];
            return `${k}:${typeof v}=${String(v)}`;
        })
        .join(' ');
    let num = cache[key];
    if (num === undefined) {
        const nBaseline = baseline.filter(q => _.isEqual(q, item)).length;
        const nIncoming = incoming.filter(q => _.isEqual(q, item)).length;
        if (nIncoming + nBaseline === 1) {
            cache[key] = null;
            return null;
        }
        num = cache[key] = nIncoming - nBaseline;
    } else if (num === null) {
        return null;
    }
    if (num > 0) {
        cache[key]--;
    } else if (num < 0) {
        cache[key]++;
    }
    return num;
}

/**
 * Convert combined mapping diff to case_mapping_diff format accepted by HQ
 *
 * NOTE: the provided `diff` object may be mutated, and future mutations
 * to it or the returned object may mutually affect each other.
 *
 * Combined format: all properties grouped under 'add' and 'delete' keys:
 *   {
 *     "add": {
 *       "name": [{"question_path": ...}, ...]
 *       "case-property": [{"question_path": ...}, ...]
 *       ...
 *     },
 *     "delete": {
 *       "name": [{"question_path": ...}, ...]
 *       "case-property": [{"question_path": ...}, ...]
 *       ...
 *     },
 *   }
 *
 * Standard HQ "case_mapping_diff" format for registration forms:
 *   {
 *     "open_case": {
 *       // "name" diffs
 *       "add": [{"question_path": ...}, ...],
 *       "delete": [{"question_path": ...}, ...],
 *     },
 *     "update_case": {
 *       "add": {
 *         "case-property": [{"question_path": ...}, ...]
 *         ...
 *       },
 *       "delete": {
 *         "case-property": [{"question_path": ...}, ...]
 *         ...
 *       },
 *     },
 *   }
 * 
 * Non-registration forms do not produce an "open_case" item, and
 * instead all diffs are included under "update_case".
 *
 * @param {Object} diff Diff object created by compareCaseMappings.
 */
export function formatCaseMappingDiff(diff, is_registration_form) {
    const result = {"update_case": diff};
    if (is_registration_form) {
        result.open_case = {};
        if (diff.add?.name) {
            result.open_case.add = diff.add.name;
            delete diff.add.name;
        }
        if (diff.delete?.name) {
            result.open_case.delete = diff.delete.name;
            delete diff.delete.name;
        }
    }
    return result;
}
