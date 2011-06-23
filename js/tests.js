$(document).ready(function(){

    var make_control_bind_data_mug = function(){
        var myMug;

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
            defaultData: initialData,
            nodeID: "data_for_question1"
        }
        var myData = formdesigner.model.DataElement(spec);

        //Bind Element
        var attributes = {
            dataRef: "question1",
            dataType: "text",
            constraint: "length(.) > 5",
            constraintMsg: "Town Name must be longer than 5!",
            nodeID: "question1"
        };
        spec =  attributes;
        var myBind = new formdesigner.model.BindElement(spec);

        var mugSpec = {
            dataElement: myData,
            bindElement: myBind,
            controlElement: myControl
        }
        myMug = new formdesigner.model.Mug(mugSpec);

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
    module("MugType tests");
    test("Validate example mug against definition", function(){
        expect(3);
        var testData = make_control_bind_data_mug();
        var myMug = testData.mug;

        var MugType = formdesigner.model.RootMugType; //simulates a 'standard' text question

        var validationObject = MugType.validateMug(myMug);
//        console.log(myMug);
        equal(MugType.typeName, "The Abstract Mug Type Definition");
        equal(validationObject.status, "pass");

        var otherType = formdesigner.model.otherMugType;
        var vObj = otherType.validateMug(myMug);
        equal(vObj.status,'fail', "This should fail because the mug does not contain the required property");

    });

    test("Test custom validation function in bind block definition", function(){
        expect(2);
        var testData = make_control_bind_data_mug();
        var myMug = testData.mug;
        myMug.bindElement.constraintAttr = "foo";
        myMug.bindElement.constraintMsgAttr = undefined;
        var MugType = formdesigner.model.RootMugType; //simulates a 'standard' text question

        var validationObject = MugType.validateMug(myMug);
        equal(validationObject.status,'pass', "Mug has a constraint but no constraint message which is OK");

        //now remove constraint but add a constraint message
        myMug.bindElement.constraintAttr = undefined;
        myMug.bindElement.constraintMsgAttr = "foo";
        validationObject = MugType.validateMug(myMug);
        equal(validationObject.status,'fail', "Special validation function has detected a constraintMsg but no constraint attribute in the bindElement");
    });

    test("MugType creation tools", function(){
        expect(2);
        var testData = make_control_bind_data_mug();
        var myMug = testData.mug;
        myMug.bindElement.constraintAttr = "foo";
        myMug.bindElement.constraintMsgAttr = undefined;
        var MugType = formdesigner.model.RootMugType; //simulates a 'standard' text question

        var OtherMugType = formdesigner.util.getNewMugType(MugType);
        notDeepEqual(MugType,OtherMugType);

        OtherMugType.typeName = "This is a different Mug";
        notEqual(MugType.typeName,OtherMugType.typeName);

    });

    module("Automatic Mug Creation from MugType");
    test("Create mug from root MugType", function(){
        expect(2);
        var mugType = formdesigner.util.getNewMugType(formdesigner.model.RootMugType);
        var mug = formdesigner.controller.createMugFromMugType(mugType);
        ok(typeof mug === 'object', "Mug is an Object");
        equal(mugType.validateMug(mug).status,'pass', "Mug passes validation");
    });
    test("Test sub MugType creation",function(){
        expect(1);
        //capital A for 'Abstract'
        var AdbType = formdesigner.model.mugTypes.dataBind,
        AdbcType = formdesigner.model.mugTypes.dataBindControlQuestion,
        AdcType = formdesigner.model.mugTypes.dataControlQuestion,
        AdType = formdesigner.model.mugTypes.dataOnly,
        dbType,dbcType,dcType,dType;

        dbType = formdesigner.util.getNewMugType(AdbType);
        console.log(dbType);
        ok(dbType === 'object', "MugType creation succesful for 'Data+Bind' Mug");
    });


});



function divide(a,b){
    return a/b;
}