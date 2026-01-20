
const http = require('http');
const url = require('url');
const packageJson = require('../package.json');
const sheetService = require('./googleSheetService');

const PORT = process.env.PORT || 3000;

// Helper to parse JSON body
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

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    // iterate over CORS headers
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

        // Initialize service if not ready (lazy init usually handled in service, but good to ensure data loaded)
        // Ideally we load on startup, but for now we ensure it's called.
        // The service handles its own init state check.
        
        if (pathName === '/search' && req.method === 'GET') {
            const query = parsedUrl.query.q;
            await sheetService.loadData(); // Ensure fresh(ish) or loaded data
            const results = sheetService.search(query);
            res.writeHead(200);
            res.end(JSON.stringify(results));
            return;
        }

        // GET /item/:id
        if (pathName.startsWith('/item/') && req.method === 'GET') {
            const id = pathName.split('/')[2];
            await sheetService.loadData();
            const item = sheetService.getItem(id);
            if (item) {
                res.writeHead(200);
                res.end(JSON.stringify(item));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Item not found' }));
            }
            return;
        }

        // POST /item
        if (pathName === '/item' && req.method === 'POST') {
            const body = await getBody(req);
            const newItem = await sheetService.addItem(body);
            res.writeHead(201);
            res.end(JSON.stringify(newItem));
            return;
        }

        // PATCH /item/:id
        if (pathName.startsWith('/item/') && req.method === 'PATCH') {
            const id = pathName.split('/')[2];
            const body = await getBody(req);
            const updatedItem = await sheetService.updateItem(id, body);
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

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    try {
        console.log('Initializing Google Sheet Service...');
        await sheetService.loadData();
        console.log('Google Sheet Service Initialized.');
    } catch (e) {
        console.error('Failed to initialize Google Sheet Service:', e);
    }
});