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

        var dataElement,bindElement,controlElement,
                getBindElementID, getDataElementID;

        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);

        that['properties'] = {};
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
            that.properties.bindElement = spec.bindElement || undefined;
            that.properties.dataElement = spec.dataElement || undefined;
            that.properties.controlElement = spec.controlElement || undefined;
        }(mySpec));

        getBindElementID = that.getBindElementID = function(){
            return that.properties.bindElement.properties.nodeID;
        };

        getDataElementID = that.getDataElementID = function(){
            return that.properties.dataElement.properties.nodeID;
        }
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.Mug = Mug;

    var Form = function(){
        var that = {}, dataTree, controlTree;

        var init = (function(){
            that.dataTree = dataTree = new Tree('data');
            that.controlTree = controlTree = new Tree('control');
        })();

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
        that['properties'] = {};

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
                        that.properties[i] = the_spec[i];
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
        that['properties'] = {};

        (function constructor (mySpec){
            if(typeof mySpec === 'undefined'){
                return null; //nothing to be done.
            }else{
                var i;
                //also attach the attributes to the root 'that' object:
                for(i in mySpec){
                    if(mySpec.hasOwnProperty(i)){
                        that.properties[i] = mySpec[i];
                    }
                }
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
        that['properties'] = {};

        var typeName,controlName,label,hintLabel,labelItext,hintItext,defaultValue;
        //give this object a unique fd id
        formdesigner.util.give_ufid(that);

        (function constructor(mySpec){
            if(typeof mySpec === 'undefined'){
                return null; //nothing to be done.
            }else{
                var i;
                //also attach the attributes to the root 'that' object:
                for(i in mySpec){
                    if(mySpec.hasOwnProperty(i)){
                        that.properties[i] = mySpec[i];
                    }
                }
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


    var TYPE_FLAG_OPTIONAL = that.TYPE_FLAG_OPTIONAL = '_optional';
    var TYPE_FLAG_REQUIRED = that.TYPE_FLAG_REQUIRED = '_required';
    var TYPE_FLAG_NOT_ALLOWED = that.TYPE_FLAG_NOT_ALLOWED = '_notallowed';

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
                hintLabel: TYPE_FLAG_OPTIONAL,
                labelItext: TYPE_FLAG_OPTIONAL,
                hintItext: TYPE_FLAG_OPTIONAL,
                defaultValue: TYPE_FLAG_OPTIONAL
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
            var validateRule = function(ruleKey, ruleValue, testingObj, blockName){
                var retBlock = {};
                retBlock['ruleKey'] = ruleKey;
                retBlock['ruleValue'] = ruleValue;
                retBlock['objectValue'] = testingObj;
                retBlock['blockName'] = blockName;
                retBlock['result'] = 'fail';
                if(!testingObj){ return retBlock; }
                
                if(ruleValue === TYPE_FLAG_OPTIONAL){
                    retBlock['result'] = 'pass';
                    retBlock['resultMessage'] = '"'+ ruleKey + '" is Optional in block:'+blockName;
                }else if(ruleValue === TYPE_FLAG_REQUIRED){
                    if(typeof testingObj[ruleKey] !== 'undefined'){
                        retBlock['result'] = 'pass';
                        retBlock['resultMessage'] =  '"'+ ruleKey + '" is Required and Present in block:'+blockName;
                    }else{
                        retBlock['result'] = 'fail';
                        retBlock['resultMessage'] ='"'+ ruleKey + '" VALUE IS REQUIRED in block:'+blockName+', but is NOT present!';
                    }
                }else if(ruleValue === TYPE_FLAG_NOT_ALLOWED){
                    if(typeof testingObj[ruleKey] === 'undefined'){ //note the equivalency modification from the above
                        retBlock['result'] = 'pass';
                    }else{
                        retBlock['result'] = 'fail';
                        retBlock['resultMessage'] ='"'+ ruleKey + '" IS NOT ALLOWED IN THIS OBJECT in block:'+blockName;
                    }
                }else if(typeof ruleValue === 'string'){
                    if(testingObj[ruleKey] !== ruleValue){
                        retBlock['result'] = 'fail';
                        retBlock['resultMessage'] = '"'+ ruleKey +'" in "'+testingObj+'" is not equal to ruleValue:"'+ruleValue+'". Actual value:"'+testingObj[ruleKey]+'". (Required) in block:'+blockName;
                    }else{
                        retBlock['result'] = 'pass';
                        retBlock['resultMessage'] = '"'+ ruleKey + '" is a string value (Required) and Present in block:'+blockName;
                    }
                }else if(typeof ruleValue === 'function'){
                    var funcRetVal = ruleValue(testingObj);
                    if(funcRetVal === 'pass'){
                        retBlock['result'] = 'pass';
                        retBlock['resultMessage'] = '"'+ ruleKey + '" is a string value (Required) and Present in block:'+blockName;
                    }else{
                        retBlock['result'] = 'fail';
                        retBlock['resultMessage'] ='"'+ ruleKey + '" ::: '+funcRetVal+' in block:'+blockName+',Message:'+funcRetVal;
                    }
                }
                else{
                    retBlock['result'] = 'fail';
                    retBlock['resultMessage'] ='"'+ ruleKey + '" MUST BE OF TYPE_OPTIONAL,REQUIRED,NOT_ALLOWED or a "string" in block:'+blockName;
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
             * @param testingObj
             * @param blockName
             */
            var recurse = function(propertiesObj, testingObj, blockName){
                var i,j, results, testObjProperties;

                results = {"status": "pass"}; //set initial status
                results["blockName"] = blockName;
                if(!(testingObj || undefined)){
                    results["status"] = "fail"
                    results["message"] = "No testing object passed for propertiesObj " + JSON.stringify(propertiesObj);
                    results["errorType"] = "NullPointer";
                    return results;
                }
                //recurse through properties given by the definition object
                for(i in propertiesObj){
                    //go deeper if required
                    if(typeof propertiesObj[i] === 'object'){
                        results[i] = recurse(propertiesObj[i],testingObj[i],i);

                        //see if the recursion went ok, flip out if not.
                        if(results[i].status === "fail"){
                            results["status"] = "fail"
                            results["message"] = results[i].message;
                            results["errorBlockName"] = results[i]['errorBlockName'];
                            results["errorType"] = results[i]['errorType'];
                            if(results[i]['errorProperty']){
                                results['errorProperty'] = results[i]['errorProperty'];
                            }
                            return results;
                        }else{
                            results["status"] = "pass";
                        }
                    }else{
                        results[i] = validateRule(i,propertiesObj[i],testingObj.properties, blockName);
                        if(results[i].result === 'fail'){
                            results["status"] = "fail";
                            results["message"] = "Validation Rule Failure on Property: "+i;
                            results["errorBlockName"] = i;
                            results["errorType"] = 'RuleValidation';
                            return results; //short circuit the validation
                        }else{
                            results["status"] = "pass";
                        }
                    }
                }

                //recurse through the properties in the actual mug/*Element
                testObjProperties = testingObj.properties
                for(j in testObjProperties){
                    if(!testObjProperties.hasOwnProperty(j)){ continue; }
                    if(typeof propertiesObj[j] === 'undefined'){
                        results["status"] = "fail";
                        results["message"] = blockName+" block has property '"+j+"' but no rule is present for that property in the MugType!";
                        results["errorBlockName"] = blockName;
                        results["errorProperty"] = j
                        results["errorType"] = 'MissingRuleValidation';
                        results["propertiesBlock"] = propertiesObj;
                    }else if(propertiesObj[j] === TYPE_FLAG_NOT_ALLOWED){
                        results["status"] = "fail";
                        results["message"] = blockName+" block has property '"+j+"' but this property is NOT ALLOWED in the MugType definition!";
                        results["errorBlockName"] = blockName;
                        results["errorProperty"] = j
                        results["errorType"] = 'NotAllowedRuleValidation';
                        results["propertiesBlock"] = propertiesObj;
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
            checkTypeString = function(mugT){
                var typeString = mugT.type, i,
                hasD = (mugT.properties.dataElement ? true : false),
                hasC = (mugT.properties.controlElement ? true : false),
                hasB = (mugT.properties.bindElement ? true : false);

                if(hasD){
                    if(typeString.indexOf('d') === -1){
                        return {status: 'fail', message: "MugType.type has a 'dataElement' in its properties block but no 'd' char in its type value!"};
                    }
                }else{
                    if(typeString.indexOf('d') !== -1){
                        return {status: 'fail', message: "MugType.type has a 'd' char in it's type value but no 'd' !"};
                    }
                }
                if(hasB){
                    if(typeString.indexOf('b') === -1){
                        return {status: 'fail', message: "MugType.type has a 'bindElement' in its properties block but no 'b' char in its type value!"};
                    }
                }else{
                    if(typeString.indexOf('b') !== -1){
                        return {status: 'fail', message: "MugType.type has a 'b' char in it's type value but no 'b' !"};
                    }
                }
                if(hasC){
                    if(typeString.indexOf('c') === -1){
                        return {status: 'fail', message: "MugType.type has a 'controlElement' in its properties block but no 'c' char in its type value!"};
                    }
                }else{
                    if(typeString.indexOf('c') !== -1){
                        return {status: 'fail', message: "MugType.type has a 'c' char in it's type value but no 'c' !"};
                    }
                }



                return {status: 'pass', message: "typeString for MugType validates correctly"};
            },

            mug;
            mug = aMug || this.mug || null;



            if(!mug){
                throw 'MUST HAVE A MUG TO VALIDATE!';
            }
            var selfValidationResult = checkTypeString(this);
            var validationResult = recurse(this.properties,mug.properties,"Mug Top Level");

            if(selfValidationResult.status === 'fail'){
                console.group("MugType Validation Failed: Self Validation");
                    console.warn("1/2 A MUGTYPE OBJECT HAS FAILED SELF VALIDATION. VALIDATION OBJECT BELOW");
                    console.warn(selfValidationResult);
                    console.warn("2/2 FAILED MUGTYPE BELOW");
                    console.warn(this);
                console.groupEnd();
                validationResult.status = 'fail';
            }

            if(validationResult.status === 'fail'){
                console.group("MugType Validation Failed: Mug Validation");
                    console.warn("1/2 A MUG OBJECT HAS FAILED VALIDATION. VALIDATION OBJECT BELOW");
                    console.warn(validationResult);
                    console.warn("2/2 FAILED MUG BELOW");
                    console.warn(mug);
                console.groupEnd();
            }

            validationResult["typeCheck"] = selfValidationResult;

            return validationResult;



        },

        //OBJECT FIELDS//
        controlNodeCanHaveChildren: false,

        /** A list of controlElement.tagName's that are valid children for this control element **/
        controlNodeAllowedChildren : [],
        dataNodeCanHaveChildren: true,

        mug: null

    };
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
        dataBind: function(){
            var mType = formdesigner.util.clone(RootMugType);

            mType.typeName = "Data+Bind Only Mug";
            mType.type = "db";
            delete mType.properties.controlElement;
            return mType;
        }(),
        dataBindControlQuestion: function(){
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data Bind Control Question Mug";
            mType.type = "dbc";
            return mType;
        }(),
        dataControlQuestion: function(){
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data+Control Question Mug";
            mType.type = "dc";
            delete mType.properties.bindElement;
            return mType;
        }(),
        dataOnly: function(){
            var mType = formdesigner.util.clone(RootMugType);
            mType.typeName = "Data ONLY Mug";
            mType.type = "d";
            delete mType.properties.controlElement;
            delete mType.properties.bindElement;
            return mType;
        }()
    };

 


    that.mugTypes = mugTypes;
    mugTypes.stdTextQuestion = (function(){
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion);
        mType.typeName = "Text Question MugType";
        mType.controlNodeAllowedChildren = false;
        mType.properties.controlElement.name = "Text";
        mType.properties.controlElement.tagName = "input";
        return mType;
    }());

    mugTypes.stdGroup = (function(){
        var mType = formdesigner.util.getNewMugType(mugTypes.dataBindControlQuestion),
                allowedChildren;
        mType.controlNodeCanHaveChildren = true;
        allowedChildren = ['repeat','input','select','select1','group'];
        mType.controlNodeAllowedChildren = allowedChildren;
        mType.properties.controlElement.name = "Group";
        mType.properties.controlElement.tagName = "group";
        return mType;
    }());
    that.mugTypes = mugTypes;


    /**
     * A regular tree (with any amount of leafs per node)
     * @param treeType - is this a DataElement tree or a BindElement tree (use 'data' or 'bind' for this argument, respectively)
     * treeType defaults to 'data'
     */
    var Tree = function(treeType){
        var that = {}, rootNode, treeType = 'data';

        /**
         * Children is a list of objects.
         * @param children - optional
         * @param value - that value object that this node should contain (should be a MugType)
         */
        var Node = function(children, value){
            var that = {}, isRootNode = false, nodeValue,children;

            var init = function(nChildren, val){
                if(!val){
                    throw 'Cannot create a node without specifying a value object for the node!';
                }
                children = nChildren || [];
                nodeValue = val;
            }(children, value);

            var getChildren = that.getChildren = function(){
                return children;
            };

            var getValue = that.getValue = function(){
                return nodeValue;
            }

            /**
             * DOES NOT CHECK TO SEE IF NODE IS IN TREE ALREADY!
             * Adds child to END of children!
             */
            var addChild = that.addChild = function(node){
                if(!children){
                    children = [];
                }
                children.push(node);
            }

            /**
             * Insert child at the given index (0 means first)
             * if index > children.length, will insert at end.
             * -ve index will result in child being added to first of children list.
             */
            var insertChild = that.insertChild = function(node, index){
                if(node === null){ return null; }
                if(index < 0){ index = 0; }
                children.splice(index,0,node);
            }

            /**
             * Given a mugType, finds the node that the mugType belongs to.
             * if it is not the current node, will recursively look through children node (depth first search)
             */
            var getNodeFromMugType = that.getNodeFromMugType = function(MugType){
                if(MugType === null){ return null; }
                var retVal;
                if(this.getValue() === MugType){
                    return this;
                }else{
                    for(var i in children){
                        retVal = children[i].getNodeFromMugType(MugType);
                        if(retVal){ return retVal; }
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
            var getMugTypeFromUFID = that.getMugTypeFromUFID = function(ufid){
                if(ufid === null){ return null; }
                var retVal, thisUfid;
                if(getValue() !== ' '){
                    thisUfid = getValue().ufid || '';
                }else{
                    thisUfid = '';
                }

                if(thisUfid === ufid){
                    return this.getValue();
                }else{
                    for(var i in children){
                        retVal = children[i].getMugTypeFromUFID(ufid);
                        if(retVal){ return retVal; }
                    }
                }
                return null; //we haven't found what we're looking for
            };

            var removeChild = that.removeChild = function(node){
                if(!node){ throw 'Null child specified! Cannot remove \'null\' from child list'}
                var childIdx = children.indexOf(node);
                if(childIdx !== -1){ //if arg node is a member of the children list
                    children.splice(childIdx,1); //remove it
                }

                return node;
            }

            /**
             * Finds the parentNode of the specified node (recursively going through the tree/children of this node)
             * Returns the parent if found, else null.
             */
            var findParentNode = that.findParentNode = function(node){
                if(!node){ throw "No node specified, can't find 'null' in tree!"; }
                var i, parent = null;
                if(!children || children.length === 0){
                    return null;
                }
                if(children.indexOf(node) !== -1){
                    return this;
                }

                for(i in children){
                    parent = children[i].findParentNode(node);
                    if(parent !== null){
                        return parent;
                    }
                }
                return parent;
            };

            /**
             * An ID used during prettyPrinting of the Node. (a human readable value for the node)
             */
            var getID = that.getID = function(){
                if(isRootNode){
                    return 'RootNode';
                }
                if(!getValue || typeof getValue().validateMug !== 'function'){
                    return 'NodeWithNoValue!';
                }
                if(treeType === 'data'){
                    return getValue().mug.getDataElementID();
                }else if(treeType === 'bind'){
                    return getValue().mug.getBindElementID();
                }else{
                    throw 'Tree does not have a specified treeType! Default is "data" so must have been forcibly removed!';
                }
            }

            /**
             * Get all children MUG TYPES of this node (not recursive, only the top level).
             * Return a list of MugType objects, or empty list for no children.
             */
            var getChildrenMugTypes = function(){
                var i, retList = [];
                for(i in children){
                    retList.push(children[i].getValue());
                }
                return retList;
            };
            that.getChildrenMugTypes = getChildrenMugTypes;

            that.toString = function(){
                return getID();
            }

            var prettyPrint = that.prettyPrint = function(){
                var arr = [], i;
                for(i in children){
                    arr.push(children[i].prettyPrint())
                }
                if(!children || children.length === 0){
                    return getID();
                }else{
                    return ''+getID()+'['+arr+']';
                }
            }

            return that;
        };

        var init = function(type){
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
        var addNode = function(node, parentNode){
            if(parentNode){
                parentNode.addChild(node)
            }else{
                rootNode.addChild(node);
            }
        };

        /**
         * Given a mugType, finds the node that the mugType belongs to (in this tree).
         * Will return null if nothing is found.
         */
        var getNodeFromMugType = that.getNodeFromMugType = function(MugType){
            return rootNode.getNodeFromMugType(MugType);
        };

        /**
         * Removes a node (and all it's children) from the tree (regardless of where it is located in the
         * tree) and returns it.
         *
         * If no such node is found in the tree (or node is null/undefined)
         * null is returned.
         */
        var removeNodeFromTree = function(node){
            if(!node){ return null; }
            if(!getNodeFromMugType(node.getValue())){ return null; } //node not in tree
            var parent = getParentNode(node);
            if(parent){
                parent.removeChild(node);
                return node;
            }else{
                return null;
            }
        }

        var getParentNode = function(node){
            if(rootNode === node){ //special case:
                return rootNode;
            }else{ //regular case
                return rootNode.findParentNode(node);
            }
        }

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
        var insertMugType = function(mugType, position, refMugType){
            var refNode,refNodeSiblings, refNodeIndex, refNodeParent, node;

            if(!checkMoveOp(mugType,position,refMugType)){
                throw 'Illegal Tree move requested! Doing nothing instead.';
            }

            if(position !== null && typeof position !== 'string'){
                throw "position argument must be a string or null! Can be 'after','before' or 'into'";
            }
            if(!position){ position = 'after'; }

            if(!refMugType){
                var rootChildren = getRootChildren();
                if(rootChildren.length > 0){
                    refMugType = rootChildren[rootChildren.length-1];
                    refNode = getNodeFromMugType(refMugType);
                }else{
                    refNode = rootNode;
                    position = 'into';
                }
            }else{
                refNode = getNodeFromMugType(refMugType);
            }

            node = removeNodeFromTree(getNodeFromMugType(mugType)); //remove it from tree if it already exists
            if(!node){
                node = new Node(null, mugType);
            }

            if(position !== 'into'){
                refNodeParent = getParentNode(refNode);
                refNodeSiblings = refNodeParent.getChildren();
                refNodeIndex = refNodeSiblings.indexOf(refNode);
            }

            switch(position){
                case 'before':
                    refNodeParent.insertChild(node,
                               ( (refNodeIndex > 0) ? refNodeIndex-1 : refNodeIndex));
                    break;
                case 'after':
                    refNodeParent.insertChild(node,refNodeIndex+1);
                    break;
                case 'into':
                    refNode.addChild(node);
                    break;
                case 'first':
                    refNode.insertChild(node,0);
                    break;
                default:
                    throw "in insertMugType() position argument MUST be null, 'before','after','into'.  Argument was: "+position;
            }
        };
        that.insertMugType = insertMugType;

        /**
         * Checks that the specified move is legal. returns false if problem is found.
         * @param mugType
         * @param position
         * @param refMugType
         */
        var checkMoveOp = function(mugType, position, refMugType){
            //TODO IMPLEMENT ME!
            return true;
        }

        /**
         * Returns a list of nodes that are in the top level of this tree (i.e. not the abstract rootNode but it's children)
         */
        var getAllNodes = function(){
            return rootNode.getChildren();
        };

        /**
         * returns the absolute path, in the form of a string separated by slashes ('/nodeID/otherNodeID/finalNodeID'),
         * the nodeID's are those given by the Mugs (i.e. the node value objects) according to whether this tree is a
         * 'data' (DataElement) tree or a 'bind' (BindElement) tree.  Sorry about the confusing jargon.  It's a little late
         * in the game to be changing things up, unfortunately.
         *
         * @param nodeOrMugType - can be a tree Node or a MugType that is a member of this tree (via a Node)
         */
        var getAbsolutePath = that.getAbsolutePath = function(mugType){
            var node, output, nodeParent;
            if(typeof mugType.validateMug === 'function'){ //a loose way of checking that it's a MugType...
                node = getNodeFromMugType(mugType);
            }else{
                throw 'getAbsolutePath argument must be a MugType!';
            }
            if(!node){
                throw 'Cant find path of MugType that is not present in the Tree!';
            }
            nodeParent = getParentNode(node);
            output = '/' + node.getID();

            while(nodeParent && !nodeParent.isRootNode ){
                output = '/' + nodeParent.getID() + output;
                nodeParent = getParentNode(nodeParent);
            }

            return output;

        };

        var printTree = that.printTree = function(toConsole){
            var t = rootNode.prettyPrint();
            if(toConsole){
                console.debug(t);
            }
            return t;
        };

        /**
         * Removes the specified MugType from the tree. If it isn't in the tree
         * does nothing.  Does nothing if null is specified
         *
         * If the MugType is successfully removed, returns that MugType.
         */
        var removeMugType = function(MugType){
            var node = getNodeFromMugType(MugType);
            if(!MugType || !node){ return; }
            removeNodeFromTree(node);
            return node;
        };
        that.removeMugType = removeMugType;

        /**
         * Given a UFID searches through the tree for the corresponding MugType and returns it.
         * @param ufid of a mug
         */
        var getMugTypeFromUFID = function(ufid){
            return rootNode.getMugTypeFromUFID(ufid);
        };
        that.getMugTypeFromUFID = getMugTypeFromUFID;

        /**
         * Returns all the children MugTypes (as a list) of the
         * root node in the tree.
         */
        var getRootChildren = function(){
            return rootNode.getChildrenMugTypes();
        };
        that.getRootChildren = getRootChildren;

        /**
         * Method for testing use only.  You should never need this information beyond unit tests!
         *
         * Gets the ID used to identify a node (used during Tree prettyPrinting)
         */
        var _getMugTypeNodeID = that._getMugTypeNodeID = function(MugType){
            if(!MugType){ return null; }
            return getNodeFromMugType(MugType).getID();
        }

        /**
         * Method for testing use only.  You should never need this information beyond unit tests!
         *
         * Gets the ID string used to identify the rootNode in the tree. (used during Tree prettyPrinting)
         */
        var _getRootNodeID = that._getRootNodeID = function(){
            return rootNode.getID();
        }

        return that;
    };
    that.Tree = Tree;

    /**
     * An initialization function that sets up a number of different fields and properties
     */
    var init = function(){
        var form = that.form = new Form();
        //set the form object in the controller so it has access to it as well
        formdesigner.controller.setForm(form);
    };
    that.init = init;


    return that;
}());


    