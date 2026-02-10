const sheetService = require('../backend/googleSheetService');
const Config = require('../config');

async function testSheetRepo() {
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
        console.log('--- Testing SheetRepo factory ---');
        sheetService.setHeaders(headers);

        console.log('Connecting to Google Sheets...');
        await sheetService.connect();

        console.log(`Creating repo for sheet GID: ${Config.INVENTORY_GID}...`);
        const inventoryRepo = await sheetService.createRepo(Config.SPREADSHEET_ID, Config.INVENTORY_GID);

        console.log('Repo created and refreshed successfully.');
        const data = inventoryRepo.cache;
        console.log(`Cache size: ${data.length}`);

        if (data.length > 0) {
            console.log('First item:', JSON.stringify(data[0], null, 2));
            const firstRowNumber = data[0]._rowNumber;
            console.log(`Getting row by number: ${firstRowNumber}`);
            const row = inventoryRepo.getRow(firstRowNumber);
            console.log('Row found:', row ? 'Yes' : 'No');
        }

        console.log('--- Verification Complete ---');
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

testSheetRepo();
