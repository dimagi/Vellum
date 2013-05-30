if (typeof formdesigner === 'undefined') {
    var formdesigner = {};
}

formdesigner.multimedia = (function () {
    "use strict";
    var that = {};

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

    that.MultimediaController = function (uploaderSlug, mediaTypeSlug) {
        var media = {};
        media.uploaderSlug = uploaderSlug;
        media.mediaType = mediaTypeSlug;

        media.getUploadModal = function () {
            _.template($('#fd-template-multimedia-modal').text(), {
                mediaType: media.mediaType,
                modalId: media.uploaderSlug
            });
        };

        media.initUploadController = function () {
            media.uploadController = new HQMediaFileUploadController(media.uploaderSlug, media.mediaType, {
                fileFilters: that.SUPPORTED_EXTENSIONS[media.mediaType],
                uploadURL: formdesigner.multimediaUrls.upload[media.mediaType],
                swfURL: formdesigner.multimediaUrls.swf,
                isMultiFileUpload: false,
                queueTemplate: $('#fd-template-multimedia-queue').text(),
                errorsTemplate: $()
            });
        }

    };

    // make multimedia event capable
    formdesigner.util.eventuality(that);

    return that;
})();
