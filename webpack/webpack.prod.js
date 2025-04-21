const path = require("path");
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'production',
    externals: {
        // Necessary for $.vellum to work
        jquery: 'window.jQuery',

        // Necessary for jquery-extensions to have proper access to $.fn.popover.Constructor
        "jquery.bootstrap": 'window.jQuery',

        // Necessary to allow HQ to override hqAnalytics
        "vellum/hqAnalytics": "require('vellum/hqAnalytics')",
    },
});
