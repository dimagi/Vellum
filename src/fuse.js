define([
    'underscore',
    'fusejs',
    'vellum/util',
], function (
    _,
    fusejs,
    util
) {
    var FUSE_CONFIG = {
        keys: ['label', 'name', 'absolutePath']
    };

    function Fuse(form) {
        var _this = this;
        this.form = form;
        this.dataset = generateNewFuseData(form);
        this.fusejs = new fusejs(this.dataset, FUSE_CONFIG);


        function addToDataset(e) {
            _this.dataset = _.filter(_this.dataset, function (mug) {
                return mug.id !== e.mug.ufid;
            });
            _this.dataset.push(mugToData(e.mug));
            _this.fusejs.set(_this.dataset);
        }


        this.form.on('mug-property-change', function (e) {
            if (e.property === 'nodeID') {
                addToDataset(e);
            }
        }).on('question-label-text-change', addToDataset)
        .on('question-create', addToDataset)
        .on('question-remove', addToDataset);
    }

    Fuse.prototype = {
        list: function () {
            return this.fusejs.list;
        },
        search: function (query) {
            return this.fusejs.search(query);
        }
    };

    function mugToData(mug) {
        if (mug) {
            var defaultLabel = mug.form.vellum.getMugDisplayName(mug);

            return {
                id: mug.ufid,
                name: mug.absolutePath,
                absolutePath: mug.absolutePath,
                icon: mug.options.icon,
                questionId: mug.p.nodeID,
                displayLabel: util.truncate(defaultLabel),
                label: defaultLabel,
                mug: mug,
            };
        }
        return null;
    }

    function generateNewFuseData (form) {
        return _.chain(form.getMugList())
                .map(mugToData)
                .filter(function(choice) {
                    return choice.name && !_.isUndefined(choice.displayLabel);
                })
                .value();
    }

    return Fuse;
});
