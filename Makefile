_FILES=$(shell git diff-files --quiet --ignore-submodules && true || echo '+')
_INDEX=$(shell git diff-index --cached --quiet HEAD && true || echo '+')
VERSION=$(shell git rev-parse HEAD)$(_FILES)$(_INDEX)

all:  tar

webpack: deps _webpack

tar: webpack _tar

test: tar _test

deps:
	yarn install

_webpack:
	rm -rf _build
	yarn build
# https://github.com/guybedford/require-css/issues/133 
# TODO: support this again(?)
#	cd _build/node_modules && ls . | xargs rm -r
#	mkdir -p _build/node_modules/jstree/dist/themes/default
#	cp node_modules/jstree/dist/themes/default/*.png \
#	   node_modules/jstree/dist/themes/default/*.gif \
#	   _build/node_modules/jstree/dist/themes/default
# combine CSS files (and adjust location for relative image paths)
# TODO: support this again(?)
#	cat _build/src/local-deps.css _build/src/main-components.css > _build/style.css
#	rm _build/src/local-deps.css _build/src/main-components.css
#	mv _build/src/images _build/
	echo "$(VERSION)" > _build/version.txt
	(yarn list || yarn list --offline) | grep -Ev "^(Vellum|yarn) " > _build/manifest.txt
#	python buildmain.py > _build/src/main.js

_tar:
	rm -f vellum.tar.gz
	tar -czf vellum.tar.gz -C _build .

_test:
	npm test
