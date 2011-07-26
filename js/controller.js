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
    var that = {}, form,
        curSelMugType = null,
        curSelUfid = null,

        initFormDesigner = function () {
            formdesigner.util.question_counter = 1;
            curSelMugType = null;
            curSelUfid = null;
            $('#fd-quesiton-tree').empty();
            $('#fd-data-tree').empty();

            formdesigner.model.init();
            formdesigner.ui.init();
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
     that.setMugPropertyValue = function (myMug, element, property, val, mugType) {
         var rootProps = myMug['properties'];
         var elProps = rootProps[element].properties,
            propertyToChange = elProps[property], event = {};

         myMug.properties[element].properties[property] = val;
         event.type = 'property-changed';
         event.property = property;
         event.element = element;
         event.val = val;
         event.mugUfid = myMug.ufid;
         event.mugTypeUfid = mugType.ufid;


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
        if (newMugType.type.indexOf('d') !== -1) {
            dataTree.insertMugType(newMugType, formdesigner.util.getRelativeInsertPosition(refMugType, newMugType), refMugType);
        }
        if (newMugType.type.indexOf('c') !== -1) {
            controlTree.insertMugType(newMugType, formdesigner.util.getRelativeInsertPosition(refMugType, newMugType), refMugType);
        }
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

        //this allows the mug to respond to certain events in a common way.
        //see method docs for further info
        formdesigner.util.setStandardMugEventResponses(mug);

        insertMugTypeIntoForm(curSelMugType,mugType);
        createQuestionInUITree(mugType);
        createQuestionEvent.type = "question-creation";
        createQuestionEvent.mugType = mugType;
        this.fire(createQuestionEvent);

        return mug;

    };
    that.createQuestion = createQuestion;

    that.XMLWriter = null;
    var initXMLWriter = function () {
        var xw = new XMLWriter( 'UTF-8', '1.0' );
        xw.writeStartDocument();
        formdesigner.controller.XMLWriter = xw;
    }
    that.initXMLWriter = initXMLWriter;

    /**
     * Checks that the form is valid (prompts the user if not).
     *
     * Returns a reference to the variable that will contain the xform
     * string.  If there are no validation errors at call time,
     * this variable will immediately be populated with the form.
     * If there are problems, the var will not be populated until the user
     * hits continue.  If they choose to abort the operation (to fix the
     * form) the var will not be populated at all.
     *
     */
    that.XFORM_STRING = null;
    var generateXForm = function () {

        function showFormInLightBox () {
            var output = $('#fd-source');
            if(formdesigner.controller.XFORM_STRING){
                output.val(formdesigner.controller.XFORM_STRING);
                $('#inline').click();
            }
        }

        // There are validation errors but user continues anyway
        function onContinue () {
            formdesigner.controller.XFORM_STRING = form.createXForm();
            formdesigner.ui.hideConfirmDialog();
            showFormInLightBox();

        }

        function onAbort () {
            formdesigner.controller.XFORM_STRING = null;
            formdesigner.ui.hideConfirmDialog();
        }

        var msg = "There are validation errors in the form.  Do you want to continue anyway? WARNING:" +
            "The form will not be valid and likely not perform correctly on your device!"

        formdesigner.ui.setDialogInfo(msg,'Continue',onContinue,'Abort',onAbort);
        console.log ("form.isValid:",form.isFormValid());
        if (!form.isFormValid()) {
            console.log("FORM NOT VALID: SHOWING CONFIRM BOX");
            formdesigner.ui.showConfirmDialog();
        } else {
            formdesigner.controller.XFORM_STRING = form.createXForm();
            showFormInLightBox();
        }
        return formdesigner.controller.XFORM_STRING;
    }
    that.generateXForm = generateXForm;

    var setFormName = function (name) {
        formdesigner.controller.form.formName = name;
    };
    that.setFormName = setFormName;

    /**
     * The big daddy function of parsing.
     * Pass in the XML String and this function
     * will create all the right stuff in the trees
     * and set everything up for editing.
     * @param xmlString
     */
    var parseXML = function (xmlString) {
        var ParseException = function (msg) {
            that = {};
            that.args = arguments;
            that.message = msg;
            that.toString = function () {
                return msg + '' + arguments;
            }
        }

        var xmlDoc = $.parseXML(xmlString),
            xml = $(xmlDoc),
            binds = xml.find('bind'),
            data = xml.find('instance').children(),
            formID, formName;

        xml.find('instance').children().each(function () {
            formID = this.nodeName;
        });

        function parseInstanceInfo () {
            
        }

        function parseDataTree (dataEl) {
            function parseDataElement (el) {
                var nodeID = el.nodeName, nodeVal = $(el).val(),
                    mType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataOnly),
                    parentNodeName = $(el).parent()[0].nodeName,
                    rootNodeName = $(dataEl)[0].nodeName,
                    dataTree = formdesigner.controller.form.dataTree,
                    mug, parentMugType;

                mType.typeName = "Data Only MugType";
                mug = formdesigner.model.createMugFromMugType(mType);
                mType.mug = mug;
                mType.mug.properties.dataElement.nodeID = nodeID;
                mType.mug.properties.dataElement.dataValue = nodeVal;

                if ( parentNodeName === rootNodeName ) {
                    parentMugType = null;
                }else {
                    parentMugType = formdesigner.controller.form.getMugTypeByIDFromTree(parentNodeName,'data');
                }
                console.log(parentMugType);
                dataTree.insertMugType(mType,'into',parentMugType);
            }
            var root = $(dataEl),
                recFunc = function () {
                    parseDataElement(this);
                    $(this).children().each(recFunc);
                };

            root.children().each(recFunc);
        }

        function parseBindList (bindList) {
            /**
             * Given a (nodeset or ref) path, will figure out what the implied NodeID is.
             * @param path
             */
            function getNodeIDfromPath (path) {
                var arr = path.split('/');
                return arr[arr.length-1];
            }

            function eachFunc () {
                var el = $(this),
                    attrs = {},
                    mType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataBind),
                    mug = formdesigner.model.createMugFromMugType(mType),
                    path, nodeID, bindElement, oldMT;
                path = el.attr('nodeset');
                if (!path) {
                   path = el.attr('ref');
                }
                nodeID = getNodeIDfromPath(path);
                attrs.dataType = el.attr('type');
                attrs.relevantAttr = el.attr('relevant');
                attrs.calculateAttr = el.attr('calculate');
                attrs.constraintAttr = el.attr('constraint');
                attrs.constraintMsgAttr = el.attr('constraintMsg');
                attrs.requiredAttr = el.attr('required');
                attrs.nodeID = nodeID;

                bindElement = new formdesigner.model.BindElement(attrs);
                mug.properties.bindElement = bindElement;

                oldMT = formdesigner.controller.form.getMugTypeByIDFromTree(nodeID, 'data');
                if(!oldMT){
                    throw new ParseException('Parse error! Could not find Data MugType associated with this bind!', el);
                }
                mType.ufid = oldMT.ufid;
                mType.properties.dataElement = oldMT.properties.dataElement;
                mType.mug = mug;
                mType.mug.properties.dataElement = oldMT.mug.properties.dataElement;

                form.replaceMugType(oldMT, mType, 'data');
            }
            bindList.each(eachFunc);
        }

        function parseControlTree () {

        }

        parseDataTree (data[0]);
        parseBindList (binds);

    }
    that.parseXML = parseXML;

    /**
     * Checks that the specified move is legal. returns false if problem is found.
     *
     * THIS IS FOR NODES THAT HAVE A CONTROLELEMENT ONLY!
     * @param oType - The type of ControlElement being moved (use tagName!) e.g. "input" or "group"
     * @param position - position, can be "before', "after", "into"
     * @param rType - The type of the Reference controlElement being moved (use tagName!) e.g. "input" or "group"
     *                  if -1 is given, assumes rootNode.
     */
    var checkMoveOp = that.checkMoveOp =function (mugType, position, refMugType, treeType) {
        if(treeType === 'data'){
            return true;
        }
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

    /**
     * Returns a JSON representation of the
     * Control Tree (tweak this method for data tree)
     * returns it as well as logging it to console.
     */
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

    /**
     * Used to reset the state of the controller if a FD wide reset is called
     * (see resetFormDesigner)
     */
    function resetControllerInternal () {
            formdesigner.util.question_counter = 1;
            curSelMugType = null;
            curSelUfid = null;
    }

    /**
     * Used to clear out the state of the FormDesigner
     * to represent how things were just after the first
     * init call was made (used for example when wanting
     * to create a 'New Form'
     */
    that.resetFormDesigner = function () {
        resetControllerInternal();
        formdesigner.model.reset();
        formdesigner.ui.resetUI();
    }

    //make controller event capable
    formdesigner.util.eventuality(that);

    return that;
})();