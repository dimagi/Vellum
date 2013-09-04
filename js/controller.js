if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.controller = (function () {
    "use strict";
    var that = {},
        DEBUG_MODE = false,
        FORM_SAVED = true,
        saveButton = SaveButton.init({
            save: function() {
                that.validateAndSaveXForm();
            },
            unsavedMessage: 'Are you sure you want to exit? All unsaved changes will be lost!'
        });
    that.saveButton = saveButton;
    
    var initFormDesigner = function () {
        xpathmodels.DEBUG_MODE = DEBUG_MODE;
        formdesigner.util.question_counter = 1;
        
        formdesigner.model.init();
        formdesigner.ui.init();
        that.setCurrentlySelectedMugType(null);
        
        if (formdesigner.opts.langs && formdesigner.opts.langs.length > 0) {
            // override the languages with whatever is passed in
            for (var i = 0; i < formdesigner.opts.langs.length; i++) {
                formdesigner.model.Itext.addLanguage(formdesigner.opts.langs[i]);
            }
            formdesigner.model.Itext.setDefaultLanguage(formdesigner.opts.langs[0]);
        } else if (formdesigner.model.Itext.languages.length === 0) {
            formdesigner.model.Itext.addLanguage("en");
        }
        
        formdesigner.currentItextDisplayLanguage = formdesigner.opts.displayLanguage ||
                                                   formdesigner.model.Itext.getDefaultLanguage();

        // fetch language names
        formdesigner.langCodeToName = {};
        _.each(formdesigner.opts.langs, function(langcode) {
            $.getJSON('/langcodes/langs.json', {term: langcode}, function(res) {
                if (res.length >= 1) {
                    formdesigner.langCodeToName[res[0].code] = res[0].name;
                    that.fire('fd-update-language-name');
                }
            });
        });
        
        that.on('question-creation', function () {
           that.setFormChanged(); //mark the form as 'changed'
        });

        
        that.on('question-itext-changed', function () {
            that.setFormChanged();
        });

        that.on('parse-start', function () {
            that.resetParseErrorMsgs();
            that.resetParseWarningMsgs();
        });
        
        that.on('parse-finish', function () {
            // wire the event handlers for all the mugs in the tree
            var allMugs = that.getMugTypeList(true);
            allMugs.map(function (mt) {
                formdesigner.util.setStandardMugEventResponses(mt.mug);
            });

            var i;
            // update parse error and warn information in the model/UI
            if (that.parseErrorMsgs) {
                for (i = 0; i < that.parseErrorMsgs.length; i++) {
                    that.form.updateError(formdesigner.model.FormError({
                        level: "error",
                        message: that.parseErrorMsgs[i]
                    }));
                }
            }

            if (that.parseWarningMsgs) {
                for (i = 0; i < that.parseWarningMsgs.length; i++) {
                    that.form.updateError(formdesigner.model.FormError({
                        level: "parse-warning",
                        message: that.parseWarningMsgs[i]
                    }));
                }
            }
            formdesigner.ui.resetMessages(that.form.errors);
            
            // populate the LogicManager with initial path data
            allMugs.map(formdesigner.model.LogicManager.updateAllReferences);
        });
        
        that.on('parse-error', function (e) {
            if(DEBUG_MODE) {
                console.log('There was a parse error:', e);
            }
        });

    };
    that.initFormDesigner = initFormDesigner;

    that.setFormChanged = function () {
        saveButton.fire('change');
    };

    that.isFormSaved = function () {
        return saveButton.state === "saved";
    };
    
    that.setForm = function (aForm) {
        that.form = aForm;
        formdesigner.util.setStandardFormEventResponses(that.form);
    };


    /**
     * Walks through both internal trees (data and control) and grabs
     * the Itext id's from any Mugs that are found.  Returns
     * a flat list of iIDs.  This list is primarily used
     * for trimming out crufty itext.  See also
     * formdesigner.model.Itext.removeCruftyItext()
     */
    var getAllNonEmptyItextItemsFromMugs = function () {
        
        // get all the itext references in the forms
        var ret = [];
        var appendItemsIfPresent = function (node) {
            if (node.isRootNode) {
                return;
            }

            var mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!'
            }
            
            var thingsToGet = ['controlElement/labelItextID', 'controlElement/hintItextID', 
                               'bindElement/constraintMsgItextID'] ; 
        
            var val;            
            for (var i = 0; i < thingsToGet.length; i++) {
	            try {
	                val = mt.getPropertyValue(thingsToGet[i]);
	                if (val && !val.isEmpty() && ret.indexOf(val) === -1) {
	                   // it was there and not present so add it to the list
	                   ret.push(val);
	                } 
	            } catch (err) {
	                // probably just wasn't in the mug
	            }
            }    
        };
        
        that.form.controlTree.treeMap(appendItemsIfPresent);
        that.form.dataTree.treeMap(appendItemsIfPresent);
        return ret; 

    };
    that.getAllNonEmptyItextItemsFromMugs = getAllNonEmptyItextItemsFromMugs;

    /**
     * Returns a MugType NOT a Mug!
     * @param path - String of path you want
     * @param tree - [OPTIONAL] Type of tree, 'control' or 'data'.  Defaults to 'data'
     */
    var getMugTypeByPath = function (path, tree) {
        var recFunc, tokens, targetMT, rootNode;
        if (!tree) {
            tree = 'data';
        }

        if(!path) { //no path specified
            return null;
        }


        recFunc = function (node, recTokens) {
            var currentToken, rest, children, i;
            if (recTokens.length === 0) {
                return node.getValue(); //found the target. It is this node.
            }
            currentToken = recTokens[0];
            rest = recTokens.slice(1);
            children = node.getChildren();

            for (i in children) {
                if(children.hasOwnProperty(i)) {
                    if (children[i].getID() === currentToken) {
                        return recFunc(children[i], rest);
                    }
                }
            }

            //if we got here that means 'path not found'
            return null;

        };

        tokens = path.split('/').slice(1);
        if (tokens.length === 0) {
            return null; //empty path string === 'path not found'
        }

        if (tree === 'data') {
            rootNode = that.form.dataTree.getRootNode();

        } else if (tree === 'control') {
            rootNode = that.form.controlTree.getRootNode();
        }

        if(rootNode.getID() !== tokens[0]) {
            return null; //path not found
        }

        targetMT = recFunc(rootNode,tokens.slice(1));
        return targetMT;
    };
    that.getMugByPath = getMugTypeByPath;
    
    var getSingularMugTypeByNodeId = function (nodeId, treeType) {
        if (!treeType) {
            treeType = 'data';
        }

        if(!nodeId) { //no path specified
            return null;
        }
        
        var nodeMatches = function (node) {
            var mt = node.getValue();
            return (mt && mt.mug && mt.mug.getBindElementID() === nodeId) ? mt : null;
        };
        
        var tree = (treeType === "data") ? that.form.dataTree : that.form.controlTree;
        var matchList = tree.treeMap(nodeMatches).filter(function (m) { return m !== null; });
        if (matchList.length !== 1) {
            throw "Expected one result for node " + nodeId + " but found " + matchList.length;
        }
        return matchList[0];
    };
    that.getSingularMugTypeByNodeId = getSingularMugTypeByNodeId;
    
    that.getChildren = function (mugType) {
        var node = that.form.controlTree.getNodeFromMugType(mugType),
            children = node ? node.getChildren() : [];  // handles data node
        return children.map(function (item) { return item.getValue();});
    };
    
    /**
     * Walks through both internal trees (data and control) and grabs
     * all mugTypes that are not (1)Choices.  Returns
     * a flat list of unique mugTypes.  This list is primarily fo the
     * autocomplete skip logic wizard.
     */
    that.getMugTypeList = function (includeSelectItems) {
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

            if(mt.typeSlug === "stdItem" && !includeSelectItems) { //skip Choices
                return;
            }

            return mt;
        };

        cTree = that.form.controlTree;
        dTree = that.form.dataTree;

        cList = cTree.treeMap(treeFunc);
        dList = dTree.treeMap(treeFunc);

        return formdesigner.util.mergeArray(cList, dList); //strip dupes and merge
    };

    /**
     * @param myMug - the mug thats value needs to be set
     * @param element can be one of (string) 'bind','data','control'
     * @param property (string) property name
     * @param val new value the property should be set to.
     */
    that.setMugPropertyValue = function (myMug, element, property, val, mugType) {
        var prev = myMug.properties[element].properties[property];
        myMug.properties[element].properties[property] = val;
        myMug.fire({
			type: 'property-changed',
			property: property,
			element: element,
			val: val,
			previous: prev,
			mugUfid: myMug.ufid,
			mugTypeUfid: mugType.ufid
        });
    };

    /**
     * Function for triggering a clean out of the itext
     * where all ids + itext data are removed that are
     * found to not be linked to any element in the form.
     *
     * Toggles the ui spinner (this operation could take a few seconds).
     */
    var removeCruftyItext = function () {
        var validIds = that.getAllNonEmptyItextItemsFromMugs();
        formdesigner.model.Itext.resetItextList(validIds);
    };
    that.removeCruftyItext = removeCruftyItext;

    /**
     * Inserts a new MugType into the relevant Trees (and their
     * relevant positions) according to the specified mugType and
     * the currently selected mugType.
     * @param newMugType - new MT to be inserted into the Form object
     * @param refMugType - used to determine the relative position of the insertion (relative to the refMT)
     * @param position - the position to use (default: auto)
     */
    that.insertMugTypeIntoForm = function (refMugType, newMugType, position) {
        var dataTree = that.form.dataTree,
            controlTree = that.form.controlTree;

        if (newMugType.hasDataElement() && !newMugType.hasControlElement()) {
            // data node, stick it at the end of the form by default
            dataTree.insertMugType(newMugType, 'after', null);
            return;
        }
        
        position = position || "into";

        if (newMugType.hasDataElement()) {
            dataTree.insertMugType(newMugType, position, refMugType);
        }

        if (newMugType.hasControlElement()) {
            controlTree.insertMugType(newMugType, position, refMugType);
        }
    };

    /**
     * Controller internal function.  Goes through
     * the internal data model and reloads the UI trees
     * and whatever other widgets need refreshing in order
     * for the user to start the editing process.
     */
    that.reloadUI = function () {
        // monkey patch jstree.create to be faster, see
        // https://groups.google.com/d/msg/jstree/AT8b9fWdBw8/SB3bXFwYbiQJ
        // Patching clean_node as described in the above link actually seems to
        // lead to a slight decrease in speed, and also messes up the
        // collapsibility of internal nodes, so we don't do that.
        
        var get_rollback = $.jstree._fn.get_rollback;
        $.jstree._fn.get_rollback = function(){};

        var treeFunc, dataNodeList;
        that.setCurrentlySelectedMugType(null);

        formdesigner.ui.skipNodeSelectEvent = true;
        treeFunc = function (node) {
            var mt;
            if(node.isRootNode) {
                return;
            }

            mt = node.getValue();
            if(!mt) {
                throw 'Node in tree without value?!?!';
            }
            that.loadMugTypeIntoUI(mt);
        };

        that.form.controlTree.treeMap(treeFunc);
        //get list of pure data nodes and throw them in the Question UI tree (at the bottom)
        dataNodeList = that.getDataNodeList();
        for (var i = 0; i < dataNodeList.length; i++) {
            that.loadMugTypeIntoUI(dataNodeList[i]);
        }
        formdesigner.ui.setAllTreeValidationIcons();
        formdesigner.ui.skipNodeSelectEvent = false;
        formdesigner.ui.selectSomethingOrResetUI(true);
        that.fire('fd-reload-ui');

        // restore original jstree behavior
        $.jstree._fn.get_rollback = get_rollback;

    };

    /**
     * Goes through and grabs all of the data nodes (i.e. nodes that are only data nodes (possibly with a bind) without any
     * kind of control.  Returns a flat list of these nodes (list items are mugTypes).
     */
    that.getDataNodeList = function () {
        var treeFunc = function(node){ //the function we will pass to treeMap
            if (!node.getValue() || node.isRootNode) {
                return null;
            }
            var MT = node.getValue();

            if(MT.properties.controlElement) {
                return null;
            } else {
                return MT;
            }
        };

        return  that.form.dataTree.treeMap(treeFunc);
    };

    /**
     * Create a new node from mugType relative to the currently selected node.
     *
     * @param mugType - MugType to insert into tree
     * @param position (optional)
     * @return  - node object on success or false on failure (when you attempt
     *   invalid nesting with respect to node types)
     */
    that.createQuestionInUITree = function (mugType, position) {
        var mug = mugType.mug,
            controlTagName = mug.properties.controlElement ? mug.properties.controlElement.properties.tagName : null,
            isGroupOrRepeat = (controlTagName === 'group' || controlTagName === 'repeat'),
            objectData, insertPosition;

        if (mug.properties.controlElement) {
            insertPosition = position || "into";
        } else {
            // data node
            
            formdesigner.ui.jstree("deselect_all");
            insertPosition = "last";
        }

        objectData = {
            data: formdesigner.util.getMugDisplayName(mugType),
            metadata: {
                mugTypeUfid: mugType.ufid,
                mugUfid: mug.ufid,
                dataID: mug.getDataElementID(),
                bindID: mug.getBindElementID()
            },
            attr: {
                id: mugType.ufid,
                rel: mugType.typeSlug
            },
            state: isGroupOrRepeat ? 'open' : undefined
        };

        var oldSelected = that.getCurrentlySelectedMugType();

        var result = formdesigner.ui.jstree("create",
            null,
            insertPosition,
            objectData,
            null, // callback
            true  // skip_rename
        );

        // jstree.create returns the tree root if types prevent creation
        var success = result && result[0].id !== formdesigner.ui.QUESTION_TREE_DIV;  

        if (success && oldSelected) {
            formdesigner.ui.jstree("select_node", '#' + oldSelected.ufid);
        }

        return success;
    };

    that.getMugTypeByQuestionType = function (qType) {
        if (!formdesigner.model.mugTypeMaker.hasOwnProperty(qType)) {
            qType = 'stdTextQuestion';
        }
        var mugType = formdesigner.model.mugTypeMaker[qType]();
        mugType.typeSlug = qType; 
        mugType.mug.typeSlug = qType;
        return mugType;
    };

    /**
     * Convenience method for generating mug and mugType, calling UI and throwing
     * it the 'question' object
     *
     * @param qType = type of question to be created.
     */
    that.createQuestion = function (qType) {
        return that.initQuestion(that.getMugTypeByQuestionType(qType));
    };

    that.duplicateCurrentQuestion = function (options) {
        options = options || {};
        options.itext = options.itext || "link";

        var depth = 0;

        /**
         * Copy a MugType and its descendants and insert them after the original
         * MugType. Returns an array with two values:
         *  1. The duplicate MugType.
         *  2. An array of path replacements that should be executed on logic references.
         *
         * @param mugType - the mugtype in the original tree to duplicate
         * @param parentMugType - the mugtype in the duplicate tree to insert into
         * @param options {
         *          itext: 'link' (default) or 'copy'
         *        }
         */
        function duplicateMugType(mugType, parentMugType, options) {
            // clone mugType and give everything new unique IDs
            var duplicate = $.extend(true, {}, mugType),
                pathReplacements = [];

            // ensure consistency            
            duplicate.parentMug = parentMugType;
            formdesigner.util.give_ufid(duplicate);
            formdesigner.util.give_ufid(duplicate.mug);
            // clear existing event handlers for the source question
            formdesigner.util.eventuality(duplicate.mug);
            formdesigner.util.setStandardMugEventResponses(duplicate.mug);

            if (mugType.hasBindElement() && 
                mugType.mug.properties.bindElement.properties.nodeID) 
            {
                var newQuestionID = formdesigner.util.generate_question_id(
                    mugType.mug.properties.bindElement.properties.nodeID
                ); 
                duplicate.mug.properties.bindElement.properties.nodeID = newQuestionID;

                if (mugType.hasDataElement()) {
                    duplicate.mug.properties.dataElement.properties.nodeID = newQuestionID;
                }
            }
            
            if (depth === 0 && mugType.hasControlElement() && 
                mugType.mug.properties.controlElement.properties.defaultValue)
            {
                var newItemValue = formdesigner.util.generate_question_id(
                    mugType.mug.properties.controlElement.properties.defaultValue
                );
                duplicate.mug.properties.controlElement.properties.defaultValue = newItemValue;
            }
           
            formdesigner.ui.skipNodeSelectEvent = options.itext !== "copy";
            // insert mugtype into data and UI trees
            if (depth > 0) {
                if (parentMugType) {
                    formdesigner.ui.jstree("select_node", '#' + parentMugType.ufid);
                }

                that.initQuestion(duplicate, parentMugType);
            } else {
                formdesigner.ui.jstree("select_node", '#' + mugType.ufid);
                that.initQuestion(duplicate, mugType, 'after');
                formdesigner.ui
                    .jstree("deselect_all")
                    .jstree("select_node", '#' + duplicate.ufid);
            }

            formdesigner.model.LogicManager.updateAllReferences(duplicate);

            if (options.itext === "copy") {
                formdesigner.ui.displayMugProperties(duplicate);
                that.unlinkCurrentQuestionItext();
            }
            formdesigner.ui.skipNodeSelectEvent = true;

            var children = that.getChildren(mugType);
            depth++;
            for (var i = 0; i < children.length; i++) {
                pathReplacements = pathReplacements.concat(
                    duplicateMugType(children[i], duplicate, options)[1]);
            }
            depth--;

            if (parentMugType) {
                formdesigner.ui
                    .jstree("deselect_all")
                    .jstree("select_node", '#' + parentMugType.ufid);
            }

            pathReplacements.push({
                mugId: mugType.ufid,
                from: that.form.dataTree.getAbsolutePath(mugType),
                to: that.form.dataTree.getAbsolutePath(duplicate)
            });

            return [duplicate, pathReplacements];
        }

        var oldSkip = formdesigner.ui.skipNodeSelectEvent,
            selected = that.getCurrentlySelectedMugType(),
            parent = that.form.controlTree.getParentMugType(selected),
            foo = duplicateMugType(selected, parent, options),
            duplicate = foo[0],
            pathReplacements = foo[1];

        for (var i = 0; i < pathReplacements.length; i++) {
            var pr = pathReplacements[i];
            formdesigner.model.LogicManager.updatePath(pr.mugId, pr.from, pr.to, 
                that.form.dataTree.getAbsolutePath(duplicate));
        }
        formdesigner.ui.skipNodeSelectEvent = false;

        formdesigner.ui
            .jstree("deselect_all")
            .jstree("select_node", '#' + duplicate.ufid);

        formdesigner.ui.skipNodeSelectEvent = oldSkip;

        that.form.fire({type: "form-property-changed"});
    };

    that.initQuestion = function (mugType, refMugType, position) {
        formdesigner.util.setStandardMugEventResponses(mugType.mug);
        refMugType = refMugType || that.getCurrentlySelectedMugType();
        
        /* If a data node is currently selected, select the lowest question node
         * so we never insert a non-data node after the beginning of the data
         * nodes at the bottom. */
        if (refMugType && !refMugType.hasControlElement()) {
            var lowest = formdesigner.ui.selectLowestQuestionNode();
            refMugType = that.getMTFromFormByUFID($(lowest).prop('id'));
            position = 'after';
        }
     
        position = position || 'into';
        var success = false;

        /* First try to insert into the currently selected question, then try to
         * insert after it, then after all of its ancestors. */
        while (!success && refMugType) {
            formdesigner.ui.jstree("select_node", '#' + refMugType.ufid);
            success = that.createQuestionInUITree(mugType, position);

            if (!success) {
                if (position !== 'after') {
                    position = 'after';
                } else {
                    refMugType = that.form.controlTree.getParentMugType(refMugType);
                }
            }
        }

        /* If that failed (the only case should be when trying to insert a data
         * node), insert after the last non-data node. */
        if (!success) {
            formdesigner.ui.selectLowestQuestionNode();
            refMugType = that.getCurrentlySelectedMugType();
            position = 'after';
            success = that.createQuestionInUITree(mugType, position);
        }

        if (!success) {
            return false;
        }

        // insert into model
        that.insertMugTypeIntoForm(refMugType, mugType, position);
        formdesigner.model.Itext.updateForNewMug(mugType);
        formdesigner.intentManager.syncMugTypeWithIntent(mugType);

        formdesigner.ui.jstree("select_node", '#' + mugType.ufid);
        
        this.fire({
            type: "question-creation",
            mugType: mugType
        });

        return mugType;
    };

    that.removeCurrentQuestion = function () {
        that.removeMugTypeFromForm(that.getCurrentlySelectedMugType());
    };

    that.unlinkCurrentQuestionItext = function () {
        // hack
        $("#controlElement-labelItextID-auto-itext")
            .prop('checked', true).change();

        if ($.trim($("#bindElement-constraintMsgItextID").val())) {
            $("#bindElement-constraintMsgItextID-auto-itext")
                .prop('checked', true).change();
        }

        if ($.trim($("#controlElement-hintItextID").val())) {
            $("#controlElement-hintItextID-auto-itext")
                .prop('checked', true).change();
        }

    };

    that.isCurrentQuestionAutoItextId = function () {
        // hack
        return $("#controlElement-labelItextID-auto-itext").prop('checked');
    };
    
    that.changeQuestionType = function (mugType, questionType) {
        var $currentChanger = $('#fd-question-changer');
        if (questionType !== mugType.typeSlug) {
            // get the new mug type
            var newMugType = that.getMugTypeByQuestionType(questionType);
            
            // check preconditions - if this is a select question with
            // choices, you're only allowed to change it to another
            // select question
            var children = that.getChildren(mugType);
            if (children.length > 0) {
                if (!formdesigner.util.isSelect(newMugType)) {
                    throw "you can't change a Multiple/Single Choice question to a non-Choice " +
                          "question if it has Choices. Please remove all Choices " +
                          "and try again.";
                }
            }
            
            // copy everything over
            newMugType.ufid = mugType.ufid;
            var elems = ["dataElement", "bindElement", "controlElement"];
            for (var i = 0; i < elems.length; i ++) {
	            if (mugType.mug.properties[elems[i]] && newMugType.mug.properties[elems[i]]) {
	                formdesigner.util.copySafely(mugType.mug.properties[elems[i]].properties,
	                                             newMugType.mug.properties[elems[i]].properties,
	                                             ["nodeID"], ["appearance"]);
	            }
            }
            // magic special cases
            if (formdesigner.util.isSelect(newMugType) || newMugType.typeSlug === "stdTrigger") {
                newMugType.mug.properties.bindElement.properties.dataType = "";
            }
            
            // update trees
            that.form.replaceMugType(mugType, newMugType, 'data');
            that.form.replaceMugType(mugType, newMugType, 'control');

            formdesigner.ui.jstree("set_type", 
                newMugType.typeSlug, 
                '#' + mugType.ufid
            );

            mugType = newMugType;

            // update question type changer
            $currentChanger.after(formdesigner.widgets.getQuestionTypeChanger(newMugType)).remove();
            
            // update UI
            that.form.fire({ 
                type: "form-property-changed"
            });
        } else {
            formdesigner.ui.overrideJSTreeIcon(mugType.ufid, questionType);

            // update question type changer
            $currentChanger.after(formdesigner.widgets.getQuestionTypeChanger(mugType)).remove();
        }

        if (formdesigner.util.isSelect(mugType)) {
            that.updateMugChildren(mugType);
        }
    };

    that.updateMugChildren = function (parentMugType) {
        _.each(that.getChildren(parentMugType), function (childMugType) {
            that.fire({
                type: "parent-question-type-changed",
                mugType: childMugType
            });
        });
    };

    that.loadMugTypeIntoUI = function (mugType) {
        var mug, controlTree, parentMT;

        mug = mugType.mug;

        // set the 'currently selected mugType' to be that of this mugType's parent.
        controlTree = that.form.controlTree;
        parentMT = controlTree.getParentMugType(mugType);
        
        // check for control element because we want data nodes to be a flat
        // list at bottom.
        if (parentMT && mugType.properties.controlElement) {
            formdesigner.ui.jstree('select_node', '#'+parentMT.ufid, true);
        } else {
            formdesigner.ui.jstree('deselect_all');
        }
        that.createQuestionInUITree(mugType);
    };


    var parseXLSItext = function (str) {
        var rows = str.split('\n'),
                i, j, cells, lang,iID, form, val, Itext;
        
        // TODO: should this be configurable? 
        var exportCols = ["default", "audio", "image" , "video"];
                
        Itext = formdesigner.model.Itext;
        for (i = 0; i < rows.length; i++) {
            cells = rows[i].split('\t');
            lang = cells[0];
            iID = cells[1];
            for (j = 2; j < cells.length && j < exportCols.length + 2; j++) {
                if (cells[j]) {
                    form = exportCols[j - 2];
                    val = cells[j];
                    Itext.getOrCreateItem(iID).getOrCreateForm(form).setValue(lang, val);
                }
            }
        }
        that.fire({type: "global-itext-changed"});

        var currentMug = formdesigner.controller.getCurrentlySelectedMugType();
        if (currentMug) {
            formdesigner.ui.displayMugProperties(currentMug);
        }
    };
    
    that.parseXLSItext = parseXLSItext;

    var generateItextXLS = function () {
        var idata, row, iID, lang, form, val, Itext,
                out = '';
        
        that.removeCruftyItext();
        Itext = formdesigner.model.Itext;
        
        /**
         * Cleans Itext so that it fits the csv spec. For now just replaces newlines with ''
         * @param val
         */
        
        function makeRow (language, item, forms) {
            var values = forms.map(function (form) {
                return item.hasForm(form) ? item.getForm(form).getValueOrDefault(language) : "";
            });
            var row = [language, item.id].concat(values);
            return formdesigner.util.tabSeparate(row);
        }
        
        var ret = [];
        // TODO: should this be configurable? 
        var exportCols = ["default", "audio", "image" , "video"];
        var languages = Itext.getLanguages();
        // deduplicate
        Itext.deduplicateIds();
        var allItems = Itext.getNonEmptyItems();
        var language, item, i, j;
        if (languages.length > 0) {
            for (i = 0; i < languages.length; i++) {
                language = languages[i];
                for (j = 0; j < allItems.length; j++) {
                    item = allItems[j];
                    ret.push(makeRow(language, item, exportCols));
                }       
            }
        }
        return ret.join("\n");
    };
    that.generateItextXLS = generateItextXLS;

    that.generateExportXLS = function () {
        
        var languages = formdesigner.model.Itext.getLanguages();
        // deduplicate
        formdesigner.model.Itext.deduplicateIds();

        var itextColumns = {
            "default": "Text",
            "audio": "Audio",
            "image": "Image"
        };
        
        var columnOrder = [
            "Question", 
            "Type"
        ];
        
        for (var type in itextColumns) {
            var colName = itextColumns[type];
            
            for (var i = 0; i < languages.length; i++) {
                columnOrder.push(colName + " (" + languages[i] + ")");
            }
        }

        columnOrder = columnOrder.concat([
            "Display Condition", 
            "Validation Condition", 
            "Validation Message", 
            "Calculate Condition", 
            "Required"
        ]);


        var mugTypeToExportRow = function (mugType) {
            var row = {},
                itext = mugType.getItext(),
                defaultLanguage = formdesigner.model.Itext.getDefaultLanguage();

            var defaultOrNothing = function (item, language, form) {
                return item.hasForm(form) ? item.getForm(form).getValueOrDefault(language) : "";
            };

            // initialize all columns to empty string
            for (var i = 0; i < columnOrder.length; i++) {
                row[columnOrder[i]] = "";
            }

            row["Question"] = mugType.getDefaultItextRoot();
            row["Type"] = mugType.typeName;

            if (mugType.hasControlElement()) {
                for (var type in itextColumns) {
                    var colName = itextColumns[type];

                    for (var i = 0; i < languages.length; i++) {
                        var key = colName + " (" + languages[i] + ")";
                        row[key] = defaultOrNothing(itext, languages[i], type);
                    }
                }
            }
            
            if (mugType.hasBindElement()) {
                var properties = mugType.mug.properties.bindElement.properties;
                
                row["Display Condition"] = properties.relevantAttr;
                row["Calculate Condition"] = properties.calculateAttr;
                row["Required"] = properties.requiredAttr ? 'yes' : 'no';

                row["Validation Condition"] = properties.constraintAttr;
                var constraintMsgItext = mugType.getConstraintMsgItext();
                row["Validation Message"] = defaultOrNothing(constraintMsgItext, 
                                                             defaultLanguage, 'default');
            }

            // make sure there aren't any null values
            for (var prop in row) {
                if (row.hasOwnProperty(prop)) {
                    row[prop] = row[prop] || "";
                }
            }
            
            return formdesigner.util.tabSeparate(columnOrder.map(function (column) {
                return row[column];
            }));
        };
     
        var headers = [formdesigner.util.tabSeparate(columnOrder)],
            rows = headers.concat(that.getMugTypeList(true).map(mugTypeToExportRow));

        return rows.join("\n");
    };

    that.showItextDialog = function () {
        var $modal,
            $updateForm,
            $textarea;

        $modal = formdesigner.ui.generateNewModal("Edit Bulk Translations", [
            {
                id: 'fd-update-translations-button',
                title: "Update Translations",
                cssClasses: "btn-primary"
            }
        ]);
        $updateForm = formdesigner.ui.getTemplateObject('#fd-template-form-edit-source', {
            description: "Copy these translations into a spreadsheet program like Excel. You can edit them there and " +
                         "then paste them back here when you're done. These will update the translations used in your" +
                         " form. Press 'Update Translations' to save changes, or 'Close' to cancel."
        });
        $modal.find('.modal-body').html($updateForm);

        // display current values
        $textarea = $updateForm.find('textarea');
        $textarea.val(that.generateItextXLS());

        $modal.find('#fd-update-translations-button').click(function () {
            that.parseXLSItext($textarea.val());
            that.form.fire('form-property-changed');
            $modal.modal('hide');
        });

        $modal.modal('show');
    };


    that.showExportDialog = function () {
        var $modal,
            $exportForm;

        $modal = formdesigner.ui.generateNewModal("Export Form Contents", []);
        $exportForm = formdesigner.ui.getTemplateObject('#fd-template-form-edit-source', {
            description: "Copy and paste this content into a spreadsheet program like Excel " +
                         "to easily share your form with others."
        });
        $modal.find('.modal-body').html($exportForm);

        // display current values
        $exportForm.find('textarea').val(that.generateExportXLS());

        $modal.modal('show');
    };

    that.showFormPropertiesDialog = function () {
        // moved over just for display purposes, apparently the original
        // wasn't working perfectly, so this is a todo
        var $modal,
            $modalBody,
            formProperties;

        $modal = formdesigner.ui.generateNewModal("Edit Form Properties", []);
        $modalBody = $modal.find('.modal-body');

        $modalBody.append($('<p />').text("Note: changing the Form ID here will not automatically change " +
                                          "the Form ID in existing references in your logic conditions.  " +
                                          "If you change the Form ID, you must manually change any " +
                                          "existing logic references."));

        formProperties = [
            {
                label: "Form Name",
                slug: "formName"
            },
            {
                label: "Form ID",
                slug: "formID",
                cleanValue: function (val) {
                    return val.replace(/ /g, '_');
                }
            }
        ];

        function fireFormPropChanged(propName, oldVal, newVal) {
            formdesigner.controller.form.fire({
                type: 'form-property-changed',
                propName: propName,
                oldVal: oldVal,
                newVal: newVal
            });
        }

        _.each(formProperties, function (prop) {
            var $propertyInput = formdesigner.ui.getTemplateObject('#fd-template-control-group-stdInput', {
                label: prop.label,
                controlId: 'fd-form-prop-' + prop.slug + '-input'
            });
            $modalBody.append($propertyInput);
            $propertyInput.find('input')
                .val(formdesigner.controller.form[prop.slug])
                .on('keyup', function () {
                    var currentVal = $(this).val();
                    if (typeof prop.cleanValue === 'function') {
                        currentVal = prop.cleanValue(currentVal);
                        $(this).val(currentVal);
                    }
                    fireFormPropChanged(prop.slug, formdesigner.controller.form[prop.slug], currentVal);
                    formdesigner.controller.form[prop.slug] = currentVal;
                });
        });

        $modal.modal('show');
    };


    /**
     * Shows the source XML in a dialog window for editing, optionally
     * not displaying if there are validation errors and the user chooses
     * not to continue.
     */
    that.showSourceXMLDialog = function () {
        function showSourceInModal () {
            var $modal,
                $updateForm,
                $textarea,
                codeMirror,
                modalHeaderHeight,
                modalFooterHeight,
                modalHeight,
                modalBodyHeight;

            $modal = formdesigner.ui.generateNewModal("Edit Form's Source XML", [
                {
                    id: 'fd-update-source-button',
                    title: "Update Source",
                    cssClasses: "btn-primary"
                }
            ]);
            $updateForm = formdesigner.ui.getTemplateObject('#fd-template-form-edit-source', {
                description: "This is the raw XML. You can edit or paste into this box to make changes " +
                             "to your form. Press 'Update Source' to save changes, or 'Close' to cancel."
            });
            modalHeaderHeight = $modal.find('.modal-header').outerHeight();
            modalFooterHeight = $modal.find('.modal-footer').outerHeight();
            modalHeight = $(window).height() - 40;
            modalBodyHeight = modalHeight - (modalFooterHeight - modalHeaderHeight) - 126;

            $modal
                .css('height', modalHeight + 'px')
                .css('width', $(window).width() - 40 + 'px');

            $modal.addClass('fd-source-modal')
                .removeClass('form-horizontal')
                .find('.modal-body')
                .html($updateForm)
                .css('height', modalBodyHeight + 'px');

            $textarea = $updateForm.find('textarea');

            // populate text
            if(!that.formLoadingFailed){
                $textarea.val(that.form.createXForm());
            } else {
                $textarea.val(formdesigner.loadMe);
            }

            try {
                codeMirror = CodeMirror.fromTextArea($textarea.get(0));
                codeMirror.setOption('lineNumbers', true);
                codeMirror.setSize('100%', '100%');
            } catch (e) {
                // pass
            }

            $modal.find('#fd-update-source-button').click(function () {
                if (codeMirror) {
                    codeMirror.save();
                }
                that.loadXForm($textarea.val());
                that.form.fire('form-property-changed');
                $modal.modal('hide');
            });

            $modal.modal('show');
            $modal.on('shown', function () {
                if (codeMirror) {
                    codeMirror.refresh();
                }
            });
        }

        // There are validation errors but user continues anyway
        function onContinue () {
            formdesigner.ui.hideConfirmDialog();
            showSourceInModal();
        }

        function onAbort () {
            formdesigner.ui.hideConfirmDialog();
        }

        var msg = "There are validation errors in the form.  Do you want to continue anyway? WARNING:" +
                  "The form will not be valid and likely not perform correctly on your device!";

        formdesigner.ui.setDialogInfo(msg,'Continue',onContinue,'Abort',onAbort);
        if (!that.form.isFormValid()) {
            formdesigner.ui.showConfirmDialog();
        } else {
            showSourceInModal();
        }
    };

    var setFormName = function (name) {
        that.form.formName = name;
    };
    that.setFormName = setFormName;

    that.loadXForm = function (formString) {
        $.fancybox.showActivity();

        //universal flag for indicating that there's something wrong enough with the form that vellum can't deal.
        that.formLoadingFailed = false;

        //Things to do to gracefully deal with a form loading failure
        function formLoadFailed(e) {
            var showSourceButton = $('#fd-editsource-button');
            that.formLoadingFailed = true;

            //populate formdesigner.loadMe (var used when loading a form given during initialization)
            //with the broken form, so that it can be viewed/edited by the showSource view
            formdesigner.loadMe = formString;

            //disable all buttons and inputs
            formdesigner.ui.disableUI();
            showSourceButton.button('enable'); //enable the view source button so the form can be tweaked by hand.
            
            // ok to hard code this because it's public
            var validator_url = "https://www.commcarehq.org/formtranslate/";
            
            var msg = "We're sorry, Vellum cannot load your form.  You can edit your form directly by clicking the " +
                      '"Edit Source XML" button or go back to download your form. <br>' +
                      "It is likely that your form contains errors.  You can check to see if " +
                      "your form is valid by pasting your entire form into the " +
                      '<a href="' + validator_url + '" target="_blank">Form Validator</a>';
            
            formdesigner.model.form.updateError(formdesigner.model.FormError({
                key: "global-parse-fail",
                message: msg,
                level: "error"
            }), {updateUI: true});
        }

        window.setTimeout(function () { //wait for the spinner to come up.
            try {
                that.resetFormDesigner();
                formdesigner.model.Itext.resetItext(); //Clear out any ideas about itext since we'll be loading in that information now.
                that.parseXML(formString);
                that.reloadUI();
            } catch (e) {
                formLoadFailed(e);
                
                console.log('E OBJ', e);
                // hack: don't display the whole invalid XML block if it
                // was a parse error
                var msg = e.toString();
                if (msg.indexOf("Invalid XML") === 0) {
                    msg = "Parsing Error. Please check that your form is valid XML.";
                }
                
                formdesigner.ui.setDialogInfo(msg, 
                    'ok', function() {
                        formdesigner.ui.hideConfirmDialog();
                    }, 
                    'cancel', function(){
                        formdesigner.ui.hideConfirmDialog();
                    });
                formdesigner.ui.showConfirmDialog();
            }

            if(!that.formLoadingFailed) {
                //re-enable all buttons and inputs in case they were disabled before.
                formdesigner.ui.enableUI();
            }
            $.fancybox.hideActivity();
        },
        500);
    };


    that.removeMugTypeByUFID = function (ufid) {
        var MT = that.form.getMugTypeByUFID(ufid);
        that.removeMugTypeFromForm(MT);
    };

    that._removeMugTypeFromForm = function (mugType) {
        
        formdesigner.ui.removeMugTypeFromTree(mugType);

        var fromTree = that.form.controlTree.getNodeFromMugType(mugType);
        if (fromTree) {
            var children = that.form.controlTree.getNodeFromMugType(mugType).getChildrenMugTypes();
            for (var i = 0; i < children.length; i++) {
                that._removeMugTypeFromForm(children[i]);
            }
        }
        
        that.form.dataTree.removeMugType(mugType);
        that.form.controlTree.removeMugType(mugType);
    };

    that.removeMugTypeFromForm = function (mugType) {
        that._removeMugTypeFromForm(mugType);
        formdesigner.ui.selectSomethingOrResetUI();
        that.setFormChanged();
    };

    /**
    * use getErrorMsg() and addErrorMsg() to deal with error msgs!
    */
    that.parseErrorMsgs = [];
    that.parseWarningMsgs = [];

    var addParseErrorMsg = function (msg) {
        that.parseErrorMsgs.push(msg);
        that.fire({
              type: 'parse-error',
              exceptionData: msg
        });
    };
    that.addParseErrorMsg = addParseErrorMsg;

    var addParseWarningMsg = function (msg) {
        that.parseWarningMsgs.push(msg);
        that.fire({
              type: 'parse-warning',
              exceptionData: msg
        });
    };
    that.addParseWarningMsg = addParseWarningMsg;

    var getParseErrorMsgs = function () {
        return that.parseErrorMsgs;
    };
    that.getParseErrorMsgs = getParseErrorMsgs;

    var resetParseErrorMsgs = function () {
        that.parseErrorMsgs = [];
        formdesigner.model.form.clearErrors("error", {updateUI: true}); 
    };
    that.resetParseErrorMsgs = resetParseErrorMsgs;

    var resetParseWarningMsgs = function () {
        that.parseWarningMsgs = [];
        formdesigner.model.form.clearErrors("parse-warning", {updateUI: true}); 
    };
    that.resetParseWarningMsgs = resetParseWarningMsgs;

    /**
     * The big daddy function of parsing.
     * Pass in the XML String and this function
     * will create all the right stuff in the trees
     * and set everything up for editing.
     * @param xmlString
     */
    var parseXML = function (xmlString) {
        // for convenience
        var Itext = formdesigner.model.Itext;
        var pError = that.addParseErrorMsg;
        var ParseException = function (msg) {
            this.name = 'XMLParseException';
            this.message = msg;
        };

        // some helper functions used by the parser
        var lookForNamespaced = function (element, reference) {
            // due to the fact that FF and Webkit store namespaced
            // values slightly differently, we have to look in 
            // a couple different places.
            return element.attr("jr:" + reference) || element.attr("jr\\:" + reference);
        };
        
        /**
         * Get and itext reference from a value. Returns nothing if it can't
         * parse it as a valid itext reference.
         */
        var getITextReference = function (value) {
            try {
                var parsed = xpath.parse(value);
                if (parsed instanceof xpathmodels.XPathFuncExpr && parsed.id === "jr:itext") {
                    return parsed.args[0].value;
                } 
            } catch (err) {
                // this seems like a real error since the reference should presumably
                // have been valid xpath, but don't deal with it here
            }
            return false;
        };
        
        function parseDataTree (dataEl) {
            function parseDataElement (el) {
                var nodeID, nodeVal, mug, parentMugType, extraXMLNS, keyAttr,mType,parentNodeName,rootNodeName,dataTree;
                
                nodeID = el.nodeName;
                mType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataOnly);
                parentNodeName = $(el).parent()[0].nodeName;
                rootNodeName = $(dataEl)[0].nodeName;
                dataTree = that.form.dataTree;

                if($(el).children().length === 0) {
                    nodeVal = $(el).text();
                }else {
                    nodeVal = null;
                }

                extraXMLNS = $(el).attr('xmlns');
                keyAttr = $(el).attr('key');

                mug = formdesigner.model.createMugFromMugType(mType);

                mug.properties.dataElement.properties.nodeID = nodeID;
                mug.properties.dataElement.properties.dataValue = nodeVal;
                if(extraXMLNS && (extraXMLNS !== formdesigner.formUuid)) {
                    mug.properties.dataElement.properties.xmlnsAttr = extraXMLNS;
                }
                if(keyAttr) {
                    mug.properties.dataElement.properties.keyAttr = keyAttr;
                }
                // add arbitrary attributes
                mug.properties.dataElement.properties._rawAttributes = formdesigner.util.getAttributes(el);
                
                mType.mug = mug;
                if ( parentNodeName === rootNodeName ) {
                    parentMugType = null;
                }else {
                    parentMugType = that.form.getMugTypeByIDFromTree(parentNodeName,'data')[0];
                }

                dataTree.insertMugType(mType,'into',parentMugType);
            }
            var root = $(dataEl), recFunc;

            recFunc = function () {
                    parseDataElement(this);
                    $(this).children().each(recFunc);

            };

            if(root.children().length === 0) {
                pError('Data block has no children elements! Please make sure your form is a valid JavaRosa XForm and try again!');
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
                that.addParseWarningMsg('Form does not have a unique xform XMLNS (in data block). Will be added automatically');
            }
            if (!formdesigner.formJRM) {
                that.addParseWarningMsg('Form JRM namespace attribute was not found in data block. One will be added automatically');
            }
            if (!formdesigner.formUIVersion) {
                that.addParseWarningMsg('Form does not have a UIVersion attribute, one will be generated automatically');
            }
            if (!formdesigner.formVersion) {
                that.addParseWarningMsg('Form does not have a Version attribute (in the data block), one will be added automatically');
            }
            if (!formdesigner.formName) {
                that.addParseWarningMsg('Form does not have a Name! The default form name will be used');
            }

        }

        function parseBindList (bindList) {
            /**
             * Takes in a path and converts it to an absolute path (if it isn't one already)
             * @param path - a relative or absolute nodeset path
             * @param rootNodeName - the name of the model root (used to create the absolute path)
             * @return absolute nodeset path.
             */
            function processPath (path, rootNodeName) {
                var newPath;
                var parsed = xpath.parse(path);
                if (!(parsed instanceof xpathmodels.XPathPathExpr)) {
                    return null;
                }

                if (parsed.initial_context == xpathmodels.XPathInitialContextEnum.RELATIVE) {
                    parsed.steps.splice(0, 0, xpathmodels.XPathStep({axis: "child", test: rootNodeName}));
                    parsed.initial_context = xpathmodels.XPathInitialContextEnum.ROOT;
                }
                newPath = parsed.toXPath();
                return newPath;
            }

            bindList.each(function () {
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
                if(attrs.dataType && attrs.dataType.toLowerCase() === 'xsd:integer') {  //normalize this dataType ('int' and 'integer' are both valid).
                    attrs.dataType = 'xsd:int';
                }
                attrs.appearance = el.attr('appearance');
                attrs.relevantAttr = el.attr('relevant');
                attrs.calculateAttr = el.attr('calculate');
                attrs.constraintAttr = el.attr('constraint');

                var constraintMsg = lookForNamespaced(el, "constraintMsg"),
                    constraintItext = getITextReference(constraintMsg);

                if (constraintItext) {
                    attrs.constraintMsgItextID = Itext.getOrCreateItem(constraintItext);
                } else {
                    attrs.constraintMsgItextID = Itext.createItem("");
                    attrs.constraintMsgAttr = constraintMsg;    
                }
                                
                attrs.requiredAttr = formdesigner.util.parseBoolAttributeValue(el.attr('required'));
                
                attrs.preload = lookForNamespaced(el, "preload");
                attrs.preloadParams = lookForNamespaced(el, "preloadParams");
                
                bindElement = new formdesigner.model.BindElement(attrs);
                mug.properties.bindElement = bindElement;

                path = processPath(path,that.form.dataTree.getRootNode().getID());
                oldMT = that.getMugByPath(path,'data');
                if(!oldMT && attrs.nodeset) {
                    oldMT = that.form.getMugTypeByIDFromTree(
                                                formdesigner.util.getNodeIDFromPath(attrs.nodeset),
                                                'data'
                    )[0];
                }
                if(!oldMT){
                    that.addParseWarningMsg("Bind Node [" + path + "] found but has no associated Data node. This bind node will be discarded!");
//                    throw 'Parse error! Could not find Data MugType associated with this bind!'; //can't have a bind without an associated dataElement.
                    return;
                }
                mType.ufid = oldMT.ufid;
                mType.properties.dataElement = oldMT.properties.dataElement;
                mType.mug = mug;
                mType.mug.properties.dataElement = oldMT.mug.properties.dataElement;
                // clear relevant itext for bind
                // this is ugly, and should be moved somewhere else
                if (oldMT.hasBindElement()) {
                    Itext.removeItem(oldMT.mug.properties.bindElement.properties.constraintMsgItextID);
                }
                that.form.replaceMugType(oldMT, mType, 'data');
            });
        }

        function parseControlTree (controlsTree) {
            function eachFunc(){
                /**
                 * Determines what MugType this element should be
                 * and creates it.  Also modifies any existing mug that is associated
                 * with this element to fit the new type.
                 * @param nodePath
                 * @param controlEl
                 */
                function classifyAndCreateMugType (nodePath, cEl) {

                    var oldMT = that.getMugByPath(nodePath, 'data'), //check the data node to see if there's a related MT already present
                        mugType, mug, tagName, bindEl, dataEl, dataType, appearance, MTIdentifier, mediaType,
                        //flags
                        hasBind = true;

                    tagName = $(cEl)[0].nodeName;
                    if (oldMT) {
                        bindEl = oldMT.mug.properties.bindElement;
                        if (bindEl) {
                            dataType = bindEl.properties.dataType;
                            appearance = cEl.attr('appearance');
                            mediaType = cEl.attr('mediatype') ? cEl.attr('mediatype') : null;
                            if (dataType) {
                                dataType = dataType.replace('xsd:',''); //strip out extraneous namespace
                                dataType = dataType.toLowerCase();
                            }
                            if(mediaType) {
                                mediaType = mediaType.toLowerCase();
                            }
                        }else{
                            hasBind = false;
                        }
                    }

                    function MTIdentifierFromInput () {
                        if (!dataType) { 
                            return 'stdTextQuestion'; 
                        }
                        if(dataType === 'long') {
                            return 'stdLong';
                        }else if(dataType === 'int') {
                            return 'stdInt';
                        }else if(dataType === 'double') {
                            return 'stdDouble';
                        }else if(dataType === 'geopoint') {
                            return 'stdGeopoint';
                        }else if(dataType === 'barcode') {
                            return 'stdBarcode';
                        }else if(dataType === 'intent') {
                            return 'stdAndroidIntent';
                        }else if(dataType === 'string') {
                            if (appearance === "numeric") {
                                return 'stdPhoneNumber';
                            } else {
                                return 'stdTextQuestion';
                            }
                        }else if(dataType === 'date') {
                            return 'stdDate';
                        }else if(dataType === 'datetime') {
                            return 'stdDateTime';
                        }else if(dataType === 'time') {
                            return 'stdTime';
                        }else {
                            return 'stdTextQuestion';
                        }
                    }

                    function MTIdentifierFromGroup () {
                        if ($(cEl).attr('appearance') === 'field-list') {
                            return 'stdFieldList';
                        } else if ($(cEl).children('repeat').length > 0) {
                            tagName = 'repeat';
                            return 'stdRepeat';
                        } else {
                            return 'stdGroup';
                        }
                    }

                    function MTIdentifierFromUpload () {
                        if(!mediaType) {
                            throw 'Unable to parse binary question type. Path: ' +
                                    that.form.dataTree.getAbsolutePath(oldMT) +
                                    'The question has no MediaType attribute assigned to it!'
                        }
                        if (mediaType === 'video/*') {
                            /* fix buggy eclipse syntax highlighter (because of above string) */ 
                            return 'stdVideo';
                        } else if (mediaType === 'image/*') {
                            /* fix buggy eclipse syntax highlighter (because of above string) */ 
                            return 'stdImage';
                        } else if (mediaType === 'audio/*') {
                            /* fix buggy eclipse syntax highlighter (because of above string) */ 
                            return 'stdAudio';
                        } else {
                            throw 'Unrecognized upload question type for Element: ' + nodePath + '!';
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
                        MTIdentifier = MTIdentifierFromInput();
                    }else if (tagName === 'item') {
                        MTIdentifier = 'stdItem';
                    }else if (tagName === 'group') {
                        MTIdentifier = MTIdentifierFromGroup();
                    }else if (tagName === 'secret') {
                        MTIdentifier = 'stdSecret';
                    }else if (tagName === 'upload') {
                        MTIdentifier = MTIdentifierFromUpload();
                    } else {
                        MTIdentifier = "unknown";
                    }
                    
                    try{
                        mugType = that.getMugTypeByQuestionType(MTIdentifier);
                    }catch (e) {
                        console.log ("Exception Control Element", cEl);
                        throw 'New Control Element classified as non-existent MugType! Please create a rule for this case' +
                            ' in formdesigner.model.mugTypeMaker! IdentString:' + MTIdentifier + ",tagName:" + tagName +
                                ",cEl:" + cEl + ",nodePath:" + nodePath;
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

                    if (appearance) {
                        mugType.setAppearanceAttribute(appearance);
                    }

                    return mugType;
                }

                function populateMug (MugType, cEl) {
                    var labelEl, hintEl, Itext, repeat_count, repeat_noaddremove;
                    
                    if (formdesigner.util.isReadOnly(MugType)) {
                        MugType.mug.controlElementRaw = cEl;
                        return;
                    }
                    
                    Itext = formdesigner.model.Itext;
                    function parseLabel (lEl, MT) {
                        var labelVal = formdesigner.util.getXLabelValue($(lEl)),
                            labelRef = $(lEl).attr('ref'),
                            cProps = MT.mug.properties.controlElement.properties,
                            asItext;
                        var labelItext;
                        cProps.label = labelVal;
                        
                        var newLabelItext = function (mugType) {
                            var item = formdesigner.model.ItextItem({
				                id: mugType.getDefaultLabelItextId()
				            });
				            Itext.addItem(item);
				            return item;
                        };
                        
                        if (labelRef){
                            //strip itext incantation
                            asItext = getITextReference(labelRef);
                            if (asItext) {
                                labelItext = Itext.getOrCreateItem(asItext);
                            } else {
                                // this is likely an error, though not sure what we should do here
                                // for now just populate with the default
                                labelItext = newLabelItext(MT);
                            }
                        } else {
                            labelItext = newLabelItext(MT);
                        }
                        
                        cProps.labelItextID = labelItext;
                        if (cProps.labelItextID.isEmpty()) {
                            //if no default Itext has been set, set it with the default label
                            if (labelVal) {
                                cProps.labelItextID.setDefaultValue(labelVal);
                            } else {
                                // or some sensible deafult
                                cProps.labelItextID.setDefaultValue(MT.getDefaultLabelValue());
                            }
                        }
                    }

                    function parseHint (hEl, MT) {
                        var hintVal = formdesigner.util.getXLabelValue($(hEl)),
                            hintRef = $(hEl).attr('ref'),
                            cProps = MT.mug.properties.controlElement.properties;

                        //strip itext incantation
                        var asItext = getITextReference(hintRef);
                        if (asItext) {
                            cProps.hintItextID = Itext.getOrCreateItem(asItext);
                        } else {
                            // couldn't parse the hint as itext.
                            // just create an empty placeholder for it
                            cProps.hintItextID = Itext.createItem(""); 
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

                    function parseRepeatVals (r_count, r_noaddremove, MT) {
                        //MT.mug.properties.controlElement.properties
                        if (r_count) {
                            MT.mug.properties.controlElement.properties.repeat_count = r_count;
                        }

                        if(r_noaddremove) {
                            MT.mug.properties.controlElement.properties.no_add_remove = r_noaddremove;
                        }
                    }
                    var tag = MugType.mug.properties.controlElement.properties.tagName;
                    if(tag === 'repeat'){
                        labelEl = $($(cEl).parent().children('label'));
                        hintEl = $(cEl).parent().children('hint');
                        repeat_count = $(cEl).attr('jr:count');
                        repeat_noaddremove = formdesigner.util.parseBoolAttributeValue($(cEl).attr('jr:noAddRemove'));

                    } else {
                        labelEl = $(cEl).children('label');
                        hintEl = $(cEl).children('hint');
                    }

                    if (labelEl.length > 0) {
                        parseLabel(labelEl, MugType);
                    }
                    if (hintEl.length > 0) {
                        parseHint (hintEl, MugType);
                    }
                    if (tag === 'item') {
                        parseDefaultValue($(cEl).children('value'),MugType);
                    }

                    if (tag === 'repeat') {
                        parseRepeatVals(repeat_count, repeat_noaddremove, MugType);
                    }

                    formdesigner.intentManager.syncMugTypeWithIntent(MugType);
                    
                    // add any arbitrary attributes that were directly on the control
                    MugType.mug.properties.controlElement.properties._rawAttributes = formdesigner.util.getAttributes(cEl);
                }

                function insertMTInControlTree (MugType, parentMT) {
                    that.form.controlTree.insertMugType(MugType,'into',parentMT);
                }

                //figures out if this control DOM element is a repeat
                function isRepeatTest(groupEl) {
                    if($(groupEl)[0].tagName !== 'group') {
                        return false;
                    }
                    return $(groupEl).children('repeat').length === 1;
                }

                var el = $ ( this ), oldEl,
                    path,
                    mType,
                    parentNode,
                    parentMug,
                    tagName,
                    couldHaveChildren = ['repeat', 'group', 'fieldlist', 'select', 'select1'],
                    children,
                    bind,
                    isRepeat;

                isRepeat = isRepeatTest(el);
                //do the repeat switch thing
                if(isRepeat) {
                    oldEl = el;
                    el = $(el.children('repeat')[0]);
                }

                parentNode = oldEl ? oldEl.parent() : el.parent();
                if($(parentNode)[0].nodeName === 'h:body') {
                    parentNode = null;
                }

                var mugFromControlEl = function (el) {
	                var path = formdesigner.util.getPathFromControlElement(el),
	                    nodeId;

	                if (path) {
	                    return that.getMugByPath(path, 'data');
	                } else {
                        nodeId = $(el).attr('bind');

                        if (nodeId) {
                            try {
                                return that.getSingularMugTypeByNodeId(nodeId);
                            } catch (err) {
                                // may be fine if this was a parent lookup, 
                                // or will fail hard later if this creates an illegal move
                                return null;
                            }
                        }
	                }
	                return null;
	            }
                
                if (parentNode) {
                    parentMug = mugFromControlEl(parentNode);
                }
                
                path = formdesigner.util.getPathFromControlElement(el);
                if (!path) {
	                var existingMug = mugFromControlEl(el);
	                if (existingMug) {
	                    path = that.form.dataTree.getAbsolutePath(existingMug);
	                }
                }
                
                if (oldEl) {
                    mType = classifyAndCreateMugType(path,oldEl);
                } else {
                    mType = classifyAndCreateMugType(path,el);
                }
                populateMug(mType,el);
                insertMTInControlTree(mType, parentMug);

                if (!formdesigner.util.isReadOnly(mType)) {
                    tagName = mType.mug.properties.controlElement.properties.tagName.toLowerCase();
                    if(couldHaveChildren.indexOf(tagName) !== -1) {
                        children = $(el).children().not('label').not('value').not('hint');
                        children.each(eachFunc); //recurse down the tree
                    }
                    // update any remaining itext
                    Itext.updateForExistingMug(mType);
                }
            }
            controlsTree.each(eachFunc);
        }

        function parseItextBlock (itextBlock) {
            function eachLang() {
                
                var el = $(this), defaultExternalLang;
                var lang = el.attr('lang');
                var argument_langs = formdesigner.opts["langs"];
                
                function eachText() {
                    var textEl = $ (this);
	                var id = textEl.attr('id');
	                var item = Itext.getOrCreateItem(id);
	                
	                function eachValue() {
                        var valEl = $(this);
                        var curForm = valEl.attr('form');
                        if(!curForm) {
                            curForm = "default";
                        }
                        item.getOrCreateForm(curForm).setValue(lang, formdesigner.util.getXLabelValue(valEl));
                    }
	                textEl.children().each(eachValue);
	            }

                //if we were passed a list of languages (in order of preference from outside)...
                if (argument_langs) {  //we make sure this is a valid list with things in it or null at init time.
                    for (var i = 0; i < argument_langs; i++) {
                        if (argument_langs.hasOwnProperty(i)) {
                            Itext.addLanguage(argument_langs[i]);
                        }
                    }
                    //grab the new 'default' language. (Opts languages listing takes precedence over form specified default)
                    defaultExternalLang = argument_langs[0];
                }

                if (argument_langs && argument_langs.indexOf(lang) === -1) { //this language does not exist in the list of langs provided in launch args
                    that.addParseWarningMsg("The Following Language will be deleted from the form as it is not listed as a language in CommCareHQ: <b>" + lang + "</b>");
                    return; //the data for this language will be dropped.
                }
                Itext.addLanguage(lang);
                if (el.attr('default') !== undefined) {
                    Itext.setDefaultLanguage(lang);
                }

                if (defaultExternalLang) {
                    Itext.setDefaultLanguage(defaultExternalLang); //set the form default to the one specified in initialization options.
                }

                //loop through children
                el.children().each(eachText)
            }
            
            Itext.clear();
            if (formdesigner.opts.langs && formdesigner.opts.langs.length > 0) {
	            // override the languages with whatever is passed in
	            for (var i = 0; i < formdesigner.opts.langs.length; i++) {
	                formdesigner.model.Itext.addLanguage(formdesigner.opts.langs[i]);
	            }
	            formdesigner.model.Itext.setDefaultLanguage(formdesigner.opts.langs[0]);
            }
            $(itextBlock).children().each(eachLang);
            if (Itext.getLanguages().length === 0) {
                // there likely wasn't itext in the form or config. At least
                // set a default language
                Itext.addLanguage("en");
                Itext.setDefaultLanguage("en");
            }
            if (!formdesigner.currentItextDisplayLanguage) {
                formdesigner.currentItextDisplayLanguage = formdesigner.model.Itext.getDefaultLanguage();
            }
        }

        that.fire('parse-start');
        try {
            var _getInstances = function (xml) {
                // return all the instances in the form.
                // if there's more than one, guarantee that the first item returned
                // is the main instance.
                var instances = xml.find("instance");
                var foundMain = false;
                var ret = [];
                for (var i = 0; i < instances.length; i++) {
                    // the main should be the one without an ID
                    if (!$(instances[i]).attr("id")) {
                        if (foundMain) {
                            throw "multiple unnamed instance elements found in the form! this is not allowed. please add id's to all but 1 instance.";
                        }
                        ret.splice(0, 0, instances[i]);
                        foundMain = true;
                    } else {
                        ret.push(instances[i]);
                    }
                }
                return ret;
            };
            var xmlDoc = $.parseXML(xmlString),
                xml = $(xmlDoc),
                head = xml.find('h\\:head, head'),
                title = head.children('h\\:title, title'),
                binds = head.find('bind'),
                instances = _getInstances(xml),
                itext = head.find('itext');

            var intentTags = [
                "odkx\\:intent, intent"
            ];
            intentTags.map(function (tag) {
                var foundTags = head.children(tag);
                formdesigner.intentManager.parseIntentTagsFromHead(foundTags);
            });

            var data = $(instances[0]).children();
            if($(xml).find('parsererror').length > 0) {
                throw 'PARSE ERROR! Message follows:' + $(xml).find('parsererror').find('div').html();
            }
            
            if(title.length > 0) {
                that.form.formName = $(title).text();
            }
            
            // set all instance metadatas
            that.form.instanceMetadata = instances.map(function (instance) {
                return formdesigner.model.InstanceMetadata(
                    formdesigner.util.getAttributes(instance),
                    $(instance).children()
                ); 
            });
            
            if(data.length === 0) {
                pError('No Data block was found in the form.  Please check that your form is valid!');
            }
            
            // parse itext first so all the other functions can access it
            parseItextBlock(itext);
            
            parseDataTree (data[0]);
            parseBindList (binds);

            var controls = xml.find('h\\:body, body').children();
            parseControlTree(controls);

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
        
    };
    that.parseXML = parseXML;

    /**
     * Move a mugType from its current place (in both the Data and Control trees) to
     * the position specified by the arguments,
     * @param mugType - The MT to be moved
     * @param position - The position relative to the refMugType (can be 'before','after' or 'into')
     * @param refMugType
     */
    that.moveMugType = function (mugType, refMugType, position) {
        var dataTree = that.form.dataTree, 
            controlTree = that.form.controlTree, 
            preMovePath = dataTree.getAbsolutePath(mugType);

        if (mugType.hasDataElement()) {
            dataTree.insertMugType(mugType, position, refMugType);
        }
        if (mugType.hasControlElement()) {
            controlTree.insertMugType(mugType, position, refMugType);
        }

        formdesigner.model.LogicManager.updatePath(mugType.ufid, 
            preMovePath, 
            dataTree.getAbsolutePath(mugType)
        );

        //fire a form-property-changed event to sync up with the 'save to server' button disabled state
        that.form.fire({
            type: 'form-property-changed'
        });
    };

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

    that.getCurrentlySelectedMugType = function () {
        var selected = formdesigner.ui.jstree('get_selected');

        if (!selected || !selected[0]) {
            return null;
        } else {
            selected = selected[0];
            return that.getMTFromFormByUFID($(selected).prop('id'));
        }
    };

    /**
     * @deprecated (OLD)
     * Sets the currently selected (in the UI tree) MugType
     * so that the controller is aware of the currently
     * being worked on MT without having to do the call
     * to the UI each time.
     *
     * @param ufid - UFID of the selected MugType
     */
    that.setCurrentlySelectedMugType = function (ufid) {
        if (ufid) {
            formdesigner.ui.jstree('select_node', '#' + ufid);
        } else {
            formdesigner.ui.jstree('deselect_all');
        }
    };


    that.getMTFromFormByUFID = function (ufid) {
        var curMT = that.form.dataTree.getMugTypeFromUFID(ufid);
        if (!curMT) { //check controlTree in case it's there.
            curMT = that.form.controlTree.getMugTypeFromUFID(ufid);
        }
        return curMT;
    };
    
    that.validateAndSaveXForm = function () {
        var getUrl = function (saveType) {
            return saveType === 'patch' ?
                formdesigner.patchUrl : formdesigner.saveUrl;
        };
        var url = getUrl(formdesigner.saveType);
        if (!url) {
            formdesigner.ui.setDialogInfo("Error: Cannot send form, no save url specified!",
            'OK', function () {
                        $ (this) .dialog("close");
                    },
            'Cancel', function () {
                        $ (this) .dialog("close");
            });
        }
        
        var send = function (formText, saveType) {
            var data;
            saveType = saveType || formdesigner.saveType;
            var url = getUrl(saveType);
            $('body').ajaxStart(formdesigner.ui.showWaitingDialog);
            $('body').ajaxStop(formdesigner.ui.hideConfirmDialog);

            if (saveType === 'patch') {
                var dmp = new diff_match_patch();
                data = {
                    patch: dmp.patch_toText(
                        dmp.patch_make(formdesigner.originalXForm, formText)
                    ),
                    sha1: CryptoJS.SHA1(formdesigner.originalXForm).toString()
                };
            } else {
                data = {xform: formText}
            }

            saveButton.ajax({
                type: "POST",
                url: url,
                data: data,
                dataType: 'json',
                success: function (data) {
                    if (saveType === 'patch') {
                        if (data.status === 'conflict') {
                            /* todo: display diff and ask instead overwriting */
//                            var diffHtml = dmp.diff_prettyHtml(
//                                dmp.diff_main(formdesigner.originalXForm, data.xform)
//                            );
                            send(formText, 'full');
                            return;
                        } else {
                            if (CryptoJS.SHA1(formText).toString() !== data.sha1) {
                                console.error("sha1's didn't match");
                                send(formText, 'full');
                            }
                        }
                    }
                    formdesigner.ui.hideConfirmDialog();
                    formdesigner.fire({
                        type: 'form-saved',
                        response: data
                    });
                    formdesigner.originalXForm = formText;
                }
            });
        };
        
        var formText = that.form.createXForm();
        var parsed = false;
        try {
            $.parseXML(formText);
            parsed = true;
        } catch (err) {
            // something went wrong parsing, but maybe the user wants to save anyway
            // let's ask them with a scary message encouraging them not to.
            var theScaryWarning = "It looks like your form is not valid XML. This can " +
                "often happen if you use a reserved character in one of your questions. " +
                "Characters to look out for are <, >, and &. You can still save, but " +
                "Vellum will NOT LOAD THIS FORM again until you fix the XML by hand. " +
                "What would you like to do?";
            formdesigner.ui.setDialogInfo(theScaryWarning,
                'Fix the problem (recommended)', function () {
                    $(this).dialog("close");
                },
                'Save Anyways', function () {
                    $(this).dialog("close");
                    send(formText)
                },
                'Form Validation Error');
            formdesigner.ui.showConfirmDialog();
        }
        if (parsed) {
            send(formText);
        }
    };

    that.resetFormDesigner = function () {
        formdesigner.util.question_counter = 1;

        formdesigner.model.reset();
        formdesigner.ui.reset();
    };
    
    // tree drag and drop stuff, used by xpath
    var handleTreeDrop = function(source, target) {
        var target = $(target), sourceUid = $(source).attr("id");
        if (target) {
            var mug = that.form.getMugTypeByUFID(sourceUid);
            // the .change fires the validation controls
            target.val(target.val() + formdesigner.util.mugToXPathReference(mug)).change();
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
        if (!options.cancel) {
            that.setMugPropertyValue(mug.mug, options.group, options.property, options.value, mug) 
        }
        formdesigner.ui.hideXPathEditor();
        formdesigner.ui.showTools();
        formdesigner.ui.displayMugProperties(mug);
    };
    that.doneXPathEditor = doneXPathEditor;
    
    //make controller event capable
    formdesigner.util.eventuality(that);

    return that;
})();


formdesigner.intentManager = (function () {
    "use strict";
    var that = {};
    that.unmappedIntentTags = {};

    var ODKXIntentTag = function (nodeID, path) {
        var self = this;
        self.initialNodeID = nodeID;
        self.path = path || "";
        self.xmlns = "http://opendatakit.org/xforms";

        self.extra = {};
        self.response = {};

        self.parseInnerTags = function (tagObj, innerTag, store) {
            _.each(tagObj.find(innerTag), function (inner) {
                var $innerTag = $(inner);
                store[$innerTag.attr('key')] = $innerTag.attr('ref');
            });
        };

        self._writeInnerTagXML = function(xmlWriter, innerTag, store) {
            if (store) {
                _.each(store, function (ref, key) {
                    if (key) {
                        xmlWriter.writeStartElement(innerTag);
                        xmlWriter.writeAttributeStringSafe("key", key);
                        xmlWriter.writeAttributeStringSafe("ref", ref);
                        xmlWriter.writeEndElement();
                    }
                });
            }
        };

        self.writeXML = function (xmlWriter, currentNodeID) {
            xmlWriter.writeStartElement('odkx:intent');
            xmlWriter.writeAttributeStringSafe("xmlns:odkx", self.xmlns);
            xmlWriter.writeAttributeStringSafe("id", currentNodeID || self.initialNodeID);
            xmlWriter.writeAttributeStringSafe("class", self.path);
            self._writeInnerTagXML(xmlWriter, 'extra', self.extra);
            self._writeInnerTagXML(xmlWriter, 'response', self.response);
            xmlWriter.writeEndElement('odkx:intent');
        };
    };

    that.parseIntentTagsFromHead = function (tags) {
        _.each(tags, function (tagXML) {
            var $tag, tagId, newTag, xmlns;
            $tag = $(tagXML);

            tagId = $tag.attr('id');
            newTag = new ODKXIntentTag(tagId, $tag.attr('class'));

            xmlns = $tag.attr('xmlns:odkx');
            newTag.xmlns = xmlns || newTag.xmlns;
            newTag.parseInnerTags($tag, 'extra', newTag.extra);
            newTag.parseInnerTags($tag, 'response', newTag.response);
            that.unmappedIntentTags[tagId] = newTag;
        });
    };

    that.getParsedIntentTagWithID = function (nodeID) {
        var intentTag = null;
        _.each(that.unmappedIntentTags, function (tag) {
            if (tag.initialNodeID == nodeID) {
                intentTag = tag;
            }
        });
        return intentTag;
    };

    that.syncMugTypeWithIntent = function (mugType) {
        // called when initializing a mugType from a parsed form
        if (mugType.typeSlug == 'stdAndroidIntent') {
            var tag = that.getParsedIntentTagWithID(mugType.mug.properties.dataElement.properties.nodeID);
            if (!tag) {
                var path = (mugType.intentTag) ? mugType.intentTag.path : null;
                tag = new ODKXIntentTag(mugType.mug.properties.dataElement.properties.nodeID, path);
            }
            mugType.intentTag = tag;
            delete that.unmappedIntentTags[tag.initialNodeID];
        }
    };

    that.writeIntentXML = function (xmlWriter, dataTree) {
        // make sure any leftover intent tags are still kept
        _.each(that.unmappedIntentTags, function (tag) {
           tag.writeXML(xmlWriter, null);
        });

        var intents,
            getIntentMugTypes = function(node) {
                var MT = node.getValue();
                if (!MT || node.isRootNode) {
                    return null;
                }
                if (MT.mug.properties.bindElement && MT.mug.properties.bindElement.properties.dataType == 'intent') {
                    return MT;
                } else {
                    return null;
                }
            };
        intents = dataTree.treeMap(getIntentMugTypes);
        if (intents.length > 0) {
            xmlWriter.writeComment('Intents inserted by Vellum:');
            intents.map(function (intentMT) {
                intentMT.intentTag.writeXML(xmlWriter, intentMT.mug.properties.dataElement.properties.nodeID);
            });
        }
    };

    return that;
})();
