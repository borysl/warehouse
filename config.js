
const Config = {
    SPREADSHEET_ID: '1yqVU0OF08OIdoaYxdiZUla0pWb0JwOpzzZuvpip_pVI',
    DRIVE_FOLDER_ID: '1yNHvBcpHG37vO0LpJk2vPmPkL4Jp-bS-',
    CREDENTIALS_PATH: './credentials.json',
    SCOPES: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
    ],
    INVENTORY_GID: '1889369453',
    Holders: ['Aurora', 'EuropeanFoods', 'KennasBasement', 'BorysGarage'],
    Locations: ['Tacoma', 'Seattle', 'EastSide', 'Other'],
    ItemTypes: [
        'Asset',
        'Container',
        'Set',
        'Expendables',
        'PrintedMaterial',
        'Unknown',
        'Other',
    ],
    Categories: ['Uncategorized', 'Medical', 'Military', 'Banquet', 'Events', 'Office', 'Suitcases', 'Goods', 'Rally', 'Furniture'],
    GOOGLE_CLIENT_ID: '813088117464-1pu7bdg5mr7m8q2638p21se93f8hdpsk.apps.googleusercontent.com'
};

module.exports = Config;
