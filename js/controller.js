/**
 * Notes: we assume that the controller will be handed an XFORM in JSON format
 * (converted by the CouchForms code, so that's pretty sweet).  Injecting the JSON
 * data into the correct places in the model will be up to the controller code.
 */

if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.controller = (function(){
    var that = {};
    var question_counter = 0; //used in generate_question_id();

    /**
     * Generates a unique question ID (unique in this form) and
     * returns it as a string.
     */
    var generate_question_id = function(){
        var ret = 'question'+(Math.ceil(Math.random()*question_counter));
        question_counter += 1;
        return ret;
    };
    that.generate_question_id = generate_question_id;


    /**
     * Creates a new mug (with default init values)
     * based on the template (MugType) given by the argument.
     *
     * @return the new mug associated with this mugType
     */
    var createMugFromMugType = function(mugType){
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
        function recursiveGetSpec(block, name){
            var spec = {}, i, retSpec = {};
            for(i in block){
                if(typeof block[i] === 'object'){
                    spec[i] = recursiveGetSpec(block[i], i);
                }else{
                    switch(block[i]){
                        case formdesigner.model.TYPE_FLAG_OPTIONAL:
                            spec[i] = null;
                            break;
                        case formdesigner.model.TYPE_FLAG_REQUIRED:
                            spec[i] = " ";
                            break;
                        case formdesigner.model.TYPE_FLAG_REQUIRED:
                            break;
                        default:
                            spec[i] = block[i]; //text value;
                    }
                }
            }
//            retSpec[name] = spec;
            return spec;
        }
        //loop through mugType.properties and construct a spec to be passed to the Mug Constructor.
        //BE CAREFUL HERE.  This is where the automagic architecture detection ends, some things are hardcoded.
        var mugSpec, dataElSpec, bindElSpec, controlElSpec, i,
                mug,dataElement,bindElement,controlElement,
                specBlob = {}, validationResult;

        specBlob = recursiveGetSpec(mugType.properties,'mugSpec');
        mugSpec = specBlob || undefined;
        dataElSpec = specBlob.dataElement || undefined;
        bindElSpec = specBlob.bindElement || undefined;
        controlElSpec = specBlob.controlElement || undefined;

        //create the various elements, mug itself, and linkup.
        if(mugSpec){
            mug = new formdesigner.model.Mug(mugSpec);
            if(controlElSpec){
                mug.controlElement = new formdesigner.model.ControlElement(controlElSpec);
            }
            if(dataElSpec){
                mug.dataElement = new formdesigner.model.DataElement(dataElSpec);
            }
            if(bindElSpec){
                mug.bindElement = new formdesigner.model.BindElement(bindElSpec);
            }
        }

        //Bind the mug to it's mugType
        mugType.mug = mug || undefined;

        //ok,now: validate the mug to make sure everything is peachy.
        validationResult = mugType.validateMug(mug);
        if(validationResult.status !== 'pass'){
            //uh oh.
            console.log("FAILED MUG VALIDATION OBJECT BELOW:");
            console.log(validationResult);
            console.log("MUG OBJECT BELOW:")
            console.log(mug);
            throw 'Newly constructed mug did not pass validation!';
        }else{
            return mug;
        }
    };
    that.createMugFromMugType = createMugFromMugType;

    return that;
})();