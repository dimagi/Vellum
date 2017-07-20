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
        this.parent = null;
    }

    Node.prototype = {
        getChildren: function () {
            // DEPRECATED use 'children' directly
            return this.children;
        },
        getValue: function () {
            // DEPRECATED use 'value' directly
            return this.value;
        },
        /**
         * DOES NOT CHECK TO SEE IF NODE IS IN TREE ALREADY!
         * Adds child to END of children!
         */
        addChild: function (node) {
            node.parent = this;
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
            node.parent = this;
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
        removeChild: function (node) {
            var childIdx = this.children.indexOf(node);
            if (childIdx !== -1) { //if arg node is a member of the children list
                this.children.splice(childIdx, 1); //remove it
            }
            node.parent = null;
            return node;
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
        getAbsolutePath: function (excludeRoot) {
            if (this.isRootNode) {
                if (excludeRoot) {
                    return '';
                }
                return '/' + this.getID();
            }
            var mug = this.value,
                dataParent = mug.p.dataParent,
                parentPath;
            if (dataParent) {
                var dataParentMug = mug.form.getMugByPath(dataParent);
                if (!dataParentMug || dataParentMug === mug) {
                    if (excludeRoot) {
                        parentPath = '';
                    } else {
                        parentPath = '/' + this.getRootNode().rootNodeId;
                    }
                } else {
                    parentPath = mug.form.getAbsolutePath(dataParentMug, excludeRoot);
                }
            } else {
                parentPath = this.parent.getAbsolutePath(excludeRoot);
                if (parentPath === null) {
                    return null;
                }
            }
            var name = this.getID();
            if (mug.options.getPathName) {
                name = mug.options.getPathName(mug, name);
            }
            return (parentPath ? parentPath : '') + '/' + name;
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
        },
        getRootNode: function () {
            if (this.isRootNode) {
                return this;
            }
            return this.parent.getRootNode();
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
            if (this.rootNode === node) {
                //special case:
                return this.rootNode;
            }
            return node && node.parent;
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
         * @returns - the tree node of the inserted mug.
         *
         * If refMug is null, will default to the last child of the root node.
         * If position is null, will default to 'after'.  If 'into' is
         * specified, mug will be inserted as last child of the refMug.
         *
         * If an invalid move is specified, no operation will occur.
         */
        insertMug: function (mug, position, refMug, index) {
            var refNode = refMug ? this.getNodeFromMug(refMug) : this.rootNode,
                node = this.getNodeFromMug(mug),
                refNodeIndex, refNodeParent;

            if (node && this.rootNode === node.getRootNode()) {
                this._removeNodeFromTree(node); 
            } else {
                node = new Node(null, mug);
                // store a reference to node in order to make getNodeFromMug()
                // lookup fast 
                mug['_node_' + this.treeType] = node;
            }

            switch (position) {
                case 'before':
                case 'inside': // for compatibility with JSTree
                    refNodeParent = this.getParentNode(refNode);
                    refNodeIndex = refNodeParent.children.indexOf(refNode);
                    refNodeParent.insertChild(node, refNodeIndex);
                break;
                case null:
                case 'after':
                    refNodeParent = this.getParentNode(refNode);
                    refNodeIndex = refNodeParent.children.indexOf(refNode);
                    refNodeParent.insertChild(node, refNodeIndex + 1);
                break;
                case 'into': // not officially supported by, but happens to work in JSTree
                case 'last':
                    refNode.addChild(node);
                break;
                case 'first':
                    refNode.insertChild(node, 0);
                break;
                case 'index':
                    refNode.insertChild(node, index);
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
            return node;
        },
        getAbsolutePath: function (mug, excludeRoot) {
            var node = this.getNodeFromMug(mug);
            if (!node) {
                return null;
            }
            return node.getAbsolutePath(excludeRoot);
        },
        /**
         * Find the previous sibling of a mug
         *
         * First mug in a group - returns the group mug
         * first mug in form - returns root node
         * any other mug - returns the previous sibling
         */
        getPreviousSibling: function (mug) {
            var tree = this,
                node = tree.getNodeFromMug(mug),
                parentMug = mug.parentMug,
                parentNode = parentMug ? tree.getNodeFromMug(parentMug) : tree.getRootNode(),
                mugPosition = parentNode.children.indexOf(node);
            return (mugPosition === 0) ? parentMug : parentNode.children[mugPosition - 1].getValue();
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
         *  - mug : the node value (null for the root node).
         *  - nodeID : the ID of the mug's tree node.
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

    Tree.Node = Node; // exposed for walk filters
    return Tree;
});

