const path = require("path");
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'production',
    // TODO: Source maps are incorrect
    devtool: 'source-map',
    output: merge(common.output, {
        filename: '[name].[contenthash].js',
    }),
    externals: {
        // Necessary for $.vellum to work
        jquery: 'window.jQuery',

        // Necessary for jquery-extensions to have proper access to $.fn.popover.Constructor
        "jquery.bootstrap": 'window.jQuery',
    },
});
