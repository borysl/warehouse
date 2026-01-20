
const sheetService = require('../backend/googleSheetService');

async function runTest() {
    console.log('--- Starting Google Sheet Integration Test ---');
    
    try {
        console.log('1. Authenticating and Loading Data...');
        await sheetService.loadData();
        const data = sheetService.getData();
        console.log(`Loaded ${data.length} items.`);
        if (data.length > 0) {
            console.log('First item:', data[0]);
        }

        console.log('\n2. Searching for "Canopy"...');
        const searchResults = sheetService.search('Canopy');
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
            Damages: null,
            StorageGuidelines: 'Test instruction - kinda you need to use transparent tote on wheels at the very bottom of the central shelf',
            Log: 'Just added by test routine',
            Photo: 'https://drive.google.com/file/d/1mLHxHuYsZSWPBwr5OFys97g6d2MvkB4_/view?usp=sharing',
            Owner: 'Test <test@ukrainedefensesupport.com>',
            Checklist: 'Make sure to extract batteries\nKeep it clean',
            Donor: 'Borys <borys@ukrainedefensesupport.com>',
        };
        const addedItem = await sheetService.addItem(newItem);
        console.log('Added Item:', addedItem);

        console.log('\n4. Updating the item...');
        const updatedItem = await sheetService.updateItem(addedItem.Id, {
            Description: 'Updated description from test',
            Category: 'Military',
             // Registered should not change
            Quantity: 5
        });
        console.log('Updated Item:', updatedItem);

        console.log('\n--- Test Completed Successfully ---');

    } catch (error) {
        console.error('\n!!! Test Failed !!!');
        console.error(error);
    }
}

async function testRegisteredDate(service) {
    console.log('\n--- Test: registered>2026-01-05 ---');
    const results = service.search('registered>2026-01-05');
    console.log(`Query: "registered>2026-01-05" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Registered: ${i.Registered}`));
}

async function testComplexTableQuery(service) {
    console.log('\n--- Test: table registered>2026-01-05 ---');
    // Note: Assuming "table" might match "Test Item"? Probably not. 
    // Let's search for "Automated" which is in our test item description
    const results = service.search('Banner registered>2026-01-05');
    console.log(`Query: "Banner registered>2026-01-05" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}`));
}

async function testHolderSearch(service) {
    console.log('\n--- Test: holder:Aurora ---');
    const results = service.search('holder:Aurora');
    console.log(`Query: "holder:Aurora" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Holder: ${i.Holder}`));
}

async function testOwnerSearch(service) {
    console.log('\n--- Test: owner:Test ---');
    const results = service.search('owner:Test');
    console.log(`Query: "owner:Test" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Owner: ${i.Owner}`));
}

async function testOwnerAndNameSearch(service) {
    console.log('\n--- Test: owner:Test name:Automated ---');
    const results = service.search('owner:Test name:Automated'); // Name matches "Automated test item"? No Name is "Test Item..." Description is "Automated..."
    // Let's use name:Test
    const rs = service.search('owner:Test name:Item');
    console.log(`Query: "owner:Test name:Item" -> Found ${rs.length} items.`);
    rs.forEach(i => console.log(`   [${i.Id}] ${i.Name}, Owner: ${i.Owner}`));
}

async function testQuotedSearch(service) {
    console.log('\n--- Test: "Test Item" ---');
    const results = service.search('"Test Item"'); 
    console.log(`Query: "Test Item" -> Found ${results.length} items.`);
    results.forEach(i => console.log(`   [${i.Id}] ${i.Name}`));
}

async function runAdvancedTests(service) {
    await testRegisteredDate(service);
    await testComplexTableQuery(service);
    await testHolderSearch(service);
    await testOwnerSearch(service);
    await testOwnerAndNameSearch(service);
    await testQuotedSearch(service);
}

runTest().then(async () => {
    // Re-instantiate or re-use? runTest is standalone.
    // Let's just create a new service instance or modify runTest to return service
    // For simplicity, I'll append a new block that imports and runs.
    console.log('\n--- Running Advanced Search Tests ---');
    const s = require('../backend/googleSheetService');
    if (!s.isInitialized) await s.loadData();
    await runAdvancedTests(s);
});
