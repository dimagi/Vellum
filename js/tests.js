
var JRVALIDATE_MODE = true;


$(document).ready(function(){

    formdesigner.launch();
    var testXformBuffer;
    var testFormNames = [
        "Follow-up a Household Referral.xml",
        "Follow-up at household.xml",
        "Pos Parto.xml",
        "Registo.xml",
        "Follow-up a pregnancy referral.xml",
        "Gravidez.xml",
        "Register a household.xml",
        "Close a pregnancy.xml",
        "Follow-up a pregnancy.xml",
        "NutritionAndHealth.xml",
        "Register a pregnancy.xml",
    ];

    var get_cchq_forms = function (name) {
        getTestXformOutput('fromcchq/' + name);
    }

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
        if(mugType.properties.controlElement){
            if(mug.properties.controlElement.properties.hintItextID) {
                formdesigner.model.Itext.setValue(mug.properties.controlElement.properties.hintItextID,'en','default','foo hint');
            }
            if (mug.properties.controlElement.properties.labelItextID) {
                formdesigner.model.Itext.setValue(mug.properties.controlElement.properties.labelItextID,'en','default','foo default');
            }
        }
    }

    var addQuestionThroughUI = function (type) {
        var addbut, sel;
        addbut = $('#fd-add-but');
        sel = $('#fd-question-select');

        sel.val(type); //set the dropdown to the correct val
        addbut.click(); //click the add question button.

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
        formdesigner.model.Itext.setValue(myMug.properties.controlElement.properties.hintItextID,'en','default','foo hint');
        formdesigner.model.Itext.setValue(myMug.properties.controlElement.properties.labelItextID,'en','default','foo default');
        var validationObject = MugType.validateMug(myMug);
        equal(MugType.typeName, "Text Question MugType");
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
        equal(mugTC.properties.bindElement.nodeID.visibility,'advanced');

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
            ok(false);
            throw 'AUTO MUG CREATION FROM MUG DID NOT PASS VALIDATION SEE CONSOLE'
        }

        tree.insertMugType(mugTA, 'into', null); //add mugA as a child of the rootNode
        tree.insertMugType(mugTB, 'into',mugTA ); //add mugB as a child of mugA...
        tree.insertMugType(mugTC, 'into', mugTB); //...
        //////////END SETUP//////////

        var actualPath = tree.getAbsolutePath(mugTC);
        var expectedPath =  '/'+formdesigner.controller.form.formID+
                            '/'+mugTA.mug.properties.dataElement.properties.nodeID+
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
        expectedPath =  '/'+formdesigner.controller.form.formID+
                        '/'+mugTA.mug.properties.dataElement.properties.nodeID+
                        '/'+mugTC.mug.properties.dataElement.properties.nodeID;
        equal(actualPath, expectedPath, 'After move is the calculated path still correct?');

        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                tree._getMugTypeNodeID(mugTA)+'['+
                tree._getMugTypeNodeID(mugTB)+','+
                tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct3');

        tree.removeMugType(mugTB);
        ok(tree.getAbsolutePath(mugTB) === null, "Cant find path of MugType that is not present in the Tree!");

        tree.insertMugType(mugTB,'before',mugTC);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct4');

        tree.removeMugType(mugTB);
        ok(tree.getAbsolutePath(mugTB) === null, "Cant find path of MugType that is not present in the Tree!");

        tree.insertMugType(mugTB,'before',mugTC);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
            tree._getMugTypeNodeID(mugTA)+'['+
            tree._getMugTypeNodeID(mugTB)+','+
            tree._getMugTypeNodeID(mugTC)+']]';
        equal(treePrettyPrintExpected,tree.printTree(), 'Check the tree structure is correct5');

        var mugTD = GNMT(DBCQuestion);
        var mugD = createMugFromMugType(mugTD);
        tree.insertMugType(mugTD, 'before', mugTA);
        equal('/' + formdesigner.controller.form.formID + '/' + mugTD.mug.properties.dataElement.properties.nodeID, tree.getAbsolutePath(mugTD),
             "Check that the newly inserted Mug's generated path is correct");
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
            mugC = mugTC.mug,
                Itext;
        formdesigner.controller.resetFormDesigner();

        Itext = formdesigner.model.Itext;
        Itext.setValue(mugA.properties.controlElement.properties.labelItextID,Itext.getDefaultLanguage(),'default','group1 itext');
        Itext.setValue(mugB.properties.controlElement.properties.labelItextID,Itext.getDefaultLanguage(),'default','question1 itext');
        Itext.setValue(mugC.properties.controlElement.properties.labelItextID,Itext.getDefaultLanguage(),'default','question2 itext');

        var c = formdesigner.controller, disp = formdesigner.util.getMugDisplayName;
        c.insertMugTypeIntoForm(null,mugTA);
        var tree = c.form.dataTree;
        var treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                                        tree._getMugTypeNodeID(mugTA)+']';

        equal(c.form.dataTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Group' MT under root DATA TREE");

        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                                        disp(mugTA)+']';
        equal(c.form.controlTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Group' MT under root CONTROL TREE");

        c.insertMugTypeIntoForm(mugTA,mugTB);
        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                                        tree._getMugTypeNodeID(mugTA)+'['+
                                        tree._getMugTypeNodeID(mugTB)+']]';
        equal(c.form.dataTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Text' MT under 'Group' DATA TREE");

        treePrettyPrintExpected = ''+tree._getRootNodeID()+'['+
                                        disp(mugTA)+'['+
                                        disp(mugTB)+']]';
        equal(c.form.controlTree.printTree(),treePrettyPrintExpected, "Tree structure is correct after inserting a 'Text' MT under 'Group' CONTROL TREE");
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

        var c,ui, jstree, curMugType, addqbut;


        c = formdesigner.controller
        ui = formdesigner.ui;
        jstree = $("#fd-question-tree");

        equal(c.form.controlTree.printTree(false), formdesigner.controller.form.formID, "Ensure the controlTree is empty after a call to resetFormDesigner");
        equal(c.form.dataTree.printTree(false), formdesigner.controller.form.formID, "Ensure the dataTree is empty after a call to resetFormDesigner");

        //add a listener for question creation events
        c.on("question-creation", function(e){
            curMugType = e.mugType;
        });

        addqbut = $('#fd-add-but');
        addqbut.click();
        addqbut.click();
        addqbut.click();
        jstree.jstree("select_node",$('#'+curMugType.ufid));

        var curSelNode = jstree.jstree("get_selected");
        var curSelMT = c.getMTFromFormByUFID(curSelNode.attr('id'));
        ok(typeof jstree.jstree("get_selected") !== 'undefined');


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

        equal(IT.getValue(iID2,'en','short'), valObject.en.short, "Other Itext retreival method test");

        //rename an ID
        IT.setValue(iID,'en',form,val);
        var newID = iID + 'foo';
        IT.renameItextID(iID,newID);
        ok(!IT.getAllData().en[iID], 'old ID does not exist anymore in EN');
        ok(!IT.getAllData().sw[iID], 'old ID does not exist anymore in SW');
        ok(IT.getAllData().en[newID], 'new ID exists in EN');
        ok(IT.getAllData().sw[newID], 'new ID exists in SW');


    });

    module("Create XForm XML");
    test("Create simple flat Xform", function () {
        var c = formdesigner.controller,
                ui = formdesigner.ui,
                jstree = $("#fd-question-tree"),
                curMugType,
                addQbut;
        c.resetFormDesigner();
        addQbut = $('#fd-add-but');
        addQbut.click();
        addQbut.click();
        addQbut.click();
        addQbut.click();
        addQbut.click();
        formdesigner.formUuid = 'http://openrosa.org/formdesigner/1B27BC6C-D6B2-43E2-A36A-050DBCAF4763';
        var actual = beautifyXml(c.form.createXForm());
        getTestXformOutput('form0.xml');

        var expected = beautifyXml(testXformBuffer);
        equal(expected,actual);

    });

    test("Create simple nested Xform", function () {
        var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            curMugType, Itext,
            addQbut, lastCreatedNode, addGroupBut, qTypeSel;
        c.resetFormDesigner();

        Itext = formdesigner.model.Itext;

        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })
        addQuestionThroughUI("Text Question");
        jstree.jstree('select_node',lastCreatedNode);
        curMugType = formdesigner.controller.form.controlTree.getMugTypeFromUFID(lastCreatedNode.attr('id'));
        Itext.setValue(curMugType.mug.properties.controlElement.properties.labelItextID,'en','default','question1 label');

        addQuestionThroughUI("Group");
        jstree.jstree('select_node',lastCreatedNode,true);

        $('#dataElement-nodeID-input').val('group1').keyup();
        curMugType = formdesigner.controller.form.controlTree.getMugTypeFromUFID(lastCreatedNode.attr('id'));
        Itext.setValue(curMugType.mug.properties.controlElement.properties.labelItextID,'en','default','group label');
        addQuestionThroughUI("Text Question");
        jstree.jstree('select_node',lastCreatedNode,true);
        $('#dataElement-nodeID-input').val('question2').keyup();
        curMugType = formdesigner.controller.form.controlTree.getMugTypeFromUFID(lastCreatedNode.attr('id'));
        Itext.setValue(curMugType.mug.properties.controlElement.properties.labelItextID,'en','default', 'question2 label');
        formdesigner.formUuid = "http://openrosa.org/formdesigner/5EACC430-F892-4AA7-B4AA-999AD0805A97";    
        var actual = beautifyXml(c.form.createXForm());
        validateFormWithJR(actual);

        getTestXformOutput('form1.xml');
        var expected = beautifyXml(testXformBuffer);
        validateFormWithJR(expected);
        validateFormWithJR(actual);
        validateFormWithJR(expected);
        validateFormWithJR(actual);
        
        equal(expected,actual);

        //test if form is valid
        ok(formdesigner.controller.form.isFormValid(), 'Form Should pass all Validation Tests');

                

    });

    test ("Test Form Validation function", function () {
        var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            curMugType,
            lastCreatedNode;
        c.resetFormDesigner();

        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })
        addQuestionThroughUI("Text Question");
        addQuestionThroughUI("Text Question");
        addQuestionThroughUI("Group");
        jstree.jstree('select_node',lastCreatedNode,true);
        addQuestionThroughUI("Text Question");

        equal(formdesigner.controller.form.isFormValid(), true, 'Form should be valid.');


    });

    test ("Test getMTbyDataNodeID function", function ()  {
        var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            mugType,
            ufid1,ufid2,
            lastCreatedNode;
        c.resetFormDesigner();
        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })
        addQuestionThroughUI("Text Question");
        ufid1 = $(lastCreatedNode).attr('id');
        addQuestionThroughUI("Text Question");
        ufid2 = $(lastCreatedNode).attr('id');

        mugType = c.getMTFromFormByUFID(ufid2);
        deepEqual([mugType], c.form.getMugTypeByIDFromTree(mugType.mug.properties.dataElement.properties.nodeID, 'data'), 'MugTypes should be the same')
        console.log(c.form.getMugTypeByIDFromTree('foo', 'data'))
        equal(0, c.form.getMugTypeByIDFromTree('foo', 'data').length, 'Given a bogus ID should return an empty list');
    });

    module("Parsing tests");
    test ("Replacing MugTypes in a tree", function () {
        getTestXformOutput('form1.xml');
        var xmlDoc = $.parseXML(testXformBuffer),
            xml = $(xmlDoc),
            binds = xml.find('bind'),
            data = xml.find('instance').children(),
            formID, formName, lastCreatedNode,
            c = formdesigner.controller,
            jstree = $("#fd-question-tree");
        c.resetFormDesigner();

        var mType = formdesigner.util.getNewMugType(formdesigner.model.mugTypes.dataBind),
        mug = formdesigner.model.createMugFromMugType(mType),
        oldMT;

        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })

        addQuestionThroughUI("Text Question");
        oldMT = formdesigner.controller.form.getMugTypeByIDFromTree('question2', 'data');
        mType.mug = mug;
        mType.mug.properties.dataElement.properties.nodeID = 'HYAAA';
        mType.ufid = oldMT.ufid;

        c.form.replaceMugType(oldMT,mType,'data');
    });

    function getMTFromEl(el) {
        return formdesigner.controller.form.controlTree.getMugTypeFromUFID(el.attr('id'));
    }

    module("UI Tests");
    test ("'Remove Selected' button", function () {
        var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            curMugType,
            addQbut, lastCreatedNode, addGroupBut, qTypeSel, iiD, groupMT, Itext,mugProps,cEl,iID;
        c.resetFormDesigner();
        Itext = formdesigner.model.Itext;
        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })

        //build form
        addQuestionThroughUI("Text Question");
        jstree.jstree('select_node',lastCreatedNode);
        curMugType = getMTFromEl(lastCreatedNode);
        mugProps = curMugType.mug.properties;
        cEl = mugProps.controlElement.properties;
        iID = cEl.labelItextID;
        Itext.setValue(iID,Itext.getDefaultLanguage(),'default','question1 label');
        //add group
        addQuestionThroughUI("Group");
        jstree.jstree('select_node',lastCreatedNode,true);
        curMugType = getMTFromEl(lastCreatedNode);
        groupMT = curMugType;
        mugProps = curMugType.mug.properties;
        cEl = mugProps.controlElement.properties;
        iID = cEl.labelItextID;
        Itext.setValue(iID,Itext.getDefaultLanguage(),'default','group1 label'); //set itext value for group
        $('#dataElement-nodeID-input').val('group1').keyup(); //change the groups nodeIDs to something more reasonable

        //add another text question
        addQuestionThroughUI("Text Question");
        jstree.jstree('select_node',lastCreatedNode,true);
        curMugType = getMTFromEl(lastCreatedNode);
        mugProps = curMugType.mug.properties;
        cEl = mugProps.controlElement.properties;
        iID = cEl.labelItextID;
        Itext.setValue(iID,Itext.getDefaultLanguage(),'default','question2 label');

        //select the group node
        jstree.jstree('select_node',$('#'+ groupMT.ufid),true);

        //remove it
        $('#fd-remove-button').click();

        //test if form is valid
        ok(formdesigner.controller.form.isFormValid(), 'Form Should pass all Validation Tests');

        //compare with form we have in the testing cache.
        formdesigner.formUuid = "http://openrosa.org/formdesigner/E9BE7934-687F-4C19-BDB7-9509005460B6";
        var actual = c.form.createXForm();
        validateFormWithJR(actual);
        actual = beautifyXml(actual);
        getTestXformOutput('form8.xml');
        var expected = beautifyXml(testXformBuffer);
        equal(expected,actual);

    })

    test("Input fields", function() {
        var c = formdesigner.controller,
                    ui = formdesigner.ui,
                    jstree = $("#fd-question-tree"),
                    curMugType,
                    addQbut, lastCreatedNode, addGroupBut, qTypeSel, iiD, groupMT, Itext,mugProps,cEl,iID,
                    workingField;
        c.resetFormDesigner();


        Itext = formdesigner.model.Itext;

        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })

        var xmlString;
        //build form
        addQuestionThroughUI("Text Question");

        //change form name and test results
        workingField = $("#fd-form-prop-formName-input");
        workingField.val("My Test Form").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        var xml = parseXMLAndGetSelector(xmlString);
        var title = xml.find("h\\:title");
        if(title.length === 0) {
            title = xml.find("title");
        }
        equal(title.length, 1, "Should have found the title node in generated source");
        equal(title.text(), "My Test Form", "Form title has been set correctly");

        //change form data node name and test results
        workingField = $('#fd-form-prop-formID-input');
        workingField.val('mydatanode').keyup();
        xmlString = c.form.createXForm();
        xml = parseXMLAndGetSelector(xmlString);
        validateFormWithJR(xmlString);

        var dataNode = $(xml.find('instance').children()[0]);
        equal(dataNode.length, 1, 'found data node in xml source');
        equal(dataNode[0].tagName, "mydatanode", "Data node is named correctly");
        workingField.val("My Data Node").keyup(); //test auto replace of ' ' with '_'
        xmlString = c.form.createXForm();
        xml = parseXMLAndGetSelector(xmlString);
        validateFormWithJR(xmlString);
        formdesigner.temp = xml;
        equal(workingField.val(), "My_Data_Node", "field value correctly swapped ' ' for '_'");
        var dataNode = $(xml.find('instance').children()[0]);
        equal(dataNode.length, 1, 'found data node in xml source');
        equal(dataNode[0].tagName, "My_Data_Node", "Data node with spaces is named correctly");
        


        curMugType = getMTFromEl($(lastCreatedNode));
        ui.selectMugTypeInUI(curMugType);
        equal(curMugType.typeName, "Text Question MugType", "Is Question created through UI a text type question?");
        workingField = $('#dataElement-nodeID-input');
        workingField.val("textQuestion1").keyup().keyup().keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        equal(curMugType.mug.properties.dataElement.properties.nodeID, "textQuestion1", "dataElement nodeID set correctly");
        equal(curMugType.mug.properties.bindElement.properties.nodeID, "textQuestion1", "bindElement nodeID set correctly");
        xml = parseXMLAndGetSelector(xmlString);
        validateFormWithJR(xmlString);

        //set Default Value
        workingField = $('#dataElement-dataValue-input');
        workingField.val('Some Data Value String').keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        var defaultValueXML = xml.find('My_Data_Node').children('textQuestion1').text();
        equal(defaultValueXML, "Some Data Value String", "default value set in UI corresponds to that generated in XML");

        workingField = $('#bindElement-relevantAttr-input');
        workingField.val("/data/bleeding_sign = 'N'").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        var bindRelVal = $(xml.find('bind')[0]).attr('relevant');
        equal(bindRelVal, "/data/bleeding_sign = 'N'", 'Was relevancy condition set correctly in the UI?');

        workingField.val("/data/bleeding_sign >= 5 or /data/bleeding_sing < 21").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        var bindVal = grep(xmlString,"<bind").trim();
        var expected = '<bind nodeset="/My_Data_Node/textQuestion1" type="xsd:string" relevant="/data/bleeding_sign &gt;= 5 or /data/bleeding_sing &lt; 21" />'
        equal(bindVal, expected, 'Was relevancy condition with < or > signs rendered correctly in the UI?');

        workingField = $('#bindElement-calculateAttr-input');
        workingField.val("/data/bleeding_sign >= 5 or /data/bleeding_sing < 21").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        bindVal = grep(xmlString,"<bind").trim();
        expected = '<bind nodeset="/My_Data_Node/textQuestion1" type="xsd:string" relevant="/data/bleeding_sign &gt;= 5 or /data/bleeding_sing &lt; 21" calculate="/data/bleeding_sign &gt;= 5 or /data/bleeding_sing &lt; 21" />'
        equal(bindVal, expected, 'Was calculate condition with < or > signs rendered correctly in the UI?');

        workingField = $('#bindElement-constraintAttr-input');
        workingField.val("/data/bleeding_sign >= 5 or /data/bleeding_sing < 21").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        bindVal = grep(xmlString,"<bind").trim();
        expected = '<bind nodeset="/My_Data_Node/textQuestion1" type="xsd:string" constraint="/data/bleeding_sign &gt;= 5 or /data/bleeding_sing &lt; 21" relevant="/data/bleeding_sign &gt;= 5 or /data/bleeding_sing &lt; 21" calculate="/data/bleeding_sign &gt;= 5 or /data/bleeding_sing &lt; 21" />'
        equal(bindVal, expected, 'Was constraint condition with < or > signs rendered correctly in the UI?');
        workingField.val('').keyup();
        $('#bindElement-calculateAttr-input').val('').keyup();
        $('#bindElement-relevantAttr-input').val('').keyup();

        workingField = $('#bindElement-requiredAttr-input');
        workingField.click(); //check the 'required' checkbox;
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        var requireAttr = xml.find('bind').attr('required');
        expected = "true()";
        equal(requireAttr,expected,"Is the required attribute value === 'true()' in the bind?");

        workingField = $('#fd-itext-default-input');
        workingField.val("Question 1 Itext yay").keyup().keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        var itextVal = xml.find('translation #'+ $('#controlElement-labelItextID-input').val()).children('value').text()
        expected = "Question 1 Itext yay";
        equal(itextVal,expected,"Has default Itext been set correctly through UI?");

        workingField = $('#fd-itext-audio-input');
        workingField.val("jr://audio/sound/vol1/questionnaire/awesome.mp3").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlString = xml;
        itextVal = xml.find('translation #'+ $('#controlElement-labelItextID-input').val()).children('[form="audio"]').text()
        expected = "jr://audio/sound/vol1/questionnaire/awesome.mp3";
        equal(itextVal,expected,"Has audio Itext been set correctly through UI?");

        workingField = $('#fd-itext-image-input');
        workingField.val("jr://images/foo.png").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlString = xml;
        itextVal = xml.find('text,[id="'+ $('#controlElement-labelItextID-input').val()+'"]').children('[form="image"]').text()
        expected = "jr://images/foo.png";
        equal(itextVal,expected,"Has image Itext been set correctly through UI?");

        workingField = $('#fd-itext-short-input');
        workingField.val("Some short itext").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlString = xml;
        itextVal = xml.find('text,[id="'+ $('#controlElement-labelItextID-input').val()+'"]').children('[form="short"]').text()
        expected = "Some short itext";
        equal(itextVal,expected,"Has short Itext been set correctly through UI?");

        workingField = $('#fd-itext-long-input');
        workingField.val("some long Itext for question 1").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlString = xml;
        itextVal = xml.find('text,[id="'+ $('#controlElement-labelItextID-input').val()+'"]').children('[form="long"]').text()
        expected = "some long Itext for question 1";
        equal(itextVal,expected,"Has long Itext been set correctly through UI?");



        workingField = $('#bindElement-constraintMsgAttr-input');
        workingField.val("Some default jr:constraintMsg value").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        bindVal = grep(xmlString,"<bind").trim();
        expected = '<bind nodeset="/My_Data_Node/textQuestion1" type="xsd:string" jr:constraintMsg="Some default jr:constraintMsg value" required="true()" />';
        equal(bindVal, expected, 'Was constraint Message correctly set?');


        workingField = $('#controlElement-hintLabel-input');
        workingField.val("Default Hint Label Value").keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlString = xml;
        var someval = xml.find('input').children('hint').text()
        expected = "Default Hint Label Value";
        equal(someval,expected,"Has default hint label been set correctly through UI?");

        workingField = $('#controlElement-hintItextID-input');
        workingField.val("question1_hint").keyup();
        xmlString = c.form.createXForm();
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlString = xml;
        someval = xml.find('input').children('hint').attr('ref');
        expected = "jr:itext('question1_hint')";
        equal(someval,expected,"Has hint Itext ID been set correctly through UI?");

        workingField = $('#fd-itext-hint-input');
        workingField.val("Question 1 Itext hint").keyup().keyup();
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        var findstring = '';
        if($('#controlElement-hintItextID-input').val()) {
            findstring = '[id='+$('#controlElement-hintItextID-input').val()+']';
        }
        itextVal = xml.find('translation').find(findstring).children('value').text()
        expected = "Question 1 Itext hint";
        equal(itextVal,expected,"Has hint Itext been set correctly through UI?");

    });

    test("DataType selector functionality", function() {
        var c = formdesigner.controller,
                    ui = formdesigner.ui,
                    jstree = $("#fd-question-tree"),
                    curMugType,
                    addQbut, lastCreatedNode, addGroupBut, qTypeSel, iiD, groupMT, Itext,mugProps,cEl,iID,
                    workingField;
        c.resetFormDesigner();


        Itext = formdesigner.model.Itext;

        jstree.bind('create_node.jstree',function(e,data){
            lastCreatedNode = data.rslt.obj;
        })

        var xmlString, xml;
        //build form
        addQuestionThroughUI("Text Question");
        addQuestionThroughUI("Group");
        curMugType = getMTFromEl($(lastCreatedNode));
        ui.selectMugTypeInUI(curMugType);
        addQuestionThroughUI("Integer Number");
        curMugType = getMTFromEl($(lastCreatedNode));
        ui.selectMugTypeInUI(curMugType);
        equal($('#bindElement-dataType-input').val(), 'xsd:int');
        equal(curMugType.mug.properties.bindElement.properties.dataType, 'xsd:int');

        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlSring = xml;
        var el = xml.find('[nodeset*='+curMugType.mug.properties.bindElement.properties.nodeID+']')
        equal($(el).attr('type'), 'xsd:int');


        addQuestionThroughUI("Double Number");
        curMugType = getMTFromEl($(lastCreatedNode));
        ui.selectMugTypeInUI(curMugType);
        equal($('#bindElement-dataType-input').val(), 'xsd:double');
        equal(curMugType.mug.properties.bindElement.properties.dataType, 'xsd:double');
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlSring = xml;
        el = xml.find('[nodeset*='+curMugType.mug.properties.bindElement.properties.nodeID+']')
        equal($(el).attr('type'), 'xsd:double');
        equal(curMugType.mug.properties.bindElement.properties.dataType, 'xsd:double');

        addQuestionThroughUI("Long Number");
        curMugType = getMTFromEl($(lastCreatedNode));
        ui.selectMugTypeInUI(curMugType);
        equal($('#bindElement-dataType-input').val(), 'xsd:long');
        equal(curMugType.mug.properties.bindElement.properties.dataType, 'xsd:long');

        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlSring = xml;
        el = xml.find('[nodeset*='+curMugType.mug.properties.bindElement.properties.nodeID+']')
        equal($(el).attr('type'), 'xsd:long');

        addQuestionThroughUI("Secret Question");
        curMugType = getMTFromEl($(lastCreatedNode));
        ui.selectMugTypeInUI(curMugType);
        equal($('#bindElement-dataType-input').val(), 'xsd:string');
        equal(curMugType.mug.properties.bindElement.properties.dataType, 'xsd:string');
        equal(curMugType.typeName, "Secret Question MugType");
        equal(curMugType.mug.properties.controlElement.properties.name, "Secret");
        xmlString = c.form.createXForm();
        validateFormWithJR(xmlString);
        xml = parseXMLAndGetSelector(xmlString);
        window.xmlSring = xml;
        el = xml.find('secret')
        equal($(el).length,1);
        equal($(el).tagName)
        el = xml.find('[nodeset*='+curMugType.mug.properties.bindElement.properties.nodeID+']')
        equal($(el).attr('type'), 'xsd:string');



    });

    module("Parsing Tests Part II");
    test("Parse Error Messages Functionality", function () {
        var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            curMugType,
            addQbut, lastCreatedNode, addGroupBut, qTypeSel, iiD, groupMT, Itext,mugProps,cEl,iID,
                sourceDrop, parseButton, pErrors, expectedErrors, myxml;
        c.resetFormDesigner();


        getTestXformOutput('form_with_no_data_attrs.xml');
        myxml = testXformBuffer;
        c.loadXForm(myxml); //load the xform using the standard pathway in the FD for parsing forms

        expectedErrors = [
            "warning::Form does not have a unique xform XMLNS (in data block). Will be added automatically",
            "warning::Form JRM namespace attribute was not found in data block. One will be added automatically",
            "warning::Form does not have a UIVersion attribute, one will be generated automatically",
            "warning::Form does not have a Version attribute (in the data block), one will be added automatically",
            "warning::Form does not have a Name! The default form name will be used"
        ];
        pErrors = c.getParseErrorMsgs();
        deepEqual(pErrors, expectedErrors, "Do the correct errors get generated for a form with no data block attributes?");


    });

    module("In Out In XForm Tests");
    test("Grab all the forms in the cache and test them individually", function () {
         var c = formdesigner.controller,
            ui = formdesigner.ui,
            jstree = $("#fd-question-tree"),
            output, myxml, i=0;

        for (i in testFormNames) {
            get_cchq_forms(testFormNames[i]);
            myxml = testXformBuffer;
            validateFormWithJR(myxml);
            c.loadXForm(myxml);             //parse
            output = c.form.createXForm();  //generate form with FD
            validateFormWithJR(output);     //validate

            c.loadXForm(output);            //parse the newly generated form
            output = c.form.createXForm();  //generate resulting XForm again
            validateFormWithJR(output);     //Validate again
        }

    });


});

var asyncRes = [], testData = [], len = -1;
formdesigner.asyncRes = asyncRes;
formdesigner.testData = testData;
/**
 * Actual is the xml form string
 * @param actual
 */
function validateFormWithJR(actual) {
    if(!JRVALIDATE_MODE){
        return true;
    }
        stop();
        var mylen;
        len = len + 1;
        mylen = len;
        testData[mylen] = formdesigner.util.clone(actual);
//        $.ajaxSetup({"async": false});
        $.post('/formtranslate/validate/',{xform: testData[mylen]},function (data) {
                    asyncRes[mylen] = data;
                    if(!asyncRes[mylen].success){
                        ok(false, "Form Failed to validate with JR Validator!"+mylen);
                        start();
                        throw 'Form Failed to validate with JR Validator! See Console. Failure number:'+mylen;
                    }
                    ok(asyncRes[mylen].success, 'Form validates with Javarosa form validator, see console for failure '+mylen);
                    start();

        });
}

function parseXMLAndGetSelector(xmlString) {

    var xmlDoc = $.parseXML(xmlString),
                xml = $(xmlDoc);
    return xml;
}

function divide(a,b){
    return a/b;
}

function grep(xmlString, matchStr) {
    var lines,i;
    lines = xmlString.split(/\n/g);
    for (i in lines) {
        if(lines[i].match(matchStr)) {
            return lines[i];
        }
    }
    return null;
}