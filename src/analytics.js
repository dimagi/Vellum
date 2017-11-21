define([
    'hqAnalytics',
], function (
    hqAnalytics
) {

    function workflow(message) {
        if (hqAnalytics.kissmetrics) {
            hqAnalytics.kissmetrics.track.event(message);
        }
    }

    function usage(label, group, message) {
        if (hqAnalytics.google) {
            hqAnalytics.google.track.event(label, group, message);
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
