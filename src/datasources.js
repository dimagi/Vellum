define([
    'jquery',
    'underscore',
    'vellum/widgets',
    'tpl!vellum/templates/data_source_editor',
    'tpl!vellum/templates/select_data_source'
], function (
    $,
    _,
    widgets,
    edit_source,
    select_source
) {
    var vellum, dataSources, cachedDataSources;

    function init(instance) {
        vellum = instance;
        dataSources = vellum.opts().core.dataSources || [];
        cachedDataSources = {
            fixtures: {}
        };
        getDataSources('fixture', cacheFixtures);
    }

    function cacheFixtures(data) {
        _.map(data, function(fixture) {
            cachedDataSources.fixtures[fixture.sourceUri] = fixture;
        });
    }

    function getPossibleFixtures() {
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

        return _.flatten(_.map(cachedDataSources.fixtures, function(fixture) {
            var baseFixture = {
                src: fixture.sourceUri,
                id: fixture.defaultId,
                query: fixture.initialQuery,
                name: fixture.name || fixture.defaultId
            };

            return [baseFixture].concat(generateFixtureDefinitions(fixture.structure, baseFixture));
        }));
    }

    function generateFixtureOptions() {
        return _.map(getPossibleFixtures(), function(fixture) {
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
        return "";
    }

    function autocompleteChoices(fixture_uri) {
        return generateFixtureColumns(cachedDataSources.fixtures[fixture_uri]);
    }

    function getDataSources(type, callback) {
        var source = _.find(dataSources, function (src) {
            return src.key === type;
        });

        if (source) {
            if (_.isString(source.endpoint)) {
                $.ajax({
                    type: 'GET',
                    url: source.endpoint,
                    dataType: 'json',
                    success: function (data) { callback(data); },
                    // TODO error handling
                    data: {}
                });
            } else {
                callback(source.endpoint());
            }
        } else {
            callback([]);
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

    function dataSourceWidget(mug, options, labelText) {
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

    function fixtureWidget(mug, options, labelText) {
        var widget = widgets.dropdown(mug, options), 
            getUIElement = widgets.util.getUIElement,
            getUIElementWithEditButton = widgets.util.getUIElementWithEditButton,
            super_getValue = widget.getValue,
            super_setValue = widget.setValue,
            currentValue = null;

        widget.addOptions(generateFixtureOptions());

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
                    },
                    false
                );
            return $("<div></div>").append(query);
        };

        function local_getValue() {
            currentValue = JSON.parse(super_getValue());
            return currentValue;
        }

        function local_setValue(val) {
            currentValue = val;
            super_setValue(val ? JSON.stringify(val) : '', val.query);
        }

        widget.getValue = local_getValue;
        widget.setValue = local_setValue;

        return widget;
    }

    return {
        init: init,
        dataSourceWidget: dataSourceWidget,
        fixtureWidget: fixtureWidget,
        autocompleteChoices:autocompleteChoices
    };
});
