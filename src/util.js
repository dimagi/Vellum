define([
    'json!langCodes',
    'jquery',
    'jquery.bootstrap-popout'
], function (
    langCodes,
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

    that.langCodeToName = {};
    _.each(langCodes, function (lang) {
        that.langCodeToName[lang.code] = lang.name;
    });

    that.XPATH_REFERENCES = [
        "bindElement/relevantAttr",
        "bindElement/calculateAttr",
        "bindElement/constraintAttr"
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


    
    //Simple Event Framework
    //Just run your object through this function to make it event aware
    //Taken from 'JavaScript: The Good Parts'
    that.eventuality = function (that) {
        var registry = {};
        that.fire = function (event) {
            var array,
                func,
                handler,
                i,
                type = typeof event === 'string' ?
                        event : event.type;
            if (registry.hasOwnProperty(type)) {
                array = registry[type];
                for (i = 0; i < array.length; i += 1) {
                    handler = array[i];
                    func = handler.method;
                    if (typeof func === 'string') {
                        func = this[func];
                    }
                    func.apply(this,
                        handler.parameters || [event]);
                }
            }
            return this;
        };
        that.on = function (type, method, parameters) {
            var handler = {
                method: method,
                parameters: parameters
            };
            if (registry.hasOwnProperty(type)) {
                registry[type].push(handler);
            } else {
                registry[type] = [handler];
            }
            return this;
        };
        return that;
    };

    that.pluralize = function (noun, n) {
        return noun + (n !== 1 ? 's' : '');
    };

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

    that.isValidElementName = function (name) {
        // HT: http://stackoverflow.com/questions/2519845/how-to-check-if-string-is-a-valid-xml-element-name
        var elementNameRegex = /^(?!XML)[a-zA-Z][\w0-9-]*$/;
        return elementNameRegex.test(name);
    };

    /**
     * Turns a list of strings into a single tab separated straing.
     * Replaces newlines with ' ' so they don't affect the spacing.
     * @param list
     */
    that.tabSeparate = function (list) {
        var cleanVal = function (val) {
            return val.replace(/\n/g, ' ');
        };
        return list.map(cleanVal).join("\t");
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
    return that;
});


