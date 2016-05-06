define([
    'underscore',
    'jquery',
    'vellum/widgets',
    'vellum/util',
    'vellum/atwho',
    'vellum/core'
], function (
    _,
    $,
    widgets,
    util,
    atwho
) {
    return function (mug, language, form, options) {
        var vellum = mug.form.vellum,
            Itext = vellum.data.javaRosa.Itext,
            // todo: id->class
            id = "itext-" + language + "-" + options.itextType,
            widgetClass = options.baseWidgetClass || widgets.richTextarea,
            widget, $input;

        options.language = language;

        if (options.idSuffix) {
            id = id + options.idSuffix;
        }
        options.id = id;
        widget = widgetClass(mug, options);

        $input = widget.input;
        $input.addClass('jstree-drop');

        if (options.path === 'labelItext') {
            if (!mug.supportsRichText()) {
                $input.keydown(function (e) {
                    // deletion of entire output ref in one go
                    if (e && e.which === 8 || e.which === 46) {
                        var control = widget.getControl()[0],
                            pos = util.getCaretPosition(control),
                            val = widget.getValue(),
                            outputBegin = '<output',
                            outputEnd = '/>',
                            start,
                            end,
                            match;
                        if (e.which === 8) { // backspace
                            if (pos > 1) {
                                match = val.substr(pos - 2, 2);
                                if (match === outputEnd) {
                                    start = val.lastIndexOf(outputBegin, pos);
                                    end = pos;
                                }
                            }
                        } else if (e.which === 46) { // delete
                            match = val.substr(pos, outputBegin.length);
                            if (match === outputBegin) {
                                end = val.indexOf(outputEnd, pos);
                                end = end === -1 ? end : end + 2;
                                start = pos;
                            }
                        }
                        if (start || end && start !== -1 && end !== -1) {
                            var noRef = val.slice(0, start) + val.slice(end, val.length);
                            widget.setValue(noRef);
                            util.setCaretPosition(control, start);
                            e.preventDefault();
                        }
                    }
                });
            }

            atwho.questionAutocomplete($input, mug, {
                category: "Output Value",
                insertTpl: '<output value="${name}" />',
                property: "labelItext",
                outputValue: true,
                useRichText: mug.supportsRichText(),
            });
        }

        widget.displayName = options.displayName;
        widget.itextType = options.itextType;
        widget.form = form || "default";

        widget.language = language;
        widget.languageName = util.langCodeToName[widget.language] || widget.language;
        widget.showOneLanguage = Itext.getLanguages().length < 2;
        widget.defaultLang = Itext.getDefaultLanguage();
        widget.isDefaultLang = widget.language === widget.defaultLang;
        widget.isSyncedWithDefaultLang = false;
        widget.hasNodeIdAsDefault = options.path === 'labelItext';

        widget.getItextItem = function () {
            // Make sure the real itextItem is being updated at all times, not a stale one.
            return options.getItextByMug(widget.mug);
        };

        widget.getItextValue = function (lang) {
            var itextItem = widget.getItextItem();
            if (!lang) {
                lang = widget.language;
            }
            return itextItem && itextItem.get(widget.form, lang);
        };

        widget.setItextValue = function (value) {
            var itextItem = widget.getItextItem();
            if (itextItem) {
                if (widget.isDefaultLang) {
                    widget.mug.fire({
                        type: 'defaultLanguage-itext-changed',
                        form: widget.form,
                        prevValue: itextItem.get(widget.form, widget.language),
                        value: value,
                        itextType: widget.itextType
                    });
                }
                itextItem.getForm(widget.form).setValue(widget.language, value);
                widget.fireChangeEvents();
            }
        };

        widget.getLangDesc = function () {
            if (widget.showOneLanguage) {
                return "";
            }
            return " (" + widget.languageName + ")";
        };

        widget.getDisplayName = function () {
            return widget.displayName + widget.getLangDesc();
        };

        widget.init = function (loadDefaults) {
            // Note, there are TWO defaults here.
            // There is the default value when this widget is initialized.
            // There is the value of the default language.
            if (loadDefaults) {
                var defaultValue = widget.getDefaultValue();
                widget.getItextItem().getOrCreateForm(widget.form);
                widget.setValue(defaultValue);
                widget.handleChange();
            } else {
                var value = widget.getItextValue();

                if (!_.isString(value)) {
                    if (!widget.isDefaultLang) {
                        value = widget.getItextValue(widget.defaultLang) || "";
                    } else {
                        value = widget.hasNodeIdAsDefault ? widget.mug.p.nodeID : "";
                    }
                }

                widget.setItextValue(value);
                widget.setValue(value);
            }
        };

        var _updateValue = widget.updateValue;
        widget.updateValue = function () {
            _updateValue();
            if (!widget.getValue() && !widget.isDefaultLang) {
                widget.setItextValue(widget.getItextValue(widget.defaultLang));
            }
        };

        widget.destroy = function (e) {
            if (e.form === widget.form) {
                widget.fireChangeEvents();
            }
        };

        widget.mug.on('question-itext-deleted', widget.destroy, null, widget);

        widget.toggleDefaultLangSync = function (val) {
            widget.isSyncedWithDefaultLang = !val && !widget.isDefaultLang;
        };

        widget.getDefaultValue = function () {
            return null;
        };

        if (widget.hasNodeIdAsDefault && widget.isDefaultLang) {
            widget.mug.on('property-changed', function (e) {
                if (e.property === "nodeID") {
                    if (widget.getItextValue() === e.previous) {
                        widget.setItextValue(e.val);
                        widget.setValue(e.val);
                    }
                }
            }, null, "teardown-mug-properties");
        }

        if (!widget.isDefaultLang) {
            widget.mug.on('defaultLanguage-itext-changed', function (e) {
                if (e.form === widget.form && e.itextType === widget.itextType) {
                    if (widget.getItextValue() === e.prevValue) {
                        // Make sure all the defaults keep in sync.
                        widget.setItextValue(e.value);
                        widget.setValue(e.value);
                    }
                }
            }, null, "teardown-mug-properties");
        }

        widget.fireChangeEvents = function () {
            var itextItem = widget.getItextItem();
            if (!itextItem) {
                return;
            }
            // todo: move this out of the widget
            // this is one of three things that are relatively similar,
            // including refreshVisibleData()
            // Update any display values that are affected
            // NOTE: This currently walks the whole tree since you may
            // be sharing itext IDs. Generally it would be far more
            // efficient to just do it based off the currently changing
            // node. Left as a TODO if we have performance problems with
            // this operation, but the current behavior is more correct.
            var allMugs = mug.form.getMugList();
            if (vellum.data.core.currentItextDisplayLanguage === widget.language) {
                allMugs.map(function (mug) {
                    var treeName = itextItem.get(widget.form, widget.language) || 
                            mug.form.vellum.getMugDisplayName(mug),
                        it = mug.p.labelItext;
                    if (it && it.id === itextItem.id && widget.form === "default") {
                        mug.form.fire({
                            type: 'question-label-text-change',
                            mug: mug,
                            text: treeName
                        });
                    }
                });
            }
        };

        widget.refreshMessages = function () {
            widget.getMessagesContainer()
                .empty()
                .append(widget.getMessages(mug, widget.id));
        };

        widget.save = function () {
            widget.setItextValue(widget.getValue());
        };

        return widget;
    };
});
