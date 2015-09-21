define([
    'underscore',
    'jquery'
], function (
    _,
    $
) {
    var that = {};

    // stripped down version of http://codepen.io/ImagineProgramming/storydump/javascript-memoization-timeout
    var timed = function timed(f, timeout) {
        var cache, time = 0;

        return function TimedMemoizedFunction() {
            var now = +new Date(),
                timedOut = (now - time) >= timeout;

            if(timedOut || _.isUndefined(cache)) {
                cache = f.apply(f, arguments);
                if (timedOut) {
                    time = now;
                }
            }

            return cache;
        };
    };

    var cachedMugData = timed(function(form) {
        return _.chain(form.getMugList())
                .map(function(mug) {
                    return {
                        id: mug.ufid,
                        name: mug.absolutePath,
                        icon: mug.options.icon,
                        questionId: mug.p.nodeID,
                    };
                })
                .filter(function(choice) { return choice.name; })
                .value();
    }, 500);

    function bubble(outputValue) {
        var retBub = $('<span>')
            .addClass('label label-datanode label-datanode-internal')
            .attr({
                'data-value': "${name}",
                'data-output-value': outputValue,
            })
            .append($('<i>').addClass('${icon}').append('&nbsp;'))
            .append('${questionId}')
            .append($('<button>').addClass('close').append('&times;'));

        return $('<div>').append(retBub).html();
    }

    /**
     * Turn a given input into an autocomplete, which will be populated
     * with a given set of choices and will also accept free text.
     *
     * @param $input - jQuery object, the input to turn into an autocomplete
     * @param choices - An array of strings with which to populate the autocomplete
     */
    that.dropdownAutocomplete = function ($input, choices) {
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
            $input.val($input.data("selected-value"));
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
     *                  useRichText: use a bubble template
     *                  outputValue: use output value in the template
     */
    that.questionAutocomplete = function ($input, mug, options) {
        options = _.defaults(options || {}, {
            category: 'Question Reference',
            insertTpl: '${name}',
            property: '',
            outputValue: false,
            useRichText: false,
            functionOverrides: {},
        });

        if (options.useRichText) {
            options.insertTpl = bubble(options.outputValue);
            options.functionOverrides.insert = function(content, $li) {
                this.query.el.remove();
                $input.ckeditor().editor.insertHtml(content);
                if (!this.$inputor.is(':focus')) {
                    this.$inputor.focus();
                }
            };
        }

        $input.atwho({
            at: "/data/",
            data: cachedMugData(mug.form),
            displayTpl: '<li><i class="${icon}" /> ${name}</li>',
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
        }).on("inserted.atwho", function(event, $li, otherEvent) {
            $(this).find('.atwho-inserted').children().unwrap();
        });

        mug.on("teardown-mug-properties", function () {
            $input.atwho('destroy');
        }, null, "teardown-mug-properties");
    };

    return that;
});


