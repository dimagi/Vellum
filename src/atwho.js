define([
    'underscore',
    'jquery',
    'fusejs',
    'vellum/richText',
    'vellum/util',
    'tpl!vellum/templates/atwho_display',
    'vellum/core',
], function (
    _,
    $,
    fusejs,
    richText,
    util,
    atwhoDisplay
) {
    var that = {};

    // stripped down version of http://codepen.io/ImagineProgramming/storydump/javascript-memoization-timeout
    var timed = function timed(f, timeout) {
        var time = 0;

        return function TimedMemoizedFunction() {
            var now = +new Date(),
                timedOut = (now - time) >= timeout,
                form = arguments[0],
                atwhoData = form.vellum.data.atwho,
                cache = atwhoData.cache;

            if(timedOut || _.isUndefined(cache)) {
                cache = atwhoData.cache = f.apply(f, arguments);
                if (timedOut) {
                    time = now;
                }
            }

            return atwhoData.cache;
        };
    };

    var _cachedMugData = function(cacheTime) {
            return timed(function(form) {
                return _.chain(form.getMugList())
                        .map(function(mug) {
                            var defaultLabel = form.vellum.getMugDisplayName(mug);

                            return {
                                id: mug.ufid,
                                name: mug.absolutePath,
                                icon: mug.options.icon,
                                questionId: mug.p.nodeID,
                                displayLabel: util.truncate(defaultLabel),
                                label: defaultLabel,
                            };
                        })
                        .filter(function(choice) {
                            return choice.name && !_.isUndefined(choice.displayLabel);
                        })
                        .value();
            }, cacheTime || 500);
        },
        cachedMugData = _cachedMugData();

    /**
     * Turn a given input into an autocomplete, which will be populated
     * with a given set of choices and will also accept free text.
     *
     * @param $input - jQuery object, the input to turn into an autocomplete
     * @param choices - An array of strings with which to populate the autocomplete
     */
    that._dropdownAutocomplete = function ($input, choices) {
        $input.atwho({
            at: "",
            data: choices,
            maxLen: Infinity,
            suffix: "",
            tabSelectsMatch: false,
            callbacks: {
                filter: function(query, data, searchKey) {
                    return _.filter(data, function(item) {
                        return item.name.indexOf(query) !== -1;
                    });
                },
                matcher: function(flag, subtext, should_startWithSpace) {
                    return $input.val();
                },
                beforeInsert: function(value, $li) {
                    $input.data("selected-value", value);
                },
            }
        }).on("inserted.atwho", function(event, $li, otherEvent) {
            $(this).find('.atwho-inserted').children().unwrap();
            $input.val($input.data("selected-value")).change();
        });
    };

    /**
     * Alter a given input so that when a user enters the string "/data/",
     * they get an autocomplete of all questions in the form.
     *
     * @param $input - jQuery object, the input to modify
     * @param mug - current mug
     * @param options - Hash of options for autocomplete behavior:
     *                  category: sent to analytics
     *                  insertTpl: string to add to input when question is selected
     *                  property: sent to analytics
     *                  useRichText: use rich text editor insert method
     *                  outputValue: use output value in the template
     */
    that.questionAutocomplete = function ($input, mug, options) {
        mug.form.vellum.addAutocomplete($input, mug, options) ;
    };

    that._questionAutocomplete = function ($input, mug, options) {
        options = _.defaults(options || {}, {
            category: 'Question Reference',
            insertTpl: '${name}',
            property: '',
            outputValue: false,
            useRichText: false,
            functionOverrides: {},
        });

        if (options.useRichText) {
            options.insertTpl = '${name}';
            options.functionOverrides.insert = function(content, $li) {
                // this references internal At.js object
                this.query.el.remove();
                richText.editor($input).insertExpression(content);
                if (!this.$inputor.is(':focus')) {
                    this.$inputor.focus();
                }
            };
        }

        var _atWhoOptions = function() {
            var mugData = cachedMugData(mug.form),
                fuse = new fusejs(mugData, { keys: ['label', 'name'] });
    
            return {
                at: "/data/",
                data: mugData,
                displayTpl: atwhoDisplay,
                insertTpl: options.insertTpl,
                limit: 10,
                maxLen: 30,
                tabSelectsMatch: false,
                callbacks: {
                    matcher: function(flag, subtext) {
                        var match, regexp;
                        regexp = new RegExp('(\\s+|^)' + RegExp.escape(flag) + '([\\w_/]*)$', 'gi');
                        match = regexp.exec(subtext);
                        return match ? match[2] : null;
                    },
                    filter: function (query, data, searchKey) {
                        if (!query) { return data; }
                        return fuse.search(query);
                    },
                    sorter: function (query, items, searchKey) {
                        return _.map(items, function(item, idx) {
                            item.atwho_order = idx;
                            return item;
                        });
                    },
                    beforeInsert: function(value, $li) {
                        if (window.analytics) {
                            window.analytics.usage(options.category,
                                                   "Autocomplete",
                                                   options.property);
                        }
                        return value;
                    }
                },
                functionOverrides: options.functionOverrides,
            };
        };

        $input.atwho(_atWhoOptions());

        $input.on("inserted.atwho", function(event, $li, otherEvent) {
            $(this).find('.atwho-inserted').children().unwrap();
        });

        mug.on("teardown-mug-properties", function () {
            $input.atwho('destroy');
        }, null, "teardown-mug-properties");

        mug.on("change-display-language", function() {
            $input.atwho('destroy');
            $input.atwho(_atWhoOptions());
        });
    };

    that.cachedMugData = _cachedMugData;

    $.vellum.plugin("atwho", {},
        {
            addAutocomplete: function ($input, mug, options) {
                if (options && options.choices) {
                   that._dropdownAutocomplete($input, options.choices);
                } else {
                    that._questionAutocomplete($input, mug, options);
                }
            }
        }
    );

    return that;
});
