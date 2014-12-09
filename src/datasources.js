define([
    'jquery',
    'tpl!vellum/templates/debug_case_data',
    'vellum/core'
], function (
    $,
    edit_source
) {
    function supportedMugs(type) {
        return ['DynamicMSelect', 'ModelRepeat'];
    }
    $.vellum.plugin('modelIteration', { }, {
        init: function() {
        },
        getDataTypes: function() {
            return this.opts().modelIteration.modelTypes;
        },
        getDataSources: function(type) {
            var endpoint = this.opts().modelIteration.modelIterationUrl;

            if (typeof endpoint === 'string') {
                var x = $.ajax({
                    type: 'GET',
                    url: endpoint,
                    dataType: 'json',
                    success: function() { },
                    data: {},
                    async: false
                });
                return x.responseText;
            } else {
                return endpoint(type);
            }
        },
        getToolsMenuItems: function () {
            var _this = this;
            return this.__callOld().concat([
                {
                    name: "Model Iteration",
                    action: function (done) {
                        _this.showDataDialog(done);
                    }
                }
            ]);
        },
        showDataDialog:  function(done) {
            var $modal,
            $exportForm,
            _this = this;

            $modal = this.generateNewModal("Data from HQ", []);
            $exportForm = $(edit_source({ }));
            $modal.find('.modal-body').html($exportForm);

            var $modelType = $exportForm.find('#model-type-selector'),
                $mugType = $exportForm.find('#mug-type-selector'),
                $text = $exportForm.find('textarea');

            $.each(_this.getDataTypes(), function(index, value) {
                $modelType.append($("<option />").val(value).text(value));
            });

            function populate() {
                $mugType.find('option').remove();
                $.each(supportedMugs($modelType.val()), function(index, value) {
                    $mugType.append($("<option />").val(value).text(value));
                });
                $text.val(_this.getDataSources($modelType.val()));
            }

            populate();

            $modelType.change(function() {
                populate();
            });

            // display current values
            $modal.modal('show');
        }
    });
});
