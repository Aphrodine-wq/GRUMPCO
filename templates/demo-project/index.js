const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Hello from G-Rump demo!', time: new Date().toISOString() }));
});

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Demo server at http://localhost:${port}`));
