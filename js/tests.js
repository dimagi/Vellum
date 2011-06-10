$(document).ready(function(){

    var make_control_bind_data_mug = function(){
        var myMug = new formdesigner.model.Mug();

        //Control Element
        var typeName = "input";
        var myControl = new formdesigner.model.ControlElement(
                {
                    typeName:typeName,
                    label:"What is your name?",
                    hintLabel:"Enter the client's name",
                    labelItext:"Q1EN",
                    hintItext:"Q1ENH"
                }
        );

        //Data Element
        var name = "question1";
        var initialData = "foo";
        var spec = {
            name: name,
            defaultData: initialData
        }
        var myData = formdesigner.model.DataElement(spec);

        //Bind Element
        var attributes = {
            dataRef: "question1",
            dataType: "text",
            constraint: "length(.) > 5",
            constraintMsg: "Town Name must be longer than 5!"
        };
        spec = {
            attributes : attributes
        };
        var myBind = new formdesigner.model.BindElement(spec);

        var mugSpec = {
            dataElement: myData,
            bindElement: myBind,
            controlElement: myControl
        }
        myMug.initWithSpec(mugSpec);

        return {
            control: myControl,
            data: myData,
            bind: myBind,
            mug: myMug
        };
    }

    module("LiveText Unit Tests");
    test("Create and Verify LiveText", function(){
        expect(4);

        ////////
        var liveText = new formdesigner.model.LiveText();
        ok(typeof liveText === 'object',"LiveText object should be an Object");

        ////////
        liveText.addToken("Test String");
        equal(liveText.renderString(),"Test String", "Check for correct rendering of added string 'Test String'")

        ////////
        var testObj = (function (){
            var that = {};
            var text = "Some Text";
            var cbFunc = function(){
                return this.text;
            };
            that.text = text;
            that.cbFunc = cbFunc;
            return that;
        })();
        liveText.addToken(testObj,testObj.cbFunc);
        equal(liveText.renderString(),"Test StringSome Text","correct rendering of obj token with callback");

        ////////
        var otherObj = {text: " Meow Mix times: "};
        otherObj.cbFunc = function(n){
            return this.text + n;
        };
        liveText.addToken(otherObj,otherObj.cbFunc,[5]);
        equal(liveText.renderString(),"Test StringSome Text Meow Mix times: 5", "rendering with callback + params");
    });
    test("Test additional LiveText object", function(){
        expect(2);

        ///////
        var otherLiveText = new formdesigner.model.LiveText;
        equal(otherLiveText.renderString(),"", 'test render empty liveText');

        ///////
        otherLiveText.addToken("foo ");
        otherLiveText.addToken("bar");
        equal(otherLiveText.renderString(),"foo bar", "check creation of additional LiveText and that it produces correct results");

    });

    module("Bind Element");
    test("Create a bind with and without arguments", function(){
       expect(9);
       var myBind = new formdesigner.model.BindElement();
       ok(typeof myBind === 'object', "Is it an object?");

       //make the spec object for the bind constructor
        var attributes = {
            dataRef: "question1",
            dataType: "text",
            constraint: "length(.) > 5",
            constraintMsg: "Town Name must be longer than 5!",
            id: "someUniqueBindID"
        };
        var spec = {
            attributes : attributes
        };

        var myOtherBind = new formdesigner.model.BindElement(spec);

        //check if the bind was created properly
        equal(myOtherBind.attributes, attributes, "Attributes correctly set");
        equal(myOtherBind.dataRef, attributes.dataRef, "Shortcut to dataRef correctly set");
        equal(myOtherBind.dataType, attributes.dataType, "Shortcut to dataRef correctly set");
        equal(myOtherBind.constraint, attributes.constraint, "Shortcut to dataRef correctly set");
        equal(myOtherBind.constraintMsg, attributes.constraintMsg, "Shortcut to dataRef correctly set");
        equal(myOtherBind.id, attributes.id, "Shortcut to id correctly set");

        //test that a unique formdesigner id was generated for this object (well, kind of)
        equal(typeof myOtherBind.ufid, 'string', "Is the ufid a string?");
        console.log("myOtherBind.ufid is:"+myOtherBind.ufid);

        notEqual(myBind.ufid,myOtherBind.ufid, "Make sure that the ufids are unique");
//        ok(typeof myOtherBind.ufid === 'string', "Is the ufid a string?");
    });

    module("Data Element");
    test("Create a data Element with and without", function(){
        expect(6);
        var myData = new formdesigner.model.DataElement();
        ok(typeof myData === 'object', "Is it an object?");

        var name = "question1";
        var initialData = "foo";
        var spec = {
            name: name,
            defaultData: initialData
        }

        var otherData = formdesigner.model.DataElement(spec);
        ok(typeof otherData === 'object', "Is it an object? (with args)");
        equal(otherData.name,name,"Was the name attribute set correctly?");
        equal(otherData.defaultData,initialData,"Is initialData correct?");
        console.log("DataElement.ufid:"+otherData.ufid);
        equal(typeof otherData.ufid, 'string', "Is ufid a string and exists?");
        notEqual(otherData,myData,"Test that data elements are unique");
    });

    module("Control Element");
    test("Control Element Default", function(){
        expect(2);
        var emptyControl = new formdesigner.model.ControlElement();
        ok(typeof emptyControl === 'object', "Is emptyControl an object?");

        var typeName = "input";
        var fullControl = new formdesigner.model.ControlElement(
                {
                    typeName:typeName
                }
        );

        console.log("Control node ufid:"+fullControl.ufid);
        notEqual(emptyControl.ufid,fullControl.ufid,"Check that ufids are not equal for ControlElements");

    });
    test("Control Element with additional init value", function(){
        expect(2);
               //Control Element
        var typeName = "input";
        var myControl = new formdesigner.model.ControlElement(
                {
                    typeName:typeName,
                    label:"What is your name?",
                    hintLabel:"Enter the client's name",
                    labelItext:"Q1EN",
                    hintItext:"Q1ENH"
                }
        );

        equal(myControl.typeName,typeName, "Was type name set?");
        equal(typeof myControl.ufid,'string', "Does ufid exist?")
        console.log("Control node ufid:"+myControl.ufid);
    });

    module("Mug Unit Tests");
    test("Create and Verify Mug with null constructor", function(){
        expect(4);
        var myMug = new formdesigner.model.Mug();
        ok(typeof myMug === 'object',"Test that the object is an object");

        ok(typeof myMug.bindElement === 'undefined', "BindElement should not exist in object constructed with no params");
        ok(typeof myMug.controlElement === 'undefined', "ControlElement should not exist in object constructed with no params");
        ok(typeof myMug.dataElement === 'undefined', "DataElement should not exist in object constructed with no params");

    });
    test("Create and Verify Mug with fake Bind,Control and Data element specified in Constructor", function(){
        expect(4);
        var specObj = {
           bindElement: {},
           controlElement: {},
           dataElement: {}
        }
        var myMug = new formdesigner.model.Mug(specObj);
        ok(typeof myMug === 'object',"Test that the object is an object");

        ok(typeof myMug.bindElement === 'object', "BindElement should exist in object constructed with params");
        ok(typeof myMug.controlElement === 'object', "ControlElement should exist in object constructed with params");
        ok(typeof myMug.dataElement === 'object', "DataElement should exist in object constructed with params");
    });
    test("Create populated Mug", function(){
       expect(5);
        var testData = make_control_bind_data_mug();
        var myMug = testData.mug;
        var myControl = testData.control;
        var myBind = testData.bind;
        var myData = testData.data;
        ok(typeof myMug === 'object',"Is this populated mug an object?");
        equal(typeof myMug.definition,'undefined', "Is the definition undefined?");
        deepEqual(myMug.controlElement,myControl,"Control Element check");
        deepEqual(myMug.bindElement,myBind, "Bind Element check");
        deepEqual(myMug.dataElement,myData, "Data Element check");






    });

    module("Definition Object Tests");
    test("Definition Object Creation and addition to tree", function(){
        expect(4);
        var testData = make_control_bind_data_mug();
        var example_template = formdesigner.model.definition_example;

        //first we create a definition using the example template
        var textQDefinition = new formdesigner.model.Definition(example_template);

        //then modify the definition fields such that it's a correct definition
        textQDefinition.mug = testData.mug;
        textQDefinition.dataNode.dataElement = testData.data;
        textQDefinition.bindNode.bindElement = testData.bind;
        textQDefinition.controlNode.controlElement = testData.control;
        var tqd = textQDefinition;

        equal(tqd.defName,"A Standard Text Question Definition", "Name set correctly");
        deepEqual(tqd.bindNode.bindElement,testData.bind,"Bind element stored correctly");
        deepEqual(tqd.dataNode.dataElement,testData.data,"Bind element stored correctly");
        deepEqual(tqd.controlNode.controlElement,testData.control,"Bind element stored correctly");


    });
    test("Validate Definition Object against schema", function(){
        expect(1);
        var testData = make_control_bind_data_mug();
        var example_template = formdesigner.model.definition_example;

        //first we create a definition using the example template
        var textQDefinition = new formdesigner.model.Definition(example_template);

        //then modify the definition fields such that it's a correct definition
        textQDefinition.mug = testData.mug;
        textQDefinition.dataNode.dataElement = testData.data;
        textQDefinition.bindNode.bindElement = testData.bind;
        textQDefinition.controlNode.controlElement = testData.control;
        var tqd = textQDefinition;
        ok(formdesigner.model.validateDefinition(tqd), "Definition Object passes schema validation");

        raises(formdesigner.model.validateDefinition({}), formdesigner.util.DefinitionValidationException, "Empty Definition causes an error");
    });
    /**
     * Remember to set the values that aren't 'real'
     * in the example template!
     */
    var creat_text_question_definition = function(){
        var example_template = formdesigner.model.definition_example;
        //first we create a definition using the example template
        var textQDefinition = new formdesigner.model.Definition(example_template);
        return textQDefinition;
    };

    var attach_elements_to_def = function(definition,bind,control,data,mug){
        definition.dataNode.dataElement = data;
        definition.bindNode.bindElement = bind;
        definition.controlNode.controlElement = control;
        definition.mug = mug;
    }




});



function divide(a,b){
    return a/b;
}