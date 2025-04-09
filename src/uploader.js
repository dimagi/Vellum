define([
    'require',
    'module',
    'underscore',
    'jquery',
    'tpl!vellum/templates/multimedia_modal',
    'tpl!vellum/templates/multimedia_upload_trigger',
    'vellum/templates/multimedia_upload_status.html',
    'vellum/templates/multimedia_errors.html',
    'vellum/templates/multimedia_existing_image.html',
    'vellum/templates/multimedia_existing_audio.html',
    'vellum/templates/multimedia_existing_video.html',
    'vellum/templates/multimedia_existing_text.html',
    'tpl!vellum/templates/multimedia_nomedia',
    'tpl!vellum/templates/multimedia_block',
    'vellum/core'
], function (
    require,
    module,
    _,
    $,
    multimedia_modal,
    multimedia_upload_trigger,
    multimedia_upload_status,
    multimedia_errors,
    multimedia_existing_image,
    multimedia_existing_audio,
    multimedia_existing_video,
    multimedia_existing_text,
    multimedia_nomedia,
    multimedia_block
) {
    "use strict";

    var SLUG_TO_DESCRIPTION = {
        image: gettext('Image'),
        audio: gettext('Audio'),
        video: gettext('Video'),
        'video-inline': gettext('Inline Video'),
        text: gettext('HTML'),
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
    // uploadControllers, but it seems fine either way.
    var multimediaReference = function (mediaType, objectMap, uploadControllers) {
        var ref = {};
        ref.mediaType = mediaType;

        ref.updateRef = function (path) {
            ref.path = path;
            ref.linkedObj = objectMap[path];
        };

        ref.isMediaMatched = function () {
            return _.isObject(ref.linkedObj);
        };

        ref.getUrl = function () {
            return ref.linkedObj ? ref.linkedObj.url : undefined;
        };

        ref.updateController = function (widget) {
            var uploadController = uploadControllers[ref.mediaType];
            uploadController.currentReference = ref;
            uploadController.updateMediaPath = function () {
                var params = uploadController.uploadParams;
                params.path = widget.getRandomizedMediaPath(params.path);
                widget.updateReference(params.path);
            };
            uploadController.uploadParams = {
                path: ref.path,
                media_type : SLUG_TO_CLASS[ref.mediaType],
                old_ref: (ref.isMediaMatched()) ? ref.linkedObj.m_id : "",
                replace_attachment: true
            };
        };

        return ref;
    };

    var addUploaderToWidget = function (widget, objectMap, uploadControllers) {
        widget.mediaRef = multimediaReference(widget.form, objectMap, uploadControllers);

        if (!widget.getBaseMediaPath) {
            throw new Error("required method not found: widget.getBaseMediaPath()");
        }

        widget.getRandomizedMediaPath = function (oldPath) {
            // The file type extension of the path returned here is replaced by
            // the extension of the uploaded file.
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

        widget.getUploaderModal = function () {
            return $("#" + SLUG_TO_UPLOADER_SLUG[widget.form]);
        };

        widget.updateModalExistingFile = function (objectMap, isComplete) {
            var ICONS = widget.mug.form.vellum.data.javaRosa.ICONS,
                $uploaderModal = widget.getUploaderModal(),
                $existingFile = $uploaderModal.find(".hqm-existing");
            if (widget.mediaRef.getUrl() && widget.mediaRef.isMediaMatched()) {
                $existingFile.removeClass('hide');
                $existingFile.find('.hqm-existing-controls').html(getPreviewUI(widget, objectMap, ICONS));
                if (isComplete) {
                    $uploaderModal.find(".hqm-upload-completed").removeClass('hide');
                }
            } else {
                $existingFile.addClass('hide');
                $existingFile.find('.hqm-existing-controls').empty();
            }
            $('.existing-media').tooltip({
                placement: 'bottom',
            });
        };

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

            $uploadContainer.html(multimedia_block());

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
            widget.updateModalExistingFile(objectMap, true);
        };

        widget.updateMultimediaBlockUI = function (objectMap) {
            $previewContainer.html(getPreviewUI(widget, objectMap, ICONS))
                .find('.existing-media').tooltip();

            $uiElem.find('.fd-mm-upload-trigger')
                .empty()
                .append(getUploadButtonUI(widget, objectMap));

            widget.updateReference();
        };

        widget.updateReference = function (path) {
            var currentPath = path || getValue();
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
            mediaType: SLUG_TO_DESCRIPTION[widget.form],
        }));
        $uploadBtn.click(function () {
            widget.mediaRef.updateController(widget);
            var $uploaderModal = widget.getUploaderModal();
            $uploaderModal.find(".hqm-upload-status").empty();
            widget.updateModalExistingFile(objectMap);
        });

        return $uploadBtn;
    };

    $.vellum.plugin("uploader", {
        objectMap: false,
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
                    opts.uploadUrls.image;

            this.data.uploader.uploadEnabled = uploadEnabled;
            this.data.uploader.objectMap = opts.objectMap;
            if (!uploadEnabled) {
                return;
            }

            this.data.uploader.uploadControllers = {
                'image': this.initUploadController({
                    uploaderSlug: 'fd_hqimage',
                    mediaType: 'image',
                    uploadUrl: uploadUrls.image,
                }),
                'audio': this.initUploadController({
                    uploaderSlug: 'fd_hqaudio',
                    mediaType: 'audio',
                    uploadUrl: uploadUrls.audio,
                }),
                'video': this.initUploadController({
                    uploaderSlug: 'fd_hqvideo',
                    mediaType: 'video',
                    uploadUrl: uploadUrls.video,
                }),
                'video-inline': this.initUploadController({
                    uploaderSlug: 'fd_hqInlineVideo',
                    mediaType: 'video-inline',
                    uploadUrl: uploadUrls.video,
                }),
                'text': this.initUploadController({
                    uploaderSlug: 'fd_hqtext',
                    mediaType: 'text',
                    uploadUrl: uploadUrls.text,
                })
            };
        },
        initMediaUploaderWidget: function (widget) {
            this.__callOld();
            if (!this.data.uploader.uploadEnabled) {
                return;
            }

            addUploaderToWidget(widget,
                                this.data.uploader.objectMap,
                                this.data.uploader.uploadControllers);
        },
        initUploadController: function (options) {
            var $uploaderModal = $(multimedia_modal({
                mediaType: options.mediaType,
                modalId: options.uploaderSlug
            }));
            this.$f.find('.fd-multimedia-modal-container').append($uploaderModal);

            // Don't allow user to close modal while server is processing upload
            var allowClose = true;
            $uploaderModal.on('hide.bs.modal', function (event) {
                if (!allowClose) {
                    event.preventDefault();
                }
            });

            var $fileInputTrigger = $uploaderModal.find(".btn-primary"),
                $fileInput = $uploaderModal.find("input[type='file']"),
                $uploadButton = $uploaderModal.find(".hqm-upload-confirm"),
                _updateUploadButton = function (enable, spin) {
                    if (enable) {
                        $uploadButton.removeClass('disabled');
                    } else {
                        $uploadButton.addClass('disabled');
                    }
                    if (spin) {
                        $uploadButton.find(".fa-spin").removeClass("hide");
                        $uploadButton.find(".fa-cloud-arrow-up").addClass("hide");
                    } else {
                        $uploadButton.find(".fa-spin").addClass("hide");
                        $uploadButton.find(".fa-cloud-arrow-up").removeClass("hide");
                    }
                };

            $fileInputTrigger.click(function () {
                $fileInput.click();
            });

            $fileInput.change(function () {
                var MEGABYTE = 1048576,
                    $uploadStatusContainer = $uploaderModal.find(".hqm-upload-status");

                if ($fileInput.get(0).files.length) {
                    var file = $fileInput.get(0).files[0];
                    $uploadStatusContainer.html(_.template(multimedia_upload_status)({
                        file_size: (file.size / MEGABYTE).toFixed(3),
                        file_name: file.name,
                    }));
                    _updateUploadButton(true, false);
                } else {
                    $uploadStatusContainer.empty();
                    _updateUploadButton(false, false);
                }
            });

            var uploadController = {};
            $uploadButton.click(function () {
                _updateUploadButton(false, true);
                allowClose = false;

                var file = $fileInput.get(0).files[0],
                    data = new FormData();
                data.append("Filedata", file);
                uploadController.updateMediaPath();

                var newExtension = '.' + file.name.split('.').pop().toLowerCase();
                uploadController.uploadParams.path = uploadController.uploadParams.path.replace(/(\.[^/.]+)?$/, newExtension);

                _.each(uploadController.uploadParams, function (value, key) {
                    data.append(key, value);
                });

                var $uploadStatusContainer = $uploaderModal.find(".hqm-upload-status");
                $.ajax({
                    url: options.uploadUrl,
                    type: 'POST',
                    data: data,
                    contentType: false,
                    processData: false,
                    enctype: 'multipart/form-data',
                    success: function (response) {
                        response = JSON.parse(response);
                        $('[data-hqmediapath^="' + response.ref.path.replace(/\.\w+$/, ".") + '"]').trigger('mediaUploadComplete', response);
                        $uploadStatusContainer.empty();
                        _updateUploadButton(false, false);
                        allowClose = true;
                    },
                    error: function (response) {
                        response = JSON.parse(response.responseText);
                        $uploadStatusContainer.find(".hqm-error").show();
                        $uploadStatusContainer.find(".hqm-errors").html(_.template(multimedia_errors)({
                            errors: response.errors,
                        }));
                        $uploadStatusContainer.find(".hqm-begin").hide();
                        _updateUploadButton(false, false);
                        allowClose = true;
                    },
                });
            });

            return uploadController;
        },
    });
});
