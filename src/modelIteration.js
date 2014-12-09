define([
    'jquery',
    'tpl!vellum/templates/debug_case_data',
    'vellum/core'
], function (
    $,
    edit_source
) {
    $.vellum.plugin('modelIteration', { }, {
        init: function() {
        },
        getDataTypes: function() {
            return this.opts().modelIteration.modelTypes;
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

            var $modelType = $exportForm.find('#model-type-selector');

            $.each(_this.getDataTypes(), function(index, value) {
                $modelType.append($("<option />").val(value).text(value));
            });

            // display current values
            $modal.modal('show');
        }
    });
});
