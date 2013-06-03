if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.multimedia = (function () {
    "use strict";
    var that = {};

    that.SUPPORTED_MEDIA_TYPES = ['image', 'audio', 'video'];

    that.SUPPORTED_EXTENSIONS = {
        image: [
            {
                'description': 'Images',
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
                'extensions': '*.3gp'
            }
        ]
    };

    that.DEFAULT_EXTENSIONS = {
        image: 'png',
        audio: 'mp3',
        video: '3gp'
    };

    that.ICONS = {
        image: 'icon-picture',
        audio: 'icon-volume-up',
        video: 'icon-facetime-video'
    };

    that.PREVIEW_TEMPLATES = {
        image: '#fd-template-multimedia-existing-image',
        audio: '#fd-template-multimedia-existing-audio',
        video: '#fd-template-multimedia-existing-video'
    };

    that.SLUG_TO_CLASS = {
        image: 'CommCareImage',
        audio: 'CommCareAudio',
        video: 'CommCareVideo'
    };

    function MultimediaController (uploaderSlug, mediaTypeSlug) {
        var media = this;
        media.uploaderSlug = uploaderSlug;
        media.mediaType = mediaTypeSlug;

        media.getUploadModal = function () {
            return _.template($('#fd-template-multimedia-modal').text(), {
                mediaType: media.mediaType,
                modalId: media.uploaderSlug
            });
        };

        media.initUploadController = function () {
            var $uploaderModal = $(media.getUploadModal());
            $('#fd-multimedia-modal-container').append($uploaderModal);
            media.uploadController = new formdesigner.multimediaConfig.uploadControllerClass(media.uploaderSlug, media.mediaType, {
                fileFilters: that.SUPPORTED_EXTENSIONS[media.mediaType],
                uploadURL: formdesigner.multimediaConfig.uploadUrls[media.mediaType],
                swfURL: formdesigner.multimediaConfig.swfURL,
                isMultiFileUpload: false,
                queueTemplate: $('#fd-template-multimedia-queue').text(),
                errorsTemplate: $('#fd-template-multimedia-errors').text(),
                existingFileTemplate: $(that.PREVIEW_TEMPLATES[media.mediaType]).text(),
                licensingParams: ['shared', 'license', 'author', 'attribution-notes'],
                uploadParams: {}
            });
            media.uploadController.init();
        };
    }

    that.objectMap = {};

    that.initControllers = function () {
        that.isUploadEnabled = _.isObject(formdesigner.multimediaConfig);
        if (that.isUploadEnabled) {
            that.imageControl = new MultimediaController('fd_hqimage', 'image');
            that.imageControl.initUploadController();

            that.audioControl = new MultimediaController('fd_hqaudio', 'audio');
            that.audioControl.initUploadController();

            that.videoControl = new MultimediaController('fd_hqvideo', 'video');
            that.videoControl.initUploadController();

            that.SLUG_TO_CONTROL = {
                'image': that.imageControl,
                'audio': that.audioControl,
                'video': that.videoControl
            };

            that.objectMap = formdesigner.multimediaConfig.objectMap;
        }
    };

    that.multimediaReference = function (mediaType) {
        var ref = {};
        ref.mediaType = mediaType;

        ref.updateRef = function (path) {
            ref.path = path;
            ref.linkedObj = that.objectMap[path];
        };

        ref.getUrl = function () {
            return ref.linkedObj.url;
        };

        ref.isMediaMatched = function () {
            return _.isObject(ref.linkedObj);
        };

        ref.updateController = function () {
            var uploadController = formdesigner.multimedia.SLUG_TO_CONTROL[ref.mediaType].uploadController;
            uploadController.resetUploader();
            uploadController.currentReference = ref;
            uploadController.uploadParams = {
                path: ref.path,
                media_type : formdesigner.multimedia.SLUG_TO_CLASS[ref.mediaType],
                old_ref: (ref.isMediaMatched()) ? ref.linkedObj.m_id : "",
                replace_attachment: true
            };
            uploadController.updateUploadFormUI();
        };

        return ref;
    };

    return that;
})();
