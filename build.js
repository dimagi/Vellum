({
    appDir: '.',
    baseUrl: 'src',
    mainConfigFile: 'src/require-config.js',
    findNestedDependencies: true,
    // doesn't handle plugin resources
    removeCombined: true,
    dir: '_build',
    skipDirOptimize: true,
    optimize: 'uglify2',
    generateSourceMaps: true,
    preserveLicenseComments: false,
    // Everything to do with CSS is handled by the require-css plugin
    optimizeCss: 'none',
    inlineText: true,
    stubModules: [
        'text', 
        'tpl', 
        'css', 
        'json', 
        'less'
    ],
    pragmasOnSave: {
        excludeRequireCss: true,
        excludeTpl: true
    }
})
