const path = require("path");
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval-cheap-module-source-map',
    output: {
        path: path.resolve(BASE_PATH, '_build'),
        filename: '[name].js',
    },
});
