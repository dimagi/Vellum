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
        INSERT_AT = /^(.*) +(before|after|into|in|first|last)(?: +((?:#form|\/data)\/[^ ]+))? *$/;

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
        if (!cmd.autocompleted) {
            var names = _.pluck(fn.getQuestionMap(cmd.vellum), "typeName");
            setupAutocomplete(cmd.input, names);
            cmd.autocompleted = true;
        }
        cmd.addQuestionButton.hide();
        cmd.container.show();
        cmd.input.focus().select();
    }

    function hideCommander(cmd) {
        cmd.addQuestionButton.show();
        cmd.container.hide();
        cmd.input.val("").removeClass("alert-danger");
    }

    function setupAutocomplete(input, choices) {
        input.atwho({
            at: "",
            data: choices,
            limit: 50,
            maxLen: Infinity,
            suffix: " ",
            tabSelectsMatch: true,
        });
        input.on("inserted.atwho", function (event, item) {
            event.preventDefault();
        });
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

    handlers.Enter = onCommand;
    handlers.Return = onCommand;
    handlers.Escape = hideCommander;

    fn.doCommand = function (text, vellum) {
        text = text.toLowerCase().trim();
        var types = fn.getQuestionMap(vellum),
            insertAt = INSERT_AT.exec(text),
            position, refMug;
        if (insertAt) {
            text = insertAt[1];
        }
        if (types.hasOwnProperty(text)) {
            if (insertAt) {
                position = insertAt[2];
                if (position === "in") {
                    position = "into";
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
                return vellum.addQuestion(types[text].__className, position, refMug);
            } catch (err) {
                //window.console.log(err.message);
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
