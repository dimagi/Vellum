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
            'save-button': path.resolve(BASE_PATH, 'lib', 'SaveButton.js'),
            'jquery.vellum': path.resolve(BASE_PATH, 'src', 'main'),
            'vellum': path.resolve(BASE_PATH, 'src'),
            'tests': path.resolve(BASE_PATH, 'tests'),
            'static': path.resolve(BASE_PATH, 'tests', 'static'),
        },
    },
};
