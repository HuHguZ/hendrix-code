// Modules to control application life and create native browser window
const electron = require(`electron`);
const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    Tray,
    dialog,
    shell
} = electron;

let eNotify;
const path = require(`path`);

const request = require(`request`);

const server = `http://92.63.98.195:8080`;

const requestPostAsync = params => new Promise((resolve, reject) => {
    request.post(params, (err, httpResponse, body) => {
        if (err) {
            return resolve(false);
        }
        resolve(JSON.parse(body));
    });
});

let once = true;

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
    if (!r.alive && once) {
        once = !once;
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

ipcMain.on(`disableNotifications`, (event, data) => {
    notificationStack = [];
});

const getOnClickFunc = text => () => {
    const firstLink = (text.match(/\b(((https?|ftp):\/\/|www\.)[^\s']+)/g) || [])[0];
    if (firstLink) {
        shell.openExternal(firstLink);
    }
    if (mainWindow) {
        mainWindow.show();
    }
};

const appIcon = path.join(__dirname, `logo.png`);

ipcMain.on(`notification`, (event, notification) => {
    notification.title = `<span style="color: ${notification.color}">${notification.name}</span>`;
    notification.onClickFunc = getOnClickFunc(notification.text);
    notificationStack.push({
        config: {
            appIcon,
            defaultStyleContainer: {
                backgroundColor: '#0e1621',
                overflow: 'hidden',
                padding: `8px`,
                fontFamily: 'Verdana',
                fontSize: `12px`,
                position: 'relative',
                lineHeight: `12px`
            },
            defaultStyleText: {
                color: '#def0ff'
            }
        },
        notification
    });
});

let notificationStack = [];

setInterval(() => {
    if (!notificationStack.length) {
        return;
    }
    const note = notificationStack.shift();
    eNotify.setConfig(note.config);
    eNotify.notify(note.notification);
}, 300);

let _id = ``;


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, tray;


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
            devTools: false,
            textAreasAreResizable: false,
            nodeIntegration: true,
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
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

let updateWindow;

function createUpdateWindow() {
    let width = 400;
    let height = 400;
    updateWindow = new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        maxWidth: width,
        maxHeight: height,
        frame: false,
        show: false,
        icon: `${__dirname}/logo.png`,
        backgroundColor: `#17212b`,
        webPreferences: {
            zoomFactor: 1,
            devTools: false,
            textAreasAreResizable: false,
            nodeIntegration: true,
        }
    });
    updateWindow.once(`ready-to-show`, () => {
        updateWindow.show();
    });
    updateWindow.loadFile('updater.html');
    updateWindow.on('closed', function () {
        updateWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    eNotify = require(`electron-notify`);
    const versionCheck = await requestPostAsync({
        url: `${server}/check`,
        form: {
            version: app.getVersion()
        }
    });
    if (!versionCheck) {
        dialog.showErrorBox(`Критическая ошибка!`, `Сервер недоступен или вы не подключены к сети.`);
        app.quit();
    } else if (versionCheck.success) {
        createWindow();
    } else {
        createUpdateWindow();
    }
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
        (mainWindow || updateWindow).show();
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