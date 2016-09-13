define([
    'underscore',
    'jquery',
    'vellum/richText',
    'vellum/util',
    'tpl!vellum/templates/atwho_display',
    'vellum/core',
], function (
    _,
    $,
    richText,
    util,
    atwhoDisplay
) {
    var that = {};

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

        function addAtWhoToInput() {
            var _atWhoOptions = function(atKey) {
                var form = mug.form;

                return {
                    at: atKey,
                    displayTpl: atwhoDisplay,
                    insertTpl: options.insertTpl,
                    limit: 10,
                    maxLen: 30,
                    startWithSpace: false,
                    tabSelectsMatch: false,
                    callbacks: {
                        matcher: function(flag, subtext) {
                            var match, regexp;
                            // Match text that starts with the flag and then looks like a path.
                            // CKEditor reserves the right to insert arbitrary zero-width spaces, so watch for those.
                            regexp = new RegExp('([\\s\u200b]+|^)' + RegExp.escape(flag) + '([\\w/-]*)$', 'gi');
                            match = regexp.exec(subtext);
                            return match ? match[2] : null;
                        },
                        filter: function (query, data, searchKey) {
                            // filters the mug that is currently selected
                            // and choice mugs/other mugs taht don't have
                            // absolute paths
                            function filterDropdown (list) {
                                return _.filter(list, function(mug_) {
                                    return (mug.ufid !== mug_.id) &&
                                        (mug_.name && !_.isUndefined(mug_.displayLabel));
                                });
                            }

                            if (!query) { return filterDropdown(form.fuse.list()); }
                            return filterDropdown(form.fuse.search(query));
                        },
                        sorter: function (query, items, searchKey) {
                            return _.map(items, function(item, idx) {
                                item.atwho_order = idx;
                                return item;
                            });
                        },
                        beforeInsert: function(value, $li) {
                            if (window.analytics) {
                                var category;
                                if (util.isCaseReference(value)) {
                                    category = "Case Reference";
                                } else {
                                    category = "Question Reference";
                                }
                                window.analytics.usage(category,
                                                       "Autocomplete",
                                                       options.property);
                            }
                            return value;
                        },
                        afterMatchFailed: function(at, $el) {
                            if (options.useRichText && $el.html()) {
                                // If user typed out a full legitimate hashtag, or something that isn't
                                // legit but looks vaguely like a case property, turn it into a bubble.
                                var content = $el.html().trim().replace(/^.*\s/, ""),
                                    isUnknownHashtag = richText.REF_REGEX.test(content) && !form.isValidHashtagPrefix(content),
                                    shouldBubble = form.isValidHashtag(content) || isUnknownHashtag;

                                if (shouldBubble) {
                                    options.functionOverrides.insert.call(this, content);
                                }

                                // After this callback, atwho will attempt to remove the query string and
                                // properly set cursor position. However, its logic breaks if we've already
                                // replaced the query with a bubble. Handle the removal and cursor logic
                                // ourselves, and return false from this function so the atwho logic doesn't run.
                                var node = this._unwrap($el.text($el.text()).contents().first());
                                if (!shouldBubble) {
                                    this._setRange("after", node);
                                }
                            }

                            return false;
                        },
                    },
                    functionOverrides: options.functionOverrides,
                };
            };

            $input.one('focus', function () {
                $input.atwho(_atWhoOptions('/data/'));
                if (options.useRichText) {
                    $input.atwho(_atWhoOptions('#'));
                }
            });
        }

        addAtWhoToInput();

        $input.on("inserted.atwho", function(event, $li, otherEvent) {
            $(this).find('.atwho-inserted').children().unwrap();
        });

        mug.on("teardown-mug-properties", function () {
            if ($input.data('atwho')) {
                $input.atwho('destroy');
            }
        }, null, "teardown-mug-properties");

        mug.on("change-display-language", function() {
            if ($input.data('atwho')) {
                $input.atwho('destroy');
                addAtWhoToInput();
            }
        });
    };

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
