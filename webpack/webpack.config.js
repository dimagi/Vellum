const path = require('path');
const webpack = require('webpack');
BASE_PATH = path.resolve(__dirname, '..')

module.exports = {
    mode: 'development',
    entry: {
        tests: {
            import: './tests/main.js',
            filename: '[name].vellum.bundle.js',
        },
        main: {
            import: './src/main.js',
            filename: '[name].vellum.bundle.js',
            chunkLoading: false,
        },
    },
    module: {
        rules: [
            {
                test: /\.xml$/,
                type: 'asset/source',
            },
            {
                test: /\.html$/,
                type: 'asset/source',
            },
            {
                test: /\.tsv$/,
                type: 'asset/source',
            },
            {
                test: /\.json$/,
                type: 'json',
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.less$/,
                use: ["style-loader", "css-loader", "less-loader"],
            },
            {
                test: /lib\/ckeditor\/ckeditor/,
                loader: "exports-loader",
                options: {
                    type: "commonjs",
                    exports: {
                        syntax: "single",
                        name: "CKEDITOR",
                    },
                },
            },
            {
                test: /XMLWriter/,
                loader: "exports-loader",
                options: {
                    type: "commonjs",
                    exports: {
                        syntax: "single",
                        name: "XMLWriter",
                    },
                },
            },
        ],
    },
    output: {
        clean: true,
    },
    plugins: [
        new webpack.ProvidePlugin({
            'jQuery': 'jquery',
            'window.jQuery': 'jquery',
            '$': 'jquery',
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
            'jstree-styles': path.resolve(BASE_PATH, 'node_modules/jstree/dist/themes/default/style.css'),
            'vellum': path.resolve(BASE_PATH, 'src'),
            'tests': path.resolve(BASE_PATH, 'tests'),
            'static': path.resolve(BASE_PATH, 'tests', 'static'),
        },
    },
};
