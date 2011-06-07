$(document).ready(function(){
    module("Basic Unit Test");
    test("Sample test", function()
    {
     expect(1);
     equals(divide(4,2),
      2,
      'Expected 2 as the result, result was: ' + divide(4,2));
    });


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


    test("Test additional object", function(){
        expect(2);

        ///////
        var otherLiveText = new formdesigner.model.LiveText;
        equal(otherLiveText.renderString(),"", 'test render empty liveText');

        ///////
        otherLiveText.addToken("foo ");
        otherLiveText.addToken("bar");
        equal(otherLiveText.renderString(),"foo bar", "check creation of additional LiveText and that it produces correct results");

    });

    module("Mug Unit Tests")
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



});

function divide(a,b){
    return a/b;
}