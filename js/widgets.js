if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.widgets = (function () {
    var that = {};
    
    that.getGroupName = function (path) {
        return path.split("/")[0];
    };
    
    that.getPropertyName = function (path) {
        return path.split("/")[1];
    };
    
    that.baseWidget = function(mugType) {
        // set properties shared by all widgets
        var widget = {};
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        widget.mug = mugType;
                
        widget.getDisplayName = function () {
            // use the display text, or the property name if none found
            return this.definition.lstring ? this.definition.lstring : this.propName;
        }
        
        widget.getLabel = function () {
            var label = $("<label />").text(this.getDisplayName()).attr("for", this.getID()); 
            return label;
        };
        
        widget.getControl = function () {
            throw ("must be overridden");
        };
        
        widget.getID = function () {
            throw ("must be overridden");
        };
        
        
        widget.setValue = function (val) {
            // noop
        };
        
        widget.getValue = function () {
            // noop
        };
        
        
        widget.fireValueChanged = function () {
            var ref = this;
            return function () {
                formdesigner.controller.fire({
                    type: 'widget-value-changed',
                    widget: ref
                });
            };
        };
        
        widget.getUIElement = function () {
            // gets the whole widget (label + control)
	        var uiElem = $("<div />");
	        uiElem.append(this.getLabel());
	        uiElem.append(this.getControl());
	        return uiElem;
        };
        
        return widget;
    };
    
    that.normalWidget = function(mugType, path) {
        // for "normal" = non-itext widgets.
        var widget = that.baseWidget(mugType);
        widget.path = path;
        widget.definition = mugType.getPropertyDefinition(path);
        widget.currentValue = mugType.getPropertyValue(path);
        widget.groupName = that.getGroupName(widget.path);
        widget.propName = that.getPropertyName(widget.path);
        
        widget.getID = function () {
            return this.path.split("/").join("-");
        };
        
        
        
        widget.save = function () {
            if (this.mug.getPropertyValue(this.path) !== this.getValue()) {
	            formdesigner.controller.setMugPropertyValue(this.mug.mug,
	                                                        this.groupName,
	                                                        this.propName,
	                                                        this.getValue(),
	                                                        this.mug);
            }
        };
        return widget;
        
    };
    
    that.textWidget = function (mugType, path) {
        // a text widget 
        var widget = that.normalWidget(mugType, path);
        
	    var input = $("<input />").attr("id", widget.getID()).attr("type", "text");
            
	    widget.getControl = function () {
            return input;
        };
        
        widget.setValue = function (value) {
            input.val(value);
        };
        
        widget.getValue = function() {
            return input.val();
        };
        
        input.keyup(widget.fireValueChanged());
        return widget;    
    };
    
    that.iTextIDWidget = function (mugType, path) {
        // a special text widget that holds itext ids
        var widget = that.textWidget(mugType, path); 
        widget.save = function () {
            var oldItextID = this.mug.getPropertyValue(this.path);
            if (oldItextID !== this.getValue()) {
	            formdesigner.model.Itext.renameItextID(oldItextID, this.getValue());
	            formdesigner.controller.setMugPropertyValue(this.mug.mug,
	                                                        this.groupName,
	                                                        this.propName,
	                                                        this.getValue(),
	                                                        this.mug);
            }
        };
        
        return widget;
    }
    
    that.checkboxWidget = function (mugType, path) {
                
        var widget = that.normalWidget(mugType, path);
        
        var input = $("<input />").attr("id", widget.getID());
        input.attr("type", "checkbox");
        
        widget.getControl = function () {
	        return input;
        };
        
        widget.getUIElement = function () {
            // override this because the label comes after the control
            var uiElem = $("<div />");
            uiElem.append(this.getControl());
            uiElem.append(this.getLabel());
            return uiElem;
        };
        
        widget.setValue = function (value) {
            input.prop("checked", value);
        };
        
        widget.getValue = function() {
            return input.prop("checked");
        };
        
        input.change(widget.fireValueChanged());
        return widget;    
    };
    
    that.xPathWidget = function (mugType, path) {
                
        var widget = that.textWidget(mugType, path);
        
        
        var xPathButton = $('<button />').addClass("xpath-edit-button").text("Edit").button();
        xPathButton.data("group", widget.groupName).data("prop", widget.propName).data("inputControlID", widget.getID());
        xPathButton.click(function () {
            formdesigner.controller.displayXPathEditor({
                group:    $(this).data("group"),
                property: $(this).data("prop"),
                value:    $("#" + $(this).data("inputControlID")).val()
            });
        });
        
        widget.getUIElement = function () {
            // gets the whole widget (label + control)
            var uiElem = $("<div />");
            uiElem.append(this.getLabel());
            uiElem.append(this.getControl());
            uiElem.append(xPathButton);
            return uiElem;
        };
        
        return widget;
    };
    
    that.baseItextWidget = function (mugType, language, idFunc, slug, form) {
        var widget = that.baseWidget(mugType);
        widget.language = language;
        widget.form = form;
        widget.slug = slug;
        
        widget.getTextId = function () {
            return idFunc(this.mug);
        };
        
        widget.getID = function () {
            return "itext-" + this.language + "-" + this.slug + "-" + this.form;
        };
        
        widget.getType = function () {
            if (this.form === "default") {
                return "Display Text";
            }
            return this.form;
        };
        
        widget.setValue = function (value) {
            input.val(value);
        };
        
        widget.getValue = function() {
            return input.val();
        };
        
        widget.save = function () {
            // override save to reference the itext, rather than
            // a property of the mug
            if (this.getTextId()) {
	            formdesigner.model.Itext.setValue(this.getTextId(),
	                                              this.language,
	                                              this.form,
	                                              this.getValue());
	        
	            // fire the property changed event
	            mugType.mug.fire({ type: "property-changed",
	                               mugUfid: mugType.mug.ufid,
	                               mugTypeUfid: mugType.ufid});
	        }
        };
        
        var input = $("<input />").attr("id", widget.getID()).attr("type", "text");
        
        widget.getControl = function () {
            return input;
        };
        
        input.keyup(widget.fireValueChanged());
        return widget;
    };
    
    that.iTextWidget = function(mugType, language, idFunc, slug, form) {
        
        var widget = that.baseItextWidget(mugType, language, idFunc, slug, form);
        
        widget.getDisplayName = function () {
            return this.getType();
        };
        return widget;
    };
    
    that.iTextInlineWidget = function (mugType, language, idFunc, slug, form, displayName) {
        
        var widget = that.baseItextWidget(mugType, language, idFunc, slug, form);
        
        widget.getDisplayName = function () {
            var formSpecifier = (this.form === "default") ? "" : " - " + this.form;
            return displayName + formSpecifier + " (" + language + ")";
        };
        return widget;
    };
    
    that.selectWidget = function (mugType, path) {
        // a select widget 
        var widget = that.normalWidget(mugType, path);
        
        var input = $("<select />").attr("id", widget.getID()).addClass("chzn-select");
        input.append($('<option value="blank" />'));
        for (i in widget.definition.values) {
            if (widget.definition.values.hasOwnProperty(i)) {
                var strVal = formdesigner.util.fromCamelToRegularCase(widget.definition.values[i].replace('xsd:','')),
                    isSelected = '';
        
                option = $("<option />").val(widget.definition.values[i]).text(strVal).appendTo(input);
                if (widget.currentValue === widget.definition.values[i]) {
                    // TODO: is this necessary?
                    option.attr("selected", "selected");
                }
            }
        }
    
        widget.getControl = function () {
        	return input;
        };
        
        widget.setValue = function (value) {
            input.val(value);
        };
        
        widget.getValue = function() {
            return input.val();
        };
        
        input.change(widget.fireValueChanged());
        
        return widget;    
    };
    
    that.widgetTypeFromPropertyDefinition = function (propertyDef) {
        switch (propertyDef.uiType) {
            case "select":
                return that.selectWidget;
            case "checkbox":
                return that.checkboxWidget;
            case "xpath":
                return that.xPathWidget;
            default:
                return that.textWidget;
        }                        
    };

    that.widgetFromMugAndDefinition = function (mugType, definition) {
        // there is probably one layer of indirection too many here
        switch (definition.widgetType) {
            case "itext":
                if (definition.displayMode === "inline") {
                    return new that.ITextFieldBlockInline(mugType, definition);
                } else {
                    // default to "full"   
                    return new that.ITextFieldBlock(mugType, definition);
                }
            case "generic":
            default: 
                var cls = that.widgetTypeFromPropertyDefinition(mugType.getPropertyDefinition(definition.path));
                return cls(mugType, definition.path);
        }
    };
    
    var setBaseSectionProperties = function (section, mugType, options) {
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        section.mugType = mugType;
        section.slug = options.slug || "anon";
        section.displayName = options.displayName;
        section.elements = options.elements;
        
        section.getHeader = function () {
            return $('<h2 />').text(this.displayName);
        };
        
        section.getId = function () {
            return "fd-question-edit-" + this.slug;
        }
        
    };
    
    that.GenericSection = function (mugType, options) {
        
        setBaseSectionProperties(this, mugType, options);
                
        this.getWidgets = function () {
                    
            var inner = this;
            var toWidget = function (elementdefinition) {
                var w = that.widgetFromMugAndDefinition(inner.mugType, elementdefinition);
                return w;
            }
            return this.elements.map(toWidget);
            
        }
        this.getSectionDisplay = function () {
            // returns the actual display for the section
            
            var header = this.getHeader();
            var sec = $("<fieldset />").attr("id", this.getId()).addClass("question-section");
            this.getWidgets().map(function (elemWidget) {
                elemWidget.setValue(elemWidget.currentValue);
                elemWidget.getUIElement().appendTo(sec);
            });
            return header.add(sec);
        };
        return this;
    };
    
    
    that.AccordionSection = function (mugType, options) {
        
        setBaseSectionProperties(this, mugType, options);
        
        this.getHeader = function () {
            return $('<h3><a href="#">' + this.displayName + '</a></h3>');
        };
        
        this.getWidgets = function () {
            // TODO: don't copy paste this -- break into subsections?
            var inner = this;
            var toWidget = function (elementdef) {
                return that.widgetFromMugAndDefinition(inner.mugType, elementdef);
            }
            return this.elements.map(toWidget);
        }
        
        this.getSectionDisplay = function () {
            // returns the actual display for the section
            var sec = $("<fieldset />").attr("id", this.getId()).addClass("question-section");
            this.getHeader().appendTo(sec);
            var inner = $('<div />').appendTo(sec);
            this.getWidgets().map(function (elemWidget) {
                elemWidget.setValue(elemWidget.currentValue);
                elemWidget.getUIElement().appendTo(inner);
            });
            sec.accordion({
                autoHeight: false,
                collapsible: true,
                active: false
            });
            
            return sec;
        };
        return this;
    };
    
    var setITextFieldBlockCommonProps = function (block, mugType, options) {
        block.mugType = mugType;
        block.textIdFunc = options.textIdFunc;
        block.slug = options.slug;
        
        block.getTextId = function () {
            return this.textIdFunc(this.mugType);                           
        }
        
        block.showAddFormButton = options.showAddFormButton;
        block.formList = formdesigner.model.Itext.getExhaustiveFormSet(block.getTextId());
        block.displayName = options.displayName || "";
        
        block.langs = formdesigner.model.Itext.getLanguages();
        
        // hack, so they adhere to the same api
        block.setValue = function (val) {
            // noop
        };
        
        block.getValue = function () {
            // noop
        };
        
    };
    
    that.ITextFieldBlock = function (mugType, options) {
        setITextFieldBlockCommonProps(this, mugType, options);
        var main = $("");
        
        // needed for closure
        var textIdFunc = this.textIdFunc; 
        var slug = this.slug;
        var addItextType = this.addItextType = function (form) {
            main.parent().find(".itext-language-section").each(function () {
                var lang = $(this).data("language");
                itextWidget = that.iTextWidget(mugType, lang, textIdFunc, slug, form);
                itextWidget.getUIElement().appendTo($(this));
            });
        };
        
        this.getUIElement = function () {
            
            var itextWidget, subBlock, subSec;
            
            for (var i = 0; i < this.langs.length; i++) {
                subSec = $("<div />").addClass("itext-language-section").data("language", this.langs[i]);
                main = main.add(subSec);
                // sub heading for language
                $("<h3 />").text(this.langs[i]).appendTo(subSec);
                subBlock = mugType.getItextBlock(this.langs[i]);
                
                // loop through items, add to UI
                for (var j = 0; j < this.formList.length; j++) {
                    // add widget
                    itextWidget = that.iTextWidget(mugType, this.langs[i], this.textIdFunc, 
                                                       this.slug, this.formList[j]);
                    itextWidget.setValue(subBlock[this.formList[j]]);
                    itextWidget.getUIElement().appendTo(subSec);
                }
            }
            
            if (this.showAddFormButton) {
	            var addButton = $("<div />").text("Add Content Item").button();
	            main = main.add(addButton);
	            addButton.click(function () {
	                var dialog = $("#fd-dialog-confirm");
	                dialog.dialog( "destroy" );
	                dialog.empty();
	                $("<label />").attr("for", "new-itext-id").text("Content type: ").appendTo(dialog);
	                var input = $("<input />").addClass("fd-property-input").attr("id", "new-itext-id").appendTo(dialog);
	                dialog.dialog({
	                    title: "New Content Item Type",
	                    buttons: {
	                        "Add": function () {
	                            addItextType(input.val());
	                            $(this).dialog("close");
	                        },
	                        "Cancel": function () {
	                            $(this).dialog("close");
	                        }
	                    }
	               });
	            });
	        }
	        return main;
        };
        
        return this;
    };
    
    that.ITextFieldBlockInline = function (mugType, options) {
        // an inline way of displaying itext blocks.
        // doesn't support adding fields
        // show's each langauge in the label
        
        setITextFieldBlockCommonProps(this, mugType, options);
        var main = $("");
        
        this.getUIElement = function () {
            var itextWidget, subBlock, subSec;
            
            for (var i = 0; i < this.langs.length; i++) {
                
                subBlock = formdesigner.model.Itext.getItextVals(this.getTextId(), this.langs[i]);
                
                // loop through items, add to UI
                for (var j = 0; j < this.formList.length; j++) {
                    // add widget
                    itextWidget = that.iTextInlineWidget(mugType, this.langs[i], this.textIdFunc, 
                                                             this.slug, this.formList[j], this.displayName);
                    itextWidget.setValue(subBlock[this.formList[j]]);
                    main = main.add(itextWidget.getUIElement());
                }
            }
            
            return main;
        };
    };
    
    /**
     * Hard coded function to map mugs to the types of things
     * that they display
     * 
     */
    that.getSectionListForMug = function (mugType) {
        
        sections = [];
        sections.push(that.getMainSection(mugType));
        if (mugType.hasControlElement()) {
            sections.push(that.getContentSection(mugType));
        }
        if (mugType.hasBindElement()) {
            sections.push(that.getLogicSection(mugType));
        }
        sections.push(that.getAdvancedSection(mugType));
        return sections;    
    };
    
    var wrapAsGeneric = function (elemPath) {
        // utility method for ease of editing paths
        return {widgetType: "generic", path: elemPath };
    };
    
    var filterByMugProperties = function (list, mugType) {
        var ret = [];
        var hasControl = mugType.hasControlElement();
        var hasData = mugType.hasDataElement();
        var hasBind = mugType.hasBindElement();
        var path;
        
        for (var i = 0; i < list.length; i++) {
            path = list[i];
            if (path.indexOf("controlElement") !== -1) {
                if (hasControl) {
                    ret.push(path);
                }
            } else if (path.indexOf("dataElement") !== -1) {
                if (hasData) {
                    ret.push(path);
                }
            } else if (path.indexOf("bindElement") !== -1) {
                if (hasBind) {
                    ret.push(path);
                }
            } else {
                ret.push(path);
            } 
        }
        return ret;
    };
    that.getMainSection = function (mugType) {
        var elements = ["dataElement/nodeID"];
                                             
        if (!formdesigner.util.isSelect(mugType)) {
            // don't allow switching types for selects
            elements.push("bindElement/dataType");
        }
        
        if (formdesigner.util.isSelectItem(mugType)) {
            elements.push("controlElement/defaultValue");
        }
        
        elements = filterByMugProperties(elements, mugType).map(wrapAsGeneric);
        
        return new that.GenericSection(mugType, { 
                            slug: "main",
                            displayName: "Main Properties",
                            elements: elements});
                                       
    };
    
    that.getContentSection = function (mugType) {
        elements = [{ widgetType: "itext",
                      slug: "text",
                      displayMode: "full",
                      textIdFunc: function (mt) { return mt.getItextID() },
                      showAddFormButton: true}];
        return new that.GenericSection(mugType, { 
            displayName: "Content",
            slug: "content",
            elements: elements
        });
    };
    
    that.getLogicSection = function (mugType) {
        var elements = ["bindElement/requiredAttr",
                        "bindElement/relevantAttr", "bindElement/calculateAttr", 
                        "bindElement/constraintAttr",
                        "bindElement/constraintMsgItextID"].map(wrapAsGeneric);
        elements.push({ widgetType: "itext",
                        displayMode: "inline",
                        slug: "constraint",
                        displayName: "Constraint Message",
                        textIdFunc: function (mt) { return mt.getConstraintMsgItextID() }, 
                        showAddFormButton: false});
        return new that.AccordionSection(mugType, {
                            slug: "logic",
                            displayName: "Logic Properties",
                            elements: elements});
    };
    
    that.getAdvancedSection = function (mugType) {
        var elements = filterByMugProperties(
            ["dataElement/dataValue", "dataElement/keyAttr", "dataElement/xmlnsAttr", 
             "bindElement/preload", "bindElement/preloadParams", 
             "controlElement/label", "controlElement/hintLabel", 
             "bindElement/constraintMsgAttr", "controlElement/labelItextID", 
             "controlElement/hintItextID"], mugType).map(wrapAsGeneric);
        
        elements.push({ widgetType: "itext",
                        displayMode: "inline",
                        slug: "hint",
                        displayName: "Hint",
                        textIdFunc: function (mt) { return mt.getHintItextID() }, 
                        showAddFormButton: false});
        
        return new that.AccordionSection(mugType, { 
                            slug: "advanced",
                            type: "accordion",
                            displayName: "Advanced Properties",
                            elements: elements});
    };
    
    return that;
}());

