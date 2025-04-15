const path = require("path");
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval-cheap-module-source-map',
    // TODO: put dev output in a different directory than prod output?
    output: merge(common.output, {
        filename: '[name].js',
    }),
});
