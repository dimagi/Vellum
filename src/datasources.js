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
        var $modal,
        $exportForm,
        _this = this;

        $modal = this.generateNewModal("Select Data Source", []);
        $exportForm = $(edit_source({ }));
        $modal.find('.modal-body').html($exportForm);

        var $type = $exportForm.find('#type-selector'),
            $source = $exportForm.find('#source-selector'),
            //$mugType = $exportForm.find('#mug-type-selector'),
            $query = $exportForm.find('#source-query'),
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
            _this.getDataSources(key, function (sources) {
                $source.append($("<option />").text("-- Select a source --"));
                _.each(sources, function (source) {
                    $source.append($("<option />").data("source", source})
                                                  .text(source.name));
                });
                select();
            });
        }

        function select() {
            var selected = $source.find(":selected"),
                source = selected && selected.data("source");
            if (source) {
                $query.text("instance('{1}')/{2}"
                    .replace("{1}", source.defaultId)
                    .replace("{2}", source.rootNodeName)
                );
                $text.text([
                    source.defaultId,
                    source.sourceUri,
                ].join("\n"));
            } else {
                $query.text("");
                $text.text("");
            }
        }

        $type.change(populate);
        $source.change(select);

        // display current values
        $modal.modal('show');
    }

    return {
        init: init,
        getDataSources: getDataSources,
        selectDataSource: selectDataSource
    }

});
