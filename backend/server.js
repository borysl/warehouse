const http = require('http');

const packageJson = require('../package.json');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/version') {
        res.writeHead(200);
        res.end(JSON.stringify({
            name: packageJson.name,
            version: packageJson.version
        }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not Found" }));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});