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
	cp -r lib/ _build/lib
	echo "$(VERSION)" > _build/version.txt
	(yarn list || yarn list --offline) | grep -Ev "^(Vellum|yarn) " > _build/manifest.txt

_tar:
	rm -f vellum.tar.gz
	tar -czf vellum.tar.gz -C _build .

_test:
	yarn testbuild
	npm test
