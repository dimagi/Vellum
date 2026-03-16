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
            const matching = {};
            incoming[key].forEach(item => {
                const num = countExactMataches(item, baseline[key], incoming[key], matching);
                if (num === null || num > 0) {
                    push(key, item, additions);
                } else if (num < 0) {
                    push(key, item, deletions);
                }
            });
            baseline[key].forEach(item => {
                const num = countExactMataches(item, baseline[key], incoming[key], matching);
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

function countExactMataches(item, baseline, incoming, cache) {
    // Returns null if there are no other exact matches.
    // Returns a positive number if incoming has more exact matches.
    // Returns a negative number if baseline has more exact matches.
    // If not null, the difference is moved toward zero and cached each
    // time this function is called. Once cached, the cached difference
    // (which remains zero once zero) is returned.
    const key = Object.keys(item).sort().map(k => `${k}=${item[k]}`).join(' ');
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
