define([
    'underscore',
    'fuse.js',
    'vellum/util',
], function (
    _,
    fusejs,
    util
) {
    var FUSE_CONFIG = {
        keys: ['displayPath'],
        tokenize: true,
        tokenSeparator: /\/+/g,
        threshold: 0.4,
    };

    function Fuse(form) {
        var _this = this;
        this.form = form;

        form.vellum.datasources.on("change", function() {
            _this.dataset = generateNewFuseData(form);
            _this.fusejs.set(_this.dataset);
        }, null, null, form);  // context=form for form.disconnectDataSources()

        form.on("change", function(event) {
            if (event.mug === undefined) {
                _this.dataset = generateNewFuseData(form);
                _this.fusejs.set(_this.dataset);
            }
        });

        if (!this.dataset) {
            this.dataset = generateNewFuseData(form);
        }

        this.fusejs = new fusejs(this.dataset, FUSE_CONFIG);


        function addToDataset(e) {
            removeFromDataset(e);
            _this.dataset.push(mugToData(e.mug));
            _this.fusejs.set(_this.dataset);
        }

        function removeFromDataset(e) {
            _this.dataset = _.filter(_this.dataset, function (mug) {
                return mug.id !== e.mug.ufid;
            });
        }


        this.form.on('mug-property-change', function (e) {
            if (e.property === 'nodeID') {
                addToDataset(e);
            }
        }).on('question-label-text-change', addToDataset)
        .on('question-create', addToDataset)
        .on('question-remove', removeFromDataset);
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
                hashtagPath: mug.hashtagPath,
                absolutePath: mug.absolutePath,
                displayPath: mug.form.richText ? mug.hashtagPath : mug.absolutePath,
                icon: mug.options.icon,
                questionId: mug.p.nodeID,
                displayLabel: util.truncate(defaultLabel),
                label: defaultLabel,
                mug: mug,
            };
        }
        return null;
    }

    function generateNewFuseData(form) {
        var caseData = [];
        if (form.richText) {
            caseData = _.chain(form.vellum.datasources.getHashtagMap({}))
             .map(function(absolutePath, hashtag) {
                 return {
                     name: hashtag,
                     hashtagPath: hashtag,
                     absolutePath: absolutePath,
                     icon: 'fcc fcc-fd-case-property',
                     displayLabel: null,
                     displayPath: hashtag,
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
