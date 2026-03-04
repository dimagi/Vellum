import defaultOptions from "../defaultOptions";
import widgets from "vellum/widgets";
import util from "vellum/util";

var AudioField = util.extend(defaultOptions, {
    typeName: gettext('Audio Capture'),
    dataType: 'binary',
    tagName: 'upload',
    icon: 'fcc fcc-fd-audio-capture',
    mediaType: "audio/*",
    canOutputValue: false,
    writeCustomXML: function (xmlWriter, mug) {
        xmlWriter.writeAttributeString("mediatype", mug.options.mediaType);
    },
});

var ImageField = util.extend(AudioField, {
    typeName: gettext('Image Capture'),
    icon: 'fa fa-camera',
    mediaType: "image/*",
    spec: {
        imageSize: {
            lstring: gettext("Image Size"),
            visibility: 'visible',
            widget: widgets.dropdown,
            enabled: function(mug) {
                return mug.options.resize_enabled;
            },
            defaultOptions: [
                { text: gettext("Small"), value: "250" },
                { text: gettext("Medium"), value: "500" },
                { text: gettext("Large"), value: "1000" },
                { text: gettext("Original"), value: "" },
            ],
            help: gettext("This will resize the image before sending the form. " +
                "Use this option to send smaller images in areas of poor " +
                "connectivity.<ul><li>Small - 0.1 megapixels</li><li>" +
                "Medium - 0.2 megapixels</li><li>Large - 0.5 megapixels</li></ul>"),
        }
    },
    writeCustomXML: function (xmlWriter, mug) {
        AudioField.writeCustomXML(xmlWriter, mug);
        if (mug.__className === "Image" && mug.p.imageSize) {
            xmlWriter.writeAttributeString("jr:imageDimensionScaledMax", mug.p.imageSize + "px");
        }
    },
    init: function (mug, form) {
        AudioField.init(mug, form);
        if (mug.p.imageSize !== "") {
            mug.p.imageSize = mug.p.imageSize || 250;
        }
    }
});

var Video = util.extend(AudioField, {
    typeName: gettext('Video Capture'),
    icon: 'fa fa-video-camera',
    mediaType: "video/*",
});

var Signature = util.extend(ImageField, {
    typeName: gettext('Signature Capture'),
    icon: 'fcc fcc-fd-signature',
    spec: {
        imageSize: {
            visibility: 'hidden',
        }
    },
    init: function (mug, form) {
        ImageField.init(mug, form);
        mug.p.appearance = "signature";
    },
    changeTypeTransform: function (mug) {
        mug.p.appearance = undefined;
    },
});

var DocumentField = util.extend(AudioField, {
    typeName: gettext('Document Upload'),
    icon: 'fa fa-file',
    mediaType: "application/*,text/*",
});

export {AudioField, ImageField, Video, Signature, DocumentField};
