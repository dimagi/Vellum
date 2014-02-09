Vellum
======

Vellum is an [XForm](http://en.wikipedia.org/wiki/XForms) designer built by
[Dimagi][0] for [CommCare HQ][1].

 [0]: http://www.dimagi.com
 [1]: http://www.commcarehq.org

Setup
-----

Vellum expects jQuery, Underscore.js, and Twitter Bootstrap (version 2.2.2) to
be present.   It also expects `SaveButton` from CommCare HQ
([link](https://github.com/dimagi/commcare-hq/blob/master/corehq/apps/hqwebapp/static/hqwebapp/js/main.js))
to be present, or you can use the version included in `js/`, which may be out of
date.

All other dependencies are bundled in `dist/vellum.min.js` and
`dist/vellum.css`.

You'll need to change line 39 in `css/jquery.fancybox-1.3.4.css` to the URL that
points to fancybox.png, and re-run the grunt tasks.

Usage
-----

    formdesigner.launch({
        rootElement: "#formdesigner",
        staticPrefix: "",
        langs: ""
    });

formdesigner.launch causes the formdesigner to initialize itself fully in the
element specified by rootElement.

Form Options:
* rootElement: "jQuery selector to FD Container",
* staticPrefix : "url prefix for static resources like css and pngs",
* saveUrl : "URL that the FD should post saved forms to",
* [form] : "string of the xml form that you wish to load"
* [formName] : "Default Form Name"


Contributing
------------

Install dependencies:
```
$ npm install
```

Create build artifacts for each commit:
```
$ grunt dist
```

Run tests in a browser:
```
$ python -m SimpleHTTPServer
$ chromium-browser tests/runner.html
```

Run tests headlessly (currently broken):
```
$ npm install -g phantomjs
$ npm test
```


To modify Vellum's CSS, you need to have [LESS](http://lesscss.org) installed.
You each file in `style` is compiled individually and share a common library `style/lib/main.less`
with useful mixins and variables borrowed from [Twitter Bootstrap](http://getbootstrap.com).

Event Tracking
--------------

If you have Google Analytics installed, Vellum will track events.
