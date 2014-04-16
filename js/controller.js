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
    
    var initFormDesigner = function (sessionid) {
        xpathmodels.DEBUG_MODE = DEBUG_MODE;
        formdesigner.util.question_counter = 1;
        
        formdesigner.model.init();
        formdesigner.ui.init(sessionid);
        that.setCurrentlySelectedMug(null);
        
        if (formdesigner.opts.langs && formdesigner.opts.langs.length > 0) {
            // override the languages with whatever is passed in
            for (var i = 0; i < formdesigner.opts.langs.length; i++) {
                formdesigner.pluginManager.javaRosa.Itext.addLanguage(formdesigner.opts.langs[i]);
            }
            formdesigner.pluginManager.javaRosa.Itext.setDefaultLanguage(formdesigner.opts.langs[0]);
        } else if (formdesigner.pluginManager.javaRosa.Itext.languages.length === 0) {
            formdesigner.pluginManager.javaRosa.Itext.addLanguage("en");
        }
        
        formdesigner.currentItextDisplayLanguage = formdesigner.opts.displayLanguage ||
                                                   formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage();

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
            var allMugs = that.getMugList(true);
            allMugs.map(function (mug) {
                formdesigner.util.setStandardMugEventResponses(mug);
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
     * formdesigner.plugins.javaRosa.preSerialize()
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
     * @param path - String of path you want
     * @param tree - [OPTIONAL] Type of tree, 'control' or 'data'.  Defaults to 'data'
     */
    var getMugByPath = function (path, tree) {
        var recFunc, tokens, targetMug, rootNode;
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

        targetMug = recFunc(rootNode,tokens.slice(1));
        return targetMug;
    };
    that.getMugByPath = getMugByPath;
    
    var getSingularMugByNodeId = function (nodeId, treeType) {
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
    that.getSingularMugByNodeId = getSingularMugByNodeId;
    
    that.getChildren = function (mug) {
        var node = that.form.controlTree.getNodeFromMug(mug),
            children = node ? node.getChildren() : [];  // handles data node
        return children.map(function (item) { return item.getValue();});
    };
    
    /**
     * Walks through both internal trees (data and control) and grabs
     * all mugs that are not (1)Choices.  Returns
     * a flat list of unique mugs.  This list is primarily fo the
     * autocomplete skip logic wizard.
     */
    that.getMugList = function (includeSelectItems) {
        var cTree, dTree, treeFunc, cList, dList, mergeList;
        //use formdesigner.util.mergeArray

        treeFunc = function (node) {
            if(node.isRootNode) {
                return;
            }

            var mug = node.getValue();
            if(mug.__className === "Item" && !includeSelectItems) { //skip Choices
                return;
            }

            return mug;
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
    that.setMugPropertyValue = function (myMug, element, property, val) {
        var prev = myMug[element][property];
        myMug[element][property] = val;
        myMug.fire({
			type: 'property-changed',
			property: property,
			element: element,
			val: val,
			previous: prev,
			mugUfid: myMug.ufid
        });
    };

    /**
     * Inserts a new Mug into the relevant Trees (and their
     * relevant positions) according to the specified mug and
     * the currently selected mug.
     * @param newMug - new Mug to be inserted into the Form object
     * @param refMug - used to determine the relative position of the insertion (relative to the refMug)
     * @param position - the position to use (default: auto)
     */
    that.insertMugIntoForm = function (refMug, newMug, position) {
        var dataTree = that.form.dataTree,
            controlTree = that.form.controlTree;

        if (newMug.dataElement && !newMug.controlElement) {
            // data node, stick it at the end of the form by default
            dataTree.insertMug(newMug, 'after', null);
            return;
        }
        
        position = position || "into";

        if (newMug.dataElement) {
            dataTree.insertMug(newMug, position, refMug);
        }

        if (newMug.controlElement) {
            controlTree.insertMug(newMug, position, refMug);
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
        that.setCurrentlySelectedMug(null);

        formdesigner.ui.skipNodeSelectEvent = true;
        treeFunc = function (node) {
            var mug;
            if(node.isRootNode) {
                return;
            }

            mug = node.getValue();
            if(!mug) {
                throw 'Node in tree without value?!?!';
            }
            that.loadMugIntoUI(mug);
        };

        that.form.controlTree.treeMap(treeFunc);
        //get list of pure data nodes and throw them in the Question UI tree (at the bottom)
        dataNodeList = that.getDataNodeList();
        for (var i = 0; i < dataNodeList.length; i++) {
            that.loadMugIntoUI(dataNodeList[i]);
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
     * kind of control.  Returns a flat list of these nodes (list items are mugs).
     */
    that.getDataNodeList = function () {
        var treeFunc = function(node){ //the function we will pass to treeMap
            if (!node.getValue() || node.isRootNode) {
                return null;
            }
            var mug = node.getValue();

            if (mug.controlElement) {
                return null;
            } else {
                return mug;
            }
        };

        return  that.form.dataTree.treeMap(treeFunc);
    };

    /**
     * Create a new node from mug relative to the currently selected node.
     *
     * @param mug - Mug to insert into tree
     * @param position (optional)
     * @return  - node object on success or false on failure (when you attempt
     *   invalid nesting with respect to node types)
     */
    that.createQuestionInUITree = function (mug, position) {
        var objectData, insertPosition;

        if (mug.controlElement) {
            insertPosition = position || "into";
        } else {
            // data node
            
            formdesigner.ui.jstree("deselect_all");
            insertPosition = "last";
        }

        objectData = {
            data: formdesigner.util.getMugDisplayName(mug),
            metadata: {
                mug: mug,
                mugUfid: mug.ufid,
                dataID: mug.getDataElementID(),
                bindID: mug.getBindElementID()
            },
            attr: {
                id: mug.ufid,
                rel: mug.__className
            },
            state: mug.isSpecialGroup ? 'open' : undefined
        };

        var oldSelected = that.getCurrentlySelectedMug();

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

    that.duplicateCurrentQuestion = function (options) {
        options = options || {};
        options.itext = options.itext || "link";

        var depth = 0;

        /**
         * Copy a Mug and its descendants and insert them after the original
         * Mug. Returns an array with two values:
         *  1. The duplicate Mug.
         *  2. An array of path replacements that should be executed on logic references.
         *
         * @param mug - the mugtype in the original tree to duplicate
         * @param parentMug - the mugtype in the duplicate tree to insert into
         * @param options {
         *          itext: 'link' (default) or 'copy'
         *        }
         */
        function duplicateMug(mug, parentMug, options) {
            // clone mug and give everything new unique IDs
            var duplicate = new mugs[mug.__className]();
                pathReplacements = [];
            duplicate.copyAttrs(mug);

            // ensure consistency            
            formdesigner.util.give_ufid(duplicate);
            // clear existing event handlers for the source question
            formdesigner.util.eventuality(duplicate);
            formdesigner.util.setStandardMugEventResponses(duplicate);

            if (mug.bindElement && mug.bindElement.nodeID) {
                var newQuestionID = formdesigner.util.generate_question_id(
                    mug.bindElement.nodeID
                ); 
                duplicate.bindElement.nodeID = newQuestionID;

                if (mug.dataElement) {
                    duplicate.dataElement.nodeID = newQuestionID;
                }
            }
            
            if (depth === 0 && mug.controlElement && 
                mug.controlElement.defaultValue)
            {
                var newItemValue = formdesigner.util.generate_question_id(
                    mug.controlElement.defaultValue
                );
                duplicate.controlElement.defaultValue = newItemValue;
            }
           
            formdesigner.ui.skipNodeSelectEvent = options.itext !== "copy";
            // insert mugtype into data and UI trees
            if (depth > 0) {
                if (parentMug) {
                    formdesigner.ui.jstree("select_node", '#' + parentMug.ufid);
                }

                that.initQuestion(duplicate, parentMug);
            } else {
                formdesigner.ui.jstree("select_node", '#' + mug.ufid);
                that.initQuestion(duplicate, mug, 'after');
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

            var children = that.getChildren(mug);
            depth++;
            for (var i = 0; i < children.length; i++) {
                pathReplacements = pathReplacements.concat(
                    duplicateMug(children[i], duplicate, options)[1]);
            }
            depth--;

            if (parentMug) {
                formdesigner.ui
                    .jstree("deselect_all")
                    .jstree("select_node", '#' + parentMug.ufid);
            }

            pathReplacements.push({
                mugId: mug.ufid,
                from: that.form.dataTree.getAbsolutePath(mug),
                to: that.form.dataTree.getAbsolutePath(duplicate)
            });

            return [duplicate, pathReplacements];
        }

        var oldSkip = formdesigner.ui.skipNodeSelectEvent,
            selected = that.getCurrentlySelectedMug(),
            parent = selected.parentMug,
            foo = duplicateMug(selected, parent, options),
            duplicate = foo[0],
            pathReplacements = foo[1];

        if (_gaq) {
           _gaq.push(['_trackEvent', 'Form Builder', 'Copy', foo[0].typeName]);
        }

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

    that.initQuestion = function (mug, refMug, position) {
        formdesigner.util.setStandardMugEventResponses(mug);
        refMug = refMug || that.getCurrentlySelectedMug();
        
        /* If a data node is currently selected, select the lowest question node
         * so we never insert a non-data node after the beginning of the data
         * nodes at the bottom. */
        if (refMug && !refMug.controlElement) {
            var lowest = formdesigner.ui.selectLowestQuestionNode();
            refMug = that.getMugFromFormByUFID($(lowest).prop('id'));
            position = 'after';
        }
     
        position = position || 'into';
        var success = false;

        // manually set mug.parentMug before UI insertion so it's accessible to
        // overrideJSTreeIcon()
        if (position === 'into') {
            mug.parentMug = refMug;
        } else {
            mug.parentMug = refMug.parentMug;
        }

        /* First try to insert into the currently selected question, then try to
         * insert after it, then after all of its ancestors. */
        while (!success && refMug) {
            formdesigner.ui.jstree("select_node", '#' + refMug.ufid);
            success = that.createQuestionInUITree(mug, position);

            if (!success) {
                if (position !== 'after') {
                    position = 'after';
                } else {
                    refMug = refMug.parentMug;
                }
            }
        }

        /* If that failed (the only case should be when trying to insert a data
         * node), insert after the last non-data node. */
        if (!success) {
            formdesigner.ui.selectLowestQuestionNode();
            refMug = that.getCurrentlySelectedMug();
            position = 'after';
            success = that.createQuestionInUITree(mug, position);
        }

        if (!success) {
            return false;
        }

        // insert into model
        that.insertMugIntoForm(refMug, mug, position);
        formdesigner.pluginManager.javaRosa.Itext.updateForNewMug(mug);
        formdesigner.intentManager.syncMugWithIntent(mug);

        formdesigner.ui.jstree("select_node", '#' + mug.ufid);
        
        this.fire({
            type: "question-creation",
            mug: mug
        });

        return mug;
    };

    that.removeCurrentQuestion = function () {
        that.removeMugFromForm(that.getCurrentlySelectedMug());
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
    
    that.changeQuestionType = function (mug, questionType) {
        var $currentChanger = $('#fd-question-changer');

        if (mug.__className !== questionType) {
            // check preconditions - if this is a select question with
            // choices, you're only allowed to change it to another
            // select question
            var children = that.getChildren(mug);
            if (children.length > 0) {
                if (questionType !== "Select" && questionType !== "MSelect") {
                    throw "you can't change a Multiple/Single Choice question to a non-Choice " +
                          "question if it has Choices. Please remove all Choices " +
                          "and try again.";
                }
            }
            
            var newMug = new mugs[questionType]();
            newMug.ufid = mug.ufid;

            // hack: force removal of the appearance attribute since this is statically
            // determined already by the question type
            if (mug.controlElement && mug.controlElement.appearance) {
                delete mug.controlElement.appearance;
            }
            // and do the same thing for the 'mediatype' property as well
            if (mug.controlElement && mug.controlElement.mediaType) {
                delete mug.controlElement.mediaType;
            }

            newMug.copyAttrs(mug);
            
            // update trees
            that.form.replaceMug(mug, newMug, 'data');
            that.form.replaceMug(mug, newMug, 'control');

            formdesigner.ui.jstree("set_type", 
                questionType, 
                '#' + mug.ufid
            );

            mug = newMug;

            // update question type changer
            $currentChanger.after(formdesigner.widgets.getQuestionTypeChanger(newMug)).remove();
            
            // update UI
            that.form.fire({ 
                type: "form-property-changed"
            });
        } else {
            formdesigner.ui.overrideJSTreeIcon(mug.ufid, mugs[questionType]);

            // update question type changer
            $currentChanger.after(formdesigner.widgets.getQuestionTypeChanger(mug)).remove();
        }

        if (mug.__className === "Select" || mug.__className === "MSelect") {
            that.updateMugChildren(mug);
        }
    };

    that.updateMugChildren = function (parentMug) {
        _.each(that.getChildren(parentMug), function (childMug) {
            that.fire({
                type: "parent-question-type-changed",
                mug: childMug
            });
        });
    };

    that.loadMugIntoUI = function (mug) {
        var controlTree, parentMug;

        // set the 'currently selected mug' to be that of this mug's parent.
        controlTree = that.form.controlTree;
        parentMug = mug.parentMug;
        
        // check for control element because we want data nodes to be a flat
        // list at bottom.
        if (parentMug && mug.controlElement) {
            formdesigner.ui.jstree('select_node', '#'+parentMug.ufid, true);
        } else {
            formdesigner.ui.jstree('deselect_all');
        }
        that.createQuestionInUITree(mug);
    };

    that.generateExportXLS = function () {
        formdesigner.pluginManager.call('preSerialize');
        var languages = formdesigner.pluginManager.javaRosa.Itext.getLanguages();

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

        var mugToExportRow = function (mug) {
            var row = {},
                itext = mug.controlElement ? mug.controlElement.labelItextID : null,
                defaultLanguage = formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage();

            var defaultOrNothing = function (item, language, form) {
                return (item && item.hasForm(form)) ? 
                    item.getForm(form).getValueOrDefault(language) : "";
            };

            // initialize all columns to empty string
            for (var i = 0; i < columnOrder.length; i++) {
                row[columnOrder[i]] = "";
            }

            row["Question"] = mug.getDefaultItextRoot();
            row["Type"] = mug.typeName;

            if (mug.controlElement) {
                for (var type in itextColumns) {
                    var colName = itextColumns[type];

                    for (var i = 0; i < languages.length; i++) {
                        var key = colName + " (" + languages[i] + ")";
                        row[key] = defaultOrNothing(itext, languages[i], type);
                    }
                }
            }
            
            if (mug.bindElement) {
                row["Display Condition"] = mug.bindElement.relevantAttr;
                row["Calculate Condition"] = mug.bindElement.calculateAttr;
                row["Required"] = mug.bindElement.requiredAttr ? 'yes' : 'no';

                row["Validation Condition"] = mug.bindElement.constraintAttr;
                row["Validation Message"] = defaultOrNothing(
                    mug.bindElement ? mug.bindElement.constraintMsgItextID : null,
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
            rows = headers.concat(that.getMugList(true).map(mugToExportRow));

        return rows.join("\n");
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

            $modal.find('#fd-update-source-button').click(function () {
                that.loadXForm($textarea.val());
                that.form.fire('form-property-changed');
                $modal.modal('hide');
            });

            $modal.modal('show');
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
                formdesigner.pluginManager.javaRosa.Itext.resetItext(); //Clear out any ideas about itext since we'll be loading in that information now.
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


    that.removeMugByUFID = function (ufid) {
        var mug = that.form.getMugByUFID(ufid);
        that.removeMugFromForm(mug);
    };

    that._removeMugFromForm = function (mug) {
        
        formdesigner.ui.removeMugFromTree(mug);

        var fromTree = that.form.controlTree.getNodeFromMug(mug);
        if (fromTree) {
            var children = that.form.controlTree.getNodeFromMug(mug).getChildrenMugs();
            for (var i = 0; i < children.length; i++) {
                that._removeMugFromForm(children[i]);
            }
        }
        
        that.form.dataTree.removeMug(mug);
        that.form.controlTree.removeMug(mug);
    };

    that.removeMugFromForm = function (mug) {
        that._removeMugFromForm(mug);
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
   

    // DATA PARSING FUNCTIONS

    function parseDataTree (dataEl) {
        function parseDataElement (el) {
            var nodeID, nodeVal, mug, parentMug, extraXMLNS, keyAttr,mType,parentNodeName,rootNodeName,dataTree;
            
            nodeID = el.nodeName;
            mug = new mugs.DataBindOnly();
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

            mug.dataElement.nodeID = nodeID;
            mug.dataElement.dataValue = nodeVal;
            mug.bindElement.nodeID = nodeID;

            if(extraXMLNS && (extraXMLNS !== formdesigner.formUuid)) {
                mug.dataElement.xmlnsAttr = extraXMLNS;
            }
            if(keyAttr) {
                mug.dataElement.keyAttr = keyAttr;
            }
            // add arbitrary attributes
            mug.dataElement._rawAttributes = formdesigner.util.getAttributes(el);
            
            if ( parentNodeName === rootNodeName ) {
                parentMug = null;
            }else {
                parentMug = that.form.getMugByIDFromTree(parentNodeName,'data')[0];
            }

            dataTree.insertMug(mug,'into',parentMug);
        }
        var root = $(dataEl), recFunc;

        recFunc = function () {
                parseDataElement(this);
                $(this).children().each(recFunc);

        };

        if(root.children().length === 0) {
            that.addParseErrorMsg('Data block has no children elements! Please make sure your form is a valid JavaRosa XForm and try again!');
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
    
    function getLabelRef($lEl) {
        var ref = $lEl.attr('ref');
        return ref ? getITextReference(ref) : null;
    }

    var lookForNamespaced = function (element, reference) {
        // due to the fact that FF and Webkit store namespaced
        // values slightly differently, we have to look in 
        // a couple different places.
        return element.attr("jr:" + reference) || element.attr("jr\\:" + reference);
    };



    // CONTROL PARSING FUNCTIONS
    function parseLabel(lEl, mug) {
        var Itext = formdesigner.pluginManager.javaRosa.Itext;
        var $lEl = $(lEl),
            labelVal = formdesigner.util.getXLabelValue($lEl),
            labelRef = getLabelRef($lEl),
            cProps = mug.controlElement;
        var labelItext;
        cProps.label = labelVal;
        
        var newLabelItext = function (mug) {
            var item = new ItextItem({
                id: mug.getDefaultLabelItextId()
            });
            Itext.addItem(item);
            return item;
        };
        
        if (labelRef){
            labelItext = Itext.getOrCreateItem(labelRef);
        } else {
            // if there was a ref attribute but it wasn't formatted like an
            // itext reference, it's likely an error, though not sure what
            // we should do here for now just populate with the default
            labelItext = newLabelItext(mug);
        }
        
        cProps.labelItextID = labelItext;
        if (cProps.labelItextID.isEmpty()) {
            //if no default Itext has been set, set it with the default label
            if (labelVal) {
                cProps.labelItextID.setDefaultValue(labelVal);
            } else {
                // or some sensible deafult
                cProps.labelItextID.setDefaultValue(mug.getDefaultLabelValue());
            }
        }
    }

    function parseHint (hEl, mug) {
        var Itext = formdesigner.pluginManager.javaRosa.Itext;
        var $hEl = $(hEl),
            hintVal = formdesigner.util.getXLabelValue($hEl),
            hintRef = getLabelRef($hEl),
            cProps = mug.controlElement;

        if (hintRef) {
            cProps.hintItextID = Itext.getOrCreateItem(hintRef);
        } else {
            // couldn't parse the hint as itext.
            // just create an empty placeholder for it
            cProps.hintItextID = Itext.createItem(""); 
        }
        cProps.hintLabel = hintVal;
    }

    function parseDefaultValue (dEl, mug) {
        var dVal = formdesigner.util.getXLabelValue($(dEl)),
                cProps = mug.controlElement;
        if(dVal){
            cProps.defaultValue = dVal;
        }
    }

    function parseRepeatVals (r_count, r_noaddremove, mug) {
        if (r_count) {
            mug.controlElement.repeat_count = r_count;
        }

        if(r_noaddremove) {
            mug.controlElement.no_add_remove = r_noaddremove;
        }
    }

    function mugTypeFromInput (dataType, appearance) {
        if (!dataType) { 
            return mugs.Text; 
        }
        if(dataType === 'long') {
            return mugs.Long;
        }else if(dataType === 'int') {
            return mugs.Int;
        }else if(dataType === 'double') {
            return mugs.Double;
        }else if(dataType === 'geopoint') {
            return mugs.Geopoint;
        }else if(dataType === 'barcode') {
            return mugs.Barcode;
        }else if(dataType === 'intent') {
            return mugs.AndroidIntent;
        }else if(dataType === 'string') {
            if (appearance === "numeric") {
                return mugs.PhoneNumber;
            } else {
                return mugs.Text;
            }
        }else if(dataType === 'date') {
            return mugs.Date;
        }else if(dataType === 'datetime') {
            return mugs.DateTime;
        }else if(dataType === 'time') {
            return mugs.Time;
        }else {
            return mugs.Text;
        }
    }

    function mugTypeFromGroup (cEl) {
        if ($(cEl).attr('appearance') === 'field-list') {
            return mugs.FieldList;
        } else if ($(cEl).children('repeat').length > 0) {
            return mugs.Repeat;
        } else {
            return mugs.Group;
        }
    }

    function mugTypeFromUpload (mediaType, nodePath) {
        // todo: fix broken oldMug closure reference
        if(!mediaType) {
            throw 'Unable to parse binary question type. Path: ' +
                    that.form.dataTree.getAbsolutePath(oldMug) +
                    'The question has no MediaType attribute assigned to it!'
        }
        if (mediaType === 'video/*') {
            /* fix buggy eclipse syntax highlighter (because of above string) */ 
            return mugs.Video;
        } else if (mediaType === 'image/*') {
            /* fix buggy eclipse syntax highlighter (because of above string) */ 
            return mugs.Image;
        } else if (mediaType === 'audio/*') {
            /* fix buggy eclipse syntax highlighter (because of above string) */ 
            return mugs.Audio;
        } else {
            throw 'Unrecognized upload question type for Element: ' + nodePath + '!';
        }
    }

    /**
     * Determines what Mug this element should be
     * and creates it.  Also modifies any existing mug that is associated
     * with this element to fit the new type.
     * @param nodePath
     * @param controlEl
     */
    function classifyAndCreateMug (nodePath, cEl) {
        var oldMug = that.getMugByPath(nodePath, 'data'), //check the data node to see if there's a related Mug already present
            mug, tagName, bindEl, dataEl, dataType, appearance, MugClass, mediaType;
            //flags
            //hasBind = true;

        tagName = $(cEl)[0].nodeName;
        if (oldMug) {
            bindEl = oldMug.bindElement;
            if (bindEl) {
                dataType = bindEl.dataType;
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
                //hasBind = false;
            }
        }

        //broadly categorize
        tagName = tagName.toLowerCase();
        if(tagName === 'select') {
            MugClass = mugs.MSelect;
        }else if (tagName === 'select1') {
            MugClass = mugs.Select;
        }else if (tagName === 'trigger') {
            MugClass = mugs.Trigger;
        }else if (tagName === 'input') {
            if (cEl.attr('readonly') === 'true()') {
                MugClass = mugs.Trigger;
                cEl.removeAttr('readonly');
                //delete bindEl.dataType;
            } else {
                MugClass = mugTypeFromInput(dataType, appearance);
            }
        }else if (tagName === 'item') {
            MugClass = mugs.Item;
        }else if (tagName === 'group') {
            MugClass = mugTypeFromGroup(cEl);
            if (MugClass === mugs.Repeat) {
                tagName = 'repeat';
            }
        }else if (tagName === 'secret') {
            MugClass = mugs.Secret;
        }else if (tagName === 'upload') {
            MugClass = mugTypeFromUpload(mediaType, nodePath);
        } else {
            // unknown question type
            MugClass = mugs.ReadOnly;
        }
        
        // create new mug and copy old data to newly generated mug
        mug = new MugClass();
        if (oldMug) {
            mug.copyAttrs(oldMug);
            mug.ufid = oldMug.ufid;

            // replace in data tree
            that.form.replaceMug(oldMug, mug, 'data');
        }

        if (appearance) {
            mug.setAppearanceAttribute(appearance);
        }

        return mug;
    }
                
    function populateMug (mug, cEl) {
        var labelEl, hintEl, repeat_count, repeat_noaddremove;
        
        mug.populate(cEl);
        if (mug.__className === "ReadOnly") {
            mug.controlElementRaw = cEl;
            return;
        }
        

        var tag = mug.controlElement.tagName;
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
            parseLabel(labelEl, mug);
        }
        if (hintEl.length > 0) {
            parseHint (hintEl, mug);
        }
        if (tag === 'item') {
            parseDefaultValue($(cEl).children('value'),mug);
        }

        if (tag === 'repeat') {
            parseRepeatVals(repeat_count, repeat_noaddremove, mug);
        }

        formdesigner.intentManager.syncMugWithIntent(mug);
        
        // add any arbitrary attributes that were directly on the control
        mug.controlElement._rawAttributes = formdesigner.util.getAttributes(cEl);
    }
                
    //figures out if this control DOM element is a repeat
    function isRepeatTest(groupEl) {
        if($(groupEl)[0].tagName !== 'group') {
            return false;
        }
        return $(groupEl).children('repeat').length === 1;
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
                    return that.getSingularMugByNodeId(nodeId);
                } catch (err) {
                    // may be fine if this was a parent lookup, 
                    // or will fail hard later if this creates an illegal move
                    return null;
                }
            }
        }
        return null;
    };

    function parseControlTree (controlsTree) {
        var Itext = formdesigner.pluginManager.javaRosa.Itext;

        function eachFunc(){
            var el = $ ( this ), oldEl,
                path,
                mug,
                parentNode,
                parentMug,
                tagName,
                couldHaveChildren = ['repeat', 'group', 'fieldlist', 'select', 'select1'],
                children,
                bind,
                isRepeat;

            isRepeat = isRepeatTest(el);
            // do the repeat switch thing
            if(isRepeat) {
                oldEl = el;
                el = $(el.children('repeat')[0]);
            }

            parentNode = oldEl ? oldEl.parent() : el.parent();
            if($(parentNode)[0].nodeName === 'h:body') {
                parentNode = null;
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
                mug = classifyAndCreateMug(path, oldEl);
            } else {
                mug = classifyAndCreateMug(path, el);
            }
            populateMug(mug,el);
            that.form.controlTree.insertMug(mug, 'into', parentMug);
            if (mug.__className !== "ReadOnly") {
                tagName = mug.controlElement.tagName.toLowerCase();
                if(couldHaveChildren.indexOf(tagName) !== -1) {
                    children = $(el).children().not('label').not('value').not('hint');
                    children.each(eachFunc); //recurse down the tree
                }
                // update any remaining itext
                Itext.updateForExistingMug(mug);
            }
        }
        controlsTree.each(eachFunc);
    }

    // BIND PARSING FUNCTIONS

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

    function parseBindList (bindList) {
        var Itext = formdesigner.pluginManager.javaRosa.Itext;

        bindList.each(function () {
            var el = $(this),
                attrs = {},
                mug = new mugs.DataBindOnly(),
                path, nodeID, bindElement, oldMug;
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
           
            mug.bindElement.setAttrs(attrs, true);

            path = processPath(path,that.form.dataTree.getRootNode().getID());
            oldMug = that.getMugByPath(path,'data');
            if(!oldMug && attrs.nodeset) {
                oldMug = that.form.getMugByIDFromTree(
                                            formdesigner.util.getNodeIDFromPath(attrs.nodeset),
                                            'data'
                )[0];
            }
            if(!oldMug){
                that.addParseWarningMsg("Bind Node [" + path + "] found but has no associated Data node. This bind node will be discarded!");
//                    throw 'Parse error! Could not find Data Mug associated with this bind!'; //can't have a bind without an associated dataElement.
                return;
            }
            mug.ufid = oldMug.ufid;
            mug.dataElement.setAttrs(oldMug.dataElement);
            //mug.dataElement = oldMug.dataElement;
            // clear relevant itext for bind
            // this is ugly, and should be moved somewhere else
            if (oldMug.bindElement) {
                Itext.removeItem(oldMug.bindElement.constraintMsgItextID);
            }
            that.form.replaceMug(oldMug, mug, 'data');
        });
    }

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

    /**
     * The big daddy function of parsing.
     * Pass in the XML String and this function
     * will create all the right stuff in the trees
     * and set everything up for editing.
     * @param xmlString
     */
    var parseXML = function (xmlString) {

        that.fire('parse-start');
        try {
            var xmlDoc = $.parseXML(xmlString),
                xml = $(xmlDoc),
                head = xml.find('h\\:head, head'),
                title = head.children('h\\:title, title'),
                binds = head.find('bind'),
                instances = _getInstances(xml);

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
                that.addParseErrorMsg('No Data block was found in the form.  Please check that your form is valid!');
            }
           
            // parse itext first so all the other functions can access it
            formdesigner.pluginManager.call('beforeParse', xml);
            
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
     * Move a mug from its current place (in both the Data and Control trees) to
     * the position specified by the arguments,
     * @param mug - The mug to be moved
     * @param position - The position relative to the refMug (can be 'before','after' or 'into')
     * @param refMug
     */
    that.moveMug = function (mug, refMug, position) {
        function recursivelyGetChildren(mug) {
            var children = that.getChildren(mug), i;
            for (i = children.length - 1; i >= 0; i--) {
                children = children.concat(recursivelyGetChildren(children[i]))
            }
            return children;
        }
        var dataTree = that.form.dataTree, 
            controlTree = that.form.controlTree, 
            mugs = recursivelyGetChildren(mug).concat([mug]),
            preMovePaths = mugs.map(function(mug) {
                return dataTree.getAbsolutePath(mug);
            });

        if (mug.dataElement) {
            dataTree.insertMug(mug, position, refMug);
        }
        if (mug.controlElement) {
            controlTree.insertMug(mug, position, refMug);
        }

        var updates = {};
        for (var i = 0; i < mugs.length; i++) {
            updates[mugs[i].ufid] = [preMovePaths[i], dataTree.getAbsolutePath(mugs[i])];
        }

        formdesigner.model.LogicManager.updatePaths(updates);

        //fire a form-property-changed event to sync up with the 'save to server' button disabled state
        that.form.fire({
            type: 'form-property-changed'
        });
    };

    /**
     * Gets the label used to represent this mug in the UI tree
     */
    var getTreeLabel = function (mug) {
        var retVal = mug.getBindElementID() ? mug.getDataElementID() : mug.getBindElementID();
        if (!retVal) {
            retVal = mug.controlElement.label;
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

    that.getCurrentlySelectedMug = function () {
        var selected = formdesigner.ui.jstree('get_selected');

        if (!selected || !selected[0]) {
            var ret = null;
        } else {
            selected = selected[0];
            var ret = that.getMugFromFormByUFID($(selected).prop('id'));
        }
        return ret;
    };

    /**
     * @deprecated (OLD)
     * Sets the currently selected (in the UI tree) Mug
     * so that the controller is aware of the currently
     * being worked on mug without having to do the call
     * to the UI each time.
     *
     * @param ufid - UFID of the selected Mug
     */
    that.setCurrentlySelectedMug = function (ufid) {
        if (ufid) {
            formdesigner.ui.jstree('select_node', '#' + ufid);
        } else {
            formdesigner.ui.jstree('deselect_all');
        }
    };


    that.getMugFromFormByUFID = function (ufid) {
        return (that.form.dataTree.getMugFromUFID(ufid) ||
                that.form.controlTree.getMugFromUFID(ufid));
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
        
        var send = function (formText, saveType, callback) {
            var data;
            saveType = saveType || formdesigner.saveType;
            $('body').ajaxStart(formdesigner.ui.showWaitingDialog);
            $('body').ajaxStop(formdesigner.ui.hideConfirmDialog);

            if (saveType === 'patch') {
                var dmp = new diff_match_patch();
                var patch = dmp.patch_toText(
                    dmp.patch_make(formdesigner.originalXForm, formText)
                );
                // abort if diff too long and send full instead
                if (patch.length > formText.length) {
                    saveType = 'full';
                }
            }

            var url = getUrl(saveType);

            if (saveType === 'patch') {
                data = {
                    patch: patch,
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
                            send(formText, 'full', callback);
                            return;
                        } else {
                            if (CryptoJS.SHA1(formText).toString() !== data.sha1) {
                                console.error("sha1's didn't match");
                                send(formText, 'full', callback);
                                return;
                            }
                        }
                    }
                    formdesigner.ui.hideConfirmDialog();
                    formdesigner.fire({
                        type: 'form-saved',
                        response: data
                    });
                    formdesigner.originalXForm = formText;
                    if (callback) {
                        callback();
                    }
                }
            });
        };
        // presave form validation
        var renamed = that.form.normalizeQuestionIds();
        var callback;
        if (renamed.length > 0) {
            callback = function () {
                // show the person what renaming has happened
                var message = 'The following question IDs are duplicates and have been automatically renamed as follows:<br> ' +
                    _.map(renamed, function (array) {
                        var from = array[0];
                        var to = array[1];
                        return from + ' --> ' + to;
                    }).join('<br>');
                var $modal = formdesigner.ui.generateNewModal("Questions were renamed", [], "OK");
                $modal.find('.modal-body').append($('<p>' + message + '</p>'));
                $modal.modal('show');
                formdesigner.ui.displayMugProperties(renamed[0][2]);

            };
        }
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
                "Form Builder will NOT LOAD THIS FORM again until you fix the XML by hand. " +
                "What would you like to do?";
            formdesigner.ui.setDialogInfo(theScaryWarning,
                'Fix the problem (recommended)', function () {
                    $(this).dialog("close");
                },
                'Save Anyways', function () {
                    $(this).dialog("close");
                    send(formText, undefined, callback)
                },
                'Form Validation Error');
            formdesigner.ui.showConfirmDialog();
        }
        if (parsed) {
            send(formText, undefined, callback);

        }
    };

    that.resetFormDesigner = function () {
        formdesigner.util.question_counter = 1;

        formdesigner.model.reset();
        formdesigner.ui.reset();
    };

    function circularReferenceCheck(mug, path) {
        var group = $('#fd-xpath-editor').data("group");
        var property = $('#fd-xpath-editor').data("property");
        if (path === "." && group === "bindElement" &&
            (property === "relevantAttr" || property === "calculateAttr")) {

            var fieldName = mug.bindElement.__spec[property].lstring;
            that.form.updateError(formdesigner.model.FormError({
                level: "form-warning",
                message: "The " + fieldName + " for a question "
                    + "is not allowed to reference the question itself. "
                    + "Please remove the period from the " + fieldName
                    + " or your form will have errors."
            }), {updateUI: true});
        }
    }

    // tree drag and drop stuff, used by xpath
    var handleTreeDrop = function(source, target) {
        var target = $(target), sourceUid = $(source).attr("id");
        if (target) {
            var mug = that.form.getMugByUFID(sourceUid);
            var path = formdesigner.util.mugToXPathReference(mug);
            circularReferenceCheck(mug, path);
            // the .change fires the validation controls
            target.val(target.val() + path).change();
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
        var mug = that.getCurrentlySelectedMug();
        if (!options.cancel) {
            that.setMugPropertyValue(mug, options.group, options.property, options.value, mug) 
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

    that.syncMugWithIntent = function (mug) {
        // called when initializing a mug from a parsed form
        if (mug.__className === "AndroidIntent") {
            var nodeID = mug.dataElement.nodeID,
                tag = that.getParsedIntentTagWithID(nodeID);
            if (!tag) {
                var path = (mug.intentTag) ? mug.intentTag.path : null;
                tag = new ODKXIntentTag(nodeID, path);
            }
            mug.intentTag = tag;
            delete that.unmappedIntentTags[tag.initialNodeID];
        }
    };

    that.writeIntentXML = function (xmlWriter, dataTree) {
        // make sure any leftover intent tags are still kept
        _.each(that.unmappedIntentTags, function (tag) {
           tag.writeXML(xmlWriter, null);
        });

        var intents,
            getIntentMugs = function(node) {
                var mug = node.getValue();
                if (!mug || node.isRootNode) {
                    return null;
                }
                if (mug.bindElement && mug.bindElement.dataType == 'intent') {
                    return mug;
                } else {
                    return null;
                }
            };
        intents = dataTree.treeMap(getIntentMugs);
        if (intents.length > 0) {
            xmlWriter.writeComment('Intents inserted by Vellum:');
            intents.map(function (intentMug) {
                intentMug.intentTag.writeXML(xmlWriter, intentMug.dataElement.nodeID);
            });
        }
    };

    return that;
})();
