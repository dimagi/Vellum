/**
 * Model classes and functions for the FormDesigner
 */
if(typeof formdesigner === 'undefined'){
    var formdesigner = {};
}

formdesigner.model = function(){

    var mug = function(){
        var that = {}
        var moo = 'mooooooo';
        var get_moo = function(){
            return this.moo;
        }
        that.moo = moo;
        that.get_moo = get_moo;
        return that;
    }();


    var form = function(){

    }();

    var xhtml = function(){

    }();

    var localization = function(){

    }();

    var myMug = Object.create(mug);

    var bindElement = function(){
        var that = {}
        return that;
    }();

    var dataElement = function(){
        var that = {}
        return that;
    }();

    var controlElement = function(){
        var that = {}
        return that;
    }();



    //make the mug event aware:
    formdesigner.util.eventuality(myMug);

    var otherMug = Object.create(mug);
    otherMug.moo = 'woah moo soo hard';
    var thirdMug = Object.create(mug);
    thirdMug.moo = 'this is the thirdMug mooing';


    myMug.on('blast',function(someMugs){
      for(var i in someMugs){
        console.log(i);
        console.log('blasting! mug says:'+someMugs[i].get_moo());
      }
    },[[otherMug, thirdMug, myMug]])


    myMug.on('blast',function(someMugs){
      for(var i in someMugs){
        console.log(i);
        console.log('a different blasting registered event! mug says:'+someMugs[i].get_moo());
      }
    },[[otherMug, thirdMug, myMug]])

    myMug.fire('blast');
    

}();