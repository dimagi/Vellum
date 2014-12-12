define([
    'vellum/util',
    'underscore'
], function (
    util,
    _
) {
    /**
     * Children is a list of objects.
     * @param children - optional
     * @param value - that value object that this node should contain (should be a Mug)
     */
    function Node(children, value) {
        this.value = value;
        this.children = children || [];
    }

    Node.prototype = {
        getChildren: function () {
            return this.children;
        },
        getValue: function () {
            return this.value;
        },
        setValue: function (val) {
            this.value = val;
            _(this.children).each(function (child) {
                child.getValue().parentMug = val;
            });
        },
        /**
         * DOES NOT CHECK TO SEE IF NODE IS IN TREE ALREADY!
         * Adds child to END of children!
         */
        addChild: function (node) {
            this.children.push(node);
        },
        /**
         * Insert child at the given index (0 means first)
         * if index > children.length, will insert at end.
         * -ve index will result in child being added to first of children list.
         */
        insertChild: function (node, index) {
            if (node === null) {
                return null;
            }

            if (index < 0) {
                index = 0;
            }

            this.children.splice(index, 0, node);
        },
        getSingleMatchingNode: function (fn) {
            var thisVal = this.getValue(),
                retVal;

            if (fn(thisVal)) {
                return this;
            } else {
                for (var i = 0; i < this.children.length; i++) {
                    retVal = this.children[i].getSingleMatchingNode(fn);
                    if (retVal) {
                        return retVal;
                    }
                }
            }
            return null; //we haven't found what we're looking for
        },
        // todo: store nodes as a data-attribute in JSTree so this doesn't have
        // to walk the whole tree
        getMugFromUFID: function (ufid) {
            var node = this.getSingleMatchingNode(function (value) {
                return value && value.ufid === ufid;
            });
            
            return node ? node.getValue() : null;
        },
        removeChild: function (node) {
            var childIdx = this.children.indexOf(node);
            if (childIdx !== -1) { //if arg node is a member of the children list
                this.children.splice(childIdx, 1); //remove it
            }

            return node;
        },
        /**
         * Finds the parentNode of the specified node (recursively going through the tree/children of this node)
         * Returns the parent if found, else null.
         */
        findParentNode: function (node) {
            var i, parent = null;
            if (!this.children || this.children.length === 0) {
                return null;
            }
            if (this.children.indexOf(node) !== -1) {
                return this;
            }

            for (i in this.children) {
                if (this.children.hasOwnProperty(i)) {
                    parent = this.children[i].findParentNode(node);
                    if (parent !== null) {
                        return parent;
                    }
                }
            }
            return parent;
        },
        /**
         * An ID used during prettyPrinting of the Node. (a human readable value for the node)
         */
        getID: function () {
            if (this.isRootNode) {
                return this.rootNodeId;
            }
            return this.getValue().getNodeID();
        },
        /**
         * Get all children MUG TYPES of this node (not recursive, only the top level).
         * Return a list of Mug objects, or empty list for no children.
         */
        getChildrenMugs: function () {
            var i, retList = [];
            for (i in this.children) {
                if (this.children.hasOwnProperty(i)) {
                    retList.push(this.children[i].getValue());
                }
            }
            return retList;
        },
        getStructure: function () {
            var ret = {};
            ret[this.getID()] = _.map(this.children, function (c) {
                return c.getStructure();
            });
            return ret;
        },
        /**
         * calls the given function on each node (the node
         * is given as the only argument to the given function)
         * and appends the result (if any) to a flat list
         * (the store argument) which is then returned
         * @param nodeFunc
         * @param store
         */
        treeMap: function (nodeFunc, store, afterChildFunc) {
            var result = nodeFunc(this), // call on self
                children = this.getChildren(),
                child;
            if(result) {
                store.push(result);
            }
            for(child in children) {
                if(children.hasOwnProperty(child)){
                    // have each children also perform the func
                    children[child].treeMap(nodeFunc, store, afterChildFunc);
                }
            }
            if(afterChildFunc) {
                afterChildFunc(this, result);
            }
            return store;
        },
        walk: function (callback) {
            function processChildren(filter) {
                if (filter) {
                    children = filter(children, value);
                }
                for (var i = 0; i < children.length; i++) {
                    children[i].walk(callback);
                }
            }
            var value = this.getValue(),
                children = this.getChildren();
            callback(value, this.getID(), processChildren);
        },
        validateTree: function (validateValue) {
            var i, childResult;
            if(!this.getValue()){
                throw 'Tree contains node with no values!';
            }
            if (!validateValue(this.getValue())) {
                return false;
            }

            for (i in this.getChildren()) {
                if (this.getChildren().hasOwnProperty(i)) {
                    childResult = this.getChildren()[i].validateTree(validateValue);
                    if(!childResult){
                        return false;
                    }
                }
            }

            //If we got this far, everything checks out.
            return true;
        }
    };

    /**
     * A regular tree (with any amount of leafs per node)
     * @param treeType - is this a data or control tree
     * 'data' or 'control' for this argument, respectively)
     */
    function Tree(rootId, treeType) {
        util.eventuality(this);

        this.rootNode = new Node(null, null);
        this.rootNode.isRootNode = true;
        this.setRootID(rootId);
        this.treeType = treeType || 'data';
    }

    Tree.prototype = {
        setRootID: function (id) {
            this.rootNode.rootNodeId = id;
        },
        getParentNode: function (node) {
            if (this.rootNode === node) { //special case:
                return this.rootNode;
            } else { //regular case
                return this.rootNode.findParentNode(node);
            }
        },
        getStructure: function () {
            return this.rootNode.getStructure();
        },
        /**
         * Given a mug, finds the node that the mug belongs to (in this tree).
         * Will return null if nothing is found.
         */
        getNodeFromMug: function (mug) {
            // gets set in insertMug()
            return mug['_node_' + this.treeType];
        },
        _removeNodeFromTree: function (node) {
            var parent = this.getParentNode(node);
            if (parent) {
                parent.removeChild(node);
                this.fire({
                    type: 'change'
                });
            }
        },
        /**
         * Insert a Mug as a child to the node containing parentMug.
         *
         * Will MOVE the mug to the new location in the tree if it is already present!
         * @param mug - the Mug to be inserted into the Tree
         * @param position - position relative to the refMug.
         *                   Can be null, 'before', 'after', 'first', 'last'
         *                   or 'into' (synonym for 'last')
         * @param refMug - reference Mug.
         *
         * If refMug is null, will default to the last child of the root node.
         * If position is null, will default to 'after'.  If 'into' is
         * specified, mug will be inserted as last child of the refMug.
         *
         * If an invalid move is specified, no operation will occur.
         */
        insertMug: function (mug, position, refMug) {
            var refNode = refMug ? this.getNodeFromMug(refMug) : this.rootNode,
                node = this.getNodeFromMug(mug),
                refNodeSiblings, refNodeIndex, refNodeParent;

            if (node) {
                this._removeNodeFromTree(node); 
            } else {
                node = new Node(null, mug);
                // store a reference to node in order to make getNodeFromMug()
                // lookup fast 
                mug['_node_' + this.treeType] = node;
            }

            refNodeParent = this.getParentNode(refNode);
            refNodeSiblings = refNodeParent.getChildren();
            refNodeIndex = refNodeSiblings.indexOf(refNode);

            if (['into', 'first', 'last', 'inside'].indexOf(position) !== -1) {
                mug.parentMug = refMug;
            } else {
                mug.parentMug = refNodeParent.getValue();
            }

            switch (position) {
                case 'before':
                case 'inside': // for compatibility with JSTree
                    refNodeParent.insertChild(node, refNodeIndex);
                break;
                case null:
                case 'after':
                    refNodeParent.insertChild(node, refNodeIndex + 1);
                break;
                case 'into': // not officially supported by, but happens to work in JSTree
                case 'last':
                    refNode.addChild(node);
                break;
                case 'first':
                    refNode.insertChild(node, 0);
                break;
                default:
                    throw "in insertMug() position argument MUST be null, " +
                          "'before', 'after', 'into', 'first' or 'last'. " +
                          "Argument was: " + position;
            }
            this.fire({
                type: 'change',
                mug: mug
            });
        },
        getAbsolutePath: function (mug, excludeRoot) {
            var node = this.getNodeFromMug(mug),
                output, nodeParent;
            if (!node) {
                return null;
            }
            nodeParent = this.getParentNode(node);
            output = '/' + node.getID();

            while (nodeParent) {
                if (!nodeParent.isRootNode || !excludeRoot) {
                    output = '/' + nodeParent.getID() + output;
                }
                if (nodeParent.isRootNode) {
                    break;
                }
                nodeParent = this.getParentNode(nodeParent);
            }

            return output;
        },
        /**
         * Find a sibling of refMug matching a predicate
         *
         * @param refMug
         * @param direction - Either 'before' or 'after'; the direction to
         *                    search from refMug among its siblings.
         * @param predicate - A function used to determine if any of refMug's
         *                    siblings are a suitable.
         * @returns The first sibling of refMug in the given direction matching
         *          predicate.
         * @throws An error if refMug is not found in the tree or if refMug
         *         is not found among its parent's children.
         */
        findSibling: function (refMug, direction, predicate) {
            var node = this.getNodeFromMug(refMug),
                children, start, i;
            if (!node) {
                throw "mug not found in " + this.treeType + " tree";
            }
            children = this.getParentNode(node).getChildrenMugs();
            start = children.indexOf(refMug);
            if (start === -1) {
                throw "mug not found in its parent's children";
            }
            if (direction === 'before') {
                for (i = start - 1; i >= 0; i--) {
                    if (predicate(children[i])) {
                        return children[i];
                    }
                }
            } else {
                for (i = start + 1; i < children.length; i++) {
                    if (predicate(children[i])) {
                        return children[i];
                    }
                }
            }
            return null;
        },
        /**
         * Removes the specified Mug from the tree. If it isn't in the tree
         * does nothing.  Does nothing if null is specified
         *
         * If the Mug is successfully removed, returns that Mug.
         */
        removeMug: function (mug) {
            this._removeNodeFromTree(this.getNodeFromMug(mug));
        },
        /**
         * Given a UFID searches through the tree for the corresponding Mug and returns it.
         * @param ufid of a mug
         */
        getMugFromUFID: function (ufid) {
            return this.rootNode.getMugFromUFID(ufid);
        },

        /**
         * Returns all the children Mugs (as a list) of the
         * root node in the tree.
         */
        getRootChildren: function () {
            return this.rootNode.getChildrenMugs();
        },
        /**
         * Performs the given func on each
         * node of the tree (the Node is given as the only argument to the function)
         * and returns the result as a list.
         * @param func - a function called on each node, the node is the only argument
         * @param afterChildFunc - a function called after the above function is called on each child of the current node.
         */
        treeMap: function (func, afterChildFunc) {
            return this.rootNode.treeMap(func, [], afterChildFunc);
        },
        /**
         * Call a function for each mug in the tree and allow each mug to
         * manipulate its tree of children.
         *
         * @param callback - A function that accepts three arguments:
         *  - mug : the node value (null for the root node). This object may
         *          have a function `mug.options.dataWriterChildren`, which will
         *          be called with the mug and a list of its child tree nodes
         *          (not mugs). This allows the mug to manipulate it's tree
         *          branches by returning a list of tree nodes.
         *  - nodeID : The ID of the mug's tree node.
         *  - processChildren : a function that processes the mug's children. If
         *          this function is not called the mug's children will not be
         *          visited. This function accepts one optional argument,  a
         *          filter function `filter(childTreeNodes, mug)` that may
         *          return a list of filtered tree nodes.
         */
        walk: function (callback) {
            this.rootNode.walk(callback);
        },
        isTreeValid: function(validateValue) {
            var rChildren = this.rootNode.getChildren(),
            i, retVal;
            for (i in rChildren){
                if(rChildren.hasOwnProperty(i)){
                    retVal = rChildren[i].validateTree(validateValue);
                    if(!retVal){
                        return false;
                    }
                }
            }
            return true;
        },
        getRootNode: function () {
            return this.rootNode;
        }
    };

    return Tree;
});

