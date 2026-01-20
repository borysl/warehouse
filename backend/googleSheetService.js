
const { google } = require('googleapis');
const Config = require('./config');
const path = require('path');

class GoogleSheetService {
    constructor() {
        this.cache = [];
        this.sheets = null;
        this.drive = null;
        this.isInitialized = false;
        this.headers = [
            'Id', 'Name', 'Type', 'Quantity', 'Holder', 'StorageGuidelines',
            'MainLocation', 'LastUpdate', 'Log', 'Description', 'Photo',
            'Owner', 'Donor', 'Checklist'
        ];
    }

    // Helper to validate format "Name <email@domain>"
    isValidUserFormat(value) {
        if (!value) return false;
        // Regex: 
        // ^ - start
        // [^<]+ - One or more chars that are not '<' (Name)
        // \s+ - One or more spaces
        // < - literal <
        // [^@]+ - One or more chars not @ (email local part)
        // @ - literal @
        // [^>]+ - One or more chars not > (domain)
        // > - literal >
        // $ - end
        const regex = /^[^<]+\s+<[^@]+@[^>]+>$/;
        return regex.test(value);
    }
    
    // Helper to validate Holder
    validateHolder(holder) {
        if (!holder) return; // Allow empty/null? Assumption: required if specified
        // Valid if it's in Config.Holders OR matches User Format
        if (Config.Holders.includes(holder)) return;
        if (this.isValidUserFormat(holder)) return;
        
        throw new Error(`Invalid Holder: '${holder}'. Must be one of [${Config.Holders.join(', ')}] OR in format 'Name <email@gmail.com>'.`);
    }

    // Helper to validate Owner
    validateOwner(owner) {
        if (!owner) return;
        // Valid if 'UDS' OR matches User Format
        if (owner === 'UDS') return;
        if (this.isValidUserFormat(owner)) return;

        throw new Error(`Invalid Owner: '${owner}'. Must be 'UDS' OR in format 'Name <email@gmail.com>'.`);
    }

    // Helper to parse "MM/DD/YYYY HH:mm:ss" to Date object
    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    // Helper to format Date object to "MM/DD/YYYY HH:mm:ss"
    formatDate(date) {
        if (!date) return '';
        const pad = (n) => n.toString().padStart(2, '0');
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const year = date.getFullYear();
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
    }

    // Helper to Convert Value to Formula (Write)
    valueToFormula(header, value) {
        if (!value) return '';
        
        // Photo: Convert URL to Hyperlink "Photo"
        if (header === 'Photo' && value.startsWith('http')) {
             return `=HYPERLINK("${value}", "Photo")`;
        }
        
        // User Fields: Convert "Name <email>" to Hyperlink "Name" -> mailto:email
        if (['Holder', 'Owner', 'Donor'].includes(header) && this.isValidUserFormat(value)) {
            // Extract Name and Email
            // Regex match: (Name) <(email)>
            const match = value.match(/^([^<]+)\s+<([^@]+@[^>]+)>$/);
            if (match) {
                const name = match[1].trim();
                const email = match[2].trim();
                // Escape quotes in name just in case?
                const safeName = name.replace(/"/g, '""');
                return `=HYPERLINK("mailto:${email}", "${safeName}")`;
            }
        }

        return String(value);
    }

    // Helper to Parse Formula to Value (Read)
    formulaToValue(header, value) {
        if (!value || typeof value !== 'string') return value;
        
        // Check if formula
        if (value.startsWith('=HYPERLINK')) {
            // Regex to extract params: =HYPERLINK("url", "label")
            // This is a naive regex, might fail with complex nested quotes, but sufficient for our generator
            const match = value.match(/=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)/i);
            if (match) {
                const url = match[1];
                const label = match[2];

                if (header === 'Photo') return url;
                
                if (['Holder', 'Owner', 'Donor'].includes(header)) {
                    if (url.startsWith('mailto:')) {
                        const email = url.replace('mailto:', '');
                        return `${label} <${email}>`;
                    }
                }
                return label; // Fallback
            }
        }
        return value;
    }

    async connect() {
        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: path.resolve(Config.CREDENTIALS_PATH),
                scopes: Config.SCOPES,
            });

            const client = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: client });
            this.drive = google.drive({ version: 'v3', auth: client });
            this.isInitialized = true;
            console.log('Connected to Google Services');
        } catch (error) {
            console.error('Failed to connect to Google Services:', error);
            throw error;
        }
    }

    // New Helper: Parse Cell Data to Value
    parseCellData(header, cellData) {
        if (!cellData) return null;

        // 1. Check for Smart Chips (People)
        if (cellData.chipRuns && cellData.chipRuns.length > 0) {
            for (const run of cellData.chipRuns) {
                if (run.chip && run.chip.personProperties) {
                    const props = run.chip.personProperties;
                    const email = props.email;
                    // Use formattedValue (what is shown in the cell) as the name if available
                    // Fallback to chip properties or derived from email
                    const name = cellData.formattedValue || props.name || props.displayName || (props.firstName ? `${props.firstName} ${props.lastName}`.trim() : null) || email.split('@')[0];
                    
                    if (email) {
                         return `${name} <${email}>`;
                    }
                }
            }
        }

        // 2. Check for Hyperlink Formula
        const userEnteredValue = cellData.userEnteredValue;
        if (userEnteredValue && userEnteredValue.formulaValue) {
             const val = this.formulaToValue(header, userEnteredValue.formulaValue);
             // formulaToValue returns the input if it doesn't match HYPERLINK regex.
             // But valid formula might be just a value? No, formulaValue starts with =
             if (val !== userEnteredValue.formulaValue) return val; 
        }

        // 3. LastUpdate specific handling (using formattedValue)
        if (header === 'LastUpdate') {
             return this.parseDate(cellData.formattedValue);
        }
        
        // 4. Fallback to formattedValue (what user sees) or effectiveValue
        // effectiveValue might be { numberValue: ... } or { stringValue: ... }
        if (cellData.effectiveValue) {
            if (cellData.effectiveValue.stringValue !== undefined) return cellData.effectiveValue.stringValue;
            if (cellData.effectiveValue.numberValue !== undefined) return cellData.effectiveValue.numberValue;
             if (cellData.effectiveValue.boolValue !== undefined) return cellData.effectiveValue.boolValue;
        }
        
        return cellData.formattedValue || null;
    }

    async loadData() {
        if (!this.isInitialized) await this.connect();

        try {
            // We use spreadsheets.get to retrieve rich cell data (chips, formuas)
            // Fields: include grid data for the specific sheet
            const res = await this.sheets.spreadsheets.get({
                spreadsheetId: Config.SPREADSHEET_ID,
                ranges: [`${Config.INVENTORY_SHEET_NAME}!A:N`],
                includeGridData: true,
                fields: 'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue,chipRuns))))',
            });

            const sheet = res.data.sheets?.[0];
            if (!sheet || !sheet.data || !sheet.data[0].rowData) {
                this.cache = [];
                return;
            }

            const rows = sheet.data[0].rowData;
            
            // Assume first row is headers (index 0)
            if (rows.length < 2) {
                this.cache = [];
                return;
            }

            // Map rows to objects
            this.cache = rows.slice(1).map((rowObj, index) => {
                const item = {};
                const values = rowObj.values || [];
                
                this.headers.forEach((header, i) => {
                    const cellData = values[i];
                    let value = this.parseCellData(header, cellData);

                    // Type casting for Id/Quantity if not caught by parseCellData
                    if (header === 'Id' || header === 'Quantity') {
                        value = value ? Number(value) : (header === 'Id' ? index + 1 : 0);
                    }
                    
                    item[header] = value === undefined ? null : value;
                });
                return item;
            });

            console.log(`Loaded ${this.cache.length} items from sheet.`);
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    getData() {
        return this.cache;
    }

    getItem(id) {
        return this.cache.find(item => item.Id === Number(id));
    }

    search(query) {
        if (!query) return this.cache;
        const q = query.toLowerCase();
        return this.cache.filter(item => 
            (item.Name && item.Name.toLowerCase().includes(q)) ||
            (item.Description && item.Description.toLowerCase().includes(q)) ||
            (item.Type && item.Type.toLowerCase().includes(q))
        );
    }

    async addItem(item) {
        if (!this.isInitialized) await this.connect();

        // Validation against Enums
        if (item.Type && !Config.ItemTypes.includes(item.Type)) {
             throw new Error(`Invalid Item Type. Allowed: ${Config.ItemTypes.join(', ')}`);
        }
        if (item.MainLocation && !Config.Locations.includes(item.MainLocation)) {
            throw new Error(`Invalid Location. Allowed: ${Config.Locations.join(', ')}`);
        }
        
        // Allowed Holder values: Either in Config.Holders OR a valid reference (simple string check for now)
        if (item.Holder) this.validateHolder(item.Holder);
        if (item.Owner) this.validateOwner(item.Owner);
        
        // Generate ID: Use max existing ID + 1
        const maxId = this.cache.reduce((max, i) => (i.Id > max ? i.Id : max), 0);
        const newId = maxId + 1;

        const newItem = {
            ...item,
            Id: newId,
            LastUpdate: new Date(), // Store as Date object in cache
        };

        // Prepare row for sheet
        const row = this.headers.map(header => {
            let val = newItem[header];
            if (header === 'LastUpdate' && val instanceof Date) {
                val = this.formatDate(val);
            }
            // Add formula conversion
            val = this.valueToFormula(header, val);
            
            return val === null || val === undefined ? '' : String(val);
        });

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: Config.SPREADSHEET_ID,
                range: `${Config.INVENTORY_SHEET_NAME}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] },
            });
            
            // Update cache
            this.cache.push(newItem);
            return newItem;
        } catch (error) {
            console.error('Error adding item:', error);
            throw error;
        }
    }

    async updateItem(id, updates) {
        if (!this.isInitialized) await this.connect();

        const index = this.cache.findIndex(item => item.Id === Number(id));
        if (index === -1) throw new Error('Item not found');

        const currentItem = this.cache[index];
        const updatedItem = {
            ...currentItem,
            ...updates,
            Id: currentItem.Id, // Ensure ID doesn't change
            LastUpdate: new Date() // Update timestamp as Date object
        };

        // Validate Enums if changed
        if (updates.Type && !Config.ItemTypes.includes(updates.Type)) {
             throw new Error(`Invalid Item Type. Allowed: ${Config.ItemTypes.join(', ')}`);
        }
        if (updates.MainLocation && !Config.Locations.includes(updates.MainLocation)) {
            throw new Error(`Invalid Location. Allowed: ${Config.Locations.join(', ')}`);
        }
        if (updates.Holder) this.validateHolder(updates.Holder);
        if (updates.Owner) this.validateOwner(updates.Owner);

        // Calculate Row Number: Header is row 1, so index 0 is row 2.
        const rowNumber = index + 2; 

        // Optimistic update of cache
        this.cache[index] = updatedItem;

        // Update Sheet
        // We overwrite the entire row to ensure consistency
        const row = this.headers.map(header => {
             let val = updatedItem[header];
             if (header === 'LastUpdate' && val instanceof Date) {
                 val = this.formatDate(val);
             }
             // Add formula conversion
             val = this.valueToFormula(header, val);
             
             return val === null || val === undefined ? '' : String(val);
        });

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: Config.SPREADSHEET_ID,
                range: `${Config.INVENTORY_SHEET_NAME}!A${rowNumber}:N${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] },
            });
            return updatedItem;
        } catch (error) {
            console.error('Error updating item:', error);
            // Rollback cache if needed, but for now simple architecture
            throw error;
        }
    }
}

module.exports = new GoogleSheetService();
