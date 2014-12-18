define([
    'jquery',
    'underscore',
    'vellum/widgets',
    'tpl!vellum/templates/select_data_source'
], function (
    $,
    _,
    widgets,
    edit_source
) {
    var vellum, dataSources;

    function init(instance) {
        vellum = instance;
        dataSources = vellum.opts().core.dataSources || [];
    }

    function getDataSources(type, callback) {
        var source = _(dataSources).find(function (src) {
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

    function selectDataSource(callback) {
        var $modal = vellum.generateNewModal("Select Data Source", [
                {
                    title: "Set Data Source",
                    cssClasses: "btn-primary",
                    action: function () {
                        var sel = $source.find(":selected"),
                            src = (sel && sel.data("source")) || {};
                        callback({
                            instance: {
                                id: src.defaultId,
                                src: src.sourceUri
                            },
                            idsQuery: $query.val(),
                        });
                        $modal.modal('hide');
                    }
                }
            ]),
            $exportForm = $(edit_source({}));
        $modal.find('.modal-body').html($exportForm);

        var $type = $exportForm.find('[name=type-selector]'),
            $source = $exportForm.find('[name=source-selector]'),
            $query = $exportForm.find('[name=source-query]'),
            $text = $exportForm.find('textarea');

        $text.attr("disabled", "disabled");
        $type.empty();
        $type.append($("<option />").text("-- Select a source type --"));
        _.each(dataSources, function(source) {
            $type.append($("<option />").val(source.key).text(source.name));
        });

        function populate() {
            var key = $type.val();
            $source.empty();
            if (!key) {
                select();
                return;
            }
            getDataSources(key, function (sources) {
                $source.append($("<option />").text("-- Select a source --"));
                _.each(sources, function (source) {
                    $source.append($("<option />").data("source", source)
                                                  .text(source.name));
                });
                select();
            });
        }

        function select() {
            var selected = $source.find(":selected"),
                source = selected && selected.data("source");
            if (source) {
                $query.val("instance('{1}')/{2}"
                    .replace("{1}", source.defaultId)
                    .replace("{2}", source.rootNodeName)
                );
                $text.text([
                    source.defaultId,
                    source.sourceUri,
                ].join("\n"));
            } else {
                $query.val("");
                $text.text("");
            }
        }

        $type.change(populate);
        $source.change(select);

        // display current values
        $modal.modal('show');
    }

    function dataSourceWidget(mug, options) {
        var widget = widgets.normal(mug, options),
            getUIElement = widgets.util.getUIElement,
            getUIElementWithEditButton = widgets.util.getUIElementWithEditButton,
            $queryInput = $("<input type='text' name='value_ref' class='input-block-level'>"),
            currentValue = {};

        widget.getUIElement = function () {
            var query = getUIElementWithEditButton(
                    getUIElement($queryInput, "Model Iteration ID Query"), 
                    function () {
                        selectDataSource(function (source) {
                            currentValue = source;
                            mug.p.dataSource = source;
                            widget.setValue(source);
                        });
                    }
                );
            return $("<div></div>").append(query);
        };

        $queryInput.on('change keyup', function () {
            currentValue.idsQuery = $queryInput.val();
            mug.p.dataSource = currentValue;
        });

        widget.setValue = function (val) {
            currentValue = val;
            $queryInput.val(val.idsQuery || "");
        };

        return widget;
    }

    return {
        init: init,
        getDataSources: getDataSources,
        selectDataSource: selectDataSource,
        dataSourceWidget: dataSourceWidget
    };

});
