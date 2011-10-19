if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.controller = (function () {
    "use strict";
    var that = {},
        curSelMugType = null,
        curSelUfid = null,

    initFormDesigner = function () {
        formdesigner.util.question_counter = 1;
        curSelMugType = null;
        curSelUfid = null;
        // ui.questionTree.empty();
        // ui.dataTree.empty();
        $('#fd-data-tree').empty();

        formdesigner.model.init();
        formdesigner.ui.init();
        formdesigner.currentItextDisplayLanguage = formdesigner.model.Itext.getDefaultLanguage();
    };
    that.initFormDesigner = initFormDesigner;
    
    var setForm = that.setForm = function (aForm) {
        that.form = aForm;
    };

    var getMTFromFormByUFID = function (ufid) {
        curSelMugType = that.form.dataTree.getMugTypeFromUFID(ufid);
        if (!curSelMugType) { //check controlTree in case it's there.
            curSelMugType = that.form.controlTree.getMugTypeFromUFID(ufid);
        }
        return curSelMugType;
    };
    that.getMTFromFormByUFID = getMTFromFormByUFID;

    /**
     * Walks through both internal trees (data and control) and grabs
     * the Itext id's from any Mugs that are found.  Returns
     * a flat list of iIDs.  This list is primarily used
     * for trimming out crufty itext.  See also
     * formdesigner.model.Itext.removeCruftyItext()
     */
    var getListOfItextIDsFromMugs = function () {
        var cTree, dTree, treeFunc, thingToGet, cLists=[], dLists=[], mergeLists = [], finalList;
        //use formdesigner.util.mergeArray

        treeFunc = function (node) {
            var mt;
            if(node.isRootNode) {
                return;
            }

            mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!'
            }

            if (mt.mug.properties.controlElement) {
                return mt.mug.properties.controlElement.properties[thingToGet];
            }


        }

        cTree = that.form.controlTree;
        dTree = that.form.dataTree;

        thingToGet = 'labelItextID'; //get all the labelItextIDs
        cLists[0] = cTree.treeMap(treeFunc);
        dLists[0] = dTree.treeMap(treeFunc);

        thingToGet = 'hintItextID'; //get all the hintItextIDs
        cLists[1] = cTree.treeMap(treeFunc);
        dLists[1] = dTree.treeMap(treeFunc);

        mergeLists[0] = formdesigner.util.mergeArray(cLists[0],dLists[0]); //strip dupes and merge
        mergeLists[1] = formdesigner.util.mergeArray(cLists[1],dLists[1]); //strip dupes and merge

        finalList = formdesigner.util.mergeArray(mergeLists[0], mergeLists[1]); //merge mergers (and strip dupes ;) )

        return finalList; //give it all back

    }
    that.getListOfItextIDsFromMugs = getListOfItextIDsFromMugs;

    /**
     * Walks through both internal trees (data and control) and grabs
     * all mugTypes that are not (1)Select Items.  Returns
     * a flat list of unique mugTypes.  This list is primarily fo the
     * autocomplete skip logic wizard.
     */
    var getListMugTypesNotItems = function () {
        var cTree, dTree, treeFunc, cList, dList, mergeList;
        //use formdesigner.util.mergeArray

        treeFunc = function (node) {
            var mt;
            if(node.isRootNode) {
                return;
            }

            mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!'
            }

            if(mt.typeName === "Select Item") { //skip Select Items
                return;
            }

            return mt;
        }

        cTree = that.form.controlTree;
        dTree = that.form.dataTree;

        cList = cTree.treeMap(treeFunc);
        dList = dTree.treeMap(treeFunc);

        mergeList = formdesigner.util.mergeArray(cList, dList); //strip dupes and merge

        return mergeList; //give it all back

    }
    that.getListMugTypesNotItems = getListMugTypesNotItems;


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
     * Function for triggering a clean out of the itext
     * where all ids + itext data are removed that are
     * found to not be linked to any element in the form.
     *
     * Toggles the ui spinner (this operation could take a few seconds).
     */
    var removeCruftyItext = function () {
        //show spinner
        $.fancybox.showActivity();

        var validIds = that.getListOfItextIDsFromMugs();
        formdesigner.model.Itext.removeCruftyItext(validIds);

        //hide spinner
        $.fancybox.hideActivity();
    }
    that.removeCruftyItext = removeCruftyItext;

    /**
     * Inserts a new MugType into the relevant Trees (and their
     * relevant positions) according to the specified mugType and
     * the currently selected mugType.
     * @param newMugType - new MT to be inserted into the Form object
     * @param refMugType - used to determine the relative position of the insertion (relative to the refMT)
     */
    var insertMugTypeIntoForm = function (refMugType, newMugType) {
        var dataTree = that.form.dataTree, controlTree = that.form.controlTree;

        if (newMugType.properties.dataElement) {
            if (newMugType.properties.controlElement) {
                dataTree.insertMugType(newMugType, formdesigner.util.getRelativeInsertPosition(refMugType, newMugType), refMugType);
            } else { //no control node so getting a dynamic relative position is hard/impossible.  We default to 'after' until a user complains.
                dataTree.insertMugType(newMugType, 'after', refMugType);
            }
        }

        if (newMugType.properties.controlElement) {
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
        var tree, treeFunc, loaderFunc, dataNodeList, i;

        //first clear out the existing UI
        formdesigner.ui.resetUI();
        that.setCurrentlySelectedMugType(null);


        treeFunc = function (node) {
            var mt;
            if(node.isRootNode) {
                return;
            }

            mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!'
            }

            loaderFunc(mt);


        }
        loaderFunc = that.loadMugTypeIntoUI
        tree = that.form.controlTree;
        tree.treeMap(treeFunc);

        loaderFunc = that.loadMugTypeIntoDataUITree
        tree = that.form.dataTree;
        tree.treeMap(treeFunc);

        //get list of pure data nodes and throw them in the Question UI tree (at the bottom)
        dataNodeList = that.getDataNodeList();
        for (i in dataNodeList) {
            if (dataNodeList.hasOwnProperty(i)) {
                that.loadMugTypeIntoUI(dataNodeList[i]);
            }
        }


        formdesigner.ui.setTreeValidationIcons();

        that.fire('fd-reload-ui');

    }

    that.reloadUI = reloadUI;



    /**
     * Goes through and grabs all of the data nodes (i.e. nodes that are only data nodes (possibly with a bind) without any
     * kind of control.  Returns a flat list of these nodes (list items are mugTypes).
     */
    that.getDataNodeList = function(){
        var treeFunc = function(node){ //the function we will pass to treeMap
            if(!node.getValue() || node.isRootNode){
                return null;
            }
            var MT = node.getValue();

            if(MT.properties.controlElement){
                return null;
            }else{
                return MT;
            }
        };

        return  that.form.dataTree.treeMap(treeFunc);
    }

    var showErrorMessage = function (msg) {
//        formdesigner.ui.appendErrorMessage(msg);
        
    };
    that.showErrorMessage = showErrorMessage;

    function createQuestionInUITree(mugType) {
        function treeSetItemType(mugType) {
            var tString = mugType.mug.properties.controlElement ? mugType.mug.properties.controlElement.properties.name.toLowerCase() : 'data',
                setType = function (tType) {
                    var controlTree = $('#fd-question-tree'),
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
                case 'data':
                    setType('dataNode');
                    break;


            }
        }

        var mug = mugType.mug,
            controlTagName = mug.properties.controlElement ? mug.properties.controlElement.properties.tagName : null,
            isGroupOrRepeat = (controlTagName === 'group' || controlTagName === 'repeat'),
            objectData = {},
            insertPosition,
            oldSelected;

        oldSelected = that.curSelMugType;
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
        if (mug.properties.controlElement) {
            insertPosition = formdesigner.util.getRelativeInsertPosition(that.curSelMugType,mugType);
        } else {
            formdesigner.ui.getQuestionJSTree().jstree("deselect_all");
            insertPosition = "last";
        }
        
        $('#fd-question-tree').jstree("create",
            null, //reference node, use null if using UI plugin for currently selected
            insertPosition, //position relative to reference node
            objectData,
            null, //callback after creation, better to wait for event
            true  //skip_rename
        );

        treeSetItemType(mugType);

        formdesigner.ui.getQuestionJSTree().jstree("select_node", $('#' + oldSelected));
    }

    function createQuestionInDataTree(mugType) {
        function treeSetItemType(mugType) {
            var mugTUfid = mugType.ufid,
                node = $('#' + mugTUfid + "_data");
            $('#fd-data-tree').jstree("set_type","default",node);
        }

        var mug = mugType.mug,
            objectData = {},
            insertPosition, curSelMugElData, curSelMugElQuestion, oldSelectedMugEl;

        if (!mugType.properties.dataElement) { //this mug doesn't have a data node so shouldn't be included.
            return;
        }

        objectData.state = 'open'; //should new node be open or closed?, omit for leaf
        objectData.data = formdesigner.util.getDataMugDisplayName(mugType);
        objectData.metadata = {
                                'mugTypeUfid': mugType.ufid,
                                'mugUfid': mug.ufid,
                                'dataID':mug.getDataElementID(),
                                'bindID':mug.getBindElementID()
                                };
        objectData.attr = {
            "id" : mugType.ufid + "_data"
        };

//        insertPosition = formdesigner.util.getRelativeInsertPosition(curSelMugType,mugType);
        insertPosition = "into"; //data nodes can always have children.

        if (curSelMugType) {
            curSelMugElData = $('#' + curSelMugType.ufid + '_data') //get corresponding Data Element
            oldSelectedMugEl = curSelMugElData;
            curSelMugElQuestion = ('#' + curSelMugType.ufid); //remember what is selected in the question tree.
            if (curSelMugElData.length === 0) {
                var curParent = that.form.controlTree.getParentMugType()
                if(curParent) {
                    curSelMugElData = $('#' + curParent.ufid + '_data');
                } else { //parent is root of tree
                    curSelMugElData = null;
                }
            }

            if (curSelMugElData) {
                formdesigner.ui.getDataJSTree().jstree('select_node', curSelMugElData);
            } else {
                formdesigner.ui.getDataJSTree().jstree('deselect_all');
            }
        }else {
            //nothing selected
            curSelMugElData = null;
            formdesigner.ui.getDataJSTree().jstree('deselect_all');
        }

        $('#fd-data-tree').jstree("create",
            null, //reference node, use null if using UI plugin for currently selected
            insertPosition, //position relative to reference node
            objectData,
            null, //callback after creation, better to wait for event
            true  //skip_rename
        );

        treeSetItemType(mugType);

        //if we're in question view mode, select the node that was previously selected in the question tree.
        if(!formdesigner.ui.isInDataViewMode()) {
            formdesigner.ui.getDataJSTree().jstree('deselect_all');
            formdesigner.ui.getQuestionJSTree().jstree('select_node', curSelMugElQuestion);
        } else { //if not, select what was originally selected in the data tree
           formdesigner.ui.getQuestionJSTree().jstree('deselect_all');
            formdesigner.ui.getDataJSTree().jstree('select_node', oldSelectedMugEl);
        }
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
            case 'datanode':
                mugType = formdesigner.model.mugTypeMaker.stdDataBindOnly();
                break;
            default:
                console.log("No standard mugType for selected question type:" + qType + " switching to 'Text Question' type!");
                mugType = formdesigner.model.mugTypeMaker.stdTextQuestion();
        }

        mug = mugType.mug;

        //this allows the mug to respond to certain events in a common way.
        //see method docs for further info
        formdesigner.util.setStandardMugEventResponses(mug);


        var oldSelected = that.curSelMugType;
        var isDataNodeSelected = that.curSelMugType && !that.curSelMugType.properties.controlElement;
        if (isDataNodeSelected) {
            //select the lowest not-data-node and continue
            var tmpSelector = formdesigner.ui.getQuestionJSTree().find('li[rel!="dataNode"]');
            if (tmpSelector.length > 0) {
                var newSelectEl = $(tmpSelector[tmpSelector.length - 1]);
                formdesigner.ui.getQuestionJSTree().jstree("select_node", newSelectEl, false);
            } else {
                formdesigner.ui.getQuestionJSTree().jstree("deselect_all");
                that.curSelMugType = null;
                that.curSelUfid = null;
            }
        }
        insertMugTypeIntoForm(that.curSelMugType,mugType);
        createQuestionInUITree(mugType);
        createQuestionInDataTree(mugType);
        createQuestionEvent.type = "question-creation";
        createQuestionEvent.mugType = mugType;
        this.fire(createQuestionEvent);


        //re-select what was originally selected at the start of this method (which gets changed when dealing with Data Nodes)
        if (isDataNodeSelected) {
            formdesigner.ui.getQuestionJSTree().jstree("deselect_all");
            formdesigner.ui.getQuestionJSTree().jstree("select_node", $('#' + oldSelected.ufid));
        }

        return mug;

    };
    that.createQuestion = createQuestion;

    var loadMugTypeIntoUI = function (mugType) {
        var mug, controlTree, parentMT, parentMTUfid, loadMTEvent = {};

        mug = mugType.mug;

        //this allows the mug to respond to certain events in a common way.
        //see method docs for further info
//        formdesigner.util.setStandardMugEventResponses(mug);

        //set the 'currently selected mugType' to be that of this mugType's parent.
        controlTree = that.form.controlTree;
        parentMT = controlTree.getParentMugType(mugType);
        if(parentMT && mugType.properties.controlElement){ //check for control element because we want data nodes to be a flat list at bottom.
            parentMTUfid = parentMT.ufid;
            $('#fd-question-tree').jstree('select_node',$('#'+parentMTUfid), true);
        }else{
            parentMTUfid = null;
            $('#fd-question-tree').jstree('deselect_all');
        }
        createQuestionInUITree(mugType);
        loadMTEvent.type= "mugtype-loaded";
        loadMTEvent.mugType = mugType;
        formdesigner.controller.fire(loadMTEvent);

        return mug;
    }
    that.loadMugTypeIntoUI = loadMugTypeIntoUI;


    var loadMugTypeIntoDataUITree = function (mugType) {
        var mug, dataTree, parentMT, parentMTUfid, loadMTEvent = {};

        mug = mugType.mug;

        //this allows the mug to respond to certain events in a common way.
        //see method docs for further info
//        formdesigner.util.setStandardMugEventResponses(mug);

        //set the 'currently selected mugType' to be that of this mugType's parent.
        dataTree = formdesigner.controller.form.dataTree;
        parentMT = dataTree.getParentMugType(mugType);
        if(parentMT){
            parentMTUfid = parentMT.ufid;
            $('#fd-data-tree').jstree('select_node',$('#'+parentMTUfid + '_data'), true);
        }else{
            parentMTUfid = null;
            $('#fd-data-tree').jstree('deselect_all');
        }

        createQuestionInDataTree(mugType);
        loadMTEvent.type= "mugtype-loaded";
        loadMTEvent.mugType = mugType;
        formdesigner.controller.fire(loadMTEvent);

        return mug;
    }
    that.loadMugTypeIntoDataUITree = loadMugTypeIntoDataUITree;

    that.XMLWriter = null;
    var initXMLWriter = function () {
        var xw = new XMLWriter( 'UTF-8', '1.0' );
        xw.writeStartDocument();
        that.XMLWriter = xw;
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
            if(that.XFORM_STRING){
                output.val(that.XFORM_STRING);
                $('#inline').click();
            }
        }

        // There are validation errors but user continues anyway
        function onContinue () {
            that.XFORM_STRING = that.form.createXForm();
            formdesigner.ui.hideConfirmDialog();
            showFormInLightBox();

        }

        function onAbort () {
            that.XFORM_STRING = null;
            formdesigner.ui.hideConfirmDialog();
        }

        var msg = "There are validation errors in the form.  Do you want to continue anyway? WARNING:" +
            "The form will not be valid and likely not perform correctly on your device!";

        formdesigner.ui.setDialogInfo(msg,'Continue',onContinue,'Abort',onAbort);
        if (!that.form.isFormValid()) {
            formdesigner.ui.showConfirmDialog();
        } else {
            that.XFORM_STRING = that.form.createXForm();
            showFormInLightBox();
        }
        return that.XFORM_STRING;
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
            $.fancybox.close();
            that.loadXForm(input.val());
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

    var showLoadItextFromClipboard = function (){
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
            that.parseXLSItext(input.val());
            $.fancybox.close();
            $(this).remove();
        });

    };
    that.showLoadItextFromClipboard = showLoadItextFromClipboard;

    var showGeneratedItextXLS = function () {
        var source = $('#fd-source');

        source.val(that.generateItextXLS());

        $('#inline').click();
        

    };
    that.showGeneratedItextXLS = showGeneratedItextXLS;

    var setFormName = function (name) {
        that.form.formName = name;
    };
    that.setFormName = setFormName;

    var loadXForm = function (formString) {
        $.fancybox.showActivity();
        window.setTimeout(function () { //wait for the spinner to come up.
            formdesigner.fire({
                    type: 'load-form-start',
                    form : formString
            });

            try {
                that.resetFormDesigner();
                that.parseXML(formString);
                that.reloadUI();
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
            $.fancybox.hideActivity();
        },
        500);

    }
    that.loadXForm = loadXForm;


    var removeMugTypeByUFID = function (ufid) {
        var MT = that.form.getMugTypeByUFID(ufid);
        that.removeMugTypeFromForm(MT);
    }
    that.removeMugTypeByUFID = removeMugTypeByUFID;

    var removeMugTypeFromForm = function (mugType) {
        formdesigner.ui.removeMugTypeFromUITree(mugType);
        that.form.dataTree.removeMugType(mugType);
        that.form.controlTree.removeMugType(mugType);
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
        pError = that.addParseErrorMsg;
        getPErros = that.getParseErrorMsgs;
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
                    dataTree = that.form.dataTree,
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
                    parentMugType = that.form.getMugTypeByIDFromTree(parentNodeName,'data')[0];
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
            that.form.formID = $(root)[0].tagName;
            
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

                oldMT = that.form.getMugTypeByIDFromTree(nodeID, 'data')[0];
                if(!oldMT && attrs.nodeset) {
                    oldMT = that.form.getMugTypeByIDFromTree(
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

                that.form.replaceMugType(oldMT, mType, 'data');
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
                    var oldMT = that.form.getMugTypeByIDFromTree(nodeID, 'data')[0], //check the date node to see if there's a related MT already present
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
                        that.form.replaceMugType(oldMT,mugType,'data');
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
                        } else {
                            labelRef = formdesigner.util.getNewItextID(MT, false); //assumes this is always successful
                        }
                        formdesigner.util.setOrRenameItextID(labelRef,MugType,'labelItextID');

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
                    that.form.controlTree.insertMugType(MugType,'into',parentMT);
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
                    parentMug = that.form.getMugTypeByIDFromTree(parentNodeID,'control')[0];
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
                var el = $ (this) ,defaultExternalLang;
                curLanguage = el.attr('lang');
                Itext.addLanguage(curLanguage);
                if(el.attr('default') !== undefined) {
                    Itext.setDefaultLanguage(curLanguage);
                }

                //if we were passed a list of languages (in order of preference from outside)...
                if(formdesigner.opts["langs"]) {
                    //grab the default language.
                    if(formdesigner.opts["langs"].length > 0) { //make sure there are actually entries in the list
                        defaultExternalLang = formdesigner.opts["langs"][0];
                        Itext.setDefaultLanguage(defaultExternalLang); //set the form default to the one specified in initialization options.
                    }
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

        that.resetParseErrorMsgs();

        that.fire('parse-start');
        try{
                var xmlDoc = $.parseXML(xmlString),
                    xml = $(xmlDoc),
                    binds = xml.find('bind'),
                    data = xml.find('instance').children(),
                    controls = xml.find('h\\:body').children(),
                    itext = xml.find('itext'),
                    formID, formName,
                        title;


            if($(xml).find('parsererror').length > 0) {
                throw 'PARSE ERROR! Message follows:' + $(xml).find('parsererror').find('div').html();
            }
            xml.find('instance').children().each(function () {
                formID = this.nodeName;
            });

            title = xml.find('title');
            if(title.length === 0) {
                title = xml.find('h\\:title');
            }

            if(title.length > 0) {
                title = $(title).text();
                that.form.formName = title;
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


            that.fire({
                type: 'parse-finish'
            });



        } catch (e) {
            that.fire({
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
//                throw "If refMugType is null in checkMoveOp() position MUST be 'into'! Position was: "+position;
                return true;
            }

            var pRefMugType = that.form.controlTree.getParentMugType(refMugType);
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
     * @param treeType - Optional - either 'data' or 'control' or 'both'. Indicates which tree to do the move op in.  defaults to 'both'
     */
    var moveMugType = function (mugType, position, refMugType, treeType) {
        var dataTree = that.form.dataTree, controlTree = that.form.controlTree;
        if (!treeType) {
             treeType = 'both';
        }
        if (!checkMoveOp(mugType, position, refMugType, treeType)) {
            throw 'MOVE NOT ALLOWED!  MugType Move for MT:' + mugType + ', refMT:' + refMugType + ", position:" + position + " ABORTED";
        }

        if (treeType === 'both') {
            dataTree.insertMugType(mugType, position, refMugType);
            controlTree.insertMugType(mugType, position, refMugType);
        } else if (treeType === 'control') {
            controlTree.insertMugType(mugType, position, refMugType);
        } else if (treeType === 'data') {
            dataTree.insertMugType(mugType, position, refMugType);
        } else {
           throw 'Invalid/Unrecognized TreeType specified in moveMugType: ' + treeType;
        }
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
     * Returns the Tree Model object specified by treeType from the Form object
     * @param treeType - string - either 'data' or 'control'
     */
    var getTree = function getTree(treeType) {
        if (treeType === 'data') {
            return that.form.dataTree;
        }else if (treeType === 'control') {
            return that.form.controlTree;
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

        formdesigner.XFORM_STRING = that.form.createXForm();
        jQuery.post(url, {xform: formdesigner.XFORM_STRING}, successFunc);


    }
    that.sendXForm = sendXForm;

    /**
     * Used to reset the state of the controller if a FD wide reset is called
     * (see resetFormDesigner)
     */
    function resetControllerInternal () {
            formdesigner.util.question_counter = 1;
            //reset Options passed in to the initializer
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
    
    // tree drag and drop stuff, used by xpath
    var handleTreeDrop = function(source, target) {
        var target = $(target), sourceUid = $(source).attr("id");
        if (target.hasClass("xpath-edit-node")) {
            var mug = that.form.getMugTypeByUFID(sourceUid);
            var path = formdesigner.controller.form.dataTree.getAbsolutePath(mug);
            target.val(path);                
        }
    };
    that.handleTreeDrop = handleTreeDrop;
    
    // here is the xpath stuff
    var displayXPathEditor = function(options) {
        formdesigner.ui.hideQuestionProperties();
        formdesigner.ui.hideTools();
        formdesigner.ui.showXPathEditor(options);
    };
    that.displayXPathEditor = displayXPathEditor;
    
    var doneXPathEditor = function(options) {
        var mug = that.getCurrentlySelectedMugType();
        mug.mug.properties[options.group].properties[options.property] = options.value;
        formdesigner.ui.hideXPathEditor();
        formdesigner.ui.showTools();
        formdesigner.ui.displayMugProperties(mug);
    };
    that.doneXPathEditor = doneXPathEditor;
    
    
    //make controller event capable
    formdesigner.util.eventuality(that);

    return that;
})();