define([
    'jquery'
], function (
    $
) {
    'use strict';

    function compareCaseMappings (baseline, incoming) {
        // case mappings are a dictionary linking a case property
        // to a list of questions which populate it.
        // This function compares the original with the incoming mappings
        // to produce a diff object

        const additions = {};
        const deletions = {};
        const updates = {};

        const allKeys = new Set([...Object.keys(baseline), ...Object.keys(incoming)]);


        allKeys.forEach(key => {
            // If the question is part of the incoming updates, then it is either an addition or an update
            if (!(key in baseline)) {
                incoming[key].forEach(update => {
                    additions[key] = additions[key] || [];
                    additions[key].push(update);
                });
            } else if (key in incoming) {
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
            }

            // If the question is missing from the incoming updates, then it is a deletion
            if (!(key in incoming)) {
                baseline[key].forEach(update => {
                    deletions[key] = deletions[key] || [];
                    deletions[key].push(update);
                });
            } else if (key in baseline) {
                baseline[key].forEach(original => {
                    if (!incoming[key].find(update => update.question_path === original.question_path)) {
                        deletions[key] = deletions[key] || [];
                        deletions[key].push(original);
                    }
                });
            }
        });

        let diff = {};
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