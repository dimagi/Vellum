/**
 * Notes: we assume that the controller will be handed an XFORM in JSON format
 * (converted by the CouchForms code, so that's pretty sweet).  Injecting the JSON
 * data into the correct places in the model will be up to the controller code.
 */
formdesigner.controller = (function(){
    var that = {};
    var question_counter = 0; //used in generate_question_id();

    /**
     * Generates a unique question ID (unique in this form) and
     * returns it as a string.
     */
    var generate_question_id = function(){
        var ret = 'question'+(Math.ceil(Math.random()*question_counter))
        question_counter += 1;
        return ret;
    }
    that.generate_question_id = generate_question_id;

    /**
     * Generates a standard XForm question based on the given template.
     * @param template
     * @param questionID
     */
    var create_question_from_template = function(template, questionID){
        if(typeof questionID === 'undefined'){
            questionID = generate_question_id();
        }


    }







    var rootDataDef = {
        defName: "Root Data Node Definition",
        isRoot: true,
        parentDef: null,
        childrenDef: null,
        formObject: null
    }

    var rootControlDef = {
        defName: "Root Control Node Defintion",
        isRoot: true,
        parentDef: null,
        childrenDef: null,
        formObject: null

    }



    /**
     * Adds a child Definition object to the reference Definition
     * object (and performs the required linking.
     * @param childDef
     * @param refDef
     * @param typeOfParent - can be one of "dataNode","bindNode","controlNode"
     */
    var addDefinitionAsChild = function(childDef, refDef, typeOfParent){
        if(typeof refDef === 'undefined' || typeof childDef === 'undefined'){
            console.log("Attempted to add Child Definition, but reference or child def was null. Child:"+childDef+", Reference:"+refDef);
            return;
        }
        if(!refDef.children){
            refDef.children = [];
        }

        refDef.children.push(childDef);
        childDef[typeOfParent].parentDef = refDef;
    }

    var definition = {
        defName: "Question Definition",
        dataNode: {
            parentDef:null
        }

    }

    addDefinitionAsChild(definition,rootDataDef,"dataNode");
        return that;
})();