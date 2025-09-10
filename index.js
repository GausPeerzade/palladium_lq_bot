const { ethers } = require("ethers");
require("dotenv").config();

const tvMngrAbi = require("./tvMngr.json");
const tvMngrOpsAbi = require("./tvMngrOps.json");
const adminAbi = require("./admin.json");
const priceFeedAbi = require("./priceFeed.json");
const sortedtrovesAbi = require("./sortedTrove.json");
const vaultAbi = require("./stVault.json");

const RPC_URL = "https://rpc.botanixlabs.com";
const tvMngrOpsAddr = "0xcbA259F1dEb4992c253a392e02B74270eAA1C400";
const tvMngrAddr = "0xB294d1B36eedce91B28bBf6077BD61BeEB480eaE";
const adminAddr = "0x741145aF40A46cD8B7653Be09EC59CEb9c6c45e1";
const sortedTroveAddr = "0xD9C1Ad5e6497B3d44887eDdBc348d5781f62A101";
const priceFeedAddr = "0xEe015C52CD8d411a0812d1fAE4696e1Cc721D711";
const spVault = "0x9e0AeC4b128f72A8b54B7a7FFB2665D0327174b4";

const collaterals = ["0x0D2437F93Fed6EA64Ef01cCde385FB1263910C56", "0xF4586028FFdA7Eca636864F80f8a3f2589E33795", "0x9BC574a6f1170e90D80826D86a6126d59198A3Ef"];

async function main() {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Initialize contracts
    const tvMngrOps = new ethers.Contract(tvMngrOpsAddr, tvMngrOpsAbi, provider);
    const tvMngr = new ethers.Contract(tvMngrAddr, tvMngrAbi, provider);
    const admin = new ethers.Contract(adminAddr, adminAbi, provider);
    const priceFeed = new ethers.Contract(priceFeedAddr, priceFeedAbi, provider);
    const sortedTroves = new ethers.Contract(sortedTroveAddr, sortedtrovesAbi, provider);
    const vault = new ethers.Contract(spVault, vaultAbi, provider);

    // Check each collateral
    for (const collateral of collaterals) {
        try {
            // Get first (lowest ICR) trove for this collateral
            const firstTrove = await sortedTroves.getLast(collateral);

            if (firstTrove === "0x0000000000000000000000000000000000000000") {
                continue;
            }

            // Get trove data
            const troveData = await tvMngr.getEntireDebtAndColl(collateral, firstTrove);
            const collAmount = troveData[1];
            const debtAmount = troveData[0];

            // Get current price and MCR
            const price = await priceFeed.fetchPrice(collateral);
            let mcr = await admin.getMcr(collateral);

            // Calculate current ICR: (collateral * price) / debt * 100
            const currentICR = (collAmount * price) / (debtAmount);

            // If ICR < MCR, liquidate
            if (currentICR < mcr) {

                // Get signer
                const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                const tvMngrOpsWithSigner = vault.connect(signer);

                //  Execute liquidation
                const tx = await tvMngrOpsWithSigner.liquidateAndHarvest(collateral, 10);
                await tx.wait();
            } else {
            }

        } catch (error) {
            console.error(`Error processing collateral ${collateral}:`, error);
        }
    }


}

async function runLoop() {
    try {
        await main();
    } catch (err) {
        console.error("Error in main():", err);
    }
}

// Run immediately once
runLoop();

// // Run every 10 minutes
// setInterval(runLoop, 10 * 60 * 1000);