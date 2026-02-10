
const { google } = require('googleapis');
const Config = require('../config');
const path = require('path');
const SheetRepo = require('./sheetRepo');

class GoogleSheetService {
    constructor() {
        this.sheets = null;
        this.drive = null;
        this.isInitialized = false;
        this.headers = [];
        this.authClient = null;
        this.credentialsPath = null;
        this.clientEmail = null;
    }

    setHeaders(headers) {
        this.headers = headers;
    }

    async connect() {
        const fs = require('fs');
        const credentialsPath = path.resolve(Config.CREDENTIALS_PATH);

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`credential path cannot be read - see if you can find ${credentialsPath} server`);
        }

        let credentials;
        try {
            credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        } catch (e) {
            throw new Error(`credential path cannot be read - see if you can find ${credentialsPath} server`);
        }

        const clientEmail = credentials.client_email || 'unknown';

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: Config.SCOPES,
            });

            const client = await auth.getClient();
            this.authClient = client;
            this.sheets = google.sheets({ version: 'v4', auth: client });
            this.drive = google.drive({ version: 'v3', auth: client });
            this.isInitialized = true;
            this.clientEmail = clientEmail;
            this.credentialsPath = credentialsPath;
            console.log('Connected to Google Services');
        } catch (error) {
            console.error('Failed to connect to Google Services:', error);
            throw new Error(`Service Account ${clientEmail} cannot be authenticated. Pls check data in ${credentialsPath}`);
        }
    }

    async createRepo(spreadsheetId, gid) {
        if (!this.isInitialized) await this.connect();
        const repo = new SheetRepo(this.sheets, this.drive, spreadsheetId, gid, this.headers);
        await repo.refresh();
        return repo;
    }

    async getDriveFileStream(fileId) {
        if (!this.isInitialized) await this.connect();
        const metadata = await this.drive.files.get({
            fileId: fileId,
            fields: 'mimeType',
            auth: this.authClient
        });
        const contentType = metadata.data.mimeType;
        const response = await this.drive.files.get(
            {
                fileId: fileId,
                alt: 'media',
                auth: this.authClient
            },
            { responseType: 'stream' }
        );
        return {
            stream: response.data,
            contentType: contentType
        };
    }
}

module.exports = new GoogleSheetService();
