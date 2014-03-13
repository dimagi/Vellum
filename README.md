Vellum
======

Vellum is a JavaRosa [XForm](http://en.wikipedia.org/wiki/XForms) designer built by
[Dimagi][0] for [CommCare HQ][1].

 [0]: http://www.dimagi.com
 [1]: http://www.commcarehq.org


Usage
-----

Vellum depends on jQuery, Underscore.js, and Bootstrap.  Other dependencies are
bundled and included in `dist/vellum.js` and `dist/vellum.css`, but some
additional dependencies that are part of [CommCare
HQ](http://github.com/dimagi/commcare-hq) aren't well-defined yet.

For an example of a minimal setup and usage of Vellum, including all known
dependencies, see `tests/index.html`.

For some additional configuration options, see
[`form_designer.html`](https://github.com/dimagi/commcare-hq/blob/master/corehq/apps/app_manager/templates/app_manager/form_designer.html)
in CommCare HQ.


Contributing
------------

### Setup

Install dependencies:
```
$ npm install napa
$ npm install
```

Create build artifacts for each commit:
```
$ grunt dist
```

Run tests in a browser:
```
$ python -m SimpleHTTPServer
$ chromium-browser http://localhost:8000/tests/
```

Run tests headlessly (currently broken):
```
$ npm install -g phantomjs
$ npm test
```

### Submitting changes

Changes should be in the form of pull requests to develop.

A new release is initiated by branching develop off to release, and creating
a pull request from release into master.

master always contains the latest stable version.

[master](http://vellum-master.herokuapp.com),
[release](http://vellum-release.herokuapp.com), and
[develop](http://vellum-develop.herokuapp.com) are automatically deployed for
testing.


Event Tracking
--------------

If you have Google Analytics installed, Vellum will track events.


Changelog
---------

### 1.5.0

- Added Ignore-but-retain and question locking plugins 
- Fixed ability to Ctrl-F within source XML editor
- Added testing infrastructure
- Added Grunt build to generate JS and CSS
