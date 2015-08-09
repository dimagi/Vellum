define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/commtrack',
    'text!static/commtrack/balance-block.xml',
    'text!static/commtrack/invalid-transfer.xml',
    'text!static/commtrack/transfer-block.xml'
], function (
    util,
    chai,
    $,
    _,
    commtrack,
    BALANCE_BLOCK_XML,
    INVALID_TRANSFER_XML,
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
            assert.equal(trans.p.entryId, "instance('commcaresession')/session/data/product_id");
            assert.equal(trans.p.src, "instance('commcaresession')/session/data/case_id");
            assert.equal(trans.p.dest, "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/index/parent");
            assert.equal(trans.p.date, "/data/meta/timeEnd");
            assert.equal(trans.p.relevantAttr, "true()");
        });

        it("should create a transfer block", function () {
            util.loadXML("");
            util.addQuestion("Int", "amount_received");
            var trans = util.addQuestion("Transfer", "trans-1");
            trans.p.sectionId = "stock";
            trans.p.quantity = "/data/amount_received";
            trans.p.entryId = "instance('commcaresession')/session/data/product_id";
            trans.p.src = "instance('commcaresession')/session/data/case_id";
            trans.p.dest = "instance('casedb')/casedb/case[@case_id=instance('commcaresession')/session/data/case_id]/index/parent";
            trans.p.relevantAttr = "true()";
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
            assert.equal(bal.p.entityId, "instance('commcaresession')/session/data/case_id");
            assert.equal(bal.p.entryId, "instance('commcaresession')/session/data/product_id");
            assert.equal(bal.p.relevantAttr, "/data/stock_amount != 0");
        });

        it("should create a balance block", function () {
            util.loadXML("");
            util.addQuestion("Int", "stock_amount");
            var bal = util.addQuestion("Balance", "bal-0");
            bal.p.sectionId = "stock";
            bal.p.quantity = "/data/stock_amount";
            bal.p.entityId = "instance('commcaresession')/session/data/case_id";
            bal.p.entryId = "instance('commcaresession')/session/data/product_id";
            bal.p.relevantAttr = "/data/stock_amount != 0";
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
            trans.p.entryId = "3";
            trans.p.src = "src";
            trans.p.dest = "dst";
            var xml = $(util.call("createXML")),
                qty = xml.find("bind[calculate=1]"),
                entry = xml.find("setvalue[value=3]"),
                src = xml.find("setvalue[value=src]"),
                dst = xml.find("setvalue[value=dst]"),
                date = xml.find("setvalue[value='/data/meta/timeEnd']");
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
            trans.form.moveMug(trans, "into", group);
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find("setvalue[event=jr-insert]").length, 4, xml);
            assert.equal($xml.find("setvalue[event=xforms-ready]").length, 0, xml);
            assert.equal($xml.find("setvalue").length, 4, xml);
        });

        it("transfer question should not be valid when src and dest are both empty", function () {
            util.loadXML();
            var trans = util.addQuestion("Transfer", "t1");
            assert.strictEqual(trans.p.src, "");
            assert.strictEqual(trans.p.dest, "");
            trans.validate(); // normally called by widget.handleChange
            assert(!util.isTreeNodeValid(trans),
                "Transfer question with empty src and dest should be invalid");
            assert(trans.messages.get("src").length, "src should have messages");
            assert(trans.messages.get("dest").length, "dest should have messages");
        });

        it("new transfer question should not have validation errors", function () {
            util.loadXML();
            var trans = util.addQuestion("Transfer", "t1");
            assert.strictEqual(trans.p.src, "");
            assert.strictEqual(trans.p.dest, "");
            assert.deepEqual(util.getMessages(trans), "");
        });

        it("should show error icon in tree on load invalid transfer question", function () {
            util.loadXML(INVALID_TRANSFER_XML);
            var trans = util.getMug("transfer[@type='trans']");
            assert(!util.isTreeNodeValid(trans), "tree node should not be valid");
        });

        it("should create two transfer blocks with the same parent node", function () {
            util.loadXML();
            util.addQuestion("Transfer", "t1").p.src = "value";
            util.addQuestion("Transfer", "t2").p.src = "value";
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find("transfer").length, 2, xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t1\\']/@src']").length, 1, xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t2\\']/@src']").length, 1, xml);
        });

        describe("transfer question", function () {
            var trans;
            before(function () {
                util.loadXML();
                trans = util.addQuestion("Transfer", "t1");
            });

            it("with missing src and dest should not be valid", function () {
                trans.p.src = "";
                trans.p.dest = "";
                trans.validate();
                assert.notDeepEqual(trans.getErrors(), [],
                    "Transfer with missing src should not be valid");
            });

            it("with missing src should not be valid", function () {
                trans.p.src = "";
                trans.p.dest = "something";
                trans.validate();
                assert.notDeepEqual(trans.getErrors(), [],
                    "Transfer with missing src should not be valid");
            });

            it("with missing dest should not be valid", function () {
                trans.p.src = "something";
                trans.p.dest = "";
                trans.validate();
                assert.notDeepEqual(trans.getErrors(), [],
                    "Transfer with missing dest should not be valid");
            });

            it("with both src and dest should be valid", function () {
                trans.p.src = "something";
                trans.p.dest = "something";
                trans.validate();
                assert.deepEqual(trans.getErrors(), []);
            });
        });

        it("dispense question should omit dest", function () {
            util.loadXML();
            var mug = util.addQuestion("Dispense", "t1");
            mug.p.src = "something";
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.strictEqual($xml.find("transfer[type='t1']").attr("src"), "",
                "unexpected transfer src attribute\n" + xml);
            assert.isUndefined($xml.find("transfer[type='t1']").attr("dest"),
                "unexpected transfer dest attribute\n" + xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t1\\']/@src']").length, 1,
                "unexpected @src setvalue:\n" + xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t1\\']/@dest']").length, 0,
                "unexpected @dest setvalue:\n" + xml);
        });

        it("receive question should omit src", function () {
            util.loadXML();
            var mug = util.addQuestion("Receive", "t1");
            mug.p.dest = "something";
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.isUndefined($xml.find("transfer[type='t1']").attr("src"),
                "unexpected transfer src attribute\n" + xml);
            assert.strictEqual($xml.find("transfer[type='t1']").attr("dest"), "",
                "unexpected transfer dest attribute\n" + xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t1\\']/@src']").length, 0,
                "unexpected @src setvalue:\n" + xml);
            assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'t1\\']/@dest']").length, 1,
                "unexpected @dest setvalue:\n" + xml);
        });

        it("transfer block with src and dest should load as Transfer question", function () {
            util.loadXML(TRANSFER_BLOCK_XML);
            var mug = util.getMug("transfer[@type='trans-1']");
            assert.equal(mug.__className, "Transfer");
        });

        it("transfer block with dest only should load as Receive question", function () {
            util.loadXML(TRANSFER_BLOCK_XML
                            .replace(' src=""', '')
                            .replace(/<setvalue [^>]*@src[^>]*\/>/, ''));
            var mug = util.getMug("transfer[@type='trans-1']");
            assert.equal(mug.__className, "Receive");
        });

        it("transfer block with src only should load as Dispense question", function () {
            util.loadXML(TRANSFER_BLOCK_XML
                            .replace(' dest=""', '')
                            .replace(/<setvalue [^>]*@dest[^>]*\/>/, ''));
            var mug = util.getMug("transfer[@type='trans-1']");
            assert.equal(mug.__className, "Dispense");
        });

        it("should enable save button when a transfer's source or destination changes", function () {
            util.loadXML(TRANSFER_BLOCK_XML);
            util.saveButtonEnabled(false);
            util.clickQuestion("transfer[@type='trans-1']");
            $("input[name='property-dest']").change();
            assert(util.saveButtonEnabled(), "save button is disabled");
        });

        _.each(["Balance", "Transfer", "Dispense", "Receive"], function (type) {
            it("should add ledger instance on add " + type + " question", function () {
                util.loadXML("");
                util.addQuestion(type, "question");
                var xml = util.call("createXML"),
                    $xml = $(xml);
                assert.equal($xml.find("instance[src='jr://instance/ledgerdb']").length, 1,
                             "wrong ledger instance count\n" + xml);
            });

            it("should remove ledger instance on delete " + type + " question", function () {
                util.loadXML("");
                var question = util.addQuestion(type, "question");
                util.deleteQuestion(question.absolutePath);
                var xml = util.call("createXML"),
                    $xml = $(xml);
                assert.equal($xml.find("instance[src='jr://instance/ledgerdb']").length, 0,
                             "ledger instance should be removed\n" + xml);
            });

            it("should remove ledger instance on delete " + type + " loaded from XML", function () {
                var trans = type === "Transfer";
                util.loadXML(trans ? TRANSFER_BLOCK_XML : BALANCE_BLOCK_XML);
                var question = util.getMug(trans ?
                                            "transfer[@type='trans-1']" :
                                            "balance[@type='bal-0']");
                util.deleteQuestion(question.absolutePath);
                var xml = util.call("createXML"),
                    $xml = $(xml);
                assert.equal($xml.find("instance[src='jr://instance/ledgerdb']").length, 0,
                             "ledger instance should be removed\n" + xml);
            });

            it("should drop setvalue nodes on delete " + type + " question", function () {
                var trans = type === "Transfer";
                util.loadXML(trans ? TRANSFER_BLOCK_XML : BALANCE_BLOCK_XML);
                var question = util.getMug(trans ?
                                            "transfer[@type='trans-1']" :
                                            "balance[@type='bal-0']");
                util.deleteQuestion(question.absolutePath);
                var xml = util.call("createXML"),
                    $xml = $(xml);
                assert.equal($xml.find("setvalue").length, 0,
                             "setvalue nodes should be removed\n" + xml);
            });
        });

        it("should not remove ledger instance on delete second Transfer question", function () {
            util.loadXML("");
            util.addQuestion("Transfer", "trans");
            var question = util.addQuestion("Transfer", "question");
            util.deleteQuestion(question.absolutePath);
            var xml = util.call("createXML"),
                $xml = $(xml);
            assert.equal($xml.find("instance[src='jr://instance/ledgerdb']").length, 1,
                         "ledger instance should be removed\n" + xml);
        });

        it("should show 'Case' property for Balance", function () {
            util.loadXML("");
            util.addQuestion("Balance", "bal");
            assert.equal($("[name=property-entityId]").length, 1);
        });

        describe("should properly encode", function () {
            var map = {
                    Transfer: TRANSFER_BLOCK_XML,
                    Dispense: TRANSFER_BLOCK_XML
                                .replace(' dest=""', '')
                                .replace(/<setvalue [^>]*@dest[^>]*\/>/, ''),
                    Receive: TRANSFER_BLOCK_XML
                                .replace(' src=""', '')
                                .replace(/<setvalue [^>]*@src[^>]*\/>/, ''),
                };
            _.each([
                {from: "Transfer", to: "Dispense"},
                {from: "Transfer", to: "Receive"},
                {from: "Dispense", to: "Transfer"},
                {from: "Dispense", to: "Receive"},
                {from: "Receive", to: "Transfer"},
                {from: "Receive", to: "Dispense"},
            ], function (test) {
                it(test.from + " changed to " + test.to, function () {
                    util.loadXML(map[test.from]);
                    var mug = util.getMug("transfer[@type='trans-1']"),
                        hasSrc = test.to === "Transfer" || test.to === "Dispense",
                        hasDest = test.to === "Transfer" || test.to === "Receive";
                    assert.equal(mug.__className, test.from);
                    call("changeMugType", mug, test.to);
                    if (hasSrc) {
                        mug.p.src = "instance('commcaresession')/session/data/case_id";
                    }
                    if (hasDest) {
                        mug.p.dest = "instance('casedb')/casedb/case[@case_id=" +
                            "instance('commcaresession')/session/data/case_id]/index/parent";
                    }
                    var xml = util.call("createXML"),
                        $xml = $(xml);
                    // Verifying by looking for values in XML rather than
                    // comparing created XML to map[test.to] because order of
                    // setvalues changes. This order changing thing may be a
                    // problem because setvalue nodes are evaluated in document
                    // order.
                    assert.strictEqual($xml.find("transfer[type='trans-1']").attr("src"),
                        hasSrc ? "" : undefined,
                        "unexpected transfer src attribute\n" + xml);
                    assert.strictEqual($xml.find("transfer[type='trans-1']").attr("dest"),
                        hasDest ? "" : undefined,
                        "unexpected transfer dest attribute\n" + xml);
                    assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'trans-1\\']/@src']").length,
                        hasSrc ? 1 : 0,
                        "unexpected @src setvalue:\n" + xml);
                    assert.equal($xml.find("setvalue[ref='/data/transfer[@type=\\'trans-1\\']/@dest']").length,
                        hasDest ? 1 : 0,
                        "unexpected @dest setvalue:\n" + xml);
                    util.loadXML(xml);
                    mug = util.getMug("transfer[@type='trans-1']");
                    assert.equal(mug.__className, test.to);
                });
            });
        });
    });
});
