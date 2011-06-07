$(document).ready(function(){
    module("Basic Unit Test");
    test("Sample test", function()
    {
     expect(1);
     equals(divide(4,2),
      2,
      'Expected 2 as the result, result was: ' + divide(4,2));
    });


    module("LiveText Unit Text");
    test("Create LiveText", function(){
        expect(4)
        var liveText = Object.create(formdesigner.model.liveText);
        ok(typeof liveText === 'object',"LiveText object should be an Object");
        liveText.addToken("Test String");
        equal(liveText.renderString(),"Test String", "Check for correct rendering of added string 'Test String'")
        var testObj = {text: "Some Text"};
        testObj.cbFunc = function(){
            return this.text();
        };
        liveText.addToken(testObj,testObj.cbFunc);
        equal(liveText.renderString(),"Test StringSome Text","correct rendering of obj token with callback");

        var otherObj = {text: " Meow Mix times: "};
        otherObj.cbFunc = function(n){
            return this.text + n;
        };
        liveText.addToken(otherObj,testObj.cbFunc,5);
        equal(liveText.renderString(),"Test StringSome Text Meow Mix times: 5", "rendering with callback + params");

    });



});

function divide(a,b){
    return a/b;
}