const Config = require('../config');

class SheetRepo {
    constructor(sheets, drive, spreadsheetId, gid, headerConfigs) {
        this.sheets = sheets;
        this.drive = drive;
        this.spreadsheetId = spreadsheetId;
        this.gid = gid;
        this.headerConfigs = headerConfigs;
        this.headers = headerConfigs.map(h => h.name);
        this.cache = [];
        this.sheetName = null;
    }

    async refresh() {
        await this._loadData();
    }

    async _loadData() {
        try {
            if (!this.sheetName) {
                const ss = await this.sheets.spreadsheets.get({
                    spreadsheetId: this.spreadsheetId,
                    fields: 'sheets(properties(title,sheetId))'
                });
                const sheet = ss.data.sheets.find(s => s.properties.sheetId === Number(this.gid));
                if (!sheet) throw new Error(`Sheet with GID ${this.gid} not found in spreadsheet ${this.spreadsheetId}`);
                this.sheetName = sheet.properties.title;
            }

            const res = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
                ranges: [`${this.sheetName}!A:Z`],
                includeGridData: true,
                fields: 'sheets(data(rowData(values(userEnteredValue,effectiveValue,formattedValue,chipRuns,hyperlink,textFormatRuns))))',
            });

            const sheetData = res.data.sheets?.[0];
            if (!sheetData || !sheetData.data || !sheetData.data[0].rowData) {
                this.cache = [];
                return;
            }

            const rows = sheetData.data[0].rowData;
            this._parseRows(rows);
            console.log(`Loaded ${this.cache.length} items from sheet '${this.sheetName}'.`);
        } catch (error) {
            console.error(`Error loading data for sheet ${this.gid}:`, error);
            throw error;
        }
    }

    _parseRows(rows) {
        if (rows.length < 2) {
            this.cache = [];
            return;
        }

        this.cache = rows.slice(1).map((rowObj, index) => {
            const item = {};
            const values = rowObj.values || [];

            this.headerConfigs.forEach((config, i) => {
                const cellData = values[i];
                let value = this.parseCellData(config, cellData);

                if (config.type === 'id') {
                    value = value !== null && value !== undefined ? Number(value) : index + 1;
                } else if (config.type === 'number') {
                    value = value !== null && value !== undefined ? Number(value) : 0;
                }

                item[config.name] = value === undefined ? null : value;
            });
            item._rowNumber = index + 2;
            return item;
        });
    }

    getRow(rowNumber) {
        return this.cache.find(item => item._rowNumber === Number(rowNumber));
    }

    getItem(id) {
        const idField = this.headerConfigs.find(h => h.type === 'id')?.name || 'Id';
        return this.cache.find(item => item[idField] === Number(id));
    }

    isValidUserFormat(value) {
        if (!value) return false;
        const regex = /^[^<]+\s+<[^@]+@[^>]+>$/;
        return regex.test(value);
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    formatDate(date, type = 'dateTime') {
        if (!date) return '';
        const pad = (n) => n.toString().padStart(2, '0');
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const year = date.getFullYear();
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        if (type === 'date') return `${month}/${day}/${year}`;
        if (type === 'time') return `${hours}:${minutes}:${seconds}`;
        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
    }

    valueToFormula(config, value) {
        if (!value) return '';
        if (config.type === 'photo' && String(value).startsWith('http')) {
            return `=HYPERLINK("${value}", "Photo")`;
        }
        if (config.type === 'user' && this.isValidUserFormat(value)) {
            const match = value.match(/^([^<]+)\s+<([^@]+@[^>]+)>$/);
            if (match) {
                const name = match[1].trim();
                const email = match[2].trim();
                const safeName = name.replace(/"/g, '""');
                return `=HYPERLINK("mailto:${email}", "${safeName}")`;
            }
        }
        return String(value);
    }

    formulaToValue(config, value) {
        if (!value || typeof value !== 'string') return value;
        if (value.startsWith('=HYPERLINK')) {
            const match = value.match(/=HYPERLINK\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/i);
            if (match) {
                const url = match[1];
                const label = match[2];
                if (config.type === 'photo') return url;
                if (config.type === 'user') {
                    if (url.startsWith('mailto:')) {
                        const email = url.replace('mailto:', '');
                        return `${label} <${email}>`;
                    }
                }
                return label;
            }
        }
        return value;
    }

    parseCellData(config, cellData) {
        if (!cellData) return null;
        if (config.type === 'photo') {
            if (cellData.textFormatRuns) {
                for (const run of cellData.textFormatRuns) {
                    if (run.format && run.format.link && run.format.link.uri) {
                        return run.format.link.uri;
                    }
                }
            }
            if (cellData.hyperlink) return cellData.hyperlink;
        }
        if (cellData.chipRuns && cellData.chipRuns.length > 0) {
            for (const run of cellData.chipRuns) {
                if (run.chip && run.chip.personProperties) {
                    const props = run.chip.personProperties;
                    const email = props.email;
                    const name = cellData.formattedValue || props.name || props.displayName || (props.firstName ? `${props.firstName} ${props.lastName}`.trim() : null) || email.split('@')[0];
                    if (email) return `${name} <${email}>`;
                }
            }
        }
        const userEnteredValue = cellData.userEnteredValue;
        if (userEnteredValue && userEnteredValue.formulaValue) {
            const val = this.formulaToValue(config, userEnteredValue.formulaValue);
            if (val !== userEnteredValue.formulaValue) return val;
        }
        if (['date', 'time', 'dateTime', 'lastUpdate', 'registered'].includes(config.type)) {
            return this.parseDate(cellData.formattedValue);
        }
        if (cellData.effectiveValue) {
            if (cellData.effectiveValue.stringValue !== undefined) return cellData.effectiveValue.stringValue;
            if (cellData.effectiveValue.numberValue !== undefined) return cellData.effectiveValue.numberValue;
            if (cellData.effectiveValue.boolValue !== undefined) return cellData.effectiveValue.boolValue;
        }
        return cellData.formattedValue || null;
    }

    async addItem(item) {
        const idField = this.headerConfigs.find(h => h.type === 'id')?.name || 'Id';
        const maxId = this.cache.reduce((max, i) => (i[idField] > max ? i[idField] : max), 0);
        const newId = maxId + 1;

        const newItem = { ...item };

        this.headerConfigs.forEach(config => {
            if (config.type === 'id') {
                newItem[config.name] = newId;
            } else if (config.type === 'registered' || config.type === 'lastUpdate') {
                newItem[config.name] = new Date();
            } else if (config.type === 'enum' && newItem[config.name]) {
                if (config.options && !config.options.includes(newItem[config.name])) {
                    throw new Error(`Invalid value for ${config.name}. Allowed: ${config.options.join(', ')}`);
                }
            } else if (config.type === 'user' && newItem[config.name]) {
                if (!this.isValidUserFormat(newItem[config.name]) && config.options && !config.options.includes(newItem[config.name])) {
                    throw new Error(`Invalid user format for ${config.name}.`);
                }
            }
        });

        const row = this.headerConfigs.map(config => {
            let val = newItem[config.name];
            if (['date', 'time', 'dateTime', 'lastUpdate', 'registered'].includes(config.type) && val instanceof Date) {
                val = this.formatDate(val, config.type);
            }
            val = this.valueToFormula(config, val);
            return val === null || val === undefined ? '' : String(val);
        });

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] },
            });
            await this.refresh();
            return this.getItem(newId);
        } catch (error) {
            console.error('Error adding item:', error);
            throw error;
        }
    }

    async updateItem(id, updates) {
        const idField = this.headerConfigs.find(h => h.type === 'id')?.name || 'Id';
        const index = this.cache.findIndex(item => item[idField] === Number(id));
        if (index === -1) throw new Error('Item not found');

        const currentItem = this.cache[index];
        const updatedItem = { ...currentItem, ...updates };

        this.headerConfigs.forEach(config => {
            if (config.type === 'id' || config.type === 'registered' || config.readOnly) {
                updatedItem[config.name] = currentItem[config.name];
            } else if (config.type === 'lastUpdate') {
                updatedItem[config.name] = new Date();
            } else if (config.type === 'enum' && updates[config.name]) {
                if (config.options && !config.options.includes(updates[config.name])) {
                    throw new Error(`Invalid value for ${config.name}. Allowed: ${config.options.join(', ')}`);
                }
            }
        });

        const rowNumber = currentItem._rowNumber;
        const row = this.headerConfigs.map(config => {
            let val = updatedItem[config.name];
            if (['date', 'time', 'dateTime', 'lastUpdate', 'registered'].includes(config.type) && val instanceof Date) {
                val = this.formatDate(val, config.type);
            }
            val = this.valueToFormula(config, val);
            return val === null || val === undefined ? '' : String(val);
        });

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [row] },
            });
            this.cache[index] = updatedItem;
            return updatedItem;
        } catch (error) {
            console.error('Error updating item:', error);
            throw error;
        }
    }

    search(query) {
        if (!query) return this.cache;
        return this._executeSearch(query);
    }

    _executeSearch(query) {
        const { filters, textGroups } = this.parseQuery(query);

        const typeMapping = {};
        this.headerConfigs.forEach(h => {
            typeMapping[h.name.toLowerCase()] = h;
        });

        const freeTextFields = this.headerConfigs
            .filter(h => ['text', 'multitext', 'user'].includes(h.type))
            .map(h => h.name);

        return this.cache.filter(item => {
            for (const f of filters) {
                const config = typeMapping[f.field.toLowerCase()];
                if (!config) return false;

                const val = item[config.name];
                if (f.isDate || ['date', 'time', 'dateTime', 'lastUpdate', 'registered'].includes(config.type)) {
                    if (!this.matchDate(val, f.operator, f.value)) return false;
                } else {
                    if (val === null || val === undefined) return false;
                    if (config.type === 'id' || config.type === 'number') {
                        if (String(val) != f.value) return false;
                    } else {
                        if (!String(val).toLowerCase().includes(String(f.value).toLowerCase())) return false;
                    }
                }
            }

            if (textGroups.length === 0) return true;
            return textGroups.some(group => {
                return group.every(term => {
                    const searchStr = term.value.toLowerCase();
                    return freeTextFields.some(field => {
                        const val = item[field];
                        return val && String(val).toLowerCase().includes(searchStr);
                    });
                });
            });
        });
    }

    parseQuery(query) {
        if (!query) return { filters: [], textGroups: [] };
        const placeholdersRef = [];
        let maskedQuery = query.replace(/"([^"]+)"/g, (match, content) => {
            placeholdersRef.push(content);
            return `__QUOTE_${placeholdersRef.length - 1}__`;
        });
        const safeTokens = maskedQuery.split(/\s+/).filter(t => t.length > 0);
        const filters = [];
        const textTokens = [];

        const filterKeys = this.headerConfigs.map(h => h.name.toLowerCase());
        const dateKeys = this.headerConfigs
            .filter(h => ['date', 'time', 'dateTime', 'lastUpdate', 'registered'].includes(h.type))
            .map(h => h.name.toLowerCase());

        safeTokens.forEach(token => {
            const fieldMatch = token.match(/^([^:]+):(.+)$/i);
            if (fieldMatch) {
                const field = fieldMatch[1].toLowerCase();
                if (filterKeys.includes(field)) {
                    let val = fieldMatch[2];
                    if (val.startsWith('__QUOTE_')) {
                        const idx = parseInt(val.match(/\d+/)[0]);
                        val = placeholdersRef[idx];
                    }
                    filters.push({ field: field, value: val, operator: '=' });
                    return;
                }
            }

            const dateMatch = token.match(/^([^><=]+)([><=])(.+)$/i);
            if (dateMatch) {
                const field = dateMatch[1].toLowerCase();
                if (dateKeys.includes(field)) {
                    filters.push({ field: field, value: dateMatch[3], operator: dateMatch[2], isDate: true });
                    return;
                }
            }

            if (token === '&') {
                textTokens.push({ value: '&', isOp: true });
                return;
            }
            if (token.startsWith('__QUOTE_')) {
                const idx = parseInt(token.match(/\d+/)[0]);
                textTokens.push({ value: placeholdersRef[idx], isQuote: true });
            } else {
                textTokens.push({ value: token, isQuote: false });
            }
        });

        const textGroups = [];
        let currentGroup = [];
        for (let i = 0; i < textTokens.length; i++) {
            const t = textTokens[i];
            if (t.isOp) continue;
            const prev = textTokens[i - 1];
            if (prev && prev.isOp) {
                currentGroup.push(t);
            } else {
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
        const itemTime = itemDate.getTime();
        const targetTime = targetDate.getTime();
        if (operator === '>') return itemTime > targetTime;
        if (operator === '<') return itemTime < targetTime;
        if (operator === '=') return itemDate.toDateString() === targetDate.toDateString();
        return false;
    }
}

module.exports = SheetRepo;
