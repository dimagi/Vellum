/*jslint browser: true, maxerr: 50, indent: 4 */
/**
 * Model classes and functions for the FormDesigner
 */
if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}


formdesigner.model = (function(){
    var that = {};
    var exists = formdesigner.util.exists; //jack it from the util module
    /**
     * A mug is the standard object within a form
     * and represents the combined Data, Bind and Control
     * elements (accessible through the Mug) in all their
     * valid combinations. Validity of a mug is determined
     * by the Definition object.
     *
     * possible constructor params:
     * {
     *  bindElement,
     *  dataElement,
     *  controlElement,
     *  definition  //this is the definitionObject that specifies this mug's validation rules
     *  }
     */
    var Mug = function(spec){
        var that = {};
        var mySpec;

        var dataElement,bindElement,controlElement;

        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);

        if(typeof spec === 'undefined'){
            mySpec = {};
        }else{
            mySpec = spec;
        }

        /**
         * This constructor will take in a spec
         * consisting of various elements (see Mug comments)
         */
        (function construct(spec){
            that.bindElement = spec.bindElement || undefined;
            that.dataElement = spec.dataElement || undefined;
            that.controlElement = spec.controlElement || undefined;
        }(mySpec));

        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.Mug = Mug;

    var Form = function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.Form = Form;

    var Xhtml = function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
    };
    that.xhtml = Xhtml;

    var Localization = function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
    };
    that.Localization = Localization;

    /**
     * The bind object (representing the object
     * that transforms data and hands it off to the
     * dataElement object).
     *
     * Constructor object (spec) can have the following attributes
     * {
     *  dataType, //typically the xsd:dataType
     *  relevant,
     *  calculate,
     *  constraint,
     *  constraintMsg, //jr:constraintMsg
     *  nodeID //optional
     * }
     *
     * @param spec
     */
    var BindElement = function(spec){
        var that = {};

        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);
        var attributes;

        (function constructor (the_spec){
            if(typeof the_spec === 'undefined'){
                return null; //nothing to be done.
            }else{
                var i;
                //also attach the attributes to the root 'that' object:
                for(i in the_spec){
                    if(the_spec.hasOwnProperty(i)){
                        that[i] = the_spec[i];
                    }
                }
            }
        }(spec));

        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.BindElement = BindElement;

    /**
     * A LiveText object is able to
     * take in Strings and Objects (with their specified
     * callback functions that produce strings) in order
     * render a LiveString with the latest changes to the objects
     * it is tracking, on command (call renderString on this object
     * to get a... rendered string).
     */
    var LiveText = function(){
        //Todo eventually: add checking for null pointer tokens

        var that = {};

        var phrases = [];

        /**
         * Renders the token in the phrases list specified by tokenIndex
         * and returns it as a string
         * @param tokenIndex
         */
        var getRenderedToken = function(tokenIndex){
            var tObj;
            var outString = '';
            if(tokenIndex > phrases.length-1){
                return undefined;
            }
            tObj = phrases[tokenIndex];
            if(typeof tObj.refObj === 'undefined'){
                throw "incorrect Live Object added to LiveText! Can't render string.";
            }else if(typeof tObj.refObj === 'string'){
                outString += tObj.refObj;
            }else{
                outString += tObj.callback.apply(tObj.refObj,tObj.params);
            }
            return outString;
        };

        /**
         * Get the string this liveText represents
         * with all the function/object references replaced with
         * their textual representations (use add()
         * to add strings/objects when building a liveText)
         */
        var renderString = function(){
            var outString = "";
            var i;
            for(i=0;i<phrases.length;i++){
                outString += getRenderedToken(i);
            }
            return outString;
        };
        that.renderString = renderString;


        //////TODO REMOVE CALLBACK PARAMS


        /**
         * Add a token to the list
         * of this liveText object.
         * When adding a string,
         * the callback param is optional.  When
         * adding anything else, specify a callback function
         * to call (with or without params). If no callback
         * is specified in that case, an exception will be thrown
         * @param token - the object (or string) that represents the string data
         * @param callback - the callback function that should be used on the token obj to retrieve a string (if token is an object)
         * @param params is an array of arguments to be applied to the callback function (if a callback was specified)
         */
        var addToken = function(token, callback, params){
            var tObj = {};
            if (typeof token === 'string') {
                tObj.refObj = token;
            }else{
                tObj.refObj = token;
                tObj.callback = callback;
                tObj.params = params;
            }
            phrases.push(tObj);
        };
        that.addToken = addToken;

        /**
         * Returns the list of token objects
         * (an array of mixed strings and/or objects)
         */
        var getTokenList = function(){
            return phrases;
        };
        that.getTokenList = getTokenList;

        //make this object event aware.
        formdesigner.util.eventuality(that);
        return that;
    };
    that.LiveText = LiveText;

    /**
     * DataElement is the object representing the final resting (storage)
     * place of data entered by the user and/or manipulated by the form.
     *
     * Constructor spec:
     * {
     *  name,
     *  defaultData,
     * }
     */
    var DataElement = function(spec){
        var that = {};

        (function constructor (mySpec){
            if(typeof mySpec !== 'undefined'){
                that.name = mySpec.name || undefined;
                that.defaultData = mySpec.defaultData || undefined;
                that.nodeID = mySpec.nodeID || undefined;
            }
        }(spec));

        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);

        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.DataElement = DataElement;

    /**
     * The controlElement represents the object seen by the user during
     * an entry session.  This object usually takes the form of a question
     * prompt, but can also be a notification message, or some other type
     * of user viewable content.
     * spec:
     * {
     *  typeName, //the type string indicating what type of Control Element this is
     *            //see the control_definitions (tag_name) object e.g. "input"
     *  controlName //control_definition.controlElement.controlType.name; e.g. "text"
     *  //optional:
     *  label
     *  hintLabel
     *  labelItext
     *  hintItext
     *  defaultValue
     *
     * }
     */
    var ControlElement = function(spec){
        var that = {};

        var typeName,controlName,label,hintLabel,labelItext,hintItext,defaultValue;
        //give this object a unique fd id
        formdesigner.util.give_ufid(that);

        (function constructor(mySpec){
            if(typeof mySpec !== 'undefined'){
                typeName = that.typeName = mySpec.typeName;
                controlName = that.controlName = mySpec.controlName;
                //optional values in the spec
                if(typeof mySpec.label !== 'undefined'){ label = that.label = mySpec.label; }
                if(typeof mySpec.hintLabel !== 'undefined'){ hintLabel = that.hintLabel = mySpec.hintLabel; }
                if(typeof mySpec.labelItext !== 'undefined'){ labelItext = that.labelItext = mySpec.labelItext; }
                if(typeof mySpec.hintItext !== 'undefined'){ hintItext = that.hintItext = mySpec.hintItext; }
                if(typeof mySpec.defaultValue !== 'undefined'){ defaultValue = that.defaultValue = mySpec.defaultValue; }
            }
        }(spec));


        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.ControlElement = ControlElement;




    ///////////////////////////////////////////////////////////////////////////////////////
//////    DEFINITION (MUG TYPE) CODE /////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////


    var TYPE_FLAG_OPTIONAL = '_optional';
    var TYPE_FLAG_REQUIRED = '_required';
    var TYPE_FLAG_NOT_ALLOWED = '_notallowed';
    that.TYPE_FLAG_OPTIONAL = TYPE_FLAG_OPTIONAL;
    that.TYPE_FLAG_REQUIRED = TYPE_FLAG_REQUIRED;
    that.TYPE_FLAG_NOT_ALLOWED = TYPE_FLAG_NOT_ALLOWED;

    var RootMugType = {
        typeName: "The Abstract Mug Type Definition",
        //set initial properties
        /**
         * A property is a key:value pair.
         * Properties values can take one of 4 forms.
         * Property keys are the name of the field in the actual mug to be looked at during validation.
         * The four (4) forms of property values:
         *  - One of the type flags (e.g. TYPE_FLAG_REQUIRED)
         *  - A string, representing the actual string value a field should have in the mug
         *  - A dictionary (of key value pairs) illustrating a 'block' (e.g. see the bindElement property below)
         *  - a function (taking a block of fields from the mug as its only argument). The function MUST return either
         *     the string 'pass' or an error string.
         */
        properties : {
            dataElement: {
                nodeID: TYPE_FLAG_REQUIRED,
                dataValue: TYPE_FLAG_OPTIONAL
            },
            bindElement: {
                nodeID: TYPE_FLAG_OPTIONAL,
                dataType: "xsd:text",
                relevantAttr: TYPE_FLAG_OPTIONAL,
                calculateAttr: TYPE_FLAG_OPTIONAL,
                constraintAttr: TYPE_FLAG_OPTIONAL,
                constraintMsgAttr: function(bindBlock){
                    var hasConstraint = (typeof bindBlock.constraintAttr !== 'undefined');
                    var hasConstraintMsg = (typeof bindBlock.constraintMsgAttr !== 'undefined');
                    if(hasConstraintMsg && !hasConstraint){
                        return 'ERROR: Bind cannot have a Constraint Message with no Constraint!';
                    }else{
                        return 'pass';
                    }
                }
            },
            controlElement: {
                name: "Text",
                tagName: "input",
                label: TYPE_FLAG_REQUIRED,
                itext: TYPE_FLAG_OPTIONAL,
                hintItext: TYPE_FLAG_OPTIONAL,
                defaultValue: TYPE_FLAG_OPTIONAL,
                xsdType: "xsd:text"
            }
        },

        //for validating a mug against this internal definition we have.
        validateMug : function(aMug){
            /**
             * Takes in a key-val pair like {"controlNode": TYPE_FLAG_REQUIRED}
             * and an object to check against, and tell you if the object lives up to the rule
             * returns true if the object abides by the rule.
             *
             * For example, if the rule above is used, we pass in a mug to check if it has a controlNode.
             * If a property with the name of "controlNode" exists, true will be returned since it is required and present.
             *
             * if the TYPE_FLAG is TYPE_FLAG_OPTIONAL, true will always be returned.
             * if TYPE_FLAG_NOT_ALLOWED and a property with it's corresponding key IS present in the testing object,
             * false will be returned.
             *
             * if a TYPE_FLAG is not used, check the value. (implies that this property is required)
             * @param ruleKey
             * @param ruleValue
             * @param testingObj
             */

            //TODO: CLEANUP
            var validateRule = function(ruleKey, ruleValue, testingObj, blockName){
                if(ruleValue === TYPE_FLAG_OPTIONAL){
                    return {
                        result: 'pass',
                        resultMessage: '"'+ ruleKey + '" is Optional in block:'+blockName,
                        'ruleKey': ruleKey,
                        'ruleValue': ruleValue,
                        'objectValue': testingObj
                    };
                }else if(ruleValue === TYPE_FLAG_REQUIRED){
                    if(typeof testingObj[ruleKey] !== 'undefined'){
                        return {
                            result: 'pass',
                            resultMessage: '"'+ ruleKey + '" is Required and Present in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue,
                            'objectValue': testingObj
                        };
                    }else{
                        return {
                            result: 'fail',
                            resultMessage:'"'+ ruleKey + '" VALUE IS REQUIRED in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue
                        };
                    }
                }else if(ruleValue === TYPE_FLAG_NOT_ALLOWED){
                    if(typeof testingObj[ruleKey] === 'undefined'){ //note the equivalency modification from the above
                        return {result: true};
                    }else{
                        return {
                            result: 'fail',
                            resultMessage:'"'+ ruleKey + '" IS NOT ALLOWED IN THIS OBJECT in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue
                        };
                    }
                }else if(typeof ruleValue === 'string'){
                    return {
                            result: 'pass',
                            resultMessage: '"'+ ruleKey + '" is a string value (Required) and Present in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue,
                            'objectValue': testingObj
                        };
                }else if(typeof ruleValue === 'function'){
                    var funcRetVal = ruleValue(testingObj);
                    if(funcRetVal === 'pass'){
                        return {
                            result: 'pass',
                            resultMessage: '"'+ ruleKey + '" is a string value (Required) and Present in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue,
                            'objectValue': testingObj
                        }
                    }else{
                        return {
                            result: 'fail',
                            resultMessage:'"'+ ruleKey + '" ::: '+funcRetVal+' in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue
                        }
                    }
                }
                else{
                    return {
                            result: 'fail',
                            resultMessage:'"'+ ruleKey + '" MUST BE OF TYPE_OPTIONAL,REQUIRED,NOT_ALLOWED or a "string" in block:'+blockName,
                            'ruleKey': ruleKey,
                            'ruleValue': ruleValue
                    };

                }
            };

            /**
             * internal method that loops through the properties in this type definition
             * recursively and compares that with the state of the mug (using validateRule
             * to run the actual comparisons).
             *
             * The object that is returned is a JSON object that contains information
             * about the validation. returnObject["status"] will be either "pass" or "fail"
             * "status" will be set to fail if any one property is not in the required state
             * in the mug.
             * @param propertiesObj
             * @param testingObj
             * @param blockName
             */
            var recurse = function(propertiesObj, testingObj, blockName){
                var i, results;

                results = {"status": "pass"}; //set initial status
                results["blockName"] = blockName;
                if(!(testingObj || undefined)){
                    results["status"] = "fail"
                    results["message"] = "No testing object passed for propertiesObj " + JSON.stringify(propertiesObj);
                    results["errorType"] = "NullPointer";
                    return results;
                }

                for(i in propertiesObj){
                    //go deeper if required
                    if(typeof propertiesObj[i] === 'object'){
                        results[i] = recurse(propertiesObj[i],testingObj[i],i);

                        //see if the recursion went ok, flip out if not.
                        if(results[i].status === "fail"){
                            results["status"] = "fail"
                            results["message"] = "Recursion Failure on block: "+i;
                            results["errorBlockName"] = i;
                            results["errorType"] = 'recursion';
                            return results;
                        }else{
                            results["status"] = "pass";
                        }
                    }else{
                        results[i] = validateRule(i,propertiesObj[i],testingObj, blockName);
                        if(results[i].result === 'fail'){
                            results["status"] = "fail";
                            results["message"] = "Validation Rule Failure on Property: "+i;
                            results["errorBlockName"] = i;
                            results["errorType"] = 'validation';
                            return results; //short circuit the validation
                        }else{
                            results["status"] = "pass";
                        }
                    }
                }
                return results;
            },
                    mug;
            mug = aMug || this.mug || null;
            if(!mug){
                throw 'MUST HAVE A MUG TO VALIDATE!';
            }
            return recurse(this.properties,mug,"Mug Top Level");



        },

        //OBJECT FIELDS//
        parentDataMugType: null, //for keeping a tree like structure of all the Data nodes
        parentControlMugType: null, //for keeping a tree like structure of all the Control nodes
        controlNodeCanHaveChildren: false,
        dataNodeCanHaveChildren: true,

        mug: null

    };
    that.RootMugType = RootMugType;

    //Testing mugType for unit testing.  Ignore:
    var otherMugType = formdesigner.util.clone(RootMugType);
    otherMugType.properties.bindElement["SOME_PROPERTeYE"] = TYPE_FLAG_REQUIRED;
    that.otherMugType = otherMugType;

    /**
     * WARNING: These are 'abstract' MugTypes!
     * To bring them kicking and screaming into the world, you must call
     * formdesigner.util.getNewMugType(someMT), this will return a fully init'd mugType,
     * where someMT can be either one of the below abstract MugTypes or a 'real' MugType.
     *
     */
    var mugTypes = {
        //the four basic valid combinations of Data, Bind and Control elements
        dataBind: function(){
            var mType = formdesigner.util.clone(RootMugType);

            mType.typeName = "Data+Bind Only Mug";
            delete mType.properties.controlElement;
            return mType;
        }(),
        dataBindControlQuestion: function(){
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data Bind Control Question Mug";
            return mType;
        }(),
        dataControlQuestion: function(){
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data+Control Question Mug";
            delete mType.properties.bindElement;
            return mType;
        }(),
        dataOnly: function(){
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data ONLY Mug";
            delete mType.properties.controlElement;
            delete mType.properties.bindElement;
            return mType;
        }()
    };
    that.mugTypes = mugTypes;

//
    var createMugFromMugType = function(mugType){
       return false;
    };
    that.createMugFromMugType = createMugFromMugType;





    return that;
}());


    