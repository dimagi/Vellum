/**
 * Notes: we assume that the controller will be handed an XFORM in JSON format
 * (converted by the CouchForms code, so that's pretty sweet).  Injecting the JSON
 * data into the correct places in the model will be up to the controller code.
 */

if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.controller = (function(){
    var that = {}, form;
    var question_counter = 1; //used in generate_question_id();

    /**
     * Generates a unique question ID (unique in this form) and
     * returns it as a string.
     */
    var generate_question_id = function(){
        var ret = 'question'+question_counter;
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
                }else if(typeof block[i] === 'function'){
                    spec[i] = " ";
                }else{
                    switch(block[i]){
                        case formdesigner.model.TYPE_FLAG_OPTIONAL:
                            spec[i] = " ";
                            break;
                        case formdesigner.model.TYPE_FLAG_REQUIRED:
                            spec[i] = " ";
                            break;
                        case formdesigner.model.TYPE_FLAG_NOT_ALLOWED:
                            break;
                        default:
                            spec[i] = block[i]; //text value;
                    }
                }
            }
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
                mug.properties.controlElement = new formdesigner.model.ControlElement(controlElSpec);
            }
            if(dataElSpec){
                if(dataElSpec.nodeID){
                    dataElSpec.nodeID = generate_question_id();
                }
                mug.properties.dataElement = new formdesigner.model.DataElement(dataElSpec);
            }
            if(bindElSpec){
                if(bindElSpec.nodeID){
                    if(dataElSpec.nodeID){
                        bindElSpec.nodeID = dataElSpec.nodeID; //make bind id match data id for convenience
                    }else{
                        bindElSpec.nodeID = generate_question_id();
                    }
                }
                mug.properties.bindElement = new formdesigner.model.BindElement(bindElSpec);
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

    var showErrorMessage = function(msg){
        formdesigner.ui.appendErrorMessage(msg);
    };
    that.showErrorMessage = showErrorMessage;
    /**
     * Convenience method for generating mug and mugType, calling UI and throwing
     * it the 'question' object
     *
     * @param qType = type of question to be created. ||| Currently does nothing |||
     */
    var createQuestion = function(qType){
        var mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataBindControlQuestion),
        mug = createMugFromMugType(mugType);
        mug.on('property-changed', function(){
            formdesigner.controller.showErrorMessage("Property Changed in Question:"+mug.properties.dataElement.properties.nodeID+"!");
        })

        form.insertMugType(mugType);
        return mug;

    };
    that.createQuestion = createQuestion;


    /**
     * Gets the label used to represent this mug in the UI tree
     * @param mugOrMugType - mug or mugType
     */
    var getTreeLabel = function(mugOrMugType){
        var mug;
        if(mugOrMugType instanceof formdesigner.model.Mug){
            mug = mugOrMugType;
        }else if(typeof mugOrMugType.validate === 'function'){
            mug = mugOrMugType.mug;
        }else{
            throw 'getTreeLabel() must be given either a Mug or MugType as argument!';
        }


        return mug.properties.controlElement.properties.nodeID; //TODO IMPROVE ME!
    };
    that.getTreeLabel = getTreeLabel;

    /**
     * Looks through both the dataTree and the controlTree
     * in the form object and returns the Mug that corresponds
     * to the given UFID string
     * @param ufid
     */
    var getMugFromUFID = function(ufid){

    };
    that.getMugFromUFID = getMugFromUFID;

    /**
     * Returns the Tree object specified by treeType from the Form object
     * @param treeType - string - either 'data' or 'control'
     */
    var getTree = function getTree(treeType){
        if(treeType === 'data'){
            return form.dataTree;
        }else if(treeType === 'control'){
            return form.controlTree;
        }else{
            throw "controller.getTree must be given a treeType of either 'data' or 'control'!";
        }
    }



    return that;
})();