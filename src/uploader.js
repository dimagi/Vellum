define([
    'require',
    'module',
    'underscore',
    'jquery',
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
        'video-inline': [
            {
                'description': 'Inline Video',
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
        'video-inline': multimedia_existing_video,
        text:  multimedia_existing_text,
    },
    SLUG_TO_CLASS = {
        image: 'CommCareImage',
        audio: 'CommCareAudio',
        video: 'CommCareVideo',
        'video-inline': 'CommCareVideo',
        text:  'CommCareMultimedia',
    },
    SLUG_TO_UPLOADER_SLUG = {
        image: 'fd_hqimage',
        audio: 'fd_hqaudio',
        video: 'fd_hqvideo',
        'video-inline': 'fd_hqInlineVideo',
        text:  'fd_hqtext',
    },
    EXT = /(\.[^\/.]+)?$/;

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

        ref.updateController = function (widget) {
            // see note about poor man's promise below
            var uploadController = uploadControls[ref.mediaType].value;
            uploadController.resetUploader();
            uploadController.currentReference = ref;
            uploadController.updateMediaPath = function () {
                var params = uploadController.uploadParams;
                params.path = widget.getRandomizedMediaPath(params.path);
            };
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

        if (!widget.getBaseMediaPath) {
            /**
             * Get media path without file type extension
             *
             * Example: jr://file/commcare/text/name
             */
            widget.getBaseMediaPath = function () {
                throw new Error("abstract method not implemented: " +
                                "widget.getBaseMediaPath()");
            };
        }

        widget.getRandomizedMediaPath = function (oldPath) {
            // The file type extension of the path returned here is replaced by
            // the extension of the uploaded file, so it is not strictly
            // necessary to pass in oldPath. However, the returned path must
            // have an extension because of the way
            // BaseHQMediaUploadController.startUpload() replaces it.
            var extension = EXT.exec(oldPath)[0].toLowerCase() || ".xyz",
                // generates 1 or 2 duplicates in 100K samples (probably random enough)
                rand6 = Math.random().toString(36).slice(2, 8);
            return widget.getBaseMediaPath() + "-" + rand6 + extension;
        };

        var getValue = widget.getItextValue || widget.getValue,
            $input = widget.getControl(),
            $uiElem = $('<div />'),
            _getParentUIElement = widget.getUIElement,
            $previewContainer = $('<div />')
                .addClass('fd-mm-preview-container'),
            ICONS = widget.mug.form.vellum.data.javaRosa.ICONS;

        widget.getUIElement = function () {
            $uiElem = _getParentUIElement();
            var $controlBlock = $uiElem.find('.controls'),
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
            $input.on("change keyup", function () {
                widget.updateMultimediaBlockUI(objectMap);
            });
            $uiElem.on('mediaUploadComplete', function (event, data) {
                widget.handleUploadComplete(event, data, objectMap);
            });

            $controlBlock.append($uploadContainer);

            // reapply bindings because we removed the input from the UI
            $input.on("change keyup", widget.updateValue);

            return $uiElem;
        };

        widget.handleUploadComplete = function (event, data, objectMap) {
            if (data.ref && data.ref.path) {
                if (getValue() !== data.ref.path) {
                    widget.getControl().val(data.ref.path);
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
            hasItext = _.isFunction(widget.getItextItem),
            currentPath = javarosa ? widget.getItextValue() : widget.getValue(),
            previewHtml;
        if (hasItext && !javarosa && !currentPath && !widget.isDefaultLang) {
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
            widget.mediaRef.updateController(widget);
        });
        return $uploadBtn;
    };

    $.vellum.plugin("uploader", {
        objectMap: false,
        sessionid: false,
        uploadUrls: {
            image: false,
            audio: false,
            video: false,
            'video-inline': false,
            text: false
        },
    }, {
        init: function () {
            var opts = this.opts().uploader,
                uploadUrls = opts.uploadUrls,
                uploadEnabled = opts.objectMap && opts.uploadUrls && 
                    opts.uploadUrls.image,
                sessionid = opts.sessionid;

            this.data.uploader.uploadEnabled = uploadEnabled;
            this.data.uploader.objectMap = opts.objectMap;
            if (!uploadEnabled) {
                return;
            }

            this.data.uploader.deferredInit = function () {
                this.data.uploader.uploadControls = {
                    'image': this.initUploadController({
                        uploaderSlug: 'fd_hqimage',
                        mediaType: 'image',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.image,
                    }),
                    'audio': this.initUploadController({
                        uploaderSlug: 'fd_hqaudio',
                        mediaType: 'audio',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.audio,
                    }),
                    'video': this.initUploadController({
                        uploaderSlug: 'fd_hqvideo',
                        mediaType: 'video',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.video,
                    }),
                    'video-inline': this.initUploadController({
                        uploaderSlug: 'fd_hqInlineVideo',
                        mediaType: 'video-inline',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.video,
                    }),
                    'text': this.initUploadController({
                        uploaderSlug: 'fd_hqtext',
                        mediaType: 'text',
                        sessionid: sessionid,
                        uploadUrl: uploadUrls.text,
                    })
                };
            };
        },
        initMediaUploaderWidget: function (widget) {
            this.__callOld();
            if (!this.data.uploader.uploadEnabled) {
                return;
            }

            var deferredInit = this.data.uploader.deferredInit;
            if (deferredInit !== null) {
                this.data.uploader.deferredInit = null;
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
            // uploadControls is referenced in the initMediaUploaderWidget call
            // path, but never actually used until the upload button is clicked.
            // We use an object here as a poor man's promise.
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
                var super_startUpload = uploadController.value.startUpload;
                uploadController.value.startUpload = function (event) {
                    uploadController.value.updateMediaPath();
                    return super_startUpload.call(this, event);
                };
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
            this.__callOld();
        }
    });
});
