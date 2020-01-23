const electron = require(`electron`);
const { remote, webFrame, shell, ipcRenderer } = electron;
const { dialog, app } = remote;
let currentWindow = remote.getCurrentWindow();
webFrame.setZoomFactor(1);
webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(0, 0);
const fs = require(`fs`);
const fetch = require(`node-fetch`);
const path = require(`path`);
const os = require("os");
const child_process = require('child_process');
const { platform } = process;

const getElem = id => document.getElementById(id);

const updaterDownloadProgress = getElem('updaterDownloadProgress');

const updaterPath = `updater-${platform}-${os.arch()}${platform == 'win32' ? '.exe' : ''}`;

const fullUpdaterPath = path.join(process.cwd(), updaterPath);

let openAppDirectoryAfterDownloadUpdate;

ipcRenderer.on(`releaseInfo`, async (event, releaseInfo) => {
    const yourVersion = `${app.name}-${platform}-${os.arch()}.zip`;
    const yourDownload = releaseInfo.assets.find(e => e.name == yourVersion);
    currentWindow.webContents.downloadURL(yourDownload.browser_download_url);
    currentWindow.setTitle(`Hendrix ${releaseInfo.tag_name}`);
    getElem('newHendrixName').innerText = `HENDRIX ${releaseInfo.tag_name.toUpperCase()}`;
    dialog.showMessageBox(currentWindow, {
        type: 'info',
        title: `Что нового в Hendrix ${releaseInfo.tag_name}`,
        message: releaseInfo.body
    });
    downloadUpdateStatusTimer = setInterval(() => {
        downloadUpdateStatus.textContent = `Скачиваю обновление${".".repeat(
            pointCount++ % 5
        )}`;
    }, 500);
    if (fs.existsSync(fullUpdaterPath)) {
        updaterDownloadProgress.textContent = 'Апдейтер обнаружен!';
        ipcRenderer.emit('updaterDownloadDone', null, {
            filePath: fullUpdaterPath
        });
    } else {
        const lastUpdaterInfo = await fetch(`https://api.github.com/repos/huhguz/hendrix-updater/releases/latest`);
        const jsonUpdaterInfo = await lastUpdaterInfo.json();
        const yourUpdaterDownload = jsonUpdaterInfo.assets.find(e => e.name == updaterPath);
        if (yourUpdaterDownload) {
            currentWindow.webContents.downloadURL(yourUpdaterDownload.browser_download_url);
        } else {
            const { response } = await dialog.showMessageBox(currentWindow, {
                type: 'error',
                title:  `Невозможно скачать апдейтер`,
                message: `Для вашей системы нет апдейтера. Вам придется вручную разархивировать архив с обновленной версией приложения в каталоге с программой. Открыть директорию приложения по окончанию загрузки обновления?`,
                buttons: ['Нет', 'Да']
            });
            openAppDirectoryAfterDownloadUpdate = response;
        }
    }
});

ipcRenderer.on('updaterDownloadProgress', (event, progress) => {
    updaterDownloadProgress.textContent = 'Загрузка апдейтера ' + (progress * 100).toFixed(3) + "%";
});

const updateProgress = getElem(`updateProgress`);

ipcRenderer.on(`updateProgress`, (event, progress) => {
    loadingUpdate.style.transform = `rotate(${progress * 360}deg)`;
    updateProgress.textContent = 'Загрузка приложения ' + (progress * 100).toFixed(3) + "%";
});

ipcRenderer.on(`updateDone`, (event, doneInfo) => {
    if (openAppDirectoryAfterDownloadUpdate) {
        shell.openExternal(process.cwd());
    }
    clearInterval(downloadUpdateStatus);
    clearInterval(downloadUpdateStatusTimer);
    downloadUpdateStatus.textContent = '';
    updateProgress.textContent = 'Загрузка обновления завершена!';
    if (doneInfo.state != "completed") {
        if (fs.existsSync(doneInfo.filePath)) {
            fs.unlinkSync(doneInfo.filePath);
        }
    }
});

(async () => {
    const [{filePath}] = await Promise.all([
        new Promise(resolve => {
            ipcRenderer.once(`updaterDownloadDone`, (event, doneInfo) => {
                resolve(doneInfo)
            });
        }),
        new Promise(resolve => {
            ipcRenderer.once(`updateDone`, (event, doneInfo) => {
                resolve(doneInfo)
            });
        })
    ]);
    child_process.exec(platform == 'win32' ? `start "" "${filePath}"` :  `xdg-open ${filePath}`, {
    }, () => {});
    await new Promise(res => setTimeout(res, 1000));
    remote.app.exit();
})();

getElem(`close-button`).addEventListener(`click`, () => {
    remote.app.quit();
});

getElem(`minimize-button`).addEventListener(`click`, () => {
    currentWindow.minimize();
});

const loadingUpdate = getElem(`loadingUpdate`);
const downloadUpdateStatus = getElem(`downloadUpdateStatus`);

let downloadUpdateStatusTimer;

let pointCount = 0;

document.addEventListener(`keydown`, e => {
    if (e.ctrlKey && e.key.match(/[rк]/i)) {
        e.preventDefault();
    }
});

document.addEventListener(`dragstart`, e => {
    e.preventDefault();
});
