const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');

const poodle = new Blockchain();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/blockchain', function (req, res) {
    res.send(poodle);
});

app.post('/transaction', function (req, res) {
    const {amount, sender, recipient} = req.body;
    const blockIndex = poodle.createNewTransaction(amount, sender, recipient);

    res.json({
        note: `Transaction will be added in block ${blockIndex}.`
    });
});

app.get('/mine', function (req, res) {
    const lastBlock = poodle.getLastBlock();
    const previousBlockHash = lastBlock.hash;
    const currentBlockData = {
        index: lastBlock.index + 1,
        transactions: poodle.pendingTransactions,
    };
    const nonce = poodle.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = poodle.hashBlock(previousBlockHash, currentBlockData, nonce);

    // poodle.createNewTransaction(12.5, "00", );

    const newBlock = poodle.createNewBlock(nonce, previousBlockHash, blockHash);
    res.json({
        block: newBlock,
        note: `New block mined successfully`,
    });
});

app.listen(3000, function () {
    console.log('Listening on port 3000');
});