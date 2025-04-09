const path = require('path');
const webpack = require('webpack');
BASE_PATH = path.resolve(__dirname, '..')

module.exports = {
    mode: 'development',
    entry: './tests/jls.js',
    module: {
        rules: [
            {
                test: /\.xml$/,
                type: 'asset/source',
            },
            {
                test: /\.html$/,
                loader: path.resolve('src/template-loader.js'),
            },
            {
                test: /\.json$/,
                type: 'json',
            },
            {
                test: /\.less$/,
                use: ["style-loader", "css-loader", "less-loader"],
            },
        ],
    },
    output: {
        filename: 'vellum.bundle.js',
    },
    plugins: [
        new webpack.ProvidePlugin({
            'jQuery': 'jquery',
        }),
    ],
    resolve: {
        alias: {
            'ckeditor': path.resolve(BASE_PATH, 'lib/ckeditor/ckeditor.js'),
            'ckeditor-jquery': path.resolve(BASE_PATH, 'lib/ckeditor/adapters/jquery.js'),
            'CryptoJS': path.resolve(BASE_PATH, 'lib/sha1'),
            'diff-match-patch': path.resolve(BASE_PATH, 'lib/diff_match_patch'),
            'save-button': path.resolve(BASE_PATH, 'lib', 'SaveButton.js'),
            'jquery.vellum': path.resolve(BASE_PATH, 'src', 'main'),
            'vellum': path.resolve(BASE_PATH, 'src'),
            'tests': path.resolve(BASE_PATH, 'tests'),
            'static': path.resolve(BASE_PATH, 'tests', 'static'),
        },
    },
};
