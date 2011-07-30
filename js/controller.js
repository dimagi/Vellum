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
        formdesigner.currentItextDisplayLanguage = formdesigner.model.Itext.getDefaultLanguage();
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
        this.curSelUfid = ufid;
        this.curSelMugType = getMTFromFormByUFID(ufid);
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

    var initController = function () {

    }
    that.initController = initController;

    /**
     * Controller internal function.  Goes through
     * the internal data model and reloads the UI trees
     * and whatever other widgets need refreshing in order
     * for the user to start the editing process.
     */
    function reloadUI () {
        var controlTree, dataTree, treeFunc;

        //first clear out the existing UI
        formdesigner.ui.resetUI();
        formdesigner.controller.setCurrentlySelectedMugType(null);

        treeFunc = function (node) {
            var mt;
            if(node.isRootNode) {
                return;
            }

            mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!'
            }

            formdesigner.controller.loadMugTypeIntoUI(mt);


        }

        controlTree = formdesigner.controller.form.controlTree;
        controlTree.treeMap(treeFunc);

        formdesigner.ui.setTreeValidationIcons();

//        dataTree = formdesigner.controller.form.dataTree;
//        dataTree.treeMap(treeFunc);

    }

    that.reloadUI = reloadUI;

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
                case 'multi-select':
                case 'single-select':
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

//        $('#fd-data-tree').jstree("create",
//            null, //reference node, use null if using UI plugin for currently selected
//            insertPosition, //position relative to reference node
//            objectData,
//            null, //callback after creation, better to wait for event
//            true  //skip_rename
//        );
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

    var loadMugTypeIntoUI = function (mugType) {
        var mug, controlTree, parentMT, parentMTUfid, loadMTEvent = {};

        mug = mugType.mug;

        //this allows the mug to respond to certain events in a common way.
        //see method docs for further info
        formdesigner.util.setStandardMugEventResponses(mug);

        //set the 'currently selected mugType' to be that of this mugType's parent.
        controlTree = formdesigner.controller.form.controlTree;
        parentMT = controlTree.getParentMugType(mugType);
        if(parentMT){
            parentMTUfid = parentMT.ufid;
            formdesigner.ui.getJSTree().jstree('select_node',$('#'+parentMTUfid), true);
        }else{
            parentMTUfid = null;
        }
//        formdesigner.controller.setCurrentlySelectedMugType(parentMTUfid);
        createQuestionInUITree(mugType);
        loadMTEvent.type= "mugtype-loaded";
        loadMTEvent.mugType = mugType;
        this.fire(loadMTEvent);

        return mug;
    }
    that.loadMugTypeIntoUI = loadMugTypeIntoUI;

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

    var showLoadXformBox = function () {
        var input = $('#fd-source'),
                button = $('#fd-parsexml-button');
        button.button({
            icons: {
                primary : 'ui-icon-folder-open'
            }
        })
        $('#inline').click();
        button.show();

        button.click(function () {
            formdesigner.controller.loadXForm(input.val());
            $.fancybox.close();
            $(this).hide();
        });

    };
    that.showLoadXformBox = showLoadXformBox;

    var setFormName = function (name) {
        formdesigner.controller.form.formName = name;
    };
    that.setFormName = setFormName;

    var loadXForm = function (formString) {
        formdesigner.fire({
                type: 'load-form-start',
                form : formString
            });
        try {
            formdesigner.controller.resetFormDesigner();
            formdesigner.controller.parseXML(formString);
            formdesigner.controller.reloadUI();
        }catch (e) {
            formdesigner.fire({
                type: 'load-form-error',
                errorObj : e,
                form : formString
            });
            throw (e);
        }


        formdesigner.fire({
                type: 'load-form-compelete',
                form : formString
            });
    }
    that.loadXForm = loadXForm;

    /**
     * The big daddy function of parsing.
     * Pass in the XML String and this function
     * will create all the right stuff in the trees
     * and set everything up for editing.
     * @param xmlString
     */
    var parseXML = function (xmlString) {
        var ParseException = function (msg) {
            this.name = 'XMLParseException';
            this.message = msg;
        }

        function parseInstanceInfo (dataEl) {

        }

        function parseDataTree (dataEl) {
            function parseDataElement (el) {
                var nodeID = el.nodeName, nodeVal,
                    mType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataOnly),
                    parentNodeName = $(el).parent()[0].nodeName,
                    rootNodeName = $(dataEl)[0].nodeName,
                    dataTree = formdesigner.controller.form.dataTree,
                    mug, parentMugType;

                if($(el).children().length === 0) {
                    nodeVal = $(el).text();
                }else {
                    nodeVal = null;
                }

                mType.typeName = "Data Only MugType";
                mug = formdesigner.model.createMugFromMugType(mType);

                mug.properties.dataElement.properties.nodeID = nodeID;
                mug.properties.dataElement.properties.dataValue = nodeVal;
                mType.mug = mug;
                if ( parentNodeName === rootNodeName ) {
                    parentMugType = null;
                }else {
                    parentMugType = formdesigner.controller.form.getMugTypeByIDFromTree(parentNodeName,'data');
                }

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
             * Parses the required attribute string (expecting either "true()" or "false()" or nothing
             * and returns either true, false or null
             * @param attrString - string
             */
            function parseRequiredAttribute (attrString) {
                var str = attrString.toLowerCase().replace(/\s/g, '');
                if (str === 'true()') {
                    return true;
                } else if (str === 'false()') {
                    return false;
                } else {
                    return null;
                }
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
                nodeID = formdesigner.util.getNodeIDFromPath(path);
                attrs.dataType = el.attr('type');
                attrs.relevantAttr = el.attr('relevant');
                attrs.calculateAttr = el.attr('calculate');
                attrs.constraintAttr = el.attr('constraint');
                attrs.constraintMsgAttr = el.attr('constraintMsg');
                attrs.requiredAttr = parseRequiredAttribute(el.attr('required'));
                attrs.nodeID = nodeID;

                bindElement = new formdesigner.model.BindElement(attrs);
                mug.properties.bindElement = bindElement;

                oldMT = formdesigner.controller.form.getMugTypeByIDFromTree(nodeID, 'data');
                if(!oldMT){
                    console.log("El,nodeID",el,nodeID);
                    throw 'Parse error! Could not find Data MugType associated with this bind!'; //can't have a bind without an associated dataElement.
                }
                mType.ufid = oldMT.ufid;
                mType.properties.dataElement = oldMT.properties.dataElement;
                mType.mug = mug;
                mType.mug.properties.dataElement = oldMT.mug.properties.dataElement;

                form.replaceMugType(oldMT, mType, 'data');
            }
            bindList.each(eachFunc);
        }

        function parseControlTree (controlsTree) {
            function eachFunc(){
                /**
                 * Determines what MugType this element should be
                 * and creates it.  Also modifies any existing mug that is associated
                 * with this element to fit the new type.
                 * @param nodeID
                 * @param controlEl
                 */
                function classifyAndCreateMugType (nodeID, cEl) {
                    var oldMT = formdesigner.controller.form.getMugTypeByIDFromTree(nodeID, 'data'), //check the date node to see if there's a related MT already present
                        mugType, mug, tagName, bindEl, dataEl, dataType, MTIdentifier,
                        //flags
                        hasBind = true;

                    tagName = $(cEl)[0].nodeName;
                    if (oldMT) {
                        bindEl = oldMT.mug.properties.bindElement;
                        if (bindEl) {
                            dataType = bindEl.properties.dataType;
                            if (dataType) {
                                dataType = dataType.replace('xsd:',''); //strip out extranous namespace
                                dataType = dataType.toLowerCase();
                            }
                        }else{
                            hasBind = false;
                        }
                    }
                    
                    //broadly categorize
                    tagName = tagName.toLowerCase();
                    if(tagName === 'select') {
                        MTIdentifier = 'stdMSelect';
                    }else if (tagName === 'select1') {
                        MTIdentifier = 'stdSelect';
                    }else if (tagName === 'trigger') {
                        MTIdentifier = 'stdTrigger';
                    }else if (tagName === 'input') {
                        MTIdentifier = 'stdTextQuestion';
                    }else if (tagName === 'item') {
                        MTIdentifier = 'stdItem';
                    }else if (tagName === 'group') {
                        MTIdentifier = 'stdGroup';
                    }else if (tagName === 'secret') {
                        MTIdentifier = 'stdSecret';
                    }

                    //fine tune for special cases (repeats, groups, inputs)
                    if (MTIdentifier === 'input' && dataType){
                        if(dataType === 'long') {
                            MTIdentifier = 'stdLong';
                        }else if(dataType === 'int') {
                            MTIdentifier = 'stdInt';
                        }else if(dataType === 'geopoint') {
                            MTIdentifier = 'stdGeopoint';
                        }else if(dataType === 'string') {
                            //do nothing, the ident is already correct.
                        }
                    }else if (MTIdentifier === 'stdGroup') {
                        if($(cEl).find('repeat').length > 0){
                            tagName = 'repeat';
                            MTIdentifier = 'stdRepeat';
                        }
                    }
                    try{
                        mugType = formdesigner.model.mugTypeMaker[MTIdentifier]();
                    }catch (e) {
                        throw 'New Control Element classified as non-existent MugType! Please create a rule for this case' +
                            ' in formdesigner.model.mugTypeMaker! IdentString:' + MTIdentifier;
                    }

                    if(oldMT) { //copy oldMT data to newly generated MT
                        mugType.ufid = oldMT.ufid;
                        mugType.mug.properties.dataElement = oldMT.mug.properties.dataElement;
                        mugType.mug.properties.bindElement = oldMT.mug.properties.bindElement;

                        //replace in dataTree
                        formdesigner.controller.form.replaceMugType(oldMT,mugType,'data');
                    }

                    //check flags
                    if(!hasBind){
                        mugType.type = mugType.type.replace ('b',''); //strip 'b' from type string
                        delete mugType.properties.bindElement;
                        delete mugType.mug.properties.bindElement;
                    }

                    return mugType;
                }

                function populateMug (MugType, cEl) {
                    var labelEl, hintEl;
                    function parseLabel (lEl, MT) {
                        var labelVal = formdesigner.util.getXLabelValue($(lEl)),
                            labelRef = $(lEl).attr('ref'),
                            cProps = MT.mug.properties.controlElement.properties;
                        if(labelRef){
                            labelRef = labelRef.replace("jr:itext('",'').replace("')",''); //strip itext incantation
                            cProps.labelItextID = labelRef;
                        }
                        cProps.label = labelVal;
                    }

                    function parseHint (hEl, MT) {
                        var hintVal = formdesigner.util.getXLabelValue($(hEl)),
                            hintRef = $(hEl).attr('ref'),
                            cProps = MT.mug.properties.controlElement.properties;

                        if(hintRef){
                            hintRef = hintRef.replace("jr:itext('",'').replace("')",''); //strip itext incantation
                            cProps.hintItextID = hintRef;
                        }
                        cProps.hintLabel = hintVal;

                    }

                    function parseDefaultValue (dEl, MT) {
                        var dVal = formdesigner.util.getXLabelValue($(dEl)),
                                cProps = MT.mug.properties.controlElement.properties;
                        if(dVal){
                            cProps.defaultValue = dVal;
                        }
                    }

                    var tag = MugType.mug.properties.controlElement.properties.tagName;
                    labelEl = $(cEl).find('label');
                    hintEl = $(cEl).find('hint');
                    var cannottHaveDefaultValue = ['select', 'select1', 'repeat', 'group', 'trigger'];
                    if (labelEl.length > 0) {
                        parseLabel(labelEl, MugType);
                    }
                    if (hintEl.length > 0) {
                        parseHint (hintEl, MugType);
                    }
                    if (tag === 'item') {
                        parseDefaultValue($(cEl).find('value'),MugType);
                    }

                }

                function insertMTInControlTree (MugType, parentMT) {
                    formdesigner.controller.form.controlTree.insertMugType(MugType,'into',parentMT);
                }

                var el = $ ( this ),
                    path,
                    nodeID,
                    mType,
                    parentNode,
                    parentPath,
                    parentNodeID,
                    parentMug,
                    tagName,
                    couldHaveChildren = ['repeat', 'group', 'select', 'select1'],
                    children;

                console.log("ELEMENT IN PARSECONTROL",el);



                parentNode = el.parent();
                if($(parentNode)[0].nodeName === 'repeat') {
                    parentNode = parentNode.parent(); //skip one up because of repeat's funny structure.
                }if($(parentNode)[0].nodeName === 'h:body') {
                    parentNode = null;
                }

                parentPath = formdesigner.util.getPathFromControlElement(parentNode);
                parentNodeID = formdesigner.util.getNodeIDFromPath(parentPath);
                if (parentNodeID) {
                    parentMug = formdesigner.controller.form.getMugTypeByIDFromTree(parentNodeID,'control');
                } else {
                    parentMug = null;
                }

                path = formdesigner.util.getPathFromControlElement(el);
                nodeID = formdesigner.util.getNodeIDFromPath(path);
                
                mType = classifyAndCreateMugType(nodeID,el);
                populateMug(mType,el);
                insertMTInControlTree(mType, parentMug);

                tagName = mType.mug.properties.controlElement.properties.tagName.toLowerCase();
                if(couldHaveChildren.indexOf(tagName) !== -1) {
                    if(tagName === 'repeat'){
                        children = $(el).find('repeat').children().not('label').not('value');
                    }else{
                        children = $(el).children().not('label').not('value');
                    }
                    children.each(eachFunc); //recurse down the tree
                }
            }
            controlsTree.each(eachFunc);
        }

        function parseItextBlock (itextBlock) {

        }

        formdesigner.controller.fire('parse-start');
        try{
            var xmlDoc = $.parseXML(xmlString),
                xml = $(xmlDoc),
                binds = xml.find('bind'),
                data = xml.find('instance').children(),
                controls = xml.find('h\\:body').children(),
                itext = xml.find('itext'),
                formID, formName;

            xml.find('instance').children().each(function () {
                formID = this.nodeName;
            });

            parseInstanceInfo(data[0]);
            parseDataTree (data[0]);
            parseBindList (binds);
            parseControlTree (controls);
            parseItextBlock(itext);

            formdesigner.controller.fire({
                type: 'parse-finish'
            });



        } catch (e) {
            formdesigner.controller.fire({
              type: 'parse-error',
              exceptionData: e
            });
            throw e;
        }

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

        if(position === 'inside'){
            position = 'into';

        }
        var oType = mugType.mug.properties.controlElement.properties.tagName,
                rType = (!refMugType || refMugType === -1) ? 'group' : refMugType.mug.properties.controlElement.properties.tagName,
                oIsGroupOrRepeat = (oType === 'repeat' || oType === 'group'),
                oIsItemOrInputOrTrigger = (oType === 'item' || oType === 'input' || oType === 'trigger'),
                oIsSelect = (oType === 'select1' || oType === 'select'),
                oIsItem = (oType === 'item'),
                rIsSelect = (rType === 'select1' || rType === 'select'),
                rIsItemOrInputOrTrigger = (rType === 'item' || rType === 'input' || rType === 'trigger'),
                rIsGroupOrRepeat = (rType === 'repeat' || rType === 'group');

        console.log(oType,position,rType);
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
        console.error("checkMoveOp error..",mugType,position,refMugType,treeType);
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