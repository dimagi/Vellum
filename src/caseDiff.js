import _ from "underscore";

export function compareCaseMappings (baseline, incoming) {
    // Case mappings are a dictionary linking a case property to a
    // list of questions that populate it. This function compares
    // the original with the incoming mappings to produce a diff.
    const additions = {};
    const deletions = {};
    const updates = {};
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(incoming)]);

    allKeys.forEach(key => {
        if (Object.hasOwn(baseline, key) && Object.hasOwn(incoming, key)) {
            incoming[key].forEach(item => {
                const match = baseline[key].find(q => q.question_path === item.question_path);
                if (!match) {
                    push(key, item, additions);
                } else if (!_.isEqual(match, item)) {
                    push(key, item, updates);
                }
            });
            baseline[key].forEach(item => {
                if (!incoming[key].find(q => q.question_path === item.question_path)) {
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
    if (Object.keys(updates).length) {
        diff.update = updates;
    }
    return diff;
}

function push(key, item, mapping) {
    mapping[key] = mapping[key] || [];
    mapping[key].push(item);
}
