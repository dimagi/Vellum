define([
    'tests/utils',
    'chai',
    'jquery',
    'underscore',
    'vellum/commtrack',
    'text!static/commtrack/balance-block.xml',
    'text!static/commtrack/balance-block-setvalues.xml',
    'text!static/commtrack/invalid-transfer.xml',
    'text!static/commtrack/transfer-block.xml',
    'text!static/commtrack/transfer-block-setvalues.xml',
], function (
    util,
    chai,
    $,
    _,
    commtrack,
    BALANCE_BLOCK_XML,
    BALANCE_BLOCK_SETVALUES_XML,
    INVALID_TRANSFER_XML,
    TRANSFER_BLOCK_XML,
    TRANSFER_BLOCK_SETVALUES_XML
) {
    var assert = chai.assert,
        call = util.call;

    describe("The CommTrack module", function() {
        before(function (done) {
            util.init({
                javaRosa: {langs: ['en']},
                core: {onReady: done},
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
            assert.equal(trans.p.date, "now()");
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
            assert.equal($xml.find("bind[nodeset='/data/transfer[@type=\\'t1\\']/@src']").length, 1, xml);
            assert.equal($xml.find("bind[nodeset='/data/transfer[@type=\\'t2\\']/@src']").length, 1, xml);
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
            assert.equal($xml.find("bind[nodeset='/data/transfer[@type=\\'t1\\']/@src']").length, 1,
                "unexpected @src bind:\n" + xml);
            assert.equal($xml.find("bind[nodeset='/data/transfer[@type=\\'t1\\']/@dest']").length, 0,
                "unexpected @dest bind:\n" + xml);
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
            assert.equal($xml.find("bind[nodeset='/data/transfer[@type=\\'t1\\']/@src']").length, 0,
                "unexpected @src bind:\n" + xml);
            assert.equal($xml.find("bind[nodeset='/data/transfer[@type=\\'t1\\']/@dest']").length, 1,
                "unexpected @dest bind:\n" + xml);
        });

        it("transfer block with src and dest should load as Transfer question", function () {
            util.loadXML(TRANSFER_BLOCK_XML);
            var mug = util.getMug("transfer[@type='trans-1']");
            assert.equal(mug.__className, "Transfer");
        });

        it("transfer block with dest only should load as Receive question", function () {
            util.loadXML(TRANSFER_BLOCK_XML
                            .replace(' src=""', '')
                            .replace(/<bind [^>]*@src[^>]*\/>/, ''));
            var mug = util.getMug("transfer[@type='trans-1']");
            assert.equal(mug.__className, "Receive");
        });

        it("transfer block with src only should load as Dispense question", function () {
            util.loadXML(TRANSFER_BLOCK_XML
                            .replace(' dest=""', '')
                            .replace(/<bind [^>]*@dest[^>]*\/>/, ''));
            var mug = util.getMug("transfer[@type='trans-1']");
            assert.equal(mug.__className, "Dispense");
        });

        it("should enable save button when a transfer's source or destination changes", function (done) {
            util.loadXML(TRANSFER_BLOCK_XML);
            util.saveButtonEnabled(false);
            util.clickQuestion("transfer[@type='trans-1']");
            var editor = $('[name=property-dest]').ckeditor().editor,
                widget = util.getWidget('property-dest');
            widget.input.promise.then(function () {
                editor.on('change', function() {
                    assert(util.saveButtonEnabled(), "save button is disabled");
                    done();
                });
                editor.fire('change');
            });
        });

        it("transfer quantity should update on reference rename", function () {
            util.loadXML(TRANSFER_BLOCK_XML);
            var rec = util.getMug("amount_received"),
                trans = util.getMug("transfer[@type='trans-1']");

            // HACK change quantity to hashtag path
            // TODO remove this and fix the root issue in LogicManager
            trans.p.quantity = "#form/amount_received";

            rec.p.nodeID = "amount_received_x";
            assert.equal(trans.p.quantity, rec.hashtagPath);
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
        });

        _.each(["Balance", "Transfer"], function (type) {
            it("should change " + type + " setvalues to binds on load+save", function () {
                var trans = type === "Transfer";
                util.loadXML(trans ? TRANSFER_BLOCK_SETVALUES_XML : BALANCE_BLOCK_SETVALUES_XML);
                util.assertXmlEqual(call("createXML"),
                    trans ? TRANSFER_BLOCK_XML : BALANCE_BLOCK_XML,
                    {normalize_xmlns: true});
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

            it("should drop bind and setvalue nodes on delete " + type + " question", function () {
                var trans = type === "Transfer";
                util.loadXML(trans ? TRANSFER_BLOCK_SETVALUES_XML : BALANCE_BLOCK_SETVALUES_XML);
                var question = util.getMug(trans ?
                                            "transfer[@type='trans-1']" :
                                            "balance[@type='bal-0']");
                util.deleteQuestion(question.absolutePath);
                var xml = util.call("createXML"),
                    $xml = $(xml);
                assert.equal($xml.find("bind").filter(function () {
                    return /^\/data\/(balance|transfer)\[/.test($(this).attr("nodeset"));
                }).length, 0, "bind nodes should be removed\n" + xml);
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
                                .replace(/<bind [^>]*@dest[^>]*\/>/, ''),
                    Receive: TRANSFER_BLOCK_XML
                                .replace(' src=""', '')
                                .replace(/<bind [^>]*@src[^>]*\/>/, ''),
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
                    var form = util.loadXML(map[test.from]),
                        mug = util.getMug("transfer[@type='trans-1']"),
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
                        var meta = form.instanceMetadata,
                            i = meta.length - 1;
                        if (meta[i].attributes.id === "casedb") {
                            // swap last two instances to preserve order for XML comparison
                            // https://stackoverflow.com/a/4011851/10840
                            meta[i] = meta.splice(i - 1, 1, meta[i])[0];
                        }
                    }
                    var xml = util.call("createXML");
                    util.assertXmlEqual(xml, map[test.to], {normalize_xmlns: true});
                    util.loadXML(xml);
                    mug = util.getMug("transfer[@type='trans-1']");
                    assert.equal(mug.__className, test.to);
                });
            });
        });
    });
});
