// plugin pattern adapted from JSTree, minus plugin events

define([
    'jquery',
    'underscore'
], function (
    $,
    _,
    undefined
) {
    var corePlugins = [
        'core',
        'ignore',
        'intents',
        'javaRosa',
        'lock',
        'uploader',
        'windowManager'
    ],
        instances = [];
    
    $.fn.vellum = function (options) {
        var isMethodCall = typeof options === 'string',
            args = Array.prototype.slice.call(arguments, 1),
            retVal;

        if (isMethodCall) {
            this.each(function () {
                var instanceId = $.data(this, "vellum_instance_id"),
                    instance = instances[instanceId];
                retVal = instance[options].apply(instance, args);
            });
            return retVal;
        } else {
            // Instantiate an instance for each element in the jquery object set
            // passed.  In practice, it's unlikely that you'd ever want to
            // instantiate multiple instances at once.
            this.each(function () {
                options.plugins = _.uniq(corePlugins.concat(options.plugins || []));
                var instance = new $.vellum._instance($(this), options),
                    instanceId = $.data(this, "vellum_instance_id");
                if (instanceId === undefined) {
                    instances.push({});
                    instanceId = instances.length - 1;
                }
                $.data(this, "vellum_instance_id", instanceId);

                _.each(options.plugins, function (p) {
                    instance.data[p] = {};
                });

                var context = $.extend({}, instance, $.vellum._fn);
                instances[instanceId] = context;
                // init core
                $.vellum._fn.init.apply(context);

                _.each(options.plugins, function (p) {
                    var initFn = $.vellum._initFns[p];
                    if (initFn) {
                        initFn.apply(context);
                    }
                });

                // do final initialization that requires all plugins to be loaded
                $.vellum._fn.postInit.apply(context);
            });
            return this;
        }
    };

    $.vellum = {
        defaults: {},
        _fn: {},
        _initFns: {},
        _instance: function ($f, options) {
            options = $.extend(true, {}, $.vellum.defaults, options);

            this.$f = $f;
            this.data = {};
            this.opts = function () { 
                return $.extend(true, {}, options); 
            };

            this.getData = function () {
                return this.data;
            }.bind(this);
        },
        plugin: function (pluginName, defaults, fns) {
            $.vellum.defaults[pluginName] = defaults;

            _.each(fns, function (fn, fnName) {
                // this is not how jstree does it, and a bit hacky, but it makes
                // defining plugins simpler
                if (fnName === 'init' && pluginName !== 'core') {
                    $.vellum._initFns[pluginName] = fn;
                    return;
                }

                fn.plugin = pluginName;
                fn.old = $.vellum._fn[fnName];
                $.vellum._fn[fnName] = function () {
                    var func = fn,
                        args = Array.prototype.slice.call(arguments),
                        plugins = this.opts().plugins;

                    // check if function belongs to an enabled plugin for this
                    // instance
                    do {
                        if (func && func.plugin && 
                            _.contains(plugins, func.plugin)) {
                            break;
                        }
                        func = func.old;
                    } while (func);
                    if (!func) { return; }

                    // call private methods normally
                    if (fnName.indexOf('_') === 0) {
                        // this could be a problem if two plugins have a private
                        // method with the same name, easily fixed
                        return func.apply(this, args);
                    }

                    // call function with a __callOld() method added to
                    // `this` that calls the next copy of this method in the
                    // plugin stack
                    return func.apply(
                        $.extend({}, this, {
                            __callOld: function (replaceArguments) {
                                return func.old.apply(this, (replaceArguments ?
                                    Array.prototype.slice.call(arguments) : args));
                            }
                        }), 
                        args);
                };
                $.vellum._fn[fnName].old = fn.old;
                $.vellum._fn[fnName].plugin = pluginName;
            });
            return $;
        }
    };

    return;
});
