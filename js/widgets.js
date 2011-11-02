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
    
    var setBaseWidgetProperties = function(widget, mugType, path) {
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        widget.mug = mugType;
        widget.path = path;
        widget.definition = mugType.getPropertyDefinition(path);
        widget.currentValue = mugType.getPropertyValue(path);
        widget.groupName = that.getGroupName(widget.path);
        widget.propName = that.getPropertyName(widget.path);
        widget.itemID = path.split("/").join("-") + '-' + 'input';
                
        widget.getDisplayName = function () {
            // use the display text, or the property name if none found
            return this.definition.lstring ? this.definition.lstring : this.propName;
        }
        
        widget.getLabel = function () {
            var label = $("<span />").addClass("fd-property-text").text(this.getDisplayName()); 
            return label;
        };
        
        widget.getControl = function () {
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
	        var uiElem = $("<li />").attr("id", this.path.split("/").join("-")).addClass("fd-property");
	        uiElem.append(this.getLabel());
	        uiElem.append(this.getControl());
	        return uiElem;
        }
        
    };
    
    that.TextWidget = function (mugType, path) {
        // a text widget 
        
        setBaseWidgetProperties(this, mugType, path);
	    
	    var control = $('<div />').addClass("fd-prop-input-div chzn-container");
        var input = $("<input />").addClass("fd-property-input").appendTo(control);
            
	    this.getControl = function () {
            return control;
        };
        
        this.setValue = function (value) {
            input.val(value);
        };
        
        this.getValue = function() {
            return input.val();
        };
        
        input.keyup(this.fireValueChanged());
        return this;    
    };
    
    that.CheckboxWidget = function (mugType, path) {
                
        setBaseWidgetProperties(this, mugType, path);
        
        var control = $('<div />').addClass("fd-prop-input-div-checkbox");
        var input = $("<input />").addClass("fd-property-checkbox")
        input.attr("type", "checkbox").attr("id", this.itemID);
        control.append(input);
        
        this.getControl = function () {
	        return control;
        };
        
        this.setValue = function (value) {
            input.prop("checked", value);
        };
        
        this.getValue = function() {
            return input.prop("checked");
        };
        
        input.change(this.fireValueChanged());
        return this;    
    };
    
    that.XPathWidget = function (mugType, path) {
                
        setBaseWidgetProperties(this, mugType, path);
        
        this.getControl = function () {
            var control = $('<div />').addClass("fd-prop-input-div chzn-container");
		    var input = $("<input />").attr("id", this.itemID).css("width", "220px").appendTo(control);
		    var xPathButton = $('<button />').addClass("xpath-edit-button").text("Edit").button();
		    xPathButton.data("group", this.groupName).data("prop", this.propName).data("inputControlID", this.itemID);
		    xPathButton.click(function () {
		        formdesigner.controller.displayXPathEditor({
		            group:    $(this).data("group"),
		            property: $(this).data("prop"),
		            value:    $("#" + $(this).data("inputControlID")).val()
		        });
		    });
		    control.append(xPathButton);
		    return control;
		};
        
        return this;    
    };
    
    that.SelectWidget = function (mugType, path) {
        // a select widget 
        
        setBaseWidgetProperties(this, mugType, path);
        
        var control = $("<span />").addClass("fd-prop-input-div");
        var input = $("<select />").css("width", "300px").addClass("chzn-select");
        input.appendTo(control);
        input.append($('<option value="blank" />'));
        for (i in this.definition.values) {
            if (this.definition.values.hasOwnProperty(i)) {
                var strVal = formdesigner.util.fromCamelToRegularCase(this.definition.values[i].replace('xsd:','')),
                    isSelected = '';
        
                option = $("<option />").val(this.definition.values[i]).text(strVal).appendTo(input);
                if (this.currentValue === this.definition.values[i]) {
                    // TODO: is this necessary?
                    option.attr("selected", "selected");
                }
            }
        }
    
        this.getControl = function () {
        	return control;
        };
        
        this.setValue = function (value) {
            input.val(value);
        };
        
        this.getValue = function() {
            console.log("selecty value is ", input.val());
            return input.val();
        };
        
        input.change(this.fireValueChanged());
        
        return this;    
    };
    
    that.widgetTypeFromPropertyDefinition = function (propertyDef) {
        switch (propertyDef.uiType) {
            case "select":
                return that.SelectWidget;
            case "checkbox":
                return that.CheckboxWidget;
            case "xpath":
                return that.XPathWidget;
            default:
                return that.TextWidget;
        }                        
    };
    
    that.widgetFromMugAndPath = function (mugType, path) {
        var cls = that.widgetTypeFromPropertyDefinition(mugType.getPropertyDefinition(path));
        return new cls(mugType, path);
    }
    
    var setBaseSectionProperties = function (section, mugType, options) {
        // this shared method provides fake inheritance, assuming
        // it is called in a constructor on the object being constructed
        section.mugType = mugType;
        section.slug = options.slug || "anon";
        section.displayName = options.displayName;
        console.log("elements", options.elements);
        section.elements = options.elements;
        
    }
    
    that.GenericSection = function (mugType, options) {
        
        setBaseSectionProperties(this, mugType, options);
        
                
        this.getHeader = function () {
            // TODO: could swap this out for something else
            // this is copy/pasted from makeUL in ui.js
            return $('<ul class="fd-props-ul"><span class="fd-props-heading">' + this.displayName + '</span></ul>');
        };
        
        this.getWidgets = function () {
                    
            var inner = this;
            var toWidget = function (elementpath) {
                return that.widgetFromMugAndPath(inner.mugType, elementpath);
            }
            return this.elements.map(toWidget);
            
        }
        this.getSectionDisplay = function () {
            // returns the actual display for the section
            var sec = $("<div />").attr("id", this.slug);
            sec.append(this.getHeader());
            this.getWidgets().map(function (elemWidget) {
                elemWidget.setValue(elemWidget.currentValue);
                elemWidget.getUIElement().appendTo(sec);
            });
            return sec;
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
            var toWidget = function (elementpath) {
                return that.widgetFromMugAndPath(inner.mugType, elementpath);
            }
            console.log("elements", this.elements);
            return this.elements.map(toWidget);
        }
        
        this.getSectionDisplay = function () {
            // returns the actual display for the section
            var sec = $("<div />").attr("id", this.slug);
            sec.append(this.getHeader());
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
    
    that.ITextSection = that.AccordionSection;
    
    that.sectionTypeFromPropertyDefinition = function (propertyDef) {
        switch (propertyDef.type) {
            case "accordion":
                return that.AccordionSection;
            case "generic":
            default:
                return that.GenericSection;
        }
    };
    that.getDisplaySection = function (config, mugType) {
        var cls = that.sectionTypeFromPropertyDefinition(config); 
        return new cls(config, mugType);
    };
    
    return that;
}());

/*
        // this is what's left of the non-ported stuff
        var itemID = pathParts.join("-") + '-' + 'input';
    
        //set some useful data properties
        if (input) {
            input.attr("id", itemID);
            input.data('propName', propName);
            input.data('groupName', groupName);
            
            // set initial value for each input box (if any)
            // POTENTIAL PAIN POINT! Could be something that's not a string!
            input.val(currVal);
        }
        return control;
        
    };
    
}
*/
