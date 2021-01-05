importScripts('node_modules/XMLWriter/XMLWriter.js')
onmessage = function(e) {
    console.log('Worker: Message received from main script');
    console.log(e.data)
    var xmlWriter = new XMLWriter('UTF-8', '1.0');
    var mayDisableRichText = e.data[0];
    var richText = e.data[1];
    var noMarkdown = e.data[2];
    var formName = e.data[3];
    var meta = e.data[4];
    xmlWriter.writeStartDocument();
    // //Generate header boilerplate up to instance level
    xmlWriter.writeStartElement('h:html');
    write_html_tag_boilerplate(xmlWriter, mayDisableRichText, richText, noMarkdown);
    xmlWriter.writeStartElement('h:head');
    xmlWriter.writeStartElement('h:title');
    xmlWriter.writeString(formName);
    xmlWriter.writeEndElement();
    
    xmlWriter.writeStartElement('model');
    xmlWriter.writeStartElement('instance');
    _writeInstanceAttributes(xmlWriter, meta[0]);

    for (var i = 1; i < meta.length; i++) {
      _writeInstance(xmlWriter, meta[i]);
    }
    createBindList(dataTree, xmlWriter);
        
    postMessage("work");
    
    
  }

  function write_html_tag_boilerplate (xmlWriter, mayDisableRichText, richText, noMarkdown) {
    xmlWriter.writeAttributeString( "xmlns:h", "http://www.w3.org/1999/xhtml" );
    xmlWriter.writeAttributeString( "xmlns:orx", "http://openrosa.org/jr/xforms" );
    xmlWriter.writeAttributeString( "xmlns", "http://www.w3.org/2002/xforms" );
    xmlWriter.writeAttributeString( "xmlns:xsd", "http://www.w3.org/2001/XMLSchema" );
    xmlWriter.writeAttributeString( "xmlns:jr", "http://openrosa.org/javarosa" );
    xmlWriter.writeAttributeString( "xmlns:vellum", "http://commcarehq.org/xforms/vellum" );
    var ignore = [];
    if (mayDisableRichText && richText) {
        ignore.push('richText');
    }
    if (noMarkdown) {
        ignore.push('markdown');
    }
    if (ignore.length) {
        xmlWriter.writeAttributeString("vellum:ignore", ignore.join(" "));
    }
}

var _writeInstanceAttributes = function (writer, instanceMetadata) {
  var attrs = instanceMetadata.attributes;
  for (var attrId in attrs) {
      if (attrs.hasOwnProperty(attrId) && attrs[attrId]) {
          writer.writeAttributeString(attrId, attrs[attrId]);
      }
  }
};

var _writeInstance = function (writer, instanceMetadata) {
  if (!instanceMetadata.internal) {
      writer.writeStartElement('instance');
      _writeInstanceAttributes(writer, instanceMetadata);
      if (instanceMetadata.children.length) {
          // seriously, this is what you have to do
          // HT: http://stackoverflow.com/questions/652763/jquery-object-to-string
          writer.writeXML($('<div>').append(instanceMetadata.children).clone().html());
      }
      writer.writeEndElement();
  }
};
function addReference (mug, property) {
  if (!refs) { return; }
  if (!mug) {
      // disable ref counting for this instance. how unfortunate
      refs = null;
  } else {
      if (!refs[mug.ufid]) {
          refs[mug.ufid] = {};
      }
      refs[mug.ufid][property || "."] = null;
  }
};
var createDataBlock = function (form, dataTree, xmlWriter) {
  dataTree.walk(function (mug, nodeID, processChildren) {
      if (mug && mug.options.getTagName) {
          nodeID = mug.options.getTagName(mug, nodeID);
          if (nodeID === null) {
              return;
          }
      }
      xmlWriter.writeStartElement(nodeID);
      if (!mug) {
          // tree root
          createModelHeader(form, xmlWriter);
      } else {
          var rawDataAttributes = mug.p.rawDataAttributes,
              extra = null;
          if (mug.options.getExtraDataAttributes) {
              // call this early so it can munge raw attributes
              extra = mug.options.getExtraDataAttributes(mug);
          }
          // Write any custom attributes first
          for (var k in rawDataAttributes) {
              if (rawDataAttributes.hasOwnProperty(k)) {
                  xmlWriter.writeAttributeString(k, rawDataAttributes[k]);
              }
          }

          var dataValue = mug.p.dataValue,
              xmlnsAttr = mug.p.xmlnsAttr;
          
          if (dataValue){
              xmlWriter.writeString(dataValue);
          }
          if (mug.options.writeDataNodeXML) {
              mug.options.writeDataNodeXML(xmlWriter, mug);
          }
          if (mug.p.comment) {
              xmlWriter.writeAttributeString('vellum:comment', mug.p.comment);
          }
          if (xmlnsAttr){
              xmlWriter.writeAttributeString("xmlns", xmlnsAttr);
          }
          if (extra) {
              for (k in extra) {
                  if (extra.hasOwnProperty(k)) {
                      xmlWriter.writeAttributeString(k, extra[k]);
                  }
              }
          }
      }
      processChildren(mug && mug.options.dataChildFilter);
      xmlWriter.writeEndElement();
  });
};

var createBindList = function (dataTree, xmlWriter) {
  dataTree.walk(function (mug, nodeID, processChildren) {
      if(mug && mug.options.getBindList) {
          _.each(mug.options.getBindList(mug), function (attrs) {
              xmlWriter.writeStartElement('bind');
              _.each(attrs, function (value, key) {
                  if (value) {
                      util.writeHashtags(xmlWriter, key, value, mug);
                  }
              });
              xmlWriter.writeEndElement();
          });
      }
      processChildren();
  });
};

var createSetValues = function (dataTree, form, xmlWriter) {
  function writeSetValue(setValue, mug) {
      xmlWriter.writeStartElement('setvalue');
      xmlWriter.writeAttributeString('event', setValue.event);
      util.writeHashtags(xmlWriter, 'ref', setValue.ref, mug);
      util.writeHashtags(xmlWriter, 'value', setValue.value, mug);
      xmlWriter.writeEndElement();
  }

  _.each(form.getSetValues(), function (sv) { writeSetValue(sv, {form: form}); });

  dataTree.walk(function (mug, nodeID, processChildren) {
      if(mug && mug.options.getSetValues) {
          _.each(mug.options.getSetValues(mug), function (setValue) {
              writeSetValue(setValue, mug);
          });
      }
      processChildren();
  });
};

var createControlBlock = function (form, xmlWriter) {
  form.tree.walk(function (mug, nodeID, processChildren) {
      if(!mug) {
          // root node
          processChildren();
          return;
      }

      var opts = mug.options;
      if (opts.isDataOnly) {
          return;
      }
      if (opts.writesOnlyCustomXML) {
          opts.writeCustomXML(xmlWriter, mug);
          return;
      }

      xmlWriter.writeStartElement(mug.options.tagName.toLowerCase());
      if (opts.writeControlLabel) {
          createLabel(xmlWriter, mug);
      }
      if (opts.writeControlHint) {
          createHint(xmlWriter, mug);
      }
      if (opts.writeControlHelp) {
          createHelp(xmlWriter, mug);
      }
      if (opts.writeControlAlert) {
          createAlert(xmlWriter, mug);
      }
      // Write custom attributes first
      var attributes = mug.p.rawControlAttributes;
      for (var k in attributes) {
          if (attributes.hasOwnProperty(k)) {
              xmlWriter.writeAttributeString(k, attributes[k]);
          }
      }
      if (opts.writeCustomXML) {
          opts.writeCustomXML(xmlWriter, mug);
      }
      if (opts.writeControlRefAttr) {
          var hashtag = mug.hashtagPath;
          util.writeHashtags(xmlWriter, opts.writeControlRefAttr, hashtag, mug);
      }
      var appearanceAttr = mug.getAppearanceAttribute();
      if (appearanceAttr) {
          xmlWriter.writeAttributeString("appearance", appearanceAttr);
      }

      processChildren(opts.controlChildFilter);

      xmlWriter.writeEndElement();
  });
};