const electron = require(`electron`);
const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    Tray,
    dialog,
    shell,
    nativeImage
} = electron;

let eNotify;
const path = require(`path`);
const fetch = require(`node-fetch`);
const fs = require("fs");

const request = require(`request`);
let server;

const requestPostAsync = params =>
    new Promise((resolve, reject) => {
        request.post(params, (err, httpResponse, body) => {
            if (err) {
                return resolve(false);
            }
            resolve(JSON.parse(body));
        });
    });

let once = true;

setInterval(async () => {
    for (let i = 0; i < userIds.length; i++) {
        const _id = userIds[i];
        let r = await requestPostAsync({
            url: `${server}/alive`,
            form: {
                _id
            }
        });
        if (!r && once) {
            once = !once;
            const { response } = await dialog.showMessageBox(mainWindow, {
                type: `error`,
                title: `Что-то пошло не так...`,
                message: `Соединение с сервером потеряно. Что делаем?`,
                buttons: [
                    `Выйти из Hendrix`,
                    `Перезапустить Hendrix`,
                    `Подождать`
                ]
            });
            switch (response) {
                case 1:
                    app.relaunch();
                case 0:
                    app.quit();
                    break;
                default:
                    setTimeout(() => (once = true), 60000);
            }
        } else if (!r.alive && once) {
            once = !once;
            const { response } = await dialog.showMessageBox(mainWindow, {
                type: `error`,
                title: `Что-то пошло не так...`,
                message: `Ваша сессия удалена с сервера. Что делаем?`,
                buttons: [`Выйти из Hendrix`, `Перезапустить Hendrix`]
            });
            switch (response) {
                case 1:
                    app.relaunch();
                case 0:
                    app.quit();
            }
        }
    }
}, 5000);

const getOnClickFunc = (text = ``, window = mainWindow) => () => {
    const firstLink = (text.match(/\b(((https?|ftp):\/\/|www\.)[^\s']+)/g) ||
        [])[0];
    if (firstLink) {
        shell.openExternal(firstLink);
    }
    if (window) {
        window.show();
    }
};

const appIcon = path.join(__dirname, `logo.png`);

ipcMain.on(`notification`, (event, notification) => {
    notification.title = `<span style="color: ${notification.color}">${notification.name}</span>`;
    const senderWindow = BrowserWindow.fromId(
        event.sender.getOwnerBrowserWindow().id
    );
    senderWindow.flashFrame(true);
    notification.onClickFunc = getOnClickFunc(notification.text, senderWindow);
    eNotify.notify(notification);
});

let userIds = [];

let mainWindow, tray;

function createMainWindow() {
    const width = 800;
    const height = 600;
    mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        frame: false,
        show: false,
        icon: appIcon,
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
        app.setAppUserModelId(`Hendrix`);
    });
    app.on("second-instance", (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });
    mainWindow.loadFile("index.html");
    mainWindow.webContents.openDevTools();
    mainWindow.on("closed", function() {
        mainWindow = null;
        app.quit();
    });
}

let updateWindow;

function createUpdateWindow(jsonReleaseInfo) {
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
        icon: appIcon,
        resizable: false,
        backgroundColor: `#17212b`,
        webPreferences: {
            zoomFactor: 1,
            devTools: false,
            textAreasAreResizable: false,
            nodeIntegration: true
        }
    });
    updateWindow.once(`ready-to-show`, () => {
        updateWindow.show();
        updateWindow.webContents.send(`releaseInfo`, jsonReleaseInfo);
    });
    updateWindow.loadFile("updater.html");
    updateWindow.on("closed", function() {
        updateWindow = null;
        app.quit();
    });
    const downloadPath = path.join(process.cwd(), `hendrix.zip`);
    updateWindow.webContents.session.on(
        "will-download",
        (event, item, webContents) => {
            const downloadFileName = item.getFilename();
            if (
                path.extname(downloadFileName) == ".exe" ||
                !path.extname(downloadFileName)
            ) {
                item.setSavePath(path.join(process.cwd(), downloadFileName));
                item.on("updated", (event, state) => {
                    if (state === "interrupted") {
                        item.resume();
                    } else if (state === "progressing" && updateWindow) {
                        webContents.send(
                            `updaterDownloadProgress`,
                            item.getReceivedBytes() / item.getTotalBytes()
                        );
                    }
                });
                item.once("done", (event, state) => {
                    if (!updateWindow) {
                        return;
                    }
                    webContents.send("updaterDownloadDone", {
                        state,
                        filePath: item.getSavePath()
                    });
                });
            } else {
                item.setSavePath(downloadPath);
                if (fs.existsSync(downloadPath)) {
                    fs.unlinkSync(downloadPath);
                }
                item.on("updated", (event, state) => {
                    if (state === "interrupted") {
                        item.resume();
                    } else if (state === "progressing" && updateWindow) {
                        updateWindow.setProgressBar(item.getReceivedBytes() / item.getTotalBytes());
                        webContents.send(
                            `updateProgress`,
                            item.getReceivedBytes() / item.getTotalBytes()
                        );
                    }
                });
                item.once("done", (event, state) => {
                    if (!updateWindow) {
                        return;
                    }
                    webContents.send("updateDone", {
                        state,
                        filePath: item.getSavePath()
                    });
                });
            }
        }
    );
}

app.on("ready", async () => {
    eNotify = require(`electron-notify`);
    eNotify.setConfig({
        appIcon,
        logging: false,
        defaultStyleContainer: {
            backgroundColor: "#0e1621",
            overflow: "hidden",
            fontFamily: "Verdana",
            fontSize: `12px`,
            position: "relative",
            lineHeight: `12px`
        },
        defaultStyleText: {
            color: "#def0ff"
        }
    });
    const lastReleaseInfo = await fetch(
        `https://api.github.com/repos/huhguz/hendrix/releases/latest`
    );
    const jsonReleaseInfo = await lastReleaseInfo.json();
    if (jsonReleaseInfo.tag_name == "v" + app.getVersion()) {
        createMainWindow();
    } else {
        createUpdateWindow(jsonReleaseInfo);
    }
    tray = new Tray(`${__dirname}/tray.png`);
    const contextMenu = Menu.buildFromTemplate(currentMenu);
    tray.setToolTip("Hendrix");
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
        (mainWindow || updateWindow || app.quit()).show();
    });
});

let windowNum = 2,
    childs = [],
    usedWindowIds = {},
    userServerIds = {};
const currentMenu = [
    {
        type: `separator`
    },
    {
        label: `Quit Hendrix`,
        icon: path.join(__dirname, `styles`, `exit.png`),
        click() {
            app.quit();
        }
    }
];

ipcMain.on(`serverSend`, (event, data) => {
    server = data;
});

ipcMain.on(`killAllPerons`, (event, data) => {
    for (let i = 0; i < childs.length; i++) {
        childs[i].close();
        i--;
    }
});

ipcMain.on(`alive`, (event, arg) => {
    const window = event.sender.getOwnerBrowserWindow();
    const { id } = window;
    if (userServerIds[id]) {
        userIds.splice(userIds.indexOf(userServerIds[id]), 1);
    }
    userServerIds[id] = arg;
    userIds.push(arg);
});

ipcMain.on(`windowScreen`, (event, data) => {
    const { id } = data;
    for (let i = 0; i < currentMenu.length; i++) {
        if (id == currentMenu[i].id) {
            currentMenu[i].icon = nativeImage.createFromBuffer(data.data);
            const contextMenu = Menu.buildFromTemplate(currentMenu);
            tray.setContextMenu(contextMenu);
            break;
        }
    }
});

ipcMain.on(`openWindow`, (event, data) => {
    const window = event.sender.getOwnerBrowserWindow();
    const { id } = window;
    if (usedWindowIds[id] && id != mainWindow.id) {
        return BrowserWindow.fromId(id).webContents.send(
            "openWindowNum",
            currentMenu.find(e => e.id == id).windowNum
        );
    }
    usedWindowIds[id] = true;
    if (id != mainWindow.id) {
        window.on(`close`, () => {
            delete usedWindowIds[id];
            userIds.splice(userIds.indexOf(userServerIds[id]), 1);
            delete userServerIds[id];
            childs.splice(childs.indexOf(window), 1);
            windowNum--;
            const pos = currentMenu.findIndex(e => e.id == id);
            currentMenu.splice(pos, 1);
            for (let i = pos - 1; i >= 0; i--) {
                currentMenu[i].windowNum -= 1;
                currentMenu[i].label = `hendrix ${currentMenu[i].windowNum}`;
                BrowserWindow.fromId(currentMenu[i].id).webContents.send(
                    `openWindowNum`,
                    currentMenu[i].windowNum
                );
            }
            const contextMenu = Menu.buildFromTemplate(currentMenu);
            tray.setContextMenu(contextMenu);
        });
        event.reply(`openWindowNum`, windowNum);
        childs.push(window);
        currentMenu.unshift({
            id,
            windowNum,
            label: `window ${windowNum}`,
            submenu: Menu.buildFromTemplate([
                {
                    label: `Show`,
                    icon: path.join(__dirname, `trayIcons`, `max.png`),
                    click() {
                        BrowserWindow.fromId(id).show();
                        BrowserWindow.fromId(id).focus();
                    }
                },
                {
                    label: `Quit`,
                    icon: path.join(__dirname, `trayIcons`, `x.png`),
                    click() {
                        BrowserWindow.fromId(id).close();
                    }
                }
            ])
        });
        const contextMenu = Menu.buildFromTemplate(currentMenu);
        tray.setContextMenu(contextMenu);
        windowNum++;
    }
});

// Quit when all windows are closed.
app.on("window-all-closed", function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createMainWindow();
    }
});