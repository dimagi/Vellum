/*jslint browser: true, maxerr: 50, indent: 4 */
/**
 * Model classes and functions for the FormDesigner
 */
if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}



/**
 * A regular tree (with any amount of leafs per node)
 * @param tType - is this a DataElement tree or a controlElement tree (use 'data' or 'control' for this argument, respectively)
 * tType defaults to 'data'
 */
var Tree = function (tType) {
    var that = {}, rootNode, treeType = tType;
    if (!treeType) {
        treeType = 'data';
    }

    /**
     * Children is a list of objects.
     * @param children - optional
     * @param value - that value object that this node should contain (should be a Mug)
     */
    var Node = function (children, value) {
        var that = {}, isRootNode = false, 
            nodeValue = value;
        that.value = value;

        children = children || [];
        that.children = children;

        that.getChildren = function () {
            return children;
        };

        that.getValue = function () {
            return nodeValue;
        };

        that.setValue = function (val) {
            nodeValue = val;
            _(that.children).each(function (child) {
                child.getValue().parentMug = val;
            });
        };

        /**
         * DOES NOT CHECK TO SEE IF NODE IS IN TREE ALREADY!
         * Adds child to END of children!
         */
        that.addChild = function (node) {
            if (!children) {
                children = [];
            }
            children.push(node);
        };

        /**
         * Insert child at the given index (0 means first)
         * if index > children.length, will insert at end.
         * -ve index will result in child being added to first of children list.
         */
        that.insertChild = function (node, index) {
            if (node === null) {
                return null;
            }

            if (index < 0) {
                index = 0;
            }

            children.splice(index, 0, node);
        };

        /**
         * Given a mug, finds the node that the mug belongs to.
         * if it is not the current node, will recursively look through 
         * children node (depth first search)
         */
        that.getNodeFromValue = function (value) {
            if (value === null) {
                return null;
            }
            var valueIsFn = _.isFunction(value),
                retVal,
                thisVal = this.getValue();

            if ((!valueIsFn && thisVal === value && thisVal !== ' ') ||
                (valueIsFn && value(thisVal)))
            {
                return this;
            } else {
                for (var i = 0; i < children.length; i++) {
                    retVal = children[i].getNodeFromValue(value);
                    if (retVal) {
                        return retVal;
                    }
                }
            }
            return null; //we haven't found what we're looking for
        };
        that.getNodeFromMug = that.getNodeFromValue;

        that.getMugFromUFID = function (ufid) {
            var node = that.getNodeFromValue(function (value) {
                return value.ufid === ufid;
            });
            
            return node ? node.getValue() : null;
        };

        that.removeChild = function (node) {
            var childIdx = children.indexOf(node);
            if (childIdx !== -1) { //if arg node is a member of the children list
                children.splice(childIdx, 1); //remove it
            }

            return node;
        };

        /**
         * Finds the parentNode of the specified node (recursively going through the tree/children of this node)
         * Returns the parent if found, else null.
         */
        that.findParentNode = function (node) {
            var i, parent = null;
            if (!children || children.length === 0) {
                return null;
            }
            if (children.indexOf(node) !== -1) {
                return this;
            }

            for (i in children) {
                if (children.hasOwnProperty(i)) {
                    parent = children[i].findParentNode(node);
                    if (parent !== null) {
                        return parent;
                    }
                }
            }
            return parent;
        };

        /**
         * An ID used during prettyPrinting of the Node. (a human readable value for the node)
         */
        that.getID = function () {
            var id;
            if (this.isRootNode) {
                id = formdesigner.controller.form.formID;
                if (id) {
                    return id;
                } else {
                    return 'RootNode';
                }
            }
            var mug = this.getValue();
            if (treeType === 'data') {
                return this.getValue().getDataElementID();
            } else if (treeType === 'control') {
                return formdesigner.util.getMugDisplayName(this.getValue());
            } else {
                throw 'Tree does not have a specified treeType! Default is "data" so must have been forcibly removed!';
            }
        };

        /**
         * Get all children MUG TYPES of this node (not recursive, only the top level).
         * Return a list of Mug objects, or empty list for no children.
         */
        that.getChildrenMugs = function () {
            var i, retList = [];
            for (i in children) {
                if (children.hasOwnProperty(i)) {
                    retList.push(children[i].getValue());
                }
            }
            return retList;
        };


        //that.toString = function () {
            //return this.getID();
        //};

        that.prettyPrint = function () {
            var arr = [], i;
            for (i in children) {
                if (children.hasOwnProperty(i)) {
                    arr.push(children[i].prettyPrint());
                }
            }
            if (!children || children.length === 0) {
                return this.getID();
            } else {
                return '' + this.getID() + '[' + arr + ']';
            }
        };

        /**
         * calls the given function on each node (the node
         * is given as the only argument to the given function)
         * and appends the result (if any) to a flat list
         * (the store argument) which is then returned
         * @param nodeFunc
         * @param store
         */
        that.treeMap = function (nodeFunc, store, afterChildFunc) {
            var result, child;
            result = nodeFunc(this); //call on self
            if(result){
                store.push(result);
            }
            for(child in this.getChildren()){
                if(this.getChildren().hasOwnProperty(child)){
                    this.getChildren()[child].treeMap(nodeFunc, store, afterChildFunc); //have each children also perform the func
                }
            }
            if(afterChildFunc){
                afterChildFunc(this, result);
            }
            return store; //return the results
        };

        /**
         * See docs @ Tree.validateTree()
         */
        var validateTree = function () {
            var validationErrors, thisMug, i, childResult;
            if(!this.getValue()){
                throw 'Tree contains node with no values!'
            }
            if (!this.getValue().isValid()) {
                return false;
            }

            for (i in this.getChildren()) {
                if (this.getChildren().hasOwnProperty(i)) {
                    childResult = this.getChildren()[i].validateTree();
                    if(!childResult){
                        return false;
                    }
                }
            }

            //If we got this far, everything checks out.
            return true;


        }
        that.validateTree = validateTree;

        return that;
    };

    var init = function (type) {
        rootNode = new Node(null, ' ');
        rootNode.isRootNode = true;
        treeType = type || 'data';
    }(treeType);
    that.rootNode = rootNode;

    that.getParentNode = function (node) {
        if (this.rootNode === node) { //special case:
            return this.rootNode;
        } else { //regular case
            return this.rootNode.findParentNode(node);
        }
    };

    /**
     * Given a mug, finds the node that the mug belongs to (in this tree).
     * Will return null if nothing is found.
     */
    that.getNodeFromMug = function (mug) {
        return rootNode.getNodeFromMug(mug);
    };

    /**
     * Removes a node (and all it's children) from the tree (regardless of where it is located in the
     * tree) and returns it.
     *
     * If no such node is found in the tree (or node is null/undefined)
     * null is returned.
     */
    var removeNodeFromTree = function (node) {
        if (!node) {
            return null;
        }
        if (!that.getNodeFromMug(node.getValue())) {
            return null;
        } //node not in tree
        var parent = that.getParentNode(node);
        if (parent) {
            parent.removeChild(node);
            return node;
        } else {
            return null;
        }
    };

    /**
     * Insert a Mug as a child to the node containing parentMug.
     *
     * Will MOVE the mug to the new location in the tree if it is already present!
     * @param mug - the Mug to be inserted into the Tree
     * @param position - position relative to the refMug. Can be 'null', 'before', 'after' or 'into'
     * @param refMug - reference Mug.
     *
     * if refMug is null, will default to the last child of the root node.
     * if position is null, will default to 'after'.  If 'into' is specified, mug will be inserted
     * as a ('after') child of the refMug.
     *
     * If an invalid move is specified, no operation will occur.
     */
    that.insertMug = function (mug, position, refMug) {
        var refNode, refNodeSiblings, refNodeIndex, refNodeParent, node;

        if (position !== null && typeof position !== 'string') {
            throw "position argument must be a string or null! Can be 'after', 'before' or 'into'";
        }
        if (!position) {
            position = 'after';
        }

        if (!refMug || refMug === ' ' || 
            (!refMug.controlElement && treeType === 'control'))
        {
            refNode = rootNode;
            position = 'into';
        } else {
            refNode = this.getNodeFromMug(refMug);
        }

        //remove it from tree if it already exists
        node = removeNodeFromTree(this.getNodeFromMug(mug)); 
        if (!node) {
            node = new Node(null, mug);
        }

        if (position !== 'into') {
            refNodeParent = that.getParentNode(refNode);
            refNodeSiblings = refNodeParent.getChildren();
            refNodeIndex = refNodeSiblings.indexOf(refNode);
            mug.parentMug = refNodeParent.getValue();
        } else {
            mug.parentMug = refMug;
        }

        switch (position) {
            case 'before':
                refNodeParent.insertChild(node, refNodeIndex);
            break;
            case 'after':
                refNodeParent.insertChild(node, refNodeIndex + 1);
            break;
            case 'into':
                refNode.addChild(node);
            break;
            case 'first':
                refNode.insertChild(node, 0);
            break;
            case 'last':
                refNode.insertChild(node, refNodeSiblings.length + 1);
            break;
            default:
                throw "in insertMug() position argument MUST be null, 'before', 'after', 'into', 'first' or 'last'.  Argument was: " + position;
        }
    };

    /**
     * Returns a list of nodes that are in the top level of this tree (i.e. not the abstract rootNode but it's children)
     */
    var getAllNodes = function () {
        return rootNode.getChildren();
    };

    /**
     * returns the absolute path, in the form of a string separated by slashes ('/nodeID/otherNodeID/finalNodeID'),
     * the nodeID's are those given by the Mugs (i.e. the node value objects) according to whether this tree is a
     * 'data' (DataElement) tree or a 'bind' (BindElement) tree.
     *
     * @param nodeOrmug - can be a tree Node or a mug that is a member of this tree (via a Node)
     */
    that.getAbsolutePath = function (mug) {
        var node = this.getNodeFromMug(mug),
            output, nodeParent;
        if (!node) {
            //                console.log('Cant find path of Mug that is not present in the Tree!');
            return null;
        }
        nodeParent = this.getParentNode(node);
        output = '/' + node.getID();

        while (nodeParent) {
            output = '/' + nodeParent.getID() + output;
            if (nodeParent.isRootNode) {
                break;
            }
            nodeParent = this.getParentNode(nodeParent);

        }

        return output;
    };

    that.printTree = function (toConsole) {
        var t = rootNode.prettyPrint();

        return t;
    };

    /**
     * Removes the specified Mug from the tree. If it isn't in the tree
     * does nothing.  Does nothing if null is specified
     *
     * If the Mug is successfully removed, returns that Mug.
     */
    that.removeMug = function (mug) {
        var node = this.getNodeFromMug(mug);
        if (!mug || !node) {
            return;
        }
        removeNodeFromTree(node);
        return node;
    };

    /**
     * Given a UFID searches through the tree for the corresponding Mug and returns it.
     * @param ufid of a mug
     */
    that.getMugFromUFID = function (ufid) {
        return rootNode.getMugFromUFID(ufid);
    };

    /**
     * Returns all the children Mugs (as a list) of the
     * root node in the tree.
     */
    that.getRootChildren = function () {
        return rootNode.getChildrenMugs();
    };

    /**
     * Performs the given func on each
     * node of the tree (the Node is given as the only argument to the function)
     * and returns the result as a list.
     * @param func - a function called on each node, the node is the only argument
     * @param afterChildFunc - a function called after the above function is called on each child of the current node.
     */
    that.treeMap = function (func, afterChildFunc) {
        return rootNode.treeMap(func, [], afterChildFunc);
    };

    that.isTreeValid = function() {
        var rChildren = rootNode.getChildren(),
        i, retVal;
        for (i in rChildren){
            if(rChildren.hasOwnProperty(i)){
                retVal = rChildren[i].validateTree();
                if(!retVal){
                    return false;
                }
            }
        }
        return true;
    }

    that.getRootNode = function () {
        return rootNode;
    }

    return that;
};

formdesigner.model = (function () {
    var that = {};
    
    that.questionIdCount = function (qId) {
        var allMugs = formdesigner.controller.getMugList(),
            count = 0;
        for (var i = 0; i < allMugs.length; i++) {
            var mug = allMugs[i];
            if (mug.dataElement && qId === mug.dataElement.nodeID) {
                count++; 
            }
        }

        return count;
    };
    
    var InstanceMetadata = function (attributes, children) {
        var that = {};
        that.attributes = attributes;
        that.children = children;
        return that;
    };
    that.InstanceMetadata = InstanceMetadata;
    
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
    that.FormError = FormError;
    
    var Form = function () {
        var that = {}, dataTree, controlTree;

        that.formName = 'New Form';
        that.formID = 'data';
        that.dataTree = dataTree = new Tree('data');
        that.controlTree = controlTree = new Tree('control');
        that.instanceMetadata = [InstanceMetadata({})];
        that.errors = [];

        /**
         * Loops through the data and the control trees and picks out all the unique bind elements.
         * Returns a list of Mugs
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

        var getInvalidMugs = function () {
            var mugListC, mugListD, result, controlTree, dataTree,
                mapFunc = function (node) {
                    if (node.isRootNode) {
                        return;
                    }

                    var mug = node.getValue()

                    if(!mug.isValid()){
                        return mug;
                    }else{
                        return null;
                    }
                }

            dataTree = this.dataTree;
            controlTree = this.controlTree;
            mugListC = controlTree.treeMap(mapFunc);
            mugListD = dataTree.treeMap(mapFunc);
            result = formdesigner.util.mergeArray(mugListC, mugListD);

            return result;
        }
        that.getInvalidMugs = getInvalidMugs;

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
        }
        
        that.updateError = function (errObj, options) {
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
            if (options.updateUI) {
                formdesigner.ui.resetMessages(that.errors);
            }
            
        };
        
        that.clearErrors = function (type, options) {
            options = options || {};
            for (var i = 0; i < that.errors.length; i++) {
                that.errors = that.errors.filter(function (err) {
                    return err.level !== type;
                });
            }
            if (options.updateUI) {
                formdesigner.ui.resetMessages(that.errors);
            }
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
            if (removed && options.updateUI) {
                formdesigner.ui.resetMessages(that.errors);
            }
        };

        /**
         * Generates an XML Xform and returns it as a string.
         */
        that.createXForm = function () {
            var xmlWriter = new XMLWriter( 'UTF-8', '1.0' );

            var createDataBlock = function () {
                // use dataTree.treeMap(func,listStore,afterChildfunc)
                // create func that opens + creates the data tag, that can be recursively called on all children
                // create afterChildfunc which closes the data tag
                function mapFunc (node) {
                    var defaultVal, extraXMLNS, keyAttr,
                        mug = node.getValue();

                    xmlWriter.writeStartElement(node.getID());
                    
                    if (node.isRootNode) {
                        createModelHeader();
                    } else {
                        // Write any custom attributes first
	                    for (var k in mug.dataElement._rawAttributes) {
	                        if (mug.dataElement._rawAttributes.hasOwnProperty(k)) {
	                            xmlWriter.writeAttributeStringSafe(k, mug.dataElement._rawAttributes[k]);
	                        }
	                    }
	                    
	                    if (mug.dataElement.dataValue){
	                        defaultVal = mug.dataElement.dataValue;
	                        xmlWriter.writeString(defaultVal);
	                    }
	                    if (mug.dataElement.keyAttr){
	                        keyAttr = mug.dataElement.keyAttr;
	                        xmlWriter.writeAttributeStringSafe("key", keyAttr);
	                    }
	                    if (mug.dataElement.xmlnsAttr){
	                        extraXMLNS = mug.dataElement.xmlnsAttr;
	                        xmlWriter.writeAttributeStringSafe("xmlns", extraXMLNS);
	                    }
	                    if (mug.__className === "Repeat"){
	                        xmlWriter.writeAttributeStringSafe("jr:template","");
	                    }
                    }
                }

                function afterFunc (node) {
                    xmlWriter.writeEndElement();
                    //data elements only require one close element call with nothing else fancy.
                }

                dataTree.treeMap(mapFunc, afterFunc);
            };

            var createBindList = function () {
                var bList = formdesigner.controller.form.getBindList(),
                    mug,
                        //vars populated by populateVariables()
                        bEl,cons,consMsg,nodeset,type,relevant,required,calc,preld,preldParams,
                    i, attrs, j;



                function populateVariables (mug){
                    bEl = mug.bindElement;
                    if (bEl) {
                        return {
                            nodeset: dataTree.getAbsolutePath(mug),
                            type: bEl.dataType,
                            constraint: bEl.constraintAttr,
                            constraintMsg: bEl.constraintMsgAttr,
                            constraintMsgItextID: bEl.constraintMsgItextID ? 
                                bEl.constraintMsgItextID.id : undefined,
                            relevant: bEl.relevantAttr,
                            required: formdesigner.util.createXPathBoolFromJS(bEl.requiredAttr),
                            calculate: bEl.calculateAttr,
                            preload: bEl.preload,
                            preloadParams: bEl.preloadParams
                        }
                    } else {
                        return null;
                    }
                }

                for (i in bList) {
                    if(bList.hasOwnProperty(i)){
                        mug = bList[i];
                        attrs = populateVariables(mug);
                        if(attrs.nodeset){
                            xmlWriter.writeStartElement('bind');
                            for (j in attrs) {
                                if (attrs.hasOwnProperty(j) && attrs[j]) {
                                    if (j === "constraintMsg"){
                                        xmlWriter.writeAttributeStringSafe("jr:constraintMsg",attrs[j]); //write it
                                    } else if (j === "constraintMsgItextID") {
                                        xmlWriter.writeAttributeStringSafe("jr:constraintMsg",  "jr:itext('" + attrs[j] + "')")
                                    } else if (j === "preload") {
                                        xmlWriter.writeAttributeStringSafe("jr:preload", attrs[j]);
                                    } else if (j === "preloadParams") {
                                        xmlWriter.writeAttributeStringSafe("jr:preloadParams", attrs[j]);
                                    } else {
                                        xmlWriter.writeAttributeStringSafe(j,attrs[j]);
                                    }
                                }
                            }
                            xmlWriter.writeEndElement();
                        }
                    }
                }
            };

            var createControlBlock = function () {
                var mapFunc, afterFunc;

                function mapFunc(node) {
                    if(node.isRootNode) { //skip
                        return;
                    }

                    var mug = node.getValue();
                        
                    if (mug.__className === "ReadOnly") {
                        xmlWriter.writeString($('<div>').append(mug.controlElementRaw).clone().html());
                        return;
                    }
                    var cProps = mug.controlElement,
                        label, hasItext, isItextOptional;

                    /**
                     * @param tagName
                     * @param elLabel - dictionary: {ref: 'itext ref string', defText: 'default label text'} both are optional
                     */
                    function createOpenControlTag(tagName,elLabel){
                        tagName = tagName.toLowerCase();
                        var isGroupOrRepeat = (tagName === 'group' || tagName === 'repeat');
                        var isODKMedia = (tagName === 'upload');
                        /**
                         * Creates the label tag inside of a control Element in the xform
                         */
                        function createLabel() {
                            if (elLabel.ref || elLabel.defText) {
                                xmlWriter.writeStartElement('label');
                                if (elLabel.ref) {
                                    xmlWriter.writeAttributeStringSafe('ref',elLabel.ref);
                                }
                                if (elLabel.defText) {
                                    xmlWriter.writeString(elLabel.defText);
                                }
                                xmlWriter.writeEndElement(); //close Label tag;
                            }
                        }

                        // Special logic block to make sure the label ends up in the right place
                        if (isGroupOrRepeat) {
                            xmlWriter.writeStartElement('group');
                            createLabel();
                            if (tagName === 'repeat') {
                                xmlWriter.writeStartElement('repeat');
                            }
                        } else {
                            xmlWriter.writeStartElement(tagName);
                        }
                        if (tagName !== 'group' && tagName !== 'repeat') {
                            createLabel();
                        }
                        
                        if (tagName === 'item' && cProps.defaultValue) {
                            //do a value tag for an item Mug
                            xmlWriter.writeStartElement('value');
                            xmlWriter.writeString(cProps.defaultValue);
                            xmlWriter.writeEndElement();
                        }
                        
                        // Write any custom attributes first
                        for (var k in cProps._rawAttributes) {
                            if (k === 'jr:count') {
                                continue;
                            }
                            if (k === 'appearance') {
                                continue;
                            }

                            if (cProps._rawAttributes.hasOwnProperty(k)) {
                                xmlWriter.writeAttributeStringSafe(k, cProps._rawAttributes[k]);
                            }
                        }
                        
                        // Set the nodeset/ref attribute correctly
                        if (tagName !== 'item') {
                            var attr, absPath;
                            if (tagName === 'repeat') {
                                attr = 'nodeset';
                            } else {
                                attr = 'ref';
                            }
                            absPath = formdesigner.controller.form.dataTree.getAbsolutePath(mug);
                            xmlWriter.writeAttributeStringSafe(attr, absPath);
                        }
                        
                        // Set other relevant attributes

                        if (tagName === 'repeat') {
                            var r_count = cProps.repeat_count,
                                r_noaddrem = cProps.no_add_remove;

                            //make r_noaddrem an XPath bool
                            r_noaddrem = formdesigner.util.createXPathBoolFromJS(r_noaddrem);

                            if (r_count) {
                                xmlWriter.writeAttributeStringSafe("jr:count",r_count);
                            }

                            if (r_noaddrem) {
                                xmlWriter.writeAttributeStringSafe("jr:noAddRemove", r_noaddrem);
                            }
                        } else if (isODKMedia) {
                            var mediaType = cProps.mediaType;
                            if (mediaType) {
                                xmlWriter.writeAttributeStringSafe("mediatype", mediaType);
                            }
                        }

                        var appearanceAttr = mug.getAppearanceAttribute();
                        if (appearanceAttr) {
                            xmlWriter.writeAttributeStringSafe("appearance", appearanceAttr);
                        }
                        
                        // Do hint label
                        if( tagName !== 'item' && tagName !== 'repeat'){
                            if(cProps.hintLabel || (cProps.hintItextID && cProps.hintItextID.id)) {
                                xmlWriter.writeStartElement('hint');
                                if(cProps.hintLabel){
                                    xmlWriter.writeString(cProps.hintLabel);
                                }
                                if(cProps.hintItextID.id){
                                    var ref = "jr:itext('" + cProps.hintItextID.id + "')";
                                    xmlWriter.writeAttributeStringSafe('ref',ref);
                                }
                                xmlWriter.writeEndElement();
                            }
                        }
                    }

                    //create the label object (for createOpenControlTag())
                    if (cProps.label) {
                        label = {};
                        label.defText = cProps.label;
                    }
                    if (cProps.labelItextID) {
                        if (!label) {
                            label = {};
                        }
                        
                        label.ref = "jr:itext('" + cProps.labelItextID.id + "')";
                        isItextOptional = mug.controlElement.__spec.labelItextID.presence == 'optional'; //iID is optional so by extension Itext is optional.
                        if (cProps.labelItextID.isEmpty() && isItextOptional) {
                            label.ref = '';
                        }
                    }

                    createOpenControlTag(cProps.tagName, label);

                }


                function afterFunc(node) {
                    if (node.isRootNode) {
                        return;
                    }
                    var mug = node.getValue();
                    if (mug.__className === "ReadOnly") {
                        return;
                    }
                    
                    var tagName = mug.controlElement.tagName;
                    //finish off
                    xmlWriter.writeEndElement(); //close control tag.
                    if(tagName === 'repeat'){
                        xmlWriter.writeEndElement(); //special case where we have to close the repeat as well as the group tag.
                    }

                }

                controlTree.treeMap(mapFunc, afterFunc);
            };


            var createModelHeader = function () {
                var uuid, uiVersion, version, formName, jrm;
                //assume we're currently pointed at the opening date block tag
                //e.g. <model><instance><data> <--- we're at <data> now.

                jrm = formdesigner.formJRM;
                if(!jrm) {
                    jrm = "http://dev.commcarehq.org/jr/xforms";
                }

                uuid = formdesigner.formUuid; //gets set at parse time/by UI
                if(!uuid) {
                    uuid = "http://openrosa.org/formdesigner/" + formdesigner.util.generate_xmlns_uuid();
                }

                uiVersion = formdesigner.formUIVersion; //gets set at parse time/by UI
                if(!uiVersion) {
                    uiVersion = 1;
                }

                version = formdesigner.formVersion; //gets set at parse time/by UI
                if(!version) {
                    version = 1;
                }

                formName = formdesigner.controller.form.formName; //gets set at parse time/by UI
                if(!formName) {
                    formName = "New Form";
                }

                xmlWriter.writeAttributeStringSafe("xmlns:jrm",jrm);
                xmlWriter.writeAttributeStringSafe("xmlns", uuid);
                xmlWriter.writeAttributeStringSafe("uiVersion", uiVersion);
                xmlWriter.writeAttributeStringSafe("version", version);
                xmlWriter.writeAttributeStringSafe("name", formName);
            };

            function html_tag_boilerplate () {
                xmlWriter.writeAttributeStringSafe( "xmlns:h", "http://www.w3.org/1999/xhtml" );
                xmlWriter.writeAttributeStringSafe( "xmlns:orx", "http://openrosa.org/jr/xforms" );
                xmlWriter.writeAttributeStringSafe( "xmlns", "http://www.w3.org/2002/xforms" );
                xmlWriter.writeAttributeStringSafe( "xmlns:xsd", "http://www.w3.org/2001/XMLSchema" );
                xmlWriter.writeAttributeStringSafe( "xmlns:jr", "http://openrosa.org/javarosa" );
            }

            var _writeInstanceAttributes = function (writer, instanceMetadata) {
                for (var attrId in instanceMetadata.attributes) {
                    if (instanceMetadata.attributes.hasOwnProperty(attrId)) {
                        writer.writeAttributeStringSafe(attrId, instanceMetadata.attributes[attrId]);
                    }
                }
            };
            
            var _writeInstance = function (writer, instanceMetadata, manualChildren) {
                writer.writeStartElement('instance');
                _writeInstanceAttributes(writer, instanceMetadata);
                if (manualChildren && instanceMetadata.children) {
                    // seriously, this is what you have to do
                    // HT: http://stackoverflow.com/questions/652763/jquery-object-to-string
                    writer.writeString($('<div>').append(instanceMetadata.children).clone().html());
                }
                writer.writeEndElement(); 
            };
            
            var generateForm = function () {
                var docString;
                formdesigner.pluginManager.call("preSerialize");
                
                xmlWriter.writeStartDocument();
                //Generate header boilerplate up to instance level
                xmlWriter.writeStartElement('h:html');
                html_tag_boilerplate();
                xmlWriter.writeStartElement('h:head');
                xmlWriter.writeStartElement('h:title');
                xmlWriter.writeString(formdesigner.controller.form.formName);
                xmlWriter.writeEndElement();       //CLOSE TITLE

                ////////////MODEL///////////////////
                xmlWriter.writeStartElement('model');
                xmlWriter.writeStartElement('instance');
                _writeInstanceAttributes(xmlWriter, formdesigner.controller.form.instanceMetadata[0]);
                
                createDataBlock();
                xmlWriter.writeEndElement(); //CLOSE MAIN INSTANCE
                
                // other instances
                for (var i = 1; i < formdesigner.controller.form.instanceMetadata.length; i++) {
                    _writeInstance(xmlWriter, formdesigner.controller.form.instanceMetadata[i], true);
                }
                
                createBindList();

                formdesigner.pluginManager.call('contributeToModelXML', xmlWriter);
                
                xmlWriter.writeEndElement(); //CLOSE MODEL

                formdesigner.intentManager.writeIntentXML(xmlWriter, dataTree);

                xmlWriter.writeEndElement(); //CLOSE HEAD

                xmlWriter.writeStartElement('h:body');
                /////////////CONTROL BLOCK//////////////
                createControlBlock();
                ////////////////////////////////////////
                xmlWriter.writeEndElement(); //CLOSE BODY
                xmlWriter.writeEndElement(); //CLOSE HTML

                xmlWriter.writeEndDocument(); //CLOSE DOCUMENT
                docString = xmlWriter.flush();

                return docString;
            };
            return generateForm();
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
         * @param treeType - either 'data' or 'control
         */
        var getMugByIDFromTree = function (nodeID, treeType) {
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

            var retVal;
            if (treeType === 'data') {
                retVal = dataTree.treeMap(mapFunc);
            }else if (treeType === 'control') {
                retVal = controlTree.treeMap(mapFunc);
            }else{
                throw 'Invalid TreeType specified! Use either "data" or "control"';
            }

            return retVal;

        };
        that.getMugByIDFromTree = getMugByIDFromTree;

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
        var replaceMug = function (oldMug, newMug, treeType){
            function treeFunc (node) {
                if(node.getValue() === oldMug){
                    node.setValue(newMug);
                    return true;
                }
            }

            var result, tree;
            if(treeType === 'data'){
                tree = dataTree;
            }else {
                tree = controlTree;
            }
            result = tree.treeMap(treeFunc);
            newMug.parentMug = oldMug.parentMug;
            if(result.length > 0){
                return result[0];
            }else {
                return false;
            }
        };
        that.replaceMug = replaceMug;
        
        //make the object event aware
        formdesigner.util.eventuality(that);
        return that;
    };
    that.Form = Form;
    
    // Logic expressions
    that.LogicExpression = function (exprText) {
        var expr = {};
        expr._text = exprText || "";
        
        expr.valid = false;
        if (exprText) {
            try {
                expr.parsed = xpath.parse(exprText);
                expr.valid = true;
            } catch (err) {
                // nothing to do
            }
        } else {
            expr.empty = true;
        }
        
        expr.getPaths = function () {
            var paths = [];
            if (this.parsed) {
                var queue = [this.parsed], 
                    node, i, children;
                while (queue.length > 0) {
                    node = queue.shift();
                    if (node instanceof xpathmodels.XPathPathExpr) {
                        paths.push(node);
                    }
                    children = node.getChildren();
                    for (i = 0; i < children.length; i++) {
                        queue.push(children[i]);
                    }
                }
            }
            return paths;
        };
        
        expr.updatePath = function (from, to) {
            var paths = this.getPaths(),
                path;
            
            var replacePathInfo = function (source, destination) {
                // copies information from source to destination in place,
                // resulting in mutating destination while preserving the 
                // original object reference.
                destination.initial_context = source.initial_context;
                destination.steps = source.steps;
                destination.filter = source.filter;
            };
            
            for (var i = 0; i < paths.length; i++) {
                path = paths[i];
                if (path.toXPath() === from) {
                    replacePathInfo(xpath.parse(to), path);
                }
            }
        };
        
        expr.getText = function () {
            if (this.valid) {
                return this.parsed.toXPath();
            } else {
                return this._text;
            }
        }
        return expr;
    };
    
    that.LogicManager = (function () {
        var logic = {};
        
        logic.all = [];
        
        logic.clearReferences = function (mug, property) {
            this.all = this.all.filter(function (elem) { 
                return elem.mug != mug.ufid || elem.property != property;
            });
        };
        
        logic.addReferences = function (mug, property) {
            var expr = that.LogicExpression(mug.getPropertyValue(property));
            var paths = expr.getPaths().filter(function (p) {
                // currently we don't do anything with relative paths
                return p.initial_context === xpathmodels.XPathInitialContextEnum.ROOT;
            });
            var errorKey = mug.ufid + "-" + property + "-" + "badpath",
                errors = false;

            this.all = this.all.concat(paths.map(function (path) {
                var pathString = path.pathWithoutPredicates(),
                    pathWithoutRoot = pathString.substring(1 + pathString.indexOf('/', 1))
                    refMug = formdesigner.controller.getMugByPath(pathString);

                if (!refMug && formdesigner.allowedDataNodeReferences.indexOf(pathWithoutRoot) == -1) {
                    errors = true;
                    formdesigner.controller.form.updateError(that.FormError({
                        level: "parse-warning",
                        key: errorKey,
                        message: "The question '" + mug.bindElement.nodeID + 
                            "' references an unknown question " + path.toXPath() + 
                            " in its " + mug.getPropertyDefinition(property).lstring + "."
                                                    
                    }), {
                        updateUI: true
                    });
                }
                return {
                    mug: mug.ufid, 
                    ref: refMug ? refMug.ufid : "",
                    property: property,
                    path: path.toXPath(),
                    sourcePath: formdesigner.controller.form.dataTree.getAbsolutePath(mug)
                };      
            }))
           
            if (!errors) {
                formdesigner.controller.form.clearError(that.FormError({key: errorKey}), {updateUI: true});
            }        

        };
        
        logic.updateReferences = function (mug, property) {
            this.clearReferences(mug, property);
            this.addReferences(mug, property);
        };

        logic.updateAllReferences = function (mug, clear) {
            if (mug.bindElement) {
                for (var i = 0; i < formdesigner.util.XPATH_REFERENCES.length; i++) {
                    var property = formdesigner.util.XPATH_REFERENCES[i];
                    if (clear) {
                        logic.clearReferences(mug, property);
                    }
                    logic.addReferences(mug, property);
                }
            }
        };
       
        /**
         * Update references to a node with its new path. Used when a node is
         * moved or duplicated (with subtree).
         *
         * @param mugId - ufid of the mug to update references for
         * @param from - old absolute path of the mug
         * @param to - new absolute path of the mug
         * @param subtree - (optional) only replace references from nodes
         *        beginning with this path (no trailing /)
         */
        logic.updatePath = function (mugId, from, to, subtree) {
            if (from === to) { return; }

            var found = this.all.filter(function (elem) {
                return elem.ref === mugId && 
                    (!subtree || elem.sourcePath === subtree || elem.sourcePath.indexOf(subtree + '/') === 0);
            });
            var ref, mug, expr;
            for (var i = 0; i < found.length; i++) {
                ref = found[i];
                mug = formdesigner.controller.getMugFromFormByUFID(ref.mug);
                expr = that.LogicExpression(mug.getPropertyValue(ref.property));
                orig = expr.getText();
                expr.updatePath(from, to);
                if (orig !== expr.getText()) {
                    formdesigner.controller.setMugPropertyValue(mug, ref.property.split("/")[0], 
                                                                ref.property.split("/")[1], expr.getText(), mug);
                } 
            }
        };

        logic.reset = function () {
            this.all = [];
        };
        
        return logic;
    }());
    

    /**
     * Called during a reset.  Resets the state of all
     * saved objects to represent that of a fresh init.
     */
    that.reset = function () {
        that.form = new Form();
        formdesigner.pluginManager.javaRosa.Itext.resetItext(formdesigner.opts.langs);
        that.LogicManager.reset();
        formdesigner.controller.setForm(that.form);
    };

    /**
     * An initialization function that sets up a number of different fields and properties
     */
    that.init = function () {
        that.form = new Form();
        //set the form object in the controller so it has access to it as well
        formdesigner.controller.setForm(that.form);
    };

    return that;
})();

var validateRule = function (ruleKey, ruleValue, testingObj, blockName, mug) {
    var presence = ruleValue.presence,
        retBlock = {
            result: 'pass'
        };

    if (presence === 'required' && !testingObj) {
        retBlock.result = 'fail';
        retBlock.resultMessage = '"' + ruleKey + '" value is required in:' + blockName + ', but is NOT present!';
    } else if (presence === 'notallowed' && testingObj) {
        retBlock.result = 'fail';
        retBlock.resultMessage = '"' + ruleKey + '" IS NOT ALLOWED IN THIS OBJECT in:' + blockName;
    }

    if (retBlock.result !== "fail" && ruleValue.validationFunc) {
        var funcRetVal = ruleValue.validationFunc(mug);
        if (funcRetVal !== 'pass') {
            retBlock.result = 'fail';
            retBlock.resultMessage = funcRetVal;
        }
    }

    return retBlock;
};

var MugElement = Class.$extend({
    __init__: function (options) {
        this.__spec = options.spec;
        this.__mug = options.mug;
        this.__name = options.name;
    },
    setAttr: function (attr, val, overrideImmutable) {
        // todo: replace all direct setting of element properties with this

        var spec = this.__spec[attr];

        // only set attr if spec allows this attr, except if mug is a
        // DataBindOnly (which all mugs are before the control block has been
        // parsed) 
        if (attr.indexOf('_') !== 0 && spec && 
            (overrideImmutable || !spec.immutable) && 
            (spec.presence !== 'notallowed' || 
                this.__mug.__className === 'DataBindOnly'))
        {
            // avoid potential duplicate references (e.g., itext items)
            if (val && typeof val === "object") {
                val = $.extend(true, {}, val);
            }
            this[attr] = val;
        }
    },
    setAttrs: function (attrs, overrideImmutable) {
        var self = this;
        _(attrs).each(function (val, attr) {
            self.setAttr(attr, val, overrideImmutable);
        });
    },
    getErrors: function () {
        var self = this,
            errors = [];

        // get only properties that have been manually set on the instance
        _(Object.getOwnPropertyNames(this)).each(function (key) {
            // allow "_propertyName" convention for system properties and $
            // classy properties
            if (key.indexOf('_') === 0 || key.indexOf('$') === 0) {
                return;
            }

            var rule = self.__spec[key];

            // internal check that should never fail / get displayed to the user
            if (!rule && self[key]) {
                errors.push(
                    "{element} has property '" + key + "' but no rule is present for that property."
                );
                return;
            } else if (rule) {
                var result = validateRule(key, rule, self[key], self.__name, self.__mug);
                if (result.result === 'fail') {
                    errors.push(result.resultMessage);
                }
            }
        });
        return errors;
    }
});

var mugs = (function () {
    var validateElementName = function (value, displayName) {
        if (!formdesigner.util.isValidElementName(value)) {
            return value + " is not a legal " + displayName + ". Must start with a letter and contain only letters, numbers, and '-' or '_' characters.";
        }
        return "pass";            
    };

    var validationFuncs = {
        //should be used to figure out the logic for label, defaultLabel, labelItext, etc properties
        nodeID: function (mug) {
            var qId = mug.dataElement.nodeID;
            var res = validateElementName(qId, "Question ID");
            if (res !== "pass") {
                return res;
            }
            if (formdesigner.model.questionIdCount(qId) > 1) {
                return qId + " is a duplicate ID in the form. Question IDs must be unique.";
            }
            return "pass";
        }, 
        // todo: fix itext plugin abstraction barrier break here
        label: function (mug) {
            var controlBlock, hasLabel, hasLabelItextID, missing, hasItext, Itext;
            Itext = formdesigner.pluginManager.javaRosa.Itext;
            controlBlock = mug.controlElement;
            hasLabel = Boolean(controlBlock.label);
            var itextBlock = controlBlock ? mug.controlElement.labelItextID : null;
            hasLabelItextID = itextBlock && (typeof itextBlock.id !== "undefined");

            if (hasLabelItextID && !formdesigner.util.isValidAttributeValue(itextBlock.id)) {
                return itextBlock.id + " is not a valid Itext ID";
            }
            hasItext = itextBlock && itextBlock.hasHumanReadableItext();
            
            if (hasLabel) {
                return 'pass';
            } else if (!hasLabel && !hasItext && (mug.controlElement.__spec.label.presence === 'optional' || 
                       mug.controlElement.__spec.labelItextID.presence === 'optional')) {
                //make allowance for questions that have label/labelItextID set to 'optional'
                return 'pass';
            } else if (hasLabelItextID && hasItext) {
                return 'pass';
            } else if (hasLabelItextID && !hasItext) {
                missing = 'a display label';
            } else if (!hasLabel && !hasLabelItextID) {
                missing = 'a display label ID';
            } else if (!hasLabel) {
                missing = 'a display label';
            } else if (!hasLabelItextID) {
                missing = 'a display label ID';
            }
            return 'Question is missing ' + missing + ' value!';
        },
        defaultValue: function (mug) {
            if (/\s/.test(mug.controlElement.defaultValue)) {
                return "Whitespace in values is not allowed.";
            } 
            return "pass";
        }
    };

    var DEFAULT_DATA_ELEMENT_SPEC = {
        nodeID: {
            editable: 'w',
            visibility: 'visible',
            presence: 'required',
            lstring: 'Question ID',
            validationFunc : validationFuncs.nodeID
        },
        dataValue: {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: 'Default Data Value'
        },
        xmlnsAttr: {
            editable: 'w',
            visibility: 'advanced',
            presence: 'notallowed',
            lstring: "Special Hidden Value XMLNS attribute"
        }
    };

    var DEFAULT_BIND_ELEMENT_SPEC = {
        nodeID: {
            editable: 'w',
            visibility: 'advanced',
            presence: 'optional',
            lstring: 'Bind Node ID'
        },
        // part of the Mug type definition, so it's immutable
        dataType: {
            editable: 'w',
            immutable: true,
            visibility: 'visible',
            presence: 'optional',
            values: formdesigner.util.XSD_DATA_TYPES,
            uiType: formdesigner.widgets.selectWidget,
            lstring: 'Data Type'
        },
        relevantAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            uiType: formdesigner.widgets.xPathWidget,
            xpathType: "bool",
            lstring: 'Display Condition'
        },
        calculateAttr: {
            editable: 'w',
            // only show calculate condition for non-data nodes if it already
            // exists.  It's a highly discouraged use-case because the user will
            // think they can edit an input when they really can't, but we
            // shouldn't break existing forms doing this.
            visibility: 'visible_if_present',
            presence: 'optional',
            uiType: formdesigner.widgets.xPathWidget,
            xpathType: "generic",
            lstring: 'Calculate Condition'
        },
        constraintAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            uiType: formdesigner.widgets.xPathWidget,
            xpathType: "bool",
            lstring: 'Validation Condition'
        },
        // non-itext constraint message
        constraintMsgAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            validationFunc : function (mug) {
                var bindBlock = mug.bindElement;
                var hasConstraint = (typeof bindBlock.constraintAttr !== 'undefined');
                var hasConstraintMsg = (bindBlock.constraintMsgAttr || 
                                        (bindBlock.constraintMsgItextID && bindBlock.constraintMsgItextID.id));
                if (hasConstraintMsg && !hasConstraint) {
                    return 'ERROR: You cannot have a Validation Error Message with no Validation COndition!';
                } else {
                    return 'pass';
                }
            },
            lstring: 'Validation Error Message'
        },
        requiredAttr: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: "Is this Question Required?",
            uiType: formdesigner.widgets.checkboxWidget
        },
        nodeset: {
            editable: 'r',
            visibility: 'hidden',
            presence: 'optional' //if not present one will be generated... hopefully.
        }
    };

    var DEFAULT_CONTROL_ELEMENT_SPEC = {
        // part of the Mug type definition, so it's immutable
        tagName: {
            editable: 'r',
            immutable: true,
            visibility: 'hidden',
            presence: 'required',
            values: formdesigner.util.VALID_CONTROL_TAG_NAMES
        },
        appearance: {
            editable: 'r',
            visibility: 'hidden',
            presence: 'optional',
            lstring: 'Appearance Attribute'
        },
        label: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            validationFunc : validationFuncs.label,
            lstring: "Default Label"
        },
        hintLabel: {
            editable: 'w',
            visibility: 'visible',
            presence: 'optional',
            lstring: "Hint Label"
        },
    };

    /**
     * A mug is the standard object within a form and represents the combined
     * Data, Bind and Control elements.
     */
    var BaseMug = Class.$extend({
        // whether you can change to or from this question's type in the UI
        isTypeChangeable: true,
        isODKOnly: false,
        __init__: function () {
            var self = this;
            this.__spec = this.getSpec();

            _(this.__spec).each(function (spec, name) {
                if (spec) {
                    self[name] = new MugElement({
                        spec: spec,
                        mug: self,
                        name: name
                    });
                } else {
                    self[name] = null;
                }
            });

            // set question id if it isn't set
            if (this.dataElement && this.bindElement && 
                (!this.dataElement.nodeID || !this.bindElement.nodeID))
            {
                var nodeID = (this.dataElement.nodeID || this.bindElement.nodeID || 
                              formdesigner.util.generate_question_id());
                this.dataElement.nodeID = this.bindElement.nodeID = nodeID;
            }

            formdesigner.util.give_ufid(this);
            formdesigner.util.eventuality(this);
        },
        populate: function (xmlNode) {
            // load extra state from xml node
        },
        getSpec: function () {
            return {
                dataElement: this.getDataElementSpec(),
                bindElement: this.getBindElementSpec(),
                controlElement: this.getControlElementSpec()
            };
        },
        getDataElementSpec: function () {
            return formdesigner.pluginManager.call(
                'contributeToDataElementSpec', 
                $.extend(true, {}, DEFAULT_DATA_ELEMENT_SPEC),
                this
            )
        },
        getBindElementSpec: function () {
            return formdesigner.pluginManager.call(
                'contributeToBindElementSpec',
                $.extend(true, {}, DEFAULT_BIND_ELEMENT_SPEC),
                this
            );
        },
        getControlElementSpec: function () {
            return formdesigner.pluginManager.call(
                'contributeToControlElementSpec',
                $.extend(true, {}, DEFAULT_CONTROL_ELEMENT_SPEC),
                this
            );
        },
        copyAttrs: function (sourceMug, overrideImmutable) {
            if (this.dataElement && sourceMug.dataElement) {
                this.dataElement.setAttrs(sourceMug.dataElement, overrideImmutable);
            }
            if (this.bindElement && sourceMug.bindElement) {
                this.bindElement.setAttrs(sourceMug.bindElement, overrideImmutable);
            }
            if (this.controlElement && sourceMug.controlElement) {
                this.controlElement.setAttrs(sourceMug.controlElement, overrideImmutable);
            }
        },
        getBindElementID: function () {
            if (this.bindElement) {
                return this.bindElement.nodeID;
            } else {
                return null;
            }
        },
        getDataElementID: function () {
            if (this.dataElement) {
                return this.dataElement.nodeID;
            } else {
                return null;
            }
        },
        getAppearanceAttribute: function () {
            return (this.controlElement && this.controlElement.appearance) ? (this.controlElement.appearance) : null;
        },
        setAppearanceAttribute: function (attrVal) {
            this.controlElement.appearance = attrVal;
        },
        // get a property definition by a /-delimited string or list index
        // Returns null if this mug doesn't have a definition for that property.
        getPropertyDefinition: function (index) {
            if (!(index instanceof Array)) {
                index = index.split("/");
            } 
            // this will raise a reference error if you give it a bad value
            var ret = this.__spec[index[0]];
            for (var i = 1; i < index.length; i++) {
                if (!ret) {
                    return null;
                }
                ret = ret[index[i]];
            }
            return ret;
        },
        // get a property value by a /-delimited string or list index
        // Returns null if this mug doesn't have the element on which the
        // property is defined.
        getPropertyValue: function (index) {
            // get a propery value by a string or list index
            // assumes strings are split by the "/" character
            if (!(index instanceof Array)) {
                index = index.split("/");
            } 
            // this will raise a reference error if you give it a bad value
            var ret = this[index[0]];
            for (var i = 1; i < index.length; i++) {
                if (!ret) {
                    return null;
                }
                ret = ret[index[i]];
            }
            return ret;
        },
        getIcon: function () {
            return this.icon;
        },
        getErrors: function () {
            var self = this,
                errors = [];

            _(this.__spec).each(function (spec, name) {
                if (spec) {
                    var messages = _(self[name].getErrors())
                        .map(function (message) {
                            return message.replace("{element}", name);
                        });
                    errors = errors.concat(messages);
                }
            });

            return errors;
        },
        isValid: function () {
            return !this.getErrors().length;
        },
        getDefaultItextRoot: function () {
            var nodeID, parent;
            if (this.bindElement) { //try for the bindElement nodeID
                nodeID = this.bindElement.nodeID;
            } else if (this.dataElement) {
                // if nothing, try the dataElement nodeID
                nodeID = this.dataElement.nodeID;
            } else if (this.__className === "Item") {
                // if it's a choice, generate based on the parent and value
                parent = this.parentMug;
                if (parent) {
                    nodeID = parent.getDefaultItextRoot() + "-" + this.controlElement.defaultValue;
                }
            } 
            if (!nodeID) {
                // all else failing, make a new one
                nodeID = formdesigner.util.generate_item_label();
            }
            return nodeID;
        },
        
        getDefaultLabelItextId: function () {
            // Default Itext ID
            return this.getDefaultItextRoot() + "-label";
        },
        
        /*
         * Gets a default label, auto-generating if necessary
         */
        getDefaultLabelValue: function () {
            if (this.controlElement && this.controlElement.label) {
                return this.controlElement.label;
            } 
            else if (this.dataElement) {
                return this.dataElement.nodeID;
            } else if (this.bindElement) {
                return this.bindElement.nodeID;
            } else if (this.__className === "Item") {
                return this.controlElement.defaultValue;
            } else {
                // fall back to generating an ID
                return formdesigner.util.generate_item_label();
            } 
        },
        
        /*
         * Gets the actual label, either from the control element or an empty
         * string if not found.
         */
        getLabelValue: function () {
            if (this.controlElement.label) {
                return this.controlElement.label;
            } else {
                return "";
            } 
        },
        
        getDefaultLabelItext: function (defaultValue) {
            var formData = {};
            formData[formdesigner.pluginManager.javaRosa.Itext.getDefaultLanguage()] = defaultValue;
            return new ItextItem({
                id: this.getDefaultLabelItextId(),
                forms: [new ItextForm({
                            name: "default",
                            data: formData
                        })]
            });
        },
        
        // Add some useful functions for dealing with itext.
        setItextID: function (val) {
            if (this.controlElement) {
                this.controlElement.labelItextID.id = val;
            }
        },
        
        getItext: function () {
            if (this.controlElement) {
                return this.controlElement.labelItextID;
            } 
        },
    });

    var DataBindOnly = BaseMug.$extend({
        typeName: 'Hidden Value',
        icon: 'icon-vellum-variable',
        isTypeChangeable: false,
        getDataElementSpec: function () {
            var spec = this.$super();
            spec.xmlnsAttr.presence = "optional";
            return spec;
        },
        getControlElementSpec: function () {
            return null;
        },
        getBindElementSpec: function () {
            var spec = this.$super();
            spec.requiredAttr.presence = "notallowed";
            spec.constraintAttr.presence = "notallowed";
            spec.calculateAttr.visibility = "visible";
            return spec;
        }
    });
    
    var ControlOnly = BaseMug.$extend({
        getDataElementSpec: function () {
            return null;
        },
        getBindElementSpec: function () {
            return null;
        },
    });

    var ReadOnly = BaseMug.$extend({
        getDataElementSpec: function () {
            return null;
        },
        getBindElementSpec: function () {
            return null;
        },
        getControlElementSpec: function () {
            return {
                // virtual property used to get a widget
                readonlyControl: {
                    uiType: formdesigner.widgets.readOnlyControlWidget
                }
            };
        }
    });

    var TextQuestion = BaseMug.$extend({
        typeName: "Text",
        icon: "icon-vellum-text",
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:string";
        }
    });

    var PhoneNumber = TextQuestion.$extend({
        typeName: 'Phone Number or Numeric ID',
        icon: 'icon-signal',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.appearance = "numeric";
        }
    });

    var Secret = BaseMug.$extend({
        typeName: 'Password',
        icon: 'icon-key',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "secret";
            this.bindElement.dataType = "xsd:string";
        },
        getBindElementSpec: function () {
            var spec = this.$super();
            spec.dataType.validationFunc = function (m) {
                var dtype = m.bindElement.dataType;
                if (formdesigner.util.XSD_DATA_TYPES.indexOf(dtype) !== -1) {
                    return 'pass';
                } else {
                    return 'Password question data type must be a valid XSD Datatype!';
                }
            };
            spec.dataType.lstring = 'Data Type';
            return spec;
        }
    });

    var Int = BaseMug.$extend({
        typeName: 'Integer',
        icon: 'icon-vellum-numeric',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:int";
        }
    });

    var Audio = BaseMug.$extend({
        typeName: 'Audio Capture',
        icon: 'icon-vellum-audio-capture',
        isODKOnly: true,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "upload";
            this.controlElement.mediaType = "audio/*"; /* */
            this.bindElement.dataType = "binary";
        },
        getControlElementSpec: function () {
            return $.extend(true, {}, this.$super(), {
                mediaType: {
                    lstring: 'Media Type',
                    visibility: 'visible',
                    editable: 'w',
                    presence: 'required'
                }
            });
        }
    });

    var Image = Audio.$extend({
        typeName: 'Image Capture',
        icon: 'icon-camera',
        isODKOnly: true,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "upload";
            this.controlElement.mediaType = "image/*"; /* */
            this.bindElement.dataType = "binary";
        }
    });

    var Video = Audio.$extend({
        typeName: 'Video Capture',
        icon: 'icon-facetime-video',
        isODKOnly: true,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "upload";
            this.controlElement.mediaType = "video/*"; /* */
            this.bindElement.dataType = "binary";
        }
    });

    var Geopoint = BaseMug.$extend({
        typeName: 'GPS',
        icon: 'icon-map-marker',
        isODKOnly: true,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "geopoint";
        }
    });

    var AndroidIntent = BaseMug.$extend({
        typeName: 'Android App Callout',
        icon: 'icon-vellum-android-intent',
        isODKOnly: true,
        isTypeChangeable: false,
        intentTag: null,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "intent";
        },
        getControlElementSpec: function () {
            // virtual properties used to get widgets
            return $.extend({}, this.$super(), {
                androidIntentAppId: {
                    visibility: 'visible',
                    uiType: formdesigner.widgets.androidIntentAppIdWidget
                },
                androidIntentExtra: {
                    visibility: 'visible',
                    uiType: formdesigner.widgets.androidIntentExtraWidget
                },
                androidIntentResponse: {
                    visibility: 'visible',
                    uiType: formdesigner.widgets.androidIntentResponseWidget
                }
            });
        },
        // todo: move to spec system
        getAppearanceAttribute: function () {
            return 'intent:' + this.dataElement.nodeID;
        }
    });

    var Barcode = BaseMug.$extend({
        typeName: 'Barcode Scan',
        icon: 'icon-vellum-android-intent',
        isODKOnly: true,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "barcode";
        }
    });

    var Date = BaseMug.$extend({
        typeName: 'Date',
        icon: 'icon-calendar',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:date";
        }
    });

    var DateTime = BaseMug.$extend({
        typeName: 'Date and Time',
        icon: 'icon-vellum-datetime',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:dateTime";
        }
    });

    var Time = BaseMug.$extend({
        typeName: 'Time',
        icon: 'icon-time',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "input";
            this.bindElement.dataType = "xsd:time";
        }
    });

    var Long = Int.$extend({
        typeName: 'Long',
        icon: 'icon-vellum-long',
        __init__: function (options) {
            this.$super(options);
            this.bindElement.dataType = "xsd:long";
        }
    });

    var Double = Int.$extend({
        typeName: 'Decimal',
        icon: 'icon-vellum-decimal',
        __init__: function (options) {
            this.$super(options);
            this.bindElement.dataType = "xsd:double";
        }
    });

    var Item = ControlOnly.$extend({
        typeName: 'Choice',
        icon: 'icon-circle-blank',
        isTypeChangeable: false,
        getIcon: function () {
            if (this.parentMug.__className === "Select") {
                return 'icon-circle-blank';
            } else {
                return 'icon-check-empty';
            }
        },
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "item";
            this.controlElement.defaultValue = formdesigner.util.generate_item_label();
        },
        getControlElementSpec: function () {
            var spec = this.$super();
            spec.defaultValue = {
                lstring: 'Choice Value',
                visibility: 'hidden',
                editable: 'w',
                presence: 'optional',
                validationFunc: validationFuncs.defaultValue
            };
            spec.hintLabel.presence = 'notallowed';
            spec.hintItextID.presence = 'notallowed';

            spec.defaultValue.visibility = 'visible';
            spec.defaultValue.presence = 'required';

            return spec;
        }
    });

    var Trigger = BaseMug.$extend({
        typeName: 'Label',
        icon: 'icon-tag',
        isTypeChangeable: false,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "trigger";
        },
        getBindElementSpec: function () {
            var spec = this.$super();
            spec.dataType.presence = 'notallowed';
            return spec;
        },
        getDataElementSpec: function () {
            var spec = this.$super();
            spec.dataValue.presence = 'optional';
            return spec;
        },
        getControlElementSpec: function () {
            return $.extend({}, this.$super(), {
                appearanceControl: {
                    lstring: 'Show OK checkbox',
                    editable: 'w',
                    visibility: 'visible',
                    presence: 'optional',
                    uiType: formdesigner.widgets.checkboxWidget
                }
            });
        },
        populate: function (xmlNode) {
            var appearance = xmlNode.attr('appearance');
            this.controlElement.appearanceControl = appearance !== "minimal";
        },
        getAppearanceAttribute: function () {
            return (this.controlElement && this.controlElement.appearanceControl) ? null : 'minimal';
        }
    });

    var BaseSelect = BaseMug.$extend({});

    var MSelect = BaseSelect.$extend({
        typeName: 'Multiple Answer',
        icon: 'icon-vellum-multi-select',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "select";
        },
        getBindElementSpec: function () {
            var spec = this.$super();
            spec.dataType.visibility = "hidden";
            return spec;
        },
    });

    var Select = MSelect.$extend({
        typeName: 'Single Answer',
        icon: 'icon-vellum-single-select',
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "select1";
        }
    });

    var Group = BaseMug.$extend({
        typeName: 'Group',
        icon: 'icon-folder-open',
        isSpecialGroup: true,
        isTypeChangeable: false,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "group";
        },
        getControlElementSpec: function () {
            var spec = this.$super();
            spec.hintLabel.presence = "notallowed";
            return spec;
        },
        getBindElementSpec: function () {
            var spec = this.$super();
            spec.dataType.presence = "notallowed";
            spec.calculateAttr.presence = "notallowed";
            spec.constraintAttr.presence = "notallowed";
            return spec;
        },
        getDataElementSpec: function () {
            var spec = this.$super();
            spec.dataValue.presence = "notallowed";
            return spec;
        }
    });
    
    // This is just a group, but appearance = 'field-list' displays it as a list
    // of grouped questions.  It's a separate question type because it can't
    // nest other group types and it has a very different end-user functionality
    var FieldList = Group.$extend({
        typeName: 'Question List',
        icon: 'icon-reorder',
        isSpecialGroup: true,
        isTypeChangeable: false,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "group";
            this.setAppearanceAttribute('field-list');
        },
    });

    var Repeat = Group.$extend({
        typeName: 'Repeat Group',
        icon: 'icon-retweet',
        isSpecialGroup: true,
        isTypeChangeable: false,
        __init__: function (options) {
            this.$super(options);
            this.controlElement.tagName = "repeat";
        },
        getControlElementSpec: function () {
            return $.extend(true, {}, this.$super(), {
                repeat_count: {
                    lstring: 'Repeat Count',
                    visibility: 'visible',
                    editable: 'w',
                    presence: 'optional',
                    uiType: formdesigner.widgets.droppableTextWidget
                },
                no_add_remove: {
                    lstring: 'Disallow Repeat Add and Remove?',
                    visibility: 'visible',
                    editable: 'w',
                    presence: 'optional',
                    uiType: formdesigner.widgets.checkboxWidget
                }
            });
        }
    });
    
    var exportedMugTypes = {
        "AndroidIntent": AndroidIntent,
        "Audio": Audio,
        "Barcode": Barcode,
        "DataBindOnly": DataBindOnly,
        "Date": Date,
        "DateTime": DateTime,
        "Double": Double,
        "FieldList": FieldList,
        "Geopoint": Geopoint,
        "Group": Group,
        "Image": Image,
        "Int": Int,
        "Item": Item,
        "Long": Long,
        "MSelect": MSelect,
        "PhoneNumber": PhoneNumber,
        "ReadOnly": ReadOnly,
        "Repeat": Repeat,
        "Secret": Secret,
        "Select": Select,
        "Text": TextQuestion,
        "Time": Time,
        "Trigger": Trigger,
        "Video": Video,
    },
        allTypes = _.keys(exportedMugTypes),
        innerChildQuestionTypes = _.without(allTypes, 'DataBindOnly', 'Item'),
        nonGroupTypes = _.without(innerChildQuestionTypes, 
            'Group', 'Repeat', 'FieldList');

    _(exportedMugTypes).each(function (Mug, name) {
        // had issues with trying to do instanceof involving Mug, so using name
        var validChildTypes;
        if (name == "Group" || name == "Repeat") {
            validChildTypes = innerChildQuestionTypes;
        } else if (name == "FieldList") {
            validChildTypes = nonGroupTypes;
        } else if (name == "Select" || name == "MSelect") {
            validChildTypes = ["Item"];
        } else {
            validChildTypes = [];
        }

        // TODO: figure out how to get isinstance working
        Mug.prototype.__className = name;
        Mug.prototype.validChildTypes = validChildTypes;
    });

    return exportedMugTypes;
})();
