# 🌱 OrganicTrace: Blockchain-Powered Supply Chain for Organic Produce

Welcome to OrganicTrace, a decentralized platform built on the Stacks blockchain that traces organic produce from farm to table. By leveraging blockchain's immutability and transparency, this project combats food fraud in global markets, ensuring authenticity, reducing counterfeit organic claims, and building trust among consumers, retailers, and producers.

## ✨ Features

🌍 End-to-end traceability: Track produce batches from planting to purchase  
✅ Organic certification on-chain: Immutable proofs of organic status  
🚫 Fraud detection: Prevent tampering with supply chain records  
📱 Consumer verification: Scan QR codes to view full history  
🤝 Multi-party collaboration: Secure roles for farmers, certifiers, transporters, retailers  
📊 Audit trails: Generate reports for compliance and disputes  
🔒 Secure transfers: Ownership changes recorded immutably  
🌐 Global market support: Handles international standards and regulations  

## 🛠 How It Works

OrganicTrace uses Clarity smart contracts on the Stacks blockchain to create a tamper-proof ledger for organic produce. Participants interact via a web dApp or mobile app that calls these contracts. The system involves creating unique batch IDs (as NFTs for authenticity), certifying them, tracking transfers, and enabling verifications.

**For Farmers/Producers**  
- Register your farm and create a new produce batch with details like crop type, planting date, and location.  
- Generate a unique hash for the batch and call the BatchCreator contract to mint an NFT representing the batch.  
- Submit for certification to prove organic status.

**For Certifiers**  
- Verify farm details and batch compliance with organic standards.  
- Use the CertificationContract to issue an on-chain certificate linked to the batch NFT.  
- This adds an immutable layer of authenticity.

**For Transporters and Retailers**  
- When receiving a batch, call the TransferContract to record ownership transfer, including logistics details like timestamps and locations.  
- Each step updates the supply chain trail without altering previous records.

**For Consumers**  
- Scan a QR code on the product packaging to query the VerificationContract.  
- View the full history: farm origin, certifications, transfers, and authenticity proofs.  
- Report discrepancies via the DisputeResolution contract if fraud is suspected.

**For Auditors/Regulators**  
- Use the AuditLogContract to generate comprehensive reports on any batch's journey.  
- Ensure compliance with global standards like USDA Organic or EU Organic regulations.

## 📜 Smart Contracts

This project is implemented using 8 Clarity smart contracts, each handling a specific aspect of the supply chain for modularity and security:

1. **RoleManager.clar**: Manages user roles (farmer, certifier, transporter, retailer, consumer) with access controls to prevent unauthorized actions.  
2. **FarmRegistry.clar**: Registers farms with details like location, owner, and certification history; ensures unique farm IDs.  
3. **BatchCreator.clar**: Creates produce batches as NFTs, storing metadata like crop type, harvest date, and initial hash for integrity.  
4. **CertificationContract.clar**: Handles organic certifications; certifiers issue and revoke certificates linked to batches.  
5. **TransferContract.clar**: Records batch transfers between parties, updating ownership and adding logistics data (e.g., timestamps, geolocations).  
6. **VerificationContract.clar**: Allows public queries to verify batch authenticity, pulling data from the chain without modifications.  
7. **AuditLogContract.clar**: Logs all actions immutably and provides functions to generate audit reports for batches or users.  
8. **DisputeResolution.clar**: Manages dispute filings, evidence submission, and resolutions, escalating to off-chain arbitrators if needed.

These contracts interact seamlessly: For example, a transfer requires role checks from RoleManager and updates the AuditLog.

## 🚀 Getting Started

- Install the Stacks wallet and Clarity dev tools.  
- Deploy the contracts to a Stacks testnet.  
- Build a frontend dApp to interact with them (e.g., using React and the @stacks/connect library).  
- Test a full flow: Register a farm, create a batch, certify it, transfer it twice, and verify.

Join the fight against food fraud—fork this repo and contribute! 🚀