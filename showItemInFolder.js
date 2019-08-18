const electron = require(`electron`);
const ipc = electron.ipcRenderer;
ipc.on('showItemInFolder', (event, filePath) => {
    electron.shell.showItemInFolder(filePath);
});