define([], function () {
    function workflow(message) {
        if (window.analytics) {
            window.analytics.workflow(message);
        }
    }

    function usage(label, group, message) {
        hqImport('analytics/js/google').track.event(label, group, message);
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
