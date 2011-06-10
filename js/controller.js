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
        var ret = 'question'+(Math.ceil(Math.random()*question_counter));
        question_counter += 1;
        return ret;
    };
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


    };
    that.create_question_from_template = create_question_from_template;


    var create_question = function (qtype){
        if(qtype === "string"){
            var mug_type = get_text_mug_type();
            var questionID = generate_question_id();
            return create_question_from_template(mug_type,questionID);
        }
    }

    return that;
})();