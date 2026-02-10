const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FRONTEND_PORT = 8080;
const BACKEND_PORT = 3000;
const FRONTEND_DIR = path.join(__dirname, 'html');
const API_PATH = 'inv-api';

function startBackend() {
    console.log(`Starting backend on port ${BACKEND_PORT}...`);
    const backend = spawn('node', ['backend/server.js'], {
        stdio: 'inherit',
        env: { ...process.env, PORT: BACKEND_PORT }
    });

    backend.on('error', (err) => {
        console.error('Failed to start backend:', err);
    });

    return backend;
}

const backendProcess = startBackend();

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Proxy api requests to backend
    if (req.url.startsWith(`/${API_PATH}/`)) {
        const options = {
            hostname: 'localhost',
            port: BACKEND_PORT,
            path: req.url.replace(new RegExp(`^/${API_PATH}`), ''),
            method: req.method,
            headers: req.headers,
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Gateway' }));
        });

        req.pipe(proxyReq);
        return;
    }

    // Serve static files
    const extname = path.extname(req.url);
    const isSearchRoute = req.url.startsWith('/search') && (!extname || extname === '.html');
    const isItemRoute = req.url.startsWith('/i/') && (!extname || extname === '.html');
    let filePath = path.join(FRONTEND_DIR, (req.url === '/' || isSearchRoute || isItemRoute) ? 'index.html' : req.url);
    let contentType = 'text/html';

    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(FRONTEND_PORT, () => {
    console.log(`Dev server running at http://localhost:${FRONTEND_PORT}/`);
    console.log(`Frontend: http://localhost:${FRONTEND_PORT}`);
    console.log(`Backend (proxied): http://localhost:${FRONTEND_PORT}/${API_PATH}`);
});

// Clean up backend process on exit
process.on('SIGINT', () => {
    console.log('Stopping dev server...');
    backendProcess.kill();
    process.exit();
});
