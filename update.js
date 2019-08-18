const electron = require(`electron`);
const {
    remote,
    ipcRenderer,
    webFrame,
    shell,
    clipboard,
    desktopCapturer
} = electron;
const {
    dialog
} = remote;
const {
    screen
} = remote;
let currentWindow = remote.getCurrentWindow();
webFrame.setZoomFactor(1);
webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(0, 0);
const WebSocket = require(`ws`);
const fs = require(`fs`);
const zlib = require(`zlib`);
const path = require(`path`);
const getElem = id => document.getElementById(id);
const ws = new WebSocket(`ws://92.63.98.195:8080/updateClient`);

const bufParts = [];

let currPart = 0;
let totalParts;
const updateProgress = getElem(`updateProgress`);

ws.on('message', function incoming(data) {
    if (typeof data == `string`) {
        const info = JSON.parse(data);
        totalParts = info.partsCount;
        getElem(`newHendrixName`).textContent = `HENDRIX ${info.version}`;
    } else {
        currPart++;
        updateProgress.textContent = (currPart / totalParts * 100).toFixed(3) + "%";
        bufParts.push(data);
    }
});

ws.on('close', function incoming(data) {
    updateProgress.style.color = `green`;
    if (fs.existsSync(`resources`)) {
        require('original-fs').writeFileSync(path.join(`resources`, `app.asar`), zlib.unzipSync(Buffer.concat(bufParts)));
        remote.app.relaunch();
        remote.app.exit();
    } else {
        remote.app.exit();
    }
});

getElem(`close-button`).addEventListener(`click`, () => {
    remote.app.quit();
});

getElem(`minimize-button`).addEventListener(`click`, () => {
    currentWindow.minimize();
});

const loadingUpdate = getElem(`loadingUpdate`);
const downloadUpdateStatus = getElem(`downloadUpdateStatus`);

setInterval(() => {
    downloadUpdateStatus.textContent = `Скачиваю обновление${".".repeat(pointCount++ % 5)}`;
}, 500);

let deg = 0, pointCount = 0;

setInterval(() => {
    loadingUpdate.style.transform = `rotate(${deg}deg)`;
    deg += 0.3;
}, 10);

document.addEventListener(`keydown`, e => {
    if (e.ctrlKey && e.key.match(/[rк]/i)) {
        e.preventDefault();
    }
});