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

    var GROUP_OR_REPEAT_VALID_CHILDREN = that.GROUP_OR_REPEAT_VALID_CHILDREN = ["group","repeat","question","selectQuestion","trigger"];

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
    function getXLabelValue (el){
        var resStr;
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
            var re, res
            re = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/;
            res = re.exec(str);
            return res[0];
        }

        resStr = xmls.serializeToString($(el)[0]);
        resStr = resStr.replace(getStartTag(resStr),'').replace(getEndTag(resStr),'');
        return resStr;
    };
    that.getXLabelValue = getXLabelValue;


    /**
     * From http://stackoverflow.com/questions/4149276/javascript-camelcase-to-regular-form
     * @param myString
     */
    function fromCamelToRegularCase(myString){
        var ret;
        // insert a space before all caps
        ret = myString.replace(/([A-Z])/g, ' $1')
        // uppercase the first character
                .replace(/^./, function(str){ return str.toUpperCase(); })

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
        var result = [];
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
    }
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
        if(!path) {
            return null;
        }

        return path;
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
     * Generates a unique question ID (unique in this form) and
     * returns it as a string.
     */
    that.generate_question_id = function () {
        var ret = 'question' + this.question_counter;
        this.question_counter += 1;
        return ret;
    };

    that.allowUnusedXMLAttributes = function(that){
        var unusedXMLattrs = {},
                unusedDOMNodes = [];


        /**
         * When parsing an XML form, store unused/unknown
         * xml data associated with a bind/data/control here.
         * If an attribute with this name already exists, it will
         * be overwritten with the new value.
         *
         * THESE ARE ATTRIBUTES FOR THE MAIN TAG (e.g. bind, data node, control Node)
         * USE addUnusedElement() to add entire unused/unrecognized nodes!
         * @param name - Attribute name
         * @param value - Attribute value
         */
        that.addUnusedAttr = function(name, value){
            unusedXMLattrs[name] = value;
        }

        /**
         * Gets all the unused/unknown XML node attributes
         * that were associated with this bind during parse time.
         *
         * Format is a dictionary of {attrName: attrValue} pairs.
         */
        that.getUnusedAttr = function(){
            return unusedXMLattrs;
        }

        /**
         * Used for storing unused/unrecognized DOM Nodes
         * at parse time.  When generating a new XML doc,
         * these nodes can be retrieved and inserted into the new doc.
         * @param DOMNode
         */
        that.addUnusedElement = function(DOMNode){
            unusedDOMNodes.push(DOMNode);
        }

        /**
         * Returns the unused DOM nodes as a list of DOM elements
         */
        that.getUnusedElements = function(){
            return unusedDOMNodes;
        }

        return that;
    }

    that.throwAndLogValidationError = function(vResult,mType,mug){
            console.group("Failed Validation Objectss");
            console.log("Validation Object:");
            console.log(vResult);
            console.log("MugType");
            console.log(mType);
            console.log("Mug");
            console.log(mug);
            console.groupEnd();
            throw 'Newly created mug did not validate! MugType and Mug logged to console...'
    }


    that.parseXml = function (xml) {
       var dom = null;
       if (window.DOMParser) {
          try {
             dom = (new DOMParser()).parseFromString(xml, "text/xml");
          }
          catch (e) { dom = null; }
       }
       else if (window.ActiveXObject) {
          try {
             dom = new ActiveXObject('Microsoft.XMLDOM');
             dom.async = false;
             if (!dom.loadXML(xml)) // parse error ..

                window.alert(dom.parseError.reason + dom.parseError.srcText);
          }
          catch (e) { dom = null; }
       }
       else
          alert("cannot parse xml string!");
       return dom;
    }
    /**
     * Takes in a reference mugType and makes a copy of
     * the object (the copy is returned).
     * @param refMug
     */
    var getNewMugType = function(refMugType){
        var newMugType = formdesigner.util.clone(refMugType);
        formdesigner.util.give_ufid(newMugType);
        return newMugType;
    };
    that.getNewMugType = getNewMugType;

    var DefinitionValidationException = function(message){
        this.message = message;
        this.name = "DefinitionValidationException";
    };
    that.DefinitionValidationException = DefinitionValidationException;

    var verify_mug = function(mug, definition){
        return VERIFY_CODES.VERIFY_ERROR; //not implemented yet!
    };
    that.verify_mug = verify_mug;

    //Simple Event Framework
    //Just run your object through this function to make it event aware
    //Taken from 'JavaScript: The Good Parts'
    var eventuality = function (that) {
        var registry = {};
        that.fire = function (event) {
    // Fire an event on an object. The event can be either
    // a string containing the name of the event or an
    // object containing a type property containing the
    // name of the event. Handlers registered by the 'on'
    // method that match the event name will be invoked.
            var array,
                func,
                handler,
                i,
                type = typeof event === 'string' ?
                        event : event.type;
    // If an array of handlers exist for this event, then
    // loop through it and execute the handlers in order.
            if (registry.hasOwnProperty(type)) {
                array = registry[type];
                for (i = 0; i < array.length; i += 1) {
                    handler = array[i];
    // A handler record contains a method and an optional
    // array of parameters. If the method is a name, look
    // up the function.
                    func = handler.method;
                    if (typeof func === 'string') {
                        func = this[func];
                    }
    // Invoke a handler. If the record contained
    // parameters, then pass them. Otherwise, pass the
    // event object.
                    func.apply(this,
                        handler.parameters || [event]);
                }
            }
            return this;
        };
        that.on = function (type, method, parameters) {
    // Register an event. Make a handler record. Put it
    // in a handler array, making one if it doesn't yet
    // exist for this type.
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
    that.eventuality = eventuality;

    /**
     * Answers the question of whether
     * the refMugType can have children of type ofTypeMug.
     * @return list of strings indicating the allowed children types (if any).
     * can be any of 'group' 'repeat' 'select' 'item' 'question'
     */
    var canMugTypeHaveChildren = function(refMugType,ofTypeMug){
        var allowedChildren, n, targetMugTagName, refMugTagName,
                makeLower = function(s){
                    return s.toLowerCase();
                };

        if(!refMugType || !ofTypeMug || !ofTypeMug.properties.controlElement || !refMugType.properties.controlElement){ throw 'Cannot pass null argument or MugType without a controlElement!'; }
        if(!refMugType.controlNodeCanHaveChildren){ return false; }
        allowedChildren = refMugType.controlNodeAllowedChildren;
        allowedChildren = allowedChildren.map(makeLower);

        targetMugTagName = ofTypeMug.mug.properties.controlElement.properties.tagName.toLowerCase();
        refMugTagName = refMugType.mug.properties.controlElement.properties.tagName.toLowerCase();

        if(allowedChildren.indexOf(targetMugTagName) === -1){
            return false;
        }else{
            return true;
        }
    
    };
    that.canMugTypeHaveChildren = canMugTypeHaveChildren;

    /**
     * Determines where the newMugType should be inserted relative
     * to the refMugType.
     * @param refMugType - the reference MT already in the tree
     * @param newMugType - the new MT you want a relative position for
     * @return - String: 'first', 'inside' or 'after'
     */
    var getRelativeInsertPosition = function(refMugType, newMugType){
            var canHaveChildren;
            if(!refMugType){
                return "into";
            }

            canHaveChildren = formdesigner.util.canMugTypeHaveChildren(refMugType,newMugType);

            if(canHaveChildren){
                return "into";
            }else{
                return "after";
            }
    };
    that.getRelativeInsertPosition = getRelativeInsertPosition;

    var generate_guid = function() {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
    };

    /**
     * This method gives the passed object
     * a Unique Mug ID plus standardized method(s)
     * for accessing the ID.
     * @param that
     */
    var give_ufid = function(that){
        that.ufid = generate_guid();
    };
    that.give_ufid = give_ufid;

    that.XSD_DATA_TYPES = [
            'xsd:anyURI',
            'xsd:base64Binary',
            'xsd:boolean',
            'xsd:byte',
            'xsd:date',
            'xsd:dateTime',
            'xsd:decimal',
            'xsd:double',
            'xsd:duration',
            'xsd:float',
            'xsd:gDay',
            'xsd:gMonth',
            'xsd:gMonthDay',
            'xsd:gYear',
            'xsd:gYearMonth',
            'xsd:hexBinary',
            'xsd:int',
            'xsd:integer',
            'xsd:language',
            'xsd:long',
            'xsd:short',
            'xsd:string',
            'xsd:time',
            'xsd:unsignedByte',
            'xsd:unsignedInt',
            'xsd:unsignedLong',
            'xsd:unsignedShort'
    ];

    that.VALID_CONTROL_TAG_NAMES = [
            'input',
            '1select',
            'select',
            'group',
            'repeat',
            'trigger',
            'item',
            'output'
    ]

    that.VALID_QUESTION_TYPE_NAMES = [
            'Text',
            'Group',
            'Repeat',
            'Trigger',
            'Single-Select',
            'Multi-Select',
            'Integer',
            'Double',
            'Long',
            'Float',
            'Date',
            'DateTime',
            'Time',
            'Picture',
            'Audio',
            'GPS',
            'Barcode'
    ]

    /**
     * Shortcut func because I'm tired of typing this out all the time.
     * @param obj
     */
    var exists = function(obj){
        return typeof obj !== 'undefined';
    };
    that.exists = exists;

    (function($) {
              // duck-punching to make attr() return a map
              var _old = $.fn.attr;
              $.fn.attr = function() {
                  var a, aLength, attributes,	map;
                  if (this[0] && arguments.length === 0) {
                            map = {};
                            attributes = this[0].attributes;
                            aLength = attributes.length;
                            for (a = 0; a < aLength; a++) {
                                      map[attributes[a].name] = attributes[a].value;
                            }
                            return map;
                  } else {
                            return _old.apply(this, arguments);
                  }
        }
    }(jQuery));


    /**
     * Bind a number of standard event responses to a mug
     * so that it responds in a pre-determined fashion to default things
     *
     * Add stuff here when you want most/all mugs to behave in a certain
     * fashion on FD events.
     * @param mug
     */
    that.setStandardMugEventResponses = function (mug) {
        //NOTE: 'this' is the mug responding to the event.

        //bind dataElement.nodeID and bindElement.nodeID together
        mug.on('property-changed',function (e) {
            if(e.property === 'nodeID'){
                if(this.properties.dataElement){
                    this.properties.dataElement.properties.nodeID = e.val;
                }
                if(this.properties.bindElement){
                    this.properties.bindElement.properties.nodeID = e.val;
                }
            }
        });

        mug.on('property-changed', function (e) {
            formdesigner.ui.setTreeValidationIcons();
        })

        //Update the status of the indicator icons indicating where validation has failed
        mug.on('property-changed', function (e) {
            var MT = formdesigner.controller.form.controlTree.getMugTypeFromUFID(e.mugTypeUfid);
            formdesigner.ui.showVisualValidation(MT);
        });



        //DEBUG EVENT CONSOLE PRINTER
        mug.on('property-changed', function(e){
           console.log("PROPERTY-CHANGED-EVENT (see utils)",e);
        });
    }


    return that;

}());