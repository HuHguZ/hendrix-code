// Modules to control application life and create native browser window
const electron = require(`electron`);
const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    Notification,
    Tray,
    webFrame,
    dialog
} = electron;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock && true) {
    dialog.showErrorBox(`Ошибка!`, `Hendrix уже запущен!`);
    app.quit();
}

const {
    template
} = require('./app-menu-template');

const request = require(`request`);

const server = `http://62.109.31.175:8080`;

const requestPostAsync = params => new Promise((resolve, reject) => {
    request.post(params, (err, httpResponse, body) => {
        if (err) {
            return resolve(false);
        }
        resolve(JSON.parse(body));
    });
});

setInterval(async () => {
    if (!_id) {
        return;
    }
    let r = await requestPostAsync({
        url: `${server}/alive`,
        form: {
            _id
        }
    });
    if (!r.alive) {
        dialog.showMessageBox({
            type: `error`,
            title: `Критическая ошибка!`,
            message: `Сессия окончена. Перезайдите в приложение!`
        });
        app.quit();
    }
}, 5000);

ipcMain.on(`alive`, (event, arg) => {
    _id = arg;
})

let _id = ``;


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, tray, mainUser;


function createWindow() {
    // Create the browser window.
    let {
        width,
        height
    } = electron.screen.getPrimaryDisplay().workAreaSize;
    width -= 400;
    height -= 200;
    mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        frame: false,
        show: false,
        icon: `${__dirname}/logo.png`,
        backgroundColor: `#17212b`,
        webPreferences: {
            zoomFactor: 1,
            devTools: !false,
            textAreasAreResizable: false,
            nodeIntegration: true
        }
    });
    mainWindow.once(`ready-to-show`, () => {
        mainWindow.show();
    });
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
    // and load the index.html of the app.
    mainWindow.loadFile('index.html');
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    // Emitted when the window is closed.
    mainWindow.on('closed', async function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        //тут делать запрос на дисконнект и удалять юзера
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    if (!(await requestPostAsync({
            url: `${server}/check`
        })).success) {
        dialog.showErrorBox(`Критическая ошибка!`, `Сервер недоступен или вы не подключены к сети. Повторите попытку позже.`);
        app.quit();
    }
    createWindow();
    tray = new Tray(`${__dirname}/tray.png`);
    const contextMenu = Menu.buildFromTemplate([{
        label: 'Quit Hendrix',
        accelerator: 'Command+Q',
        click() {
            app.quit();
        }
    }]);
    tray.setToolTip('Hendrix');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        mainWindow.show();
    });
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.