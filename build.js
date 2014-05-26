{
    appDir: 'src',
    baseUrl: '.',
    mainConfigFile: 'src/main.js',
    dir: 'dist',

    skipDirOptimize: true,
    optimize: 'none',
    preserveLicenseComments: false,
    // Everything to do with CSS is handled by the require-css plugin
    optimizeCss: 'none',
    inlineText: true,

    /** 
     * An attempt to solve the eternal optimization problem of how to bundle
     * components and dependencies together so they will load the fastest for
     * the most users, given variables such as
     *   - the overhead of an HTTP request
     *   - the browser cache
     *   - the rate of changes to files
     *
     * Although in this use-case it's a one-to-one mapping, since RequireJS
     * parses rather than loads require-config.js, there is no way to
     * automatically handle it ourselves.
     *
     * This is a configuration for the optimizer that's meaningless for the
     * asynchronous loader, but we put it here because we generate the
     * 'bundles' config that is used by the asynchronous loader from it, and
     * it's not possible to represent all of this information using bundles.
     */
    modules: [
        // Local dependencies that don't change often, except for new ones being
        // added.
        {
            create: true,
            name: 'vellum.local-deps',
            include: [
                'classy',
                'jquery.jstree',
                'jquery.fancybox',
                'jquery.bootstrap-popout',
                'jquery.bootstrap-better-typeahead',
                'save-button',
                'xpath'
            ],
            exclude: [
                '../bower_components/require-css/normalize',
                'jquery',
                'jquery-ui',
                'jquery.bootstrap',
                'underscore'
            ]
        },
        // Global dependencies that may be already loaded on the page.  If any
        // aren't, then a single file containing them all will be requested
        // once.
        {
            create: true,
            name: 'vellum.global-deps',
            include: [
                'jquery',
                'jquery-ui',
                'jquery.bootstrap',
                'underscore'
            ],
            exclude: [
                '../bower_components/require-css/normalize',
                'vellum.local-deps'
            ]
        },
        // Everything else except deferred components.
        {
            create: true,
            name: 'jquery.vellum',
            include: ['main'],
            exclude: [
                '../bower_components/require-css/normalize',
                'vellum.global-deps',
                'vellum.local-deps',

                // deferred components
                'codemirror',
                'diff-match-patch',
                'CryptoJS',
                'promise!./expressionEditor',

                // uploader
                'file-uploader',

                // form
                './writer',
                './exporter'
            ]
        },
        // Components (and their dependencies) that can be requested
        // asynchronously after Vellum has already finished loading, because
        // they're not necessary for initial operation.
        {
            create: true,
            name: 'vellum.deferred-components',
            include: [
                // core
                'codemirror',
                'diff-match-patch',
                'CryptoJS',
                'promise!./expressionEditor',

                // uploader
                'file-uploader',

                // form
                'promise!./writer',
                'promise!./exporter'
            ],
            exclude: [
                '../bower_components/require-css/normalize',
                'vellum.global-deps',
                'vellum.local-deps',
                'jquery.vellum'
            ]
        }
    ],
    stubModules: ['text', 'tpl'],
    pragmasOnSave: {
        excludeTpl: true
    },
    less: {
        logLevel: 1
    }
}
