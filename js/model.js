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
     *  constraintMsg //jr:constraintMsg
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

    //A holder for the various typeName strings that can be used to
    //specify the controlElement below
    var TYPE_NAMES = {
        input: "input",
        sselect: "1select",
        mselect: "select",
        group: "group",
        repeat: "repeat",
        trigger: "trigger"
    };
    that.TYPE_NAMES = TYPE_NAMES;
    
    /**
     * The controlElement represents the object seen by the user during
     * an entry session.  This object usually takes the form of a question
     * prompt, but can also be a notification message, or some other type
     * of user viewable content.
     * spec:
     * {
     *  typeName, //the type string indicating what type of Control Element this is
     *            //see the TYPE_NAMES object
     * }
     */
    var ControlElement = function(spec){
        var that = {};

        var typeName;
        //give this object a unqiue fd id
        formdesigner.util.give_ufid(that);

        (function constructor(mySpec){
            if(typeof mySpec !== 'undefined'){
                typeName = mySpec.typeName;
            }
        }(spec));
        that.typeName = typeName;

        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.ControlElement = ControlElement;

    return that;
}());


