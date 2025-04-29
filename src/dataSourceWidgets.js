define([
    'jquery',
    'underscore',
    'vellum/widgets',
    'vellum/templates/data_source_editor.html'
], function (
    $,
    _,
    widgets,
    edit_source
) {
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

        if (options.onLoad) {
            options.onLoad($ui);
        }
    }

    function advancedDataSourceWidget(mug, options, labelText) {
        var widget = widgets.text(mug, options),
            getUIElement = widgets.util.getUIElement,
            getUIElementWithEditButton = widgets.util.getUIElementWithEditButton,
            super_getValue = widget.getValue,
            super_setValue = widget.setValue,
            currentValue = null;

        widget.options.richText = false;
        widget.getUIElement = function () {
            var query = getUIElementWithEditButton(
                    getUIElement(widget.input, labelText),
                    function () {
                        mug.form.vellum.displaySecondaryEditor({
                            source: local_getValue(),
                            headerText: labelText,
                            loadEditor: loadDataSourceEditor,
                            onLoad: function ($ui) {
                                widgets.util.setWidget($ui, widget);
                            },
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
        var CUSTOM_XML = gettext("Lookup table was not found in the project"),
            EMPTY_VALUE = JSON.stringify({src: "", id: "", query: ""});

        function isEmptyValue(val) {
            return !val || _.all(_.map(val, _.isEmpty));
        }

        function local_getValue() {
            var value = super_getValue();
            return value ? JSON.parse(value) : EMPTY_VALUE;
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

        widget.options.richText = false;
        widget.addOption(EMPTY_VALUE, gettext("Loading..."));
        var disconnect = mug.form.vellum.datasources.onChangeReady(function () {
            var data = mug.form.vellum.datasources.getDataSources(),
                value;
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
        mug.on('teardown-mug-properties', disconnect, null, "teardown-mug-properties");

        if (options.hasAdvancedEditor) {
            widget.getUIElement = function () {
                var query = widgets.util.getUIElementWithEditButton(
                        widgets.util.getUIElement(widget.input, labelText),
                        function () {
                            mug.form.vellum.displaySecondaryEditor({
                                source: getSource(mug),
                                headerText: labelText,
                                loadEditor: loadDataSourceEditor,
                                onLoad: function ($ui) {
                                    widgets.util.setWidget($ui, widget);
                                },
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
        advancedDataSourceWidget: advancedDataSourceWidget,
        fixtureWidget: fixtureWidget,
        autocompleteChoices: autocompleteChoices,
        getPossibleFixtures: getPossibleFixtures,
    };
});
