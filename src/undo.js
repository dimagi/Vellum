define([], function () {
    const PUSH_INTERVAL = 500;

    function UndoStack() {
        this.undoItems = [];
        this.redoItems = [];
        this.isUpdating = false;
        this.lastPushTime = null;
    }

    UndoStack.prototype = {
        /**
         * Pushes an item to the undo stack.
         *
         * @param {*} item - The item to push onto the undo stack
         * @param {boolean} [accumulateUntilPause=true] - Whether to accumulate rapid pushes
         *                                               by replacing the last item instead
         *                                               of adding new items
         * @returns {boolean} - true if the push was successful, false if ignored due to
         *                     an ongoing update operation
         */
        push: function (item, accumulateUntilPause = true) {
            if (this.isUpdating) {
                return false;
            }
            if (accumulateUntilPause && this.undoItems.length > 0 &&
                this.lastPushTime !== null && Date.now() - this.lastPushTime < PUSH_INTERVAL) {
                this.undoItems[this.undoItems.length - 1] = item;
            } else {
                this.undoItems.push(item);
            }
            if (accumulateUntilPause) {
                this.lastPushTime = Date.now();
            } else {
                this.lastPushTime = null;
            }
            this.redoItems = [];
            return true;
        },
        /**
         * Peeks at the last action without removing it from the undo stack.
         *
         * @returns {Object} The last action item.
         */
        peek: function (callback) {
            let result = null;
            if (this.undoItems.length > 0) {
                result = this.undoItems[this.undoItems.length - 1];
            }
            if (callback && typeof callback === 'function') {
                this.isUpdating = true;
                try {
                    callback(result);
                } finally {
                    this.lastPushTime = null;
                    this.isUpdating = false;
                }
            }
        },
        /**
         * Undoes the last action by popping the most recent item from the undo stack and
         * pushes it to the redo stack.
         *
         * @param {Function} [callback] - Callback function that will be invoked with
         *                               the result. During callback execution, push operations
         *                               are disabled to prevent infinite loops.
         */
        undo: function (callback) {
            let result = null;
            if (this.undoItems.length > 1) {
                this.redoItems.push(this.undoItems.pop());
                result = this.undoItems[this.undoItems.length - 1];
            }
            if (callback && typeof callback === 'function') {
                this.isUpdating = true;
                try {
                    callback(result);
                } finally {
                    this.lastPushTime = null;
                    this.isUpdating = false;
                }
            }
        },
        /**
         * Redoes the last undone action by popping an item from the redo stack.
         *
         * @param {Function} [callback] - Callback function that will be invoked with
         *                               the result. During callback execution, push operations
         *                               are disabled to prevent infinite loops.
         */
        redo: function (callback) {
            let result = null;
            if (this.redoItems.length > 0) {
                const item = this.redoItems.pop();
                this.undoItems.push(item);
                result = item;
            }
            if (callback && typeof callback === 'function') {
                this.isUpdating = true;
                try {
                    callback(result);
                } finally {
                    this.lastPushTime = null;
                    this.isUpdating = false;
                }
            }
        }
    };

    function ElementUndoStack(element) {
        this.element = element;
        this.undoStack = new UndoStack();
    }

    function getCursorPosition(element) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return null;

        const range = selection.getRangeAt(0);
        const startNode = range.startContainer;
        const startOffset = range.startOffset;

        if (!element.contains(startNode)) return null;

        const nodePath = [];
        let currentNode = startNode;
        while (currentNode !== element) {
            const parent = currentNode.parentNode;
            if (!parent) break;
            const index = Array.from(parent.childNodes).indexOf(currentNode);
            nodePath.unshift(index);
            currentNode = parent;
        }

        return { nodePath, startOffset };
    }

    function setCursorPosition(element, savedPosition) {
        if (!savedPosition) return;

        let targetNode = element;
        savedPosition.nodePath.forEach(index => {
            if (targetNode.childNodes[index]) {
                targetNode = targetNode.childNodes[index];
            } else {
                targetNode = element;
            }
        });

        const range = document.createRange();
        try {
            range.setStart(targetNode, savedPosition.startOffset);
            range.setEnd(targetNode, savedPosition.startOffset);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            // console.error("Failed to restore cursor position:", e);
        }
    }

    function sendInputEvent(element) {
        const inputEvent = new Event('input', {
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(inputEvent);
    }

    ElementUndoStack.prototype = {
        push: function (accumulateUntilPause = true) {
            const item = {
                value: this.element.innerHTML,
                cursor: getCursorPosition(this.element)
            };
            this.undoStack.push(item, accumulateUntilPause);
        },
        peek: function () {
            let value = null;
            this.undoStack.peek((v) => {
                value = v;
            });
            return value;
        },
        reset: function () {
            this.undoStack.peek((item) => {
                if (item !== null) {
                    this.element.innerHTML = item.value;
                    setCursorPosition(this.element, item.cursor);
                }
            });
        },
        undo: function () {
            this.undoStack.undo(item => {
                if (item !== null) {
                    this.element.innerHTML = item.value;
                    setCursorPosition(this.element, item.cursor);
                    sendInputEvent(this.element);
                }
            });
        },
        redo: function () {
            this.undoStack.redo(item => {
                if (item !== null) {
                    this.element.innerHTML = item.value;
                    setCursorPosition(this.element, item.cursor);
                    sendInputEvent(this.element);
                }
            });
        },
    };

    return {
        UndoStack,
        ElementUndoStack
    };
});
