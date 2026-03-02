/**
 * @file intent-poc.js
 * @description POC — Intent-based cross-chain NFT transfers via LayerZero V2.
 *
 * Three modes (set MODE env var):
 *   sign    - Owner signs an intent off-chain
 *   fill    - Solver fills a signed intent on-chain
 *   cancel  - Owner cancels an unfilled intent
 *
 * Usage:
 *   # 1. Owner creates + signs an intent
 *   MODE=sign TOKEN_ID=42 DST_CHAIN=baseSepolia RECEIVER=0x… \
 *     npx hardhat run scripts/intent-poc.js --network sepolia
 *
 *   # 2. Solver fills the intent (paste sig from step 1)
 *   MODE=fill ENGINE=0x… INTENT_JSON='{"tokenId":42,…}' SIG=0x… \
 *     npx hardhat run scripts/intent-poc.js --network sepolia
 *
 *   # 3. Owner cancels
 *   MODE=cancel ENGINE=0x… INTENT_JSON='{"tokenId":42,…}' \
 *     npx hardhat run scripts/intent-poc.js --network sepolia
 *
 * Required env vars per mode:
 *   sign:   TOKEN_ID, DST_CHAIN, RECEIVER, MAX_FEE_ETH (optional, default 0.01)
 *           EXPIRY_SEC (optional, default 3600)
 *   fill:   ENGINE, INTENT_JSON, SIG
 *   cancel: ENGINE, INTENT_JSON
 */

"use strict";

const { ethers } = require("hardhat");
const { getEid, isTestnet, explorerTxLink, lzScanLink } = require("./crosschain/constants");

// ─── EIP-712 Domain + Type ────────────────────────────────────────────────────

const INTENT_TYPES = {
    CrossChainIntent: [
        { name: "tokenId",  type: "uint256" },
        { name: "dstEid",   type: "uint32"  },
        { name: "receiver", type: "address" },
        { name: "maxFee",   type: "uint256" },
        { name: "nonce",    type: "uint256" },
        { name: "expiry",   type: "uint256" },
    ],
};

function buildDomain(chainId, engineAddress) {
    return {
        name:              "CryptoPunksIntentEngine",
        version:           "1",
        chainId,
        verifyingContract: engineAddress,
    };
}

// ─── ABI Fragments ────────────────────────────────────────────────────────────

const ENGINE_ABI = [
    "function fillIntent((uint256 tokenId, uint32 dstEid, address receiver, uint256 maxFee, uint256 nonce, uint256 expiry) intent, bytes sig) payable",
    "function cancelIntent((uint256 tokenId, uint32 dstEid, address receiver, uint256 maxFee, uint256 nonce, uint256 expiry) intent)",
    "function quoteIntentFee((uint256 tokenId, uint32 dstEid, address receiver, uint256 maxFee, uint256 nonce, uint256 expiry) intent) view returns (uint256)",
    "function nonceStatus(address user, uint256 nonce) view returns (uint8)",
    "function intentDigest((uint256 tokenId, uint32 dstEid, address receiver, uint256 maxFee, uint256 nonce, uint256 expiry) intent) view returns (bytes32)",
    "event IntentFilled(bytes32 indexed intentHash, address indexed user, address indexed solver, uint256 tokenId, uint32 dstEid, uint256 lzFee, uint256 solverBounty, bytes32 lzGuid)",
];

const STATUS_LABELS = ["Pending", "Filled", "Cancelled", "Expired"];

// ─── Mode: sign ───────────────────────────────────────────────────────────────

async function signIntent() {
    const [signer] = await ethers.getSigners();
    const network  = await ethers.provider.getNetwork();

    const tokenId   = Number(process.env.TOKEN_ID);
    const dstChain  = process.env.DST_CHAIN;
    const receiver  = process.env.RECEIVER;
    const maxFeeEth = process.env.MAX_FEE_ETH ?? "0.01";
    const expirySec = Number(process.env.EXPIRY_SEC ?? 3600);

    if (!tokenId || !dstChain || !receiver) {
        throw new Error("Set TOKEN_ID, DST_CHAIN, RECEIVER");
    }

    const dstEid   = getEid(dstChain);
    const maxFee   = ethers.parseEther(maxFeeEth);
    const nonce    = Date.now();                         // simple unique nonce
    const expiry   = Math.floor(Date.now() / 1000) + expirySec;
    const engineAddress = process.env.ENGINE ?? ethers.ZeroAddress; // can be zero for dry-run signing

    const intent = { tokenId, dstEid, receiver, maxFee, nonce, expiry };
    const domain  = buildDomain(Number(network.chainId), engineAddress);

    console.log();
    console.log("=".repeat(60));
    console.log("  Intent Signing (EIP-712)");
    console.log("=".repeat(60));
    console.log(`  Signer      : ${signer.address}`);
    console.log(`  Token ID    : #${tokenId}`);
    console.log(`  Dst chain   : ${dstChain} (eID ${dstEid})`);
    console.log(`  Receiver    : ${receiver}`);
    console.log(`  Max fee     : ${maxFeeEth} ETH`);
    console.log(`  Nonce       : ${nonce}`);
    console.log(`  Expiry      : ${new Date(expiry * 1000).toISOString()}`);
    console.log("=".repeat(60));

    const sig = await signer.signTypedData(domain, INTENT_TYPES, intent);

    const output = {
        intent: { ...intent, maxFee: maxFee.toString() },
        sig,
        signer: signer.address,
        chainId: Number(network.chainId),
        signedAt: new Date().toISOString(),
    };

    console.log();
    console.log("  Signed intent (pass this to the solver):");
    console.log();
    console.log(JSON.stringify(output, null, 2));
    console.log();
    console.log("  Fill command:");
    console.log(`    MODE=fill ENGINE=<engine-address> SIG=${sig} \\`);
    console.log(`    INTENT_JSON='${JSON.stringify({ ...intent, maxFee: maxFee.toString() })}' \\`);
    console.log(`    npx hardhat run scripts/intent-poc.js --network <network>`);
    console.log();

    return output;
}

// ─── Mode: fill ───────────────────────────────────────────────────────────────

async function fillIntent() {
    const [solver] = await ethers.getSigners();
    const network  = await ethers.provider.getNetwork();
    const testnet  = isTestnet((await ethers.provider.getNetwork()).name);

    const engineAddress = process.env.ENGINE;
    const intentJson    = process.env.INTENT_JSON;
    const sig           = process.env.SIG;

    if (!engineAddress || !intentJson || !sig) {
        throw new Error("Set ENGINE, INTENT_JSON, SIG");
    }

    const raw    = JSON.parse(intentJson);
    const intent = {
        tokenId:  Number(raw.tokenId),
        dstEid:   Number(raw.dstEid),
        receiver: raw.receiver,
        maxFee:   BigInt(raw.maxFee),
        nonce:    Number(raw.nonce),
        expiry:   Number(raw.expiry),
    };

    const engine = new ethers.Contract(engineAddress, ENGINE_ABI, solver);

    // Pre-flight: check nonce status
    const status = await engine.nonceStatus(raw.signer ?? ethers.ZeroAddress, intent.nonce);
    if (status !== 0n) {
        console.error(`Intent is already ${STATUS_LABELS[Number(status)]}`);
        process.exit(1);
    }

    // Quote actual fee
    const actualFee = await engine.quoteIntentFee(intent);

    console.log();
    console.log("=".repeat(60));
    console.log("  Filling Intent");
    console.log("=".repeat(60));
    console.log(`  Solver      : ${solver.address}`);
    console.log(`  Engine      : ${engineAddress}`);
    console.log(`  Token ID    : #${intent.tokenId}`);
    console.log(`  Dst eID     : ${intent.dstEid}`);
    console.log(`  Receiver    : ${intent.receiver}`);
    console.log(`  Actual fee  : ${ethers.formatEther(actualFee)} ETH`);
    console.log(`  Max fee     : ${ethers.formatEther(intent.maxFee)} ETH`);
    console.log(`  Bounty est  : ${ethers.formatEther(intent.maxFee - actualFee)} ETH`);
    console.log("=".repeat(60));

    const tx = await engine.fillIntent(intent, sig, { value: actualFee });
    console.log(`  TX hash     : ${tx.hash}`);
    console.log(`  Explorer    : ${explorerTxLink((await ethers.provider.getNetwork()).name, tx.hash)}`);
    console.log(`  LZ Scan     : ${lzScanLink(tx.hash, testnet)}`);
    console.log("  Waiting for confirmation…");

    const receipt = await tx.wait();
    const filled  = receipt.logs
        .map((l) => { try { return engine.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "IntentFilled");

    console.log(`  Confirmed   : block ${receipt.blockNumber}`);
    if (filled) {
        console.log(`  LZ GUID     : ${filled.args.lzGuid}`);
        console.log(`  Bounty paid : ${ethers.formatEther(filled.args.solverBounty)} ETH`);
    }
    console.log("=".repeat(60));
    console.log();
}

// ─── Mode: cancel ─────────────────────────────────────────────────────────────

async function cancelIntent() {
    const [owner] = await ethers.getSigners();

    const engineAddress = process.env.ENGINE;
    const intentJson    = process.env.INTENT_JSON;
    if (!engineAddress || !intentJson) throw new Error("Set ENGINE, INTENT_JSON");

    const raw    = JSON.parse(intentJson);
    const intent = {
        tokenId:  Number(raw.tokenId),
        dstEid:   Number(raw.dstEid),
        receiver: raw.receiver,
        maxFee:   BigInt(raw.maxFee),
        nonce:    Number(raw.nonce),
        expiry:   Number(raw.expiry),
    };

    const engine = new ethers.Contract(engineAddress, ENGINE_ABI, owner);
    const tx     = await engine.cancelIntent(intent);

    console.log(`Cancelling intent nonce=${intent.nonce}…`);
    await tx.wait();
    console.log(`Cancelled. TX: ${tx.hash}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const mode = (process.env.MODE ?? "sign").toLowerCase();

    if      (mode === "sign")   await signIntent();
    else if (mode === "fill")   await fillIntent();
    else if (mode === "cancel") await cancelIntent();
    else {
        console.error(`Unknown MODE="${mode}". Use: sign | fill | cancel`);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err.message); process.exit(1); });
