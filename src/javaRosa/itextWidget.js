define([
    'underscore',
    'jquery',
    'tpl!vellum/templates/auto_box',
    'tpl!vellum/templates/markdown_help',
    'vellum/javaRosa/util',
    'vellum/widgets',
    'vellum/util',
    'vellum/atwho',
    'vellum/core'
], function (
    _,
    $,
    auto_box,
    markdown_help,
    jrUtil,
    widgets,
    util,
    atwho
) {
    var DEFAULT_EXTENSIONS = {
            image: 'png',
            audio: 'mp3',
            video: '3gp',
            'video-inline': '3gp'
        };

    var iTextIDWidget = function (mug, options) {
        var widget = widgets.text(mug, options),
            $input = widget.input,
            currentValue = null;

        function autoGenerateId() {
            return jrUtil.getDefaultItextId(mug, widget.path);
        }

        function updateAutoId() {
            _setValue(autoGenerateId());
            setAutoMode(true);
        }

        function unlinkSharedItext() {
            if (currentValue.refCount > 1) {
                currentValue.refCount--;
                currentValue = currentValue.clone();
            }
        }

        var _setValue = widget.setValue;

        widget.setValue = function (value) {
            currentValue = value;
            if (value.autoId) {
                updateAutoId();
            } else {
                _setValue(value.id);
                setAutoMode(false);
            }
        };

        widget.getValue = function() {
            currentValue.id = $input.val();
            currentValue.autoId = getAutoMode();
            return currentValue;
        };

        // auto checkbox
        var $autoBox = $("<input />").attr("type", "checkbox");

        $autoBox.change(function () {
            if ($(this).prop('checked')) {
                unlinkSharedItext();
                updateAutoId();
                widget.handleChange();
            }
        });

        function setAutoMode(autoMode) {
            $autoBox.prop("checked", autoMode);
        }

        function getAutoMode() {
            return $autoBox.prop('checked');
        }

        var _getUIElement = widget.getUIElement;
        widget.getUIElement = function () {
            var $uiElem = _getUIElement().css('position', 'relative'),
                $autoBoxContainer = $(auto_box());

            $autoBoxContainer.find("label").prepend($autoBox);
            $uiElem.find('.controls')
                .removeClass("col-sm-9")
                .addClass("col-sm-8")
                .after($autoBoxContainer);

            return $uiElem;
        };

        widget.input.keyup(function () {
            // turn off auto-mode if the id is ever manually overridden
            var newVal = $(this).val();
            if (newVal !== autoGenerateId()) {
                setAutoMode(false);
            }
        });

        mug.on("property-changed", function (e) {
            if (getAutoMode() && e.property === "nodeID") {
                $input.val(autoGenerateId());
            }
        }, null, "teardown-mug-properties");

        return widget;
    };

    var itextLabelWidget = function (mug, language, form, options) {
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
            if (!mug.form.richText) {
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
        }

        if (_.contains(jrUtil.ITEXT_PROPERTIES, options.path)) {
            atwho.autocomplete($input, mug, {
                category: "Output Value",
                insertTpl: '<output value="${name}" />',
                property: "labelItext",
                outputValue: true,
                useRichText: mug.form.richText,
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
            var itextItem = widget.getItextItem(), value;
            if (!lang) {
                lang = widget.language;
            }
            value = itextItem && itextItem.get(widget.form, lang);
            if (mug.form.richText) {
                return jrUtil.outputToHashtag(value, widget.mug.form.xpath);
            } else {
                return jrUtil.outputToXPath(value, widget.mug.form.xpath);
            }
        };

        widget.setItextValue = function (value) {
            var itextItem = widget.getItextItem();
            // TODO should not be using hashtags when rich text is off
            //if (mug.form.richText) {
            value = jrUtil.outputToHashtag(value, widget.mug.form.xpath);
            //}
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
                        widget.setValue(widget.getItextValue());
                    }
                }
            }, null, "teardown-mug-properties");
        }

        if (!widget.isDefaultLang) {
            widget.mug.on('defaultLanguage-itext-changed', function (e) {
                if (e.form === widget.form && e.itextType === widget.itextType) {
                    if (widget.getItextValue() === e.prevValue) {
                        // Make sure all the defaults keep in sync.
                        // why doesn't setValue set the itext value?
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

    var itextMarkdownWidget = function (mug, language, form, options) {
        options = options || {};
        var parent = options.parent;
        var widget = itextLabelWidget(mug, language, form, options),
            super_setValue = widget.setValue,
            super_getUIElement = widget.getUIElement,
            super_handleChange = widget.handleChange,
            wantsMarkdown = true,
            markdownOff, markdownOn, markdownOutput;

        widget.toggleMarkdown = function() {
            parent.toggleClass("has-markdown");
            widget.mug.form.fire('change');
        };

        markdownOutput = $('<div>').addClass("controls well markdown-output col-sm-9");

        if (util.isRightToLeftLanguage(options.language)) {
            markdownOutput.attr('dir', 'rtl');
        }

        widget.handleChange = function() {
            super_handleChange();
            var val = widget.getValue(),
                item = widget.getItextItem();
            if (jrUtil.looksLikeMarkdown(val)) {
                if (wantsMarkdown) {
                    parent.removeClass("markdown-ignorant");
                    parent.addClass("has-markdown");
                }
            } else if (!val) {
                parent.removeClass("has-markdown");
            }
            item.hasMarkdown = markdownOff.is(":visible");
            markdownOutput.html(util.markdown(val)).closest('.form-group').removeClass('hide');
        };

        widget.setValue = function (val, callback) {
            super_setValue(val, callback);
            if (!val) {
                markdownOutput.closest('.form-group').addClass('hide');
            }
            markdownOutput.html(util.markdown(val));
        };

        widget.getUIElement = function() {
            var elem = super_getUIElement(),
                val = widget.getValue(),
                markdownSpacer = $("<div />").addClass("col-sm-3"),
                markdownContainer = $("<div />").addClass("col-sm-9"),
                markdownRow = $("<div />").addClass("form-group").addClass("markdown-group");

            elem.detach('.markdown-output');
            markdownRow.append(markdownSpacer);
            markdownContainer.append(markdownOutput);
            markdownRow.append(markdownContainer);
            elem.append(markdownRow);
            elem.find('.control-label').append(markdown_help({title:options.lstring }));

            markdownOff = elem.find('.turn-markdown-off').click(function() {
                wantsMarkdown = false;
                widget.getItextItem().hasMarkdown = false;
                widget.toggleMarkdown();
                return false;
            });
            markdownOn = elem.find('.turn-markdown-on').click(function() {
                wantsMarkdown = true;
                widget.getItextItem().hasMarkdown = true;
                widget.toggleMarkdown();
                return false;
            });

            if (widget.getItextItem().hasMarkdown) {
                parent.addClass("has-markdown");
            }
            else {
                parent.addClass("markdown-ignorant");
            }
            if (jrUtil.looksLikeMarkdown(val)) {
                markdownOutput.html(util.markdown(val));
                markdownOff.removeClass('hide');
            }
            return elem;
        };

        return widget;
    };

    var itextFormWidget = function (mug, language, form, options) {
        options = options || {};
        options.idSuffix = "-" + form;
        var widget = itextLabelWidget(mug, language, form, options);

        widget.getDisplayName = function () {
            return form + widget.getLangDesc();
        };
        return widget;
    };

    var itextMediaWidget = function (url_type) {
        return function (mug, language, form, options) {
            options.baseWidgetClass = widgets.text;
            var widget = itextFormWidget(mug, language, form, options);

            widget.getDefaultValue = function () {
                if (jrUtil.SUPPORTED_MEDIA_TYPES.indexOf(form) !== -1) {
                    // default formats
                    // image: jr://file/commcare/image/form_id/question_id.png
                    // audio: jr://file/commcare/audio/form_id/question_id.mp3
                    var extension = DEFAULT_EXTENSIONS[form];
                    return widget.getBaseMediaPath() + "." + extension;
                }
                return null;
            };

            widget.getBaseMediaPath = function () {
                return "jr://file/commcare/" + form + url_type +
                       jrUtil.getDefaultItextRoot(widget.mug);
            }

            widget.mug.form.vellum.initMediaUploaderWidget(widget);

            return widget;
        };
    };

    return {
        form: itextFormWidget,
        id: iTextIDWidget,
        label: itextLabelWidget,
        markdown: itextMarkdownWidget,
        media: itextMediaWidget,
    };
});
