/**
 * Model classes and functions for the FormDesigner
 */
if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.model = (function(){
    var that = {};
    var mug = (function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
        var moo = 'mooooooo';
        var get_moo = function(){
            return this.moo;
        };
        that.moo = moo;
        that.get_moo = get_moo;
        return that;
    }());
    that.mug = mug;

    var form = (function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
    }());
    that.form = form;

    var xhtml = (function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
    }());
    that.xhtml = xhtml;

    var localization = (function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
    }());
    that.localization = localization;

    var bindElement = (function(){
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
    }());
    that.bindElement = bindElement;

    var liveText = (function(){
        var that = {};

        var phrases = [];

        /**
         * Get the string this liveText represents
         * with all the function/object references replaced with
         * their textual representations (use add()
         * to add strings/objects when building a liveText)
         */
        var renderString = function(){
            var outString = "";
            var tObj;
            var i;
            for(i=0;i<phrases.length;i++){
                tObj = phrases[i];
                if(typeof tObj.refObj === 'undefined'){
                    throw "incorrect Live Object added to LiveText! Can't render string.";
                }else if(typeof tObj.refObj === 'string'){
                    outString += tObj.refObj;
                }else{
                    if(typeof tObj.params === 'undefined'){
                      outString += tObj.callback();
                    }else{
                        outString += tObj.callback(tObj.params);
                    }
                }
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
         * @param token
         * @param callback
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

        //make this object event aware.
        formdesigner.util.eventuality(that);
        return that;
    }());
    that.liveText = liveText;

    /**
     * DataElement is the object representing the final resting (storage)
     * place of data entered by the user and/or manipulated by the form.
     */
    var dataElement = (function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    }());
    that.dataElement = dataElement;

    /**
     * The controlElement represents the object seen by the user during
     * an entry session.  This object usually takes the form of a question
     * prompt, but can also be a notification message, or some other type
     * of user viewable content.
     */
    var controlElement = (function(){
        var that = {};
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    }());
    that.controlElement = controlElement;

    return that;
}());
/* Object template

var myObj = (function(){
    var that = {};

    //private members
    var myPrivateThing = 'foo';

    //public members
    var myPublicThing = 'bar';

    //add public members here
    that.myPublicThing = myPublicThing;

    //private methods
    var prvMethod = function(){
        //...
    };

    //public methods
    var pubMethod = function(){
        //...
    };

    //add public methods here
    that.pubMethod = pubMethod;


    //Make the object event aware
    formdesigner.util.eventuality(that);

    //return the object
    return that;
}());
 */

