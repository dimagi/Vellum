define([], function () {
    function workflow(message) {
        if (hqImport !== undefined) {
            hqImport('analytics/js/kissmetrics').track.event(message);
        }
    }

    function usage(label, group, message) {
        if (hqImport !== undefined) {
            hqImport('analytics/js/google').track.event(label, group, message);
        }
    }

    function fbUsage(group, message) {
        usage("Form Builder", group, message);
    }

    return {
        fbUsage: fbUsage,
        usage: usage,
        workflow: workflow,
    };
});
