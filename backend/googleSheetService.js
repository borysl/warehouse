
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
            'Id', 'Name', 'Type', 'Category', 'Quantity', 'Holder', 'StorageGuidelines',
            'MainLocation', 'LastUpdate', 'Log', 'Description', 'Damages', 'Photo',
            'Owner', 'Checklist', 'Donor', 'Registered'
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
            // Allow spaces around comma, parenthesis
            const match = value.match(/=HYPERLINK\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/i);
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

    // --- Search Helper Methods ---

    parseQuery(query) {
        if (!query) return { filters: [], textGroups: [] };

        // 1. Extract Quoted Strings and placeholder them
        const placeholders = [];
        let maskedQuery = query.replace(/"([^"]+)"/g, (match, content) => {
            placeholders.push(content);
            return `__QUOTE_${placeholders.length}__`; 
        });

        const tokens = maskedQuery.split(/\s+/).filter(t => t.length > 0);
        
        const filters = [];
        const textTokens = [];

        // 2. Process Tokens
        const fieldRegex = /^(id|type|category|holder|location|owner|stored|description|damages|checklist|log|donor|name):(.+)$/i;
        const dateRegex = /^(registered|updated)([><=])(.+)$/i;

        tokens.forEach(token => {
            let processedToken = token;
            // Restore quotes in value if present
            if (token.startsWith('__QUOTE_')) {
                 const idx = parseInt(token.match(/\d+/)[0]);
                 processedToken = placeholders[idx]; // Arrays 0-indexed, length used above? Wait. 
                 // push returns len. So index is len-1.
                 // Correct logic: placeholders.push(content) -> len 1. index 0.
                 // Above I used placeholders.length. So 0th item is at index 0.. wait.
                 // let's verify line 7: placeholders.push(content); return `...${placeholders.length - 1}__`
            }
            // Use simpler logic for placeholder reference 
        });
        
        // Redoing placeholder logic cleanly inside this block to ensure correctness
        
        // RE-IMPLEMENTATION of parseQuery
        
        const placeholdersRef = [];
        maskedQuery = query.replace(/"([^"]+)"/g, (match, content) => {
            placeholdersRef.push(content);
            return `__QUOTE_${placeholdersRef.length - 1}__`;
        });
        
        const safeTokens = maskedQuery.split(/\s+/).filter(t => t.length > 0);

        safeTokens.forEach(token => {
            // Check for Field Prefixes
            const fieldMatch = token.match(fieldRegex);
            if (fieldMatch) {
                let val = fieldMatch[2];
                if (val.startsWith('__QUOTE_')) {
                    const idx = parseInt(val.match(/\d+/)[0]);
                    val = placeholdersRef[idx];
                }
                filters.push({ field: fieldMatch[1].toLowerCase(), value: val, operator: '=' });
                return;
            }

            // Check for Date Operators
            const dateMatch = token.match(dateRegex);
            if (dateMatch) {
                filters.push({ field: dateMatch[1].toLowerCase(), value: dateMatch[3], operator: dateMatch[2], isDate: true });
                return;
            }
            
            // Check for Boolean Operator &
            if (token === '&') {
                textTokens.push({ value: '&', isOp: true });
                return;
            }

            // Plain text
             if (token.startsWith('__QUOTE_')) {
                 const idx = parseInt(token.match(/\d+/)[0]);
                 textTokens.push({ value: placeholdersRef[idx], isQuote: true });
            } else {
                 textTokens.push({ value: token, isQuote: false });
            }
        });

        // 3. Group Text Tokens
        const textGroups = [];
        let currentGroup = []; 
        
        for (let i = 0; i < textTokens.length; i++) {
            const t = textTokens[i];
            
            if (t.isOp) continue; // Skip '&'

            // Check if connected to PREVIOUS by &
            const prev = textTokens[i-1];
            const isConnectedToPrev = prev && prev.isOp;

            if (isConnectedToPrev) {
                currentGroup.push(t);
            } else {
                // Not connected to prev (OR). Start new Group.
                if (currentGroup.length > 0) textGroups.push(currentGroup);
                currentGroup = [t];
            }
        }
        if (currentGroup.length > 0) textGroups.push(currentGroup);
        
        return { filters, textGroups };
    }

    matchDate(itemDate, operator, targetDateStr) {
        if (!itemDate || !(itemDate instanceof Date)) return false;
        const targetDate = new Date(targetDateStr);
        if (isNaN(targetDate.getTime())) return false;
        
        // Compare timestamps
        // For equality, we might care about just the DATE part if input is YYYY-MM-DD
        // But user input might contain time? Let's assume day granularity if target is simple date
        
        const itemTime = itemDate.getTime();
        const targetTime = targetDate.getTime();

        if (operator === '>') return itemTime > targetTime;
        if (operator === '<') return itemTime < targetTime;
        if (operator === '=') {
             // Check Same Day
             return itemDate.toDateString() === targetDate.toDateString();
        }
        return false;
    }

    // New Helper: Parse Cell Data to Value
    parseCellData(header, cellData) {
        if (!cellData) return null;

        // 0. Check for direct Hyperlink (e.g. Ctrl+K) - Priority for Photo
        if (header === 'Photo') {
             // Check textFormatRuns (rich text links)
             if (cellData.textFormatRuns) {
                 for (const run of cellData.textFormatRuns) {
                     if (run.format && run.format.link && run.format.link.uri) {
                         return run.format.link.uri;
                     }
                 }
             }
             
             if (cellData.hyperlink) return cellData.hyperlink;             
        }

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

        // 3. Date handling (LastUpdate and Registered)
        if (header === 'LastUpdate' || header === 'Registered') {
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
                ranges: [`${Config.INVENTORY_SHEET_NAME}!A:Q`], // Extended range for new columns
                includeGridData: true,
                includeGridData: true,
                fields: 'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue,chipRuns,hyperlink,textFormatRuns))))',
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
        
        const { filters, textGroups } = this.parseQuery(query);
        
        // Search Fields Map
        const fieldMap = {
            'stored': 'StorageGuidelines',
            'registered': 'Registered',
            'updated': 'LastUpdate',
            'location': 'MainLocation'
            // others map 1:1 usually (id, type, name, holder, location, owner, description, damages, checklist, log, donor)
        };
        
        const freeTextFields = ['Name', 'Description', 'Damages', 'Checklist', 'Holder', 'MainLocation', 'StorageGuidelines'];

        return this.cache.filter(item => {
            // 1. Check Filters (AND)
            for (const f of filters) {
                let key = fieldMap[f.field.toLowerCase()] || f.field.charAt(0).toUpperCase() + f.field.slice(1);
                
                // Special case: 'id' mapping
                if (f.field === 'id') key = 'Id';

                const itemKey = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
                 
                 // If key not found in item, fail match?
                 if (!itemKey) {
                     return false; 
                 }

                 let val = item[itemKey];

                 if (f.isDate) {
                     if (!this.matchDate(val, f.operator, f.value)) return false;
                 } else {
                     // String comparison (Includes)
                     if (val === null || val === undefined) return false;
                     // For ID, exact match string
                     if (f.field === 'id') {
                         if (String(val) != f.value) return false;
                     } else {
                         if (!String(val).toLowerCase().includes(String(f.value).toLowerCase())) return false;
                     }
                 }
            }

            // 2. Check Free Text (OR of AND-groups)
            if (textGroups.length === 0) return true; // Only filters
            
            // match = (Group1 Matches) OR (Group2 Matches) ...
            // GroupMatch = (Term1 Matches) AND (Term2 Matches)
            
            return textGroups.some(group => {
                return group.every(term => {
                    const searchStr = term.value.toLowerCase();
                    // Search in all freeTextFields
                    return freeTextFields.some(field => {
                        const val = item[field];
                        return val && String(val).toLowerCase().includes(searchStr);
                    });
                });
            });
        });
    }

    async addItem(item) {
        if (!this.isInitialized) await this.connect();

        // Validation against Enums
        if (item.Type && !Config.ItemTypes.includes(item.Type)) {
             throw new Error(`Invalid Item Type. Allowed: ${Config.ItemTypes.join(', ')}`);
        }
        if (item.Category && !Config.Categories.includes(item.Category)) {
             throw new Error(`Invalid Category. Allowed: ${Config.Categories.join(', ')}`);
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
            LastUpdate: new Date(), // Store as Date object
            Registered: new Date(), // Set Registered on creation
        };

        // Prepare row for sheet
        const row = this.headers.map(header => {
            let val = newItem[header];
            if ((header === 'LastUpdate' || header === 'Registered') && val instanceof Date) {
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
            Registered: currentItem.Registered, // Ensure Registered doesn't change (immutable via patch)
            LastUpdate: new Date() // Update timestamp as Date object
        };

        // Validate Enums if changed
        if (updates.Type && !Config.ItemTypes.includes(updates.Type)) {
             throw new Error(`Invalid Item Type. Allowed: ${Config.ItemTypes.join(', ')}`);
        }
        if (updates.Category && !Config.Categories.includes(updates.Category)) {
             throw new Error(`Invalid Category. Allowed: ${Config.Categories.join(', ')}`);
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
             if ((header === 'LastUpdate' || header === 'Registered') && val instanceof Date) {
                 val = this.formatDate(val);
             }
             // Add formula conversion
             val = this.valueToFormula(header, val);
             
             return val === null || val === undefined ? '' : String(val);
        });

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: Config.SPREADSHEET_ID,
                range: `${Config.INVENTORY_SHEET_NAME}!A${rowNumber}:Q${rowNumber}`,
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
