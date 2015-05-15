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
 * elements and attributes.
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
    'vellum/widgets',
    'vellum/util',
    'tpl!vellum/templates/data_source_editor',
    'tpl!vellum/templates/external_data_tree'
], function (
    $,
    _,
    widgets,
    util,
    edit_source,
    external_data_tree
) {
    var vellum, dataSourcesEndpoint, dataCache, dataCallbacks, panelHeight;

    // called during core init
    function init(instance) {
        vellum = instance;
        dataSourcesEndpoint = vellum.opts().core.dataSourcesEndpoint;
        reset();
    }

    function reset() {
        dataCache = null;
        dataCallbacks = null;
    }

    // plugin adds an item to the Tools menu when enabled
    $.vellum.plugin('datasources', {}, {
        init: function () {
            if (dataSourcesEndpoint) {
                initExternalDataTree();
            }
        },
        getToolsMenuItems: function () {
            var items = this.__callOld();
            if (dataSourcesEndpoint) {
                items.push({
                    name: "External Data",
                    action: function (done) {
                        toggleExternalDataTree(done);
                    }
                });
            }
            return items;
        }
    });

    function initExternalDataTree($accessoryPane) {
        var pane = vellum.$f.find(".fd-accessory-pane");
        pane.append($(external_data_tree()));
        pane.resize(function () {
            if (pane.height() > 100) {
                panelHeight = pane.height();
            } else if (pane.height() > 0) {
                loadExternalData();
            }
        });
    }

    var loadExternalData = function () {
        // overwrite function with no-op (only call once)
        loadExternalData = function () {};

        // display spinner and begin loading...
        var $container = vellum.$f.find(".fd-external-data-tree-container"),
            $search = $container.find(".fd-search-box input"),
            $tree = $container.find(".fd-external-data-tree"),
            pending = false;
        $tree.jstree({
            core: {
                data: function (node, callback) {
                    var _this = this;
                    getDataSources(function (data) {
                        callback.call(_this, dataTreeJson(data));
                    });
                },
                worker: false,
                multiple: false,
                check_callback: function(operation, node, parent, position, more) {
                    return false;
                }
            },
            search: {
                show_only_matches: true
            },
            conditionalevents: {
                should_activate: function () { return false; }
            },
            "plugins" : [ "themes", "conditionalevents", "search" ]
        });
        $search.keyup(function () {
            if (pending) {
                clearTimeout(pending);
            }
            pending = setTimeout(function () {
                $tree.jstree(true).search($search.val());
            }, 250);
        });
    };

    function dataTreeJson(data) {
        var MAX_OPEN_NODE = 50;
        function node(parentPath, info) {
            return function (item, name) {
                var path = parentPath + "/" + name,
                    children = _.map(item.structure, node(path, info));
                return {
                    id: path,
                    icon: false,
                    text: item.name || name,
                    state: {opened: children.length <= MAX_OPEN_NODE},
                    source: info,
                    children: children
                };
            };
        }
        return _.map(data, function (source) {
            var info = _.omit(source, "structure"),
                path = source.initialQuery,
                children = _.map(source.structure, node(path, info));
            return {
                id: path,
                icon: false,
                text: source.name,
                state: {opened: children.length <= MAX_OPEN_NODE},
                source: info,
                children: children
            };
        });
    }

    function toggleExternalDataTree(done) {
        var pane = vellum.$f.find(".fd-accessory-pane");
        if (pane.height()) {
            pane.css("height", "0");
            $(window).resize();
        } else {
            var tree = vellum.$f.find(".fd-tree"),
                height = panelHeight || Math.min(tree.height() / 2, 200);
            pane.css("height", height + "px");
            $(window).resize();
            loadExternalData();
        }
        done();
    }

    /**
     * Asynchronously load data sources
     *
     * @param callback - A function to be called when the data sources
     *      have been loaded. This function should accept one argument,
     *      a list of data source objects.
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
            dataCache = data.length ? data : [{
                id: "",
                uri: "",
                path: "",
                name: "Not Found",
                structure: {}
            }];
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
                    data: {}
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
                options.onOptionsLoaded(data);
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
                        id: baseFixture.id,
                        src: baseFixture.src,
                        query: baseFixture.query + "/" + key,
                        name: baseFixture.name + " - " + (value.name || key),
                    };

                if (!(_.isEmpty(value.structure) || value.no_option)) {
                    ret = [newBaseFixture];
                }
                return ret.concat(generateFixtureDefinitions(value.structure, newBaseFixture));
            });
        }

        return _.flatten(_.map(data, function(fixture) {
            var baseFixture = {
                id: fixture.id,
                src: fixture.uri,
                query: "instance('" + fixture.id + "')" + fixture.path,
                name: fixture.name || fixture.id
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

    function autocompleteChoices(data, fixtureUri) {
        // This seems wrong: fixture_uri references the root of the
        // fixture structure, and options are generated from the root.
        // However, the itemset may be referencing a non-root element
        // and therefore the choices returned here will be incorrectly qualified.
        var fixture = _.find(data, function (source) {
            return source.uri === fixtureUri;
        });
        return fixture ? generateFixtureColumns(fixture) : [];
    }

    // -------------------------------------------------------------------------

    return {
        init: init,
        reset: reset,
        getDataSources: getDataSources,
        advancedDataSourceWidget: advancedDataSourceWidget,
        fixtureWidget: fixtureWidget,
        autocompleteChoices: autocompleteChoices,
        getPossibleFixtures: getPossibleFixtures
    };
});
