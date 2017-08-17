/**
 * External data source tree/browser plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/atwho',
    'vellum/util',
    'tpl!vellum/templates/commander',
], function (
    $,
    _,
    atwho,
    util,
    commanderTemplate
) {
    var fn = {},
        handlers = {},
        isMac = /Mac/.test(navigator.platform),
        INSERT_AT = /^(.+) +(before|after|into|in|first|first in|last)(?: +((?:#form|\/data)\/[^\s]+))?$/,
        MUG_PATH = /^((?:#form|\/data)\/[^\s]+)$/;

    $.vellum.plugin('commander', {}, {
        init: function () {
            var vellum = this,
                cmd = vellum.data.commander;
            cmd.vellum = vellum;
            cmd.container = $(commanderTemplate());
            cmd.addQuestionButton = vellum.$f.find(".fd-add-question");
            cmd.input = cmd.container.find("input");
            cmd.input.on("keydown", function (e) {
                var chord = getKeyChord(e);
                if (handlers.hasOwnProperty(chord)) {
                    handlers[chord](cmd);
                    e.preventDefault();
                } else {
                    cmd.input.removeClass("alert-danger");
                }
            });
            cmd.container.find(".fd-add-question-toggle").click(function (e) {
                hideCommander(cmd);
                e.preventDefault();
                setTimeout(function () {
                    // open add question menu after delay to allow atwo menu
                    // to hide. https://stackoverflow.com/a/29572644/10840
                    $(".fd-add-question-dropdown").addClass('open');
                }, 0);
            });
            $(".fd-add-question-dropdown").append(cmd.container.hide());
            $(document).on("keydown", function (e) {
                if (getKeyChord(e) === "Ctrl+;") {
                    showCommander(cmd);
                }
            });
        },
    });

    function showCommander(cmd) {
        setupAutocomplete(cmd);
        cmd.addQuestionButton.hide();
        cmd.container.show();
        cmd.input.focus().select();
    }

    function hideCommander(cmd) {
        cmd.addQuestionButton.show();
        cmd.container.hide();
        cmd.input.val("").removeClass("alert-danger");
    }

    function setupAutocomplete(cmd) {
        if (cmd.atwhoConfig) {
            return;
        }
        var typeNames = _.pluck(fn.getQuestionMap(cmd.vellum), "typeName"),
            positions = ["after", "before", "in", "first in"],
            questionRe = /[#\/][^\s]+/;
        cmd.atwhoConfig = getAtwhoConfig([
            [literals(typeNames), literals(positions), {regexp: questionRe.source}],
            [{regexp: questionRe.source}],
        ]);
        cmd.input.atwho(cmd.atwhoConfig);
        atwho.autocomplete(
            cmd.input,
            {form: cmd.vellum.data.core.form, on: _.identity},  // fake mug
            {useHashtags: true, tabSelectsMatch: true}          // options
        );
        cmd.input.on("inserted.atwho", function (event) {
            event.preventDefault();
        });
    }

    function literals(names) {
        var source = "(" + _.map(names, RegExp.escape).join("|") + ")";
        return {regexp: source, names: names};
    }

    function getAtwhoConfig(commandForms) {
        function xname(predicate) {
            return function (item) {
                return predicate(item.name);
            };
        }

        function itemizer(prefix) {
            return function (name) {
                return {name: name, full: prefix + name};
            };
        }

        function filter(query, data, key) {
            var items = [];
            _.each(forms, function (form) {
                var match = form.regexp.exec(query);
                if (match) {
                    var lastMatch = match[match.length - 1],
                        prefix = lastMatch ? query.slice(0, -lastMatch.length) : query,
                        subquery = lastMatch.trimLeft(),
                        matched = callbacks.filter(subquery, form.items, key);
                    matched = _.map(matched, xname(itemizer(prefix)));
                    Array.prototype.push.apply(items, matched);
                }
            });
            return items;
        }

        var callbacks = $.fn.atwho["default"].callbacks,
            forms = [];

        _.each(commandForms, function (argSet) {
            var seen = [];
            _.each(argSet, function (argInfo) {
                if (argInfo.names) {
                    var parts = seen.concat(["(.*)$"]);
                    forms.splice(0, 0, {
                        regexp: new RegExp("^" + parts.join("\\s+"), "i"),
                        items: _.map(argInfo.names, itemizer("")),
                    });
                }
                seen.push(argInfo.regexp);
            });
        });

        return {
            at: "",
            data: [],
            limit: 50,
            maxLen: Infinity,
            insertTpl: "${full}",
            suffix: " ",
            searchKey: $.fn.atwho["default"].searchKey,
            tabSelectsMatch: true,
            callbacks: {
                matcher: function (flag, subtext) { return subtext; },
                filter: filter,
                sorter: function(query, items) { return items; },
            },
        };
    }

    function onCommand(cmd) {
        if (cmd.input.atwho('isSelecting')) {
            // HACK delay until value has been inserted
            setTimeout(function () { onCommand(cmd); }, 0);
        } else {
            var text = cmd.input.val(),
                ok = fn.doCommand(text, cmd.vellum);
            if (ok) {
                hideCommander(cmd);
            } else {
                cmd.input.addClass("alert-danger");
            }
        }
    }

    function getKeyChord(e) {
        var ctrlKey = (isMac && e.metaKey) || (!isMac && e.ctrlKey),
            metaKey = (isMac && e.ctrlKey) || (!isMac && e.metaKey),
            key = (ctrlKey ? "Ctrl+" : "") +
                  (e.altKey ? "Alt+" : "") +
                  (e.shiftKey ? "Shift+" : "") +
                  (metaKey ? "Meta+" : "") + e.key; // TODO investigate e.key portability
            return key;
    }

    handlers.Tab = function () {};
    handlers.Enter = onCommand;
    handlers.Return = onCommand;
    handlers.Escape = hideCommander;

    /**
     * This is for testing internal atwho config
     */
    fn.getCompletions = function (command, vellum) {
        var cmd = vellum.data.commander;
        setupAutocomplete(cmd);
        var config = cmd.atwhoConfig;
        return config.callbacks.filter(command, null, config.searchKey);
    };

    fn.doCommand = function (command, vellum) {
        command = command.trim();
        var types = fn.getQuestionMap(vellum),
            insertAt = INSERT_AT.exec(command),
            typeName = (insertAt ? insertAt[1] : command).toLowerCase(),
            position, refMug;
        if (types.hasOwnProperty(typeName)) {
            // add new question
            var className = types[typeName].__className;
            if (insertAt) {
                position = insertAt[2].toLowerCase();
                if (position === "in") {
                    position = "into";
                } else if (position === "first in") {
                    position = "first";
                }
                if (insertAt[3]) {
                    refMug = vellum.getMugByPath(insertAt[3]);
                    if (!refMug) {
                        return;
                    }
                } else {
                    refMug = vellum.getCurrentlySelectedMug();
                }
            }
            try {
                return vellum.addQuestion(className, position, refMug);
            } catch (err) {
                //window.console.log(err.message);
            }
            return;
        }
        var mugPath = MUG_PATH.exec(command);
        if (mugPath) {
            // jump to question
            var mug = vellum.getMugByPath(command);
            if (mug) {
                vellum.setCurrentMug(mug);
                // TODO select first input field
                return mug;
            }
        }
    };

    fn.getQuestionMap = function (vellum) {
        var cmd = vellum.data.commander,
            types = vellum.data.core.mugTypes;
        if (!cmd.hasOwnProperty("questions")) {
            cmd.questions = _.chain(vellum.data.core.QUESTIONS_IN_TOOLBAR)
                .map(function (name) {
                    var mug = types[name];
                    return [mug.typeName.toLowerCase(), mug];
                })
                .object()
                .value();
            cmd.questions.choice = types.Choice;
        }
        return cmd.questions;
    };

    return fn;
});
