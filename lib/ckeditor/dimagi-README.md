How to create a minified ckeditor
=====

Go to the [CK build editor](http://ckeditor.com/builder).

Use the following plugins:
* clipboard (for drag and drop)
* entities
* floatingspace
* undo (for change events)
* widget
* [config helper](http://ckeditor.com/addon/confighelper) (for placeholder support)

If by chance this hasn't been updated you can also check build-config.js in
lib/ckeditor/


How to create an unminified ckeditor
=====

```
git clone https://github.com/ckeditor/ckeditor-dev
git co 4.5.4
```

add --leave-js-unminified to the line `java -jar ckbuilder/$CKBUILDER_VERSION/ckbuilder.jar ...` in dev/builder/build.sh

copy over our build-config.js to dev/builder 

Note only skins kama and moono exist in default ckeditor repo
The skin doesn't actually matter so just use one of those in build-config.js

run `./dev/builder/build.sh`
copy the folder it creates to vellum
