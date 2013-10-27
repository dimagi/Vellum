/**
 * Vellum plugin for integrating with a CommCare HQ server to handle case
 * property references and case management.
 */

// http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
RegExp.escape= function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
};

function getRepeatAncestor(mug) {
    while (mug) {
        if (mug.parentMug && mug.parentMug.__className === 'Repeat') {
            return true;
        }
        mug = mug.parentMug;
    }
    return false;
}

var saveToCaseBlock = function (mug, options) {
    // todo: this doesn't support saving a single question to more than one case
    // property!  Would need some UI for adding additional properties to save to
    // for each case type.  (Although perhaps this is an anti-pattern in app
    // design?)
    
    var block = {},
        mugPath = formdesigner.controller.form.dataTree.getAbsolutePath(mug),
        commCare = formdesigner.pluginManager.commCare,
        ownActions = commCare.currentForm.actions,
        ownUpdate = ownActions.update_case.update,
        repeatAncestor = getRepeatAncestor(mug);

    block.mug = mug;

    function setOwnUpdate(newValue, oldValue, prefix) {
        if (newValue === 'name' && ownActions.open_case.condition.type !== 'never') {
            ownActions.open_case.name_path = mugPath;
        }
        setUpdate(ownUpdate, newValue, oldValue, prefix);
    }

    function setUpdate(updateDict, newValue, oldValue, prefix) {
        prefix = prefix || '';
        if (newValue) {
            updateDict[prefix + newValue] = mugPath;
        }
        // don't delete when oldValue == 'name' because we always need a name,
        // so the user should have to manually set another question to name in
        // order to remove the old name
        if (oldValue && oldValue !== 'name' && 
            updateDict[prefix + oldValue] === mugPath) 
        {
            delete updateDict[prefix + oldValue];
        }
    }

    function getSavedPropertyName(updateDict, prefix) {
        prefix = prefix || '';
        var properties = [];
        _(updateDict).each(function (path, name) {
            if (path === mugPath && (name.indexOf(prefix) === 0 || !prefix)) {
                properties.push(name.slice(prefix.length));
            }
        });

        return properties.length ? properties[0] : null;
    }


    block.setValue = function () {};
    block.getValue = function () {};

    var updatesOnlyOwnCase = (commCare._updatesOwnCase() && 
        !commCare.parentCaseType && !ownActions.subcases.length);

    block.getUIElement = function () {
        var widgetId = 0,
            $el = $("<div></div>");
        
        function addWidget(displayName, initialValue, updateValue) {
            // this handles storing the previous value so old values can be
            // removed.  Kind of convoluted..?
            var oldValue = initialValue;
            function wrappedUpdateValue(newValue) {
                if (newValue !== oldValue) {
                    formdesigner.controller.setFormChanged();
                    updateValue(newValue, oldValue);
                    oldValue = newValue;
                }
            }
            var widget = saveToCaseWidget(block.mug, {
                displayName: displayName,
                widgetId: widgetId++,
                updateValue: wrappedUpdateValue
            });
            widget.setValue(initialValue);
            $el.append(widget.getUIElement());
            widget.updateValue();  // sync checkbox
        }

        if (!repeatAncestor) {
            if (commCare._updatesOwnCase()) {
                var label = commCare.ownCaseType + (updatesOnlyOwnCase ? "" : " (this case)");
                addWidget(label, getSavedPropertyName(ownUpdate), setOwnUpdate);

                if (commCare.parentCaseType) {
                    addWidget(commCare.parentCaseType + " (parent case)",
                        getSavedPropertyName(ownUpdate, 'parent/'),
                        function (newValue, oldValue) {
                            setOwnUpdate(newValue, oldValue, 'parent/');
                        }
                    );
                }
            }
        }

        var tree = formdesigner.controller.form.dataTree;
        _(ownActions.subcases).each(function (subcase) {
            // wrong repeat
            if (repeatAncestor && 
                tree.getAbsolutePath(mug).indexOf(subcase.repeat_context) !== 0)
            {
                return;
            }

            var _update = _(subcase.case_properties).extend({
                name: subcase.case_name
            });
            // todo: better label/UX when the same case type shows up multiple
            // times in the UI
            addWidget(subcase.case_type + " (child case)",
                getSavedPropertyName(_update),
                function (newValue, oldValue) {
                    if (newValue === 'name') {
                        subcase.case_name = mugPath;
                        newValue = null;
                    }
                    // maintain repeat_context as defined in case-config-ui-2.js
                    // todo: what if the user wants to change the repeat that a
                    // child case uses?
                    if (repeatAncestor) {
                        subcase.repeat_context = tree.getAbsolutePath(repeatAncestor);
                    }
                    setUpdate(subcase.case_properties, newValue, oldValue);
                }
            );
        });

        // no case types, disable widget showing
        if (widgetId === 0) {
            return false;
        }

        return $el;
    };

    return block;
};


var saveToCaseWidget = function (mug, options) {
    var commCare = formdesigner.pluginManager.commCare;
    var widget = formdesigner.widgets.baseWidget(mug, options);
    widget.displayName = options.displayName;

    widget.getDisplayName = function () {
        return widget.displayName;
    };
    widget.getID = function () {
        return 'save_to_case_' + options.widgetId;
    };

    var $input = $("<input />")
        .attr("id", widget.getID())
        .attr("type", "text")
        .addClass('input-block-level')
        .on('change keyup', function (e) {
            widget.updateValue();
        });

    widget.getControl = function () {
        return $input;
    };
    widget.setValue = function (value) {
        $input.val(value);
    };
    widget.getValue = function () {
        return $input.val();
    };

    var checkboxId = widget.getID() + '_checkbox';
    var $save = $("<input />")
        .attr('type', "checkbox")
        .attr('id', checkboxId)
        .change(function () {
            var $input = widget.getControl();

            if ($(this).prop('checked') === true) {
                widget.setValue(
                    commCare.getDefaultCasePropertyName(mug)
                );
                $input.show().change();
            } else {
                widget.setValue("");
                $input.hide().change();
            }
        });

    var _updateValue = widget.updateValue;
    widget.updateValue = function () {
        var val = widget.getValue();
        if (val.indexOf(' ') !== -1) {
            widget.setValue(val.replace(/\s/g, '_'));
        }
        _updateValue();
        var finalVal = widget.getValue();
        $save.prop('checked', !!finalVal);
        $input.toggle(!!finalVal);

    };

    var _getUIElement = widget.getUIElement;
    widget.getUIElement = function () {

        var $uiElem = _getUIElement();

        // this is copied from the itext id widget.  It's not exactly the right
        // UI placement, but for now, whatever.
        var $saveLabel = $("<label/>")
            .text("Save").attr("for", checkboxId)
            .addClass('checkbox')
            .prepend($save);
        var $saveContainer = $("<div />")
            .addClass('pull-left fd-itextID-checkbox-container')
            .prepend($saveLabel);

        $uiElem.find('.controls')
            .addClass('fd-itextID-controls')
            .before($saveContainer);

        return $uiElem;
    };

    widget.save = function () {
        options.updateValue(widget.getValue());
    };

    return widget;
};


formdesigner.plugins.commCare = function (options) {
    var that = this;
    that.options = options;

    that.caseReservedWords = options.case_reserved_words;
    that.modules = options.modules;
    that.currentFormId = options.current_form;
    that.currentModuleId = options.current_module;
        
    that.currentModule = that.modules[that.currentModuleId];
    that.currentForm = that.currentModule.forms[that.currentFormId];
    that.ownCaseType = that.currentModule.case_type;
    that.subCaseTypes = _(that.currentForm.actions.subcases).map(function (sc) {
        return sc.case_type;
    });

    var noAction =  _.every(['open_case', 'close_case', 'update_case'], 
            function (a) {
                return that.currentForm.actions[a].condition.type === 'never';
            }) && !that.currentForm.actions.subcases.length;
    that.disabled = noAction;

    // roughly duplicated in app_manager/case_in_form/case_in_form.py
    var RefType = {
        OWN_CASE: 'own_case',
        PARENT_CASE: 'parent_case'
    };

    // Hardcoding stuff like this for now. We will need to hook into the xpath
    // parser or build our own here if we want to expose stuff with different
    // indices in the UI. 
    var CASE_UGLY_PREFIX = "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/",
        CASE_PRETTY_PREFIX = "@case/",
        PARENT_UGLY_PREFIX = "instance('casedb')/casedb/case[@case_id=instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/index/parent]/",
        PARENT_PRETTY_PREFIX = "@parent/",
        // taken from app_manager/models.py
        CASE_PROPERTY_MATCH = "([a-zA-Z][\\w_-]*)",

        CASE_UGLY_REGEX = new RegExp(
            RegExp.escape(CASE_UGLY_PREFIX) + CASE_PROPERTY_MATCH, 'g'
        ),
        CASE_PRETTY_REGEX = new RegExp(
            RegExp.escape(CASE_PRETTY_PREFIX) + CASE_PROPERTY_MATCH, 'g'
        ),
        PARENT_UGLY_REGEX = new RegExp(
            RegExp.escape(PARENT_UGLY_PREFIX) + CASE_PROPERTY_MATCH, 'g'
        ),
        PARENT_PRETTY_REGEX = new RegExp(
            RegExp.escape(PARENT_PRETTY_PREFIX) + CASE_PROPERTY_MATCH, 'g'
        ),
       
        // match/replace case property output ref/values after ugly->pretty
        // processing has already occurred
        ITEXT_OUTPUT_REF = new RegExp(
            // lol. probably we won't have to deal with anything other than the
            // format we output, but let's not be stupid. Is there any way to
            // make this not suck?
            "<\\s*?output\\s+(?:ref|value)\\s*=\\s*(?:'|\")" +
            "((?:" + RegExp.escape(CASE_PRETTY_PREFIX) + "|"  +
                     RegExp.escape(PARENT_PRETTY_PREFIX) + ")" + 
                CASE_PROPERTY_MATCH + ")" +
            "(?:'|\")\\s*\/>"
        ),

        // central place where all case property references in all attributes of
        // all mugs are tracked
        CASE_PROPERTY_REFERENCES = {};
    
    that.getDefaultCasePropertyName = function (mug, caseType) {
        return mug.dataElement.nodeID;
    };

    that.init = function () {

        that.parentCaseType = null;
        _(that.modules).each(function (module) {
            _(module.forms).each(function (form) {
                _(form.actions.subcases).each(function (subcase) {
                    if (!that.parentCaseType && 
                        subcase.case_type === that.ownCaseType) 
                    {
                        that.parentCaseType = module.case_type;
                    }
                });
            });
        });
        
        that._loadModules(that.modules, that.currentModuleId, that.currentFormId);

    };
    
    that._updatesOwnCase = function () {
        return that.currentForm.actions.update_case.condition.type !== "never";
    };

    that._createsOwnCase = function () {
        return that.currentForm.actions.open_case.condition.type !== "never";
    };

    // collect a flat list of possible case properties for each case type, with
    // source question info
    that._loadModules = function (modules) {
        that.modules = modules;
        that.caseProperties = {};

        _(that.modules).each(function (module, id) {
            _(module.forms).each(function (form, id) {
                that._processForm(form, module);
            });
        });
    };

    var getRealCaseType = function (caseType) {
        if (caseType === RefType.OWN_CASE) {
            return that.ownCaseType;
        } else if (caseType === RefType.PARENT_CASE) {
            return that.parentCaseType;
        } else {
            return case_type;
        }
    };

    that._processForm = function (form, module) {
        form.module = module;
        form.questionsByPath = _(form.questions).indexBy('value');
        _(form.questions).each(function (q) { 
            q.form = form;
        });

        var update_case = form.actions.update_case,
            open_case = form.actions.open_case;
       
        if (open_case.condition.type !== 'never' && open_case.name_path) {
            that._addCaseProperty(module.case_type, "name", 
                form.questionsByPath[open_case.name_path]);
        }

        if (update_case.condition.type !== 'never') {
            _(update_case.update).each(function (path, propName) {
                that._addCaseProperty(module.case_type, propName,
                    form.questionsByPath[path]);
            });
        }

        _(form.actions.subcases).each(function (subcase) {
            that._addCaseProperty(subcase.case_type, "name", 
                form.questionsByPath[subcase.case_name]);

            _(subcase.case_properties).each(function (path, propName) {
                that._addCaseProperty(subcase.case_type, propName,
                    form.questionsByPath[path]);
            });
        });
    };
   
    // add a case property to the list of those that can be referenced.  Also
    // guard against adding any case properties that aren't referenceable in
    // this form here, so we can do only one check to see whether to draw the
    // case property list.
    that._addCaseProperty = function (type, name, sourceQuestion) {
        // can't reference anything when creating a new case
        if (that._createsOwnCase()) {
            return;
        }

        // can't reference a subcase property in a form that creates it (unless
        // its the same type as the form's own case type)
        if (that.subCaseTypes.indexOf(type) !== -1 && 
            !(type === that.ownCaseType && that._updatesOwnCase()))
        {
            return;
        }

        // ignore case properties from forms that aren't relevant to this form
        if (type !== that.ownCaseType && type !== that.parentCaseType &&
            that.subCaseTypes.indexOf(type) === -1)
        {
            return;
        }

        // we don't support parent/parent/foo references at the moment
        if (name.indexOf("parent/") === 0) {
            return;
        }

        if (!that.caseProperties[type]) {
            that.caseProperties[type] = {};
        }
        
        // sourceQuestion will not exist if a property in a case update
        // references a nonexistent question
        that.caseProperties[type][name] = {
            type: type,
            name: name,
            sources: sourceQuestion ? [sourceQuestion] : []
        };
    };

    that._getCaseProperty = function (type, name) {
        type = getRealCaseType(type);

        return (that.caseProperties[type] && 
                that.caseProperties[type][name]);
    };

    that._hasReferenceableProperties = function () {
        for (var k in that.caseProperties) {
            if (that.caseProperties.hasOwnProperty(k)) {
                if (_.size(that.caseProperties[k])) {
                    return true;
                }
            }
        }
        return false;
    };


    var SETVALUES;
    // get setvalues in the XML so we can set them on mugs after the tree's been
    // created
    that.beforeParse = function (xml) {
        SETVALUES = {};
        var head = xml.find('head'),
            setvalues = head.find('setvalue');

        _(setvalues).each(function (setvalue) {
            var $setvalue = $(setvalue),
                value = $setvalue.attr('value'),
                ref = $setvalue.attr('ref');
            if ($setvalue.attr('event') === 'xforms-ready' && value && 
                (value.indexOf(PARENT_UGLY_PREFIX) === 0 || 
                 value.indexOf(CASE_UGLY_PREFIX)))
            {
                SETVALUES[ref] = value;
            }
        });
    };

    // these functions transitions old preloaded case properties into being managed as
    // setvalues by vellum.
    that.afterParse = function () {
        var case_preload = that.currentForm.actions.case_preload;
        if (case_preload.condition.type === 'never') {
            return;
        }

        _(case_preload.preload).each(function (name, path) {
            var val;
            if (name.indexOf('parent/') === 0) {
                val = PARENT_UGLY_PREFIX + name.substring('parent/'.length);
            } else {
                val = CASE_UGLY_PREFIX + name;
            }
            SETVALUES[path] = val;
        });

        _(SETVALUES).each(function (value, path) {
            formdesigner.controller.getMugByPath(path)
                .dataElement.setAttr('loadFromCase', value);
        });

        that.currentForm.actions.case_preload.preload = {};

        // ensure that casedb instance exists
        var hasCasedbInstance = _.some(formdesigner.controller.form.instanceMetadata,
            function (m) {
                return m.id == "casedb";
            }
        );
        if (!hasCasedbInstance) {
            formdesigner.controller.form.instanceMetadata.push({
                // prevent duplicate instances
                attributes: {
                    id: "casedb",
                    src: "jr://instance/casedb"
                }
            });
        }
    };

    that.contributeToHeadXML = function (xmlWriter) {
        var tree = formdesigner.controller.form.dataTree;
        tree.treeMap(function (node) {
            var mug = node.getValue();
            if (!mug.dataElement || !mug.dataElement.loadFromCase) {
                return;
            }

            xmlWriter.writeStartElement("setvalue");
            xmlWriter.writeAttributeStringSafe("event", "xforms-ready");
            xmlWriter.writeAttributeStringSafe("ref", tree.getAbsolutePath(mug));
            xmlWriter.writeAttributeStringSafe("value", 
                formdesigner.pluginManager.call("serializeXPathExpression", 
                    mug.dataElement.loadFromCase));
            xmlWriter.writeEndElement();
        });

    };

    that.getErrors = function (mug) {
        var errors = [],
            question;
        if (mug.bindElement) {
            question = "The question " + mug.bindElement.nodeID;
        } else {
            question = "The item " + mug.controlElement.defaultValue;
        }

        function addErrors(refId, attribute) {
            var references = CASE_PROPERTY_REFERENCES[refId];
            _(references).each(function (ref) {
                if (!that._getCaseProperty(ref.caseType, ref.name)) {
                    errors.push(question + " references an unknown " + 
                        (ref.caseType === RefType.PARENT_CASE ? 
                            "parent " : "") +
                        "case property '" + ref.name + "' " +
                        "in its " + attribute + ".");
                } 
            });
        }
       
        // logic references.  todo: are there a couple more obscurer ones?
        _([
            "bindElement/relevantAttr",
            "bindElement/calculateAttr",
            "bindElement/constraintAttr",
            "controlElement/repeat_count"
        ]).each(function (path) {
            var definition = mug.getPropertyDefinition(path),
                value = mug.getPropertyValue(path);

            if (value) {
                addErrors(
                    'mug-property-' + mug.ufid + definition.lstring, 
                    definition.lstring);
            }
        });

        // itext references
        _([
            "controlElement/labelItextID",
            "controlElement/hintItextID",
            "bindElement/constraintMsgItextID"
        ]).map(function (path) {
            var definition = mug.getPropertyDefinition(path),
                value = mug.getPropertyValue(path);

            if (value && value.forms) {
                // for the itext value property, with the actual property
                // being the ID, not the value, we want "Label" (not
                // "Question Itext ID").
                var actualDefinition = mug.getPropertyDefinition(
                    path.substring(0, path.length - 2));
                _(value.forms).each(function (form) {
                    _(form.data).each(function (text, lang) {
                        var refId = 'itext-item-' + value.id + '-' + 
                                form.name + '-' + lang;
                        addErrors(refId, actualDefinition.lstring + ' (' + lang + ')');
                    });
                });
            }
        });

        return errors;
    };

    that.getServerPOSTData = function () {
        return {
            formActions: that.currentForm.actions
        };
    };

    that.contributeToDataElementSpec = function (spec, mug) {
        if (mug.__className === "Item" || mug.__className === "Trigger" ||
            mug.isSpecialGroup) 
        {
            return spec;
        }

        // virtual property used to get a widget
        spec.saveToCase = {
            visibility: 'visible',
            presence: 'optional',
            uiType: saveToCaseBlock
        };
        spec.loadFromCase = {
            visibility: 'visible_if_present',
            presence: 'optional',
            lstring: 'Expression',
            uiType: formdesigner.widgets.xPathWidget
        };
        return spec;
    };

    function updateDict(dict, newPath, oldPath) {
        for (var k in dict) {
            var path = dict[k];
            if (dict.hasOwnProperty(k) && dict[k].indexOf(oldPath) === 0) {
                // this is probably faster than a regex replace and avoids
                // having to check that it's the beginning of the string
                dict[k] = newPath + dict[k].substring(oldPath.length);
            }
        }
    }

    // keep in sync question paths in case updates and subcase repeat_contexts
    that.onQuestionIDChange = function (mug, id, previous_id) {
        var tree = formdesigner.controller.form.dataTree,
            newPath = tree.getAbsolutePath(mug),
            pieces = newPath.split("/"),
            oldPath = pieces.slice(0, pieces.length - 1).concat([previous_id]).join("/"),
            actions = that.currentForm.actions;

        updateDict(actions.update_case.update, newPath, oldPath);

        if (actions.open_case.name_path === oldPath) {
            actions.open_case.name_path = newPath;
        }
        _(actions.subcases).each(function (subcase) {
            updateDict(subcase.case_properties, newPath, oldPath);
            if (subcase.repeat_context === oldPath) {
                subcase.repeat_context = newPath;
            }
            if (subcase.case_name === oldPath) {
                subcase.case_name = newPath;
            }
        });
    };

    that.getSections = function (mug) {
        if (mug.__className === "Item") {
            return [];
        }

        if (!mug.dataElement.loadFromCase) {
            if (!that._updatesOwnCase() &&
                that.currentForm.actions.subcases.length === 0)
            {
                return [];
            }

        }
        
        return [
            {
                slug: "save-to-case",
                type: "accordion",
                displayName: "Save to Case",
                properties: ['dataElement/saveToCase'],
                help: {
                    title: "Save to Case",
                    //text: "Some text about case properties",
                    link: "https://bar"
                }
            },
            // will almost certainly only be displayed on data nodes that were
            // used for loading case properties in the past
            {
                slug: "load-from-case",
                type: "accordion",
                displayName: "Load from Case",
                properties: ['dataElement/loadFromCase'],
                help: {
                    title: "Load from Case",
                    text: "Some text about loading from case",
                    link: "https://bar"
                }
            }
        ];
    };

    that.processItextMessage = function (val, itextId, itextForm, lang) {
        return process(val, 'itext-item-' + itextId + '-' + itextForm + '-' + lang, 
            that.serializeItextMessage,
            function (val) {
                // todo: should move into javarosa plugin
                return val.replace(ITEXT_OUTPUT_REF, '$1');
            }
        );
    };

    that.serializeItextMessage = function (val) {
        return serialize(val, function (val) {
            return '<output ref="' + val + '"/>';
        });
    };

    that.processXPathExpression = function (val, mug, property) {
        return process(val, 'mug-property-' + mug.ufid + property.lstring,
            that.serializeXPathExpression);
    };

    that.serializeXPathExpression = function (val) {
        return serialize(val);
    };

    // convert instance('casedb') case property references into our pretty @
    // syntax, and maintain a central store of property references based on
    // whatever refId is passed.
    // 
    // Note: this handles parsing both raw property values and
    // already-prettified property values (in order to easily centrally handle
    // user changes, whether in individual property inputs or XLS export / bulk
    // translations / etc.).  Todo that we just call serialize first.  Bleh.
    // But it's probably better to have it in this central place than have this
    // processing be anywhere near the UI layer.  Regardless, this can be
    // revisited later.
    var process = function (str, refId, serializeFn, postProcessFn) {
        if (!str) {
            return str;
        }
        str = serializeFn(str);
        var references = [];

        // todo: when we see an expression string which contains a regular
        // instance('casedb') case property reference within a more complicated
        // reference, we need to avoid parsing it into our format (so the user
        // doesn't have to deal with the actual syntax and our pretty syntax
        // within one expression).  We avoid doing that for parent property
        // references by parsing the parent references first, but we need to add
        // an additional check for that in case there are any advanced reference
        // formats that we don't handle.
        str = str.replace(PARENT_UGLY_REGEX, function (match, p1) {
            references.push({
                caseType: RefType.PARENT_CASE,
                name: p1
            });
            return PARENT_PRETTY_PREFIX + p1;
        });
        str = str.replace(CASE_UGLY_REGEX, function (match, p1) {
            references.push({
                caseType: RefType.OWN_CASE,
                name: p1
            });
            return CASE_PRETTY_PREFIX + p1;
        });
        
        if (refId) {
            CASE_PROPERTY_REFERENCES[refId] = references;
        }
        if (postProcessFn) {
            str = postProcessFn(str);
        }
        return str;
    };

    var serialize = function (str, wrapPropertyFn) {
        if (!str) {
            return str;
        }
        str = str.replace(PARENT_PRETTY_REGEX, function (match, p1) {
            var repl = PARENT_UGLY_PREFIX + p1;
            if (wrapPropertyFn) {
                repl = wrapPropertyFn(repl);
            }
            return repl;
        });
        str = str.replace(CASE_PRETTY_REGEX, function (match, p1) {
            var repl = CASE_UGLY_PREFIX + p1;
            if (wrapPropertyFn) {
                repl = wrapPropertyFn(repl);
            }
            return repl;
        });

        return str;
    };


    that.getAccordions = function () {
        if (!that._hasReferenceableProperties()) {
            return [];
        }

        var $div = $("<div id='case_property_tree_container'></div>");
        var $input = $("<input/>")
            .attr('id', 'case_property_search')
            .attr('name', 'case_property_search')
            .attr('placeholder', 'Search case properties...')
            .keyup(function () {
                that.casePropertyTree.jstree('search', $input.val());
            });
        $input.appendTo($div);
        $("<div id='case_property_tree'></div>").appendTo($div);

        return [{
            id: 'fd-case-properties',
            title: 'Case Properties',
            href: "http://foo.com",
            helpContent: "This is a list of all the case properties " +
                "potentially available to this form.  You can drag a " +
                "case property into a logic condition or display message " +
                "to create a reference to that case property.  Click on " + 
                "a property below for more information about where it's " +
                "created and used.",
            content: $div
        }];
    };

    // bleh, this separation is actually not useful right now, would be simpler
    // to just have one function that non-generically created this accordion
    that.initAccordions = function () {
        if (!that._hasReferenceableProperties()) {
            return;
        }

        that.draggedResult = null;
       
        // disable ugly search highlight. doing this since plugin organization
        // of styles/includes isn't fleshed out
        var css = document.createElement("style");
        css.type = "text/css";
        css.innerHTML = "a.jstree-search { color: inherit !important; }";
        document.body.appendChild(css);

        $("#case_property_search").parent().attr('position', 'relative');

        that.casePropertyTree = $("#case_property_tree").jstree({
            "json_data" : {
                "data" : (function () {
                    var data = [];
                    function add(properties, case_type, ref_type) {
                        var description = '';
                        if (ref_type === 'parent') {
                            description = ' (parent case)';
                        } else if (ref_type === 'self') {
                            description = ' (this case)';
                        }
                        var node = {
                            data: "Case type: " + case_type + description,
                            attr: {
                                id: "case_property_type_" + case_type + "_" + ref_type
                            },
                            state: "open",
                            children: []
                        };

                        _(properties).each(function (property) {
                            var name = property.name;
                            node.children.push({
                                data: name,
                                attr: {
                                    id: "case_property_" + case_type + ref_type +  "_" + name
                                },
                                metadata: {
                                    ref_type: ref_type,
                                    name: name
                                }
                            });
                        });
                        data.push(node);
                    }
                    if (that.parentCaseType) {
                        add(that.caseProperties[that.parentCaseType], 
                            that.parentCaseType, 'parent');
                    }
                    if (that.ownCaseType) {
                        add(that.caseProperties[that.ownCaseType], 
                            that.ownCaseType, 'self');
                    }

                    return data;
                })()
            },
            "ui" : {
                select_limit: 1
            },
            "search": {
                show_only_matches: true
            },
            "themes": {
                icons: false
            },
            "dnd" : {
                "drop_finish" : function(data) {
                    var $o = $(data.o),
                        type = $o.data('ref_type'),
                        name = $o.data('name'),
                        ref;

                    if (type === 'parent') {
                        ref = PARENT_PRETTY_PREFIX + name;
                    } else if (type === 'self') {
                        ref = CASE_PRETTY_PREFIX + name;
                    } else {
                        // unhandled case
                        return;
                    }

                    formdesigner.controller.handleDrop(ref, data.r, data.e);
                }
            },
            "plugins" : [ "themes", "json_data", "ui", "dnd", "search" ]
        });
    
    };
};

