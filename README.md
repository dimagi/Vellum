Vellum
======

Vellum is a JavaRosa [XForm](http://en.wikipedia.org/wiki/XForms) designer built by
[Dimagi][0] for [CommCare HQ][1].

 [0]: http://www.dimagi.com
 [1]: http://www.commcarehq.org


Usage
-----

### Setup

Install dependencies:
```
$ npm install -g bower requirejs
$ npm install
```

There are three ways to load Vellum, depending on whether you want asychronous
module loading, and whether jQuery, jQueryUI, and Bootstrap are already loaded
on the page.

Asynchronous, will use existing jQuery, jQueryUI, Boostrap (V2) plugins if present:
```html
<script src="bower_components/requirejs/require.js"></script>
<script>
    require.config({
        baseUrl: '/path/to/vellum/src'
    });
</script>
```

Bundled with all dependencies:
```
$ grunt dist
```

```html
<script src="dist/main.min.js"></script>
<script>
</script>
```

Bundled with all dependencies except jQuery, jQuery UI, and Bootstrap plugins,
expects them already to be loaded:
```
$ grunt dist-min
```

```html
<script src="dist/main.no-jquery.min.js"></script>
<script>
</script>
```

Finally, for all three:
```javascript
require(["main"], function ($) {
    $("#formdesigner").vellum(options)
});
```


### Options

Todo


Contributing
------------

### Coding style

Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).

### Tests

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
