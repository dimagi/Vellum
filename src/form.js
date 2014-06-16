define([
    'require',
    'vellum/tree',
    'vellum/logic',
    'vellum/intentManager',
    'vellum/widgets',
    'vellum/util'
], function (
    require,
    Tree,
    logic,
    intents,
    widgets,
    util
) {
    // Load these dependencies in the background after all other run-time
    // dependencies have been resolved, since they shouldn't be necessary
    // initially.
    var writer,
        exporter;
    require(['vellum/writer', 'vellum/exporter'], function (w, e) {
        writer = w;
        exporter = e;
    });

    var FormError = function (options) {
        var that = {};
        that.message = options.message;
        // the key is how uniqueness is determined
        that.key = options.key; 
        that.level = options.level || "form-warning";
        that.options = options;
        
        that.isMatch = function (other) {
            if (this.key && other.key) {
                return this.key === other.key;
            }
            return false;
        };
        
        return that;
    };
    
    var InstanceMetadata = function (attributes, children) {
        var that = {};
        that.attributes = attributes;
        that.children = children || [];
        return that;
    };

    function convertToId(str) {
        return str
            .toLowerCase()
            .replace(/ /g,'_')
            .replace(/[^\w-]+/g,'');
    }

    function Form (opts, vellum, mugTypes) {
        var _this = this;
        this.externalInstances = {};

        this._logicManager = new logic.LogicManager(this, {
                allowedDataNodeReferences: opts.allowedDataNodeReferences
            });

        // Some things in the mug methods depend on the UI.  These should
        // eventually be refactored out.
        this.vellum = vellum;
        this.mugTypes = mugTypes;
        this.intentManager = intents.IntentManager(this);

        this.formName = 'New Form';
        this.dataTree = new Tree('data', 'data');
        this.dataTree.on('change', function (e) {
            _this.fireChange(e.mug);
        });
        this.controlTree = new Tree('data', 'control');
        this.controlTree.on('change', function (e) {
            _this.fireChange(e.mug);
        });
        this.instanceMetadata = [InstanceMetadata({})];
        this.errors = [];
        
        this.processInstancesConfig(opts.externalInstances);
        this.question_counter = 1;
        
        //make the object event aware
        util.eventuality(this);
    }
    Form.prototype = {
        fireChange: function (mug) {
            this.fire({
                type: 'change',
                mug: mug
            });
        },
        processInstancesConfig: function (instances) {
            var _this = this;
            // set instance id, can be overridden at parse time if an instance with a
            // different ID has the expected src URI.  Also add an index to each subset
            // type which can be used as a key to reference that subset.
            this.externalInstances = {};
            _.each(instances, function (instance) {
                _this.addInstance(instance);
            });
        },
        addInstance: function (instance) {
            instance.defaultId = instance.defaultId || convertToId(instance.sourceUri);
            instance.id = instance.defaultId;
            _.each(instance.levels, function (level) {
                var i = 1,
                    mappedSubsets = {};
                _.each(level.subsets, function (subset) {
                    subset.id = i++;
                    mappedSubsets[subset.id] = subset;
                });
                level.subsets = mappedSubsets;
            });
            this.externalInstances[instance.id] = instance;
            return instance;
        },
        setFormID: function (id) {
            this.dataTree.setRootID(id);
            this.controlTree.setRootID(id);
        },
        setAttr: function (slug, val) {
            this[slug] = val;
            this.fire({
                type: 'change'
            });
        },
        createXML: function () {
            return writer.createXForm(this);
        },
        /**
         * Loops through the data and the control trees and picks out all the
         * unique bind elements.  Returns a list of Mugs
         */
        getBindList: function(){
            var bList = [],
                dataTree,controlTree,dBindList,cBindList,i,
                getBind = function(node){ //the function we will pass to treeMap
                    if(!node.getValue() || node.isRootNode){
                        return null;
                    }
                    var mug = node.getValue(),
                        bind;
                    if(!mug.bindElement){
                        return null;
                    }else{
                        bind = mug;
                        return bind;
                    }
                };

            dataTree = this.dataTree;
            controlTree = this.controlTree;
            dBindList = dataTree.treeMap(getBind);
            cBindList = controlTree.treeMap(getBind);

            //compare results, grab uniques
            for(i in dBindList){
                if(dBindList.hasOwnProperty(i)){
                    bList.push(dBindList[i]);
                }
            }

            for(i in cBindList){
                if(cBindList.hasOwnProperty(i)){
                    if(bList.indexOf(cBindList[i]) === -1){
                        bList.push(cBindList[i]); //grab only anything that hasn't shown up in the dBindList
                    }
                }
            }
            return bList;
        },
        /**
         * Goes through and grabs all of the data nodes (i.e. nodes that are only data nodes (possibly with a bind) without any
         * kind of control.  Returns a flat list of these nodes (list items are mugs).
         */
        getDataNodeList: function () {
            return this.dataTree.treeMap(function(node){
                if (!node.getValue() || node.isRootNode) {
                    return null;
                }
                var mug = node.getValue();

                if (mug.controlElement) {
                    return null;
                } else {
                    return mug;
                }
            });
        },
        /**
         * Walks through both internal trees (data and control) and grabs
         * all mugs that are not (1)Choices.  Returns
         * a flat list of unique mugs.  This list is primarily fo the
         * autocomplete skip logic wizard.
         */
        getMugList: function (includeSelectItems) {
            var cTree, dTree, treeFunc, cList, dList, mergeList;

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

            cList = this.controlTree.treeMap(treeFunc);
            dList = this.dataTree.treeMap(treeFunc);

            return util.mergeArray(cList, dList); //strip dupes and merge
        },
        getInvalidMugs: function () {
            var mugListC, mugListD, result, controlTree, dataTree,
                mapFunc = function (node) {
                    if (node.isRootNode) {
                        return;
                    }

                    var mug = node.getValue();

                    if(!mug.isValid()){
                        return mug;
                    }else{
                        return null;
                    }
                };

            dataTree = this.dataTree;
            controlTree = this.controlTree;
            mugListC = controlTree.treeMap(mapFunc);
            mugListD = dataTree.treeMap(mapFunc);
            result = util.mergeArray(mugListC, mugListD);

            return result;
        },
        /**
         * Goes through both trees and picks out all the invalid
         * Mugs and returns a dictionary with the mug.ufid as the key
         * and the validation object as the value
         */
        getInvalidMugUFIDs: function () {
            var badMugs = this.getInvalidMugs(), result = {}, i;
            for (i in badMugs){
                if(badMugs.hasOwnProperty(i)){
                    result[badMugs[i].ufid] = badMugs[i].getErrors();
                }
            }
            return result;
        },
        addInstanceIfNotExists: function (attrs) {
            var hasInstance = _.any(this.instanceMetadata, function (m) {
                return m.attributes.src === attrs.src;
            });
            if (!hasInstance) {
                this.instanceMetadata.push(InstanceMetadata({
                    src: attrs.src,
                    id: attrs.id
                }));
            }
        },
        updateError: function (errObj, options) {
            errObj = FormError(errObj);
            options = options || {};
            if (!errObj.key) {
                this.errors.push(errObj);
            }
            else {
                var removed = null;
                for (var i = 0; i < this.errors.length; i++) {
                    if (errObj.isMatch(this.errors[i])) {
                        removed = this.errors.splice(i, 1, errObj);
                    }
                }
                if (!removed) {
                    this.errors.push(errObj);
                }
            }
            this.fire({
                type: 'error-change',
                errors: this.errors
            });
        },
        clearErrors: function (type, options) {
            var filterFn = function (err) {
                return err.level !== type;
            };
            options = options || {};
            for (var i = 0; i < this.errors.length; i++) {
                this.errors = this.errors.filter(filterFn);
            }
            this.fire({
                type: 'error-change',
                errors: this.errors
            });
        },
        clearError: function (errObj, options) {
            errObj = FormError(errObj);
            options = options || {};
            var removed = null;
            for (var i = 0; i < this.errors.length; i++) {
                if (errObj.isMatch(this.errors[i])) {
                    removed = this.errors.splice(i, 1);
                    break;
                }
            }
            if (removed) {
                this.fire({
                    type: 'error-change',
                    errors: this.errors
                });
            }
        },
        /**
         * Goes through all mugs (in data and control tree)
         * to determine if all mugs are Valid and ok for form creation.
         */
        isFormValid: function () {
            return this.dataTree.isTreeValid() && this.controlTree.isTreeValid();
        },
        getMugChildByNodeID: function (mug, nodeID) {
            var parentNode = (mug ? this.dataTree.getNodeFromMug(mug)
                                  : this.dataTree.rootNode),
                childMugs = parentNode.getChildrenMugs(),
                matchingIdMugs = _.filter(childMugs, function (m) {
                    return m.dataElement.nodeID === nodeID;
                });
            if (matchingIdMugs.length) {
                return matchingIdMugs[0];
            } else {
                return null;
            }
        },
        insertMug: function (refMug, newMug, position) {
            if (newMug.dataElement) {
                this.dataTree.insertMug(newMug, position, refMug);
            }

            if (newMug.controlElement) {
                this.controlTree.insertMug(newMug, position, refMug);
            }
        },
        /**
         * Replace a Mug that already exists in a tree with a new
         * one.  It is up to the caller to ensure that the MT
         * ufids and other properties match up as required.
         * Use with caution.
         * @param oldMug
         * @param newMug
         * @param treeType
         *
         * @return - true if a replacement occurred. False if no match was found for oldMug
         */
        replaceMug: function (oldMug, newMug, treeType){
            var tree = treeType === 'data' ? this.dataTree : this.controlTree;
            tree.treeMap(function (node) {
                if(node.getValue() === oldMug){
                    node.setValue(newMug);
                    // todo: encapsulate this better with same property
                    // references in Form.insertMug() and Form.getNodeFromMug()
                    newMug['_node_' + treeType] = node;
                }
            });
            newMug.parentMug = oldMug.parentMug;
        },
        /**
         * Move a mug from its current place (in both the Data and Control trees) to
         * the position specified by the arguments,
         */
        moveMug: function (mug, refMug, position) {
            var _this = this,
                mugs = this.getDescendants(mug).concat([mug]),
                preMovePaths = mugs.map(function(mug) {
                    return _this.dataTree.getAbsolutePath(mug);
                });

            if (mug.dataElement) {
                this.dataTree.insertMug(mug, position, refMug);
            }
            if (mug.controlElement) {
                this.controlTree.insertMug(mug, position, refMug);
            }
            
            var updates = {};
            for (var i = 0; i < mugs.length; i++) {
                updates[mugs[i].ufid] = [
                    preMovePaths[i], 
                    this.dataTree.getAbsolutePath(mugs[i])
                ];
            }

            this._logicManager.updatePaths(updates);
            this.fire({
                type: 'question-move',
                mug: mug
            });
            this.fireChange(mug);
        },
        getDescendants: function (mug) {
            var desc = this.getChildren(mug), i;
            for (i = desc.length - 1; i >= 0; i--) {
                desc = desc.concat(this.getDescendants(desc[i]));
            }
            return desc;
        },
        // core interface methods
        handleMugRename: function (mug, val, previous, currentPath, oldPath) {
            this._logicManager.updatePath(mug.ufid, oldPath, currentPath);
        },
        changeQuestionType: function (mug, questionType) {
            // check preconditions - if this is a select question with
            // choices, you're only allowed to change it to another
            // select question
            var _this = this,
                children = this.getChildren(mug);
            if (children.length > 0 && (
                    questionType.indexOf("Select") === -1 || 
                    questionType.indexOf("Dynamic") !== -1)) 
            {
                    throw "you can't change a Multiple/Single Choice question to a non-Choice " +
                          "question if it has Choices. Please remove all Choices " +
                          "and try again.";
            }
            
            var newMug = this.mugTypes.make(questionType, this);
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

            // update trees
            this.replaceMug(mug, newMug, 'data');
            this.replaceMug(mug, newMug, 'control');

            newMug.copyAttrs(mug);
            
            if (newMug.__className.indexOf("Select") !== -1) {
                _.each(this.getChildren(newMug), function (childMug) {
                    _this.fire({
                        type: 'parent-question-type-change',
                        childMug: childMug
                    });
                });
            }

            this.fire({
                type: 'question-type-change',
                qType: questionType,
                mug: newMug
            });
            this.fireChange(newMug);

            return newMug;
        },
        getChildren: function (mug) {
            var node = this.controlTree.getNodeFromMug(mug),
                children = node ? node.getChildren() : [];  // handles data node
            return children.map(function (item) { return item.getValue();});
        },
        duplicateMug: function (mug) {
            var foo = this._duplicateMug(mug, mug.parentMug),
                duplicate = foo[0],
                pathReplacements = foo[1];

            if (typeof _gaq !== "undefined") {
               _gaq.push(['_trackEvent', 'Form Builder', 'Copy', foo[0].typeName]);
            }

            for (var i = 0; i < pathReplacements.length; i++) {
                var pr = pathReplacements[i];
                this._logicManager.updatePath(pr.mugId, pr.from, pr.to, 
                    this.getAbsolutePath(duplicate));
            }
            return duplicate;
        },
        /**
         * Copy a Mug and its descendants and insert them after the original
         * Mug. Returns an array with two values:
         *  1. The duplicate Mug.
         *  2. An array of path replacements that should be executed on logic references.
         *
         * @param mug - the mugtype in the original tree to duplicate
         * @param parentMug - the mugtype in the duplicate tree to insert into
         *        
         */
        _duplicateMug: function (mug, parentMug, depth) {
            depth = depth || 0;
            // clone mug and give everything new unique IDs
            var duplicate = this.mugTypes.make(mug.__className, this);
            duplicate.copyAttrs(mug);

            // ensure consistency            
            duplicate.ufid = util.get_guid();
            // clear existing event handlers for the source question
            util.eventuality(duplicate);

            if (depth === 0 && mug.bindElement && mug.bindElement.nodeID) {
                var newQuestionID = this.generate_question_id(
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
                var newItemValue = this.generate_question_id(
                    mug.controlElement.defaultValue
                );
                duplicate.controlElement.defaultValue = newItemValue;
            }
         
            // insert mugtype into data and UI trees
            if (depth > 0) {
                this.insertQuestion(duplicate, parentMug, 'into', true);
            } else {
                this.insertQuestion(duplicate, mug, 'after', true);
            }

            this._logicManager.updateAllReferences(duplicate);

            duplicate.unlinkItext();

            var children = this.getChildren(mug),
                pathReplacements = [];
            for (var i = 0; i < children.length; i++) {
                pathReplacements = pathReplacements.concat(
                    this._duplicateMug(children[i], duplicate, depth + 1)[1]);
            }

            pathReplacements.push({
                mugId: mug.ufid,
                from: this.getAbsolutePath(mug),
                to: this.getAbsolutePath(duplicate)
            });

            return [duplicate, pathReplacements];
        },
        updateAllLogicReferences: function (mug) {
            this._logicManager.updateAllReferences(mug);
        },
        handleMugPropertyChange: function (mug, e) {
            // bind dataElement.nodeID and bindElement.nodeID together
            if(e.property === 'nodeID'){
                if(mug.dataElement){
                    mug.dataElement.nodeID = e.val;
                }
                if(mug.bindElement){
                    mug.bindElement.nodeID = e.val;
                }
            }
            
            // update the logic properties that reference the mug
            if (e.property === 'nodeID') {
                var currentPath = this.getAbsolutePath(mug),
                    parsed = xpath.parse(currentPath);
                parsed.steps[parsed.steps.length - 1].name = e.previous;
                var oldPath = parsed.toXPath();
                this.handleMugRename(mug, e.val, e.previous, currentPath, oldPath);
            } else {
                var propertyPath = [e.element, e.property].join("/");

                if (mug.getPropertyDefinition(propertyPath).widget === widgets.xPath) {
                    this.updateAllLogicReferences(mug, propertyPath);
                }
            }

            // update the itext ids of child items if they weren't manually set
            if (e.property === "nodeID" && 
                (mug.__className === "Select" || mug.__className === "MSelect")) 
            {
                var node = this.controlTree.getNodeFromMug(mug),
                    children = node.getChildrenMugs();
            
                var setNodeID = function (val) {
                    mug.dataElement.nodeID = val;
                    mug.bindElement.nodeID = val;
                };

                for (var i = 0; i < children.length; i++) {
                    var child = children[i];

                    // Temporarily set select's nodeID to old value so we can
                    // test whether the old item's itext id was autogenerated.
                    setNodeID(e.previous);
                    if (child.controlElement.labelItextID.id === child.getDefaultLabelItextId()) {
                        setNodeID(e.val);
                        child.setItextID(child.getDefaultLabelItextId());
                    } else {
                        setNodeID(e.val);
                    }
                }
            }

            if (e.property === 'nodeID' && e.element === 'dataElement') {
                var newNameForTree = '[' + e.val +']';
                if (e.val && (
                    mug.__className === "DataBindOnly" ||
                        (!mug.controlElement || !mug.controlElement.labelItextID || 
                         (mug.controlElement.labelItextID && mug.controlElement.labelItextID.isEmpty()) ))
                ) {
                    this.fire({
                        type: 'question-text-change',
                        mugUfid: e.mugUfid,
                        text: newNameForTree
                    });
                }
            }

            this.fire({
                type: 'mug-property-change',
                mug: mug,
                e: e
            });


            this.fireChange(mug);
        },
        createQuestion: function (refMug, position, newMugType, isInternal) {
            var mug = this.mugTypes.make(newMugType, this);
            this.insertQuestion(mug, refMug, position, isInternal);
            if (mug.isODKOnly) {
                this.updateError({
                    message: 'This question type will ONLY work with Android phones!',
                    level: 'form-warning'
                });
            }
        },
        insertQuestion: function (mug, refMug, position, isInternal) {
            refMug = refMug || this.dataTree.getRootNode().getValue();
            this.insertMug(refMug, mug, position);
            // todo: abstraction barrier
            this.vellum.data.javaRosa.Itext.updateForNewMug(mug);
            this.intentManager.syncMugWithIntent(mug);

            this.fire({
                type: 'question-create',
                mug: mug,
                refMug: refMug,
                position: position,
                isInternal: isInternal
            });
            if (!isInternal) {
                mug.afterInsert(this, mug);
            }
        },
        getAbsolutePath: function (mug, excludeRoot) {
            return this.dataTree.getAbsolutePath(mug, excludeRoot);
        },
        getMugByUFID: function (ufid) {
            return (this.dataTree.getMugFromUFID(ufid) ||
                    this.controlTree.getMugFromUFID(ufid));
        },
        getMugByPath: function (path) {
            var recFunc, tokens, targetMug,
                rootNode = this.dataTree.getRootNode();
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

                //if we got here this means 'path not found'
                return null;
            };

            tokens = path.split('/').slice(1);
            if (tokens.length === 0) {
                return null; //empty path string === 'path not found'
            }

            if(rootNode.getID() !== tokens[0]) {
                return null; //path not found
            }

            targetMug = recFunc(rootNode,tokens.slice(1));
            return targetMug;
        },
        removeMugFromForm: function (mug) {
            this._removeMugFromForm(mug, false);
        },
        _removeMugFromForm: function(mug, isInternal) {
            var fromTree = this.controlTree.getNodeFromMug(mug);
            if (fromTree) {
                var children = this.controlTree.getNodeFromMug(mug).getChildrenMugs();
                for (var i = 0; i < children.length; i++) {
                    this._removeMugFromForm(children[i], true);
                }
            }
            
            this.dataTree.removeMug(mug);
            this.controlTree.removeMug(mug);
            this.fire({
                type: 'remove-question',
                mug: mug,
                isInternal: isInternal
            });
        },
        questionIdCount: function (qId) {
            var allMugs = this.getMugList(),
                count = 0;
            for (var i = 0; i < allMugs.length; i++) {
                var mug = allMugs[i];
                if (mug.dataElement && qId === mug.dataElement.nodeID) {
                    count++; 
                }
            }

            return count;
        },

        /**
         * Generates a unique question ID (unique in this form) and
         * returns it as a string.
         */
        generate_question_id: function (question_id) {
            if (question_id) {
                var match = /^copy-(\d+)-of-(.+)$/.exec(question_id) ;
                if (match) {
                    question_id = match[2]; 
                }
                for (var i = 1;; i++) {
                    var new_id = "copy-" + i + "-of-" + question_id;
                    if (!this.questionIdCount(new_id)) {
                        return new_id; 
                    }
                }
            } else {
                return this._make_label('question');
            }
        },
        generate_item_label: function () {
            return this._make_label('item');
        },
        /**
         * Private method for constructing unique questionIDs, labels for items, etc
         */
        _make_label: function (prefixStr) {
            var ret = prefixStr + this.question_counter;
            this.question_counter += 1;
            return ret;
        },
        getExportTSV: function () {
            this.vellum.beforeSerialize();
            return exporter.generateExportTSV(this);
        }
    };

    return {
        "Form": Form,
        "InstanceMetadata": InstanceMetadata
    };
});
