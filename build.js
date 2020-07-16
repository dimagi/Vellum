({
    dir: '_build',
    appDir: '.',
    baseUrl: 'src',
    mainConfigFile: 'src/main.js',
    findNestedDependencies: true,
    // doesn't handle plugin resources
    removeCombined: true,
    skipDirOptimize: true,
    optimize: 'uglify2',
    uglify2: {
        output: {
            'ascii_only': true
        }
    },
    preserveLicenseComments: false,
    // Separate CSS because relative URLs (images) within the CSS do not load
    // properly in a production environment.
    // https://github.com/guybedford/require-css/issues/139
    separateCSS: true,
    //optimizeCss: 'none',
    inlineText: true,
    stubModules: [
        'text',
        'tpl',
        'json'
    ],
    pragmasOnSave: {
        excludeRequireCss: true,
        excludeTpl: true
    },
    /** 
     * An attempt to solve the eternal optimization problem of how to bundle
     * components and dependencies together so they will load the fastest for
     * the most users, given variables such as
     *   - the overhead of an HTTP request
     *   - the browser cache
     *   - the rate of changes to files
     *
     * This is a configuration for the optimizer that's meaningless for the
     * asynchronous loader, but we put it here because we generate the
     * 'bundles' config that is used by the asynchronous loader from it, and
     * it's not possible to represent all of this information using bundles.
     *
     * NOTE bundles.js may need to be updated if modules are changed
     */
    modules: [
        // begin buildmain.py delimiter
        // Build-only dependencies that should be excluded from all built
        // modules
        {
            create: true,
            name: 'exclude',
            include: [
                'css/css',
                'css/normalize',
                'less/less',
                'less/normalize'
            ]
        },
        // Global dependencies that may be already loaded on the page.  If
        // any aren't, then a single file containing them all will be
        // requested once.
        //
        // If bootstrap is already loaded, and you load this bundle,
        // you're going to have a bad time.
        {
            create: true,
            name: 'global-deps',
            include: [
                'jquery',
                'jquery.bootstrap',
                'underscore'
            ],
            exclude: [
                'exclude'
            ]
        },
        // Components (and their dependencies) that can be requested
        // asynchronously after Vellum has already finished loading, because
        // they're not necessary for initial operation.

//        // At the moment, this bundle doesn't get used as expected.
//        {
//            create: true,
//            name: 'deferred-components',
//            include: [
//                // core
//                'codemirror',
//                'diff-match-patch',
//                'CryptoJS',
//                'vellum/expressionEditor',
//
//                // uploader
//                'file-uploader',
//
//                // form
//                'vellum/writer',
//                'vellum/exporter'
//            ],
//            exclude: [
//                'exclude',
//                'global-deps',
//                // required by things other than the expression editor, ensure
//                // that they're not bundled here, otherwise separate bundles
//                // is useless
//                'xpath',
//                'vellum/util'
//            ]
//        },

        // Local dependencies that don't change often, except for new ones being
        // added.
        {
            create: true,
            name: 'local-deps',
            include: [
                'jquery.jstree',
                'jstree-actions',
                'save-button',
                'ckeditor',
                'ckeditor-jquery',

                // shim plugin dependencies don't automatically get included
                // NOTE less! and css! cannot be combined in the same module
                // https://github.com/guybedford/require-less/issues/48
                'css/css!../node_modules/codemirror/lib/codemirror',
                'css/css!../node_modules/jstree/dist/themes/default/style',
                'css/css!yui-combo',
                'css/css!../node_modules/At.js/dist/css/jquery.atwho'
            ],
            exclude: [
                'exclude',
                'global-deps'
                //'deferred-components'
            ]
        },
        // Everything else except main.
        {
            create: true,
            name: 'main-components',
            include: ['main'],
            exclude: [
                'exclude',
                'global-deps', 
                //'deferred-components', 
                'local-deps'
            ]
        }
        // end buildmain.py delimiter
    ]
})
