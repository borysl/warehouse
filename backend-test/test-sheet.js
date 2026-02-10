
const sheetService = require('../backend/googleSheetService');
const Config = require('../config');

async function runTest() {
    console.log('--- Starting Google Sheet Integration Test ---');

    const headers = [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'text' },
        { name: 'Type', type: 'enum', options: Config.ItemTypes },
        { name: 'Category', type: 'enum', options: Config.Categories },
        { name: 'Quantity', type: 'number' },
        { name: 'Holder', type: 'user' },
        { name: 'StorageGuidelines', type: 'multitext' },
        { name: 'MainLocation', type: 'enum', options: Config.Locations },
        { name: 'LastUpdate', type: 'lastUpdate' },
        { name: 'Log', type: 'multitext', readOnly: true },
        { name: 'Description', type: 'multitext' },
        { name: 'Damages', type: 'multitext' },
        { name: 'Photo', type: 'photo' },
        { name: 'Owner', type: 'user' },
        { name: 'Checklist', type: 'multitext' },
        { name: 'Donor', type: 'user' },
        { name: 'Registered', type: 'registered' }
    ];

    try {
        console.log('1. Authenticating and Loading Data...');
        sheetService.setHeaders(headers);
        const repo = await sheetService.createRepo(Config.SPREADSHEET_ID, Config.INVENTORY_GID);
        const data = repo.cache;
        console.log(`Loaded ${data.length} items.`);
        if (data.length > 0) {
            console.log('First item:', JSON.stringify(data[0], null, 2));
        }

        console.log('\n2. Searching for "Canopy"...');
        const searchResults = repo.search('Canopy');
        console.log(`Found ${searchResults.length} matches.`);
        searchResults.forEach(item => console.log(` - ID: ${item.Id}, Name: ${item.Name}`));

        console.log('\n3. Adding a temporary item...');
        const newItem = {
            Name: 'Test Item ' + Date.now(),
            Type: 'Asset',
            Category: 'Uncategorized',
            Quantity: 1,
            Holder: 'Aurora',
            MainLocation: 'Tacoma',
            Description: 'Automated test item',
            Damages: 'None',
            StorageGuidelines: 'Test instruction',
            Log: 'Just added by test routine',
            Photo: 'https://drive.google.com/file/d/1mLHxHuYsZSWPBwr5OFys97g6d2MvkB4_/view?usp=sharing',
            Owner: 'Test <test@ukrainedefensesupport.com>',
            Checklist: 'Make sure to extract batteries',
            Donor: 'Borys <borys@ukrainedefensesupport.com>',
        };
        const addedItem = await repo.addItem(newItem);
        console.log('Added Item:', addedItem);

        console.log('\n4. Updating the item...');
        const updatedItem = await repo.updateItem(addedItem.Id, {
            Description: 'Updated description from test',
            Category: 'Military',
            Quantity: 5
        });
        console.log('Updated Item:', updatedItem);

        console.log('\n--- Advanced Search Tests ---');
        await runAdvancedTests(repo);

        console.log('\n--- Test Completed Successfully ---');

    } catch (error) {
        console.error('\n!!! Test Failed !!!');
        console.error(error);
        process.exit(1);
    }
}

async function testRegisteredDate(repo) {
    console.log('\n--- Test: registered>2026-01-05 ---');
    const results = repo.search('registered>2026-01-05');
    console.log(`Query: "registered>2026-01-05" -> Found ${results.length} items.`);
    results.slice(0, 5).forEach(i => console.log(`   [${i.Id}] ${i.Name}, Registered: ${i.Registered}`));
}

async function testComplexTableQuery(repo) {
    console.log('\n--- Test: Banner registered>2026-01-05 ---');
    const results = repo.search('Banner registered>2026-01-05');
    console.log(`Query: "Banner registered>2026-01-05" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}`));
}

async function testHolderSearch(repo) {
    console.log('\n--- Test: holder:Aurora ---');
    const results = repo.search('holder:Aurora');
    console.log(`Query: "holder:Aurora" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Holder: ${i.Holder}`));
}

async function testOwnerSearch(repo) {
    console.log('\n--- Test: owner:Test ---');
    const results = repo.search('owner:Test');
    console.log(`Query: "owner:Test" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Owner: ${i.Owner}`));
}

async function testOwnerAndNameSearch(repo) {
    console.log('\n--- Test: owner:Test name:Item ---');
    const rs = repo.search('owner:Test name:Item');
    console.log(`Query: "owner:Test name:Item" -> Found ${rs.length} items.`);
    rs.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Owner: ${i.Owner}`));
}

async function testQuotedSearch(repo) {
    console.log('\n--- Test: "Test Item" ---');
    const results = repo.search('"Test Item"');
    console.log(`Query: "Test Item" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}`));
}

async function runAdvancedTests(repo) {
    await testRegisteredDate(repo);
    await testComplexTableQuery(repo);
    await testHolderSearch(repo);
    await testOwnerSearch(repo);
    await testOwnerAndNameSearch(repo);
    await testQuotedSearch(repo);
}

runTest();
