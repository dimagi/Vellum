module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('dist', [
        'exec:dist'
    ]);

    grunt.registerTask('dist-min', [
        'exec:dist-min'
    ]);

    grunt.initConfig({
        exec: {
            dist: {
                cmd: function () {
                    return 'r.js -o build.js';
                }
            },
            "dist-min": {
                cmd: function () {
                    return 'r.js -o build-min.js';
                }
            }
        }
    });
};
