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
        keys: ['label', 'name', 'absolutePath'],
    };

    function Fuse(form) {
        this.form = form;
        this.fusejs = new fusejs(generateNewFuseData(form), FUSE_CONFIG);


        var _this = this;
        this.form.on('question-label-text-change', function () {
            _this.regenerate();
        }).on('mug-property-change', function (e) {
            if (e.property === 'nodeID') {
                _this.regenerate();
            }
        });
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
                .map(function(mug) {
                    var defaultLabel = form.vellum.getMugDisplayName(mug);

                    return {
                        id: mug.ufid,
                        name: mug.hashtagPath,
                        absolutePath: mug.absolutePath,
                        icon: mug.options.icon,
                        questionId: mug.p.nodeID,
                        displayLabel: util.truncate(defaultLabel),
                        label: defaultLabel,
                    };
                })
                .filter(function(choice) {
                    return choice.name && !_.isUndefined(choice.displayLabel);
                })
                .value().concat(caseData);
    }

    return Fuse;
});
