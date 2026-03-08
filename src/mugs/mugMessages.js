import _ from "underscore";

function MugMessages() {
    this.messages = {};
}
MugMessages.prototype = {
    /**
     * Update message for property
     *
     * @param attr - The attribute to which the message applies.
     *      This may be a falsey value (typically `null`) for
     *      messages that are not associated with a property.
     * @param msg - A message object. A message object with a blank
     *      message will cause an existing message with the same
     *      key to be discarded.
     *
     *      {
     *          key: <message type key>,
     *          level: <"warning", or "error">,
     *          message: <message string>,
     *          onDrop: <optional callback; called if the message is removed>,
     *      }
     *
     * @returns - true if changed else false
     */
    update: function (attr, msg) {
        attr = attr || "";
        if (arguments.length === 1) {
            if (this.messages.hasOwnProperty(attr)) {
                delete this.messages[attr];
                return true;
            }
            return false;
        }
        if (!this.messages.hasOwnProperty(attr) && !msg.message) {
            return false;
        }
        if (!msg.key) {
            // should never happen
            throw new Error("missing key: " + JSON.stringify(msg));
        }
        var messages = this.messages[attr] || [],
            removed = false;
        for (var i = messages.length - 1; i >= 0; i--) {
            var obj = messages[i];
            if (obj.key === msg.key) {
                const objMessage = this.getMessageText(obj.message);
                const msgMessage = this.getMessageText(msg.message);
                if (obj.level === msg.level && objMessage === msgMessage) {
                    // message already exists (no change)
                    return false;
                }
                messages.splice(i, 1);
                obj.onDrop?.();
                removed = true;
                break;
            }
        }
        if (msg.message) {
            messages.push(msg);
        } else if (!removed) {
            return false;
        }
        if (messages.length) {
            this.messages[attr] = messages;
        } else {
            delete this.messages[attr];
        }
        return true;
    },
    /**
     * Get messages
     *
     * @param attr - The attribute for which to get messages.
     * @param key - (optional) The key of the message to get.
     *      If this is given then the entire message object will be
     *      returned; otherwise only message strings are returned.
     * @returns - An array of message strings, or if the `key` param
     *      is provided, the message object for the given key; null
     *      if no message is found with the given key.
     */
    get: function (attr, key) {
        if (arguments.length) {
            if (key) {
                return _.find(this.messages[attr || ""], function (msg) {
                    return msg.key === key;
                }) || null;
            }
            return _.pluck(this.messages[attr || ""], "message");
        }
        return _.flatten(_.map(this.messages, function (messages) {
            return _.pluck(messages, "message");
        }));
    },
    /**
     * Execute a function for each message
     *
     * @param attr - Optional property limiting the messages visited.
     *          The callback signature is `callback(msg)` if
     *          this argument is provided, and otherwise
     *          `callback(msg, property)`. In all cases the first
     *          argument `msg` is a message object.
     * @param callback - A function to be called for each message object.
     */
    each: function () {
        var attr, callback;
        if (arguments.length > 1) {
            attr = arguments[0] || "";
            callback = arguments[1];
            _.each(this.messages[attr], callback);
        } else {
            callback = arguments[0];
            _.each(this.messages, function (messages, attr) {
                _.each(messages, function (msg) {
                    callback(msg, attr);
                });
            });
        }
    },
    /**
     * Check if this messages object is empty
     */
    isEmpty: function() {
        return _.isEmpty(this.messages);
    },
    getMessageText: function(message) {
        return (message && message.hasOwnProperty("markdown")) ? message.markdown: message;
    }
};

export default MugMessages;
