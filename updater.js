const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const fs = require(`fs`);

const server = http.createServer();
const updateWss = new WebSocket.Server({
    noServer: true
});

const divideBuf = (buf, part = 262144) => {
    const r = [];
    const count = Math.floor(buf.length / part);
    const end = part * count;
    for (let i = 0; i < end; i += part) {
        r.push(buf.slice(i, i + part));
    }
    if (end < buf.length) {
        r.push(buf.slice(end, buf.length));
    }
    return r;
};

let version = fs.readFileSync(`version.txt`, `utf8`);
let clientApp = divideBuf(fs.readFileSync(`app.zlib`));

const createFileWatcher = (filename, callback) => {
    let updateFileTimer = false;
    fs.watch(filename, (event, filename) => {
        if (filename) {
            if (updateFileTimer) {
                return;
            };
            updateFileTimer = setTimeout(() => {
                updateFileTimer = false;
            }, 100);
           callback(event, filename);
        }
    });
};

createFileWatcher(`version.txt`, async (event, filename) => {
    await new Promise(res => setTimeout(res, 200));
    version = fs.readFileSync(filename, `utf8`);
});

createFileWatcher(`app.zlib`, async (event, filename) => {
    await new Promise(res => setTimeout(res, 200));
    clientApp = divideBuf(fs.readFileSync(`app.zlib`));
});

updateWss.on('connection', ws => {
    ws.send(JSON.stringify({
        version,
        partsCount: clientApp.length
    }));
    for (let i = 0; i < clientApp.length; i++) {
        ws.send(clientApp[i]);
    }
    ws.close();
});


server.on('upgrade', function upgrade(request, socket, head) {
    const pathname = url.parse(request.url).pathname;
    if (pathname === '/updateClient') {
        updateWss.handleUpgrade(request, socket, head, function done(ws) {
            updateWss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

server.listen(8000);