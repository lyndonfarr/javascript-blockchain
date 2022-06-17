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

    Promise
        .all(requestPromises)
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

    const newBlock = poodle.createNewBlock(nonce, previousBlockHash, blockHash);

    const requestPromises = poodle.networkNodes
        .map(networkNodeUrl => rp({
            body: {
                newBlock,
            },
            json: true,
            method: 'POST',
            uri: `${networkNodeUrl}/receive-new-block`,
        }));

    Promise
        .all(requestPromises)
        .then(data => rp({
            body: {
                amount: 12.5,
                recipient: nodeAddress,
                sender: "00",
            },
            json: true,
            method: 'POST',
            uri: `${poodle.currentNodeUrl}/transaction/broadcast`,
        }))
        .then(data => {
            res.json({
                block: newBlock,
                note: `New block mined and broadcast successfully`,
            });
        });
});

app.post('/receive-new-block', function (req, res) {
    const {newBlock} = req.body;
    const lastBlock = poodle.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock.index + 1 === newBlock.index;

    if (correctHash && correctIndex) {
        poodle.chain.push(newBlock);
        poodle.pendingTransactions = [];
        res.json({
            newBlock,
            note: 'New block received and accepted.',
        });
    } else {
        res.json({
            newBlock,
            note: 'New block rejected.',
        });
    }
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

    Promise
        .all(registerNodesPromises)
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

app.get('/consensus', function (req, res) {
    const requestPromises = poodle.networkNodes
        .map(networkNodeUrl => rp({
            json: true,
            method: 'GET',
            uri: `${networkNodeUrl}/blockchain`,
        }));
    
    Promise
        .all(requestPromises)
        .then(blockchains => {
            const currentChainLength = poodle.chain.length;
            let
                maxChainLength = currentChainLength,
                newLongestChain = null,
                newPendingTransactions = null
            ;
            blockchains
                .forEach(blockchain => {
                    if (blockchain.chain.length > maxChainLength) {
                        maxChainLength = blockchain.chain.length;
                        newLongestChain = blockchain.chain;
                        newPendingTransactions = blockchain.pendingTransactions;
                    }
                });

            if (!newLongestChain || (newLongestChain && !poodle.chainIsValid(newLongestChain))) {
                res.json({
                    chain: poodle.chain,
                    note: 'Current chain has not been replaced',
                });
            } else {
                poodle.chain = newLongestChain;
                poodle.pendingTransactions = newPendingTransactions;

                res.json({
                    chain: poodle.chain,
                    note: 'This chain has been replaced',
                })
            }
        });
});


app.get('/block/:blockHash', function (req, res) {
    const {blockHash} = req.params;
    const block = poodle.getBlock(blockHash);
    res.json({
        block,
    });
});

app.get('/transaction/:transactionId', function (req, res) {
    const {transactionId} = req.params;
    const {block, transaction} = poodle.getTransaction(transactionId);
    res.json({
        block,
        transaction,
    });
});

app.get('/address/:address', function (req, res) {

});

app.listen(port, function () {
    console.log(`Listening on port ${port}`);
});