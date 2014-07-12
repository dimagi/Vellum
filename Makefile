BIN = node_modules/.bin

all:  tar

rjs: deps _rjs

tar: rjs _tar

test: tar _test

deps:
	npm install

madge:
	$(BIN)/madge --format amd src -R src/require-config.js -i deps.png -x "^(css.*|jquery|underscore|require-config|util)$$"

_rjs:
	rm -rf _build
	$(BIN)/r.js -o build.js
# r.js removeCombined option doesn't handle plugin resources
	rm -r _build/src/exclude.js _build/src/templates _build/src/less-style
	find _build/ -maxdepth 1 -mindepth 1 -not -name src -not -name lib -not -name README.md -not -name bower_components | xargs rm -rf
# https://github.com/guybedford/require-css/issues/133 
	cd _build/bower_components && ls . | grep -v MediaUploader | grep -v require-css | xargs rm -r
# gets removed by removeCombined
	cp bower_components/require-css/css.js _build/bower_components/require-css/


_tar:
	rm -f vellum.tar.gz
	cd _build && tar -czf ../vellum.tar.gz *

_test:
	#npm test
	$(BIN)/jshint src/*.js
