const path = require('path');
BASE_PATH = path.resolve(__dirname, '..')

module.exports = {
    mode: 'development',
    entry: './tests/jls.js',
    module: {
        rules: [
            {
                test: /\.xml/,
                type: 'asset/source',
            },
        ],
    },
    output: {
        filename: 'vellum.bundle.js',
    },
    resolve: {
        alias: {
            'jquery.vellum': path.resolve(BASE_PATH, 'src', 'main'),
            'vellum': path.resolve(BASE_PATH, 'src'),
            'tests': path.resolve(BASE_PATH, 'tests'),
            'static': path.resolve(BASE_PATH, 'tests', 'static'),
        },
    },
};
