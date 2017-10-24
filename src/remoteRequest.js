/**
 * Remote Request question type plugin
 */
define([
    'jquery',
    'underscore',
    'vellum/mugs',
    'vellum/tree',
    'vellum/util',
    'vellum/widgets',
    'vellum/core'
], function (
    $,
    _,
    mugs,
    Tree,
    util,
    widgets
) {
    var REMOTE_REQUEST_TYPE = "RemoteRequest",
        REMOTE_REQUEST_SECTIONS = [
            {
                slug: "main",
                displayName: gettext("Basic"),
                properties: [
                    "nodeID",
                    "url",
                    "parameters",
                    "comment",
                ],
            },
        ],
        RemoteRequest = util.extend(mugs.defaultOptions, {
            typeName: gettext('Remote Request'),
            dataType: REMOTE_REQUEST_TYPE,
            icon: 'fa fa-globe',
            isDataOnly: true,
            isTypeChangeable: false,
            supportsDataNodeRole: true,
            init: function (mug) {
                mug.p.url = "";
            },
            writeDataNodeXML: function (xmlWriter, mug) {
                mug.form.vellum.data.remoteRequest.requestMugs.push(mug);
            },
            spec: {
                url: {
                    lstring: gettext('URL'),
                    visibility: 'visible',
                    presence: 'required',
                    widget: widgets.text,
                    help: gettext('The URL to be requested on form load.'),
                },
                parameters: {
                    lstring: gettext('Parameters'),
                    visibility: 'visible',
                    presence: 'optional',
                    widget: widgets.xPath,
                    xpathType: "generic",
                    serialize: mugs.serializeXPath,
                    deserialize: mugs.deserializeXPath,
                    help: gettext('Drag a question here. The value of that ' +
                        'question will be used as request parameters.'),
                },
                constraintMsgItext: { presence : "notallowed" },
            },
        });

    $.vellum.plugin("remoteRequest", {}, {
        getMugTypes: function () {
            var types = this.__callOld();
            types.normal.RemoteRequest = RemoteRequest;
            return types;
        },
        getAdvancedQuestions: function () {
            var ret = this.__callOld();
            if (this.opts().features.remote_requests) {
                ret.push(REMOTE_REQUEST_TYPE);
            }
            return ret;
        },
        getSections: function (mug) {
            if (mug.__className === REMOTE_REQUEST_TYPE) {
                return REMOTE_REQUEST_SECTIONS;
            }
            return this.__callOld();
        },
        loadXML: function (xml) {
            var submissions = this.data.remoteRequest.submissions = {},
                head = $(xml).find("h\\:head, head");
            head.find("> model > submission").each(function (i, el) {
                var sub = $(el);
                submissions[sub.attr("id")] = sub;
            });
            this.__callOld();
        },
        handleMugParseFinish: function (mug) {
            var submissions = this.data.remoteRequest.submissions,
                sub;
            if (submissions.hasOwnProperty(mug.absolutePath)) {
                sub = submissions[mug.absolutePath];
                mug.form.changeMugType(mug, REMOTE_REQUEST_TYPE);
                mug.p.url = sub.attr("resource");
                mug.p.parameters = mug.form.normalizeHashtag(
                    sub.attr("vellum:ref") || sub.attr("ref"));
            }
            this.__callOld();
        },
        beforeSerialize: function () {
            this.data.remoteRequest.requestMugs = [];
            this.__callOld();
        },
        contributeToModelXML: function (xmlWriter, form) {
            _.each(this.data.remoteRequest.requestMugs, function (mug) {
                xmlWriter.writeStartElement('submission');
                xmlWriter.writeAttributeString('id', mug.absolutePath);
                xmlWriter.writeAttributeString('method', 'get');
                xmlWriter.writeAttributeString('replace', 'text');
                xmlWriter.writeAttributeString('mode', 'synchronous');
                xmlWriter.writeAttributeString('resource', mug.p.url);
                util.writeHashtags(xmlWriter, 'ref', mug.p.parameters, mug);
                xmlWriter.writeAttributeString('targetref', mug.absolutePath);
                xmlWriter.writeEndElement();
                xmlWriter.writeStartElement('send');
                xmlWriter.writeAttributeString('event', 'xforms-ready');
                xmlWriter.writeAttributeString('submission', mug.absolutePath);
                xmlWriter.writeEndElement();
            });
            this.__callOld();
        },
    });
});
