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
                    additions[key] = additions[key] || [];
                    additions[key].push(item);
                } else if (match.update_mode !== item.update_mode) {
                    updates[key] = updates[key] || [];
                    updates[key].push(item);
                }
            });
            baseline[key].forEach(item => {
                if (!incoming[key].find(q => q.question_path === item.question_path)) {
                    deletions[key] = deletions[key] || [];
                    deletions[key].push(item);
                }
            });
        } else if (Object.hasOwn(incoming, key)) {  // not in baseline
            incoming[key].forEach(item => {
                additions[key] = additions[key] || [];
                additions[key].push(item);
            });
        } else {  // key in baseline, not in incoming
            baseline[key].forEach(item => {
                deletions[key] = deletions[key] || [];
                deletions[key].push(item);
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
