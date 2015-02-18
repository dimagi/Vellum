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
            var trans = util.getMug("transfer[@type='trans-1']");
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
            var trans = util.addQuestion("Transfer", "trans-1");
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
            var bal = util.getMug("balance[@type='bal-0']");
            assert.equal(bal.p.sectionId, "stock");
            assert.equal(bal.p.quantity, "/data/stock_amount");
            assert.equal(bal.p.entityId.value, "instance('commcaresession')/session/data/case_id");
            assert.equal(bal.p.entryId.value, "instance('commcaresession')/session/data/product_id");
        });

        it("should create a balance block", function () {
            util.loadXML("");
            util.addQuestion("Int", "stock_amount");
            var bal = util.addQuestion("Balance", "bal-0");
            bal.p.sectionId = "stock";
            bal.p.quantity = "/data/stock_amount";
            bal.p.entityId.value = "instance('commcaresession')/session/data/case_id";
            bal.p.entryId.value = "instance('commcaresession')/session/data/product_id";
            bal.form.addInstanceIfNotExists({
                id: "products",
                src: "jr://fixture/commtrack:products"
            });
            bal.form.addInstanceIfNotExists({
                id: "ledger",
                src: "jr://instance/ledgerdb"
            });
            util.assertXmlEqual(call("createXML"), BALANCE_BLOCK_XML,
                                {normalize_xmlns: true});
        });

        it("should create a transfer block in a repeat with jr-insert events", function () {
            util.loadXML();
            util.addQuestion("Repeat", "group");
            var trans = util.addQuestion("Transfer", "trans");
            trans.p.sectionId = "stock";
            trans.p.quantity = "1";
            trans.p.entryId.value = "3";
            trans.p.src.value = "src";
            trans.p.dest.value = "dst";
            var xml = $(util.call("createXML")),
                qty = xml.find("bind[calculate=1]"),
                entry = xml.find("setvalue[value=3]"),
                src = xml.find("setvalue[value=src]"),
                dst = xml.find("setvalue[value=dst]"),
                date = xml.find("setvalue[value='today()']");
            assert.equal(qty.attr("nodeset"),
                "/data/group/transfer[@type='trans']/entry/@quantity");
            assert.equal(entry.attr("ref"),
                "/data/group/transfer[@type='trans']/entry/@id");
            assert.equal(entry.attr("event"), "jr-insert");
            assert.equal(src.attr("event"), "jr-insert");
            assert.equal(dst.attr("event"), "jr-insert");
            assert.equal(date.attr("event"), "jr-insert");
        });

        it("should change setvalue events from xforms-ready to jr-insert on move into repeat", function () {
            util.loadXML(TRANSFER_BLOCK_XML);
            var group = util.addQuestion("Repeat", "group"),
                trans = util.getMug("transfer[@type='trans-1']");
            trans.form.moveMug(trans, group, "into");
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find("setvalue[event=jr-insert]").length, 4, xml);
            assert.equal($xml.find("setvalue[event=xforms-ready]").length, 0, xml);
            assert.equal($xml.find("setvalue").length, 4, xml);
        });

        it("should create two transfer blocks with the same parent node", function () {
            util.loadXML();
            util.addQuestion("Transfer", "t1");
            util.addQuestion("Transfer", "t2");
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find("transfer").length, 2, xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t1\\']/@src']").length, 1, xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t2\\']/@src']").length, 1, xml);
        });
    });
});
