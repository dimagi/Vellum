define([
    'json!langCodes',
    'underscore',
    'jquery',
    'jquery.bootstrap-popout'
], function (
    langCodes,
    _,
    $
) {
    RegExp.escape = function(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };
    
    $.fn.stopLink = function() {
        // stops anchor tags from clicking through
        this.click(function (e) {
            e.preventDefault();
        });
        return this;
    };

    $.fn.fdHelp = function () {
        // creates a help popover, requires twitter bootstrap
        this.append($('<i />').addClass('icon-question-sign'))
            .popout({
                trigger: 'hover',
                html: true
            });
        return this;
    };

    var that = {};

    // deep extend
    that.extend = function () {
        var args = Array.prototype.slice.call(arguments);

        return $.extend.apply(null, [true, {}].concat(args));
    };

    that.langCodeToName = {};
    _.each(langCodes, function (lang) {
        var name = lang.names[0];
        that.langCodeToName[lang.three] = name;
        that.langCodeToName[lang.two] = name;
    });

    that.XPATH_REFERENCES = [
        "relevantAttr",
        "calculateAttr",
        "constraintAttr"
    ];

    that.getTemplateObject = function (selector, params) {
        return $(_.template($(selector).text(), params));
    };
    
    /**
     * Check if value is a valid XML attribute value (additionally disallow all
     * ' and ")
     */
    that.isValidAttributeValue = function (value) {
        return (/^[^<&'"]*$/).test(value);
    };
    
    /**
     * Grabs the value between the tags of the element passed in
     * and returns a string of everything inside.
     *
     * This method is kindy of hacky, so buyer beware.
     *
     * Motivation: Jquery's selector can't do this.  We need to be able to
     * grab the value of label tags, even if it includes <output> tags inside
     * of it (since the tag may need to be displayed to the user).
     * @param el - jquery selector or string used in the selector pointing to a DOM element.
     */
    that.getXLabelValue = function(el){
        var xmls = new XMLSerializer(),
            resStr, resEl;
        function getEndTag (str) {
            var res, reo, last;
            reo = /<\/(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
            res = reo.exec(str);
            last = res;
            while(res !== null) {
                last = res;
                res = reo.exec(str);
            }
            if(last){
                return last[0];
            }else{
                return null;
            }
            
        }

        function getStartTag (str) {
            var re, res;
            re = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/;
            res = re.exec(str);
            return res[0];
        }

        resEl = $(el)[0];
        if(!resEl) { return; }
        resStr = xmls.serializeToString(resEl);
        resStr = resStr.replace(getStartTag(resStr),'').replace(getEndTag(resStr),'');
        
        return resStr;
    };

    /**
     * Given two lists, creates a new array (and returns it)
     * that contains only unique values
     * based on comparing the two argument arrays.
     * @param arrA
     * @param arrB
     */
    var mergeArray = function (arrA, arrB) {
        var result = [], i;
        for(i in arrA){
            if(arrA.hasOwnProperty(i)){
                if(arrA.slice(0,arrA.indexOf(i)).indexOf(i) === -1){ //check to see if there aren't dupes in arrA
                    result.push(arrA[i]);
                }
            }
        }

        for(i in arrB){
            if(arrB.hasOwnProperty(i)){
                if(result.indexOf(arrB[i]) === -1){
                    result.push(arrB[i]); //grab only anything that hasn't shown up yet
                }
            }
        }

        return result;
    };
    that.mergeArray = mergeArray;


    
    // Simple Event Framework
    // Just run your object through this function to make it event aware.
    // Adapted from 'JavaScript: The Good Parts' chapter 5
    that.eventuality = function (that) {
        var registry = {};
        /**
         * Fire event, calling all registered handlers and unbind `one` handlers
         */
        that.fire = function (event) {
            var array,
                func,
                handler,
                i,
                type = typeof event === 'string' ? event : event.type;
            if (registry.hasOwnProperty(type)) {
                array = registry[type];
                for (i = 0; i < array.length; i += 1) {
                    handler = array[i];
                    func = handler.method;
                    if (typeof func === 'string') {
                        func = this[func];
                    }
                    func.apply(this, handler.parameters || [event]);
                }
            }
            return this;
        };
        /**
         * Register an event handler to be called each time an event is fired.
         */
        that.on = function (type, method, parameters, bindingContext) {
            var handler = {
                method: method,
                parameters: parameters,
                bindingContext: bindingContext || method
            };
            if (registry.hasOwnProperty(type)) {
                registry[type].push(handler);
            } else {
                registry[type] = [handler];
            }
            return this;
        };
        /**
         * Unbind an event handler for a given binding context
         *
         * @param bindingContext - the binding context or method that was
         *        passed to `on`.
         * @param type - optional event type. If undefined, all handlers
         *        for the given binding context will be unbound.
         */
        that.unbind = function (bindingContext, type) {
            if (_.isUndefined(type)) {
                registry = _.object(_.map(registry, function (handlers, type, reg) {
                    handlers = _.filter(handlers, function (handler) {
                        return handler.bindingContext !== bindingContext;
                    });
                    return [type, handlers];
                }));
            } else if (registry.hasOwnProperty(type)) {
                registry[type] = _.filter(registry[type], function (handler) {
                    return handler.bindingContext !== bindingContext;
                });
            }
            return this;
        };
        return that;
    };

    that.pluralize = function (noun, n) {
        return noun + (n !== 1 ? 's' : '');
    };

    /* jshint bitwise: false */
    that.get_guid = function() {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
    };

    that.generate_xmlns_uuid = function () {
        var CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var uuid = [], r, i;

		// rfc4122 requires these characters
		uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
		uuid[14] = '4';

		// Fill in random data.  At i==19 set the high bits of clock sequence as
		// per rfc4122, sec. 4.1.5
		for (i = 0; i < 36; i++) {
			if (!uuid[i]) {
				r = Math.floor((Math.random()*16));
				uuid[i] = CHARS[(i === 19) ? (r & 0x3) | 0x8 : r & 0xf];
			}
		}
		return uuid.toString().replace(/,/g,'');
    };
    /* jshint bitwise: true */

    that.isValidElementName = function (name) {
        // HT: http://stackoverflow.com/questions/2519845/how-to-check-if-string-is-a-valid-xml-element-name
        var elementNameRegex = /^(?!XML)[a-zA-Z][\w-]*$/;
        return elementNameRegex.test(name);
    };
    

    /**
     * Converts true to 'true()' and false to 'false()'. Returns null for all else.
     * @param req
     */
    that.createXPathBoolFromJS = function(req) {
        if(req === true || req === 'true') {
            return 'true()';
        }else if (req === false || req === 'false') {
            return 'false()';
        } else {
            return null;
        }
    };
    
    that.getOneOrFail = function (list, infoMsg) {
        if (list.length === 0) {
            throw ("No match for " + infoMsg + " found!");
        } else if (list.length > 1) {
            throw ("Multiple matches for " + infoMsg + " found!");
        }
        return list[0];
    };
    
    that.reduceToOne = function (list, func, infoMsg) {
        return that.getOneOrFail(_(list).filter(func), infoMsg);
    };
    
    // a wrapper for object properties that triggers the form change event when
    // sub-properties are changed
    that.BoundPropertyMap = function (form, data) {
        this._form = form;
        this._data = data || {};
    };
    that.BoundPropertyMap.prototype = {
        clone: function () {
            return new that.BoundPropertyMap(this._form, this._data);
        },
        setAttr: function (name, val) {
            this._data[name] = val;
            if (this._form) {
                this._form.fire({
                    type: 'change'
                });
            }
        },
        getAttr: function (name, default_) {
            if (name in this._data) {
                return this._data[name];
            } else {
                return default_;
            }
        }
    };

    that.getCaretPosition = function (ctrl) {
        var pos = 0;
        if (ctrl.createTextRange) {
            ctrl.focus ();
            var sel = document.selection.createRange ();
            sel.moveStart ('character', -ctrl.value.length);
            pos = sel.text.length;
        } else if (typeof ctrl.selectionStart !== 'undefined') {
            pos = ctrl.selectionStart;
        }
        return pos;
    };

    that.setCaretPosition = function (ctrl, start, end){
        if (end === null || end === undefined) {
            end = start;
        }
        if (ctrl.setSelectionRange) {
            ctrl.focus();
            ctrl.setSelectionRange(start, end);
        } else if (ctrl.createTextRange) {
            var range = ctrl.createTextRange();
            range.collapse(true);
            range.moveStart('character', start);
            range.moveEnd('character', end);
            range.select();
        }
    };

    that.insertTextAtCursor = function (jqctrl, text, select) {
        var ctrl = jqctrl[0],
            pos = that.getCaretPosition(ctrl),
            front = ctrl.value.substring(0, pos),
            back = ctrl.value.substring(pos, ctrl.value.length),
            start = select ? pos : pos + text.length;
        jqctrl.val(front + text + back).change();
        pos = pos + text.length;
        that.setCaretPosition(ctrl, start, pos);
    };
        
    return that;
});


