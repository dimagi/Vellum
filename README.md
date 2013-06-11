Vellum
======

Vellum is an XForms form designer built by [Dimagi][0] for [CommCare HQ][1].

 [0]: http://www.dimagi.com
 [1]: http://www.commcarehq.org

Setup
-----

For an example of the JS and CSS files you need to include, see [this link](https://github.com/dimagi/core-hq/blob/master/corehq/apps/app_manager/templates/app_manager/form_designer.html).

In `css/jquery.fancybox-1.3.4.css`, change line 39 to the URL that points to fancybox.png.

Usage
-----

    formdesigner.launch({
        rootElement: "#formdesigner",
        staticPrefix: "",
        langs: ""
    });

formdesigner.launch causes the formdesigner to initialize itself fully in the element specified by rootElement.

Form Options:
* rootElement: "jQuery selector to FD Container",
* staticPrefix : "url prefix for static resources like css and pngs",
* saveUrl : "URL that the FD should post saved forms to",
* [form] : "string of the xml form that you wish to load"
* [formName] : "Default Form Name"

Testing
-------

The short story:

```
$ cd js
$ npm install -d
$ open tests/runner.html  # Or however you get htis HTML file loaded in a browser
```

Ideally, though not working today, this can be run on the command-line via:

```
$ npm install -g mocha-phantomjs
$ mocha-phantomjs tests/runner.html
```


Contributing
------------

To modify Vellum's CSS, you need to have [LESS](http://lesscss.org) installed.
Currently we keep both .less source files and compiled CSS files in version
control. Edit `_less/main.less` with your changes and then run

    lessc _less/main.less > css/main.css 

For any change that modifies a .less file, unless it's a very small change,
pleas try to make two separate commits, one with your .less changes and any
associated changes, and one with just the compiled CSS file changes.

