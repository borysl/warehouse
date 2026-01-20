
const Config = {
    SPREADSHEET_ID: '1yqVU0OF08OIdoaYxdiZUla0pWb0JwOpzzZuvpip_pVI',
    DRIVE_FOLDER_ID: '1yNHvBcpHG37vO0LpJk2vPmPkL4Jp-bS-',
    CREDENTIALS_PATH: './credentials.json', // Path to your service account key file
    SCOPES: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ],
    INVENTORY_SHEET_NAME: 'Inventory',
    Holders: ['Aurora', 'EuropeanFoods', 'KennasBasement'],
    Locations: ['Tacoma', 'Seattle'],
    ItemTypes: [
        'Unknown',
        'Marketing',
        'Set',
        'Asset',
        'Other',
        'ValuableStuff',
        'Expendables',
        'Stuff',
        'Goods'
    ]
};

module.exports = Config;
