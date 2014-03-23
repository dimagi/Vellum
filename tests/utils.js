
function xmlEqual(str1, str2) {
    var xml1 = EquivalentXml.xml(str1),
        xml2 = EquivalentXml.xml(str2);
    return EquivalentXml.isEquivalent(xml1, xml2, {element_order: true});
}

function assertXmlEqual(str1, str2) {
    assert(xmlEqual(str1, str2));
}

function assertXmlNotEqual(str1, str2) {
    assert.isFalse(xmlEqual(str1, str2));
}

// might need to convert this to use a deferred, see
// https://github.com/mwhite/Vellum/commit/423360cd520f27d5fe3b0657984d2e023bf72fb8#diff-74a635be9be46d0f8b20784f5117bb0cR9
function clickQuestion(displayName) {
    // todo: change to use explicit .text() filtering, not :contains()
    var $q = $("li[rel] > a:contains(" + displayName + ")");
   
    if ($q.length !== 1) {
        throw Error("Couldn't find question '" + displayName + "'");
    
    }
    $q.click();
}
