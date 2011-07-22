$(document).ready(function(){

    var testXformBuffer;
    var make_control_bind_data_mug = function(){
        var myMug;

        //Control Element
        var typeName = "input";
        var myControl = new formdesigner.model.ControlElement(
                {
                    name:"Text",
                    tagName: "input",
                    label:"What is your name?",
                    hintLabel:"Enter the client's name",
                    labelItextID:"Q1EN",
                    hintItextID:"Q1ENH"
                }
        );

        //Data Element
        var name = "question1";
        var initialData = "foo";
        var spec = {
            dataValue: initialData,
            nodeID: "data_for_question1"
        }
        var myData = formdesigner.model.DataElement(spec);

        //Bind Element
        var attributes = {
            dataType: "xsd:text",
            constraintAttr: "length(.) > 5",
            constraintMsgAttr: "Town Name must be longer than 5!",
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

    var getTestXformOutput = function (formName) {
        $.ajax({
            url: 'testing/xforms/' + formName,
            async: false,
            cache: false,
            dataType: 'text',
            success: function(xform){
                testXformBuffer = xform;
                console.log("Successfully got test xform!");
            }
        });
    }

    var giveMugFakeValues = function (mug, mugType) {
        function randomString() {
            var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
            var string_length = 8;
            var randomstring = '';
            for (var i=0; i<string_length; i++) {
                var rnum = Math.floor(Math.random() * chars.length);
                randomstring += chars.substring(rnum,rnum+1);
            }
            return randomstring;
        }
        for (var i in mug.properties) {
            if(mug.properties.hasOwnProperty(i)) {
                for (var j in mug.properties[i].properties) {
                    if(mug.properties[i].properties.hasOwnProperty(j)){
                        if(!mug.properties[i].properties[j]){ //if value is empty/blank
                            if(i === 'dataElement' && j === 'nodeID'){
                                mug.properties[i].properties[j] = formdesigner.util.generate_question_id();
                                if(mug.properties.bindElement){ //set bindElement.nodeID to same as dataElement.nodeID
                                    mug.properties.bindElement.properties.nodeID = mug.properties[i].properties[j];
                                }
                            }else{
                                mug.properties[i].properties[j] = randomString();
                            }
                        }

                    }
                }
            }
        }
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
       expect(8);
       var myBind = new formdesigner.model.BindElement();
       ok(typeof myBind === 'object', "Is it an object?");

       //make the spec object for the bind constructor
        var spec = {
            dataRef: "question1",
            dataType: "text",
            constraint: "length(.) > 5",
            constraintMsg: "Town Name must be longer than 5!",
            id: "someUniqueBindID"
        };


        var myOtherBind = new formdesigner.model.BindElement(spec);

        //check if the bind was created properly
        equal(myOtherBind.properties.dataRef, spec.dataRef, "Shortcut to dataRef correctly set");
        equal(myOtherBind.properties.dataType, spec.dataType, "Shortcut to dataRef correctly set");
        equal(myOtherBind.properties.constraint, spec.constraint, "Shortcut to dataRef correctly set");
        equal(myOtherBind.properties.constraintMsg, spec.constraintMsg, "Shortcut to dataRef correctly set");
        equal(myOtherBind.properties.id, spec.id, "Shortcut to id correctly set");

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
        equal(otherData.properties.name,name,"Was the name attribute set correctly?");
        equal(otherData.properties.defaultData,initialData,"Is initialData correct?");
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

        equal(myControl.properties.typeName,typeName, "Was type name set?");
        equal(typeof myControl.ufid,'string', "Does ufid exist?")
    });

    module("Mug Unit Tests");
    test("Create and Verify Mug with null constructor", function(){
        expect(4);
        var myMug = new formdesigner.model.Mug();
        ok(typeof myMug === 'object',"Test that the object is an object");

        ok(typeof myMug.properties.bindElement === 'undefined', "BindElement should not exist in object constructed with no params");
        ok(typeof myMug.properties.controlElement === 'undefined', "ControlElement should not exist in object constructed with no params");
        ok(typeof myMug.properties.dataElement === 'undefined', "DataElement should not exist in object constructed with no params");

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

        ok(typeof myMug.properties.bindElement === 'object', "BindElement should exist in object constructed with params");
        ok(typeof myMug.properties.controlElement === 'object', "ControlElement should exist in object constructed with params");
        ok(typeof myMug.properties.dataElement === 'object', "DataElement should exist in object constructed with params");
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
        deepEqual(myMug.properties.controlElement,myControl,"Control Element check");
        deepEqual(myMug.properties.bindElement,myBind, "Bind Element check");
        deepEqual(myMug.properties.dataElement,myData, "Data Element check");






    });
    module("MugType tests");
    test("Validate example mug against definition", function(){
        expect(3);
        var testData = make_control_bind_data_mug();
        var myMug;
        var MugType = formdesigner.model.mugTypeMaker.stdTextQuestion(); //simulates a 'standard' text question
        myMug = MugType.mug;
        giveMugFakeValues(myMug,MugType);
        console.log("MUG WITH FAKE VALUES",myMug);  
        var validationObject = MugType.validateMug(myMug);
        equal(MugType.typeName, "Text Question MugType");
        console.log("FAILED VALIDATION HERE",validationObject);
        equal(validationObject.status, "pass", 'Does the mug validate against the MugType?');

        var otherType = formdesigner.model.mugTypeMaker["stdTextQuestion"]();
        otherType.properties.bindElement['someProperty'] = 'foo';
        var vObj = otherType.validateMug(myMug);
        equal(vObj.status,'fail', "This should fail because the mug does not contain the required property");

    });

    test("Test custom validation function in bind block definition", function(){
        expect(2);
        var myMug;
        var MugType = formdesigner.model.mugTypeMaker.stdTextQuestion(); //simulates a 'standard' text question
        myMug = MugType.mug;
        giveMugFakeValues(myMug,MugType);
        myMug.properties.bindElement.properties.constraintAttr = "foo";
        myMug.properties.bindElement.properties.constraintMsgAttr = null;
        var validationObject = MugType.validateMug(myMug);
        equal(validationObject.status,'pass', "Mug has a constraint but no constraint message which is OK");

        //now remove constraint but add a constraint message
        myMug.properties.bindElement.properties.constraintAttr = undefined;
        myMug.properties.bindElement.properties.constraintMsgAttr = "foo";
        validationObject = MugType.validateMug(myMug);
        equal(validationObject.status,'fail', "Special validation function has detected a constraintMsg but no constraint attribute in the bindElement");
    });

    test("MugType creation tools", function(){
        expect(2);
        var testData = make_control_bind_data_mug();
        var myMug = testData.mug;
        myMug.properties.bindElement.constraintAttr = "foo";
        myMug.properties.bindElement.constraintMsgAttr = undefined;
        var MugType = formdesigner.model.RootMugType; //simulates a 'standard' text question

        var OtherMugType = formdesigner.util.getNewMugType(MugType);
        notDeepEqual(MugType,OtherMugType);

        OtherMugType.typeName = "This is a different Mug";
        notEqual(MugType.typeName,OtherMugType.typeName);

    });

    module("Automatic Mug Creation from MugType");
    test("Create mug from MugType", function(){
        expect(2);
        var mugType = formdesigner.model.mugTypeMaker.stdTextQuestion();
        var mug = mugType.mug;
        giveMugFakeValues(mug,mugType);
        ok(typeof mug === 'object', "Mug is an Object");
        equal(mugType.validateMug(mug).status,'pass', "Mug passes validation");
    });
    test("Test sub MugType and Mug creation",function(){
        expect(23);
        //capital A for 'Abstract'
        var AdbType  = formdesigner.model.mugTypes.dataBind,
            AdbcType = formdesigner.model.mugTypes.dataBindControlQuestion,
            AdcType  = formdesigner.model.mugTypes.dataControlQuestion,
            AdType   = formdesigner.model.mugTypes.dataOnly,
        tMug,Mug;

        tMug = formdesigner.util.getNewMugType(AdbType);
        Mug = formdesigner.model.createMugFromMugType(tMug);
        giveMugFakeValues(Mug,tMug);
        ok(typeof tMug === 'object', "MugType creation successful for '"+tMug.typeName+"' MugType");
        ok(tMug.validateMug(Mug).status === 'pass', "Mug created from '"+tMug.typeName+"' MugType passes validation");
        ok(typeof Mug.properties.controlElement === 'undefined', "Mug's ControlElement is undefined");
        ok(typeof Mug.properties.bindElement === 'object', "Mug's bindElement exists");
        ok(typeof Mug.properties.dataElement === 'object', "Mug's dataElement exists");
        equal(Mug.properties.dataElement.properties.nodeID,Mug.properties.bindElement.properties.nodeID);

        tMug = formdesigner.util.getNewMugType(AdbcType);
        Mug = formdesigner.model.createMugFromMugType(tMug);
        giveMugFakeValues(Mug,tMug);
        ok(typeof tMug === 'object', "MugType creation successful for '"+tMug.typeName+"' MugType");
        ok(tMug.validateMug(Mug).status === 'pass', "Mug created from '"+tMug.typeName+"' MugType passes validation");
        ok(typeof Mug.properties.controlElement === 'object', "Mug's ControlElement exists");
        ok(typeof Mug.properties.bindElement === 'object', "Mug's bindElement exists");
        ok(typeof Mug.properties.dataElement === 'object', "Mug's dataElement exists");
        equal(Mug.properties.dataElement.properties.nodeID,Mug.properties.bindElement.properties.nodeID);

        tMug = formdesigner.util.getNewMugType(AdcType);
        Mug = formdesigner.model.createMugFromMugType(tMug);
        giveMugFakeValues(Mug,tMug);
        ok(typeof tMug === 'object', "MugType creation successful for '"+tMug.typeName+"' MugType");
        ok(tMug.validateMug(Mug).status === 'pass', "Mug created from '"+tMug.typeName+"' MugType passes validation");
        ok(typeof Mug.properties.controlElement === 'object', "Mug's ControlElement exists");
        ok(typeof Mug.properties.bindElement === 'undefined', "Mug's bindElement is undefined");
        ok(typeof Mug.properties.dataElement === 'object', "Mug's dataElement exists");

        tMug = formdesigner.util.getNewMugType(AdType);
        Mug = formdesigner.model.createMugFromMugType(tMug);
        giveMugFakeValues(Mug,tMug);
        ok(typeof tMug === 'object', "MugType creation successful for '"+tMug.typeName+"' MugType");
        ok(tMug.validateMug(Mug).status === 'pass', "Mug created from '"+tMug.typeName+"' MugType passes validation");
        ok(typeof Mug.properties.controlElement === 'undefined', "Mug's ControlElement is undefined");
        ok(typeof Mug.properties.bindElement === 'undefined', "Mug's bindElement is undefined");
        ok(typeof Mug.properties.dataElement === 'object', "Mug's dataElement exists");
        ok(Mug.properties.dataElement.properties.nodeID.toLocaleLowerCase().indexOf('question') != -1);
        
    });

    test("More MugType validation testing", function(){
        var AdbType  = formdesigner.model.mugTypes.dataBind,
            AdbcType = formdesigner.model.mugTypes.dataBindControlQuestion,
            AdcType  = formdesigner.model.mugTypes.dataControlQuestion,
            AdType   = formdesigner.model.mugTypes.dataOnly,
        tMug,Mug;

        tMug = formdesigner.util.getNewMugType(AdbType);
        Mug = formdesigner.model.createMugFromMugType(tMug);
        tMug.type="dbc";


        var validationResult = tMug.validateMug(Mug);
        notEqual(validationResult.status,'pass',"MugType is wrong Type ('dbc' instead of 'db')");
        tMug.type = "";
        validationResult = tMug.validateMug(Mug);
        notEqual(validationResult.status,'pass',"MugType is wrong Type ('' instead of 'db')");
    });

    test("Check MugType properties alterations",function(){
        var mugTA = formdesigner.model.mugTypeMaker.stdTextQuestion(),
            mugTB = formdesigner.model.mugTypeMaker.stdTrigger(),
            mugTC = formdesigner.model.mugTypeMaker.stdMSelect(),
            mugA = mugTA.mug,
            mugB = mugTB.mug,
            mugC = mugTC.mug;

        notEqual(mugTB.ufid,mugTC.ufid);
        notEqual(mugTB.properties, mugTC.properties);
        ok(mugTC.properties.bindElement.nodeID.visibility === 'hidden');

    })

    module("Tree Data Structure Tests");
    test("Trees", function(){
//        expect(16);

        ///////////BEGIN SETUP///////
        var mugTA = formdesigner.model.mugTypeMaker.stdGroup(),
            mugTB = formdesigner.model.mugTypeMaker.stdGroup(),
            mugTC = formdesigner.model.mugTypeMaker.stdGroup(),
            mugA = mugTA.mug,
            mugB = mugTB.mug,
            mugC = mugTC.mug,
            tree = new formdesigner.model.Tree('data');
        var GNMT = formdesigner.util.getNewMugType;
        var createMugFromMugType = formdesigner.model.createMugFromMugType;
        var DBCQuestion = formdesigner.model.mugTypeMaker.stdTextQuestion();

        giveMugFakeValues(mugA,mugTA);
        giveMugFakeValues(mugB,mugTB);
        giveMugFakeValues(mugC,mugTC);

        var vTA = mugTA.validateMug(),
                vTB = mugTB.validateMug(),
                vTC = mugTC.validateMug();
        if(!((vTA.status === 'pass') && (vTB.status === 'pass') && (vTC.status === 'pass'))){
            console.group("VALIDATION FAILURE BLOCK");
            console.log("validation obj A",vTA);
            console.log("validation obj B",vTB);
            console.log("validation obj C",vTC);
            console.groupEnd()
            throw 'AUTO MUG CREATION FROM MUG DID NOT PASS VALIDATION SEE CONSOLE'
        }

        tree.insertMugType(mugTA, 'into', null); //add mugA as a child of the rootNode
        tree.insertMugType(mugTB, 'into',mugTA ); //add mugB as a child of mugA...
        tree.insertMugType(mugTC, 'into', mugTB); //...
        //////////END SETUP//////////

        var actualPath = tree.getAbsolutePath(mugTC);
        var expectedPath =  '/'+mugTA.mug.properties.dataElement.properties.nodeID+
                            '/'+mugTB.mug.properties.dataElement.properties.nodeID+
                            '/'+mugTC.mug.properties.dataElement.properties.nodeID;
        equal(actualPath, expectedPath, 'Is the generated DataElement path for the mug correct?');

        var treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                tree._getMugTypeNodeID(mugTA)+'['+
                tree._getMugTypeNodeID(mugTB)+'['+
                tree._getMugTypeNodeID(mugTC)+']]]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct1');

        actualPath = tree.getAbsolutePath(mugTC);
        tree.removeMugType(mugTC);
        tree.insertMugType(mugTC,'into',mugTB);
        equal(actualPath,expectedPath, 'Is the path still correct after removal and insertion (into the same place');

        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                tree._getMugTypeNodeID(mugTA)+'['+
                tree._getMugTypeNodeID(mugTB)+'['+
                tree._getMugTypeNodeID(mugTC)+']]]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct2');
        
        tree.insertMugType(mugTC, 'into', mugTA);
        actualPath = tree.getAbsolutePath(mugTC);
        expectedPath =  '/'+mugTA.mug.properties.dataElement.properties.nodeID+
                        '/'+mugTC.mug.properties.dataElement.properties.nodeID;
        equal(actualPath, expectedPath, 'After move is the calculated path still correct?');

        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                tree._getMugTypeNodeID(mugTA)+'['+
                tree._getMugTypeNodeID(mugTB)+','+
                tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct3');

        tree.removeMugType(mugTB);
        raises(function(){tree.getAbsolutePath(mugTB)}, "Cant find path of MugType that is not present in the Tree!");

        tree.insertMugType(mugTB,'before',mugTC);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct4');

        tree.removeMugType(mugTB);
        raises(function(){tree.getAbsolutePath(mugTB)}, "Cant find path of MugType that is not present in the Tree!");

        tree.insertMugType(mugTB,'before',mugTC);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct5');

        var mugTD = GNMT(DBCQuestion);
        var mugD = createMugFromMugType(mugTD);
        tree.insertMugType(mugTD, 'before', mugTA);
        equal('/'+mugTD.mug.properties.dataElement.properties.nodeID, tree.getAbsolutePath(mugTD),
             "Check that the newly inserted Mug's generated path is correct");
        console.log("MUGTD",mugTD);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTD)+','+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTC)+']]';
        equal(tree.printTree(),treePrettyPrintExpected, 'Check the tree structure is correct6');

        tree.insertMugType(mugTD,'after',mugTB);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTD)+','+
            tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct7');

        tree.insertMugType(mugTD,'after',mugTC);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTC)+','+
            tree._getMugTypeNodeID(mugTD)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct8');

        var tempMT = tree.getMugTypeFromUFID(mugTA.ufid);
        deepEqual(mugTA, tempMT, "Check getMugTypeFromUFID() method works correctly");

        tempMT = tree.getMugTypeFromUFID("foobar");
        equal(tempMT, null, "Check getMugTypeFromUFID('notAUFID') returns null");

        tempMT = tree.getMugTypeFromUFID(mugTD.ufid);
        deepEqual(mugTD,tempMT);


    });
    module("UITree");
    test("Children moving/relative location tests", function(){
            var mugTA = formdesigner.model.mugTypeMaker.stdGroup(),
            mugTB = formdesigner.model.mugTypeMaker.stdTextQuestion(),
            mugTC = formdesigner.model.mugTypeMaker.stdTextQuestion(),
            mugA = mugTA.mug,
            mugB = mugTB.mug,
            mugC = mugTC.mug;
        ok(formdesigner.util.canMugTypeHaveChildren(mugTA,mugTB), "Can a 'Group' MugType have children of type 'Text'?");
        ok(!formdesigner.util.canMugTypeHaveChildren(mugTB,mugTA), "'Text' mugType can NOT have children (of type 'group')");
        ok(!formdesigner.util.canMugTypeHaveChildren(mugTB,mugTC), "'Text' can't have children of /any/ type");

        var relPos = formdesigner.util.getRelativeInsertPosition,
        pos = relPos(mugTA,mugTB);
        equal(pos,'into', "Insert a 'Text' MT into a 'Group' MT");
        pos = relPos(mugTB,mugTC);
        equal(pos,'after', "Insert 'Text' after other 'Text'");


    });

    test("Tree insertion tests", function(){
        expect(4);
        var mugTA = formdesigner.model.mugTypeMaker.stdGroup(),
            mugTB = formdesigner.model.mugTypeMaker.stdTextQuestion(),
            mugTC = formdesigner.model.mugTypeMaker.stdTextQuestion(),
            mugA = mugTA.mug,
            mugB = mugTB.mug,
            mugC = mugTC.mug;

        formdesigner.controller.resetFormDesigner();
        var c = formdesigner.controller;
        c.insertMugTypeIntoForm(null,mugTA);
        var tree = c.form.dataTree;
        var treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                                        tree._getMugTypeNodeID(mugTA)+']';

        equal(c.form.dataTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Group' MT under root");
        equal(c.form.controlTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Group' MT under root");
        c.insertMugTypeIntoForm(mugTA,mugTB);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                                        tree._getMugTypeNodeID(mugTA)+'['+
                                        tree._getMugTypeNodeID(mugTB)+']]';
        equal(c.form.dataTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Text' MT under 'Group'");
        equal(c.form.controlTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Text' MT under 'Group'");
    });

    test("Does check_move() work correctly?", function(){
        var mugTA = formdesigner.model.mugTypeMaker.stdTextQuestion(),
            mugTB = formdesigner.model.mugTypeMaker.stdTrigger(),
            mugTC = formdesigner.model.mugTypeMaker.stdItem(),
            mugA = mugTA.mug,
            mugB = mugTB.mug,
            mugC = mugTC.mug;
            formdesigner.controller.resetFormDesigner();
        var c = formdesigner.controller,
        m = formdesigner.model;

        var tree = c.form.controlTree;
        ok(c.checkMoveOp(mugTA,'before',mugTB));
        ok(!c.checkMoveOp(mugTA,'into',mugTB));

        var mugTGroupA = formdesigner.model.mugTypeMaker.stdGroup(),
            mugTGroupB = formdesigner.model.mugTypeMaker.stdGroup(),
            mugTGroupC = formdesigner.model.mugTypeMaker.stdGroup(),
            mugGA = mugTGroupA.mug,
            mugGB = mugTGroupB.mug,
            mugGC = mugTGroupC.mug;
        ok(c.checkMoveOp(mugTA,'into',mugTGroupA));
        ok(c.checkMoveOp(mugTB,'into',mugTGroupA));
        ok(!c.checkMoveOp(mugTC,'into',mugTGroupA));

        var mugTD = formdesigner.model.mugTypeMaker.stdMSelect(),
            mugD = mugTD.mug;

        ok(c.checkMoveOp(mugTD,'into',mugTGroupA));
        ok(c.checkMoveOp(mugTC,'into',mugTD));
        ok(!c.checkMoveOp(mugTA,'into',mugTD));
        ok(!c.checkMoveOp(mugTGroupA,'into',mugTD));



    });

    module("UI Create Questions Tests");
    test("Add A text question", function(){

        formdesigner.controller.resetFormDesigner();

        var c,ui, jstree, curMugType;


        c = formdesigner.controller
        ui = formdesigner.ui;
        jstree = $("#fd-question-tree");

        equal(c.form.controlTree.printTree(false), "RootNode", "Ensure the controlTree is empty after a call to resetFormDesigner");
        equal(c.form.dataTree.printTree(false), "RootNode", "Ensure the dataTree is empty after a call to resetFormDesigner");

        //add a listener for question creation events
        c.on("question-creation", function(e){
            console.log("QUESTION CREATION EVENT FIRED:",e);
            curMugType = e.mugType;
        });
        console.log(ui.buttons);

        ui.buttons.addquestionbutton.click();
        ui.buttons.addquestionbutton.click();
        ui.buttons.addquestionbutton.click();
        jstree.jstree("select_node",$('#'+curMugType.ufid));
        console.log("curMugType.ufid=",curMugType.ufid);
        console.log('Selected Node', jstree.jstree("get_selected"));
        var curSelNode = jstree.jstree("get_selected");
        var curSelMT = c.getMTFromFormByUFID(curSelNode.attr('id'));
        ok(typeof jstree.jstree("get_selected") !== 'undefined');
        console.log(c.form.controlTree.printTree(false));

        equal(jstree.jstree("get_selected").attr('id'), curMugType.ufid, "Mug that was just created is the same as the one that is currently selected");

    });

    module("Itext functionality testing");
    test("Itext ops", function(){
        formdesigner.controller.resetFormDesigner();
        var IT = formdesigner.model.Itext;
        var otherLanguageName = "sw";
        ok(IT.getLanguages().length === 1, "Test that there is only one language at start");

        IT.addLanguage(otherLanguageName);
        ok(IT.getLanguages().length === 2);

        equal(IT.getDefaultLanguage(), IT.getLanguages()[0], "Is default language set correctly");

        IT.setDefaultLanguage(otherLanguageName);
        equal(IT.getDefaultLanguage(), otherLanguageName, "Is default language set to "+otherLanguageName);

        var iID = 'itextID1', form = 'long', val = "The Foo went to the BAR";

        IT.setValue(iID,otherLanguageName,form,val);
        equal(IT.getValue(iID,otherLanguageName,form),val, "Itext item storage and retrieval");

        ok(IT.validateItext(),"Itext data should be valid at this point");

        var iID2 = 'itextID2',
        valObject = {
            en: {
                short : "Some short text for itextID2",
                image : "jr://some/image/uri.png"
            }

        }
        IT.addItem(iID2,valObject);
        ok(Object.keys(IT.validateItext()).length > 0, "Errors in Itext validation after adding new Itext to non-default language");
        
        var otherValObject = {}
        otherValObject.sw = valObject.en;
        IT.addItem(iID2,otherValObject);
        equal(IT.validateItext(), true, "Itext should now validate, after adding Itext to def language");

        IT.removeLanguage("sw");
        equal(IT.getDefaultLanguage(), 'en', "Default language should be 'en' after removal of 'sw' language");

        equal(IT.validateItext(), true, 'Itext should still validate after language removal');

        IT.setValue(iID,otherLanguageName,form,val);
        equal(IT.getItextVals(iID,otherLanguageName)[form], val, "Itext set and retrieval work");
        
    });

    module("Create XForm XML");
    test("Create simple flat Xform", function () {
        var c = formdesigner.controller,
                ui = formdesigner.ui,
                jstree = $("#fd-question-tree"),
                curMugType,
                addQbut;
        c.resetFormDesigner();
        addQbut = ui.buttons.addquestionbutton;
        addQbut.click();
        addQbut.click();
        addQbut.click();
        addQbut.click();
        addQbut.click();
        var actual = beautifyXml(c.createXForm());
        getTestXformOutput('form0.xml');
        var expected = beautifyXml(testXformBuffer);
        console.log(actual == expected);
        equal(expected,actual);

    });

    test("Create simple nested Xform", function () {
        var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            curMugType,
            addQbut, lastCreatedNode;
        c.resetFormDesigner();
        addQbut = ui.buttons.addquestionbutton;

        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
            console.log("Created Object is:",lastCreatedNode);
        })
        addQbut.click();
        jstree.jstree('select_node',lastCreatedNode);

    });


});



function divide(a,b){
    return a/b;
}