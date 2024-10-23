const path = require('path');

module.exports = {
    entry: './tests/main.js',
    mode: 'development',
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
