const sha256 = require('sha256');
const currentNodeUrl = process.argv[3];
const uuid = require('uuid').v1;

function Blockchain() {
    Object.assign(this, {
        chain: [],
        currentNodeUrl,
        networkNodes: [],
        pendingTransactions: [],
    });

    this.createNewBlock(100, '0', '0');
}

Blockchain.prototype.createNewBlock = function (nonce, previousBlockHash, hash) {
    const newBlock = {
        hash,
        index: this.chain.length + 1,
        nonce,
        previousBlockHash,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
    };

    this.pendingTransactions = [];
    this.chain.push(newBlock);

    return newBlock;
}

Blockchain.prototype.getLastBlock = function () {
    return this.chain[this.chain.length - 1];
}

Blockchain.prototype.createNewTransaction = function (amount, sender, recipient) {
    return {
        amount,
        recipient,
        sender,
        transactionId: uuid().split('-').join(''),
    };
}

Blockchain.prototype.addTransactionToPendingTransactions = function (transactionObj) {
    this.pendingTransactions.push(transactionObj);
    return this.getLastBlock().index + 1;
}

Blockchain.prototype.hashBlock = function (previousBlockHash, currentBlockData, nonce) {
    const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
}

Blockchain.prototype.proofOfWork = function (previousBlockHash, currentBlockData) {
    let
        nonce = 0,
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce)
    ;
    while (hash.substring(0, 4) !== '0000') {
        nonce ++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }
    return nonce;
}

Blockchain.prototype.chainIsValid = function (blockchain) {
    for (let i = 1; i < blockchain.length; i ++) {
        const currentBlock = blockchain[i];
        const previousBlock = blockchain[i - 1];
        const blockHash = this.hashBlock(previousBlock.hash, { transactions: currentBlock.transactions, index: currentBlock.index }, currentBlock.nonce);

        const correctPreviousBlockHash = currentBlock.previousBlockHash === previousBlock.hash;
        const correctBlockHashSubstring = blockHash.substring(0, 4) !== '0000';

        if (!correctPreviousBlockHash || !correctBlockHashSubstring) {
            return false;
        }
    }

    const genesisBlock = blockchain[0];
    const correctNonce = genesisBlock.nonce === 100;
    const correctPreviousBlockHash = genesisBlock.previousBlockHash === '0';
    const correctHash = genesisBlock.previousBlockHash === '0';
    const correctTransactions = genesisBlock.transactions.length === 0;

    let validGenesisBlock = correctNonce
        && correctPreviousBlockHash
        && correctHash
        && correctTransactions;

    return validGenesisBlock;
};


module.exports = Blockchain;