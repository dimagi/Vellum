/**
 * Just some useful JS tools and idioms
 */

if(typeof Object.create !== 'function') {
    Object.create = function(obj) {
        var Blank_Function = function(){};
        Blank_Function.prototype = obj;
        return new Blank_Function();
    };
}


//Trim dogpunch
if(typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function()
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.util = (function(){
    var that = {};

    //VERIFY_RETURN_CODES:
    var VERIFY_CODES = {
            VERIFY_SUCCESS : 0,
            VERIFY_FAIL : 1,
            VERIFY_NO_DEFINITION : 2,
            VERIFY_ERROR : 3
    };
    that.VERIFY_CODES = VERIFY_CODES;
    that.XPATH_REFERENCES = ["bindElement/relevantAttr",
                             "bindElement/calculateAttr",
                             "bindElement/constraintAttr"];
    
    /**
     * Check if value is a valid XML attribute value (additionally disallow all
     * ' and ")
     */
    that.isValidAttributeValue = function (value) {
        return (/^[^<&'"]*$/).test(value);
    };
    
    /**
     * Grabs the value between the tags of the element passed in
     * and returns a string of everything inside.
     *
     * This method is kindy of hacky, so buyer beware.
     *
     * Motivation: Jquery's selector can't do this.  We need to be able to
     * grab the value of label tags, even if it includes <output> tags inside
     * of it (since the tag may need to be displayed to the user).
     * @param el - jquery selector or string used in the selector pointing to a DOM element.
     */
    var xmls = new XMLSerializer();
    that.getXLabelValue = function(el){
        var resStr, resEl;
        function getEndTag (str) {
            var res, reo, last;
            reo = /<\/(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
            res = reo.exec(str);
            last = res;
            while(res !== null) {
                last = res;
                res = reo.exec(str);
            }
            if(last){
                return last[0];
            }else{
                return null;
            }
            
        }

        function getStartTag (str) {
            var re, res;
            re = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/;
            res = re.exec(str);
            return res[0];
        }

        resEl = $(el)[0];
        if(!resEl) { return; }
        resStr = xmls.serializeToString(resEl);
        resStr = resStr.replace(getStartTag(resStr),'').replace(getEndTag(resStr),'');
        
        // XMLSerializer unescapes escaped carriage returns
        resStr = resStr.replace(new RegExp(String.fromCharCode(10), 'g'), '&#10;');

        return resStr;
    }

    /**
     * From http://stackoverflow.com/questions/4149276/javascript-camelcase-to-regular-form
     * @param myString
     */
    function fromCamelToRegularCase(myString){
        var ret;
        // insert a space before all caps
        ret = myString.replace(/([A-Z])/g, ' $1')
        // uppercase the first character
                .replace(/^./, function(str){ return str.toUpperCase(); });

        return ret;
    }
    that.fromCamelToRegularCase = fromCamelToRegularCase;

    /**
     * Given two lists, creates a new array (and returns it)
     * that contains only unique values
     * based on comparing the two argument arrays.
     * @param arrA
     * @param arrB
     */
    var mergeArray = function (arrA, arrB) {
        var result = [], i;
        for(i in arrA){
            if(arrA.hasOwnProperty(i)){
                if(arrA.slice(0,arrA.indexOf(i)).indexOf(i) === -1){ //check to see if there aren't dupes in arrA
                    result.push(arrA[i]);
                }
            }
        }

        for(i in arrB){
            if(arrB.hasOwnProperty(i)){
                if(result.indexOf(arrB[i]) === -1){
                    result.push(arrB[i]); //grab only anything that hasn't shown up yet
                }
            }
        }

        return result;
    };
    that.mergeArray = mergeArray;

    /**
     * Given a (nodeset or ref) path, will figure out what the implied NodeID is.
     * @param path
     */
    function getNodeIDFromPath (path) {
        if (!path) {
            return null;
        }
        var arr = path.split('/');
        return arr[arr.length-1];
    }
    that.getNodeIDFromPath = getNodeIDFromPath;

    /**
     * Figures out what the xpath is of a controlElement
     * by looking at the ref or nodeset attributes.
     * @param el - a jquery selector or DOM node of an xforms controlElement.
     * @return - a string of the ref/nodeset value
     */
    function getPathFromControlElement (el) {
        if(!el){
            return null;
        }
        el = $(el); //make sure it's jquerified
        var path = el.attr('ref');
        if(!path){
            path = el.attr('nodeset');
        }
        return path || null;
    }
    that.getPathFromControlElement = getPathFromControlElement;


    //taken from http://stackoverflow.com/questions/728360/copying-an-object-in-javascript
    //clones a 'simple' object (see link for full description)
    function clone(obj) {
        var copy, i;
        // Handle the 3 simple types, and null or undefined
        if (null === obj || "object" !== typeof obj) return obj;

        // Handle Date
        if (obj instanceof Date) {
            copy = new Date();
            copy.setTime(obj.getTime());
            return copy;
        }

        // Handle Array
        if (obj instanceof Array) {
            var len;
            copy = [];
            for (i = 0, len = obj.length; i < len; ++i) {
                copy[i] = clone(obj[i]);
            }
            return copy;
        }

        // Handle Object
        if (obj instanceof Object) {
            copy = {};
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
            }
            return copy;
        }

        throw new Error("Unable to copy obj! Its type isn't supported.");
    }
    that.clone = clone;

    that.question_counter = 1;
    /**
     * Private method for constructing unique questionIDs, labels for items, etc
     * @param prefixStr
     */
    var label_maker = function (prefixStr) {
        var ret = prefixStr + that.question_counter;
        that.question_counter += 1;
        return ret;
    };

    /**
     * Generates a unique question ID (unique in this form) and
     * returns it as a string.
     */
    that.generate_question_id = function (question_id) {
        if (question_id) {
            var match = /^copy-(\d+)-of-(.+)$/.exec(question_id) ;
            if (match) {
                question_id = match[2]; 
            }
            for (var i = 1;; i++) {
                var new_id = "copy-" + i + "-of-" + question_id;
                if (!formdesigner.model.questionIdCount(new_id)) {
                    return new_id; 
                }
            }
        } else {
            return label_maker('question');
        }
    };


    var generate_item_label = function () {
        return label_maker('item');
    };
    that.generate_item_label = generate_item_label;

    that.getAttributes = function (element) {
        var attributes = $(element)[0].attributes,
            attrMap = {};

        for (var i = 0; i < attributes.length; i++) {
            attrMap[attributes[i].nodeName] = attributes[i].nodeValue;
        }
        return attrMap;
    }; 
    
    /**
     * Takes in a reference mug and makes a copy of
     * the object (the copy is returned).
     * @param refMug
     */
    //var getNewMug = function(refMug){
        //var newMug = that.clone(refMug);
        //that.give_ufid(newMug);
        //return newMug;
    //};
    //that.getNewMug = getNewMug;

    //Simple Event Framework
    //Just run your object through this function to make it event aware
    //Taken from 'JavaScript: The Good Parts'
    that.eventuality = function (that) {
        var registry = {};
        that.fire = function (event) {
            var array,
                func,
                handler,
                i,
                type = typeof event === 'string' ?
                        event : event.type;
            if (registry.hasOwnProperty(type)) {
                array = registry[type];
                for (i = 0; i < array.length; i += 1) {
                    handler = array[i];
                    func = handler.method;
                    if (typeof func === 'string') {
                        func = this[func];
                    }
                    func.apply(this,
                        handler.parameters || [event]);
                }
            }
            return this;
        };
        that.on = function (type, method, parameters) {
            var handler = {
                method: method,
                parameters: parameters
            };
            if (registry.hasOwnProperty(type)) {
                registry[type].push(handler);
            } else {
                registry[type] = [handler];
            }
            return this;
        };
        return that;
    };

    that.pluralize = function (noun, n) {
        return noun + (n !== 1 ? 's' : '');
    };

    var generate_guid = function() {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
    };

    that.generate_xmlns_uuid = function () {
        var CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var uuid = [], r, i;

		// rfc4122 requires these characters
		uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
		uuid[14] = '4';

		// Fill in random data.  At i==19 set the high bits of clock sequence as
		// per rfc4122, sec. 4.1.5
		for (i = 0; i < 36; i++) {
			if (!uuid[i]) {
				r = Math.floor((Math.random()*16));
				uuid[i] = CHARS[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
			}
		}
		return uuid.toString().replace(/,/g,'');
    };

    /**
     * This method gives the passed object
     * a Unique Mug ID
     * @param that
     */
    that.give_ufid = function(that) {
        that.ufid = generate_guid();
    };

    that.XSD_DATA_TYPES = [
            'xsd:boolean',
            'xsd:byte',
            'xsd:date',
            'xsd:dateTime',
            'xsd:decimal',
            'xsd:double',
            'xsd:float',
            'xsd:int',
            'xsd:long',
            'xsd:short',
            'xsd:string',
            'xsd:time',
            'geopoint',
            'barcode',
            'androidintent'
    ];

    that.VALID_CONTROL_TAG_NAMES = [
            'input',
            'phonenumber',
            '1select',
            'select',
            'group',
            'repeat',
            'fieldlist',
            'trigger',
            'item',
            'output',
            'secret'
    ];

    /**
     * Bind a number of standard event responses to a mug
     * so that it responds in a pre-determined fashion to default things
     *
     * Add stuff here when you want most/all mugs to behave in a certain
     * fashion on FD events.
     * @param mug
     */
    that.setStandardMugEventResponses = function (mug) {
        // NOTE: 'this' is the mug responding to the event.

        mug.on('property-changed',function (e) {
            // bind dataElement.nodeID and bindElement.nodeID together
            if(e.property === 'nodeID'){
                if(this.dataElement){
                    this.dataElement.nodeID = e.val;
                }
                if(this.bindElement){
                    this.bindElement.nodeID = e.val;
                }
            }

            // Update the status of the indicator icons indicating where
            // validation has failed
            var mug = formdesigner.controller.getMugFromFormByUFID(e.mugUfid);
            formdesigner.ui.showVisualValidation(mug);
            formdesigner.ui.setTreeValidationIcon(mug);
            
            // update the logic properties that reference the mug
            if (e.previous !== e.val) {
                var mug = formdesigner.controller.getMugFromFormByUFID(e.mugUfid);
                if (e.property === 'nodeID') {
                    var currentPath = formdesigner.controller.form.dataTree.getAbsolutePath(mug);
                    var parsed = xpath.parse(currentPath);
                    parsed.steps[parsed.steps.length - 1].name = e.previous;
                    formdesigner.model.LogicManager.updatePath(mug.ufid, parsed.toXPath(), currentPath);
                    formdesigner.pluginManager.call(
                        "onQuestionIDChange", mug, e.val, e.previous);
                } else {
                    var propertyPath = [e.element, e.property].join("/");

                    if (mug.getPropertyDefinition(propertyPath).uiType === formdesigner.widgets.xPathWidget) {
                        formdesigner.model.LogicManager.updateReferences(mug, propertyPath);
                    }
                }
            }

            // update the itext ids of child items if they weren't manually set
            if (e.property === "nodeID" && (mug.__className === "Select" || mug.__className === "MSelect")) {
                var node = formdesigner.controller.form.controlTree.getNodeFromMug(mug),
                    children = node.getChildrenMugs(),
                    mug = this;
            
                var setNodeID = function (val) {
                    mug.dataElement.nodeID = val;
                    mug.bindElement.nodeID = val;
                };

                for (var i = 0; i < children.length; i++) {
                    var child = children[i];

                    // Temporarily set select's nodeID to old value so we can
                    // test whether the old item's itext id was autogenerated.
                    setNodeID(e.previous);
                    if (child.controlElement.labelItextID.id === child.getDefaultLabelItextId()) {
                        setNodeID(e.val);
                        child.setItextID(child.getDefaultLabelItextId());
                    } else {
                        setNodeID(e.val);
                    }
                }
            }
        });
    };

    /**
     * Bind some standard responses to the 'form-property-changed' event.
     * @param form - formdesigner.model.Form object.
     */
    that.setStandardFormEventResponses = function (form) {
        form.on('form-property-changed', function (e) {
            var mug = formdesigner.controller.getCurrentlySelectedMug();
            if (mug) {
                formdesigner.ui.showVisualValidation(mug);
                formdesigner.ui.setTreeValidationIcon(mug);
            }
        });

        form.on('form-property-changed', function() {
            formdesigner.controller.setFormChanged();
        });
    };

    that.getMugDisplayName = function (mug) {
        var itextItem, cEl,dEl,bEl, disp, lang, Itext;
        if(!mug) {
            return 'No Name!';
        }
        if (mug.__className === "ReadOnly") {
            return "Unknown (read-only) question type";
        }

        cEl = mug.controlElement;
        dEl = mug.dataElement;
        bEl = mug.bindElement;
        Itext = formdesigner.pluginManager.javaRosa.Itext;

        if(cEl) {
            itextItem = cEl.labelItextID;
        }

        var getNodeID = function () {
            var nodeID;

            if(bEl) {
                nodeID = bEl.nodeID;
            }
            if(!nodeID){
                if(dEl) {
                    nodeID = dEl.nodeID;
                }
            }
            nodeID = nodeID || cEl.defaultValue;
            return nodeID ? "[" + nodeID + "]" : undefined;
        };

        if (!itextItem) {
            return getNodeID();
        }

        lang = formdesigner.currentItextDisplayLanguage || Itext.getDefaultLanguage();

        if(!lang) {
            return 'No Translation Data';
        }

        disp = itextItem.getValue("default", lang);
        if (disp) {
            return disp;
        }

        return getNodeID();
    };
    
    /*
     * Utility to check if something is a valid element name
     */
    that.isValidElementName = function (name) {
        // HT: http://stackoverflow.com/questions/2519845/how-to-check-if-string-is-a-valid-xml-element-name
        var elementNameRegex = /^(?!XML)[a-zA-Z][\w0-9-]*$/;
        return elementNameRegex.test(name);
    };

    
    /*
     * Assumes we're in a quoted string, and replaces special characters
     * so that they don't break xml
     * 
     */
    that.escapeQuotedXML = function (text, options) {
        // force to string
        text = "" + text; 
        
        if (!text) {
            return "";
        }
        
        // special case this because we want the default to be true
        var escapeQuotes = (options && options.hasOwnProperty("escapeQuotes")) ? options.escapeQuotes : true;
        
        // have to do these first
        if (options && options.escapeAmpersands) {
            text = text.replace(/&/,'&amp;');
        }
        // these are required
        text = text.replace(/</g,'&lt;');
        text = text.replace(/>/g,'&gt;');
        // these are optional
        if (options && options.escapeApostrophes) {
            text = text.replace(/'/g, "&apos;");
        }
        if (escapeQuotes) {
            text = text.replace(/"/g,'&quot;');
        }
        return text;
    };
    
    // monkey patch the xmlwriter for convenience
    XMLWriter.prototype.writeAttributeStringSafe = function (name, value, options) {
        return this.writeAttributeString(name, that.escapeQuotedXML(value, options));
    }; 
    
    /**
     * Turns a list of strings into a single tab separated straing.
     * Replaces newlines with ' ' so they don't affect the spacing.
     * @param list
     */
    
    that.tabSeparate = function (list) {
        var cleanVal = function (val) {
            return val.replace(/\n/g, ' ');
        };
        return list.map(cleanVal).join("\t");
    };
    
        
    that.mugToXPathReference = function (mug) {
        // for choices, return the quoted value.
        // for everything else return the path
        if (mug.__className === "Item") {
            return '"' + mug.controlElement.defaultValue + '"';
        } else {
            // for the currently selected mug, return a "."
            return (mug.ufid === formdesigner.controller.getCurrentlySelectedMug().ufid) ? "." : formdesigner.controller.form.dataTree.getAbsolutePath(mug);
        }
    };
    
    /**
     * Parses the required attribute string (expecting either "true()" or "false()" or nothing
     * and returns either true, false or null
     * @param attrString - string
     */
    that.parseBoolAttributeValue = function (attrString) {
        if (!attrString) {
            return null;
        }
        var str = attrString.toLowerCase().replace(/\s/g, '');
        if (str === 'true()') {
            return true;
        } else if (str === 'false()') {
            return false;
        } else {
            return null;
        }
    };

    /**
     * Converts true to 'true()' and false to 'false()'. Returns null for all else.
     * @param req
     */
    that.createXPathBoolFromJS = function(req) {
        if(req === true || req === 'true') {
            return 'true()';
        }else if (req === false || req === 'false') {
            return 'false()';
        } else {
            return null;
        }
    };
    
    that.getOneOrFail = function (list, infoMsg) {
        if (list.length === 0) {
            throw ("No match for " + infoMsg + " found!");
        } else if (list.length > 1) {
            throw ("Multiple matches for " + infoMsg + " found!");
        }
        return list[0];
    };
    
    that.reduceToOne = function (list, func, infoMsg) {
        return that.getOneOrFail(_(list).filter(func), infoMsg);
    };
    return that;

}());


// jquery extensions

$.fn.stopLink = function() {
    // stops anchor tags from clicking through
    this.click(function (e) {
        e.preventDefault();
    });
    return this;
};

$.fn.fdHelp = function () {
    // creates a help popover, requires twitter bootstrap
    this.append($('<i />').addClass('icon-question-sign'))
        .popout({
            trigger: 'hover',
            html: true
        });
    return this;
};
