/*
 * A Vellum plugin to support JavaRosa extensions to the XForm spec,
 * particularly IText.
 *
 * Itext handles text that may be displayed in multiple languages. An IText block contains a translation for
 * each required language. Each translation contains a set of text elements, each with an id and containing
 * one or more values. Each value represents a different form of the text appropriate for that language.
 * (e.g., plain text versus multimedia equivalent).
 * 
 * An IText item may contain multiple forms and also contains an IText model, which tracks the languages
 * available and knows which of those languages is the default. On the UI side, an IText block contains
 * one or more IText widgets, each of which goes with a single language.
 *
 * See https://bitbucket.org/javarosa/javarosa/wiki/ITextAPI
 *
 * Mugs have the following Itext properties:
 *  labelItext: for the question label itself
 *  hintItext: for question hint (visible along with question)
 *  helpItext: for question help (one click away)
 *  constraintMsgItext: for the message to display if the question fails validation
 */
import _ from "underscore";
import $ from "jquery";
import edit_source from "vellum/templates/edit_source.html";
import language_selector from "vellum/templates/language_selector.html";
import dateformats from "vellum/dateformats";
import util from "vellum/util";
import xml from "vellum/xml";
import analytics from "vellum/hqAnalytics";
import itext from "vellum/javaRosa/itext";
import itextBlock from "vellum/javaRosa/itextBlock";
import itextWidget from "vellum/javaRosa/itextWidget";
import richText from "vellum/richText";
import jrUtil from "vellum/javaRosa/util";
import "vellum/core";

var ICONS = {
    image: 'fa-regular fa-image',
    audio: 'fa fa-volume-up',
    video: 'fa fa-video-camera',
    'video-inline': 'fa fa-play',
};

$.vellum.plugin("javaRosa", {
    langs: ['en'],
    displayLanguage: 'en'
}, {
    init: function () {
        this.data.javaRosa.ItextItem = itext.item;
        this.data.javaRosa.ItextForm = itext.form;
        this.data.javaRosa.ICONS = ICONS;
        this.data.javaRosa.showOnlyCurrentLang = this.opts().javaRosa.showOnlyCurrentLang;
    },
    handleDropFinish: function (target, path, mug, event) {
        var inItext = target &&
            target.attr('name') &&
            target.attr('name').lastIndexOf('itext-', 0) === 0,
            _this = this;

        if (inItext) {
            var mugType = mug && mug.options.typeName;
            if (mugType === 'Date') {
                dateformats.showMenu(event.clientX, event.clientY, function (format) {
                    jrUtil.insertOutputRef(_this, target, path, mug, format);
                });
            } else {
                jrUtil.insertOutputRef(_this, target, path, mug);
            }
            var category = util.getReferenceName(path);
            analytics.usage(category, "Drag and Drop", "Label");
        } else {
            _this.__callOld();
        }
    },
    handleNewMug: function (mug) {
        var ret = this.__callOld();
        this.data.javaRosa.Itext.updateForMug(mug);
        return ret;
    },
    _makeLanguageSelectorDropdown: function () {
        var _this = this,
            langs = this.data.javaRosa.Itext.getLanguages(),
            $menu = this.$f.find('.fd-questions-menu'),
            $items,
            $input,
            fullLangs;

        fullLangs = _.map(langs, function (lang) {
            return {
                code: lang,
                name: util.langCodeToName[lang] || lang
            };
        });
        fullLangs[fullLangs.length] = {
            code: '_ids',
            name: gettext('Question ID')
        };

        if (fullLangs.length < 2) {
            return;
        }
        $menu.find('.language-selector').remove();
        $menu.find('.fd-bulk-update-menu').before(language_selector({languages: fullLangs}));
        $items = $menu.find(".fd-display-item");
        $items.click(function (e) {
            $input.val($(this).data("code")).change();
            e.preventDefault();
        });

        $input = $menu.parent().find('.fd-question-tree-display');
        $input.change(function () {
            var code = $input.val();
            _this._changeTreeDisplayLanguage(code);
            $items.removeClass("selected")
                  .filter("[data-code=" + code + "]").addClass("selected");
        });
        $input.val(this.data.core.currentItextDisplayLanguage).change();
    },
    _changeTreeDisplayLanguage: function (lang) {
        var _this = this,
            form = this.data.core.form;

        // todo: getMugDisplayName should not rely on this state, it should be
        // passed
        this.data.core.currentItextDisplayLanguage = lang;

        // this shares most of the same functionality as refreshVisibleData().
        // todo: refactor into one method
        this.data.core.$tree.find('li').each(function (i, el) {
            var $el = $(el),
                mug = form.getMugByUFID($el.prop('id'));

            if (_this.data.core.currentItextDisplayLanguage === "_ids") {
                _this.jstree('rename_node', $el, mug.getNodeID());
            }
            else {
                if (mug.p.labelItext) {
                    var text = _this.getMugDisplayName(mug);
                    _this.jstree('rename_node', $el, text ||
                            _this.opts().core.noTextString);
                }
            }
        });

        if (form) {
            form.fire({
                type: 'change-display-language',
            });
        }
    },
    // parse Itext Block and populate itext model
    loadXML: function (xmlString) {
        var _this = this,
            langs = this.opts().javaRosa.langs,
            Itext, itextMap;

        this.data.javaRosa.Itext = Itext = new itext.model();
        this.data.javaRosa.itextMap = itextMap = {};

        function eachLang() {
            var el = $(this);
            var lang = el.xmlAttr('lang');

            function eachText() {
                var textEl = $(this);
                var id = textEl.xmlAttr('id');
                var item = itextMap[id];
                if (!item || !itextMap.hasOwnProperty(id)) {
                    item = Itext.createItem(id);
                    item.refCount = 0;
                    itextMap[id] = item;
                }

                function eachValue() {
                    var valEl = $(this);
                    var curForm = valEl.xmlAttr('form');
                    if(!curForm) {
                        curForm = "default";
                        if (item.hasMarkdown) {
                            return; // value already set below
                        }
                    } else if (curForm === "markdown") {
                        // the default and markdown forms will always be
                        // the same
                        item.hasMarkdown = true;
                        item.getOrCreateForm("default")
                            .setValue(lang, valEl);
                        return;
                    }
                    item.getOrCreateForm(curForm)
                        .setValue(lang, valEl);
                }
                textEl.children().each(eachValue);
            }

            if (langs && langs.indexOf(lang) === -1) {
                return;  // ignore if not in app languages
            }
            Itext.addLanguage(lang);

            //loop through children
            el.children().each(eachText);
        }


        if (langs && langs.length > 0) {
            // override the languages with whatever is passed in
            for (var i = 0; i < langs.length; i++) {
                Itext.addLanguage(langs[i]);
            }
            // the first language is the default
            Itext.setDefaultLanguage(langs[0]);
        }

        if (xmlString) {
            var head = xml.parseXML(xmlString).find('h\\:head, head'),
                itextBlock = head.find('itext');

            $(itextBlock).children().each(eachLang);
        }

        this.data.core.currentItextDisplayLanguage =
            this.opts().javaRosa.displayLanguage ||
            Itext.getDefaultLanguage();

        this._makeLanguageSelectorDropdown();

        this.__callOld();

        delete this.data.javaRosa.itextMap;
        Itext.on('change', function () { _this.onFormChange(); });
    },
    onXFormLoaded: function (form) {
        function _toHashtag(value) {
            try {
                return form.xpath.parse(value).toHashtag();
            } catch (err) {
                return value;
            }
        }
        var langs = this.opts().javaRosa.langs;
        // detect hashtag references in output values
        jrUtil.forEachItextItem(form, function (item, mug) {
            _(item.forms).each(function (itForm) {
                _.each(langs, function (lang) {
                    var text = itForm.getValue(lang);
                    if (!text) { return; }
                    text = richText.sanitizeInput(text);
                    var xquery = xml.query(text);
                    xquery.find('output').replaceWith(function() {
                        var output = $(this),
                            key = output.is("[value]") ||
                                !output.is("[ref]") ? "value" : "ref",
                            vkey = "vellum:" + key,
                            value = output.xmlAttr(key),
                            hashval = output.xmlAttr(vkey);
                        if (hashval) {
                            if (value) {
                                form.inferHashtagMeanings(hashval, value);
                            }
                            value = hashval;
                        } else {
                            // hashtagify xpath expression if possible
                            // NOTE the success of this could depend
                            // on whether data sources are loaded,
                            // which means outputs may load differently
                            // based on network conditions.
                            value = _toHashtag(value);
                        }
                        // always use value attribute internally
                        return $("<output />").xmlAttr("value", value);
                    });
                    itForm.setValue(lang, xquery.toString());
                });
            });
        });

        this.__callOld();
    },
    populateControlMug: function(mug, controlElement) {
        this.__callOld();

        var Itext = this.data.javaRosa.Itext,
            itextMap = this.data.javaRosa.itextMap;

        function getITextID(value) {
            try {
                var parsed = mug.form.xpath.parse(value);
                if (parsed instanceof mug.form.xpath.models.XPathFuncExpr &&
                    parsed.id === "jr:itext")
                {
                    return parsed.args[0].value;
                }
            } catch (err) {
                // this seems like a real error since the reference should presumably
                // have been valid xpath, but don't deal with it here
            }
            return "";
        }

        function getItextItem(id, property) {
            var auto = !id || id === jrUtil.getDefaultItextId(mug, property);
            if (id) {
                var item = itextMap[id];
                if (item && itextMap.hasOwnProperty(id)) {
                    if (!auto) {
                        item.autoId = false;
                    }
                    item.refCount++;
                    return item;
                }
            }
            return Itext.createItem(id, auto);
        }

        function parseItextRef($el, property) {
            var ref = $el.xmlAttr('ref');
            return getItextItem(ref ? getITextID(ref) : "", property);
        }

        var labelEl = controlElement.children('label'),
            hintEl = controlElement.children('hint'),
            helpEl = controlElement.children('help'),
            alertEl = controlElement.children('alert');
        if (labelEl.length && mug.getPresence("label") !== 'notallowed') {
            var labelItext = parseItextRef(labelEl, "label"),
                labelVal = xml.humanize(labelEl) || mug.getLabelValue();
            labelItext.getOrCreateForm("default").initUndefined(labelVal);
            mug.p.labelItext = labelItext;
        }
        if (hintEl.length && mug.getPresence("hintLabel") !== 'notallowed') {
            mug.p.hintItext = parseItextRef(hintEl, "hint");
        }
        if (helpEl.length && mug.getPresence("label") !== 'notallowed') {
            mug.p.helpItext = parseItextRef(helpEl, "help");
        }
        if (alertEl.length && mug.getPresence("constraintMsgAttr") !== 'notallowed') {
            mug.p.constraintMsgItext = parseItextRef(alertEl, "constraintMsg");
        } else if (mug.p.constraintMsgAttr) {
            var id = getITextID(mug.p.constraintMsgAttr);
            if (id) {
                mug.p.constraintMsgItext = getItextItem(id, "constraintMsg");
                mug.p.constraintMsgAttr = null;
            }
        }

        function parseRepeatItexts(mug, controlElement) {
            var repeatEl = controlElement.children('repeat');
            var addEmptyCaptionEl = repeatEl.children('jr\\:addEmptyCaption'),
                addCaptionEl = repeatEl.children('jr\\:addCaption');
            if (addEmptyCaptionEl.length) {
                mug.p.addEmptyCaptionItext = parseItextRef(addEmptyCaptionEl, "addEmptyCaption");
            }
            if (addCaptionEl.length) {
                mug.p.addCaptionItext = parseItextRef(addCaptionEl, "addCaption");
            }
        }
        if (mug.options.isRepeat && mug.options.customRepeatButtonText) {
            parseRepeatItexts(mug, controlElement);
        }
    },
    handleMugParseFinish: function (mug) {
        this.__callOld();
        this.data.javaRosa.Itext.updateForMug(mug);
    },
    duplicateMugProperties: function (mug) {
        this.__callOld();
        _.each(jrUtil.ITEXT_PROPERTIES, function (path) {
            var itext = mug.p[path];
            if (itext && itext.autoId) {
                mug.p[path] = itext.clone();
            }
        });
    },
    contributeToModelXML: function (xmlWriter, form_) {
        // here are the rules that govern itext
        // 0. iText items which aren't referenced by any questions are
        // cleared from the form.
        // 1. iText nodes for which values in _all_ languages are empty/blank
        // will be removed entirely from the form.
        // 2. iText nodes that have a single value in _one_ language
        // but not others, will automatically have that value copied
        // into the remaining languages. TBD: there should be a UI to
        // disable this feature
        // 3. iText nodes that have multiple values in multiple languages
        // will be properly set as such.
        // 4. duplicate itext ids will be automatically updated to create
        // non-duplicates

        function hashtags(outputRef) {
            var output = $(outputRef),
                key = output.is("[value]") || !output.is("[ref]") ? "value" : "ref",
                vkey = "vellum:" + key,
                value = output.xmlAttr(vkey) || output.xmlAttr(key),
                parsed, hashtag, xpath;
            try {
                parsed = xpathParser.parse(value);
                hashtag = parsed.toHashtag();
                xpath = parsed.toXPath();
            } catch (e) {
                // if outputs are invalid, then the user did something
                // manually, so just write the original value to the xml
                hashtag = value;
                xpath = value;
            }
            if (!form_.richText || xpath === hashtag) {
                output.xmlAttr(key, xpath).removeAttr(vkey);
            } else {
                output.xmlAttr(key, xpath).xmlAttr(vkey, hashtag);
            }
        }

        function writeValue(xmlWriter, val) {
            val = xml.query(val);
            val.find('output').each(function() { hashtags(this); });
            xmlWriter.writeXML(val.toString());
        }

        var xpathParser = form_.xpath,
            Itext = this.data.javaRosa.Itext,
            items = this.data.javaRosa.itextItemsFromBeforeSerialize,
            languages = Itext.getLanguages(),
            item, forms, form, lang, val;
        if (languages.length > 0) {
            xmlWriter.writeStartElement("itext");
            for (var i = 0; i < languages.length; i++) {
                lang = languages[i];
                xmlWriter.writeStartElement("translation");
                xmlWriter.writeAttributeString("lang", lang);
                if (Itext.getDefaultLanguage() === lang) {
                    xmlWriter.writeAttributeString("default", '');
                }
                for (var j = 0; j < items.length; j++) {
                    item = items[j];
                    xmlWriter.writeStartElement("text");
                    xmlWriter.writeAttributeString("id", item.id);
                    forms = item.getForms();
                    for (var k = 0; k < forms.length; k++) {
                        form = forms[k];
                        val = form.getValueOrDefault(lang);
                        xmlWriter.writeStartElement("value");
                        if(form.name !== "default") {
                            xmlWriter.writeAttributeString('form', form.name);
                        }
                        writeValue(xmlWriter, val);
                        xmlWriter.writeEndElement();
                    }
                    if (item.hasMarkdown && !this.data.core.form.noMarkdown) {
                        val = item.getForm('default').getValueOrDefault(lang);
                        xmlWriter.writeStartElement("value");
                        xmlWriter.writeAttributeString('form', 'markdown');
                        writeValue(xmlWriter, val);
                        xmlWriter.writeEndElement();
                    }
                    xmlWriter.writeEndElement();
                }
                xmlWriter.writeEndElement();
            }
            xmlWriter.writeEndElement();
        }
    },
    beforeSerialize: function () {
        this.__callOld();
        // update and dedup all non-empty Itext items IDs
        this.data.javaRosa.itextItemsFromBeforeSerialize =
            jrUtil.getItextItemsFromMugs(this.data.core.form);
    },
    afterSerialize: function () {
        this.__callOld();
        delete this.data.javaRosa.itextItemsFromBeforeSerialize;
    },
    beforeBulkInsert: function (form) {
        this.__callOld();
        this.data.javaRosa.itextById = jrUtil.getItextItemsFromMugs(form, true);
    },
    afterBulkInsert: function () {
        this.__callOld();
        delete this.data.javaRosa.itextById;
    },
    getMugTypes: function () {
        var types = this.__callOld(),
            normal = types.normal;

        normal.Group.spec = util.extend(normal.Group.spec, {
            constraintMsgItext: {
                presence: 'notallowed'
            }
        });

        return types;
    },
    getMugSpec: function () {
        var spec = this.__callOld(),
            that = this,
            databind = spec.databind,
            control = spec.control;

        function itextValidator(property, name) {
            return function (mug) {
                var itext = mug.p[property],
                    hasItext = itext && itext.hasHumanReadableItext();
                if (!hasItext && mug.getPresence(property) === 'required') {
                    if (itext.itextModel.languages.length === 1) {
                        return util.format(
                            gettext("{name} (or multimedia) is required."),
                            {name: name}
                        );
                    } else {
                        return util.format(
                            gettext("{name} (or multimedia) is required for all languages."),
                            {name: name}
                        );
                    }
                }
                if (itext && !itext.autoId && !itext.isEmpty()) {
                    // Itext ID validation
                    if (!itext.id) {
                        return util.format(
                            gettext("{name} Itext ID is required."),
                            {name: name}
                        );
                    } else if (!util.isValidAttributeValue(itext.id)) {
                        return util.format(
                            gettext("{name} is not a valid ID."),
                            {name: itext.id}
                        );
                    }
                }
                return "pass";
            };
        }

        function addSerializer(options) {
            options.serialize = function (value, name, mug, data) {
                var hasText = false;
                _.each(value.forms, function (form) {
                    if (!form.isEmpty()) {
                        hasText = true;
                        _.each(value.itextModel.languages, function (lang) {
                            var key = name + ":" + lang + "-" + form.name;
                            data[key] = form.getValue(lang);
                        });
                    }
                });
                if (hasText && !value.autoId) {
                    data[name] = value.id;
                }
                if (value.hasMarkdown) {
                    data[name + ':hasMarkdown'] = value.hasMarkdown;
                }
            };
            options.deserialize = function (data, name, mug, context) {
                var item = mug.p[name],
                    found = false;
                if (data[name]) {
                    // non-autoId
                    var itext = mug.form.vellum.data.javaRosa.itextById,
                        id = data[name];
                    if (itext.hasOwnProperty(id) && !itext[id].autoId) {
                        mug.p[name] = item = itext[id];
                        item.refCount++;
                    } else {
                        item.id = data[name];
                        item.autoId = false;
                        // possibly (intentionally) overwrites autoId item
                        itext[item.id] = item;
                    }
                }
                var dlang = item.itextModel.getDefaultLanguage(),
                    languages = item.itextModel.languages,
                    nodeID = "",
                    mmForms = _.object(jrUtil.SUPPORTED_MEDIA_TYPES, jrUtil.SUPPORTED_MEDIA_TYPES),
                    // HACK reach into media uploader options
                    objectMap = that.data.uploader.objectMap || {};
                if (data.id) {
                    // a little hacky, but it's a fallback default
                    nodeID = data.id.slice(data.id.lastIndexOf("/") + 1);
                }
                function str(val) {
                    return val === null || val === undefined ? "" : String(val);
                }
                var isEmptyForm = _.memoize(function (form) {
                    return !_.find(languages, function (lang) {
                        return data[name + ":" + lang + "-" + form];
                    });
                });
                _.each(languages, function (lang) {
                    var prelen = name.length + lang.length + 2,
                        regexp = new RegExp("^" +
                                            RegExp.escape(name) + ":" +
                                            RegExp.escape(lang) + "-"),
                        seen = {};
                    _.each(data, function (value, key) {
                        if (regexp.test(key)) {
                            var form = key.slice(prelen),
                                isMM = mmForms.hasOwnProperty(form);
                            if (isMM && !value && isEmptyForm(form)) {
                                // Skip empty multimedia form.
                                return;
                            }
                            if (!seen.hasOwnProperty(form)) {
                                seen[form] = true;
                                // set default value(s) for this form
                                var dkey = name + ":" + dlang + "-" + form,
                                    dval = data.hasOwnProperty(dkey) ?
                                         str(data[dkey]) : str(value);
                                item.set(dval, form);
                                if (!isMM && dval) {
                                    context.later(function () {
                                        item.set(hashtrans(dval, context), form);
                                    });
                                }
                            }
                            item.set(str(value), form, lang);
                            if (!isMM && value) {
                                context.later(function () {
                                    item.set(hashtrans(value, context), form, lang);
                                });
                            }
                            if (isMM && !objectMap.hasOwnProperty(value)) {
                                mug.addMessage(name, {
                                    key: "missing-multimedia-warning",
                                    level: mug.WARNING,
                                    message: gettext("Multimedia was not copied; " +
                                             "it must be uploaded separately."),
                                });
                            }
                            found = true;
                        }
                    });
                });
                if (found && !data[name]) {
                    item.id = jrUtil.getDefaultItextId(mug, name.replace(/Itext$/, ""));
                }
                if (data[name + ":hasMarkdown"]) {
                    item.hasMarkdown = true;
                }
                var WARNING_KEY = "javaRosa-discarded-languages-warning",
                    langRE = new RegExp("^" + RegExp.escape(name) + ":(\\w+)-"),
                    discardedLangs = _.filter(_.map(_.keys(data), function (key) {
                        var match = key.match(langRE);
                        if (match && languages.indexOf(match[1]) === -1) {
                            return match[1];
                        }
                    }), _.identity);
                if (discardedLangs.length) {
                    var msg = context.errors.get(null, WARNING_KEY);
                    if (msg) {
                        msg.langs = _.union(msg.langs, discardedLangs);
                        msg.message = gettext("Discarded languages:") +
                            " " + msg.langs.join(", ");
                    } else {
                        context.errors.update(null, {
                            key: WARNING_KEY,
                            level: mug.WARNING,
                            langs: discardedLangs,
                            message: gettext("Discarded languages:") +
                                " " + discardedLangs.join(", ")
                        });
                    }
                }
                mug.validate(name);
            };

            function hashtrans(val, context) {
                var qry = xml.query(val);
                qry.find('output').each(function() {
                    transformOutputRef(this, context);
                });
                return qry.toString();
            }

            function transformOutputRef(outputRef, context) {
                var output = $(outputRef),
                    key = output.is("[value]") || !output.is("[ref]") ? "value" : "ref",
                    value = output.xmlAttr(key);
                if (value) {
                    output.xmlAttr(key, context.transformHashtags(value));
                }
            }

            return options;
        }

        function trackLogicRefs(widget) {
            widget.trackLogicReferences = true;
            return widget;
        }

        function validateConstraintMsgAttr(mug) {
            var itext = mug.p.constraintMsgItext;
            if (!mug.p.constraintAttr && itext && !itext.isEmpty()) {
                return gettext('You cannot have a Validation Error ' +
                       'Message with no Validation Condition!');
            }
            return 'pass';
        }
        // hide non-itext constraint message; overwritten by javaRosa
        databind.constraintMsgAttr.visibility = "hidden";
        databind.constraintMsgItext = addSerializer({
            visibility: 'visible',
            presence: function (mug) {
                return mug.options.isSpecialGroup ? 'notallowed' : 'optional';
            },
            lstring: gettext('Validation Message'),
            widget: trackLogicRefs(function (mug, options) {
                return itextBlock.label(mug, $.extend(options, {
                    itextType: "constraintMsg",
                    messagesPath: "constraintMsgItext",
                    getItextByMug: function (mug) {
                        return mug.p.constraintMsgItext;
                    },
                    displayName: gettext("Validation Message")
                }));
            }),
            validationFunc: function (mug) {
                var itext = mug.p.constraintMsgItext;
                if (!mug.p.constraintAttr && itext && itext.id && !itext.autoId) {
                    return gettext("Can't have a Validation Message Itext ID without a Validation Condition");
                }
                var result = itextValidator("constraintMsgItext", "Validation Message")(mug);
                if (result === "pass") {
                    result = validateConstraintMsgAttr(mug);
                }
                return result;
            }
        });
        databind.constraintAttr.validationFunc = validateConstraintMsgAttr;
        // virtual property used to define a widget
        databind.constraintMsgItextID = {
            visibility: 'constraintMsgItext',
            presence: 'optional',
            lstring: gettext("Validation Message Itext ID"),
            widget: itextWidget.id,
            widgetValuePath: "constraintMsgItext"
        };
        databind.constraintMediaIText = function (mugOptions) {
            return mugOptions.isSpecialGroup ? undefined : {
                visibility: function(mug) {
                    return mug.isVisible("constraintAttr");
                },
                presence: 'optional',
                lstring: gettext('Add Validation Media'),
                widget: function (mug, options) {
                    return itextBlock.media(mug, $.extend(options, {
                        displayName: gettext("Add Validation Media"),
                        itextType: "constraintMsg",
                        getItextByMug: function (mug) {
                            return mug.p.constraintMsgItext;
                        },
                        forms: jrUtil.SUPPORTED_MEDIA_TYPES,
                        formToIcon: ICONS
                    }));
                }
            };
        };

        // CONTROL ELEMENT

        // hide non-itext messages unless present
        control.label.visibility = "visible_if_present";
        control.hintLabel.visibility = "visible_if_present";

        control.labelItext = addSerializer({
            visibility: 'visible',
            presence: 'optional',
            lstring: gettext("Display Text"),
            widget: trackLogicRefs(function (mug, options) {
                return itextBlock.label(mug, $.extend(options, {
                    itextType: "label",
                    messagesPath: "labelItext",
                    getItextByMug: function (mug) {
                        return mug.p.labelItext;
                    },
                    displayName: gettext("Display Text")
                }));
            }),
            validationFunc: itextValidator("labelItext", gettext("Display Text"))
        });
        // virtual property used to define a widget
        control.labelItextID = {
            visibility: 'labelItext',
            presence: 'optional',
            lstring: gettext("Display Text Itext ID"),
            widget: itextWidget.id,
            widgetValuePath: "labelItext"
        };

        control.hintItext = addSerializer({
            visibility: 'visible',
            presence: function (mug) {
                return mug.options.isSpecialGroup ? 'notallowed' : 'optional';
            },
            lstring: gettext("Hint Message"),
            widget: trackLogicRefs(function (mug, options) {
                return itextBlock.label(mug, $.extend(options, {
                    itextType: "hint",
                    messagesPath: "hintItext",
                    getItextByMug: function (mug) {
                        return mug.p.hintItext;
                    },
                    displayName: gettext("Hint Message")
                }));
            }),
            validationFunc: itextValidator("hintItext", gettext("Hint Message"))
        });
        // virtual property used to get a widget
        control.hintItextID = {
            visibility: 'hintItext',
            lstring: gettext("Hint Itext ID"),
            widget: itextWidget.id,
            widgetValuePath: "hintItext"
        };

        control.helpItext = addSerializer({
            visibility: 'visible',
            presence: function (mug) {
                return mug.options.isSpecialGroup ? 'notallowed' : 'optional';
            },
            lstring: gettext("Help Message"),
            widget: trackLogicRefs(function (mug, options) {
                var block = itextBlock.label(mug, $.extend(options, {
                    itextType: "help",
                    messagesPath: "helpItext",
                    getItextByMug: function (mug) {
                        return mug.p.helpItext;
                    },
                    displayName: gettext("Help Message"),
                }));

                return block;
            }),
            validationFunc: itextValidator("helpItext", gettext("Help Message"))
        });
        // virtual property used to get a widget
        control.helpItextID = {
            visibility: 'helpItext',
            lstring: gettext("Help Itext ID"),
            widget: itextWidget.id,
            widgetValuePath: "helpItext"
        };

        control.addEmptyCaptionItext = addSerializer({
            visibility: 'visible',
            presence: function (mug) {
                return mug.options.isRepeat && mug.options.customRepeatButtonText ? 'optional' : 'notallowed';
            },
            lstring: gettext("Add New Item Button Text"),
            widget: trackLogicRefs(function (mug, options) {
                var block = itextBlock.label(mug, $.extend(options, {
                    itextType: "addEmptyCaption",
                    messagesPath: "addEmptyCaptionItext",
                    getItextByMug: function (mug) {
                        return mug.p.addEmptyCaptionItext;
                    },
                    displayName: gettext("Add New Item Button Text"),
                }));
                return block;
            }),
            validationFunc: itextValidator("addEmptyCaptionItext", gettext("Add New Item Button Text")),
        });
        // virtual property used to get a widget
        control.addEmptyCaptionItextID = {
            visibility: 'addEmptyCaptionItext',
            lstring: gettext("Add New Itext ID"),
            widget: itextWidget.id,
            widgetValuePath: "addEmptyCaptionItext",
        };

        control.addCaptionItext = addSerializer({
            visibility: 'visible',
            presence: function (mug) {
                return mug.options.isRepeat && mug.options.customRepeatButtonText ? 'optional' : 'notallowed';
            },
            lstring: gettext("Add Another Item Button Text"),
            widget: trackLogicRefs(function (mug, options) {
                var block = itextBlock.label(mug, $.extend(options, {
                    itextType: "addCaption",
                    messagesPath: "addCaptionItext",
                    getItextByMug: function (mug) {
                        return mug.p.addCaptionItext;
                    },
                    displayName: gettext("Add Another Item Button Text"),
                }));
                return block;
            }),
            validationFunc: itextValidator("addCaptionItext", gettext("Add Another Item Button Text")),
        });
        // virtual property used to get a widget
        control.addCaptionItextID = {
            visibility: 'addCaptionItext',
            lstring: gettext("Add Another Itext ID"),
            widget: itextWidget.id,
            widgetValuePath: "addCaptionItext",
        };

        // virtual property used to get a widget
        control.otherItext = function (mugOptions) {
            return mugOptions.isSpecialGroup ? undefined : {
                visibility: 'labelItext',
                presence: 'optional',
                lstring: gettext("Add Other Content"),
                widget: function (mug, options) {
                    return itextBlock.configurable(mug, $.extend(options, {
                        displayName: gettext("Add Other Content"),
                        itextType: "label",
                        getItextByMug: function (mug) {
                            return mug.p.labelItext;
                        },
                        forms: ['long', 'short'],
                        isCustomAllowed: true
                    }));
                }
            };
        };
        // virtual property used to get a widget
        control.mediaItext = function (mugOptions) {
            return mugOptions.isSpecialGroup ? undefined : {
                visibility: 'labelItext',
                presence: 'optional',
                lstring: gettext('Add Multimedia'),
                widget: function (mug, options) {
                    return itextBlock.media(mug, $.extend(options, {
                        displayName: gettext("Add Multimedia"),
                        itextType: "label",
                        pathPrefix: "",
                        getItextByMug: function (mug) {
                            return mug.p.labelItext;
                        },
                        forms: jrUtil.SUPPORTED_MEDIA_TYPES,
                        formToIcon: ICONS
                    }));
                }
            };
        };
        // virtual property used to get a widget
        control.helpMediaIText = function (mugOptions) {
            return mugOptions.isSpecialGroup ? undefined : {
                visibility: 'helpItext',
                presence: 'optional',
                lstring: gettext('Add Help Media'),
                widget: function (mug, options) {
                    return itextBlock.media(mug, $.extend(options, {
                        displayName: gettext("Add Help Media"),
                        itextType: "help",
                        getItextByMug: function (mug) {
                            return mug.p.helpItext;
                        },
                        forms: jrUtil.SUPPORTED_MEDIA_TYPES,
                        formToIcon: ICONS
                    }));
                }
            };
        };
        return spec;
    },
    getMainProperties: function () {
        var ret = this.__callOld();
        ret.splice(1 + ret.indexOf('label'), 0, 'labelItext');
        return ret;
    },
    getLogicProperties: function () {
        var ret = this.__callOld();
        ret.splice(
            1 + ret.indexOf('constraintAttr'), 0, 'constraintMsgItext');
        return ret;
    },
    getMediaProperties: function() {
        var ret = this.__callOld();
        ret.push('constraintMediaIText');
        return ret;
    },
    getAdvancedProperties: function () {
        var ret = this.__callOld();

        ret = ret.concat([
            'labelItextID',
            'constraintMsgItextID',
            'hintItextID',
            'hintItext',
            'helpItextID',
            'helpItext',
            'addEmptyCaptionItextID',
            'addEmptyCaptionItext',
            'addCaptionItextID',
            'addCaptionItext',
            'helpMediaIText',
        ]);

        ret = ret.concat(['otherItext']);

        return ret;
    },
    getToolsMenuItems: function () {
        var _this = this;
        return this.__callOld().concat([
            {
                name: gettext("Edit Bulk Translations"),
                icon: "fa fa-language",
                action: function (done) {
                    _this.showItextModal(done);
                }
            }
        ]);
    },
    showItextModal: function (done) {
        var vellum = this,
            $modal, $updateForm, $textarea,
            Itext = vellum.data.javaRosa.Itext,
            form = vellum.data.core.form;

        $modal = vellum.generateNewModal(gettext("Edit Bulk Translations"), [
            {
                title: gettext("Update Translations"),
                cssClasses: "btn-primary",
                action: function () {
                    jrUtil.parseXLSItext(form, $textarea.val(), Itext);
                    $modal.modal('hide');
                    done();
                }
            }
        ]);
        $updateForm = $(edit_source({
            description: gettext(
            "Copy these translations into a spreadsheet program " +
            "like Excel. You can edit them there and then paste them back " +
            "here when you're done. These will update the translations used in " +
            "your form. Press 'Update Translations' to save changes, or 'Close' " +
            "to cancel.")
        }));
        $modal.find('.modal-body').html($updateForm);

        // display current values
        $textarea = $updateForm.find('textarea');
        $textarea.val(jrUtil.generateItextXLS(form, Itext));

        $modal.modal('show');
        $modal.one('shown.bs.modal', function () { $textarea.focus(); });
    }
});
