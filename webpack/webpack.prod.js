const path = require("path");
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'production',
    output: {
        clean: true,
        path: path.resolve(BASE_PATH, '_build'),
        filename: '[name].[contenthash].js',
    },
    externals: {
        // Necessary for $.vellum to work
        jquery: 'window.jQuery',

        // Necessary for jquery-extensions to have proper access to $.fn.popover.Constructor
        "jquery.bootstrap": 'window.jQuery',

        "vellum/hqAnalytics": {
            amd: 'vellum/hqAnalytics',
            commonjs: 'vellum/hqAnalytics',
        },
    },
});
