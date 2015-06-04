/**
 * Asynchronously loads data sources from vellum.opts().core.dataSourcesEndpoint
 * Currently only supports fixtures
 *
 * Format in opts:
 * dataSourcesEndpoint: function(callback) or string (URL)
 *
 * The endpoint function receives a callback argument. It should call the
 * `callback` with a list of the following structure (for a URL, the response
 * should be JSON in this format):
 * [
 *      {
 *          sourceUri: string (used in the instance definition)
 *          defaultId: string (used in instance definition)
 *          intialQuery: string (used in nodeset)
 *          name: string (human readable name)
 *          structure: nested dictionary of elements and attributes
 *          {
 *              element: {
 *                  structure: {
 *                      inner-element: { }
 *                  }
 *                  name: "Element" (the text used in dropdown for this element)
 *              },
 *              @attribute: { }
 *          }
 *      },
 *      ...
 * ]
 *
 * Elements can be nested indefinitely with structure keys describing inner
 * elements and attributes.
 *
 * The result of that would be (if used in an itemset):
 *
 *     <instance src=sourceUri id=defaultId>
 *     ...
 *     <itemset nodeset=initialQuery />
 *
 *
 * The dropdown would have options:
 *
 *     name             (nodeset: initialQuery)
 *     name - Element   (nodeset: initialQuery/element)
 *
 */
define([
    'jquery',
    'underscore',
    'vellum/widgets',
    'vellum/util',
    'tpl!vellum/templates/data_source_editor'
], function (
    $,
    _,
    widgets,
    util,
    edit_source
) {
    var vellum, dataSourcesEndpoint, dataCache, dataCallbacks;

    function init(instance) {
        vellum = instance;
        dataSourcesEndpoint = vellum.opts().core.dataSourcesEndpoint;
        reset();
    }

    function reset() {
        dataCache = null;
        dataCallbacks = null;
    }

    /**
     * Asynchronously load data sources of the given type
     *
     * @param type - The data source type (example: "fixture").
     * @param callback - A function to be called when the data sources
     *      have been loaded. This function should accept one argument:
     *      data - {
     *               <sourceUri1>: <data source 1 object>,
     *               <sourceUri2>: <data source 2 object>,
     *               ...
     *             }
     */
    function getDataSources(callback) {
        if (dataCache) {
            callback(dataCache);
            return;
        }
        if (dataCallbacks) {
            dataCallbacks.push(callback);
            return;
        }

        function finish(data) {
            dataCache = {};
            if (data.length === 0) {
                dataCache[""] = {
                    sourceUri: "",
                    defaultId: "",
                    initialQuery: "",
                    name: "Not Found",
                    structure: {}
                };
            } else {
                _.each(data, function(item) {
                    dataCache[item.sourceUri] = item;
                });
            }
            _.each(dataCallbacks, function (callback) {
                callback(dataCache);
            });
            dataCallbacks = null;
        }
        dataCallbacks = [callback];
        if (dataSourcesEndpoint) {
            if (_.isString(dataSourcesEndpoint)) {
                $.ajax({
                    type: 'GET',
                    url: dataSourcesEndpoint,
                    dataType: 'json',
                    success: finish,
                    error: function (jqXHR, errorType, exc) {
                        finish([]);
                        window.console.log(util.formatExc(exc || errorType));
                    },
                    data: {},
                    async: false
                });
            } else {
                dataSourcesEndpoint(finish);
            }
        } else {
            finish([]);
        }
    }

    /**
     * Load data source editor
     *
     * @param $div - jQuery object in which editor will be created.
     * @param options - Object containing editor options:
     *      {
     *          source: {
     *              id: "<instance id>",
     *              src: "<instance src>",
     *              query: "<query expression>"
     *          },
     *          change: callback,   // called when the editor content changes
     *          done: callback      // called with no arguments on cancel
     *      }
     */
    function loadDataSourceEditor($div, options) {
        var $ui = $(edit_source()),
            $instanceId = $ui.find("[name=instance-id]"),
            $instanceSrc = $ui.find("[name=instance-src]"),
            $query = $ui.find("[name=query]");
        $div.empty().append($ui);

        if (options.source) {
            $instanceId.val(options.source.id || "");
            $instanceSrc.val(options.source.src || "");
            $query.val(options.source.query || "");
        }

        function getDataSource() {
            return {
                id: $instanceId.val(),
                src: $instanceSrc.val(),
                query: $query.val()
            };
        }

        if (options.change) {
            $instanceId.on('change keyup', function () {
                options.change(getDataSource());
            });

            $instanceSrc.on('change keyup', function () {
                options.change(getDataSource());
            });

            $query.on('change keyup', function () {
                options.change(getDataSource());
            });
        }

        var done = function (val) {
            $div.find('.fd-data-source-editor').hide();
            options.done(val);
        };

        $ui.find('.fd-data-source-save-button').click(function () {
            done(getDataSource());
        });

        $ui.find('.fd-data-source-cancel-button').click(function () {
            done();
        });
    }

    function advancedDataSourceWidget(mug, options, labelText) {
        var widget = widgets.text(mug, options),
            getUIElement = widgets.util.getUIElement,
            getUIElementWithEditButton = widgets.util.getUIElementWithEditButton,
            super_getValue = widget.getValue,
            super_setValue = widget.setValue,
            currentValue = null;

        widget.getUIElement = function () {
            var query = getUIElementWithEditButton(
                    getUIElement(widget.input, labelText),
                    function () {
                        vellum.displaySecondaryEditor({
                            source: local_getValue(),
                            headerText: labelText,
                            loadEditor: loadDataSourceEditor,
                            done: function (source) {
                                if (!_.isUndefined(source)) {
                                    local_setValue(source);
                                    widget.handleChange();
                                }
                            }
                        });
                    }
                );
            return $("<div></div>").append(query);
        };

        function local_getValue() {
            currentValue.query = super_getValue();
            return currentValue;
        }

        function local_setValue(val) {
            currentValue = val;
            super_setValue(val.query || "");
        }

        widget.getValue = local_getValue;
        widget.setValue = local_setValue;

        return widget;
    }

    // -------------------------------------------------------------------------
    // The following are functions related to "fixture" type data sources only

    /**
     * @param options - Optionally pass in:
     *      onOptionsLoaded - callback called when options are loaded
     *      hasAdvancedEditor - enable advanced editor if true
     *      getSource(mug) - Initializes the source for the advanced editor
     *      setSource(source, mug) - Saves the source from the advanced editor
     */
    function fixtureWidget(mug, options, labelText) {
        var CUSTOM_XML = "Lookup table was not found in the project",
            EMPTY_VALUE = JSON.stringify({src: "", id: "", query: ""});

        function isEmptyValue(val) {
            return !val || _.all(_.map(val, _.isEmpty));
        }

        function local_getValue() {
            return JSON.parse(super_getValue());
        }

        function local_setValue(val) {
            var jsonVal = EMPTY_VALUE;
            if (!isEmptyValue(val)) {
                jsonVal = JSON.stringify(val);
                if (!widget.equivalentOption(jsonVal)) {
                    widget.addOption(jsonVal, CUSTOM_XML);
                }
            }
            super_setValue(jsonVal);
            hasValue = true;
        }

        var widget = widgets.dropdown(mug, options), 
            super_getValue = widget.getValue,
            super_setValue = widget.setValue,
            getSource = options.getSource ? options.getSource : local_getValue,
            setSource = options.setSource ? options.setSource : local_setValue,
            hasValue = false;

        widget.addOption(EMPTY_VALUE, "Loading...");
        getDataSources(function (data) {
            var value;
            if (options.dataSourcesFilter) {
                data = options.dataSourcesFilter(data);
            }
            if (hasValue) {
                value = local_getValue();
            }
            widget.clearOptions();
            var fixtures = getPossibleFixtures(data);
            widget.addOptions(generateFixtureOptions(fixtures));
            if (hasValue && !isEmptyValue(value)) {
                local_setValue(value);
            } else if (fixtures && fixtures.length) {
                // default to first option
                local_setValue(_.omit(fixtures[0], 'name'));
            }
            if (options.onOptionsLoaded) {
                options.onOptionsLoaded();
            }
        });

        if (options.hasAdvancedEditor) {
            widget.getUIElement = function () {
                var query = widgets.util.getUIElementWithEditButton(
                        widgets.util.getUIElement(widget.input, labelText),
                        function () {
                            vellum.displaySecondaryEditor({
                                source: getSource(mug),
                                headerText: labelText,
                                loadEditor: loadDataSourceEditor,
                                done: function (source) {
                                    if (!_.isUndefined(source)) {
                                        setSource(source, mug);
                                        widget.handleChange();
                                    }
                                }
                            });
                        }
                    );
                query.find(".fd-edit-button").text("...");
                query.find('.controls').css('margin-right', '48px');
                return $("<div></div>").append(query);
            };
        }

        widget.getValue = local_getValue;
        widget.setValue = local_setValue;

        return widget;
    }

    function getPossibleFixtures(data) {
        function generateFixtureDefinitions(structure, baseFixture) {
            return _.map(structure, function(value, key) {
                var ret = [],
                    newBaseFixture = {
                        src: baseFixture.src,
                        id: baseFixture.id,
                        query: baseFixture.query + "/" + key
                    };
                newBaseFixture.name = baseFixture.name + " - " + (value.name || key);

                if (!value.no_option) {
                    ret = [newBaseFixture];
                }
                return ret.concat(generateFixtureDefinitions(value.structure, newBaseFixture));
            });
        }

        // HACK references dataCache, which is loaded asynchronously
        // TODO filter for itemsets
        return _.flatten(_.map(data || dataCache, function(fixture) {
            var baseFixture = {
                src: fixture.sourceUri,
                id: fixture.defaultId,
                query: fixture.initialQuery,
                name: fixture.name || fixture.defaultId
            };

            return [baseFixture].concat(generateFixtureDefinitions(fixture.structure, baseFixture));
        }));
    }

    function generateFixtureOptions(fixtures) {
        return _.map(fixtures, function(fixture) {
            return {
                value: JSON.stringify(_.omit(fixture, 'name')),
                text: fixture.name
            };
        });
    }

    function generateFixtureColumns(fixture) {
        function generateColumns(structure) {
            return _.map(structure, function(value, key) {
                return [key].concat(_.map(generateColumns(value.structure), function(value) {
                    return key + '/' + value;
                }));
            });
        }

        if (fixture) {
            return _.flatten(generateColumns(fixture.structure));
        }
        return [];
    }

    function autocompleteChoices(fixture_uri) {
        // HACK references dataCache, which is loaded asynchronously
        // This seems wrong: fixture_uri references the root of the
        // fixture structure, and options are generated from the root.
        // However, the itemset may be referencing a non-root element
        // and therefore the choices returned here will be incorrectly qualified.
        if (!dataCache || !dataCache[fixture_uri]) {
            return [];
        }
        return generateFixtureColumns(dataCache[fixture_uri]);
    }

    // -------------------------------------------------------------------------

    return {
        init: init,
        reset: reset,
        advancedDataSourceWidget: advancedDataSourceWidget,
        fixtureWidget: fixtureWidget,
        autocompleteChoices: autocompleteChoices,
        getPossibleFixtures: getPossibleFixtures
    };
});
