const path = require('path');

module.exports = {
    entry: './tests/main.js',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.html$/i,
                loader: "html-loader",
            },
        ],
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, '_build'),
    },
    resolve: {
        alias: {
            "jquery": "jquery/dist/jquery.min.js",
        },
    },
};
