
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
            Quantity: 1,
            Holder: 'Aurora',
            MainLocation: 'Seattle',
            Description: 'Automated test item',
            StorageGuidelines: 'Test instruction - kinda you need to use transparent tote on wheels at the very bottom of the central shelf',
            Log: 'Just added by test routine',
            Photo: 'https://drive.google.com/file/d/1mLHxHuYsZSWPBwr5OFys97g6d2MvkB4_/view?usp=sharing',
            Owner: 'Test <test@ukrainedefensesupport.com>',
            Donor: 'Borys <borys@ukrainedefensesupport.com>',
            Checklist: 'Make sure to extract batteries\nKeep it clean'
        };
        const addedItem = await sheetService.addItem(newItem);
        console.log('Added Item:', addedItem);

        console.log('\n4. Updating the item...');
        const updatedItem = await sheetService.updateItem(addedItem.Id, {
            Description: 'Updated description from test',
            Quantity: 5
        });
        console.log('Updated Item:', updatedItem);

        console.log('\n--- Test Completed Successfully ---');

    } catch (error) {
        console.error('\n!!! Test Failed !!!');
        console.error(error);
    }
}

runTest();
