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
     * @param myMug - the mug thats value needs to be set
     * @param element can be one of (string) 'bind','data','control'
     * @param property (string) property name
     * @param val new value the property should be set to.
     */
     that.setMugPropertyValue = function (myMug, element, property, val) {
        var rootProps = myMug['properties'];
        var elProps = rootProps[element].properties,
            propertyToChange = elProps[property], event = {};

        myMug.properties[element].properties[property] = val;
        event.type = 'property-changed';
        event.property = property;
        event.element = element;
        event.val = val;
        myMug.fire(event);

    };










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
                mugType = formdesigner.model.mugTypeMaker.stdTextQuestion();
                break;
            case 'group':
                mugType = formdesigner.model.mugTypeMaker.stdGroup();
                break;
            case 'select':
                mugType = formdesigner.model.mugTypeMaker.stdMSelect();
                break;
             case 'item':
                mugType = formdesigner.model.mugTypeMaker.stdItem();
                break;
            case 'trigger':
                mugType = formdesigner.model.mugTypeMaker.stdTrigger();
                break;
            default:
                mugType = formdesigner.model.mugTypeMaker.stdTextQuestion();
        }

        mug = mugType.mug;
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

    that.get_form_data = function(){
        var trees = [], wTree, i,j, data;
        trees.push(getTree('data'));
        trees.push(getTree('control'));

        function printMug(mType){
            return mType.mug;
        }

        function recurse(node){
            var i,d = {}, children;
            d.parent = printMug(node.getValue());
            d.children = {};
            children = node.getChildren();
            for(i in children){
                if(children.hasOwnProperty(i)){
                    d.children[i] = (recurse(children[i]));
                }
            }

            return d;
        }

        data = JSON.stringify(recurse(trees[0].rootNode),null,'\t');

        console.log(data);
        return data;
    }

    var Parser = function(spec){
        var that = {},
                unusedBits; //the unused elements of a regular XForm are stored here.

        (function constructor(mySpec){

        })(spec);


        that.parse = function(XMLString){
            var jform = xmlToJSON(XMLString),
                    bindBlock, dataBlock, controlBlock;
            
            bindBlock = jform["h:html"]["h:head"].model.bind;
            dataBlock = jform["h:html"]["h:head"].model.instance;
            controlBlock = jform["h:html"]["h:body"];
            console.log(bindBlock);
            console.log(dataBlock);
            console.log(controlBlock);
            console.log('jform',jform)
            parseDataBlock(jform);
            parseBindBlock(jform);
            parseControlBlock(jform);

            storeUnusedBits(jform);
            return json2xml(jform,"");
        }

        /**
         * Converts an XML string to a JSON
         * document.
         * @param xml
         */
        var xmlToJSON = function(xml){
            var data = xml,output,content;

            content = formdesigner.util.parseXml(data);
            output = xml2json(content,"\t");
            output =  eval('(' + output + ')');
            return output;
        }

        var parseDataBlock = function(form){

        };

        var parseBindBlock = function(form){

        };

        var parseControlBlock = function(form){

        };

        /**
         * Store the 'rest' of the xform document (as a JSON object)
         * to be retrieved later during form construction.
         * @param form
         */
        var storeUnusedBits = function(form){
            unusedBits = form;
        };

        /**
         * Retrieve the unused parts (during parse time) of the XForm
         * as a JSON object.
         */
        that.getUnusedDocParts = function(){
            return unusedBits;
        };




        //make parser event aware
        formdesigner.util.eventuality(that);

        return that;
    }
    that.Parser = Parser;

    //make controller event capable
    formdesigner.util.eventuality(that);

    return that;
})();