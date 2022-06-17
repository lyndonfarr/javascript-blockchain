const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const uuid = require('uuid').v1;
const Blockchain = require('./blockchain');
const port = process.argv[2];
const rp = require('request-promise');

const nodeAddress = uuid().split('-').join('');

const poodle = new Blockchain();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/blockchain', function (req, res) {
    res.send(poodle);
});

app.post('/transaction', function (req, res) {
    const newTransaction = req.body;
    const blockIndex = poodle.addTransactionToPendingTransactions(newTransaction);
    res.json({
        note: `Transaction will be added in block ${blockIndex}`,
    });
});

app.post('/transaction/broadcast', function (req, res) {
    const {amount, recipient, sender} = req.body;
    const newTransaction = poodle.createNewTransaction(amount, sender, recipient);
    poodle.addTransactionToPendingTransactions(newTransaction);

    const requestPromises = poodle.networkNodes
        .map(networkNodeUrl => rp({
            body: newTransaction,
            json: true,
            method: 'POST',
            uri: `${networkNodeUrl}/transaction`,
        }));

    Promise.all(requestPromises)
        .then(data => {
            res.json({
                note: 'Transaction created and broadcast successfully',
            });
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

    poodle.createNewTransaction(12.5, "00", nodeAddress);

    const newBlock = poodle.createNewBlock(nonce, previousBlockHash, blockHash);
    res.json({
        block: newBlock,
        note: `New block mined successfully`,
    });
});

app.post('/register-and-broadcast-node', function (req, res) {
    const {newNodeUrl} = req.body;
    if (!poodle.networkNodes.includes(newNodeUrl)) poodle.networkNodes.push(newNodeUrl);

    const registerNodesPromises = poodle.networkNodes
        .map(networkNodeUrl => rp({
            body: {
                newNodeUrl,
            },
            json: true,
            method: 'POST',
            uri: `${networkNodeUrl}/register-node`,
        }));

    Promise.all(registerNodesPromises)
        .then(data => {
            const bulkRegisterOptions = {
                body: {
                    allNetworkNodes: [...poodle.networkNodes, poodle.currentNodeUrl],
                },
                json: true,
                method: 'POST',
                uri: `${newNodeUrl}/register-nodes-bulk`,
            };

            rp(bulkRegisterOptions);
        })
        .then(data => {
            res.json({
                note: 'New node registered with network successfully',
            });
        });
});

app.post('/register-node', function (req, res) {
    const {newNodeUrl} = req.body;
    
    const nodeNotAlreadyPresent = !poodle.networkNodes.includes(newNodeUrl);
    const notCurrentNode = poodle.currentNodeUrl !== newNodeUrl;

    if (nodeNotAlreadyPresent && notCurrentNode) poodle.networkNodes.push(newNodeUrl);
    res.json({
        note: 'New node registered successfully',
    });
});

app.post('/register-nodes-bulk', function (req, res) {
    const {allNetworkNodes} = req.body;
    allNetworkNodes
        .filter(networkNodeUrl => !poodle.networkNodes.includes(networkNodeUrl) && poodle.currentNodeUrl !== networkNodeUrl)
        .forEach(networkNodeUrl => poodle.networkNodes.push(networkNodeUrl));

    res.json({
        note: 'Bulk registration successful',
    });
});

app.listen(port, function () {
    console.log(`Listening on port ${port}`);
});