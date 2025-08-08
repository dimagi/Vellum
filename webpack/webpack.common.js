const path = require('path');
const webpack = require('webpack');
BASE_PATH = path.resolve(__dirname, '..')

module.exports = {
    entry: {
        tests: {
            import: './tests/main.js',
        },
        main: {
            import: './src/main.js',
            chunkLoading: false,
        },
    },
    output: {
        clean: true,
        path: path.resolve(BASE_PATH, '_build'),
    },
    module: {
        rules: [
            {
                test: /\.xml$/,
                type: 'asset/source',
            },
            {
                test: /templates\/.*\.html$/,
                loader: path.resolve('src/template-loader.js'),
            },
            {
                test: /static\/.*\.html$/,
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
                test: /lib\/sha1/,
                loader: "exports-loader",
                options: {
                    type: "commonjs",
                    exports: {
                        syntax: "single",
                        name: "CryptoJS",
                    },
                },
            },
            {
                test: /diff_match_patch/,
                loader: "exports-loader",
                options: {
                    type: "commonjs",
                    exports: {
                        syntax: "single",
                        name: "diff_match_patch",
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
    plugins: [
        new webpack.ProvidePlugin({
            'jQuery': 'jquery',
            'window.jQuery': 'jquery',
            '$': 'jquery',
        }),
    ],
    resolve: {
        alias: {
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
