
const sheetService = require('../backend/googleSheetService');
const Config = require('../config');
const fs = require('fs');
const path = require('path');

async function testError(name, action) {
    console.log(`\n--- Testing Error: ${name} ---`);
    try {
        console.log(`Running action for ${name}...`);
        await action();
        console.log('FAIL: Expected error but succeeded.');
    } catch (e) {
        console.log('SUCCESS: Caught expected error:');
        console.log('Message:', e.message);
    }
}

async function runTests() {
    console.log('Starting error tests...');
    const credPath = path.resolve(Config.CREDENTIALS_PATH);
    const backupPath = credPath + '.bak';

    // 1. Missing Credentials
    await testError('Missing Credentials', async () => {
        if (fs.existsSync(credPath)) fs.renameSync(credPath, backupPath);
        try {
            await sheetService.connect();
        } finally {
            if (fs.existsSync(backupPath)) fs.renameSync(backupPath, credPath);
        }
    });

    // 2. Corrupted Credentials
    await testError('Corrupted Credentials', async () => {
        if (fs.existsSync(credPath)) fs.renameSync(credPath, backupPath);
        fs.writeFileSync(credPath, '{ invalid json }');
        try {
            await sheetService.connect();
        } finally {
            fs.unlinkSync(credPath);
            if (fs.existsSync(backupPath)) fs.renameSync(backupPath, credPath);
        }
    });

    // 3. Auth Failed (Invalid key data)
    await testError('Auth Failed', async () => {
        if (fs.existsSync(credPath)) fs.renameSync(credPath, backupPath);
        // Create valid JSON but invalid keys
        fs.writeFileSync(credPath, JSON.stringify({
            client_email: 'fake@example.com',
            private_key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----\n'
        }));
        try {
            await sheetService.connect();
            await sheetService.loadData(); // This should fail now
        } finally {
            fs.unlinkSync(credPath);
            if (fs.existsSync(backupPath)) fs.renameSync(backupPath, credPath);
        }
    });

    // 4. Access Denied (Valid auth, invalid sheet ID)
    await testError('Access Denied', async () => {
        const originalId = Config.SPREADSHEET_ID;
        Config.SPREADSHEET_ID = 'invalid_id_123';
        try {
            await sheetService.connect();
            await sheetService.loadData();
        } finally {
            Config.SPREADSHEET_ID = originalId;
        }
    });
}

runTests();
