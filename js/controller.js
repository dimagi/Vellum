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
    var question_counter = 1, //used in generate_question_id();
    curSelMugType = null, curSelUfid = null;

    that["form"] = form;

    var initFormDesigner = function(){
        formdesigner.model.init();
    };
    that.initFormDesigner = initFormDesigner;
    /**
     *
     * @param ufid
     */
    var setCurrentlySelectedMug = function(ufid){
        curSelUfid = ufid;
        curSelMugType = this.form.dataTree.getMugTypeFromUFID(ufid);
        if(!curSelMugType){ //check controlTree in case it's there.
            curSelMugType = this.form.controlTree.getMugTypeFromUFID(ufid);
        }
    }
    that.setCurrentlySelectedMug = setCurrentlySelectedMug;

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

        insertMugTypeIntoForm(mugType);
        createQuestionInUITree(mug);
        return mug;

    };
    that.createQuestion = createQuestion;

    function createQuestionInUITree(mug){
        function getRelativeInsertPosition(newMug){
            var canHaveChildren, newMugType;
            if(!curSelMugType){
                return "first";
            }

            newMugType = form.controlTree.getMugTypeFromUFID(newMug.ufid);
            canHaveChildren = formdesigner.util.canMugTypeHaveChildren;

            if(canHaveChildren(curSelMugType,newMugType)){
                return "inside";
            }else{
                return "after";
            }
        };


        var controlTagName = mug.properties.controlElement.properties.tagName,
            isGroupOrRepeat = (controlTagName === 'group' || controlTagName === 'repeat'),
            objectData = {};

        if(isGroupOrRepeat){
            objectData["state"] = 'open'; //should new node be open or closed?, omit for leaf
        }

        objectData["data"] = mug.properties.dataElement.properties.nodeID;
        objectData["metadata"] = {'ufid': mug.ufid,
                                    'dataID':mug.properties.dataElement.properties.nodeID || null,
                                    'bindID':mug.properties.bindElement.properties.nodeID || null};
        objectData["attr"] = {
            "id" : mug.ufid
        }

        $('#fd-question-tree').jstree("create",
            null, //reference node, use null if using UI plugin for currently selected
            getRelativeInsertPosition(mug), //position relative to reference node
            objectData,
            null, //callback after creation, better to wait for event
            true  //skip_rename
        );
    };


    /**
     * Inserts a new MugType into the relevant Trees (and their
     * relevant positions) according to the specified mugType and
     * the currently selected mugType.
     * @param mugType
     */
    var insertMugTypeIntoForm = function(mugType){
//        var dataTree = form.dataTree, controlTree = form.controlTree;
        //TODO: You know, implement me.


        
    }
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

    var getCurrentlySelectedMug = function(){
        return curSelMugType.mug;
    };
    that.getCurrentlySelectedMug = getCurrentlySelectedMug;

    var getCurrentlySelectedMugType = function(){
        return curSelMugType;
    };
    that.getCurrentlySelectedMugType = getCurrentlySelectedMugType;



    return that;
})();