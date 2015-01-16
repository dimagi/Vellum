define([
    'tests/utils',
    'chai',
    'jquery',
    'vellum/commtrack',
    'text!static/commtrack/transfer-block.xml'
], function (
    util,
    chai,
    $,
    commtrack,
    TRANSFER_QUESTION_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The CommTrack module", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done}
            });
        });

        it("should load a transfer block", function () {
            util.loadXML(TRANSFER_QUESTION_XML);
            var trans = util.getMug("transfer");
            assert.equal(trans.p.sectionId, "stock");
            assert.equal(trans.p.quantity, "/data/amount_received");
            assert.equal(trans.p.entryId.value, "instance('commcaresession')/session/data/product_id");
            assert.equal(trans.p.src.value, "instance('commcaresession')/session/data/case_id");
            assert.equal(trans.p.dest.value, "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/index/parent");
            assert.equal(trans.p.date.value, "today()");
        });

        it("should create a transfer block", function () {
            util.loadXML("");
            util.addQuestion("Int", "amount_received");
            var trans = util.addQuestion("Transfer", "transfer");
            trans.p.sectionId = "stock";
            trans.p.quantity = "/data/amount_received";
            trans.p.entryId.value = "instance('commcaresession')/session/data/product_id";
            trans.p.src.value = "instance('commcaresession')/session/data/case_id";
            trans.p.dest.value = "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/index/parent";
            trans.form.addInstanceIfNotExists({
                id: "products",
                src: "jr://fixture/commtrack:products"
            });
            trans.form.addInstanceIfNotExists({
                id: "ledger",
                src: "jr://instance/ledgerdb"
            });
            util.assertXmlEqual(call("createXML"), TRANSFER_QUESTION_XML,
                                {normalize_xmlns: true});
        });
    });
});
