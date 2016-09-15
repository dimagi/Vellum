/**
 * Asynchronously loads data sources
 *
 * Format in opts:
 * dataSourcesEndpoint: function(callback) or string (URL)
 *
 * The endpoint function receives a callback argument. It should call the
 * `callback` with a list of the following structure (for a URL, the response
 * should be JSON in this format):
 * [
 *      {
 *          id: string (used in instance definition)
 *          uri: string (used in the instance definition)
 *          path: string (used in nodeset)
 *          name: string (human readable name)
 *          structure: nested dictionary of elements and attributes
 *          {
 *              element: {
 *                  structure: {
 *                      inner-element: { }
 *                  }
 *                  name: "Element" (the text used in dropdown for this element)
 *              },
 *              ref-element: {
 *                  reference: {
 *                      source: string (optional data source id, defaults to this data source)
 *                      subset: string (optional subset id)
 *                      key: string (referenced property)
 *                  }
 *              },
 *              @attribute: { }
 *          },
 *          subsets: [{
 *              id: string (unique identifier for this subset)
 *              key: string (unique identifier property name)
 *              name: string (human readable name)
 *              structure: { ... }
 *              related: {
 *                  string (relationship): string (related subset name),
 *                  ...
 *              }
 *          }]
 *      },
 *      ...
 * ]
 *
 * Elements can be nested indefinitely with structure keys describing inner
 * elements and attributes. Any element that has a `structure` key may also
 * have a `subsets` key, which defines structure specific to a subset of the
 * elements at that level of the tree. The structure of a subset is merged
 * with the unfiltered element structure, which means that all elements and
 * attributes available in the unfiltered element are also avaliable in the
 * filtered subset.
 *
 * The result of that would be (if used in an itemset):
 *
 *     <instance src="{source.uri}" id="{source.id}">
 *     ...
 *     <itemset nodeset="instance('{source.id}'){source.path}" />
 *
 *
 * The dropdown would have options:
 *
 *     name             (nodeset: instance('{source.id}'){source.path})
 *     name - Element   (nodeset: instance('{source.id}'){source.path}/element)
 *
 */
define([
    'jquery',
    'underscore',
    'vellum/util',
], function (
    $,
    _,
    util
) {
    var builders = {};

    /**
     * Initialize and return a datasources loader
     *
     * This function is called during core init.
     *
     * The returned "eventuality" object fires one of two events:
     *
     *  - change - fired when data sources changed. Currently this only
     *      happens once when data sources are first loaded.
     *  - error - fired when data sources could not be loaded.
     */
    function init(endpoint) {
        var that = util.eventuality({endpoint: endpoint});

        that.reset = function (retryTimeout) {
            that.retryTimeout = retryTimeout || 1000;
            that.cache = {};
        };

        that.getDataSources = function (defaultValue) {
            return getBuilt(that, "sources", defaultValue);
        };

        /**
         * Add callback to be called immediately if ready and also on change.
         *
         * @return a function that unbinds the callback.
         */
        that.onChangeReady = function (callback) {
            var sources = that.getDataSources(),
                context = {};
            if (sources) {
                callback();
            }
            that.on("change", callback, null, null, context);
            return function () { that.unbind(context, "change"); };
        };

        that.reset();
        if (endpoint && _.isString(endpoint)) {
            loadDataSources(that);
        }

        return that;
    }

    /**
     * Asynchronously load data sources
     */
    function loadDataSources(that) {
        function finish(data) {
            that.cache = {sources: data.length ? data : [{
                id: "",
                uri: "",
                path: "",
                name: "Not Found",
                structure: {}
            }]};
            that.loading = false;
            that.fire("change");
        }

        function onError(jqXHR, errorType, error) {
            that.fire({
                type: "error",
                xhr: jqXHR,
                errorType: errorType,
                error: error,
            });
            window.console.log(util.formatExc(error || errorType));
            if (that.retryTimeout < 8001) {  // 8000 = 4 retries
                // exponential backoff retry
                setTimeout(function () {
                    loadDataSources(that);
                }, that.retryTimeout);
                that.retryTimeout = that.retryTimeout * 2;
            }
        }

        if (that.endpoint) {
            if (_.isString(that.endpoint)) {
                that.loading = true;
                $.ajax({
                    type: 'GET',
                    url: that.endpoint,
                    dataType: 'json',
                    success: finish,
                    error: onError,
                    data: {}
                });
            } else {
                that.endpoint(finish);
            }
        } else {
            finish([]);
        }
    }

    function getBuilt(that, name, defaultValue) {
        var cache = that.cache,
            value;
        if (cache.hasOwnProperty(name)) {
            value = cache[name];
        } else {
            value = builders[name](that);
            if (value) {
                cache[name] = value;
            }
        }
        return value || defaultValue;
    }

    builders.sources = function (that) {
        if (!that.cache.hasOwnProperty("sources") && !that.loading) {
            loadDataSources(that);
        }
        return that.cache.sources;
    };

    return {init: init};
});
