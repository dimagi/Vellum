/*jslint browser: true, maxerr: 50, indent: 4 */
/**
 * Model classes and functions for the FormDesigner
 */
if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

function stacktrace() {
  function st2(f) {
    return !f ? [] :
        st2(f.caller).concat([f.toString().split('(')[0].substring(9) + '(' + f.arguments.join(',') + ')']);
  }
  return st2(arguments.callee.caller);
}

formdesigner.model = function () {
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
    var Mug = function (spec) {
        var that = {}, mySpec, dataElement, bindElement, controlElement;

        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);

        that.properties = {};
        if (typeof spec === 'undefined') {
            mySpec = {};
        } else {
            mySpec = spec;
        }

        /**
         * This constructor will take in a spec
         * consisting of various elements (see Mug comments)
         */
        (function construct(spec) {
            var i;
            for (i in spec) {
                if (spec.hasOwnProperty(i)) {
                    that.properties[i] = spec[i];
                }
            }
//            that.properties.bindElement = spec.bindElement || undefined;
//            that.properties.dataElement = spec.dataElement || undefined;
//            that.properties.controlElement = spec.controlElement || undefined;
        }(mySpec));

        that.getBindElementID = function () {
            if (this.properties.bindElement) {
                return this.properties.bindElement.properties.nodeID;
            } else {
                return null;
            }
        };

        that.getDataElementID = function () {
            if (this.properties.dataElement) {
                return this.properties.dataElement.properties.nodeID;
            } else {
                return null;
            }
        };

        that.getDisplayName = function () {
            var retName = this.getBindElementID();
            if (!retName) {
                retName = this.getDataElementID();
            }
            if (!retName) {
                if (this.properties.controlElement) {
                    retName = this.properties.controlElement.properties.label;
                }
            }
            return retName;
        };

        that.toString = function () {
            return "Mug";
        };

        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.Mug = Mug;

    var Xhtml = function () {
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
    };
    that.xhtml = Xhtml;

    var Localization = function () {
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
    var BindElement = function (spec) {
        var that = {}, unusedXMLattrs = {};
        that.properties = {};


        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);
        var attributes;

        (function constructor(the_spec) {
            if (typeof the_spec === 'undefined') {
                return null; //nothing to be done.
            } else {
                var i;
                //also attach the attributes to the root 'that' object:
                for (i in the_spec) {
                    if (the_spec.hasOwnProperty(i)) {
                        that.properties[i] = the_spec[i];
                    }
                }
            }
        }(spec));

        that.toString = function () {
            return 'Bind Element: ' + this.properties.nodeID;
        }

        //make the object capable of storing unused/unknown xml tag attributes
        formdesigner.util.allowUnusedXMLAttributes(that);

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
    var LiveText = function () {
        //Todo eventually: add checking for null pointer tokens

        var that = {};

        var phrases = [];

        /**
         * Renders the token in the phrases list specified by tokenIndex
         * and returns it as a string
         * @param tokenIndex
         */
        var getRenderedToken = function (tokenIndex) {
            var tObj;
            var outString = '';
            if (tokenIndex > phrases.length - 1) {
                return undefined;
            }
            tObj = phrases[tokenIndex];
            if (typeof tObj.refObj === 'undefined') {
                throw "incorrect Live Object added to LiveText! Can't render string.";
            } else if (typeof tObj.refObj === 'string') {
                outString += tObj.refObj;
            } else {
                outString += tObj.callback.apply(tObj.refObj, tObj.params);
            }
            return outString;
        };

        /**
         * Get the string this liveText represents
         * with all the function/object references replaced with
         * their textual representations (use add()
         * to add strings/objects when building a liveText)
         */
        that.renderString = function () {
            var outString = "";
            var i;
            for (i = 0; i < phrases.length; i++) {
                outString += getRenderedToken(i);
            }
            return outString;
        };


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
        that.addToken = function (token, callback, params) {
            var tObj = {};
            if (typeof token === 'string') {
                tObj.refObj = token;
            } else {
                tObj.refObj = token;
                tObj.callback = callback;
                tObj.params = params;
            }
            phrases.push(tObj);
        };

        /**
         * Returns the list of token objects
         * (an array of mixed strings and/or objects)
         */
        that.getTokenList = function () {
            return phrases;
        };


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
    var DataElement = function (spec) {
        var that = {};
        that.properties = {};

        (function constructor(mySpec) {
            if (typeof mySpec === 'undefined') {
                return null; //nothing to be done.
            } else {
                var i;
                //also attach the attributes to the root 'that' object:
                for (i in mySpec) {
                    if (mySpec.hasOwnProperty(i)) {
                        that.properties[i] = mySpec[i];
                    }
                }
            }
        }(spec));

        //make the object capable of storing unused/unknown xml tag attributes
        formdesigner.util.allowUnusedXMLAttributes(that);

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
    var ControlElement = function (spec) {
        var that = {};
        that.properties = {};

        var typeName, controlName, label, hintLabel, labelItext, hintItext, defaultValue;
        //give this object a unique fd id
        formdesigner.util.give_ufid(that);

        (function constructor(mySpec) {
            if (typeof mySpec === 'undefined') {
                return null; //nothing to be done.
            } else {
                var i;
                //also attach the attributes to the root 'that' object:
                for (i in mySpec) {
                    if (mySpec.hasOwnProperty(i)) {
                        that.properties[i] = mySpec[i];
                    }
                }
            }
        }(spec));

        //make the object capable of storing unused/unknown xml tag attributes
        formdesigner.util.allowUnusedXMLAttributes(that);

        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.ControlElement = ControlElement;


    ///////////////////////////////////////////////////////////////////////////////////////
//////    DEFINITION (MUG TYPE) CODE /////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

        /**
     * Creates a new mug (with default init values)
     * based on the template (MugType) given by the argument.
     *
     * @return the new mug associated with this mugType
     */
    that.createMugFromMugType = function (mugType) {
        /**
         * Walks through the properties (block) and
         * procedurally generates a spec that can be passed to
         * various constructors.
         * Default values are null (for OPTIONAL fields) and
         * "" (for REQUIRED fields).
         * @param block - rule block
         * @param name - name of the spec block being generated
         * @return a dictionary: {spec_name: spec}
         */
        function getSpec(properties){
            var i,j, spec = {};
            for(i in properties){
                if(properties.hasOwnProperty(i)){
                    var block = properties[i];
                    spec[i] = {}
                    for (j in block){
                        if(block.hasOwnProperty(j)){
                            var p = block[j];
                            if(p.presence === 'required' || p.presence === 'optional'){
                                spec[i][j] = null;
                            }
                            if(p.values && p.presence !== 'notallowed'){
                                spec[i][j] = p.values[0];
                            }
                        }
                    }
                }
            }
            return spec;
        }

        //loop through mugType.properties and construct a spec to be passed to the Mug Constructor.
        //BE CAREFUL HERE.  This is where the automagic architecture detection ends, some things are hardcoded.
        var mugSpec, dataElSpec, bindElSpec, controlElSpec, i,
                mug,dataElement,bindElement,controlElement,
                specBlob = {}, validationResult, mugProps, nodeID, defaultItextValue;

        specBlob = getSpec(mugType.properties);
        mugSpec = specBlob || undefined;
        dataElSpec = specBlob.dataElement || undefined;
        bindElSpec = specBlob.bindElement || undefined;
        controlElSpec = specBlob.controlElement || undefined;

        //create the various elements, mug itself, and linkup.
        if (mugSpec) {
            mug = new Mug(mugSpec);
            if (controlElSpec) {
                mug.properties.controlElement = new ControlElement(controlElSpec);
            }
            if (dataElSpec) {
                if (typeof dataElSpec.nodeID !== 'undefined') {
                    dataElSpec.nodeID = formdesigner.util.generate_question_id();
                }
                mug.properties.dataElement = new DataElement(dataElSpec);
            }
            if (bindElSpec) {
                if (typeof bindElSpec.nodeID !== 'undefined') {
                    if (dataElSpec.nodeID) {
                        bindElSpec.nodeID = dataElSpec.nodeID; //make bind id match data id for convenience
                    }else{
                        bindElSpec.nodeID = formdesigner.util.generate_question_id();
                    }
                }
                mug.properties.bindElement = new BindElement(bindElSpec);
            }


        }
        mugProps = mug.properties;
        if (mug.properties.controlElement) {
            //Create some default Itext IDs
            nodeID = null;


            if (mugProps.bindElement) { //try for the bindElement nodeID
                nodeID = mugProps.bindElement.properties.nodeID;
            }
            if (!nodeID) { //if nothing, try the dataElement nodeID
                if (mugProps.dataElement) {
                   nodeID = mugProps.dataElement.properties.nodeID;
                }
            }

            if (!nodeID) { //Still nothing... so try some more exotic stuff
                if (mugProps.controlElement) {
                    //must be an Item or similar generate an itextID
                    nodeID = formdesigner.util.generate_item_label();

                }
            }

            //finally
            mugProps.controlElement.properties.labelItextID = nodeID;


        }

        if (controlElSpec) { //this is some kind of select item or trigger...
                //give it a useful initial label
            if(dataElSpec) {
                defaultItextValue = mugProps.dataElement.properties.nodeID;
            }else if (bindElSpec) {
                defaultItextValue = mugProps.bindElement.properties.nodeID;
            }else if (controlElSpec) { //fall back to the Itext ID
                defaultItextValue = mugProps.controlElement.properties.labelItextID;
            }else { //what are we even doing here?
                throw 'Mug does not contain any elements! Missing Data, Bind and Control elements!';
            }
            formdesigner.model.Itext.setValue(
                    mug.properties.controlElement.properties.labelItextID,
                    formdesigner.model.Itext.getDefaultLanguage(),
                    'default',
                    defaultItextValue
            )
        }

        //Bind the mug to it's mugType
        mugType.mug = mug || undefined;

//        //ok,now: validate the mug to make sure everything is peachy.
//        validationResult = mugType.validateMug(mug);
//        if (validationResult.status !== 'pass') {
//            console.group("Failed Validation on Mug Auto-creation");
//            console.log('Failed validation object');
//            console.log(validationResult);
//            console.log("MugType:");
//            console.log(mugType);
//            console.groupEnd();
//            throw 'Newly constructed mug did not pass validation!';
//        }else{
            return mug;
//        }
    };

    var validationFuncs = {
        //should be used to figure out the logic for label, defaultLabel, labelItext, etc properties
        label: function (mugType, mug) {
            var controlBlock, hasLabel, hasLabelItextID, missing, hasItext, Itext;
            Itext = formdesigner.model.Itext
            controlBlock = mug.properties.controlElement.properties;
            hasLabel = !(!(controlBlock.label));
            hasLabelItextID = !(!(controlBlock.labelItextID));
            if(hasLabelItextID){
                hasItext = Itext.hasHumanReadableItext(mug,false);
            } else {
                hasItext = false;
            }
            if (hasLabel) {
                return 'pass';
            } else if (hasLabelItextID && hasItext) {
                return 'pass';
            } else if (hasLabelItextID && !hasItext) {
                missing = 'a display label';
            }else if (!hasLabel && !hasLabelItextID) {
                missing = 'a display label ID';
            }else if (!hasLabel) {
                missing = 'a display label'
            }else if (!hasLabelItextID) {
                missing = 'a display label ID';
            }
            return 'Question is missing ' + missing + ' value!';
        },
        hintItextID: function (mugType, mug) {
            var controlBlock, hintIID, itextVal, Itext, controlElement;
            controlBlock = mugType.properties.controlElement;
            controlElement = mug.properties.controlElement.properties;
            Itext = formdesigner.model.Itext;
            hintIID = controlElement.hintItextID;
            itextVal = Itext.getValue(hintIID,Itext.getDefaultLanguage(),'default');
            if(hintIID && !itextVal) {
                return 'Question has Hint Itext ID but no Hint Itext Label Data!';
            }
            if(itextVal && !hintIID) {
                return 'Question has Hint Itext Display label but no Hint Itext ID!';
            }
            if(controlBlock.hintItextID === 'required' && !hintIID) {
                return 'Hint Itext ID is required but not present in this question!';
            }

            return 'pass';
        }
    }

    that.validationFuncs = validationFuncs;


    var RootMugType = {
        typeName: "The Abstract Mug Type Definition", //human readable Type Name (Can be anything)
        type : "root", //easier machine readable value for the above;
        //type var can contain the following values: 'd', 'b', 'c', ('data', 'bind' and 'control' respectively)
        // or any combination of them. For example, a Mug that contains a dataElement and a controlElement (but no bindElement)
        // would be of type 'dc'.  'root' is the exception for the abstract version of the MugType (which should never be directly used anyway).
        // use: formdesigner.util.clone(RootMugType); instead. (As done below in the mugTypes object).

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
         *
         *     PropertyValue = {
         *          editable: 'r|w', //(read only) or (read and write)
         *          visibility: 'hidden|visible', //show as a user editable property?
         *          presence: 'required|optional|notallowed' //must this property be set, optional or should not be present?
         *          [values: [arr of allowable vals]] //list of allowed values for this property
         *          [validationFunc: function(mugType,mug)] //special validation function, optional, return errorMessage string or 'pass'
         *          lstring: "Human Readable Property Description" //Optional
         *      }
         *
         */
        properties : {
            dataElement: {
                nodeID: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'required',
                    lstring: 'Question ID'
                        },
                dataValue: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    lstring: 'Default Data Value'
                },
                keyAttr: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: 'JR:Preload key value'
                },
                xmlnsAttr: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: "Special Data Node XMLNS attribute"
                }
            },
            bindElement: {
                nodeID: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: 'Bind Node ID'
                },
                dataType: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    values: formdesigner.util.XSD_DATA_TYPES,
                    uiType: 'select',
                    lstring: 'Data Type'
                },
                relevantAttr: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    lstring: 'Skip Condition'
                },
                calculateAttr: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    lstring: 'Calculate Condition'
                },
                constraintAttr: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    lstring: 'Constraint Condition'
                },
                constraintMsgAttr: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    validationFunc : function (mugType, mug) {
                        var bindBlock = mug.properties.bindElement.properties;
                        var hasConstraint = (typeof bindBlock.constraintAttr !== 'undefined');
                        var hasConstraintMsg = (typeof bindBlock.constraintMsgAttr !== 'undefined');
                        if (hasConstraintMsg && !hasConstraint) {
                            return 'ERROR: Bind cannot have a Constraint Message with no Constraint!';
                        } else {
                            return 'pass';
                        }
                    },
                    lstring: 'Constraint Message'
                },
                requiredAttr: {
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    lstring: "Is this Question Required?",
                    uiType: "checkbox"
                },
                preload: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: "JR Preload"
                },
                preloadParams: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: "JR Preload Param"
                },
                nodeset: {
                    editable: 'r',
                    visibility: 'hidden',
                    presence: 'optional' //if not present one will be generated... hopefully.
                }
            },
            controlElement: {
                name: { //internal use
                    editable: 'w',
                    visibility: 'hidden',
                    presence: 'required',
                    values: formdesigner.util.VALID_QUESTION_TYPE_NAMES
                },
                tagName: { //internal use
                    editable: 'r',
                    visibility: 'hidden',
                    presence: 'required',
                    values: formdesigner.util.VALID_CONTROL_TAG_NAMES
                },
                label: {
                    editable: 'w',
                    visibility: 'hidden',
                    presence: 'required',
                    validationFunc : validationFuncs.label,
                    lstring: "Default Label"
                },
                hintLabel: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: "Hint Label"
                },
                labelItextID: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: "Question Itext ID",
                    validationFunc : validationFuncs.label
                },
                hintItextID: {
                    editable: 'w',
                    visibility: 'advanced',
                    presence: 'optional',
                    lstring: "Question HINT Itext ID",
                    validationFunc: validationFuncs.hintItextID
                }
            }
        },

        //for validating a mug against this internal definition we have.
        validateMug : function () {
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
            var validateRule = function (ruleKey, ruleValue, testingObj, blockName,curMugType,curMug) {
                var retBlock = {},
                        visible = ruleValue.visibility,
                        editable = ruleValue.editable,
                        presence = ruleValue.presence;

                retBlock.ruleKey = ruleKey;
                retBlock.ruleValue = ruleValue;
                retBlock.objectValue = testingObj;
                retBlock.blockName = blockName;
                retBlock.result = 'fail';

                if (!testingObj) {
                    return retBlock;
                }

                if (presence === 'optional') {
                    retBlock.result = 'pass';
                    retBlock.resultMessage = '"' + ruleKey + '" is Optional in block:' + blockName;
                } else if (presence === 'required') {
                    if (testingObj[ruleKey]) {
                        retBlock.result = 'pass';
                        retBlock.resultMessage = '"' + ruleKey + '" is Required and Present in block:' + blockName;
                    } else {
                        retBlock.result = 'fail';
                        retBlock.resultMessage = '"' + ruleKey + '" value is required in:' + blockName + ', but is NOT present!';
                    }
                } else if (presence === 'notallowed') {
                    if (!testingObj[ruleKey]) { //note the equivalency modification from the above
                        retBlock.result = 'pass';
                    } else {
                        retBlock.result = 'fail';
                        retBlock.resultMessage = '"' + ruleKey + '" IS NOT ALLOWED IN THIS OBJECT in:' + blockName;
                    }
                } else {
                    retBlock.result = 'fail';
                    retBlock.resultMessage = '"' + ruleKey + '" MUST BE OF TYPE_OPTIONAL, REQUIRED, NOT_ALLOWED or a "string" in block:' + blockName;
                    retBlock.ruleKey = ruleKey;
                    retBlock.ruleValue = ruleValue;
                    retBlock.testingObj = testingObj;
                }

                if (ruleValue.validationFunc) {
                    var funcRetVal = ruleValue.validationFunc(curMugType,curMug);
                    if (funcRetVal === 'pass') {
                        retBlock.result = 'pass';
                        retBlock.resultMessage = '"' + ruleKey + '" is a string value (Required) and Present in block:' + blockName;
                    } else {
                        retBlock.result = 'fail';
                        retBlock.resultMessage = funcRetVal;
                    }
                }

                return retBlock;
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
             * @param testingObj - the Mug properties block.
             * @param blockName
             */
            var checkProps = function (mugT,propertiesObj, testingObj, blockName) {
                var i, j,y,z, results, testObjProperties,
                        mug = mugT.mug,
                        mugProperties = mug.properties;
                results = {"status": "pass"}; //set initial status
                results.blockName = blockName;
                if (!(testingObj || undefined)) {
                    results.status = "fail";
                    results.message = "No testing object passed for propertiesObj " + JSON.stringify(propertiesObj);
                    results.errorType = "NullPointer";
                    return results;
                }
                for (i in propertiesObj) {
                    if(propertiesObj.hasOwnProperty(i)){
                        var block = propertiesObj[i],
                                tResults = {};
                        for(y in block){
                            if(block.hasOwnProperty(y)){
                                if(!testingObj[i]){
                                    throw 'No Mug.properties??'
                                }
                                tResults[y] = validateRule(y,block[y],testingObj[i].properties,i,mugT,mugT.mug);
                                if (tResults[y].result === "fail") {
                                    results.status = "fail";
                                    results.message = tResults[y].resultMessage;
                                    results.errorBlockName = tResults[y].blockName;
                                    results[i] = tResults;
                                }

                            }
                        }
                        results[i] = tResults;
                    }
                }

                for(j in mugProperties){
                    if(mugProperties.hasOwnProperty(j)){
                        var pBlock = mugProperties[j];
                        for (z in pBlock.properties){
                            if(pBlock.properties.hasOwnProperty(z)){
                                var p = pBlock.properties[z],
                                        rule = propertiesObj[j][z];
                                if(p && (!rule || rule.presence === 'notallowed')){
                                    results.status = "fail";
                                    results.message = j + " has property '" + z + "' but no rule is present for that property in the MugType!";
                                    results.errorBlockName = j;
                                    results.errorProperty = z;
                                    results.errorType = 'MissingRuleValidation';
                                    results.propertiesBlock = pBlock;
                                }

                            }
                        }
                    }
                }
                return results;

            },

            /**
             * Checks the type string of a MugType (i.e. the mug.type value)
             * to see if the correct properties block Elements are present (and
             * that there aren't Elements there that shouldn't be).
             * @param mugT - the MugType to be checked
             */
            checkTypeString = function (mugT) {
                        var typeString = mugT.type, i,
                                hasD = (mugT.properties.dataElement ? true : false),
                                hasC = (mugT.properties.controlElement ? true : false),
                                hasB = (mugT.properties.bindElement ? true : false);

                        if (hasD) {
                            if (typeString.indexOf('d') === -1) {
                                return {status: 'fail', message: "MugType.type has a 'dataElement' in its properties block but no 'd' char in its type value!"};
                            }
                        } else {
                            if (typeString.indexOf('d') !== -1) {
                                return {status: 'fail', message: "MugType.type has a 'd' char in it's type value but no 'd' !"};
                            }
                        }
                        if (hasB) {
                            if (typeString.indexOf('b') === -1) {
                                return {status: 'fail', message: "MugType.type has a 'bindElement' in its properties block but no 'b' char in its type value!"};
                            }
                        } else {
                            if (typeString.indexOf('b') !== -1) {
                                return {status: 'fail', message: "MugType.type has a 'b' char in it's type value but no 'b' !"};
                            }
                        }
                        if (hasC) {
                            if (typeString.indexOf('c') === -1) {
                                return {status: 'fail', message: "MugType.type has a 'controlElement' in its properties block but no 'c' char in its type value!"};
                            }
                        } else {
                            if (typeString.indexOf('c') !== -1) {
                                return {status: 'fail', message: "MugType.type has a 'c' char in it's type value but no 'c' !"};
                            }
                        }


                        return {status: 'pass', message: "typeString for MugType validates correctly"};
                    },

            mug = this.mug || null;

            if (!mug) {
                throw 'MUST HAVE A MUG TO VALIDATE!';
            }
            var selfValidationResult = checkTypeString(this);
            var validationResult = checkProps(this,this.properties, mug.properties, "Mug Top Level");

            if (selfValidationResult.status === 'fail') {
                validationResult.status = 'fail';
            }
            validationResult.typeCheck = selfValidationResult;
            return validationResult;
        },

        //OBJECT FIELDS//
        controlNodeCanHaveChildren: false,

        /** A list of controlElement.tagName's that are valid children for this control element **/
        controlNodeAllowedChildren : [],
        dataNodeCanHaveChildren: true,

        mug: null,
        toString: function () {
            if (this.mug && this.mug.properties.dataElement) {
                return this.mug.properties.dataElement.properties.nodeID;
            } else {
                return this.typeName;
            }
        }

    };
    formdesigner.util.eventuality(RootMugType);
    that.RootMugType = RootMugType;

    /**
     * WARNING: These are 'abstract' MugTypes!
     * To bring them kicking and screaming into the world, you must call
     * formdesigner.util.getNewMugType(someMT), this will return a fully init'd mugType,
     * where someMT can be either one of the below abstract MugTypes or a 'real' MugType.
     *
     */
    var mugTypes = {
        //the four basic valid combinations of Data, Bind and Control elements
        //when rolling your own, make sure the 'type' variable corresponds
        //to the Elements and other settings in your MugType (e.g. in the 'db' MT below
        //the controlElement is deleted.
        dataBind: function () {
            var mType = formdesigner.util.clone(RootMugType);

            mType.typeName = "Data + Bind Only Mug";
            mType.type = "db";
            delete mType.properties.controlElement;
            return mType;
        }(),
        dataBindControlQuestion: function () {
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data Bind Control Question Mug";
            mType.type = "dbc";
            return mType;
        }(),
        dataControlQuestion: function () {
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data + Control Question Mug";
            mType.type = "dc";
            delete mType.properties.bindElement;
            return mType;
        }(),
        dataOnly: function () {
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data ONLY Mug";
            mType.type = "d";
            delete mType.properties.controlElement;
            delete mType.properties.bindElement;
            return mType;
        }(),
        controlOnly: function () {
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Control ONLY Mug";
            mType.type = "c";
            delete mType.properties.dataElement;
            delete mType.properties.bindElement;
            return mType;
        }()
    };
    that.mugTypes = mugTypes;

    /**
     * This is the output for MugTypes.  If you need a new Mug or MugType (with a mug)
     * use these functions.  Each of the below functions will create a new MugType and a
     * new associated mug with some default values initialized according to what kind of
     * MugType is requested.
     */
    that.mugTypeMaker = {};
    that.mugTypeMaker.stdTextQuestion = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug;
        mType.typeName = "Text Question MugType";
        mType.controlNodeAllowedChildren = false;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Text";
        mType.mug.properties.controlElement.properties.tagName = "input";
        mType.mug.properties.bindElement.properties.dataType = "xsd:string";
        return mType;
    };

    that.mugTypeMaker.stdSecret = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug;
        mType.typeName = "Secret Question MugType";
        mType.controlNodeAllowedChildren = false;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Secret";
        mType.mug.properties.controlElement.properties.tagName = "secret";

        mType.properties.bindElement.dataType.validationFunc = function (mt,m) {
            var dtype = m.properties.bindElement.properties.dataType;
            if (formdesigner.util.XSD_DATA_TYPES.indexOf(dtype) !== -1) {
                return 'pass';
            } else {
                return 'Secret question data type must be a valid XSD Datatype!';
            }
        };
        mType.properties.bindElement.dataType.lstring = 'Data Type';
        mType.mug.properties.bindElement.properties.dataType = "xsd:string";
        return mType;
    };

    that.mugTypeMaker.stdInt = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug;
        mType.typeName = "Integer Question MugType";
        mType.controlNodeAllowedChildren = false;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Integer";
        mType.mug.properties.controlElement.properties.tagName = "input";
        mType.mug.properties.bindElement.properties.dataType = "xsd:int";
        return mType;
    };

    that.mugTypeMaker.stdGeopoint = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug;
        mType.typeName = "Geopoint Question MugType";
        mType.controlNodeAllowedChildren = false;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Geopoint";
        mType.mug.properties.controlElement.properties.tagName = "input";
        mType.mug.properties.bindElement.properties.dataType = "geopoint";
        return mType;
    };

    that.mugTypeMaker.stdDate = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug;
        mType.typeName = "Date Question MugType";
        mType.controlNodeAllowedChildren = false;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Date";
        mType.mug.properties.controlElement.properties.tagName = "input";
        mType.mug.properties.bindElement.properties.dataType = "xsd:date";
        return mType;
    };

    that.mugTypeMaker.stdDateTime = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug;
        mType.typeName = "Date Time Question MugType";
        mType.controlNodeAllowedChildren = false;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "DateTime";
        mType.mug.properties.controlElement.properties.tagName = "input";
        mType.mug.properties.bindElement.properties.dataType = "xsd:dateTime";
        return mType;
    };

    that.mugTypeMaker.stdLong = function () {
        var mType, mug;
        mType = formdesigner.model.mugTypeMaker.stdInt();
        mug = mType.mug;
        mType.typeName = "Long Question MugType";
        mType.mug.properties.controlElement.properties.name = "Long";
        mType.mug.properties.bindElement.properties.dataType = "xsd:long";
        return mType;
    };

    that.mugTypeMaker.stdDouble = function () {
        var mType, mug;
        mType = formdesigner.model.mugTypeMaker.stdInt();
        mug = mType.mug;
        mType.typeName = "Double Question MugType";
        mType.mug.properties.controlElement.properties.name = "Double";
        mType.mug.properties.bindElement.properties.dataType = "xsd:double";
        return mType;
    }


    that.mugTypeMaker.stdItem = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.controlOnly),
                mug,
                vResult,
                controlProps;

        mType.typeName = "Item MugType";
        mType.controlNodeAllowedChildren = false;


        controlProps = mType.properties.controlElement;
        controlProps.hintLabel.presence = 'notallowed';
        controlProps.hintItextID.presence = 'notallowed';
        controlProps.defaultValue = {
            lstring: 'Item Value',
            visibility: 'visible',
            editable: 'w',
            presence: 'required'
        }
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Item";
        mType.mug.properties.controlElement.properties.tagName = "item";
        return mType;
    };

    that.mugTypeMaker.stdTrigger = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                mug,
                vResult, controlProps, bindProps;

        mType.typeName = "Trigger/Message MugType";
        mType.controlNodeAllowedChildren = false;
        mType.properties.bindElement.dataType.presence = 'notallowed';
        mType.properties.dataElement.dataValue.presence = 'notallowed';

        controlProps = mType.properties.controlElement;
        controlProps.hintLabel.presence = 'notallowed';
        controlProps.hintItextID.presence = 'notallowed';

        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Trigger";
        mType.mug.properties.controlElement.properties.tagName = "trigger";
        return mType;
    };

    that.mugTypeMaker.stdMSelect = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                allowedChildren,
                mug,
                vResult;
        mType.controlNodeCanHaveChildren = true;
        mType.typeName = "Standard Multi Select Question";
        allowedChildren = ['item'];
        mType.controlNodeAllowedChildren = allowedChildren;
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Multi-Select";
        mType.mug.properties.controlElement.properties.tagName = "select";
        mType.mug.properties.bindElement.properties.dataType = "xsd:select";
        return mType;
    };

    that.mugTypeMaker.stdSelect = function () {
        var mType = formdesigner.model.mugTypeMaker.stdMSelect(), mug;
        mug = mType.mug;
        mType.typeName = "Standard Single Select Question";
        mType.mug.properties.controlElement.properties.name = 'Single-Select';
        mType.mug.properties.controlElement.properties.tagName = "select1";
        mType.mug.properties.bindElement.properties.dataType = "select1";
        return mType;
    }

    that.mugTypeMaker.stdGroup = function () {
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                allowedChildren,
                mug,
                vResult;
        mType.controlNodeCanHaveChildren = true;
        mType.typeName = "Standard Group";
        allowedChildren = ['repeat', 'input', 'select', 'select1', 'group'];
        mType.controlNodeAllowedChildren = allowedChildren;
        mType.properties.bindElement.dataType.presence = "notallowed";
        mType.properties.controlElement.hintItextID.presence = "notallowed";
        mType.properties.controlElement.hintLabel.presence = "notallowed";
        mType.properties.dataElement.dataValue.presence = "notallowed";
        mug = that.createMugFromMugType(mType);
        mType.mug = mug;
        mType.mug.properties.controlElement.properties.name = "Group";
        mType.mug.properties.controlElement.properties.tagName = "group";


        vResult = mType.validateMug();
//        if(vResult.status !== 'pass'){
//            formdesigner.util.throwAndLogValidationError(vResult,mType,mType.mug);
//        }
        return mType;
    };

    that.mugTypeMaker.stdRepeat = function () {
        var mType;

        mType = formdesigner.model.mugTypeMaker.stdGroup();
        mType.typeName = "Standard Repeat";
        mType.mug.properties.controlElement.properties.name = "Repeat";
        mType.mug.properties.controlElement.properties.tagName = "repeat";
        return mType;
    }



    /**
     * A regular tree (with any amount of leafs per node)
     * @param tType - is this a DataElement tree or a controlElement tree (use 'data' or 'control' for this argument, respectively)
     * tType defaults to 'data'
     */
    var Tree = function (tType) {
        var that = {}, rootNode, treeType = tType;
        if (!treeType) {
            treeType = 'data';
        }

        /**
         * Children is a list of objects.
         * @param children - optional
         * @param value - that value object that this node should contain (should be a MugType)
         */
        var Node = function (Children, value) {
            var that = {}, isRootNode = false, nodeValue, children = Children;

            var init = function (nChildren, val) {
                if (!val) {
                    throw 'Cannot create a node without specifying a value object for the node!';
                }
                children = nChildren || [];
                nodeValue = val;
            }(children, value);

            that.getChildren = function () {
                return children;
            };

            that.getValue = function () {
                return nodeValue;
            };

            that.setValue = function (val) {
                nodeValue = val;
            }

            /**
             * DOES NOT CHECK TO SEE IF NODE IS IN TREE ALREADY!
             * Adds child to END of children!
             */
            that.addChild = function (node) {
                if (!children) {
                    children = [];
                }
                children.push(node);
            };

            /**
             * Insert child at the given index (0 means first)
             * if index > children.length, will insert at end.
             * -ve index will result in child being added to first of children list.
             */
            that.insertChild = function (node, index) {
                if (node === null) {
                    return null;
                }

                if (index < 0) {
                    index = 0;
                }

                children.splice(index, 0, node);
            };

            /**
             * Given a mugType, finds the node that the mugType belongs to.
             * if it is not the current node, will recursively look through children node (depth first search)
             */
            that.getNodeFromMugType = function (MugType) {
                if (MugType === null) {
                    return null;
                }
                var retVal, thisVal;
                thisVal = this.getValue();
                if (thisVal === MugType) {
                    return this;
                } else {
                    for (var i in children) {
                        if (children.hasOwnProperty(i)) {
                            retVal = children[i].getNodeFromMugType(MugType);
                            if (retVal) {
                                return retVal;
                            }
                        }
                    }
                }
                return null; //we haven't found what we're looking for
            };

            /**
             * Given a ufid, finds the mugType that it belongs to.
             * if it is not the current node, will recursively look through children node (depth first search)
             *
             * Returns null if not found.
             */
            that.getMugTypeFromUFID = function (ufid) {
                if (!ufid) {
                    return null;
                }
                var retVal, thisUfid;
                if (this.getValue() !== ' ') {
                    thisUfid = this.getValue().ufid || '';
                } else {
                    thisUfid = '';
                }

                if (thisUfid === ufid) {
                    return this.getValue();
                } else {
                    for (var i in children) {
                        if (children.hasOwnProperty(i)) {
                            retVal = children[i].getMugTypeFromUFID(ufid);
                            if (retVal) {
                                return retVal;
                            }
                        }
                    }
                }
                return null; //we haven't found what we're looking for
            };

            that.removeChild = function (node) {
                if (!node) {
                    throw 'Null child specified! Cannot remove \'null\' from child list';
                }
                var childIdx = children.indexOf(node);
                if (childIdx !== -1) { //if arg node is a member of the children list
                    children.splice(childIdx, 1); //remove it
                }

                return node;
            };

            /**
             * Finds the parentNode of the specified node (recursively going through the tree/children of this node)
             * Returns the parent if found, else null.
             */
            that.findParentNode = function (node) {
                if (!node) {
                    throw "No node specified, can't find 'null' in tree!";
                }
                var i, parent = null;
                if (!children || children.length === 0) {
                    return null;
                }
                if (children.indexOf(node) !== -1) {
                    return this;
                }

                for (i in children) {
                    if (children.hasOwnProperty(i)) {
                        parent = children[i].findParentNode(node);
                        if (parent !== null) {
                            return parent;
                        }
                    }
                }
                return parent;
            };

            /**
             * An ID used during prettyPrinting of the Node. (a human readable value for the node)
             */
            that.getID = function () {
                var id;
                if (this.isRootNode) {
                    id = formdesigner.controller.form.formID;
                    if (id) {
                        return id;
                    } else {
                        return 'RootNode';
                    }
                }
                if (!this.getValue() || typeof this.getValue().validateMug !== 'function') {
                    return 'NodeWithNoValue!';
                }
                if (treeType === 'data') {
                    return this.getValue().mug.getDataElementID();
                } else if (treeType === 'control') {
                    return formdesigner.util.getMugDisplayName(this.getValue());
                } else {
                    throw 'Tree does not have a specified treeType! Default is "data" so must have been forcibly removed!';
                }
            };

            /**
             * Get all children MUG TYPES of this node (not recursive, only the top level).
             * Return a list of MugType objects, or empty list for no children.
             */
            that.getChildrenMugTypes = function () {
                var i, retList = [];
                for (i in children) {
                    if (children.hasOwnProperty(i)) {
                        retList.push(children[i].getValue());
                    }
                }
                return retList;
            };


            that.toString = function () {
                return this.getID();
            };

            that.prettyPrint = function () {
                var arr = [], i;
                for (i in children) {
                    if (children.hasOwnProperty(i)) {
                        arr.push(children[i].prettyPrint());
                    }
                }
                if (!children || children.length === 0) {
                    return this.getID();
                } else {
                    return '' + this.getID() + '[' + arr + ']';
                }
            };

            /**
             * calls the given function on each node (the node
             * is given as the only argument to the given function)
             * and appends the result (if any) to a flat list
             * (the store argument) which is then returned
             * @param nodeFunc
             * @param store
             */
            that.treeMap = function (nodeFunc, store, afterChildFunc) {
                var result, child;
                result = nodeFunc(this); //call on self
                if(result){
                    store.push(result);
                }
                for(child in this.getChildren()){
                    if(this.getChildren().hasOwnProperty(child)){
                        this.getChildren()[child].treeMap(nodeFunc, store, afterChildFunc); //have each children also perform the func
                    }
                }
                if(afterChildFunc){
                    afterChildFunc(this, result);
                }
                return store; //return the results
            };

            /**
             * See docs @ Tree.validateTree()
             */
            var validateTree = function () {
                var thisResult, thisMT, i, childResult;
                if(!this.getValue()){
                    throw 'Tree contains node with no values!'
                }
                thisMT = this.getValue();
                thisResult = thisMT.validateMug();
                if(thisResult.status === 'fail'){
                    return false;
                }

                for (i in this.getChildren()) {
                    if (this.getChildren().hasOwnProperty(i)) {
                        childResult = this.getChildren()[i].validateTree();
                        if(!childResult){
                            return false;
                        }
                    }
                }

                //If we got this far, everything checks out.
                return true;


            }
            that.validateTree = validateTree;

            return that;
        };

        var init = function (type) {
            rootNode = new Node(null, ' ');
            rootNode.isRootNode = true;
            treeType = type || 'data';
        }(treeType);
        that.rootNode = rootNode;

        /** Private Function
         * Adds a node to the top level (as a child of the abstract root node)
         *
         * @param parentNode - the parent to which the specified node should be added
         * if null is given, the node will be added to the top level of the tree (as a child
         * of the abstract rootNode).
         * @param node - the specified node to be added to the tree.
         */
        var addNode = function (node, parentNode) {
            if (parentNode) {
                parentNode.addChild(node);
            } else {
                rootNode.addChild(node);
            }
        };

        that.getParentNode = function (node) {
            if (this.rootNode === node) { //special case:
                return this.rootNode;
            } else { //regular case
                return this.rootNode.findParentNode(node);
            }
        };

        /**
         * Given a mugType, finds the node that the mugType belongs to (in this tree).
         * Will return null if nothing is found.
         */
        that.getNodeFromMugType = function (MugType) {
            return rootNode.getNodeFromMugType(MugType);
        };

        that.getParentMugType = function (MugType) {
            var node = this.getNodeFromMugType(MugType);
            if (!node) {
                return null;
            }
            var pNode = that.getParentNode(node),
                    pMT = pNode.getValue();
            return (pMT === ' ') ? null : pMT;
        };

        /**
         * Removes a node (and all it's children) from the tree (regardless of where it is located in the
         * tree) and returns it.
         *
         * If no such node is found in the tree (or node is null/undefined)
         * null is returned.
         */
        var removeNodeFromTree = function (node) {
            if (!node) {
                return null;
            }
            if (!that.getNodeFromMugType(node.getValue())) {
                return null;
            } //node not in tree
            var parent = that.getParentNode(node);
            if (parent) {
                parent.removeChild(node);
                return node;
            } else {
                return null;
            }
        };

        /**
         * Insert a MugType as a child to the node containing parentMugType.
         *
         * Will MOVE the mugType to the new location in the tree if it is already present!
         * @param mugType - the MT to be inserted into the Tree
         * @param position - position relative to the refMugType. Can be 'null', 'before', 'after' or 'into'
         * @param refMugType - reference MT.
         *
         * if refMugType is null, will default to the last child of the root node.
         * if position is null, will default to 'after'.  If 'into' is specified, mugType will be inserted
         * as a ('after') child of the refMugType.
         *
         * If an invalid move is specified, no operation will occur.
         */
        that.insertMugType = function (mugType, position, refMugType) {
            var refNode, refNodeSiblings, refNodeIndex, refNodeParent, node;
            
            if (!formdesigner.controller.checkMoveOp(mugType, position, refMugType, treeType)) {
                throw 'Illegal Tree move requested! Doing nothing instead.';
            }

            if (position !== null && typeof position !== 'string') {
                throw "position argument must be a string or null! Can be 'after', 'before' or 'into'";
            }
            if (!position) {
                position = 'after';
            }

            if (!refMugType) {
                refNode = rootNode;
                position = 'into';
            } else {
                refNode = this.getNodeFromMugType(refMugType);
            }

            //remove it from tree if it already exists
            node = removeNodeFromTree(this.getNodeFromMugType(mugType)); 
            if (!node) {
                node = new Node(null, mugType);
            }
            
            if (position !== 'into') {
                refNodeParent = that.getParentNode(refNode);
                refNodeSiblings = refNodeParent.getChildren();
                refNodeIndex = refNodeSiblings.indexOf(refNode);
            }

            switch (position) {
                case 'before':
                    refNodeParent.insertChild(node, refNodeIndex);
                    break;
                case 'after':
                    refNodeParent.insertChild(node, refNodeIndex + 1);
                    break;
                case 'into':
                    refNode.addChild(node);
                    break;
                case 'first':
                    refNode.insertChild(node, 0);
                    break;
                case 'last':
                    refNode.insertChild(node, refNodeSiblings.length + 1);
                    break;
                default:
                    throw "in insertMugType() position argument MUST be null, 'before', 'after', 'into', 'first' or 'last'.  Argument was: " + position;
            }
        };

        /**
         * Returns a list of nodes that are in the top level of this tree (i.e. not the abstract rootNode but it's children)
         */
        var getAllNodes = function () {
            return rootNode.getChildren();
        };

        /**
         * returns the absolute path, in the form of a string separated by slashes ('/nodeID/otherNodeID/finalNodeID'),
         * the nodeID's are those given by the Mugs (i.e. the node value objects) according to whether this tree is a
         * 'data' (DataElement) tree or a 'bind' (BindElement) tree.
         *
         * @param nodeOrMugType - can be a tree Node or a MugType that is a member of this tree (via a Node)
         */
        that.getAbsolutePath = function (mugType) {
            var node, output, nodeParent;
            if (typeof mugType.validateMug === 'function') { //a loose way of checking that it's a MugType...
                node = this.getNodeFromMugType(mugType);
            } else {
                throw 'getAbsolutePath argument must be a MugType!';
            }
            if (!node) {
//                console.log('Cant find path of MugType that is not present in the Tree!');
                return null;
            }
            nodeParent = this.getParentNode(node);
            output = '/' + node.getID();

            while (nodeParent) {
                output = '/' + nodeParent.getID() + output;
                if(nodeParent.isRootNode){
                    break;
                }
                nodeParent = this.getParentNode(nodeParent);

            }
                        
            return output;

        };

        that.printTree = function (toConsole) {
            var t = rootNode.prettyPrint();

            return t;
        };

        /**
         * Removes the specified MugType from the tree. If it isn't in the tree
         * does nothing.  Does nothing if null is specified
         *
         * If the MugType is successfully removed, returns that MugType.
         */
        that.removeMugType = function (MugType) {
            var node = this.getNodeFromMugType(MugType);
            if (!MugType || !node) {
                return;
            }
            removeNodeFromTree(node);
            return node;
        };

        /**
         * Given a UFID searches through the tree for the corresponding MugType and returns it.
         * @param ufid of a mug
         */
        that.getMugTypeFromUFID = function (ufid) {
            return rootNode.getMugTypeFromUFID(ufid);
        };

        /**
         * Returns all the children MugTypes (as a list) of the
         * root node in the tree.
         */
        that.getRootChildren = function () {
            return rootNode.getChildrenMugTypes();
        };

        /**
         * Method for testing use only.  You should never need this information beyond unit tests!
         *
         * Gets the ID used to identify a node (used during Tree prettyPrinting)
         */
        that._getMugTypeNodeID = function (MugType) {
            if (!MugType) {
                return null;
            }
            return this.getNodeFromMugType(MugType).getID();
        };

        /**
         * Method for testing use only.  You should never need this information beyond unit tests!
         *
         * Gets the ID string used to identify the rootNode in the tree. (used during Tree prettyPrinting)
         */
        that._getRootNodeID = function () {
            return rootNode.getID();
        };

        /**
         * Performs the given func on each
         * node of the tree (the Node is given as the only argument to the function)
         * and returns the result as a list.
         * @param func - a function called on each node, the node is the only argument
         * @param afterChildFunc - a function called after the above function is called on each child of the current node.
         */
        that.treeMap = function (func, afterChildFunc) {
            return rootNode.treeMap(func, [], afterChildFunc);
        };

        /**
         * Looks through all the nodes in the tree
         * and runs ValidateMugType on each.
         * If any fail (i.e. result === 'fail')
         * will return false, else return true.
         */
        var isTreeValid = function() {
            var rChildren = rootNode.getChildren(),
                i, retVal;
            for (i in rChildren){
                if(rChildren.hasOwnProperty(i)){
                    retVal = rChildren[i].validateTree();
                    if(!retVal){
                        return false;
                    }
                }
            }
            return true;
        }
        that.isTreeValid = isTreeValid;

        return that;
    };
    that.Tree = Tree;

    var Form = function () {
        var that = {}, dataTree, controlTree;

        var init = (function () {
            that.formName = 'New Form';
            that.formID = 'data';
            that.dataTree = dataTree = new Tree('data');
            that.controlTree = controlTree = new Tree('control');
        })();

        /**
         * Loops through the data and the control trees and picks out all the unique bind elements.
         * Returns a list of MugTypes
         */
        that.getBindList = function(){
            var bList = [],
                dataTree,controlTree,dBindList,cBindList,i,
                getBind = function(node){ //the function we will pass to treeMap
                    if(!node.getValue() || node.isRootNode){
                        return null;
                    }
                    var MT = node.getValue(),
                            M = MT.mug,
                            bind;
                    if(!MT.properties.bindElement){
                        return null;
                    }else{
                        bind = MT;
                        return bind;
                    }
                };

            dataTree = this.dataTree;
            controlTree = this.controlTree;
            dBindList = dataTree.treeMap(getBind);
            cBindList = controlTree.treeMap(getBind);

            //compare results, grab uniques
            for(i in dBindList){
                if(dBindList.hasOwnProperty(i)){
                    bList.push(dBindList[i]);
                }
            }

            for(i in cBindList){
                if(cBindList.hasOwnProperty(i)){
                    if(bList.indexOf(cBindList[i]) === -1){
                        bList.push(cBindList[i]); //grab only anything that hasn't shown up in the dBindList
                    }
                }
            }

            return bList;
            
        }

        /**
         * Searches through BOTH trees and returns
         * a MT if found (null if nothing found)
         */
        var getMugTypeByUFID = function (ufid) {
            var MT = dataTree.getMugTypeFromUFID(ufid);
            if(!MT) {
                MT = controlTree.getMugTypeFromUFID(ufid);
            }

            return MT;
        };
        that.getMugTypeByUFID = getMugTypeByUFID;

        var getInvalidMugTypes = function () {
            var MTListC, MTListD, result, controlTree, dataTree,
                mapFunc = function (node) {
                    if (node.isRootNode) {
                        return;
                    }
                    var MT = node.getValue(),
                        validationResult = MT.validateMug();

                    if(validationResult.status !== 'pass'){
                        return MT;
                    }else{
                        return null;
                    }
                }

            dataTree = this.dataTree;
            controlTree = this.controlTree;
            MTListC = controlTree.treeMap(mapFunc);
            MTListD = dataTree.treeMap(mapFunc);
            result = formdesigner.util.mergeArray(MTListC, MTListD);

            return result;
        }
        that.getInvalidMugTypes = getInvalidMugTypes;

        /**
         * Goes through both trees and picks out all the invalid
         * MugTypes and returns a dictionary with the MT.ufid as the key
         * and the validation object as the value
         */
        var getInvalidMugTypeUFIDs = function () {
            var badMTs = this.getInvalidMugTypes(), result = {}, i;
            for (i in badMTs){
                if(badMTs.hasOwnProperty(i)){
                    result[badMTs[i].ufid] = badMTs[i].validateMug();
                }
            }
            return result;
        }
        that.getInvalidMugTypeUFIDs = getInvalidMugTypeUFIDs;

        var getInvalidItextMugTypes = function () {
            var Itext, invalidItexts, MTListC, MTListD, result, controlTree, dataTree, mapFunc;

            mapFunc = function (node) {
                var MT, ufid, iID, hIID;
                if (node.isRootNode) {
                    return;
                }
                MT = node.getValue();
                ufid = MT.ufid;
                if(MT.properties.controlElement) {
                    iID = MT.mug.properties.controlElement.properties.labelItextID;
                    hIID = MT.mug.properties.controlElement.properties.hintItextID;
                }
                if(invalidItexts.indexOf(iID) !== -1) {
                    return MT;
                } else if (invalidItexts.indexOf(hIID) !== -1) {
                    return MT;
                } else {
                    return null;
                }
            };


            Itext = formdesigner.model.Itext;
            invalidItexts = Itext.getInvalidItextIDs();

            if(invalidItexts === 'true') {
                return [];
            }

            dataTree = this.dataTree;
            controlTree = this.controlTree;
            MTListC = controlTree.treeMap(mapFunc);
            MTListD = dataTree.treeMap(mapFunc);
            result = formdesigner.util.mergeArray(MTListC, MTListD);

            return result;
        }
        that.getInvalidItextMugTypes = getInvalidItextMugTypes;

        var getInvalidItextMTUfids = function () {
            var MTs, ufids = [], i;
            MTs = getInvalidItextMugTypes();

            for (i in MTs) {
                if(MTs.hasOwnProperty(i)) {
                    ufids.push(MTs[i].ufid);
                }
            }
            return ufids;
        }
        that.getInvalidItextMTUfids = getInvalidItextMTUfids;

        /**
         * Generates an XML Xform and returns it as a string.
         */
        var createXForm = function () {
            var sanitizeXML = function(xmlString) {
                if(!xmlString) {
                    return;
                }

                return xmlString.replace(/\>/g, "&gt;").replace(/\</g, "&lt;");
            }
            var create_dataBlock = function () {
                //use dataTree.treeMap(func,listStore,afterChildfunc)
                // create func that opens + creates the data tag, that can be recursively called on all children
                // create afterChildfunc that closes the data tag
                function mapFunc (node) {
                    var xw = formdesigner.controller.XMLWriter,
                        defaultVal, extraXMLNS, keyAttr,
                        MT = node.getValue();

                    xw.writeStartElement(node.getID());
                    if(!node.isRootNode && MT.mug.properties.dataElement.properties.dataValue){
                        defaultVal = MT.mug.properties.dataElement.properties.dataValue;
                        xw.writeString(defaultVal);
                    }
                    if(!node.isRootNode && MT.mug.properties.dataElement.properties.keyAttr){
                        keyAttr = MT.mug.properties.dataElement.properties.keyAttr;
                        xw.writeAttributeString("key", keyAttr);
                    }
                    if(!node.isRootNode && MT.mug.properties.dataElement.properties.xmlnsAttr){
                        extraXMLNS = MT.mug.properties.dataElement.properties.xmlnsAttr;
                        xw.writeAttributeString("xmlns", extraXMLNS);
                    }


                    if (node.isRootNode) {
                        create_model_header();
                    }
                }

                function afterFunc (node) {
                    var xw = formdesigner.controller.XMLWriter;
                    xw.writeEndElement();
                    //data elements only require one close element call with nothing else fancy.
                }

                dataTree.treeMap(mapFunc, afterFunc);
            }

            var create_bindList = function () {
                var xw = formdesigner.controller.XMLWriter,
                    bList = formdesigner.controller.form.getBindList(),
                    MT,
                        //vars populated by populateVariables()
                        bEl,cons,consMsg,nodeset,type,relevant,required,calc,
                    i, attrs, j;

                /**
                 * Converts true to 'true()' and false to 'false()'. Returns null for all else.
                 * @param req
                 */
                function createBindRequiredAttribute(req) {
                    if(req === true) {
                        return 'true()';
                    }else if (req === false) {
                        return 'false()';
                    } else {
                        return null;
                    }
                }

                function populateVariables (MT){
                    bEl = MT.mug.properties.bindElement;
                    if (bEl) {
                        cons = sanitizeXML(bEl.properties.constraintAttr);
                        consMsg = bEl.properties.constraintMsgAttr;
                        nodeset = dataTree.getAbsolutePath(MT);
                        type = bEl.properties.dataType;
                        relevant = sanitizeXML(bEl.properties.relevantAttr);
                        required = sanitizeXML(createBindRequiredAttribute(bEl.properties.requiredAttr));
                        calc = sanitizeXML(bEl.properties.calculateAttr);
                        preld = bEl.properties.preload;
                        preldParams = bEl.properties.preloadParams;
                        return {
                            nodeset: nodeset,
                            'type': type,
                            constraint: cons,
                            constraintMsg: consMsg,
                            relevant: relevant,
                            required: required,
                            calculate: calc,
                            preload: preld,
                            preloadParams: preldParams
                        }
                    } else {
                        return null;
                    }
                }

                for (i in bList) {
                    if(bList.hasOwnProperty(i)){
                        MT = bList[i];
                        attrs = populateVariables(MT);
                        if(attrs.nodeset){
                            xw.writeStartElement('bind');
                        }
                        for (j in attrs) { //for each populated property
                            if(attrs.hasOwnProperty(j)){
                                if(attrs[j]){ //if property has a useful bind attribute value
                                    if(j === "constraintMsg"){
                                        xw.writeAttributeString("jr:constraintMsg",attrs[j]); //write it
                                    } else if (j === "preload") {
                                        xw.writeAttributeString("jr:preload", attrs[j]);
                                    } else if (j === "preloadParams") {
                                        xw.writeAttributeString("jr:preloadParams", attrs[j]);
                                    } else {
                                        xw.writeAttributeString(j,attrs[j]);
                                    } //write it
                                }
                            }
                        }
                        if(attrs.nodeset) {
                            xw.writeEndElement();
                        }

                    }
                }
            }

            var create_controlBlock = function () {
                var mapFunc, afterFunc

                function mapFunc(node) {
                    if(node.isRootNode) { //skip
                        return;
                    }

                    var mugType = node.getValue(),
                        cProps = mugType.mug.properties.controlElement.properties,
                        label,
                        xmlWriter = formdesigner.controller.XMLWriter;

                    /**
                     * @param tagName
                     * @param elLabel - dictionary: {ref: 'itext ref string', defText: 'default label text'} both are optional
                     */
                    function createOpenControlTag(tagName,elLabel){
                        tagName = tagName.toLowerCase();
                        var isGroupOrRepeat = (tagName === 'group' || tagName === 'repeat');

                        /**
                         * Creates the label tag inside of a control Element in the xform
                         */
                        function createLabel() {
                            if (elLabel) {
                                xmlWriter.writeStartElement('label');
                                if (elLabel.ref) {
                                    xmlWriter.writeAttributeString('ref',elLabel.ref);
                                }
                                if (elLabel.defText) {
                                    xmlWriter.writeString(elLabel.defText);
                                }
                                xmlWriter.writeEndElement(); //close Label tag;
                            }
                        }

                        //////Special logic block to make sure the label ends up in the right place
                        if (isGroupOrRepeat) {
                            xmlWriter.writeStartElement('group');
                            createLabel();
                            if (tagName === 'repeat') {
                                xmlWriter.writeStartElement('repeat');
                            }
                        } else {
                            xmlWriter.writeStartElement(tagName);
                        }
                        if (tagName !== 'group') {
                            createLabel();
                        }
                        //////////////////////////////////////////////////////////////////////////
                        if (tagName === 'item' && cProps.defaultValue) {
                            //do a value tag for an item MugType
                            xmlWriter.writeStartElement('value');
                            xmlWriter.writeString(cProps.defaultValue);
                            xmlWriter.writeEndElement();
                        }
                        ///////////////////////////////////////////////////////////////////////////
                        ///Set the nodeset/ref attribute correctly
                        if (tagName !== 'item') {
                            var attr, absPath;
                            if (tagName === 'repeat') {
                                attr = 'nodeset';
                            } else {
                                attr = 'ref';
                            }
                            absPath = formdesigner.controller.form.dataTree.getAbsolutePath(mugType);
                            xmlWriter.writeAttributeString(attr, absPath);
                        }
                        //////////////////////////////////////////////////////////////////////
                        //Do hint label
                        if( tagName !== 'item' && tagName !== 'repeat'){
                            if(cProps.hintLabel || cProps.hintItextID){
                                xmlWriter.writeStartElement('hint');
                                if(cProps.hintLabel){
                                    xmlWriter.writeString(cProps.hintLabel);
                                }
                                if(cProps.hintItextID){
                                    var ref = "jr:itext('" + cProps.hintItextID + "')";
                                    xmlWriter.writeAttributeString('ref',ref);
                                }
                                xmlWriter.writeEndElement();
                            }
                        }
                        ///////////////////////////////////////
                    }


                    //create the label object (for createOpenControlTag())
                    if (cProps.label) {
                        label = {};
                        label.defText = cProps.label;
                    }
                    if (cProps.labelItextID) {
                        if (!label) {
                            label = {};
                        }
                        label.ref = "jr:itext('" + cProps.labelItextID + "')";
                    }
                    ////////////

                    createOpenControlTag(cProps.tagName, label);

                }


                function afterFunc(node) {
                    if (node.isRootNode) {
                        return;
                    }

                    var xmlWriter = formdesigner.controller.XMLWriter,
                        mugType = node.getValue(),
                        tagName = mugType.mug.properties.controlElement.properties;
                    //finish off
                    xmlWriter.writeEndElement(); //close control tag.
                    if(tagName === 'repeat'){
                        xmlWriter.writeEndElement(); //special case where we have to close the repeat as well as the group tag.
                    }

                }

                controlTree.treeMap(mapFunc, afterFunc);
            }

            var create_itextBlock = function () {
                var xmlWriter = formdesigner.controller.XMLWriter, hasItext, lang, languages, Itext, id,
                        langData, val, formData, form, i;
                Itext = formdesigner.model.Itext;
                languages = Itext.getLanguages();
                hasItext = languages.length > 0;

                if (hasItext) {
                    xmlWriter.writeStartElement("itext");
                    for (i in languages) {
                        if (languages.hasOwnProperty(i)) {
                            lang = languages[i];
                            xmlWriter.writeStartElement("translation");
                            xmlWriter.writeAttributeString("lang", lang);
                            if (Itext.getDefaultLanguage() === lang) {
                                xmlWriter.writeAttributeString("default", '');
                            }
                            langData = Itext.getLanguageData(lang);
                            for (id in langData) {
                                if(langData.hasOwnProperty(id)) {
                                    xmlWriter.writeStartElement("text");
                                    xmlWriter.writeAttributeString("id",id);
                                    formData = langData[id];
                                    for (form in formData) {
                                        if (formData.hasOwnProperty(form)) {
                                            val = formData[form];
                                            xmlWriter.writeStartElement("value");
                                            if(form !== "default") {
                                                xmlWriter.writeAttributeString('form', form);
                                            }
                                            xmlWriter.writeString(val);
                                            xmlWriter.writeEndElement();
                                        }
                                    }
                                    xmlWriter.writeEndElement();
                                }
                            }
                            xmlWriter.writeEndElement();
                        }
                    }
                    xmlWriter.writeEndElement();
                }

                //done with Itext block generation.
            }

            var create_model_header = function () {
                var xw = formdesigner.controller.XMLWriter,
                        uuid, uiVersion, version, formName, jrm;
                //assume we're currently pointed at the opening date block tag
                //e.g. <model><instance><data> <--- we're at <data> now.

                jrm = formdesigner.formJRM;
                if(!jrm) {
                    jrm = "http://dev.commcarehq.org/jr/xforms";
                }

                uuid = formdesigner.formUuid; //gets set at parse time/by UI
                if(!uuid) {
                    uuid = "http://openrosa.org/formdesigner/" + formdesigner.util.generate_xmlns_uuid();
                }

                uiVersion = formdesigner.formUIVersion; //gets set at parse time/by UI
                if(!uiVersion) {
                    uiVersion = 1;
                }

                version = formdesigner.formVersion; //gets set at parse time/by UI
                if(!version) {
                    version = 1;
                }

                formName = formdesigner.controller.form.formName; //gets set at parse time/by UI
                if(!formName) {
                    formName = "New Form";
                }

                xw.writeAttributeString("xmlns:jrm",jrm);
                xw.writeAttributeString("xmlns", uuid);
                xw.writeAttributeString("uiVersion", uiVersion);
                xw.writeAttributeString("version", version);
                xw.writeAttributeString("name", formName);
            }

            function html_tag_boilerplate () {
                var xw = formdesigner.controller.XMLWriter;
                xw.writeAttributeString( "xmlns:h", "http://www.w3.org/1999/xhtml" );
                xw.writeAttributeString( "xmlns:orx", "http://openrosa.org/jr/xforms" );
                xw.writeAttributeString( "xmlns", "http://www.w3.org/2002/xforms" );
                xw.writeAttributeString( "xmlns:xsd", "http://www.w3.org/2001/XMLSchema" );
                xw.writeAttributeString( "xmlns:jr", "http://openrosa.org/javarosa" );
            }

            var generate_form = function (form_title) {
                var docString;
                formdesigner.controller.initXMLWriter();
                var xw = formdesigner.controller.XMLWriter;

                xw.writeStartDocument();
                //Generate header boilerplate up to instance level
                xw.writeStartElement('h:html');
                html_tag_boilerplate();
                    xw.writeStartElement('h:head');
                        xw.writeStartElement('h:title');
                            xw.writeString(formdesigner.controller.form.formName);
                        xw.writeEndElement();       //CLOSE TITLE

                ////////////MODEL///////////////////
                        xw.writeStartElement('model');
                            xw.writeStartElement('instance');
                                create_dataBlock();
                            xw.writeEndElement(); //CLOSE INSTANCE
                        /////////////////BINDS /////////////////
                            create_bindList();
                        ///////////////////////////////////////
                        //////////ITEXT //////////////////////
                            create_itextBlock();
                        ////////////////////////////////////
                        xw.writeEndElement(); //CLOSE MODEL
                ///////////////////////////////////
                    xw.writeEndElement(); //CLOSE HEAD

                    xw.writeStartElement('h:body');
                /////////////CONTROL BLOCK//////////////
                        create_controlBlock();
                ////////////////////////////////////////
                    xw.writeEndElement(); //CLOSE BODY
                xw.writeEndElement(); //CLOSE HTML

                xw.writeEndDocument(); //CLOSE DOCUMENT
                docString = xw.flush();

                return docString;
            };
            var xformString = generate_form('TEST');
            this.fire('xform-created');
            return xformString;
        }
        that.createXForm = createXForm;

        /**
         * Goes through all mugs (in data and control tree and bindList)
         * to determine if all mugs are Valid and ok for form creation.
         */
        var isFormValid = function () {
            var i, bList;
            if (!this.dataTree.isTreeValid()) {
                return false;
            }
            if (!this.controlTree.isTreeValid()) {
                return false;
            }
            bList = this.getBindList();
            for (i in bList) {
                if(bList.hasOwnProperty(i)){
                    if (bList[i].validateMug.status === 'fail') {
                       return false;
                    }
                }
            }

            return true;
        };
        that.isFormValid = isFormValid;

        /**
         * Searches through the dataTree for a mugType
         * that matches the given nodeID (e.g. mugType.mug.properties.dataElement.properties.nodeID)
         *
         * WARNING:
         * Some MugTypes (such as for example 'Items' or 'Triggers' or certain 'Group's may not have
         * any nodeID at all (i.e. no bind element and no data element)
         * in such cases... other methods need to be used as this method will not find a match.
         * @param nodeID
         * @param treeType - either 'data' or 'control
         */
        var getMugTypeByIDFromTree = function (nodeID, treeType) {
            var mapFunc = function (node) {
                if(node.isRootNode){
                    return;
                }
                var mt = node.getValue(),
                    thisDataNodeID, thisBindNodeID;
                if (mt.properties.dataElement && mt.mug.properties.dataElement) {
                    thisDataNodeID = mt.mug.properties.dataElement.properties.nodeID;
                }
                if (mt.properties.bindElement && mt.mug.properties.bindElement){
                    thisBindNodeID = mt.mug.properties.bindElement.properties.nodeID;
                }
                if (!thisDataNodeID && !thisBindNodeID){
                    return; //this MT just has no nodeID :/
                }


                if(thisDataNodeID === nodeID || thisBindNodeID === nodeID){
                    return mt;
                }
            }

            var retVal;
            if (treeType === 'data') {
                retVal = dataTree.treeMap(mapFunc);
            }else if (treeType === 'control') {
                retVal = controlTree.treeMap(mapFunc);
            }else{
                throw 'Invalid TreeType specified! Use either "data" or "control"';
            }

            return retVal;

        };
        that.getMugTypeByIDFromTree = getMugTypeByIDFromTree;

        /**
         * Replace a MugType that already exists in a tree with a new
         * one.  It is up to the caller to ensure that the MT
         * ufids and other properties match up as required.
         * Use with caution.
         * @param oldMT
         * @param newMT
         * @param treeType
         *
         * @return - true if a replacement occurred. False if no match was found for oldMT
         */
        var replaceMugType = function (oldMT, newMT, treeType){
            function treeFunc (node) {
                if(node.getValue() === oldMT){
                    node.setValue(newMT);
                    return true;
                }
            }

            var result, tree;
            if(treeType === 'data'){
                tree = dataTree;
            }else {
                tree = controlTree;
            }
            result = tree.treeMap(treeFunc);
            if(result.length > 0){
                return result[0];
            }else {
                return false;
            }
        };
        that.replaceMugType = replaceMugType;
        
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.Form = Form;

    /**
     * The itext holder object. Access all Itext through this gate.
     *
     * Expected forms of itext:
     * - default (i.e. no special form)
     * - long
     * - short
     * - image
     * - audio
     * - hint
     *
     * @param langName
     */
    that.Itext = (function(langName){
        var that = {}, defaultLanguage = "en",

                /**
                 * Data where it's all stored.
                 * Takes the shape of:
                 * { someLang: {
                 *      itextID1 : {
                 *          long: longVal,
                 *          image: imageVal,
                 *          ...
                 *          },
                 *      itextID2 : {
                 *          long: ...
                 *          ...
                 *          }
                 *      },
                 *   otherLang: {
                 *    ....
                 *   }
                 *
                 */

        data = {};

        function exceptionString(iID, lang, form, val){
            var s;
            s = 'iID:' + iID + ', language:' + lang + ', form:' + form;
            if(val){
                s += ', value:' + val;
            }
            return s;
        }

        that.addLanguage = function (name) {
            if(Object.keys(data).length === 0){
                this.setDefaultLanguage(name);
            }
            if(!data[name]){
                data[name] = {};
            }else{
                return; //do nothing, it already exists.
            }
        };

        /**
         * Returns a list of languages currently being stored in the itext global object.
         */
        that.getLanguages = function () {
            var langs = [], i;
            for(i in data){
                if(data.hasOwnProperty(i)){
                    langs.push(i);
                }
            }
            return langs;
        }

        /**
         * Not an undoable operation!
         * Does what it says on the tin.
         * @param name
         */
        that.removeLanguage = function (name) {
            if(this.getDefaultLanguage() === name){
                this.setDefaultLanguage(Object.keys(data)[0]); //attempt to set default to first available lang.
            }
            if(!data[name]) {
                return;
            }else{
                delete data[name];
            }
        };

        that.setDefaultLanguage = function (name) {
            defaultLanguage = name;
        };

        that.getDefaultLanguage = function () {
            return defaultLanguage;
        };

        /**
         * Add an itext item to the global Itext object.
         * valObject is a dictionary containing values for the various forms.
         * Can be any combination of forms. E.g.
         * valObject = {
         *  en : {
         *      short : "some short text",
         *      image : "jr://file/img.png"
         *      }
         *  }
         *
         *  If the languages in valObject do not exist, they will
         *  automatically be added.
         *
         *  @param iID is the itext ID of this item.
         */
        that.addItem = function (iID, valObject) {
            var lang;
            for(lang in valObject){
                if(valObject.hasOwnProperty(lang)){
                    if(!data[lang]){
                        data[lang] = {};
                    }
                    data[lang][iID] = valObject[lang];

                }
            }
        };

        /**
         * Get the Itext values for a specific Itext item
         * for a specified language.  If no language is specified,
         * will return valObject (see addItem())
         *
         * if iID does not exist, null is returned.
         * If lang does not exist, exception is thrown.
         */
        that.getItextVals = function (iID, lang) {
            if(!data[lang]){
                throw 'Language:' + lang + ' does not exist in Itext! Attempted to retrieve Itext data for iID:' + iID;
            }
            if(!data[lang][iID]){
                return null;
            }else{
                return data[lang][iID];
            }

        };

        /**
         * Create a new Itext ID in storage deliberately without a
         * value (this is usually to trigger the validation mechanism to pick up on
         * the fact that an Itext ID was specified but that there was no value).
         * @param iID
         * @param lang
         */
        that.createIIDWithoutVal = function (iID, lang) {
            if(!lang) {
                throw "Can't create a new Itext ID in Itext without specifying a language!"
            }

            if(!iID && lang) {
                throw "Attempted to create a new Itext ID without specifying one! Language: " + lang;
            }
            if(!iID) {
                throw "Attempted to create a new Itext ID without specifying one!";
            }

            if(!formdesigner.model.Itext.getLanguageData(lang)){
                formdesigner.model.Itext.addLanguage(lang);
            }
            data[lang][iID] = {};

        }

        /**
         * The 'meat' function.  Set a specific Itext element
         * by specifying the itext ID, language, form and value.
         * use form = 'default' or null for the default form.
         *
         * Will create the Itext item if none exists.
         * @param iID
         * @param lang
         * @param form
         * @param val
         */
        that.setValue = function (iID, lang, form, val){
            if(!iID || !lang || typeof form === 'undefined'){
                throw 'Must specify all arguments for Itext.setValue()!' + exceptionString(iID, lang, form, val);
            }

            if(!val) {
                val = '';
            }

            if(form === null){
                form = 'default';
            }
            if(!data[lang]){
                data[lang] = {};
            }
            if(!data[lang][iID]){
                data[lang][iID] = {};
            }
            if(!data[lang][iID][form]){
                data[lang][iID][form] = "";
            }
            data[lang][iID][form] = val;
            formdesigner.controller.fire({
                type: 'question-itext-changed',
                iTextID: iID,
                language: lang,
                textForm: form,
                value: val
            })

        };

        /**
         * Must specify all params, use form='default' or null for the default (no special form) form.
         * Throws exception if iID or lang does not exist. If no data is available for that form,
         * returns null.
         * @param iID
         * @param lang
         * @param form
         */
        that.getValue = function(iID, lang, form){
            if(!data[lang]){
//                throw 'Attempted to retrieve Itext value from language that does not exist!' + exceptionString(iID,lang,form)
                that.addLanguage(lang);
                return null;
            }
            if(!data[lang][iID]){
//                throw 'Attempted to retrieve Itext value that does not exist!' + exceptionString(iID,lang,form)
                return null;
            }

            if(!form){
                form = 'default';
            }

            if(!data[lang][iID][form]){
                return null;
            }

            return data[lang][iID][form];
        };

        /**
         * Gets all the data associated with a language in the form of a
         * dictionary object.  Structure:
         * {
         *      itextID1 : {
         *          long: longVal,
         *          image: imageVal,
         *          ...
         *          },
         *      itextID2 : {
         *          long: ...
         *          ...
         *          }
         *      }
         * }
         * @param lang - the string identifier of the language you want the data for.
         */
        that.getLanguageData = function (lang) {
            return data[lang];
        };

        that.getAllData = function () {
            return data;
        }

        /**
         * Goes through the Itext data and verifies that
         * a) a default language is set to something that exists
         * b) That every iID that exists in the DB has a translation in the default language (causes commcare to fail if not the case)
         *
         * if a) fails, will throw an exception
         * if b) fails, will return a dict of all offending iIDs that need a translation in order to pass validation with
         * the KEYs being ItextIDs and the values being descriptive error messages.
         *
         * if everything passes will return true
         */
        that.validateItext = function () {
            var dLang = this.getDefaultLanguage(),
                    lang,iID,form,
                    /**
                     * Follows form:
                     * { iID: errorMessage,
                     *   iID2 : otherErrorMessage,
                     *   ...
                     *  }
                     */
                    errorIIDs = {};

            function iIDMissing(iID, defLang){
                return 'Missing Itext ID:' + iID + ' in Default Language:' + defLang;
            }
            function iIDFormMissing(iID, form){
                return 'Missing Special Form:' + form + ' for Itext ID:' + iID;
            }
            function iIDTextEmpty(iID) {
                return 'No Itext Display Data for ID:' + iID;
            }

            if(!dLang){
                throw 'No Default Language set! Aborting validation. You should set one!';
            }

            if(!data[dLang]){
                throw 'Default language is set to a language that does not exist in the Itext DB!';
            }

            function isEmpty(ob){
                var i;
                for (var i in ob) {
                    if(ob.hasOwnProperty(i)){
                        return false;
                    }
                }
                return true;
            }
            for (lang in data) {
                if (data.hasOwnProperty(lang)) {
                    for (iID in data[lang]) {
                        if (data[lang].hasOwnProperty(iID)) {
                            if (isEmpty(data[dLang][iID])) {
                                errorIIDs[iID] = iIDTextEmpty(iID);
                            } else {
                                for (form in data[lang][iID]) {
                                    // The condition here is that there is a property 
                                    // in a language that is not in the default language
                                    if (data[lang][iID].hasOwnProperty(form) && 
                                        data[lang][iID][form] && 
                                        !data[dLang][iID][form]) {
                                       errorIIDs[iID] = iIDFormMissing(iID,form);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (Object.keys(errorIIDs).length === 0) {
                return true;
            } else {
                return errorIIDs;
            }

        };

        that.getInvalidItextIDs = function () {
            var valRes, IDs = [], i;
            valRes = formdesigner.model.Itext.validateItext();
            for (i in valRes) {
                if(valRes.hasOwnProperty(i)) {
                    IDs.push(i);
                }
            }

            return IDs;
        };

        /**
         * Convenience function takes in a Mug and determines
         * if there is any kind of itext stored for this mug
         * that is meant to be viewed by a person (i.e. default, long, short)
         * If so, return true, if not return false.
         *
         * set isHint to true if this query is in reference to hint/help text
         */
        that.hasHumanReadableItext = function(mug, isHint){
            if(!mug.properties.controlElement){
                return false;
            }

            var p = mug.properties.controlElement.properties,
                itextID = isHint ? p.hintItextID : p.labelItextID,
                ivals = this.getItextVals(itextID,this.getDefaultLanguage());

            if(!ivals) {
                return false;
            }

            if ( ivals['default'] || ivals.long || ivals.short ) {
                return true;
            } else {
                return false;
            }
        };

        var getHumanReadableItext = function (mug, isHint) {
            if(!mug.properties.controlElement){
                return false;
            }

            if(!formdesigner.model.Itext.hasHumanReadableItext(mug,isHint)) {
                return null;
            }


            var p = mug.properties.controlElement.properties,
                itextID = isHint ? p.hintItextID : p.labelItextID,
                ivals = this.getItextVals(itextID,this.getDefaultLanguage()),
                retval;

            if(!ivals) {
                return null;
            }

            retval = ivals ['default'];
            if(!retval) {
                retval = ivals['long'];
            }
            if(!retval) {
                retval = ivals['short'];
            }

            if(!retval) {
                retval = null;
            }

            return retval;

        }

        /**
         * Renames the itext ID to something new.
         * @param oldID
         * @param newID
         */
        that.renameItextID = function (oldID, newID) {
            if ( (!oldID || !newID) || (oldID === newID) ){
                return;
            }
            var langs, i, b;
            langs = formdesigner.model.Itext.getLanguages();
            for (i in langs) {
                if(langs.hasOwnProperty(i)){
                    if (data[langs[i]][oldID]) {
                        data[langs[i]][newID] = data[langs[i]][oldID];
                        delete data[langs[i]][oldID];
                    }
                }
            }

        }

        /**
         * Blows away all data stored in the Itext object
         * and resets it to pristine condition (i.e. as if the FD was freshly launched)
         */
        that.resetItext = function () {
            data = {};
            that.addLanguage("en");
            that.setDefaultLanguage("en");
        };

        (function init(initLang){
            that.addLanguage(initLang);
            that.setDefaultLanguage(initLang);
        })(langName);

        //make event aware
        formdesigner.util.eventuality(that);

        return that;
    })("en");

    /**
     * Called during a reset.  Resets the state of all
     * saved objects to represent that of a fresh init.
     */
    that.reset = function () {
        that.form = new Form();
        formdesigner.model.Itext.resetItext();
        formdesigner.controller.setForm(that.form);
    };

    /**
     * An initialization function that sets up a number of different fields and properties
     */
    var init = function () {
        var form = that.form = new Form();
        //set the form object in the controller so it has access to it as well
        formdesigner.controller.setForm(form);
    };
    that.init = init;




    return that;
}();


