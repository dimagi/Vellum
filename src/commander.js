/**
 * Command bar plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/analytics',
    'vellum/atwho',
    'vellum/util',
    'tpl!vellum/templates/commander',
], function (
    $,
    _,
    analytics,
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
            cmd.container.find(".fd-commander-close").click(function (e) {
                hideCommander(cmd);
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

    /**
     * Create a commander configuration for the given vellum instance
     *
     * A commander configuration contains an atwho configuration as well
     * as `tokenize` and `dispatch` functions for processing commands.
     */
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

        /**
         * Get an commander argument config for a list of literal names
         *
         * @param items - array of atwho completion items. Each item
         * must have a "name" property.
         * @param getArg - function to get argument given parsed
         * argument string.
         * @returns argument config object.
         */
        function literals(items, getArg) {
            if (!getArg) {
                throw new Error("getArg parameter is required");
            }
            var source = _.map(items, function (item) {
                return RegExp.escape(item.name);
            }).join("|");
            return {regexp: source, items: items, getArg: getArg};
        }

        /**
         * Atwho filter callback
         *
         * @param query - command query (from beginning of command input
         * to caret.
         * @param data - ignored.
         * @param key - item key (searchKey) to use when matching.
         * @returns array of items that complete the given command
         * (query) string.
         */
        function filter(query, data, key) {
            var items = [];
            _.each(forms, function (form) {
                var match = form.exec(query);
                if (match) {
                    var lastMatch = match[match.length - 1],
                        prefix = lastMatch ? query.slice(0, -lastMatch.length) : query,
                        subquery = lastMatch.trimLeft(),
                        // use default atwho filter to match items
                        matched = callbacks.filter(subquery, form.items, key);
                    // add `prefix` to matched items' `full` member
                    matched = _.map(matched, function (item) {
                        return {
                            name: item.name,
                            icon: item.icon,
                            full: prefix + item.name,
                        };
                    });
                    Array.prototype.push.apply(items, matched);
                }
            });
            return items;
        }

        /**
         * Tokenize a command string
         *
         * @param command - command string.
         * @returns an object with two members:
         *  ```
         *  {
         *      tokens: [argument strings array],
         *      config: {command config object},
         *  }
         *  ```
         *  or `undefined` if the command was not recognized.
         */
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

        /**
         * Parse and execute a command using the command config of the
         * first tokenizer that matches the given command string.
         *
         * @param command - command string.
         * @returns the result of the command, `undefined` on failure.
         */
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
            typeItems = _.map(mugTypes, function (type) {
                return {name: type.typeName, icon: type.icon};
            }),
            positions = _.map(["after", "before", "in", "first in"], function (name) {
                return {name: name};
            }),
            positionMap = {"in": "into", "first in": "first"},
            questionRef = {regexp: /[#\/][^\s]+/.source, getArg: getMug},
            tokenizers = [],
            forms = [],
            commandConfigs = [
                // The objects in this array define the structure of
                // commands recognized by the commander.
                //
                // All arguments after the first are optional.
                //
                // The order of objects in this array is important:
                // command auto-complete lists will be constructed with
                // items of the first matching config first, items of
                // the second matching config after those of the first,
                // and so on. Normally this is only important for the
                // first argument since it is unlikely (and probably
                // undesirable) for two command forms to match the same
                // first argument.
                {
                    // add question: Type name [position [#question]]
                    args: [
                        literals(typeItems, getMugClassName),
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

        /**
         * Construct command forms and tokenizers.
         *
         * A command form is a regular expression matching a potential
         * command. Each form has an `items` attribute referencing an
         * array of completion items for the command. Text matched by
         * the last capturing group in the regular expression is used
         * to match potential completions for the argument at that
         * position.
         *
         * A tokenizer is a regular expression object that matches a
         * valid command string. Its capturing groups correspond to
         * argument tokens. Each tokenizer has a `config` attribute
         * that references the original command configuration object.
         */
        _.each(commandConfigs, function (commandConfig) {
            var seen = [],
                args = [],
                index = forms.length;
            _.each(commandConfig.args, function (arg) {
                if (arg.items) {
                    var parts = seen.concat(["(.*)$"]),
                        form = new RegExp("^" + parts.join("\\s+"), "i");
                    form.items = arg.items;
                    forms.splice(index, 0, form);
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
                displayTpl: '<li><i class="${icon}" /> ${name}</li>',
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
            _.defer(onCommand, cmd);
        } else {
            var text = cmd.input.val(),
                ok = fn.doCommand(text, cmd.vellum);
            if (ok) {
                hideCommander(cmd);
                analytics.workflow("Commander success");
            } else {
                cmd.input.addClass("alert-danger");
                analytics.workflow("Commander fail");
            }
        }
    }

    handlers.Tab = function () { /* prevent default */ };
    handlers.Enter = onCommand;
    handlers.Return = onCommand;
    handlers.Escape = hideCommander;
    handlers.Esc = hideCommander;  // MS Edge

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
                    var type = types[name];
                    return [type.typeName.toLowerCase(), type];
                })
                .object()
                .value();
            cmd.questions.choice = types.Choice;
        }
        return cmd.questions;
    };

    return fn;
});
