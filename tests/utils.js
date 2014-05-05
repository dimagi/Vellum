
var assertXmlEqual = function (str1, str2) {
    var xml1 = EquivalentXml.xml(str1),
        xml2 = EquivalentXml.xml(str2);
    assert(EquivalentXml.isEquivalent(xml1, xml2, {element_order: true}));
};
