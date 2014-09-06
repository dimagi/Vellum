define([
    'require',
    'underscore',
    'vellum/tree',
    'vellum/logic',
    'vellum/widgets',
    'vellum/util'
], function (
    require,
    _,
    Tree,
    logic,
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
    
    function processInstance(instance) {
        instance.defaultId = instance.defaultId || convertToId(instance.sourceUri);
        instance.id = instance.defaultId;
        _.each(instance.levels, function (level) {
            var i = 1,
                mappedSubsets = {};
            _.each(level.subsets, function (subset) {
                subset.id = i++;
                subset.selector = normalizeXPathExpr(subset.selector);
                mappedSubsets[subset.id] = subset;
            });
            level.subsets = mappedSubsets;
        });
        return instance;
    }
    
    // Parsing the instance selectors using the XPath models and comparing the
    // parsed expressions might be a better approach that these hacky functions.
    function normalizeXPathExpr(str) {
        return normalizeToSingleQuotes(removeSpaces(str));
    }

    // remove spaces around = and []
    function removeSpaces(str) {
        return str.replace(/\s*([=\[\]])\s*/g, function (match, p1) {
            return p1;
        });
    }

    // Change any top-level double quotes to single quotes. (Assumes no
    // top-level escaped double quotes).  This may not correctly handle escaped
    // quotes within a quote.  Moving on.
    function normalizeToSingleQuotes(str) {
        var ret = '',
            inAQuote = false;

        eachCharByQuotedStatus(str,
            function (c) {
                ret += c;
            },
            function (c) {
                if (c === '"') {
                    c = "'";
                }
                ret += c;
            });
        return ret;
    }

    // abstracted this because I was using it for two things before
    function eachCharByQuotedStatus(str, quoted, unquoted) {
        var prevIsBackslash = false,
            inSingleQuote = false,
            inDoubleQuote = false;

        for (var i=0, l=str.length; i < l; i++) {
            var c = str[i],
                inQuote = inSingleQuote || inDoubleQuote;
          
            if (!prevIsBackslash && ((inSingleQuote && c === "'") ||
                                     (inDoubleQuote && c === '"'))) {
                inQuote = false;
            }
            (inQuote ? quoted : unquoted)(c);

            if (!prevIsBackslash) {
                if (c === "'" && !inDoubleQuote) {
                    inSingleQuote = !inSingleQuote;
                } else if (c === '"' && !inSingleQuote) {
                    inDoubleQuote = !inDoubleQuote;
                }
            }

            if (c === '\\') {
                prevIsBackslash = !prevIsBackslash;
            } else {
                prevIsBackslash = false;
            }
        }
    }
    
    function convertToId(str) {
        return str
            .toLowerCase()
            .replace(/ /g,'_')
            .replace(/[^\w-]+/g,'');
    }
    
    var InstanceMetadata = function (attributes, children) {
        var that = {};
        that.attributes = attributes;
        that.children = children || [];
        return that;
    };

    function Form (opts, vellum, mugTypes) {
        var _this = this;

        this.setValues = [];

        this._logicManager = new logic.LogicManager(this, {
                allowedDataNodeReferences: opts.allowedDataNodeReferences
            });

        // Some things in the form and mug methods depend on the UI.  These
        // should eventually be factored out.
        this.vellum = vellum;
        this.mugTypes = mugTypes;

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
        
        this.externalInstances = _.indexBy(
            _.map(opts.externalInstances || [], processInstance), 'id');
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
        addInstance: function (instance) {
            this.externalInstances[instance.id] = instance;
        },
        // todo: update references on rename
        addSetValue: function (event, ref, value) {
            var existing = _.filter(this.setValues, function (setValue) {
                return setValue.event === event && setValue.ref === ref;
            });
            if (existing[0]) {
                existing.value = value;
            } else {
                this.setValues.push({
                    event: event,
                    ref: ref,
                    value: value
                });
            }
        },
        getSetValues: function () {
            return this.setValues;
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
                    var mug = node.getValue();
                    if (!mug.p.getDefinition('relevantAttr')) {
                        return null;
                    } else {
                        return mug;
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

                if (!mug.options.isDataOnly) {
                    return null;
                } else {
                    return mug;
                }
            });
        },
        /**
         * Walks through both internal trees (data and control) and grabs
         * all mugs that are not (1)Choices.  Returns
         * a flat list of unique mugs.  This list is primarily for the
         * autocomplete skip logic wizard.
         */
        getMugList: function () {
            var cTree, dTree, treeFunc, cList, dList, mergeList;

            treeFunc = function (node) {
                if(node.isRootNode) {
                    return;
                }

                return node.getValue();
            };

            cList = this.controlTree.treeMap(treeFunc);
            dList = this.dataTree.treeMap(treeFunc);

            return util.mergeArray(cList, dList); //strip dupes and merge
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
        isFormValid: function (validateMug) {
            return this.dataTree.isTreeValid(validateMug) && 
                this.controlTree.isTreeValid(validateMug);
        },
        getMugChildrenByNodeID: function (mug, nodeID) {
            var parentNode = (mug ? this.dataTree.getNodeFromMug(mug)
                                  : this.dataTree.rootNode);
            return _.filter(parentNode.getChildrenMugs(), function (m) {
                return m.p.nodeID === nodeID;
            });
        },
        insertMug: function (refMug, newMug, position) {
            if (!newMug.options.isControlOnly) {
                this.dataTree.insertMug(newMug, position, refMug);
            }

            if (!newMug.options.isDataOnly) {
                this.controlTree.insertMug(newMug, position, refMug);
            }
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

            if (!mug.options.isControlOnly) {
                this.dataTree.insertMug(mug, position, refMug);
            }
            if (!mug.options.isDataOnly) {
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
        handleMugRename: function (mug, currentId, oldId, currentPath, oldPath) {
            this._logicManager.updatePath(mug.ufid, oldPath, currentPath);
        },
        changeMugType: function (mug, questionType) {
            this.mugTypes.changeType(mug, questionType);
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
               _gaq.push(['_trackEvent', 'Form Builder', 'Copy', duplicate.options.typeName]);
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
            var duplicate = this.mugTypes.make(mug.__className, this, mug);

            if (depth === 0) {
                var nodeID = mug.p.nodeID;
                if (nodeID) {
                    var newQuestionID = this.generate_question_id(nodeID); 
                    duplicate.p.nodeID = newQuestionID;
                } else {
                    var newItemValue = this.generate_question_id(
                        mug.p.defaultValue);
                    duplicate.p.defaultValue = newItemValue;
                }
                
                this.insertQuestion(duplicate, mug, 'after', true);
            } else {
                this.insertQuestion(duplicate, parentMug, 'into', true);
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
        /**
         * Determine if a mug property should change
         *
         * This method must be called before the property value has changed.
         *
         * Returns a function that should be called after the property has
         * changed; null if the property should not change.
         */
        shouldMugPropertyChange: function (mug, property, value, previous) {
            // update the logic properties that reference the mug
            if (property === 'nodeID' && previous &&
                this.getMugChildrenByNodeID(mug.parentMug, value).length > 0)
            {
                // Short-circuit invalid change and trigger warning in UI
                this.vellum.setUnsavedDuplicateNodeId(value);
                return null;
            }

            return function () {
                var event = {
                    type: 'mug-property-change',
                    mug: mug,
                    property: property,
                    val: value,
                    previous: previous
                };
                this.handleMugPropertyChange(mug, event);
                this.fire(event);

                // legacy, enables auto itext ID behavior, don't add
                // additional dependencies on this code.  Some sort of
                // data binding would be better.
                mug.fire({
                    type: 'property-changed',
                    property: property,
                    val: value,
                    previous: previous
                });

                this.fireChange(mug);
            }.bind(this);
        },
        handleMugPropertyChange: function (mug, e) {
            if (e.property === 'nodeID') {
                var currentPath = this.getAbsolutePath(mug),
                    valid, parsed;
                try {
                    valid = true;
                    parsed = xpath.parse(currentPath);
                } catch (err) {
                    valid = false;
                }
                if (valid) {
                    parsed.steps[parsed.steps.length - 1].name = e.previous;
                    var oldPath = parsed.toXPath();
                    this.vellum.handleMugRename(this, mug, e.val, e.previous, currentPath, oldPath);
                }

                // update the itext ids of child items if they weren't manually set
                if (mug.__className === "Select" || mug.__className === "MSelect") {
                    var node = this.controlTree.getNodeFromMug(mug),
                        // node can be null when the mug hasn't been inserted into
                        // the tree yet
                        children = node ? node.getChildrenMugs() : [];

                    for (var i = 0; i < children.length; i++) {
                        // Autogenerate Itext ID, then replace current nodeID with
                        // previous nodeID to test whether existing Itext ID is
                        // autogenerated.
                        var child = children[i];
                        if (child.__className === "ReadOnly") continue;
                        var newItextID = child.getDefaultLabelItextId(),
                            itextRoot = child.getDefaultItextRoot(),

                            oldAutoID = newItextID.replace(
                                itextRoot,
                                itextRoot.replace(
                                    // depends on node IDs not having '-', and '-'
                                    // being the separator between the question ID
                                    // and item ID parts of the ID
                                    new RegExp("(^|/)" + e.val + "(/|-)"),
                                    "$1" + e.previous + "$2")),
                            isAuto = (oldAutoID === child.p.labelItextID.id);

                        if (isAuto) {
                            child.setItextID(child.getDefaultLabelItextId());
                        }
                    }
                }
            } else {
                if (mug.p.getDefinition(e.property).widget === widgets.xPath) {
                    this.updateAllLogicReferences(mug);
                }
            }
        },
        createQuestion: function (refMug, position, newMugType, isInternal) {
            var mug = this.mugTypes.make(newMugType, this);
            if (!mug.options.isControlOnly) {
                mug.p.nodeID = this.generate_question_id();
            }
            if (mug.__className === "Item") {
                mug.p.defaultValue = this.generate_item_label(refMug);
            
            }
            this.insertQuestion(mug, refMug, position, isInternal);
            if (mug.options.isODKOnly) {
                this.updateError({
                    message: 'Image capture works on Android devices and ' +
                        'some feature phones; please test your specific ' +
                        'model to ensure that this question type is supported',
                    level: 'form-warning'
                });
            }
            return mug;
        },
        insertQuestion: function (mug, refMug, position, isInternal) {
            refMug = refMug || this.dataTree.getRootNode().getValue();
            this.insertMug(refMug, mug, position);
            // todo: abstraction barrier

            this.fire({
                type: 'question-create',
                mug: mug,
                refMug: refMug,
                position: position,
                isInternal: isInternal
            });
            if (!isInternal) {
                mug.options.afterInsert(this, mug);
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
                if (qId === mug.p.nodeID || qId === mug.p.defaultValue) {
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
        generate_item_label: function (parentMug) {
            var items = this.getChildren(parentMug),
                i = items.length + 1,
                ret;
            do {
                ret = 'item' + i++;
            } while (_.any(items, function (i) {
                return i.p.defaultValue === ret;
            }));
            return ret;
        },
        /**
         * Private method for constructing unique questionIDs, labels for items, etc
         */
        _make_label: function (prefixStr) {
            var ret;
            do {
                ret = prefixStr + this.question_counter;
                this.question_counter += 1;
            } while (this.questionIdCount(ret));
            return ret;
        },
        getExportTSV: function () {
            this.vellum.beforeSerialize();
            return exporter.generateExportTSV(this);
        }
    };

    return {
        Form: Form,
        processInstance: processInstance,
        normalizeXPathExpr: normalizeXPathExpr,
        InstanceMetadata: InstanceMetadata
    };
});
