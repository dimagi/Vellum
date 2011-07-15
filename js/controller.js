/**
 * Notes: we assume that the controller will be handed an XFORM in JSON format
 * (converted by the CouchForms code, so that's pretty sweet).  Injecting the JSON
 * data into the correct places in the model will be up to the controller code.
 */

if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.controller = (function () {
    "use strict";
    var that = {}, form, question_counter = 1, //used in generate_question_id();
        curSelMugType = null,
        curSelUfid = null,

        initFormDesigner = function () {
            formdesigner.model.init();
        };
    that.initFormDesigner = initFormDesigner;
    that.form = form;
    var setForm = that.setForm = function (aForm) {
        form = that.form = aForm;
    };

    var getMTFromFormByUFID = function (ufid) {
        curSelMugType = form.dataTree.getMugTypeFromUFID(ufid);
        if (!curSelMugType) { //check controlTree in case it's there.
            curSelMugType = form.controlTree.getMugTypeFromUFID(ufid);
        }
        return curSelMugType;
    };
    that.getMTFromFormByUFID = getMTFromFormByUFID;

    /**
     * Sets the currently selected (in the UI tree) MugType
     * so that the controller is aware of the currently
     * being worked on MT without having to do the call
     * to the UI each time.
     *
     * @param ufid - UFID of the selected MugType
     */
    var setCurrentlySelectedMugType = function (ufid) {
        curSelUfid = ufid;
        curSelMugType = getMTFromFormByUFID(ufid);
    };
    that.setCurrentlySelectedMugType = setCurrentlySelectedMugType;



    /**
     * Generates a unique question ID (unique in this form) and
     * returns it as a string.
     */
    var generate_question_id = function () {
        var ret = 'question' + question_counter;
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
    var createMugFromMugType = function (mugType) {
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
        function recursiveGetSpec(block, name) {
            var spec = {}, i, retSpec = {};
            for(i in block) {
                if (typeof block[i] === 'object') {
                    spec[i] = recursiveGetSpec(block[i], i);
                }else if (typeof block[i] === 'function') {
                    spec[i] = " ";
                }else{
                    switch(block[i]) {
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
        if (mugSpec) {
            mug = new formdesigner.model.Mug(mugSpec);
            if (controlElSpec) {
                mug.properties.controlElement = new formdesigner.model.ControlElement(controlElSpec);
            }
            if (dataElSpec) {
                if (dataElSpec.nodeID) {
                    dataElSpec.nodeID = generate_question_id();
                }
                mug.properties.dataElement = new formdesigner.model.DataElement(dataElSpec);
            }
            if (bindElSpec) {
                if (bindElSpec.nodeID) {
                    if (dataElSpec.nodeID) {
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
        if (validationResult.status !== 'pass') {
            throw 'Newly constructed mug did not pass validation!';
        }else{
            return mug;
        }
    };
    that.createMugFromMugType = createMugFromMugType;

    /**
     * Inserts a new MugType into the relevant Trees (and their
     * relevant positions) according to the specified mugType and
     * the currently selected mugType.
     * @param newMugType - new MT to be inserted into the Form object
     * @param refMugType - used to determine the relative position of the insertion (relative to the refMT)
     */
    var insertMugTypeIntoForm = function (refMugType, newMugType) {
        var dataTree = form.dataTree, controlTree = form.controlTree;

        dataTree.insertMugType(newMugType, formdesigner.util.getRelativeInsertPosition(refMugType, newMugType), refMugType);
        controlTree.insertMugType(newMugType, formdesigner.util.getRelativeInsertPosition(refMugType, newMugType), refMugType);
    };
    that.insertMugTypeIntoForm = insertMugTypeIntoForm;

    var showErrorMessage = function (msg) {
        formdesigner.ui.appendErrorMessage(msg);
    };
    that.showErrorMessage = showErrorMessage;

    function createQuestionInUITree(mugType) {
        function treeSetItemType(mugType) {
            var tString = mugType.mug.properties.controlElement.properties.name.toLowerCase(),
                setType = function (tType) {
                    var controlTree = $('#fd-question-tree'),
                        dataTree = $('#fd-data-tree'),
                        mugTUfid = mugType.ufid,
                        node = $('#'+mugTUfid);
                    controlTree.jstree("set_type",tType,node);
                    dataTree.jstree("set_type",tType,node);
                };

            switch(tString.toLowerCase()) {
                case 'text':
                    setType("question");
                    break;
                case 'group':
                    setType("group");
                    break;
                case 'multi select':
                    setType("selectQuestion");
                    break;
                case 'trigger':
                    setType("trigger");
                    break;
                case 'item':
                    setType("item");
                    break;
            }
        }

        var mug = mugType.mug,
            controlTagName = mug.properties.controlElement.properties.tagName,
            isGroupOrRepeat = (controlTagName === 'group' || controlTagName === 'repeat'),
            itemID,
            objectData = {},
            insertPosition;

        if (isGroupOrRepeat) {
            objectData.state = 'open'; //should new node be open or closed?, omit for leaf
        }

        objectData.data = !(mug.properties.dataElement) ? mug.properties.controlElement.properties.nodeID : mug.properties.dataElement.properties.nodeID;
        objectData.metadata = {
                                'mugTypeUfid': mugType.ufid,
                                'mugUfid': mug.ufid,
                                'dataID':mug.getDataElementID(),
                                'bindID':mug.getBindElementID()
                                };
        objectData.attr = {
            "id" : mugType.ufid
        };

        insertPosition = formdesigner.util.getRelativeInsertPosition(curSelMugType,mugType);

        $('#fd-question-tree').jstree("create",
            null, //reference node, use null if using UI plugin for currently selected
            insertPosition, //position relative to reference node
            objectData,
            null, //callback after creation, better to wait for event
            true  //skip_rename
        );

        $('#fd-data-tree').jstree("create",
            null, //reference node, use null if using UI plugin for currently selected
            insertPosition, //position relative to reference node
            objectData,
            null, //callback after creation, better to wait for event
            true  //skip_rename
        );
        treeSetItemType(mugType);
    }

    /**
     * Convenience method for generating mug and mugType, calling UI and throwing
     * it the 'question' object
     *
     * @param qType = type of question to be created. ||| Currently does nothing |||
     */
    var createQuestion = function (qType) {
        var mugType, mug, createQuestionEvent = {};

        switch(qType.toLowerCase()) {
            case 'text':
                mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.stdTextQuestion);
                break;
            case 'group':
                mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.stdGroup);
                break;
            case 'select':
                mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.stdMSelect);
                break;
             case 'item':
                mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.stdItem);
                break;
            case 'trigger':
                mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.stdTrigger);
                break;
            default:
                mugType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataBindControlQuestion);
        }

        mug = createMugFromMugType(mugType);
//        mug.on('property-changed', function (e) {
//            formdesigner.controller.showErrorMessage("Property Changed in Question:"+mug.properties.dataElement.properties.nodeID+"!");
//        })

        insertMugTypeIntoForm(curSelMugType,mugType);
        createQuestionInUITree(mugType);
        createQuestionEvent.type = "question-creation";
        createQuestionEvent.mugType = mugType;
        this.fire(createQuestionEvent);

        return mug;

    };
    that.createQuestion = createQuestion;



    /**
     * Checks that the specified move is legal. returns false if problem is found.
     *
     * THIS IS FOR NODES THAT HAVE A CONTROLELEMENT ONLY!
     * @param oType - The type of ControlElement being moved (use tagName!) e.g. "input" or "group"
     * @param position - position, can be "before', "after", "into"
     * @param rType - The type of the Reference controlElement being moved (use tagName!) e.g. "input" or "group"
     *                  if -1 is given, assumes rootNode.
     */
    var checkMoveOp = that.checkMoveOp =function (mugType, position, refMugType) {
        var oType = mugType.mug.properties.controlElement.properties.tagName,
                rType = (!refMugType || refMugType === -1) ? 'group' : refMugType.mug.properties.controlElement.properties.tagName,
                oIsGroupOrRepeat = (oType === 'repeat' || oType === 'group'),
                oIsItemOrInputOrTrigger = (oType === 'item' || oType === 'input' || oType === 'trigger'),
                oIsSelect = (oType === '1select' || oType === 'select'),
                oIsItem = (oType === 'item'),
                rIsSelect = (rType === '1select' || rType === 'select'),
                rIsItemOrInputOrTrigger = (rType === 'item' || rType === 'input' || rType === 'trigger'),
                rIsGroupOrRepeat = (rType === 'repeat' || rType === 'group');

        if (position !== 'into') {
            if (!refMugType) {
                throw "If refMugType is null in checkMoveOp() position MUST be 'into'! Position was: "+position;
            }
            var pRefMugType = formdesigner.controller.form.controlTree.getParentMugType(refMugType);
            return checkMoveOp(mugType,'into',pRefMugType);
        }

        //from here it's safe to assume that position is always 'into'
        if (rIsItemOrInputOrTrigger) {
            return false;
        }

        if (rIsGroupOrRepeat) {
            return !oIsItem;
        }

        if (rIsSelect) {
            return oIsItem;
        }

        //we should never get here.
        throw "Unknown controlElement type used, can't check if the MOVE_OP is valid or not!";

    };




    /**
     * Move a mugType from its current place (in both the Data and Control trees) to
     * the position specified by the arguments,
     * @param mugType - The MT to be moved
     * @param position - The position relative to the refMugType (can be 'before','after' or 'into')
     * @param refMugType
     */
    var moveMugType = function (mugType, position, refMugType) {
        var dataTree = form.dataTree, controlTree = form.controlTree;
        if (!checkMoveOp(mugType, position, refMugType)) {
            throw 'MOVE NOT ALLOWED!  MugType Move for MT:' + mugType + ', refMT:' + refMugType + ", position:" + position + " ABORTED";
        }
        dataTree.insertMugType(mugType, position, refMugType);
        controlTree.insertMugType(mugType, position, refMugType);
    };
    that.moveMugType = moveMugType;
    /**
     * Gets the label used to represent this mug in the UI tree
     * @param mugOrMugType - mug or mugType
     */
    var getTreeLabel = function (mugOrMugType) {
        var mug;
        if (mugOrMugType instanceof formdesigner.model.Mug) {
            mug = mugOrMugType;
        }else if (typeof mugOrMugType.validateMug === 'function') {
            mug = mugOrMugType.mug;
        }else{
            throw 'getTreeLabel() must be given either a Mug or MugType as argument!';
        }

        var retVal = mug.getBindElementID() ? mug.getDataElementID() : mug.getBindElementID();
        if (!retVal) {
            retVal = mug.properties.controlElement.properties.label;
        }
        return retVal;
    };
    that.getTreeLabel = getTreeLabel;


    /**
     * Returns the Tree object specified by treeType from the Form object
     * @param treeType - string - either 'data' or 'control'
     */
    var getTree = function getTree(treeType) {
        if (treeType === 'data') {
            return form.dataTree;
        }else if (treeType === 'control') {
            return form.controlTree;
        }else{
            throw "controller.getTree must be given a treeType of either 'data' or 'control'!";
        }
    };

    var getCurrentlySelectedMug = function () {
        return curSelMugType.mug;
    };
    that.getCurrentlySelectedMug = getCurrentlySelectedMug;

    var getCurrentlySelectedMugType = function () {
        return curSelMugType;
    };
    that.getCurrentlySelectedMugType = getCurrentlySelectedMugType;

    //make controller event capable
    formdesigner.util.eventuality(that);

    return that;
})();