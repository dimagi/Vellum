/*jslint browser: true, maxerr: 50, indent: 4 */
/**
 * Model classes and functions for the FormDesigner
 */
if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}


formdesigner.model = (function(){
    var that = {};

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
        var definition;

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
            if(spec.bindElement){
                bindElement = spec.bindElement;
            }
            if(spec.dataElement){
                dataElement = spec.dataElement;
            }
            if(spec.controlElement){
                controlElement = spec.controlElement;
            }
            if(spec.definition){
                definition = spec.definition;
            }

            that.bindElement = bindElement;
            that.dataElement = dataElement;
            that.controlElement = controlElement;
            that.definition = definition;
        }(mySpec));


        /**
         * Have this mug take in a spec
         * and init it's fields according to it.
         *
         * @param spec
         */
        var initWithSpec = function(spec){
            if(spec.bindElement){
                bindElement = spec.bindElement;
            }
            if(spec.dataElement){
                dataElement = spec.dataElement;
            }
            if(spec.controlElement){
                controlElement = spec.controlElement;
            }
            if(spec.definition){
                definition = spec.definition;
            }

            that.bindElement = bindElement;
            that.dataElement = dataElement;
            that.controlElement = controlElement;
            that.definition = definition;
        };
        that.initWithSpec = initWithSpec;

        /**
         * Checks this mug against its definition object
         * to verify that it is in a correct state.
         * Returns a VERIFY_CODE (see util.VERIFY_CODE)
         */
        var verify_mug = function(){
            return formdesigner.util.verify_mug(that,definition);
        };
        that.verify_mug = verify_mug;

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
     * attributes = {
     *  dataRefName,  //typically the end of 'nodeset' attribute ('questionID')
     *  dataType, //typically the xsd:dataType
     *  relevant,
     *  calculate,
     *  constraint,
     *  constraintMsg, //jr:constraintMsg
     *  id //optional
     *  }
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
                if(typeof the_spec.attributes !== 'undefined'){
                    var i = {};
                    attributes = the_spec.attributes;
                    that.attributes = attributes;
                    //also attach the attributes to the root 'that' object:
                    for(i in attributes){
                        if(attributes.hasOwnProperty(i)){
                            that[i] = attributes[i];
                        }
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

        var name, defaultData;

        (function constructor (mySpec){
            if(typeof mySpec !== 'undefined'){
                name = mySpec.name;
                defaultData = mySpec.defaultData;
            }

            that.name = name;
            that.defaultData = defaultData;
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
     *            //see the control_definitions (tag_name) object
     *  controlName
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
    //    DEFINITION CODE /////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////

    /**
     * The core Control Element definitions
     * Add a definition here if you want to make
     * a new question type available for use
     * (e.g. GPS, video capture, whatever)
     */
    var control_definitions = {
        sselect : {
            name: "Single Select",
            tagName: "1select",
            canHasChildren: true,
            childrenType: ["item","itemset"],
            label: true,
            itext: true,
            hintItext: true,
            defaultValue: false,
            xsdType: "xsd:1select"
        },
        mselect : {
            name: "Multi Select",
            tagName: "select",
            canHasChildren: true,
            childrenType: ["item","itemset"],
            label: true,
            itext: true,
            hintItext: true,
            defaultValue: false,
            xsdType: "xsd:select"
        },
        text : {
            name: "Text",
            tagName: "input",
            canHasChildren: false,
            label: true,
            itext: true,
            hintItext: true,
            defaultValue: true,
            xsdType: "xsd:text"
        },
        numberInt : {
            name: "Integer Number",
            tagName: "input",
            canHasChildren: false,
            label: true,
            itext: true,
            hintItext: true,
            defaultValue: true,
            xsdType: "xsd:int"
        },
        numberDouble : {
            name: "Double Number",
            tagName: "input",
            canHasChildren: false,
            label: true,
            itext: true,
            hintItext: true,
            defaultValue: true,
            xsdType: "xsd:double"
        },
        numberFloat : {
            name: "Float Number",
            tagName: "input",
            canHasChildren: false,
            label: true,
            itext: true,
            hintItext: true,
            defaultValue: true,
            xsdType: "xsd:float"
        },
        group: {
            name: "Group",
            tagName: "group",
            canHasChildren: true,
            childrenType: ["all"],
            notChildrenType: ["item","itemset"], //special case for when using "all" in childrenType
            label: true,
            itext: true,
            hintItext: false,
            defaultValue: false
        },
        repeat: {
            name: "Repeat Group",
            tagName: "repeat",
            canHasChildren: true,
            childrenType: ["all"],
            notChildrenType: ["item","itemset"], //special case for when using "all" in childrenType
            label: true,
            itext: true,
            hintItext: false,
            defaultValue: false
        },
        item: {
            name: "Option Item",
            tagName: "item",
            canHasChildren:false,
            label: true,
            defaultValue: true,
            valueRequired: true,
            itext: true,
            hintItext: false
        }
    };
    that.control_definitions = control_definitions;

     /**
     * Definition Object example (useful for unit testing purposes)
     * and as a reference.
     */
    var definition_example = {
        defName: "A Standard Text Question Definition",
        mug: 'my_first_mug', //should actually be an object ref!
        dataNode: {
            dataNodeRequired: true,
            dataElement: 'some_data_object_ref', //should actually be a ref!
            parentDef: rootDataDef, //either some parent def, or root
            hasInitialData: true,
            childrenDef: null //Should be a list [] of children definition objects if hasChildren
        },
        bindNode: {
            bindNodeRequired: false,
            hasID: true
//            bindElement: some_bind, //some_bind_element
        },
        controlNode: {
            parentDef: rootControlDef,
            childrenDef: null,
            controlNodeRequired: true,
            controlElement: 'some_control_element', //should be an object ref!
            controlType: control_definitions.text
        }
    };
    that.definition_example = definition_example;


    /**
     * Root Definition object for Data Nodes
     * (sits at the top of the DataDefTree in the FormObject
     */
    var rootDataDef = {
        defName: "Root Data Node Definition",
        isRoot: true,
        parentDef: null,
        childrenDef: null,
        formObject: null
    };
    that.rootDataDef = rootDataDef;

    /**
     * Root Definition object for Control Nodes
     * (sits at the top of the DataDefTree in the FormObject
     */
    var rootControlDef = {
        defName: "Root Control Node Defintion",
        isRoot: true,
        parentDef: null,
        childrenDef: null,
        formObject: null

    };
    that.rootControlDef = rootControlDef;



    /**
     * Adds a child Definition object to the reference Definition
     * object (and performs the required linking.
     * @param childDef
     * @param refDef
     * @param typeOfParent - can be one of "dataNode","bindNode","controlNode"
     */
    var addDefinitionAsChild = function(childDef, refDef, typeOfParent){
        if(typeof refDef === 'undefined' || typeof childDef === 'undefined'){
            console.log("Attempted to add Child Definition, but reference or child def was null. Child:"+childDef+", Reference:"+refDef);
            return;
        }
        if(!refDef.children){
            refDef.children = [];
        }

        refDef.children.push(childDef);
        childDef[typeOfParent].parentDef = refDef;
    };
    that.addDefinitionAsChild = addDefinitionAsChild;

    /**
     * Create a new Definition object according
     * to the params given by spec.
     *
     * If spec is not given, will create a blank Definition
     * object (defaults will be set)
     *
     * An example spec can be found at
     * this.definition_example;
     *
     * @param spec
     */
    var Definition = function(spec){
        var that = {};
        var i = null;

        (function constructor(mySpec, parent){
            if(typeof mySpec !== 'undefined'){
                for(i in mySpec){
                    that[i] = mySpec[i];
                }
            }else{
                that.defName = "Blank Definition Object";
            }
        }(spec));

        //make the object event aware:
        formdesigner.util.eventuality(that);

        return that;
    };
    that.Definition = Definition;

    /**
     * Creates a complete Mug object (with default values where appropriate),
     * including Control,Bind and Data elements as specified in the Definition
     * and returns it
     */
    var createMugFromDefinition = function(def){
        var mug,control,bind,data;
        var i = null;
        var curProp,curVal;


        //Below three functions read the given
        //spec object and init a respective object as appropriate
        function deal_with_control_spec(spec){
            var s = {}; //spec to be passed to the control element constructor
            var i = null;

            //check if a controlType def is here if controlNodeRequired == true
            if(spec.controlNodeRequired){
                if(typeof spec.controlType === 'undefined' ||
                        !spec.controlType){
                    throw 'A controlElement is Required but no controlType spec is given in the definition!';
                }

                s.typeName = spec.controlType.name;
                s.controlName = spec.controlType.tagName;
                if(spec.controlType.label){ s.label = null };
                if(spec.controlType.)
            }


            for(i in spec){
                if(!spec.hasOwnProperty(i)){continue;}

            }
        }

        function deal_with_data_spec(spec){

        }

        function deal_with_bind_spec(spec){

        }


        //begin actual function code

        //walk through def:
        for(i in def){
            if(!def.hasOwnProperty(i)){ continue; }

            curProp = i;
            curVal = def[i];

            if(!curVal){ continue; }

            if(curProp === 'dataNode'){ data = deal_with_data_spec(curVal);}
            else if(curProp === 'bindNode'){ bind = deal_with_bind_spec(curVal);}
            else if(curProp === 'controlNode'){ bind = deal_with_control_spec(curVal);}
        }
        var mugSpec = {}
        if(data){ mugSpec.dataElement = data;}
        if(control){ mugSpec.controlElement = control;}
        if(bind){ mugSpec.bindElement = bind;}
        mugSpec.definition = def;

        mug = new Mug(mugSpec);

        return mug;
    };
    that.createMugFromDefition = createMugFromDefinition;

    return that;
}());


