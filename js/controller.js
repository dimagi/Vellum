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

        formdesigner.controller.fire('fd-reload-ui');

    }

    that.reloadUI = reloadUI;

    var showErrorMessage = function (msg) {
//        formdesigner.ui.appendErrorMessage(msg);
        
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
                };

            switch(tString.toLowerCase()) {
                case 'text':
                    setType("question");
                    break;
                case 'integer':
                    setType("int");
                    break;
                case 'double':
                    setType("double");
                    break;
                case 'long':
                    setType("long");
                    break;
                case 'group':
                    setType("group");
                    break;
                case 'repeat':
                    setType("repeat");
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
                case 'secret':
                    setType("secret");
                    break;
                case 'date':
                    setType("date");
                    break;
                case 'datetime':
                    setType("datetime");
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

        objectData.data = formdesigner.util.getMugDisplayName(mugType);
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
            case '1select':
                mugType = formdesigner.model.mugTypeMaker.stdSelect();
                break;
            case 'secret':
                mugType = formdesigner.model.mugTypeMaker.stdSecret();
                break;
             case 'item':
                mugType = formdesigner.model.mugTypeMaker.stdItem();
                break;
            case 'trigger':
                mugType = formdesigner.model.mugTypeMaker.stdTrigger();
                break;
            case 'repeat':
                mugType = formdesigner.model.mugTypeMaker.stdRepeat();
                break;
            case 'int':
                mugType = formdesigner.model.mugTypeMaker.stdInt();
                break;
            case 'long':
                mugType = formdesigner.model.mugTypeMaker.stdLong();
                break;
            case 'double':
                mugType = formdesigner.model.mugTypeMaker.stdDouble();
                break;
            case 'date':
                mugType = formdesigner.model.mugTypeMaker.stdDate();
                break;
            case 'datetime':
                mugType = formdesigner.model.mugTypeMaker.stdDateTime();
                break;
            default:
                console.log("No standard mugType for selected question type:" + qType + " switching to 'Text Question' type!");
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
            formdesigner.ui.getJSTree().jstree('deselect_all');
        }
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
        if (!form.isFormValid()) {
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

    var parseXLSItext = function (str) {
        var rows = str.split('\n'),
                nRows, nCols, i, j, cells, lang,iID, form, val, Itext;
        nRows = rows.length;
        nCols = rows[0].split('\t').length;
        Itext = formdesigner.model.Itext;
        for (i in rows) {
            if (rows.hasOwnProperty(i)) {
                cells = rows[i].split('\t');
                lang = cells[0];
                iID = cells[1];
                for (j = 2; j<cells.length ; j++) {
                    if(cells[j]) {
                        if(j === 2) {
                            form = 'default';
                        } else if (j === 3) {
                            form = 'audio';
                        } else if (j === 4) {
                            form = 'image';
                        } else if (j === 5) {
                            form = 'video';
                        }
                        val = cells[j];
                        Itext.setValue(iID,lang,form,val);
                    }
                }
            }
        }
    }
    that.parseXLSItext = parseXLSItext;

    var generateItextXLS = function () {
        var idata, row, iID, lang, form, val, Itext,
                out = '';
        Itext = formdesigner.model.Itext;
        idata = Itext.getAllData();

        /**
         * Cleanes Itext so that it fits the csv spec. For now just replaces newlines with ''
         * @param val
         */
        function cleanItextVal(val) {
            var newVal;
            newVal = val.replace(/\n/g, '')
            return newVal
        }
        function makeRow (language, id, data) {
            var row = '', i;
            row = language + '\t' + id;
            row += '\t' + (data["default"] ? cleanItextVal(data["default"]) : '');
            row += '\t' + (data["audio"] ? cleanItextVal(data["audio"]) : '');
            row += '\t' + (data["image"] ? cleanItextVal(data["image"]) : '');
            row += '\t' + (data["video"] ? cleanItextVal(data["video"]) : '');
            row += '\n';
            return row;
        }

        for (lang in idata) {
            if (idata.hasOwnProperty(lang)) {
                for (iID in idata[lang] ) {
                    if (idata[lang].hasOwnProperty(iID)) {
                        out += makeRow(lang, iID, idata[lang][iID])
                    }
                }

            }
        }

        return out;
    }
    that.generateItextXLS = generateItextXLS;

    var showLoadItextFromClipboard = function () {
        var input = $('#fd-source'),
                button = $('<button id ="fd-parsexls-button">Load Itext</button>');
        button.button({
            icons: {
                primary : 'ui-icon-folder-open'
            }
        })
        $('#inline').click();
        input.after(button);
        button.show();

        button.click(function () {
            formdesigner.controller.parseXLSItext(input.val());
            $.fancybox.close();
            $(this).remove();
        });

    };
    that.showLoadItextFromClipboard = showLoadItextFromClipboard;

    var showGeneratedItextXLS = function () {
        var source = $('#fd-source');

        source.val(formdesigner.controller.generateItextXLS());

        $('#inline').click();
        

    };
    that.showGeneratedItextXLS = showGeneratedItextXLS;

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
                type: 'load-form-complete',
                form : formString
            });
    }
    that.loadXForm = loadXForm;


    var removeMugTypeByUFID = function (ufid) {
        var MT = formdesigner.controller.form.getMugTypeByUFID(ufid);
        formdesigner.controller.removeMugTypeFromForm(MT);
    }
    that.removeMugTypeByUFID = removeMugTypeByUFID;

    var removeMugTypeFromForm = function (mugType) {
        formdesigner.ui.removeMugTypeFromUITree(mugType);
        formdesigner.controller.form.dataTree.removeMugType(mugType);
        formdesigner.controller.form.controlTree.removeMugType(mugType);
        formdesigner.ui.forceUpdateUI();
    }
    that.removeMugTypeFromForm = removeMugTypeFromForm;

    /**
    * use getErrorMsg() and addErrorMsg() to deal with error msgs!
    */
    var parseErrorMsgs = [];

    var addParseErrorMsg = function (level, msg) {
        parseErrorMsgs.push(level + "::" + msg);
    }
    that.addParseErrorMsg = addParseErrorMsg;

    var getParseErrorMsgs = function () {
        return parseErrorMsgs;
    }
    that.getParseErrorMsgs = getParseErrorMsgs;

    var resetParseErrorMsgs = function () {
        parseErrorMsgs = [];
    }
    that.resetParseErrorMsgs = resetParseErrorMsgs;

    /**
     * The big daddy function of parsing.
     * Pass in the XML String and this function
     * will create all the right stuff in the trees
     * and set everything up for editing.
     * @param xmlString
     */
    var parseXML = function (xmlString) {
        var pError, getPErros;
        pError = formdesigner.controller.addParseErrorMsg;
        getPErros = formdesigner.controller.getParseErrorMsgs;
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
                    mug, parentMugType,
                        extraXMLNS, keyAttr;

                if($(el).children().length === 0) {
                    nodeVal = $(el).text();
                }else {
                    nodeVal = null;
                }

                extraXMLNS = $(el).attr('xmlns');
                keyAttr = $(el).attr('key');

                mType.typeName = "Data Only MugType";
                mug = formdesigner.model.createMugFromMugType(mType);

                mug.properties.dataElement.properties.nodeID = nodeID;
                mug.properties.dataElement.properties.dataValue = nodeVal;
                if(extraXMLNS && (extraXMLNS !== formdesigner.formUuid)) {
                    mug.properties.dataElement.properties.xmlnsAttr = extraXMLNS;
                }
                if(keyAttr) {
                    mug.properties.dataElement.properties.keyAttr = keyAttr;
                }
                
                mType.mug = mug;
                if ( parentNodeName === rootNodeName ) {
                    parentMugType = null;
                }else {
                    parentMugType = formdesigner.controller.form.getMugTypeByIDFromTree(parentNodeName,'data')[0];
                }

                dataTree.insertMugType(mType,'into',parentMugType);
            }
            var root = $(dataEl), uuid, uiVersion, formName, formVersion, jrm,
                recFunc = function () {
                    parseDataElement(this);
                    $(this).children().each(recFunc);

                };

            if(root.children().length === 0) {
                pError('error', 'Data block has no children elements! Please make sure your form is a valid JavaRosa XForm and try again!');
            }
            root.children().each(recFunc);
            //try to grab the JavaRosa XForm Attributes in the root data element...
            formdesigner.formUuid = root.attr("xmlns");
            formdesigner.formJRM = root.attr("xmlns:jrm");
            formdesigner.formUIVersion = root.attr("uiVersion");
            formdesigner.formVersion = root.attr("version");
            formdesigner.formName = root.attr("name");
            formdesigner.controller.form.formID = $(root)[0].tagName;
            
            if (!formdesigner.formUuid) {
                pError('warning', 'Form does not have a unique xform XMLNS (in data block). Will be added automatically');
            }
            if (!formdesigner.formJRM) {
                pError('warning', 'Form JRM namespace attribute was not found in data block. One will be added automatically');
            }
            if (!formdesigner.formUIVersion) {
                pError('warning', 'Form does not have a UIVersion attribute, one will be generated automatically');
            }
            if (!formdesigner.formVersion) {
                pError('warning', 'Form does not have a Version attribute (in the data block), one will be added automatically');
            }
            if (!formdesigner.formName) {
                pError('warning', 'Form does not have a Name! The default form name will be used');
            }

        }

        function parseBindList (bindList) {
            /**
             * Parses the required attribute string (expecting either "true()" or "false()" or nothing
             * and returns either true, false or null
             * @param attrString - string
             */
            function parseRequiredAttribute (attrString) {
                if (!attrString) {
                    return null;
                }
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
                if(el.attr('id')) {
                    attrs.nodeID = el.attr('id');
                    attrs.nodeset = path;
                } else {
                    attrs.nodeID = nodeID;
                }

                attrs.dataType = el.attr('type');
                attrs.relevantAttr = el.attr('relevant');
                attrs.calculateAttr = el.attr('calculate');
                attrs.constraintAttr = el.attr('constraint');
                attrs.constraintMsgAttr = el.attr('constraintMsg');
                attrs.requiredAttr = parseRequiredAttribute(el.attr('required'));
                attrs.preload = el.attr("jr:preload");
                if(!attrs.preload) {
                    attrs.preload = el.attr("jr\\:preload");
                }
                attrs.preloadParams = el.attr("jr:preloadParams");
                if(!attrs.preloadParams) {
                    attrs.preloadParams = el.attr("jr\\:preloadParams");
                }

                bindElement = new formdesigner.model.BindElement(attrs);
                mug.properties.bindElement = bindElement;

                oldMT = formdesigner.controller.form.getMugTypeByIDFromTree(nodeID, 'data')[0];
                if(!oldMT && attrs.nodeset) {
                    oldMT = formdesigner.controller.form.getMugTypeByIDFromTree(
                                                formdesigner.util.getNodeIDFromPath(attrs.nodeset),
                                                'data'
                    )[0];
                }
                if(!oldMT){
                    pError ('warning', "Bind Node [" + nodeID + "] found but has no associated Data node. This bind node will be discarded!");
//                    throw 'Parse error! Could not find Data MugType associated with this bind!'; //can't have a bind without an associated dataElement.
                    return;
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
                    var oldMT = formdesigner.controller.form.getMugTypeByIDFromTree(nodeID, 'data')[0], //check the date node to see if there's a related MT already present
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
                    if (MTIdentifier === 'stdTextQuestion' && dataType){
                        if(dataType === 'long') {
                            MTIdentifier = 'stdLong';
                        }else if(dataType === 'int') {
                            MTIdentifier = 'stdInt';
                        }else if(dataType === 'double') {
                            MTIdentifier = 'stdDouble';
                        }else if(dataType === 'geopoint') {
                            MTIdentifier = 'stdGeopoint';
                        }else if(dataType === 'string') {
                            //do nothing, the ident is already correct.
                        }else if(dataType === 'date') {
                             MTIdentifier = 'stdDate';
                        }else if(dataType === 'datetime') {
                             MTIdentifier = 'stdDateTime';
                        }

                    }else if (MTIdentifier === 'stdGroup') {
                        if($(cEl).children('repeat').length > 0){
                            tagName = 'repeat';
                            MTIdentifier = 'stdRepeat';
                        }
                    }
                    try{
                        mugType = formdesigner.model.mugTypeMaker[MTIdentifier]();
                    }catch (e) {
                        console.log ("Exception Control Element", cEl);
                        throw 'New Control Element classified as non-existent MugType! Please create a rule for this case' +
                            ' in formdesigner.model.mugTypeMaker! IdentString:' + MTIdentifier + ",tagName:" + tagName +
                                ",cEl:" + cEl + ",nodeID:" + nodeID;
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
                    var labelEl, hintEl, Itext;
                    Itext = formdesigner.model.Itext;
                    function parseLabel (lEl, MT) {
                        var labelVal = formdesigner.util.getXLabelValue($(lEl)),
                            labelRef = $(lEl).attr('ref'),
                            cProps = MT.mug.properties.controlElement.properties,
                            defLang, itextVal;
                        if(labelRef){
                            labelRef = labelRef.replace("jr:itext('",'').replace("')",''); //strip itext incantation
                            cProps.labelItextID = labelRef;
                        } else {
                            labelRef = formdesigner.util.getNewItextID(MT, false); //assumes this is always successful
                            cProps.labelItextID = labelRef;
                        }

                        if (labelVal) {
                            cProps.label = labelVal;
                            defLang = Itext.getDefaultLanguage();
                            itextVal = Itext.getValue(cProps.labelItextID, defLang, 'default');
                            if(!itextVal || itextVal === labelRef) { //if no default Itext has been set, set it with the default label
                                Itext.setValue(cProps.labelItextID, defLang, 'default', labelVal);
                            }
                        }
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
                    if(tag === 'repeat'){
                        labelEl = $($(cEl).parent().children('label'));
                        hintEl = $(cEl).parent().children('hint');
                    } else {
                        labelEl = $(cEl).children('label');
                        hintEl = $(cEl).children('hint');
                    }

                    var cannottHaveDefaultValue = ['select', 'select1', 'repeat', 'group', 'trigger'];
                    if (labelEl.length > 0) {
                        parseLabel(labelEl, MugType);
                    }
                    if (hintEl.length > 0) {
                        parseHint (hintEl, MugType);
                    }
                    if (tag === 'item') {
                        parseDefaultValue($(cEl).children('value'),MugType);
                    }

                }

                function insertMTInControlTree (MugType, parentMT) {
                    formdesigner.controller.form.controlTree.insertMugType(MugType,'into',parentMT);
                }

                //figures out if this control DOM element is a repeat
                function isRepeat(groupEl) {
                    if($(groupEl)[0].tagName !== 'group') {
                        return false;
                    }
                    return $(groupEl).children('repeat').length === 1;
                }

                var el = $ ( this ), oldEl,
                    path,
                    nodeID,
                    mType,
                    parentNode,
                    parentPath,
                    parentNodeID,
                    parentMug,
                    tagName,
                    couldHaveChildren = ['repeat', 'group', 'select', 'select1'],
                    children,
                    bind;


                //do the repeat switch thing
                if(isRepeat(el)) {
                    oldEl = el;
                    el = $(el.children('repeat')[0]);
                }

                parentNode = oldEl ? oldEl.parent() : el.parent();
                if($(parentNode)[0].nodeName === 'h:body') {
                    parentNode = null;
                }

                parentPath = formdesigner.util.getPathFromControlElement(parentNode);
                parentNodeID = formdesigner.util.getNodeIDFromPath(parentPath);
                if(!parentNodeID) {
                    //try looking for a control with a bind attribute
                    bind = $(parentNode).attr('bind');
                    if (bind) {
                         parentNodeID = bind;
                    }
                }
                if (parentNodeID) {
                    parentMug = formdesigner.controller.form.getMugTypeByIDFromTree(parentNodeID,'control')[0];
                } else {
                    parentMug = null;
                }



                path = formdesigner.util.getPathFromControlElement(el);
                nodeID = formdesigner.util.getNodeIDFromPath(path);
                if(!nodeID) {
                    //try looking for a control with a bind attribute
                    bind = $(el).attr('bind');
                    if (bind) {
                         nodeID = bind;
                    }
                }
                if(oldEl){
                    mType = classifyAndCreateMugType(nodeID,oldEl);
                }else {
                    mType = classifyAndCreateMugType(nodeID,el);
                }
                populateMug(mType,el);
                insertMTInControlTree(mType, parentMug);

                tagName = mType.mug.properties.controlElement.properties.tagName.toLowerCase();
                if(couldHaveChildren.indexOf(tagName) !== -1) {
                    children = $(el).children().not('label').not('value').not('hint');
                    children.each(eachFunc); //recurse down the tree
                }
            }
            controlsTree.each(eachFunc);
        }

        function parseItextBlock (itextBlock) {
            var curLanguage, curIID, curForm, Itext;
            Itext = formdesigner.model.Itext;
            Itext.removeLanguage('en');

            function eachLang() {
                var el = $ (this);
                curLanguage = el.attr('lang');
                Itext.addLanguage(curLanguage);
                if(el.attr('default')) {
                    Itext.setDefaultLanguage(curLanguage);
                }

                //loop through children
                el.children().each(eachText)
            }

            function eachText() {
                var textEl = $ (this);
                curIID = textEl.attr('id');
                textEl.children().each(eachValue);


            }

            function eachValue() {
                var valEl = $(this);
                curForm = valEl.attr('form');
                if(!curForm) {
                    curForm = null;
                }

                Itext.setValue(curIID,curLanguage,curForm,formdesigner.util.getXLabelValue(valEl));
            }

            $(itextBlock).children().each(eachLang);
            formdesigner.currentItextDisplayLanguage = formdesigner.model.Itext.getDefaultLanguage();
        }

        formdesigner.controller.resetParseErrorMsgs();

        formdesigner.controller.fire('parse-start');
        try{
            var xmlDoc = $.parseXML(xmlString),
                xml = $(xmlDoc),
                binds = xml.find('bind'),
                data = xml.find('instance').children(),
                controls = xml.find('h\\:body').children(),
                itext = xml.find('itext'),
                formID, formName,
                    title;

            xml.find('instance').children().each(function () {
                formID = this.nodeName;
            });

            title = xml.find('title');
            if(title.length === 0) {
                title = xml.find('h\\:title');
            }

            if(title.length > 0) {
                title = $(title).text();
                formdesigner.controller.form.formName = title;
            }


            if(data.length === 0) {
                pError('error', 'No Data block was found in the form.  Please check that your form is valid!');
            }
            parseInstanceInfo(data[0]);
            parseDataTree (data[0]);
            parseBindList (binds);

            if(controls.length === 0) {
                controls = xml.find('body').children();
            }
            parseItextBlock(itext);
            parseControlTree (controls);


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
                oIsItemOrInputOrTrigger = (oType === 'item' || oType === 'input' || oType === 'trigger' || oType === 'secret'),
                oIsSelect = (oType === 'select1' || oType === 'select'),
                oIsItem = (oType === 'item'),
                rIsSelect = (rType === 'select1' || rType === 'select'),
                rIsItemOrInputOrTrigger = (rType === 'item' || rType === 'input' || rType === 'trigger' || rType === 'secret'),
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

        return data;
    }


    var sendXForm = function (url) {
        function successFunc () {
            formdesigner.ui.FormSaved = true;
            formdesigner.ui.hideConfirmDialog;
        }
        if (!url) {
            url = formdesigner.saveUrl;
        }
        if (!url) {
            formdesigner.ui.setDialogInfo("Error: Cannot send form, no save url specified!",
            'OK', function () {
                        $ (this) .dialog("close");
                    },
            'Cancel', function () {
                        $ (this) .dialog("close");
            });
        }
        $('body').ajaxStart(formdesigner.ui.showWaitingDialog);
        $('body').ajaxStop(formdesigner.ui.hideConfirmDialog);

        formdesigner.XFORM_STRING = form.createXForm();
        jQuery.post(url, {xform: formdesigner.XFORM_STRING}, successFunc);


    }
    that.sendXForm = sendXForm;

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