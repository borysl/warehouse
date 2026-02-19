const http = require('http');
const url = require('url');
const packageJson = require('../package.json');
const Config = require('../config');
const { OAuth2Client } = require('google-auth-library');

const authClient = new OAuth2Client(Config.GOOGLE_CLIENT_ID);

let sheetService;
let inventoryRepo;
let fatalError = null;

const INVENTORY_HEADERS = [
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
    sheetService = require('./googleSheetService');
    sheetService.setHeaders(INVENTORY_HEADERS);
} catch (e) {
    console.error('Initial Load Error:', e);
    if (e.message.includes('config') || e.stack.includes('config')) {
        fatalError = 'Cannot read server config file: check config.js and its structure';
    } else {
        fatalError = e.message;
    }
}

const PORT = process.env.PORT || 3000;

// ... (getBody and getCookies remain the same) ...
const getBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
};

const getCookies = (req) => {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
};

const server = http.createServer(async (req, res) => {
    // Check for fatal startup errors
    if (fatalError) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.writeHead(500);
        res.end(`
            <div id="fatal-error-message" style="color: red; font-family: sans-serif; padding: 20px; border: 2px solid red; margin: 20px 0; background: #fff1f1;">
                <h2>Fatal Error</h2>
                <p>${fatalError}</p>
            </div>
        `);
        return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathName = parsedUrl.pathname;

    try {
        if (pathName === '/version' && req.method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({
                name: packageJson.name,
                version: packageJson.version
            }));
            return;
        }

        if (pathName === '/config' && req.method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({
                googleClientId: Config.GOOGLE_CLIENT_ID
            }));
            return;
        }

        if (pathName === '/auth/google' && req.method === 'POST') {
            const { credential } = await getBody(req);

            try {
                const ticket = await authClient.verifyIdToken({
                    idToken: credential,
                    audience: Config.GOOGLE_CLIENT_ID,
                });
                const payload = ticket.getPayload();

                const user = {
                    name: payload.name,
                    email: payload.email,
                    picture: payload.picture
                };

                const sessionData = Buffer.from(JSON.stringify(user)).toString('base64');

                res.setHeader('Set-Cookie', `session=${sessionData}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    user: user
                }));
            } catch (err) {
                res.writeHead(401);
                res.end(JSON.stringify({ error: 'Invalid Token' }));
            }
            return;
        }

        if (pathName === '/auth/me' && req.method === 'GET') {
            const cookies = getCookies(req);
            if (cookies.session) {
                try {
                    const userData = JSON.parse(Buffer.from(cookies.session, 'base64').toString());
                    res.writeHead(200);
                    res.end(JSON.stringify({ user: userData }));
                    return;
                } catch (e) {
                }
            }
            res.writeHead(401);
            res.end(JSON.stringify({ user: null }));
            return;
        }

        if (pathName === '/auth/logout' && req.method === 'POST') {
            res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
            return;
        }

        if (pathName.startsWith('/images/drive/') && req.method === 'GET') {
            const fileId = pathName.split('/')[3];
            try {
                const { stream, contentType } = await sheetService.getDriveFileStream(fileId);
                res.setHeader('Content-Type', contentType);
                res.writeHead(200);
                stream.pipe(res);
            } catch (err) {
                console.error('Drive Image Proxy Error:', err);
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Image not found' }));
            }
            return;
        }

        if (pathName === '/search' && req.method === 'GET') {
            if (!inventoryRepo) {
                res.writeHead(503);
                res.end(JSON.stringify({ error: 'System is initializing, please try again in a moment' }));
                return;
            }
            const query = parsedUrl.query.q;
            const results = inventoryRepo.search(query);
            res.writeHead(200);
            res.end(JSON.stringify(results));
            return;
        }

        if (pathName.startsWith('/item/') && req.method === 'GET') {
            if (!inventoryRepo) {
                res.writeHead(503);
                res.end(JSON.stringify({ error: 'System is initializing' }));
                return;
            }
            const id = pathName.split('/')[2];
            const item = inventoryRepo.getItem(id);
            if (item) {
                res.writeHead(200);
                res.end(JSON.stringify(item));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Item not found' }));
            }
            return;
        }

        if (pathName === '/item' && req.method === 'POST') {
            if (!inventoryRepo) {
                res.writeHead(503);
                res.end(JSON.stringify({ error: 'System is initializing' }));
                return;
            }
            const body = await getBody(req);
            const newItem = await inventoryRepo.addItem(body);
            res.writeHead(201);
            res.end(JSON.stringify(newItem));
            return;
        }

        if (pathName.startsWith('/item/') && req.method === 'PATCH') {
            if (!inventoryRepo) {
                res.writeHead(503);
                res.end(JSON.stringify({ error: 'System is initializing' }));
                return;
            }
            const id = pathName.split('/')[2];
            const body = await getBody(req);
            const updatedItem = await inventoryRepo.updateItem(id, body);
            res.writeHead(200);
            res.end(JSON.stringify(updatedItem));
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not Found" }));

    } catch (error) {
        console.error('Server Error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
    }
});

(async () => {
    if (!fatalError) {
        try {
            console.log('Initializing Inventory Repo...');
            inventoryRepo = await sheetService.createRepo(Config.SPREADSHEET_ID, Config.INVENTORY_GID);
            console.log('Inventory Repo Initialized.');
        } catch (e) {
            console.error('Failed to initialize Inventory Repo:', e);
            fatalError = e.message;
        }
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${PORT}/`);
    });
})();
