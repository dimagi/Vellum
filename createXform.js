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
    _writeInstanceAttributes(xmlWriter, meta);

    for (var i = 1; i < form.instanceMetadata.length; i++) {
      _writeInstance(xmlWriter, meta);
    }
    //createBindList(dataTree, xmlWriter);
        
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