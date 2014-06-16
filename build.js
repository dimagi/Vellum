({
    appDir: 'src',
    baseUrl: '.',
    mainConfigFile: 'src/require-config.js',
    findNestedDependencies: true,
    // doesn't handle plugin resources
    removeCombined: true,
    dir: 'dist',
    skipDirOptimize: true,
    optimize: 'none',
    // Everything to do with CSS is handled by the require-css plugin
    optimizeCss: 'none',
    inlineText: true,
    stubModules: ['text', 'tpl', 'css', 'json'],
})
