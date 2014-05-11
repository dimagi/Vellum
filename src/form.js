define([
    './tree',
    './mugs',
    './logic',
    './intentManager',
    './writer',
    './widgets',
    './exporter',
    './util'
], function (
    Tree,
    mugs,
    logic,
    intents,
    writer,
    widgets,
    exporter,
    util
) {
    var mugTypes = mugs.mugTypes;
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

    var Form = function (opts, vellum) {
        var that = {
            externalInstances: {}
        },
            dataTree, controlTree;

        var logicManager = new logic.LogicManager(that, {
                allowedDataNodeReferences: opts.allowedDataNodeReferences
            }),
            fireChange = function (mug) {
                that.fire({
                    type: 'change',
                    mug: mug
                });
            };

        // Some things in the mug methods depend on the UI.  These should
        // eventually be refactored out.
        that.vellum = vellum;
        that.intentManager = intents.IntentManager(that);

        that.formName = 'New Form';
        that.dataTree = dataTree = new Tree('data', 'data');
        that.dataTree.on('change', function (e) {
            fireChange(e.mug);
        });
        that.controlTree = controlTree = new Tree('data', 'control');
        that.controlTree.on('change', function (e) {
            fireChange(e.mug);
        });
        that.instanceMetadata = [InstanceMetadata({})];
        that.errors = [];
        
        //make the object event aware
        util.eventuality(that);
        
        that.processInstancesConfig = function (instances) {
            // set instance id, can be overridden at parse time if an instance with a
            // different ID has the expected src URI.  Also add an index to each subset
            // type which can be used as a key to reference that subset.
            that.externalInstances = {};
            _.each(instances, function (instance) {
                that.addInstance(instance);
            });
        };

        that.addInstance = function (instance) {
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
            that.externalInstances[instance.id] = instance;
            return instance;
        };

        that.processInstancesConfig(opts.externalInstances);

        function convertToId(str) {
            return str
                .toLowerCase()
                .replace(/ /g,'_')
                .replace(/[^\w-]+/g,'');
        }

        that.setFormID = function (id) {
            that.dataTree.setRootID(id);
            that.controlTree.setRootID(id);
        };

        that.setAttr = function (slug, val) {
            that[slug] = val;
            that.fire({
                type: 'change'
            });
        };

        that.createXML = function () {
            return writer.createXForm(that);
        };

        /**
         * Loops through the data and the control trees and picks out all the
         * unique bind elements.  Returns a list of Mugs
         */
        that.getBindList = function(){
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
        };

        /**
         * Goes through and grabs all of the data nodes (i.e. nodes that are only data nodes (possibly with a bind) without any
         * kind of control.  Returns a flat list of these nodes (list items are mugs).
         */
        that.getDataNodeList = function () {
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
        };
        
        /**
         * Walks through both internal trees (data and control) and grabs
         * all mugs that are not (1)Choices.  Returns
         * a flat list of unique mugs.  This list is primarily fo the
         * autocomplete skip logic wizard.
         */
        that.getMugList = function (includeSelectItems) {
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
        };

        /**
         * Searches through BOTH trees and returns
         * a mug if found (null if nothing found)
         */
        that.getMugByUFID = function (ufid) {
            var mug = dataTree.getMugFromUFID(ufid);
            if(!mug) {
                mug = controlTree.getMugFromUFID(ufid);
            }

            return mug;
        };

        that.getInvalidMugs = function () {
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
        };

        /**
         * Goes through both trees and picks out all the invalid
         * Mugs and returns a dictionary with the mug.ufid as the key
         * and the validation object as the value
         */
        that.getInvalidMugUFIDs = function () {
            var badMugs = this.getInvalidMugs(), result = {}, i;
            for (i in badMugs){
                if(badMugs.hasOwnProperty(i)){
                    result[badMugs[i].ufid] = badMugs[i].getErrors();
                }
            }
            return result;
        };
    

        that.addInstanceIfNotExists = function (attrs) {
            var hasInstance = _.any(that.instanceMetadata, function (m) {
                return m.attributes.src == attrs.src;
            });
            if (!hasInstance) {
                that.instanceMetadata.push(InstanceMetadata({
                    src: attrs.src,
                    id: attrs.id
                }));
            }
        };
        
        that.updateError = function (errObj, options) {
            errObj = FormError(errObj);
            options = options || {};
            if (!errObj.key) {
                that.errors.push(errObj);
            }
            else {
                var removed = null;
                for (var i = 0; i < that.errors.length; i++) {
                    if (errObj.isMatch(that.errors[i])) {
                        removed = that.errors.splice(i, 1, errObj);
                    }
                }
                if (!removed) {
                    that.errors.push(errObj);
                }
            }
            that.fire({
                type: 'error-change',
                errors: that.errors
            });
        };
        
        that.clearErrors = function (type, options) {
            options = options || {};
            for (var i = 0; i < that.errors.length; i++) {
                that.errors = that.errors.filter(function (err) {
                    return err.level !== type;
                });
            }
            that.fire({
                type: 'error-change',
                errors: that.errors
            });
        };
        
        
        that.clearError = function (errObj, options) {
            options = options || {};
            var removed = null;
            for (var i = 0; i < that.errors.length; i++) {
                if (errObj.isMatch(that.errors[i])) {
                    removed = that.errors.splice(i, 1);
                    break;
                }
            }
            if (removed) {
                that.fire({
                    type: 'error-change',
                    errors: that.errors
                });
            }
        };
        

        /**
         * Goes through all mugs (in data and control tree)
         * to determine if all mugs are Valid and ok for form creation.
         */
        that.isFormValid = function () {
            return this.dataTree.isTreeValid() && this.controlTree.isTreeValid();
        };

        /**
         * Searches through the dataTree for a mug
         * that matches the given nodeID (e.g. mug.dataElement.nodeID)
         *
         * WARNING:
         * Some Mugs (such as for example 'Items' or 'Triggers' or certain 'Group's may not have
         * any nodeID at all (i.e. no bind element and no data element)
         * in such cases... other methods need to be used as this method will not find a match.
         * @param nodeID
         */
        that.getMugsByNodeID = function (nodeID) {
            var mapFunc = function (node) {
                if(node.isRootNode){
                    return;
                }
                var mug = node.getValue(),
                    thisDataNodeID, thisBindNodeID;
                if (mug.dataElement) {
                    thisDataNodeID = mug.dataElement.nodeID;
                }
                if (mug.bindElement){
                    thisBindNodeID = mug.bindElement.nodeID;
                }
                if (!thisDataNodeID && !thisBindNodeID){
                    return; //this mug just has no nodeID :/
                }

                if(thisDataNodeID === nodeID || thisBindNodeID === nodeID){
                    return mug;
                }
            };

            return dataTree.treeMap(mapFunc);
        };

        that.getMugChildByNodeID = function (mug, nodeID) {
            var mugs = that.getMugsByNodeID(nodeID),
                siblingMugs = _.filter(mugs, function (m) {
                    return m.parentMug === mug;
                });
            if (siblingMugs.length) {
                return siblingMugs[0];
            } else {
                return null;
            }
        };
        
        that.insertMug = function (refMug, newMug, position) {
            if (newMug.dataElement && !newMug.controlElement) {
                // data node, stick it at the end of the form by default
                that.dataTree.insertMug(newMug, 'after', null);
                return;
            }
            
            position = position || "into";

            if (newMug.dataElement) {
                that.dataTree.insertMug(newMug, position, refMug);
            }

            if (newMug.controlElement) {
                that.controlTree.insertMug(newMug, position, refMug);
            }
        };
        

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
        that.replaceMug = function (oldMug, newMug, treeType){
            var tree = treeType === 'data' ? dataTree : controlTree;
            tree.treeMap(function (node) {
                if(node.getValue() === oldMug){
                    node.setValue(newMug);
                }
            });
            newMug.parentMug = oldMug.parentMug;
        };
        
        /**
         * Move a mug from its current place (in both the Data and Control trees) to
         * the position specified by the arguments,
         */
        that.moveMug = function (mug, refMug, position) {
            var mugs = getDescendants(mug).concat([mug]),
                preMovePaths = mugs.map(function(mug) {
                    return that.dataTree.getAbsolutePath(mug);
                });

            if (mug.dataElement) {
                that.dataTree.insertMug(mug, position, refMug);
            }
            if (mug.controlElement) {
                that.controlTree.insertMug(mug, position, refMug);
            }
            
            var updates = {};
            for (var i = 0; i < mugs.length; i++) {
                updates[mugs[i].ufid] = [preMovePaths[i], dataTree.getAbsolutePath(mugs[i])];
            }

            logicManager.updatePaths(updates);
            that.fire({
                type: 'question-move',
                mug: mug
            });
            fireChange(mug);
        };

        function getDescendants(mug) {
            var desc = that.getChildren(mug), i;
            for (i = desc.length - 1; i >= 0; i--) {
                desc = desc.concat(getDescendants(desc[i]));
            }
            return desc;
        }

        

        // core interface methods
        that.handleMugRename = function (mug, val, previous, currentPath, oldPath) {
            logicManager.updatePath(mug.ufid, oldPath, currentPath);
        };
        
        that.changeQuestionType = function (mug, questionType) {
            // check preconditions - if this is a select question with
            // choices, you're only allowed to change it to another
            // select question
            var children = that.getChildren(mug);
            if (children.length > 0 && (
                    questionType.indexOf("Select") === -1 || 
                    questionType.indexOf("Dynamic") !== -1)) 
            {
                    throw "you can't change a Multiple/Single Choice question to a non-Choice " +
                          "question if it has Choices. Please remove all Choices " +
                          "and try again.";
            }
            
            var newMug = new mugTypes[questionType](that);
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
            that.replaceMug(mug, newMug, 'data');
            that.replaceMug(mug, newMug, 'control');

            newMug.copyAttrs(mug);
            
            if (newMug.__className.indexOf("Select") !== -1) {
                _.each(that.getChildren(newMug), function (childMug) {
                    that.fire({
                        type: 'parent-question-type-change',
                        childMug: childMug
                    });
                });
            }

            that.fire({
                type: 'question-type-change',
                qType: questionType,
                mug: newMug
            });
            fireChange(newMug);

            return newMug;
        };
        
        that.getChildren = function (mug) {
            var node = that.controlTree.getNodeFromMug(mug),
                children = node ? node.getChildren() : [];  // handles data node
            return children.map(function (item) { return item.getValue();});
        };
        
        that.duplicateMug = function (mug, options) {
            options = options || {};
            options.itext = options.itext || "link";

            var foo = _duplicateMug(mug, mug.parentMug, options),
                duplicate = foo[0],
                pathReplacements = foo[1];

            if (typeof _gaq !== "undefined") {
               _gaq.push(['_trackEvent', 'Form Builder', 'Copy', foo[0].typeName]);
            }

            for (var i = 0; i < pathReplacements.length; i++) {
                var pr = pathReplacements[i];
                logicManager.updatePath(pr.mugId, pr.from, pr.to, 
                    that.getAbsolutePath(duplicate));
            }

            return duplicate;
        };
            
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
        function _duplicateMug(mug, parentMug, options, depth) {
            depth = depth || 0;
            // clone mug and give everything new unique IDs
            var duplicate = new mugTypes[mug.__className](that);
            duplicate.copyAttrs(mug);

            // ensure consistency            
            duplicate.ufid = util.get_guid();
            // clear existing event handlers for the source question
            util.eventuality(duplicate);

            if (mug.bindElement && mug.bindElement.nodeID) {
                var newQuestionID = that.generate_question_id(
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
                var newItemValue = that.generate_question_id(
                    mug.controlElement.defaultValue
                );
                duplicate.controlElement.defaultValue = newItemValue;
            }
         
            // insert mugtype into data and UI trees
            if (depth > 0) {
                that.insertQuestion(duplicate, parentMug, 'into', true);
            } else {
                that.insertQuestion(duplicate, mug, 'after', true);
            }

            logicManager.updateAllReferences(duplicate);

            if (options.itext === "copy") {
                duplicate.unlinkItext();
            }

            var children = that.getChildren(mug),
                pathReplacements = [];
            for (var i = 0; i < children.length; i++) {
                pathReplacements = pathReplacements.concat(
                    _duplicateMug(children[i], duplicate, options, depth + 1)[1]);
            }

            pathReplacements.push({
                mugId: mug.ufid,
                from: that.getAbsolutePath(mug),
                to: that.getAbsolutePath(duplicate)
            });

            return [duplicate, pathReplacements];
        }

        that.updateAllLogicReferences = function (mug) {
            logicManager.updateAllReferences(mug);
        };

        that.handleMugPropertyChange = function (mug, e) {
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
                var currentPath = mug.form.getAbsolutePath(mug),
                    parsed = xpath.parse(currentPath);
                parsed.steps[parsed.steps.length - 1].name = e.previous;
                var oldPath = parsed.toXPath();
                mug.form.handleMugRename(mug, e.val, e.previous, currentPath, oldPath);
            } else {
                var propertyPath = [e.element, e.property].join("/");

                if (mug.getPropertyDefinition(propertyPath).widget === widgets.xPath) {
                    that.updateAllLogicReferences(mug, propertyPath);
                }
            }

            // update the itext ids of child items if they weren't manually set
            if (e.property === "nodeID" && 
                (mug.__className === "Select" || mug.__className === "MSelect")) 
            {
                var node = mug.form.controlTree.getNodeFromMug(mug),
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
                    mug.__className !== "DataBindOnly" &&
                        (!mug.controlElement || !mug.controlElement.labelItextID || 
                         (mug.controlElement.labelItextID && mug.controlElement.labelItextID.isEmpty()) ))
                ) {
                    that.fire({
                        type: 'question-text-change',
                        mugUfid: e.mugUfid,
                        text: newNameForTree
                    });
                }
            }

            that.fire({
                type: 'mug-property-change',
                mug: mug,
                e: e
            });


            fireChange(mug);
        };

        that.createQuestion = function (refMug, position, newMugType, isInternal) {
            var mug = new mugTypes[newMugType](that);
            that.insertQuestion(mug, refMug, position, isInternal);
            if (mug.isODKOnly) {
                that.updateError({
                    message: 'This question type will ONLY work with Android phones!',
                    level: 'form-warning'
                });
            }
        };
        
        that.insertQuestion = function (mug, refMug, position, isInternal) {
            refMug = refMug || that.dataTree.getRootNode().getValue();
            that.insertMug(refMug, mug, position);
            // todo: abstraction barrier
            that.vellum.data.javaRosa.Itext.updateForNewMug(mug);
            that.intentManager.syncMugWithIntent(mug);

            that.fire({
                type: 'question-create',
                mug: mug,
                refMug: refMug,
                position: position,
                isInternal: isInternal
            });
            if (!isInternal) {
                mug.afterInsert(that, mug);
            }
        };
       
        that.getAbsolutePath = function (mug) {
            return that.dataTree.getAbsolutePath(mug);
        };

        that.getMugByUFID = function (ufid) {
            return (that.dataTree.getMugFromUFID(ufid) ||
                    that.controlTree.getMugFromUFID(ufid));
        };
        
        that.getMugByPath = function (path) {
            var recFunc, tokens, targetMug,
                rootNode = that.dataTree.getRootNode();
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


            if(rootNode.getID() !== tokens[0]) {
                return null; //path not found
            }

            targetMug = recFunc(rootNode,tokens.slice(1));
            return targetMug;
        };
        
        that.getSingularMugByNodeId = function (nodeId, treeType) {
            if(!nodeId) { //no path specified
                return null;
            }
            
            var nodeMatches = function (node) {
                var mt = node.getValue();
                return (mt && mt.mug && mt.mug.getBindElementID() === nodeId) ? mt : null;
            };
            
            var matchList = that.datatree.treeMap(nodeMatches)
                    .filter(function (m) { return m !== null; });
            if (matchList.length !== 1) {
                throw "Expected one result for node " + nodeId + " but found " + matchList.length;
            }
            return matchList[0];
        };
        

        that.removeMugFromForm = function (mug) {
            that._removeMugFromForm(mug, false);
        };
        
        that._removeMugFromForm = function(mug, isInternal) {
            var fromTree = that.controlTree.getNodeFromMug(mug);
            if (fromTree) {
                var children = that.controlTree.getNodeFromMug(mug).getChildrenMugs();
                for (var i = 0; i < children.length; i++) {
                    that._removeMugFromForm(children[i], true);
                }
            }
            
            that.dataTree.removeMug(mug);
            that.controlTree.removeMug(mug);
            that.fire({
                type: 'remove-question',
                mug: mug,
                isInternal: isInternal
            });
        };

        that.questionIdCount = function (qId) {
            var allMugs = that.getMugList(),
                count = 0;
            for (var i = 0; i < allMugs.length; i++) {
                var mug = allMugs[i];
                if (mug.dataElement && qId === mug.dataElement.nodeID) {
                    count++; 
                }
            }

            return count;
        };

        /**
         * Generates a unique question ID (unique in this form) and
         * returns it as a string.
         */
        that.generate_question_id = function (question_id) {
            if (question_id) {
                var match = /^copy-(\d+)-of-(.+)$/.exec(question_id) ;
                if (match) {
                    question_id = match[2]; 
                }
                for (var i = 1;; i++) {
                    var new_id = "copy-" + i + "-of-" + question_id;
                    if (!that.questionIdCount(new_id)) {
                        return new_id; 
                    }
                }
            } else {
                return make_label('question');
            }
        };
        that.question_counter = 1;
        
        that.generate_item_label = function () {
            return make_label('item');
        };
        /**
         * Private method for constructing unique questionIDs, labels for items, etc
         */
        var make_label = function (prefixStr) {
            var ret = prefixStr + that.question_counter;
            that.question_counter += 1;
            return ret;
        };

        that.getExportTSV = function () {
            that.vellum.beforeSerialize();
            return exporter.generateExportTSV(that);
        };
        
        return that;
    };

    return {
        "Form": Form,
        "InstanceMetadata": InstanceMetadata
    };
});
