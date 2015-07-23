define([
    'require',
    'module',
    'underscore',
    'jquery',
    'vellum/util',
    'tpl!vellum/templates/multimedia_modal',
    'tpl!vellum/templates/multimedia_upload_trigger',
    'text!vellum/templates/multimedia_queue.html',
    'text!vellum/templates/multimedia_errors.html',
    'text!vellum/templates/multimedia_existing_image.html',
    'text!vellum/templates/multimedia_existing_audio.html',
    'text!vellum/templates/multimedia_existing_video.html',
    'text!vellum/templates/multimedia_existing_text.html',
    'tpl!vellum/templates/multimedia_nomedia',
    'text!vellum/templates/multimedia_block.html',
    'vellum/core'
], function (
    require,
    module,
    _,
    $,
    util,
    multimedia_modal,
    multimedia_upload_trigger,
    multimedia_queue,
    multimedia_errors,
    multimedia_existing_image,
    multimedia_existing_audio,
    multimedia_existing_video,
    multimedia_existing_text,
    multimedia_nomedia,
    multimedia_block
) {
    "use strict";

    var SUPPORTED_EXTENSIONS = {
        image: [
            {
                'description': 'Image',
                'extensions': '*.jpg;*.png;*.gif'
            }
        ],
        audio: [
            {
                'description': 'Audio',
                'extensions': '*.mp3;*.wav'
            }
        ],
        video: [
            {
                'description': 'Video',
                'extensions': '*.3gp;*.mp4'
            }
        ],
        text: [
            {
                'description': 'HTML',
                'extensions': '*.html'
            }
        ],
    },
        PREVIEW_TEMPLATES = {
        image: multimedia_existing_image,
        audio: multimedia_existing_audio,
        video: multimedia_existing_video,
        text:  multimedia_existing_text,
    },
        SLUG_TO_CLASS = {
        image: 'CommCareImage',
        audio: 'CommCareAudio',
        video: 'CommCareVideo',
        text:  'CommCareMultimedia',
    },
        SLUG_TO_UPLOADER_SLUG = {
        image: 'fd_hqimage',
        audio: 'fd_hqaudio',
        video: 'fd_hqvideo',
        text:  'fd_hqtext',
    };

    // These functions were extracted out when separating the uploader code from
    // the JavaRosa Itext media widget code.  They could easily be made part of
    // the plugin interface in order to avoid passing around objectMap and
    // uploadControls, but it seems fine either way.
    var multimediaReference = function (mediaType, objectMap, uploadControls) {
        var ref = {};
        ref.mediaType = mediaType;

        ref.updateRef = function (path) {
            ref.path = path;
            ref.linkedObj = objectMap[path];
        };

        ref.isMediaMatched = function () {
            return _.isObject(ref.linkedObj);
        };

        // gets called by uploadController
        ref.getUrl = function () {
            return ref.linkedObj.url;
        };

        ref.updateController = function () {
            // see note about poor man's promise below
            var uploadController = uploadControls[ref.mediaType].value;
            uploadController.resetUploader();
            uploadController.currentReference = ref;
            uploadController.uploadParams = {
                path: ref.path,
                media_type : SLUG_TO_CLASS[ref.mediaType],
                old_ref: (ref.isMediaMatched()) ? ref.linkedObj.m_id : "",
                replace_attachment: true
            };
            uploadController.updateUploadFormUI();
        };

        return ref;
    };

    var addUploaderToWidget = function (widget, objectMap, uploadControls) {
        widget.mediaRef = multimediaReference(
            widget.form, objectMap, uploadControls);

        var getValue = widget.getItextValue || widget.getValue,
            $input = widget.getControl(),
            $uiElem = $('<div />'),
            _getParentUIElement = widget.getUIElement,
            $previewContainer = $('<div />')
                .addClass('fd-mm-preview-container'),
            ICONS = widget.mug.form.vellum.data.javaRosa.ICONS;

        widget.getUIElement = function () {
            $uiElem = _getParentUIElement();
            var $controlBlock = $uiElem.find('.controls').not(".messages"),
                $uploadContainer = $('<div />')
                    .addClass('fd-mm-upload-container');
            $controlBlock.empty()
                .addClass('control-row').data('form', widget.form);

            widget.updateReference();

            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS));
            $controlBlock.append($previewContainer);

            $uploadContainer.html(multimedia_block);
            $uploadContainer.find('.fd-mm-upload-trigger')
                .append(getUploadButtonUI(widget, objectMap));
            $uploadContainer.find('.fd-mm-path-input')
                .append($input);

            $uploadContainer.find('.fd-mm-path-show').click(function (e) {
                var $showBtn = $(this);
                $showBtn.addClass('hide');
                $uploadContainer.find('.fd-mm-path').removeClass('hide');
                e.preventDefault();
            });

            $uploadContainer.find('.fd-mm-path-hide').click(function (e) {
                var $hideBtn = $(this);
                $hideBtn.parent().addClass('hide');
                $uploadContainer.find('.fd-mm-path-show').removeClass('hide');
                e.preventDefault();
            });
            $input.bind("change keyup", function () {
                widget.updateMultimediaBlockUI(objectMap);
            });
            $uiElem.on('mediaUploadComplete', function (event, data) {
                widget.handleUploadComplete(event, data, objectMap);
            });

            $controlBlock.append($uploadContainer);

            // reapply bindings because we removed the input from the UI
            $input.bind("change keyup", widget.updateValue);

            return $uiElem;
        };
        
        widget.handleUploadComplete = function (event, data, objectMap) {
            if (data.ref && data.ref.path) {
                var newExtension = '.' + data.ref.path.split('.').pop().toLowerCase(),
                    oldExtension = '.' + getValue().split('.').pop().toLowerCase();
                if (newExtension !== oldExtension) {
                    var currentPath = getValue().replace(/\.[^/.]+$/, newExtension);
                    widget.getControl().val(currentPath);
                    widget.handleChange();
                }
                objectMap[data.ref.path] = data.ref;
            }
            widget.updateMultimediaBlockUI(objectMap);
        };
        
        widget.updateMultimediaBlockUI = function (objectMap) {
            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS))
                .find('.existing-media').tooltip();

            $uiElem.find('.fd-mm-upload-trigger')
                .empty()
                .append(getUploadButtonUI(widget, objectMap));

            widget.updateReference();
        };

        widget.updateReference = function () {
            var currentPath = getValue();
            $uiElem.attr('data-hqmediapath', currentPath);
            widget.mediaRef.updateRef(currentPath);
        };
    };

    var getPreviewUI = function (widget, objectMap, ICONS) {
        var javarosa = _.isFunction(widget.getItextValue),
            currentPath = javarosa ? widget.getItextValue() : widget.getValue(),
            previewHtml;
        if (!javarosa && !currentPath && !widget.isDefaultLang) {
            currentPath = widget.getItextItem().get(widget.form, widget.defaultLang);
        }
        if (currentPath in objectMap) {
            var linkedObject = objectMap[currentPath];
            previewHtml = _.template(PREVIEW_TEMPLATES[widget.form])({
                url: linkedObject.url
            });
        } else {
            previewHtml = multimedia_nomedia({
                iconClass: ICONS[widget.form]
            });
        }
        return previewHtml;
    };

    var getUploadButtonUI = function (widget, objectMap) {
        var currentPath = widget.getItextValue ? widget.getItextValue() : widget.getValue(),
            $uploadBtn;
        $uploadBtn = $(multimedia_upload_trigger({
            multimediaExists: currentPath in objectMap,
            uploaderId: SLUG_TO_UPLOADER_SLUG[widget.form],
            mediaType: SUPPORTED_EXTENSIONS[widget.form][0].description
        }));
        $uploadBtn.click(function () {
            widget.mediaRef.updateController();
        });
        return $uploadBtn;
    };

    // get absolute path to current file, suitable to be loaded by swfobject.
    var pieces = module.uri.split('/'),
        base = pieces.slice(0, pieces.length - 1).join('/') + '/';
   
    $.vellum.plugin("uploader", {
        objectMap: false,
        sessionid: false,
        uploadUrls: {
            image: false,
            audio: false,
            video: false,
            text: false
        },
    }, {
        init: function () {
            var opts = this.opts().uploader,
                uploadUrls = opts.uploadUrls,
                uploadEnabled = opts.objectMap && opts.uploadUrls && 
                    opts.uploadUrls.image,
                sessionid = opts.sessionid,
                swfUrl = base + "../bower_components/MediaUploader/flashuploader.swf";

            this.data.uploader.uploadEnabled = uploadEnabled;
            this.data.uploader.objectMap = opts.objectMap;
            if (!uploadEnabled) {
                return;
            }

            this.data.deferredInit = function () {
                this.data.uploader.uploadControls = {
                    'image': this.initUploadController({
                        uploaderSlug: 'fd_hqimage',
                        mediaType: 'image',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.image,
                        swfUrl: swfUrl
                    }),
                    'audio': this.initUploadController({
                        uploaderSlug: 'fd_hqaudio',
                        mediaType: 'audio',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.audio,
                        swfUrl: swfUrl
                    }),
                    'video': this.initUploadController({
                        uploaderSlug: 'fd_hqvideo',
                        mediaType: 'video',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.video,
                        swfUrl: swfUrl
                    }),
                    'text': this.initUploadController({
                        uploaderSlug: 'fd_hqtext',
                        mediaType: 'text',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.text,
                        swfUrl: swfUrl
                    })
                };
            };
        },
        initWidget: function (widget) {
            this.__callOld();
            if (!this.data.uploader.uploadEnabled) {
                return;
            }

            var deferredInit = this.data.deferredInit;
            if (deferredInit !== null) {
                this.data.deferredInit = null;
                deferredInit.apply(this);
            }

            addUploaderToWidget(widget, 
                                this.data.uploader.objectMap, 
                                this.data.uploader.uploadControls);
        },
        initUploadController: function (options) {
            var $uploaderModal = $(multimedia_modal({
                mediaType: options.mediaType,
                modalId: options.uploaderSlug
            }));
            this.$f.find('.fd-multimedia-modal-container').append($uploaderModal);

            // Load the uploader and its dependencies in the background after
            // core dependencies are already loaded, since it's not necessary at
            // page load.
            // uploadControls is referenced in the initWidget call path, but
            // never actually used until the upload button is clicked.  We use
            // an object here as a poor man's promise.
            // Feel free to undo this if it's not worth it.
          
            var uploadController = {value: null};

            require(['file-uploader'], function (HQMediaFileUploadController) {
                if (uploadController.value !== null) {
                    return;
                }
                uploadController.value = new HQMediaFileUploadController(
                    options.uploaderSlug, 
                    options.mediaType, 
                    {
                        fileFilters: SUPPORTED_EXTENSIONS[options.mediaType],
                        uploadURL: options.uploadUrl,
                        swfURL: options.swfUrl,
                        isMultiFileUpload: false,
                        queueTemplate: multimedia_queue,
                        errorsTemplate: multimedia_errors,
                        existingFileTemplate: PREVIEW_TEMPLATES[options.mediaType],
                        licensingParams: [
                            'shared', 'license', 'author', 'attribution-notes'],
                        uploadParams: {},
                        sessionid: options.sessionid
                    }
                );
                uploadController.value.init();
            });
            return uploadController;
        },
        destroy: function () {
            _.each(this.data.uploader.uploadControls, function (control, key) {
                if (control.value) {
                    // HACK deep reach
                    // HQMediaFileUploadController should have a destroy method
                    control.value.uploader.destroy();
                }
                delete control.value;
            });
        }
    });
});
