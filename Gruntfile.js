module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('dist', [
        'exec:dist'
    ]);

    grunt.initConfig({
        exec: {
            dist: {
                cmd: function () {
                    return 'rm -rf dist && r.js -o build.js && rm -rf dist/.git';
                }
            }
        }
    });
};
