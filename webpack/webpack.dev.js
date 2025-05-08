const path = require("path");
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval-cheap-module-source-map',
    externals: {
        // Necessary for tests
        jquery: 'window.jQuery',

        // Vellum expects bootstrap to be externally provided.
        // No value needed because Vellum never directly references bootstrap.
        "bootstrap": "window.nothing",
    },
});
