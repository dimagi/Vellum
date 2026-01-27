define([
    'jquery'
], function (
    $
) {
    'use strict';

    function compareCaseMappings (baseline, incoming) {
        // Case mappings are a dictionary linking a case property to a
        // list of questions that populate it. This function compares
        // the original with the incoming mappings to produce a diff.
        const additions = {};
        const deletions = {};
        const updates = {};
        const allKeys = new Set([...Object.keys(baseline), ...Object.keys(incoming)]);

        allKeys.forEach(key => {
            if (Object.hasOwn(baseline, key) && Object.hasOwn(incoming, key)) {
                incoming[key].forEach(update => {
                    const baselineMatch = baseline[key].find(
                        original => update.question_path === original.question_path);
                    if (!baselineMatch) {
                        additions[key] = additions[key] || [];
                        additions[key].push(update);
                    } else if (baselineMatch.update_mode !== update.update_mode) {
                        updates[key] = updates[key] || [];
                        updates[key].push(update);
                    }
                });
                baseline[key].forEach(original => {
                    if (!incoming[key].find(update => update.question_path === original.question_path)) {
                        deletions[key] = deletions[key] || [];
                        deletions[key].push(original);
                    }
                });
            } else if (Object.hasOwn(incoming, key)) {  // not in baseline
                incoming[key].forEach(update => {
                    additions[key] = additions[key] || [];
                    additions[key].push(update);
                });
            } else {  // key in baseline, not in incoming
                baseline[key].forEach(update => {
                    deletions[key] = deletions[key] || [];
                    deletions[key].push(update);
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

    return {
        compareCaseMappings,
    };
});