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
     *  }
     */
    var Mug = function(spec){
        var that = {};
        var mySpec;

        var dataElement,bindElement,controlElement;

        if(typeof spec === 'undefined'){
            mySpec = {};
        }else{
            mySpec = spec;
        }

        (function construct(spec){
            if(spec.bindElement){ bindElement = spec.bindElement; }
            if(spec.dataElement){ dataElement = spec.dataElement; }
            if(spec.controlElement){ controlElement = spec.controlElement; }
        }(mySpec));


        that.bindElement = bindElement;
        that.dataElement = dataElement;
        that.controlElement = controlElement;
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

    var BindElement = function(){
        var that = {};
        var attributes = {
            nodeset: "",
            dataType:"",
            relevant: "",
            calculate:"",
            constraint:"",
            constraintMsg:""
        };
        that.attributes = attributes;
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
     * it is tracking, on command.
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
     */
    var DataElement = function(){
        var that = {};
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
     */
    var ControlElement = function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.ControlElement = ControlElement;

    return that;
}());


