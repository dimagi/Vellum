/**
 * Command bar plugin
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
        handlers = {};

    $.vellum.plugin('commander', {}, {
        init: function () {
            var vellum = this,
                cmd = vellum.data.commander;
            cmd.vellum = vellum;
            cmd.container = $(commanderTemplate());
            cmd.addQuestionButton = vellum.$f.find(".fd-add-question");
            cmd.input = cmd.container.find("input");
            cmd.input.on("keydown", function (e) {
                var chord = util.getKeyChord(e);
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
        },
        getToolsMenuItems: function () {
            var menuItems = this.__callOld();
            menuItems.splice(menuItems.length - 1, 0, {
                name: gettext('Command Bar'),
                icon: "fa fa-terminal",
                hotkey: "Ctrl+;",
                action: function () { showCommander(this.data.commander); },
            });
            return menuItems;
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
        _.extend(cmd, configure(cmd.vellum));
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

    function configure(vellum) {
        function getMugClassName(typeName) {
            typeName = typeName.toLowerCase();
            if (mugTypes.hasOwnProperty(typeName)) {
                return mugTypes[typeName].__className;
            }
        }

        function getPosition(position) {
            if (position) {
                position = position.toLowerCase();
                if (positionMap.hasOwnProperty(position)) {
                    position = positionMap[position];
                }
            }
            return position;
        }

        function getMug(path) {
            var refMug;
            if (path) {
                refMug = vellum.getMugByPath(path);
                if (!refMug) {
                    throw new Error("bad path: " + path);
                }
            } else {
                refMug = vellum.getCurrentlySelectedMug();
            }
            return refMug;
        }

        function literals(names, getArg) {
            if (!getArg) {
                throw new Error("getArg parameter is required");
            }
            var source = _.map(names, RegExp.escape).join("|");
            return {regexp: source, names: names, getArg: getArg};
        }

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

        function tokenize(command) {
            var i, tokens;
            command = command.trim();
            for (i = 0; i < tokenizers.length; i++) {
                tokens = tokenizers[i].exec(command);
                if (tokens) {
                    return {
                        tokens: _.tail(tokens),
                        config: tokenizers[i].config,
                    };
                }
            }
        }

        function dispatch(command) {
            var obj = tokenize(command), args;
            if (!obj) {
                return;
            }
            try {
                args = _.map(obj.tokens, function (token, i) {
                    return obj.config.args[i].getArg(token);
                });
            } catch (err) {
                return;  // fail on bad argument
            }
            return obj.config.run(args);
        }

        var callbacks = $.fn.atwho["default"].callbacks,
            mugTypes = fn.getQuestionMap(vellum),
            typeNames = _.pluck(mugTypes, "typeName"),
            positions = ["after", "before", "in", "first in"],
            positionMap = {"in": "into", "first in": "first"},
            questionRef = {regexp: /[#\/][^\s]+/.source, getArg: getMug},
            tokenizers = [],
            forms = [],
            commandConfigs = [
                // command configurations
                {
                    // add question
                    args: [
                        literals(typeNames, getMugClassName),
                        literals(positions, getPosition),
                        questionRef,
                    ],
                    run: function (args) {
                        try {
                            return vellum.addQuestion.apply(vellum, args);
                        } catch (err) {
                            //window.console.log(err.message);
                        }
                    }
                },
                //{
                //    // delete question
                //    args: [
                //        literals([":Delete"], function () {}),
                //        // TODO implement {n: '*'} - varargs
                //        _.extend({n: '*'}, questionRef),
                //    ],
                //    run: function (args) {
                //        var mug = args[1];
                //        if (mug) {
                //            vellum.data.core.form.removeMugsFromForm([mug]);
                //            vellum.refreshCurrentMug();
                //            return mug;
                //        }
                //    }
                //},
                {
                    // select question
                    args: [questionRef],
                    run: function (args) {
                        var mug = args[0];
                        if (mug) {
                            vellum.setCurrentMug(mug);
                            vellum.scrollTreeTo(mug.ufid);
                            vellum.focusFirstInput();
                            return mug;
                        }
                    }
                },
            ];

        _.each(commandConfigs, function (commandConfig) {
            var seen = [],
                args = [],
                index = forms.length;
            _.each(commandConfig.args, function (arg) {
                if (arg.names) {
                    var parts = seen.concat(["(.*)$"]);
                    forms.splice(index, 0, {
                        regexp: new RegExp("^" + parts.join("\\s+"), "i"),
                        items: _.map(arg.names, itemizer("")),
                    });
                }
                seen.push("(?:" + arg.regexp + ")");
                if (args.length < 1) {
                    args.push("^(" + arg.regexp + ")");
                } else {
                    args.push("(?:\\s+(" + arg.regexp + ")");
                }
            });
            args.push.apply(args, _.map(args, function () { return ")?"; }));
            args[args.length - 1] = "$";
            var tokenizer = new RegExp(args.join(""), "i");
            tokenizer.config = commandConfig;
            tokenizers.push(tokenizer);
        });

        return {
            tokenize: tokenize,
            dispatch: dispatch,
            atwhoConfig: {
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

    handlers.Tab = function () { /* prevent default */ };
    handlers.Enter = onCommand;
    handlers.Return = onCommand;
    handlers.Escape = hideCommander;

    /**
     * For testing internal atwho config
     */
    fn.getCompletions = function (command, vellum) {
        var cfg = configure(vellum).atwhoConfig;
        return cfg.callbacks.filter(command, null, cfg.searchKey);
    };

    /**
     * For testing internal tokenizer
     */
    fn.tokenize = function (command, vellum) {
        return configure(vellum).tokenize(command);
    };

    fn.doCommand = function (command, vellum) {
        var cmd = vellum.data.commander;
        if (!cmd.dispatch) {
            _.extend(cmd, configure(vellum));
        }
        return cmd.dispatch(command);
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
