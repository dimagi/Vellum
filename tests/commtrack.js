define([
    'tests/utils',
    'chai',
    'jquery',
    'vellum/commtrack',
    'text!static/commtrack/balance-block.xml',
    'text!static/commtrack/transfer-block.xml'
], function (
    util,
    chai,
    $,
    commtrack,
    BALANCE_BLOCK_XML,
    TRANSFER_BLOCK_XML
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
            util.loadXML(TRANSFER_BLOCK_XML);
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
            util.assertXmlEqual(call("createXML"), TRANSFER_BLOCK_XML,
                                {normalize_xmlns: true});
        });

        it("should load a balance block", function () {
            util.loadXML(BALANCE_BLOCK_XML);
            var bal = util.getMug("balance");
            assert.equal(bal.p.sectionId, "stock");
            assert.equal(bal.p.quantity, "/data/stock_amount");
            assert.equal(bal.p.entityId.value, "instance('commcaresession')/session/data/case_id");
            assert.equal(bal.p.entryId.value, "instance('commcaresession')/session/data/product_id");
        });

        it("should create a balance block", function () {
            util.loadXML("");
            util.addQuestion("Int", "stock_amount");
            var trans = util.addQuestion("Balance", "balance");
            trans.p.sectionId = "stock";
            trans.p.quantity = "/data/stock_amount";
            trans.p.entityId.value = "instance('commcaresession')/session/data/case_id";
            trans.p.entryId.value = "instance('commcaresession')/session/data/product_id";
            trans.form.addInstanceIfNotExists({
                id: "products",
                src: "jr://fixture/commtrack:products"
            });
            trans.form.addInstanceIfNotExists({
                id: "ledger",
                src: "jr://instance/ledgerdb"
            });
            util.assertXmlEqual(call("createXML"), BALANCE_BLOCK_XML,
                                {normalize_xmlns: true});
        });

        // TODO tests for load/create transfer and balance block in repeat
    });
});
