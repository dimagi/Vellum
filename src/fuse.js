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
        this.form = form;
        this.dataset = generateNewFuseData(form);
        this.fusejs = new fusejs(this.dataset, FUSE_CONFIG);

        var _this = this;

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
        regenerate: function() {
            this.fusejs.set(generateNewFuseData(this.form));
        },
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
                name: mug.hashtagPath,
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
        var caseData = [];
        if (form.vellum.data.core.databrowser) {
            caseData = _.chain(form.vellum.data.core.databrowser.dataHashtags)
             .map(function(absolutePath, hashtag) {
                 return {
                     name: hashtag,
                     absolutePath: absolutePath,
                     icon: 'fcc fcc-fd-case-property',
                     displayLabel: null,
                 };
             })
             .value();
        }
        return _.chain(form.getMugList())
                .map(mugToData)
                .filter(function(choice) {
                    return choice.name && !_.isUndefined(choice.displayLabel);
                })
                .value().concat(caseData);
    }

    return Fuse;
});
