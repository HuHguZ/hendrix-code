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
    dialog,
    BrowserWindow
} = remote;

const {
    screen
} = remote;

webFrame.setZoomFactor(1);
webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(0, 0);

const request = require(`request`);
const crypto = require(`crypto`);
const pbkdf2 = require(`pbkdf2`);
const jimp = require('jimp');
const fs = require(`fs`);
const path = require(`path`);
const os = require(`os`);
const v8 = require(`v8`);
const util = require(`util`);
const zlib = require(`zlib`);
const WebSocket = require(`ws`);
const net = require('net');
const {machineIdSync} = require(`node-machine-id`);
const child_process = require(`child_process`);
const {exec} = child_process;
const execAsync = util.promisify(exec);

const defaultAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACuElEQVR4Ae3BAQEAMAwCIG//znsQgXd3ATY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTCrAWY1wKwGmNUAsxpgVgPMaoBZDTDrA+fKBP2n2GLIAAAAAElFTkSuQmCC';

const {
    Readable
} = require(`stream`);

const queueSwal = swal => {
    const state = {
        free: true,
        queue: [],
    };
    const goToNextSwal = () => {
        const {
            params,
            resolve,
            callback
        } = state.queue.shift() || {};
        state.free = true;
        if (params) {
            showSwal(params, false, callback).then(resolve);
        }
    };
    const showSwal = (params, showNow, callback) => {
        if (state.free || showNow) {
            state.free = false;
            let currentSwal;
            try {
                currentSwal = swal(params);
                if (callback) {
                    callback();
                }
            } catch (e) {
                console.error(e);
                goToNextSwal();
                return Promise.resolve(null);
            }
            currentSwal.then(() => {
                goToNextSwal();
            });
            return currentSwal;
        } else {
            let resolve;
            const currentSwal = new Promise((res) => {
                resolve = res;
            });
            state.queue.push({
                params,
                resolve,
                callback
            });
            return currentSwal;
        }
    };
    return showSwal;
};

swal = queueSwal(swal);

let recorder;

const blobToBuffer = blob => new Promise(resolve => {
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(blob);
    fileReader.addEventListener(`loadend`, () => {
        resolve(Buffer.from(fileReader.result));
    });
});

const getAudioRec = () => new Promise(async (resolve, reject) => {
    try {
        const audioSource = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });
        resolve(new MediaRecorder(audioSource, {
            mimeType: `video/webm;codecs=h264,vp9,opus`
        }));
    } catch (e) {
        resolve(false);
    }
});

let currentWindow = remote.getCurrentWindow();

const encoding = `base64`;

const hashPassword = password => pbkdf2.pbkdf2Sync(password, ``, 10, 32, `sha512`).toString(`hex`);

const getDataProperty = async (data) => {
    data = Buffer.from(v8.serialize (data));
    return encryptAES(data, user.cipherInfo.symmetricKey, user.cipherInfo.iv).toString(encoding);
};

const getDecryptedData = async (data) => {
    data = Buffer.from(data, user.serverEncoding);
    return v8.deserialize(decryptAES(data, user.cipherInfo.symmetricKey, user.cipherInfo.iv));
};

fs.stat = util.promisify(fs.stat);
zlib.deflate = util.promisify(zlib.deflate);
zlib.unzip = util.promisify(zlib.unzip);
fs.readFile = util.promisify(fs.readFile);
fs.writeFile = util.promisify(fs.writeFile);
fs.rmdir = util.promisify(fs.rmdir);
fs.unlink = util.promisify(fs.unlink);

let hendrixdir = localStorage.getItem(`hendrixdir`) || path.join(os.homedir(), `Hendrix`);

fs.readdir(hendrixdir, (err, data) => {
    if (err) {
        fs.mkdir(hendrixdir, {
            recursive: true
        }, (err) => {
            if (err) throw err;
        });
    }
});

//размер чанка при передачи файлов 262144
const highWaterMark = 262144;

const version = remote.app.getVersion();

const getElem = id => document.getElementById(id);

let workerWindow;

const childWindows = currentWindow.getChildWindows();

if (!childWindows.length) {
    workerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
        },
        parent: currentWindow
    });
    workerWindow.loadFile(`indexWorker.html`);
} else {
    workerWindow = childWindows[0];
}

const childs = [];

getElem(`killAllPersons`).addEventListener(`click`, () => {
    ipcRenderer.send(`killAllPerons`);
});

getElem(`createNewPerson`).addEventListener(`click`, () => {
    const width = 800;
    const height = 600;
    const child = new BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        frame: false,
        show: false,
        icon: path.join(__dirname, `logo.png`),
        backgroundColor: `#17212b`,
        webPreferences: {
            zoomFactor: 1,
            devTools: false,
            textAreasAreResizable: false,
            nodeIntegration: true,
        }
    });
    childs.push(child);
    child.loadFile('index.html');
    child.once(`ready-to-show`, () => {
        child.show();
    });
    child.on('closed', function () {
        childs.splice(childs.indexOf(child), 1);
    });
});

global.showChangeDate = date => {
    showMessageBox(`Изменено в ${dateFormatter.format(new Date(date))}`);
};
global.copyText = text => {
    showMessageBox('Успешно скопировано в буфер обмена!');
    clipboard.writeText(text);
};
global.openLink = link => shell.openExternal(link);
global.openFile = fileId => {
    workerWindow.webContents.send('showItemInFolder', user.files[fileId].path);
};
global.describe = (description, num, showUsersInRoomAgain) => {
    const div = document.createElement(`div`);
    div.innerHTML = `<div class="h3">Подтверждённая сущность</div><img src ="styles/confirmed/${num}.png" style="height: 28px; margin-left:5px;"><div style="width:100%">${description}</div>`;
    div.classList.add(`des`);
    swal({
        content: div,
        button: false
    }, true).then(() => {
        if (showUsersInRoomAgain) {
            showUsersInRoom();
        }
    });
};

const getOpenWileWithDefProgramCommand = process.platform == `linux` ? filePath => `xdg-open ${filePath}` : filePath => `start "" "${filePath}"`;

global.openFileWithDefaultProgram = async fileId => {
    if (elements.openFilesInsecure.checked) {
        try {
            await execAsync(getOpenWileWithDefProgramCommand(user.files[fileId].path));
        } catch {}
    } else {
        showErrorModal(`Функция открытия файлов из мессенджера по умолчанию выключена в целях безопасности. Включите ее в настройках`);
    }
};

const elements = {
    minmax: getElem(`min-max-button`),
    main: getElem(`main`),
    chat: getElem(`chat`),
    servers: getElem(`servers`),
    serverMenu: getElem(`serverMenu`),
    rooms: getElem(`rooms`),
    inputMessage: getElem(`inputMessage`),
    dialog: getElem(`dialog`),
    titleText: getElem(`titleText`),
    usersInRoom: getElem(`usersInRoom`),
    send: getElem(`send`),
    clear: getElem(`clear`),
    hidden: getElem(`hidden`),
    connectToTheHiddenRoom: getElem(`connectToTheHiddenRoom`),
    scrolldown: getElem(`scrolldown`),
    AddRoomModalBody: getElem(`AddRoomModalBody`),
    roomFilter: getElem(`roomFilter`),
    typing: getElem(`typing`),
    settings: getElem(`settings`),
    settingsBlock: getElem(`settingsBlock`),
    notifications: getElem(`notifications`),
    changeAESkey: getElem(`changeAESkey`),
    difSounds: getElem(`difSounds`),
    curVolume: getElem(`curVolume`),
    volume: getElem(`volume`),
    openFilesInsecure: getElem(`openFilesInsecure`),
    money: getElem(`money`),
    moneyAccount: getElem(`moneyAccount`),
    oneToOneMessageSound: getElem(`oneToOneMessageSound`),
    add1: getElem(`add1`),
    showRoomsList: getElem(`showRoomsList`),
    audioRec: getElem(`audioRec`),
    webcamRec: getElem(`webcamRec`),
    screenRec: getElem(`screenRec`),
    saveFilesNames: getElem(`saveFilesNames`),
    deleteTextMessage: getElem('deleteTextMessage'),
    deleteYourFileMessage: getElem('deleteYourFileMessage'),
    deleteFileMessage: getElem('deleteFileMessage'),
    reconnect: getElem('reconnect'),
    showMessagesSettings: getElem('showMessagesSettings'),
    messagesSettings: getElem('messagesSettings'),
    messagesBackgroundColor: getElem('messagesBackgroundColor'),
    deletionMessageTimer: getElem('deletionMessageTimer'),
    sendMessageTimer: getElem('sendMessageTimer'),
    useNonStandardBackground: getElem('useNonStandardBackground'),
    saveListIgnoredUsers: getElem('saveListIgnoredUsers'),
    listIgnoredUsers: getElem('listIgnoredUsers'),
    viewListIgnoredUsers: getElem('viewListIgnoredUsers'),
    selectAvatar: getElem('selectAvatar'),
    avatarPreview: getElem('avatarPreview'),
    loadAvatar: getElem('loadAvatar'),
    deleteAvatar: getElem('deleteAvatar'),
    serverIp: getElem('serverIp'),
    serverPort: getElem('serverPort')
};

ipcRenderer.send(`openWindow`);

ipcRenderer.on(`openWindowNum`, async (event, arg) => {
    document.querySelector("body > div.title-bar > div.app-name-container").textContent = `HENDRIX ${arg}`;
    const title = `Hendrix ${arg}`;
    currentWindow.setTitle(title);
    setInterval(async () => {
        const windows = await desktopCapturer.getSources({
            types: [`window`],
            thumbnailSize: {
                width: 64,
                height: 64
            }
        });
        const curWindow = windows.find(e => e.name == title);
        if (!curWindow) {
            return;
        }
        ipcRenderer.send(`windowScreen`, {
            id: currentWindow.id,
            data: curWindow.thumbnail.toPNG()
        });
    }, 5000);
});

elements.notifications.addEventListener(`change`, function () {
    user.showNotifications = this.checked;
});

let dotsCount = 0;

let volume = +elements.volume.value;

const nowTypingList = {};

const typingTimers = {};

let server;

const sleep = time => new Promise(res => {
    setTimeout(() => {
        res(true);
    }, time);
});

const SSort = (func, a, ...args) => {
    let i = -1,
        c = [],
        res;
    const upgrade = f => ((...args) => (res = f.apply(this, args), c.push(res), res));
    func = upgrade(func);
    a.sort(func);
    for (let j = 0; j < args.length; j++) {
        args[j].sort(() => (i++, c[i]));
        i = -1;
    }
};

const encryptAES = (data, key, iv) => {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data);
    const final = cipher.final();
    encrypted = Buffer.concat([encrypted, final]);
    return encrypted;
}

const decryptAES = (data, key, iv) => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
};

const getRandomId = async (bytes = 32) => (await crypto.randomBytes(bytes)).toString(`hex`);

const testCipher = {
    symmetricKey: Buffer.from(hashPassword(`test`), 'hex'),
    iv: Buffer.alloc(16)
};
const testEncrypt = (text, cipherInfo) => decryptAES(encryptAES(Buffer.from(text), cipherInfo.symmetricKey, cipherInfo.iv), cipherInfo.symmetricKey, cipherInfo.iv) == text;

let waitReconnectTimer;

const requestPostAsync = (params, withoutTimer) => new Promise((resolve, reject) => {
    request.post(params, async (err, httpResponse, body) => {
        if (err && !waitReconnectTimer) {
            if (!withoutTimer) {
                waitReconnectTimer = true;
            }
            if (err.message.match(/(connect ECONNREFUSED)|(socket hang up)/i)) {
                const {response} = await dialog.showMessageBox(currentWindow, {
                    type: `error`,
                    title: `Что-то пошло не так...`,
                    message: `Вы не подключены к сети или неверно указали данные сервера. Что делать?`,
                    buttons: [`Выйти из Hendrix`, `Перезапустить Hendrix`, `Ничего`],
                });
                switch(response) {
                    case 1:
                        remote.app.relaunch();
                    case 0:
                        remote.app.quit();
                        break;
                    default:
                        if (!withoutTimer) {
                            waitReconnectTimer = setTimeout(() => {
                                waitReconnectTimer = false;
                            }, 60000);
                        }
                }
            }
            return resolve(false);
        }
        let json;
        try {
            json = JSON.parse(body);
        } catch (e) {
            return resolve(false);
        }
        resolve(json);
    });
});

const getFirstKeys = async () => {
    const ecdh = crypto.createECDH('secp521r1');
    ecdh.generateKeys();
    let syncSymmetricKey = await requestPostAsync({
        url: `${server}/syncSymmetricKey`,
        form: {
            publicKey: ecdh.getPublicKey().toString(encoding),
            encoding
        }
    });
    const secret = ecdh.computeSecret(Buffer.from(syncSymmetricKey.publicKey, syncSymmetricKey.encoding));
    user.cipherInfo = {
        symmetricKey: secret.slice(1, 33),
        iv: secret.slice(33, 49),
        rest: secret.slice(49)
    };
    user.secretString = await getRandomId();
    user.serverEncoding = syncSymmetricKey.encoding;
    user._machineId = hashPassword(machineIdSync({original: true}));
    const {userId} = await requestPostAsync({
        url: `${server}/savePerson`,
        form: {
            pos: syncSymmetricKey.pos,
            data: await getDataProperty({
                name: user.name,
                color: user.color,
                secretString: user.secretString,
                _token: user._token,
                _machineId: user._machineId //await getRandomId()|| 
            })
        }
    });
    user._id = userId;
    user.active = true;
};

const updateKeys = async () => {
    swal({
        text: `Обновляем сеансовые ключи. Пожалуйста, подождите...`,
        buttons: false
    }, true);
    await sleep(300);
    const ecdh = crypto.createECDH('secp521r1');
    ecdh.generateKeys();
    let updateSymmetricKey = await requestPostAsync({
        url: `${server}/updateSymmetricKey`,
        form: {
            data: await getDataProperty({
                publicKey: ecdh.getPublicKey().toString(encoding),
                secretString: user.secretString
            }),
            _id: user._id
        }
    });
    updateSymmetricKey = await getDecryptedData(updateSymmetricKey.data, user.serverEncoding);
    const secret = ecdh.computeSecret(updateSymmetricKey.publicKey);
    user.cipherInfo = {
        symmetricKey: secret.slice(1, 33),
        iv: secret.slice(33, 49),
        rest: secret.slice(49)
    };
    swal({
        text: `Обновление ключей завершено. Вы настоящий параноик!`,
        buttons: false
    }, true);
};

elements.changeAESkey.addEventListener(`click`, async () => {
    const {room} = user;
    if (room) {
        await user.disconnect();
    }
    await updateKeys();
    if (room) {
        connectToTheRoom(room.password, room._id, room.color, room.name);
    }
});

const showErrorModal = async text => await swal({
    title: `У-упс!`,
    text,
    icon: `error`,
    button: `Ой`
});

const showErrorDialog = async message => await dialog.showMessageBox(currentWindow, {
    type: `error`,
    title: `Ошибка!`,
    message
});

const showMessageBox = async message => await dialog.showMessageBox(currentWindow, {
    title: 'Hendrix',
    type: 'info',
    message
});

const defaultServers = `<tbody><tr><th>Название комнаты</th><th>Участников</th><th>Защищена</th></tr>`;

const showUsersInRoom = async () => {
    if (user.room) {
        //отображаем все комнаты, чтобы _id комнаты пользователя 100% был доступен
        await showRooms();
        const room = rooms[user.room._id];
        if (!room) {
            return showErrorModal(`Нельзя просматривать участников скрытых комнат!`);
        }
        let {members} = await requestPostAsync({
            url: `${server}/getUsersInRoom`,
            form: {
                data: await getDataProperty(user.room),
                _id: user._id
            }
        });
        if (!members) {
            return;
        }
        let r = ``;
        members = await getDecryptedData(members);
        members.forEach(member => {
            let additional = ``;
            if (member.creator) {
                additional += `<img src="styles/crown.png" style="height: 18px; margin-left: 2px;">`;
            }
            if (member.badges) {
                member.badges.forEach(bdg => {
                    additional += `<img src="styles/confirmed/${bdg.badge}.png" class="confirmed" onclick="describe('${bdg.description}', ${bdg.badge}, true)">`;
                });
            }
            r += `<div class="member" style="color: ${member.color}"><span onclick="copyText('${member._id}')" class="user">${member.name}</span>${additional}</div>`;
        });
        const div = document.createElement(`div`);
        div.innerHTML = `<h3>Участники комнаты <span style="color: ${room.color}">${room.name}</span></h3>${r}`;
        swal({
            content: div,
            button: false
        });
    }
}

const searchUpElement = (elem, selector) => elem.closest(selector);

const fileMessageMenu = [
    {
        name: "Удалить",
        fn: async function(target) {
            const messageBlock = searchUpElement(target, '.fileMsg');
            const messageId = messageBlock.getAttribute('messageid');
            const fileId = messageBlock.getAttribute('fileid');
            const userId = messageBlock.getAttribute('userid');
            if (!messageId) {
                return showErrorModal('Данное сообщение невозможно идентифицировать!');
            }
            if (user._id != userId) {
                elements.deleteFileMessage.style.display = 'block';
                const deleteFileMsg = await swal({
                    title: 'Удаление сообщения',
                    content: elements.deleteFileMessage,
                    buttons: ['Нет', 'Да']
                });
                if (deleteFileMsg) {
                    deleteElementWithAnimation(messageBlock);
                    const filePath = path.join(hendrixdir, fileId);
                    if (elements.deleteFileMessage.querySelector('#deleteFile').checked && fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            } else {
                elements.deleteYourFileMessage.style.display = 'block';
                const deleteFileMsg = await swal({
                    title: 'Удаление сообщения',
                    content: elements.deleteYourFileMessage,
                    buttons: ['Нет', 'Да']
                });
                if (deleteFileMsg) {
                    deleteElementWithAnimation(messageBlock);
                    const fileDeletion = elements.deleteYourFileMessage.querySelector('#deleteYourFile').checked;
                    if (fileDeletion) {
                        const filePath = path.join(hendrixdir, fileId);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                    if (elements.deleteYourFileMessage.querySelector('#deleteYourFileForAll').checked) {
                        sendMessageToRoom({
                            action: 'delete',
                            messageId,
                            fileDeletion,
                            deleteId: messageId
                        });
                    }
                }
            }
        }
    },
    {
        name: "Сохранить как",
        async fn(target) {
            const fileId = searchUpElement(target, '.fileMsg').getAttribute('fileid');
            if (fileId && fs.existsSync(path.join(hendrixdir, fileId))) {
                const {filePath} = await dialog.showSaveDialog(currentWindow, {
                    defaultPath: await getRandomId(12),
                    filters: [{
                        name: '',
                        extensions: [path.extname(fileId).slice(1)]
                    }]
                });
                if (filePath) {
                    fs.createReadStream(path.join(hendrixdir, fileId)).pipe(fs.createWriteStream(filePath));
                }
            } else {
                showErrorModal('Файл не найден!');
            }
        }
    },
    {
        name: "Показать",
        fn(target) {
            const fileId = searchUpElement(target, '.fileMsg').getAttribute('fileid');
            if (fileId) {
                openFile(fileId);
            }
        }
    },
    {
        name: "Запустить",
        fn(target) {
            const fileId = searchUpElement(target, '.fileMsg').getAttribute('fileid');
            if (fileId) {
                openFileWithDefaultProgram(fileId);
            }
        }
    }
];

const textMessageMenu = [
    {
        name: "Удалить",
        fn: async function(target) {
            const messageBlock = searchUpElement(target, '.textMsg');
            const messageId = messageBlock.getAttribute('messageid');
            const userId = messageBlock.getAttribute('userid');
            if (user._id != userId) {
                const deleteMsg = await swal({
                    title: 'Удаление сообщения',
                    text: 'Удалить сообщение?',
                    buttons: ['Нет', 'Да']
                });
                if (deleteMsg) {
                    deleteElementWithAnimation(messageBlock);
                }
            } else {
                elements.deleteTextMessage.style.display = 'block';
                const deleteMsg = await swal({
                    title: 'Удаление сообщения',
                    content: elements.deleteTextMessage,
                    buttons: ['Нет', 'Да']
                });
                if (deleteMsg) {
                    deleteElementWithAnimation(messageBlock);
                    if (elements.deleteTextMessage.querySelector('#deleteForAll').checked) {
                        sendMessageToRoom({
                            action: 'delete',
                            deleteId: messageId
                        });
                    }
                }
            }
        }
    },
    {
        name: "Изменить",
        fn(target) {
            const messageBlock = searchUpElement(target, '.textMsg');
            const messageId = messageBlock.getAttribute('messageid');
            const userId = messageBlock.getAttribute('userid');
            if (userId != user._id) {
                return showErrorModal('Изменить можно только свое сообщение!');
            }
            const pre = messageBlock.querySelector('.message');
            pre.contentEditable = true;
            pre.focus();
            pre.addEventListener('keydown', pageUpDownEscChecker);
            pre.addEventListener(`paste`, pasteInputHandler);
            pre.addEventListener('blur', function () {
                this.contentEditable = false;
                pre.removeEventListener('keydown', pageUpDownEscChecker);
                pre.removeEventListener(`paste`, pasteInputHandler);
                sendMessageToRoom({
                    action: 'changeMessage',
                    changedId: messageId,
                    content: pre.innerHTML
                });
            }, {
                once: true
            });
        }
    }
];

const pageUpDownEscChecker = function (e) {
    if (/page((up)|(down))/i.test(e.key)) {
        e.preventDefault();
    } else if (/escape/i.test(e.key)) {
        this.blur();
    }
};

const deleteElementWithAnimation = element => {
    let {height, padding} = getComputedStyle(element);
    [height] = height.match(/\d+/g);
    [padding] = padding.match(/\d+/g);
    animate({
        timing: t => t,
        draw(progress) {
            const coef = 1 - progress;
            element.style.opacity = coef;
            element.style.transform = `scale(1, ${coef})`;
            element.style.height = `${coef * height}px`;
            element.style.padding = `${coef * padding}px`;
        },
        duration: 250,
        endAnimation() {
            element.remove();
        }
    });
};

new ContextMenu('.textMsg', textMessageMenu);
new ContextMenu('.fileMsg', fileMessageMenu);

const createFileWebSocket = async room => {
    const roomFileSocket = new WebSocket(`${server}/fileSocket?userId=${user._id}&roomData=${encodeURIComponent(await getDataProperty(room))}`);
    roomFileSocket.on(`message`, (async function(data) {
        const message = v8.deserialize(decryptAES(data, user.cipherInfo.symmetricKey, user.cipherInfo.iv));
        let additional = ``;
        if (message.confirmed) {
            message.badges.forEach(bdg => {
                additional += `<img src="styles/confirmed/${bdg.badge}.png" class="confirmed" onclick="describe('${bdg.description}', ${bdg.badge})">`;
            });
        }
        const date = new Date();
        const hours = date.getHours().toString();
        const minutes = date.getMinutes().toString();
        const seconds = date.getSeconds().toString();
        message.date = date;
        const {
            ext,
            fileId: tmpId,
            filePart,
            position,
            progress
        } = message.file;
        const fileId = tmpId + ext;
        if (fs.existsSync(path.join(hendrixdir, fileId)) && (!this.files[fileId] || !this.files[fileId].writeStream)) {
            return;
        }
        if (message.file.ready) {
            if (this.files[fileId].writeStream) {
                if (this.files[fileId].positions[0] == 1 && this.files[fileId].positions.every((e, p, a) => !p || e - a[p - 1] == 1)) {
                    this.files[fileId].writeStream.end();
                    await waitWriteStream(this.files[fileId].writeStream);
                } else {
                    showErrorModal(`Файл ${this.files[fileId].path} повреждён!`);
                }
            }
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (this.showNotifications && (!focusedWindow || focusedWindow.id != currentWindow.id)) {
                const note = {
                    name: message.name,
                    color: message.color
                };
                if (ext.match(/(png)|(jpg)|(gif)|(jpeg)/i)) {
                    note.image = this.files[fileId].path;
                }
                ipcRenderer.send(`notification`, note);
            }
            delete this.files[fileId].writeStream;
            delete this.files[fileId].parts;
            delete this.files[fileId].positions;
            let desc = this.files[fileId].info && this.files[fileId].info.description;
            let ht = this.files[fileId].info && desc ? `<span>${desc}</span><br>` : ``;
            this.files[fileId].fileMsg.msg.innerHTML =
            `${ext.match(/(png)|(jpg)|(gif)|(jpeg)/i) ?
            `<img src="${this.files[fileId].path}" style="max-width: 100%">`
            : ext.match(/(mp3)|(wav)|(ogg)/i) ?
            `<audio src="${this.files[fileId].path}" controls></audio>`
            : ext.match(/(mp4)|(webm)|(ogv)/i) ?
            `<video src="${this.files[fileId].path}" controls></video>`
            : `<span class="readyFile"><span class="lnk" onclick="openFile('${fileId}')">${fileId}</span><img onclick="openFileWithDefaultProgram('${fileId}')" class="launchImage" src="styles/start.png" class="launcIcon">`}<br>${ht}</span>`;
            delete this.files[fileId].fileMsg;
            if (message.user == this._id && +elements.deletionMessageTimer.value) {
                const {messageId} = this.files[fileId];
                setTimeout(() => {
                    sendMessageToRoom({
                        action: 'delete',
                        messageId,
                        fileDeletion: true,
                        deleteId: messageId
                    });
                }, elements.deletionMessageTimer.value * 1000);
            }
        } else {
            if (!this.files[fileId]) {
                const fileBlock = createMessageBlock(message.color, `<span onclick="copyText('${message.user}')" class="user">${message.name}</span>${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`, message._id, message.user, fileId, message.user == user._id ? user.avatar : user.cachedAvatars[message.user]);
                if (message.file.backgroundColor) {
                    fileBlock.messageBlock.style.backgroundColor =  message.file.backgroundColor;
                }
                elements.dialog.appendChild(fileBlock.messageBlock);
                animate({
                    timing: circAnimateFunc,
                    draw(progress) {
                        fileBlock.messageBlock.style.opacity = progress;
                    },
                    duration: 200,
                    endAnimation: () => {
                        addMessageSound(message, this);
                    }
                });
                scroll();
                this.files[fileId] = {
                    path: path.join(hendrixdir, `${fileId}`),
                    positions: [position],
                    fileMsg: fileBlock.childs.msgBlock,
                    linkCreated: false,
                    messageId: message._id
                };
                if (message.file.info) {
                    this.files[fileId].info = message.file.info;
                }
                this.files[fileId].writeStream = fs.createWriteStream(this.files[fileId].path);
                this.files[fileId].writeStream.write(filePart);
            } else {
                this.files[fileId].positions.push(position);
                if (this.files[fileId].writeStream.writable) {
                    this.files[fileId].writeStream.write(filePart);
                }
            }
            if (!this.files[fileId].linkCreated) {
                this.files[fileId].fileMsg.fileLink.innerHTML = `<span class="sendFile"><img src="styles/file.png" style="-webkit-user-select: none;height: 16px;margin-right: 5px;"><span class="lnk" onclick="openFile('${fileId}')">${fileId} </span></span>`;
                this.files[fileId].linkCreated = true;
            }
            this.files[fileId].fileMsg.fileProgress.innerHTML = `(${(progress * 100).toFixed(3)}%)`;
        }
    }).bind(user));
    user.roomFileSocket = roomFileSocket;
    roomFileSocket.on(`close`, code => {
        if (user.room) {
            createFileWebSocket(user.room);
        }
    });
};

const sendMessageToRoom = message => {
    if (user.room && user.roomSocket.readyState == WebSocket.OPEN) {
        user.roomSocket.send(encryptAES(v8.serialize(message), user.cipherInfo.symmetricKey, user.cipherInfo.iv));
    }
};

const dateFormatter = new Intl.DateTimeFormat("ru", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  });

const connectToTheRoom = async (password, _id, color, name) => {
    const room = {
        password,
        _id,
        color,
        name
    };
    if (user.roomsHistory[_id]) {
        elements.dialog.innerHTML = user.roomsHistory[_id];
        elements.dialog.dispatchEvent(new CustomEvent(`scroll`));
    }
    const roomSocket = new WebSocket(`${server}/logIn?userId=${user._id}&roomData=${encodeURIComponent(await getDataProperty(room))}`);
    roomSocket.on(`message`, (async function(data) {
        const date = new Date();
        const message = v8.deserialize(decryptAES(data, user.cipherInfo.symmetricKey, user.cipherInfo.iv));
        if (message.action) {
            switch (message.action) {
                case 'connected':
                    const {connectedId} = message;
                    if (connectedId != user._id) {
                        user.cachedAvatars[connectedId] = message.avatar;
                    }
                    break;
                case 'disconnected':
                    const {disconnectedId} = message;
                    delete user.cachedAvatars[disconnectedId];
                    break;
                case 'typing':
                    if (message.user != this._id) {
                        nowTypingList[message.user] = `<span style="color:${message.color}"><b>${message.name}</b></span>`;
                        if (typingTimers[message.user]) {
                            clearTimeout(typingTimers[message.user]);
                        }
                        typingTimers[message.user] = setTimeout(() => {
                            delete nowTypingList[message.user];
                        }, 5000);
                    }
                    break;
                case 'delete':
                    const deletedMessage = document.querySelector(`[messageid="${message.deleteId}"]`);
                    const dumpDeleteIndex = this._dump.findIndex(msg => msg._id == message.deleteId);
                    if (~dumpDeleteIndex) {
                        this._dump.splice(dumpDeleteIndex, 1);
                    }
                    if (deletedMessage && message.user == deletedMessage.getAttribute('userid')) {
                        deleteElementWithAnimation(deletedMessage);
                        if (message.fileDeletion) {
                            const filePath = path.join(hendrixdir, deletedMessage.getAttribute('fileid'));
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        }
                    }
                    break;
                case 'changeMessage':
                    const changedMessage = document.querySelector(`[messageid="${message.changedId}"]`);
                    if (changedMessage && message.user == changedMessage.getAttribute('userid')) {
                        changedMessage.querySelector('.message').innerHTML = parseStyles(message.content);
                        const nameBlock = changedMessage.querySelector('.name');
                        let changeSpan = nameBlock.querySelector('.changeBlock');
                        if (!changeSpan) {
                            changeSpan = document.createElement('span');
                            changeSpan.classList.add('changeBlock');
                            changeSpan.textContent = 'Изменено';
                            nameBlock.appendChild(changeSpan);
                        }
                        changeSpan.setAttribute('onclick', `showChangeDate('${date.toString()}')`);
                    }
                    break;
                case 'changeAvatar':
                    if (message.user != user._id) {
                        user.cachedAvatars[message.user] = message.newAvatar;
                    }
                    break;
            }
            if (!message.system) {
                return;
            }
        }
        let additional = ``;
        if (message.confirmed) {
            message.badges.forEach(bdg => {
                additional += `<img src="styles/confirmed/${bdg.badge}.png" class="confirmed" onclick="describe('${bdg.description}', ${bdg.badge})">`;
            });
        }
        const hours = date.getHours().toString();
        const minutes = date.getMinutes().toString();
        const seconds = date.getSeconds().toString();
        message.date = date;
        if (nowTypingList[message.user] && typingTimers[message.user]) {
            clearTimeout(typingTimers[message.user]);
            delete typingTimers[message.user];
            delete nowTypingList[message.user];
        }
        const obj = {
            '<': `&lt;`,
            '>': `&gt;`
        };
        let {message: text} = message;
        text = text.replace(/(<)|(>)/g, match => obj[match]).replace(/\b(((https?|ftp):\/\/|www\.)[^\s]+)/g, link => `<span class="lnk" onclick="openLink('${link}');">${link}</span>`);
        text = parseStyles(text); //парсим мои стили
        message.message = text;
        this._dump.push(message);
        let nameBlock;
        if (message.user) {
            nameBlock = `<span onclick="copyText('${message.user}')" class="user" style="color:${message.color}">${message.name}</span>`;
        } else {
            nameBlock = `<span style="color:${message.color}">${message.name}</span>`;;
        }
        elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock({
            nameBlock: `${nameBlock}${additional}`,
            date: `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`,
            message: text,
            backgroundClr: message.backgroundColor,
            messageId: message._id,
            userId: message.user || message.name,
            backgroundImg: message.user == user._id ? user.avatar : user.cachedAvatars[message.user]
        }));
        elements.dialog.dispatchEvent(new CustomEvent(`scroll`));
        const messageElement = document.querySelector(`[messageid="${message._id}"]`);
        animate({
            timing: circAnimateFunc,
            draw(progress) {
                messageElement.style.opacity = progress;
            },
            duration: 200,
            endAnimation: () => {
                addMessageSound(message, this);
            }
        });
        if (message.user == this._id && +elements.deletionMessageTimer.value) {
            setTimeout(() => {
                sendMessageToRoom({
                    action: 'delete',
                    deleteId: message._id
                });
            }, elements.deletionMessageTimer.value * 1000);
        }
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (message.name && message.message && message.color && this.showNotifications && (!focusedWindow || focusedWindow.id != currentWindow.id)) {
            ipcRenderer.send(`notification`, {
                name: message.name,
                text: message.message,
                color: message.color
            });
        }
        scroll();
    }).bind(user));
    roomSocket.on(`close`, async (code, reason) => {
        for (const fileId in user.files) {
            if (user.files[fileId].writeStream) {
                user.files[fileId].writeStream.end();
            }
        }
        if (code == 1006) {
            showErrorModal(`Вы отключены из комнаты ${user.room.name} по причине потери подключения к серверу!`);
        } else if (code == 4001) {
            showErrorModal(`Вы забанены в комнате ${user.room.name} !`);
            await user.disconnect();
        }
        if (user.room && ![4000, 4001].includes(code)) {
            const oldRoom = user.room;
            await user.disconnect();
            const reconnect = await swal({
                title: `Переподключение`,
                text: `Переподключиться к комнате ${oldRoom.name} ?`,
                buttons: ["Нет", "Да"],
                icon: "warning",
            });
            if (reconnect) {
                await connectToTheRoom(oldRoom.password, oldRoom._id, oldRoom.color, oldRoom.name);
            }
        } else {
            await user.disconnect();
        }
    });
    createFileWebSocket(room);
    user.roomSocket = roomSocket;
    user.room = room;
    getElem(`message`).style.display = `flex`;
    animate({
        timing: makeEaseOut(circAnimateFunc),
        draw(progress) {
            elements.chat.style.gridTemplateRows = `minmax(18px, 3vh) ${100 - 20 * progress}vh 3vh 11vh 5vh`;
        },
        duration: 200
    });
    elements.titleText.innerHTML = `<span class="header" data-title='Нажмите для отображения участников комнаты' style="color: ${color}">${name}</span>`;
    document.getElementsByClassName(`header`)[0].addEventListener(`click`, () => {
        showUsersInRoom();
    });
    let {roomUsersIds} = await requestPostAsync({
        url: `${server}/getUsersIdsInRoom`,
        form: {
            data: await getDataProperty({
                password,
                _id,
            }),
            _id: user._id
        }
    });
    if (!roomUsersIds) {
        return;
    }
    roomUsersIds = await getDecryptedData(roomUsersIds);
    for (let i = 0; i < roomUsersIds.length; i++) {
        if (roomUsersIds[i] == user._id) {
            continue;
        }
        let {userAvatar} = await requestPostAsync({
            url: `${server}/getUserAvatar`,
            form: {
                data: await getDataProperty({
                    password,
                    _id,
                    userId: roomUsersIds[i]
                }),
                _id: user._id
            }
        });
        if (!userAvatar) {
            continue;
        }
        userAvatar = await getDecryptedData(userAvatar);
        user.cachedAvatars[roomUsersIds[i]] = userAvatar;
    }
};

const checkPasswordRoom = async (password, _id) => {
    return await requestPostAsync({
        url: `${server}/logIn`,
        form: {
            data: await getDataProperty({
                password,
                _id,
                check: true
            }),
            _id: user._id
        }
    });
};

const showRooms = async () => {
    const answer = (await requestPostAsync({
        url: `${server}/getPublicRooms`,
        form: {
            _id: user._id
        }
    })).data;
    if (!answer) {
        return;
    }
    rooms = await getDecryptedData(answer);
    let r = ``;
    for (let roomId in rooms) {
        const room = rooms[roomId];
        r += `
        <tr class="room" roomId="${roomId}">
            <td>
                <span style="color:${room.color}">${room.name}</span>
            </td>
            <td>
                ${room.members}
            </td>
            <td>
                <span style="color:${[`#ff0000`, `#00ff00`][+room.passwordProtected]}"><b>${[`Нет`, `Да`][+room.passwordProtected]}</b></span>
            </td>
        </tr>`;
    }
    elements.rooms.innerHTML = `${defaultServers}${r}</tbody>`;
    return true;
};

let user; //объект пользователя
let rooms;

elements.rooms.addEventListener('click', async e => {
    const tr = e.target.closest('.room');
    if (!tr) {
        return;
    }
    const _id = tr.getAttribute(`roomId`);
    if (user.room && user.room._id == _id) {
        return showErrorModal(`Вы уже находитесь в этой комнате!`);
    }
    const roomData = rooms[_id];
    const {
        color
    } = roomData;
    if (!roomData.passwordProtected) {
        const result = await swal({
            title: `Подключение к комнате ${roomData.name}`,
            text: `Данная комната не запаролена. Подключиться к ней?`,
            buttons: ["Отмена", "Подключиться"]
        });
        if (result) {
            let auth = await checkPasswordRoom(``, _id);
            if (auth.logIn) {
                if (user.room) {
                    await user.disconnect();
                }
                await connectToTheRoom(``, _id, color, roomData.name);
            } else {
                if (auth.banned) {
                    showErrorModal(`Вы забанены в этой комнате!`);
                } else if (auth.multi) {
                    showErrorModal(`Вы уже есть в этой комнате в одном из окон!`);
                } else {
                    showErrorModal(`Комнаты не существует!`);
                }
            }
        }
    } else {
        let password = await swal({
            title: `Подключение к комнате ${roomData.name}`,
            text: "Введите пароль для подтверждения",
            content: {
                element: "input",
                attributes: {
                    type: "password",
                },
            },
            buttons: ["Отмена", "Подключиться"],
        });
        if (typeof password == `string`) {
            password = hashPassword(password);
            let r = await checkPasswordRoom(password, _id);
            if (r.logIn) {
                if (user.room) {
                    await user.disconnect();
                }
                await connectToTheRoom(password, _id, color, roomData.name);
            } else {
                if (r.banned) {
                    showErrorModal(`Вы забанены в этой комнате!`);
                } else if (r.multi) {
                    showErrorModal(`Вы уже есть в этой комнате в одном из окон!`);
                } else {
                    showErrorModal(`Неправильный пароль!`);
                }
            }
        }
    }
});

elements.connectToTheHiddenRoom.addEventListener(`click`, () => {
    swal({
        title: `Подключение к скрытой комнате`,
        text: "Введите Id комнаты",
        content: {
            element: "input",
            attributes: {
                type: "password",
            },
        },
        buttons: ["Отмена", "Подключиться"],
    }).then(async roomId => {
        if (typeof roomId == `string`) {
            if (user.room && user.room._id == roomId) {
                return showErrorModal(`Вы уже находитесь в этой комнате!`);
            }
            const checkRespone = await requestPostAsync({
                url: `${server}/checkHiddenRoom`,
                form: {
                    data: await getDataProperty({roomId}),
                    _id: user._id
                }
            });
            const data = await getDecryptedData(checkRespone.data);
            if (data.logIn) {
                if (user.room) {
                    await user.disconnect();
                }
                await connectToTheRoom(``, roomId, data.color, data.name);
            } else {
                showErrorModal(`Комнаты не существует!`);
            }
        }
    });
});

//disable browser drag and drop
document.addEventListener(`dragstart`, e => {
    e.preventDefault();
})

//disable mouse wheel scroll
document.addEventListener(`mousedown`, e => {
    if (e.which == 2 && !e.path.includes(elements.dialog)) {
        e.preventDefault();
    }
});

//disable page refresh
// document.addEventListener(`keydown`, e => {
//     if (e.ctrlKey && e.key.match(/[rк]/i)) {
//         e.preventDefault();
//     }
// });

elements.selectAvatar.addEventListener('click', async () => {
    const {
        filePaths: [avatarPath]
    } = await dialog.showOpenDialog(currentWindow, {
        properties: [`openFile`]
    });
    if (avatarPath) {
        try {
            const img = await jimp.read(await fs.promises.readFile(avatarPath));
            user.avatar = await img.resize(48, 48).getBase64Async(jimp.MIME_PNG);
            avatarPreview.innerHTML = `<img src="${user.avatar}">`;
            localStorage.avatar = user.avatar;
        } catch (e) {
            showErrorDialog('Содержимое файла не похоже на изображение!');
        }
    }
});

elements.loadAvatar.addEventListener('click', async () => {
    if (user.avatar) {
        const {success} = await requestPostAsync({
            url: `${server}/loadUserAvatar`,
            form: {
                data: await getDataProperty(user.avatar),
                _id: user._id
            }
        });
        if (success) {
            sendMessageToRoom({
                action: 'changeAvatar',
                newAvatar: user.avatar
            });
            showMessageBox('Аватар успешно загружен!');
        } else {
            showErrorDialog('Не удалось загрузить аватар на сервер. Попробуйте еще раз!');
        }
    } else {
        showErrorDialog('Вы не выбрали аватар!');
    }
});

elements.deleteAvatar.addEventListener('click', async () => {
    if (user.avatar) {
        delete user.avatar;
        delete localStorage.avatar;
        elements.avatarPreview.innerHTML = '';
        const {success} = await requestPostAsync({
            url: `${server}/loadUserAvatar`,
            form: {
                data: await getDataProperty(""),
                _id: user._id
            }
        });
        if (!success) {
            showMessageBox('Аватар успешно удален!');
        }
    } else {
        showErrorDialog('Нечего удалять!');
    }
});

getElem(`updateFolder`).addEventListener(`click`, async () => {
    const [newFolder] = (await dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        properties: [`openDirectory`]
    })).filePaths;
    if (newFolder) {
        hendrixdir = newFolder;
        getElem(`downloads`).value = hendrixdir;
        localStorage.setItem(`hendrixdir`, hendrixdir);
    }
});

elements.volume.addEventListener(`change`, function () {
    volume = +this.value;
    elements.curVolume.textContent = `${(this.value * 100).toFixed(0)}%`;
    playSound(getOutSound());
});

getElem(`folder`).addEventListener(`click`, () => {
    shell.openItem(hendrixdir);
});

elements.useNonStandardBackground.addEventListener('change', function(e) {
    if (this.checked) {
        user.messagesBackgroundColor = `#${elements.messagesBackgroundColor.value}`;
    } else {
        delete user.messagesBackgroundColor;
    }
});

elements.messagesBackgroundColor.addEventListener('change', function(e) {
    user.messagesBackgroundColor = `#${this.value}`;
});

elements.settings.addEventListener(`click`, () => {
    elements.settingsBlock.style.display = `block`;
    elements.curVolume.textContent = `${(elements.volume.value * 100).toFixed(0)}%`;
    swal({
        content: elements.settingsBlock,
        button: false
    });
    getElem(`downloads`).value = hendrixdir;
});

elements.showMessagesSettings.addEventListener('click', async () => {
    elements.messagesSettings.style.display = `block`;
    await swal({
        content: elements.messagesSettings,
        button: false
    }, true);
    swal({
        content: elements.settingsBlock,
        button: false
    });
});

getElem(`clearAllDownloads`).addEventListener(`click`, async () => {
    const paths = fs.readdirSync(hendrixdir).map(name => path.join(hendrixdir, name));
    let deletedSize = 0;
    for (let i = 0; i < paths.length; i++) {
        const stat = fs.statSync(paths[i]);
        if (stat.isFile()) {
            deletedSize += stat.size;
        }
    }
    const answer = await swal({
        title: `Очистка папки загрузок`,
        text: `Вы уверены, что хотите очистить папку загрузок? Будет освобождено ${(deletedSize / 1024 / 1024).toFixed(3)} Мб`,
        buttons: [`Нет`, `Да`]
    }, true);
    if (answer) {
        let deletedCount = 0;
        for (let i = 0; i < paths.length; i++) {
            const stat = fs.statSync(paths[i]);
            if (stat.isFile()) {
                fs.unlinkSync(paths[i]);
                deletedCount++;
            }
        }
        await swal({
            text: `Успешно удалено ${deletedCount} файлов суммарным размером в ${(deletedSize / 1024 / 1024).toFixed(3)} Мб!`,
            buttons: false
        }, true);
    }
    swal({
        content: elements.settingsBlock,
        button: false
    });
});

const getOneToOneSound = () => {
    return `sounds/onetoone/${elements.difSounds.checked ? (Math.random() * 7 ^ 0) + 1 : 1}.mp3`;
};

const getOutSound = () => {
    return `sounds/out/${elements.difSounds.checked ? (Math.random() * 7 ^ 0) + 1 : 1}.mp3`;
};

const getInpSound = () => {
    return `sounds/inp/${elements.difSounds.checked ? (Math.random() * 7 ^ 0) + 1 : 1}.mp3`;
};

const playSound = src => new Promise(resolve => {
    const sound = new Audio(src);
    sound.volume = volume;
    sound.play();
    sound.addEventListener(`ended`, resolve);
});

const playSoundSpecial = (src, volume = 1) =>
new Promise(resolve => {
  const sound = new Audio(src);
  sound.volume = volume;
  sound.play();
  let now = performance.now();
  let soundTimer = setInterval(() => {
        if (performance.now() - now >= sound.duration * 1000 - 60) { //local 45 inet 75  75 30
            clearInterval(soundTimer);
            resolve(`ended`);
        }
    });
});

const clearDataFlag = document.createElement(`input`);
clearDataFlag.setAttribute(`type`, `checkbox`);
const clearDataLabel = document.createElement('label');
clearDataLabel.classList.add('switch');
clearDataLabel.style.marginLeft = '5px';
clearDataLabel.appendChild(clearDataFlag);
const checkboxSpan = document.createElement('span');
checkboxSpan.classList.add('slider');
checkboxSpan.classList.add('round');
clearDataLabel.appendChild(checkboxSpan);
const closeWindowButton = document.createElement(`button`);
closeWindowButton.textContent = `Закрыть это окно`;

closeWindowButton.addEventListener(`click`, () => {
    currentWindow.close();
});

getElem(`exit-button`).addEventListener(`click`, () => {
    const div = document.createElement(`div`);
    div.textContent = `Вы уверены, что хотите выйти из Hendrix?`;
    const delDataDiv = document.createElement(`div`);
    delDataDiv.className = `des`;
    delDataDiv.textContent = `Стереть локальные данные`;
    delDataDiv.appendChild(clearDataLabel);
    div.appendChild(delDataDiv);
    div.appendChild(closeWindowButton);
    swal({
        title: `Выход`,
        content: div,
        buttons: ["Отмена", "Да"],
        icon: "warning",
    }).then(async answer => {
        if (answer) {
            if (user.room) {
                await user.disconnect();
            }
            if (clearDataFlag.checked) {
                localStorage.clear();
            }
            remote.app.quit();
        }
    });
});

getElem(`minimize-button`).addEventListener(`click`, () => {
    currentWindow.minimize();
});

getElem(`min-max-button`).addEventListener(`click`, () => {
    if (currentWindow.isMaximized()) {
        currentWindow.unmaximize();
        elements.minmax.style.backgroundImage = `url(styles/max.png)`;
    } else {
        currentWindow.maximize();
        elements.minmax.style.backgroundImage = `url(styles/min.png)`;
    }
});

setInterval(() => {
    if (!currentWindow.isMaximized()) {
        elements.minmax.style.backgroundImage = `url(styles/max.png)`;
    } else {
        elements.minmax.style.backgroundImage = `url(styles/min.png)`;
    }
}, 50);

elements.servers.addEventListener(`mouseover`, () => {
    elements.serverMenu.style.opacity = 1;
});

elements.servers.addEventListener(`mouseout`, () => {
    elements.serverMenu.style.opacity = 0;
});

elements.clear.addEventListener(`click`, async () => {
    playSound(`sounds/clear.mp3`);
    elements.dialog.childNodes.forEach(node => {
        if (node.tagName == 'DIV') {
            deleteElementWithAnimation(node);
        }
    });
    await sleep(250);
    elements.dialog.dispatchEvent(new CustomEvent(`scroll`));
    user._dump = [];
    user._history = [];
    user._historyPos = -1;
});

let scrollCondPast;

elements.dialog.addEventListener(`scroll`, function (e) {
    const scrollCond = this.scrollHeight - (this.scrollTop + this.clientHeight) > 400;
    if (scrollCond ^ scrollCondPast) { //если не равны, то есть условие переключилось, меняем состояние
        if (scrollCond) {
            animate({
                timing: makeEaseOut(circAnimateFunc),
                draw(progress) {
                    elements.scrolldown.style.bottom = `${10 + progress * 6.5}vh`;
                    elements.scrolldown.style.transform = `rotate(${(1 - progress) * 180}deg)`;
                },
                duration: 200
            });
            elements.scrolldown.addEventListener(`click`, () => {
                const curPos = elements.dialog.scrollTop;
                elements.dialog.scrollTo(0, elements.dialog.scrollHeight);
                const maxScrollHeight = elements.dialog.scrollTop;
                elements.dialog.scrollTo(0, curPos);
                animate({
                    timing: makeEaseOut(circAnimateFunc),
                    draw(progress) {
                        if (!progress) {
                            progress = 0;
                        }
                        elements.dialog.scrollTo(0, curPos + (maxScrollHeight - curPos) * progress);
                    },
                    duration: 1000,
                    endAnimation() {
                        nowScrollDown = false;
                    }
                });
            }, {
                once: true
            });
        } else {
            animate({
                timing: circAnimateFunc,
                draw(progress) {
                    elements.scrolldown.style.bottom = `${16.5 - progress * 6.5}vh`;
                    elements.scrolldown.style.transform = `rotate(${-progress * 180}deg)`;
                },
                duration: 200
            });
        }
    }
    scrollCondPast = scrollCond;
});

const animate = ({
    timing,
    draw,
    duration,
    endAnimation = () => {}
} = {}) => {
    const start = performance.now();
    let onceEndAnimation = true;
    let requestId = requestAnimationFrame(function animate(time) {
        let timeFraction = (time - start) / duration;
        if (timeFraction > 1) timeFraction = 1;
        let progress = timing(timeFraction);
        draw(progress);
        if (timeFraction < 1) {
            requestId = requestAnimationFrame(animate);
        } else if (onceEndAnimation) {
            endAnimation();
            onceEndAnimation = false;
        }
    });
    return () => cancelAnimationFrame(requestId);
};

const makeEaseOut = timing => timeFraction => 1 - timing(1 - timeFraction);

const circAnimateFunc = timeFraction => 1 - Math.sin(Math.acos(timeFraction));

getElem(`opncls`).addEventListener(`click`, function () {
    elements.serverMenu.style.display = elements.rooms.style.display = `none`;
    animate({
        timing: circAnimateFunc,
        draw(progress) {
            elements.chat.style.gridTemplateColumns = `${25 * (1 - progress)}vw ${75 + 25 * progress}vw`;
        },
        duration: 200,
        endAnimation() {
            elements.showRoomsList.style.display = `block`;
        }
    });
});

elements.showRoomsList.addEventListener(`click`, function () {
    this.style.display = `none`;
    animate({
        timing: makeEaseOut(circAnimateFunc),
        draw(progress) {
            elements.chat.style.gridTemplateColumns = `${25 * progress}vw ${100 - 25 * progress}vw`;
        },
        duration: 200,
        endAnimation() {
            elements.rooms.style.display = `inline-block`;
            elements.serverMenu.style.display = `flex`;
        }
    });
});

getElem(`close-button`).addEventListener(`click`, () => {
    currentWindow.hide();
});

getElem(`showRoomModal`).addEventListener(`click`, async () => {
    elements.AddRoomModalBody.style.display = `block`;
    const answer = await swal({
        title: `Создание комнаты`,
        content: elements.AddRoomModalBody,
        buttons: [`Отмена`, `Создать`]
    });
    if (answer) {
        const name = getElem(`roomName`).value;
        const hidden = elements.hidden.checked;
        if (!testEncrypt(getElem(`roomPassword`).value, testCipher) && !hidden) {
            return showErrorModal(`Недопустимые символы в пароле!`);
        }
        const password = !getElem(`roomPassword`).value || hidden ? `` : hashPassword(getElem(`roomPassword`).value);
        const match = name.match(/\s+/);
        if (!testEncrypt(name, testCipher)) {
            showErrorModal(`Недопустимые символы в имени!`);
        } else if (!name.length) {
            showErrorModal(`Слишком короткое имя!`);
        } else if (name.length >= 32) {
            showErrorModal(`Слишком длинное имя!`);
        } else if (match && match[0].length == name.length) {
            showErrorModal(`Имя не может быть только из пробелов!`);
        } else {
            if (user.room) {
                await user.disconnect();
            }
            const _id = await getRandomId();
            const color = `#${getElem(`roomColor`).value}`;
            success = (await requestPostAsync({
                url: `${server}/createRoom`,
                form: {
                    data: await getDataProperty({
                        name,
                        password,
                        _id,
                        color,
                        hidden
                    }),
                    _id: user._id
                }
            })).success;
            if (success) {
                await connectToTheRoom(password, _id, color, name);
            }
            return success;
        }
    }
});

elements.inputMessage.addEventListener(`focus`, function () {
    if (!user.room) {
        showErrorModal(`Вы ещё не вошли в комнату!`);
    }
});

const send = (async function () {
    if (!user.audio) {
        lastL = 0;
        changeIcon(`audio`);
    }
    const message = this.innerText.trim();
    const match = message.match(/\s+/);
    if (!message.length || match && match[0].length == message.length) {
        await showErrorModal(`Слишком пусто :C, мы не можем это отправить`);
        return elements.inputMessage.focus();
    } else if (message.length > 262144) {
        await showErrorModal(`Ваша щедрость губительна для нас! Давайте полехче`);
        return elements.inputMessage.focus();
    }
    delete user.lastPress;
    const backgroundColor = user.messagesBackgroundColor;
    let messageObj = { message };
    if (backgroundColor) {
        messageObj.backgroundColor = backgroundColor;
    }
    if (+elements.sendMessageTimer.value) {
        setTimeout(() => {
            sendMessageToRoom(messageObj);
        }, elements.sendMessageTimer.value * 1000);
    } else {
        sendMessageToRoom(messageObj);
    }
    const msgPos = user._history.indexOf(message);
    if (~msgPos) {
        user._history.splice(msgPos, 1);
    }
    user._history.unshift(this.innerHTML);
    if (user._historyPos) {
        user._historyPos -= 1;
    }
    if (user._history.length > 50) {
        user._history.pop();
    }
    this.textContent = ``;
}).bind(elements.inputMessage);

const exitRoomBlock = getElem(`exitRoom`);
const dontRemind = getElem(`dontRemind`);

const exitRoom = async () => {
    await user.disconnect();
    elements.inputMessage.blur();
};

const zeroChecker = function() {
    if (+this.value < 0) {
        this.value = 0;
    }
};

elements.deletionMessageTimer.addEventListener('change', zeroChecker);

elements.sendMessageTimer.addEventListener('change', zeroChecker);

elements.saveListIgnoredUsers.addEventListener('click', async () => {
    const encryptedListIgnoredUsers = await requestPostAsync({
        url: `${server}/updateListIgoneredUsers`,
        form: {
            data: await getDataProperty(elements.listIgnoredUsers.value.match(/[\da-f]+/g)),
            _id: user._id
        }
    });
    const decryptedListIgnoredUsers = await getDecryptedData(encryptedListIgnoredUsers.data);
    let ignoredUsersHTML = ``;
    for (let i = 0; i < decryptedListIgnoredUsers.length; i++) {
        const ignoredUser = decryptedListIgnoredUsers[i];
        ignoredUsersHTML += `<pre class="des"><span class="user" style="font-weight: bold; color: ${ignoredUser.color}" onclick="copyText('${ignoredUser._id}')">${ignoredUser.name}</span></pre>`;
    }
    viewListIgnoredUsers.innerHTML = ignoredUsersHTML;
});

getElem(`disconnect`).addEventListener(`click`, async () => {
    if (!user.room) {
        return;
    }
    exitRoomBlock.style.display = `block`;
    if (dontRemind.checked) {
        return exitRoom();
    }
    const answer = await swal({
        title: `Выход`,
        content: exitRoomBlock,
        buttons: ["Отмена", "Да"],
        icon: "warning",
    });
    if (answer) {
        exitRoom();
    }
});

const getMediaCallback = (type, ext, title, style) => {
    return async e => {
        const blob = e.data;
        const buf = await blobToBuffer(blob);
        if (buf.length < 1000) {
            return;
        }
        const url = URL.createObjectURL(blob);
        const div = document.createElement(`div`);
        div.innerHTML = `<${type} src="${url}" controls ${style ? `style="${style}"` : ``}></${type}>`;
        const saveButton = document.createElement(`button`);
        saveButton.textContent = `Сохранить файл`;
        div.appendChild(saveButton);
        saveButton.addEventListener(`click`, async () => {
            const {filePath} = await dialog.showSaveDialog(currentWindow, {
                defaultPath: await getRandomId(),
                filters: [{
                    name: '',
                    extensions: [ext.slice(1)]
                }]
            });
            if (filePath) {
                fs.writeFile(filePath, buf);
            }
        });
        swal({
            title,
            content: div,
            buttons: ["Отмена", "Отправить"],
        }).then(async answer => {
            elements.inputMessage.focus();
            if (answer) {
                filesSendCallbacksStack.push(async () => {
                    await sendBuffer(buf, ext);
                });
            }
        });
    };
};

const startAudio = async () => {
    user.audio = true;
    recorder = await getAudioRec();
    if (!recorder) {
        user.audio = false;
        return showErrorModal(`Доступ к микрофону заблокирован!`);
    }
    elements.audioRec.style.backgroundImage = `url(styles/audio_red.png)`;
    changeIcon(`send`);
    recorder.start();
    recorder.ondataavailable = getMediaCallback(`audio`, `.mp3`, `Отправка голосового сообщения`);
};

elements.audioRec.addEventListener(`click`, () => {
    if (user.audio) {
        stopAudio();
    } else {
        startAudio();
    }
});

const getVideoRecorder = async (opt, videoSourceFlag) => {
    try {
        const videoSource = await navigator.mediaDevices.getUserMedia(opt);
        const recorder = new MediaRecorder(videoSource, {
            mimeType: `video/webm;codecs=h264,vp9,opus`
        });
        if (videoSourceFlag) {
            return {
                recorder,
                videoSource
            }
        }
        return recorder;
    } catch (e) {
        return {
            error: true,
            e
        };
    }
};

const startScreenVideo = async () => {
    user.screenRecorder = true;
    const source = (await desktopCapturer.getSources({
        types: ['screen']
    })).map(source => (source.name = source.name.toLowerCase(), source)).find(source => source.name == 'entire screen' || source.name == `Screen 1`);
    const {size} = screen.getPrimaryDisplay();
    const recorder = await getVideoRecorder({
        audio: {
            mandatory: {
                chromeMediaSource: 'desktop'
            }
        },
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                minWidth: size.width,
                maxWidth: size.width,
                minHeight: size.height,
                maxHeight: size.height
            }
        }
    });
    if (recorder.e) {
        delete user.screenRecorder;
        return showErrorModal(`Ошибка: ${recorder.e}`);;
    }
    user.screenRecorder = recorder;
    elements.screenRec.style.backgroundImage = `url(styles/screen_red.png)`;
    recorder.start();
    recorder.ondataavailable = getMediaCallback(`video`, `.webm`, `Отправка видео`, `width: 350px`);
};

const stopScreenVideo = () => {
    if (typeof user.screenRecorder != 'object') {
        return;
    }
    user.screenRecorder.stop();
    user.screenRecorder.stream.getTracks().map(track => track.stop());
    delete user.screenRecorder;
    elements.screenRec.style.backgroundImage = `url(styles/screen.png)`;
};

elements.screenRec.addEventListener(`click`, () => {
    if (user.screenRecorder) {
        stopScreenVideo();
    } else {
        startScreenVideo();
    }
});

const startWebcamVideo = async () => {
    user.webcamRecorder = true;
    const {recorder, videoSource} = await getVideoRecorder({
        video: true,
        audio: true
    }, true);
    if (recorder.e) {
        delete user.webcamRecorder;
        return showErrorModal(`Ошибка: ${recorder.e}`);;
    }
    const videoEl = document.createElement(`video`);
    videoEl.volume = 0;
    videoEl.srcObject = videoSource;
    videoEl.autoplay = true;
    videoEl.style.width = `350px`;
    swal({
        title: `Запись видео с веб-камеры`,
        content: videoEl,
        buttons: false,
    });
    user.webcamRecorder = recorder;
    elements.webcamRec.style.backgroundImage = `url(styles/webcam_red.png)`;
    recorder.start();
    recorder.ondataavailable = getMediaCallback(`video`, `.webm`, `Отправка видео`, `width: 350px`);
};

const stopWebcamVideo = () => {
    if (typeof user.webcamRecorder != 'object') {
        return;
    }
    user.webcamRecorder.stop();
    user.webcamRecorder.stream.getTracks().map(track => track.stop());
    delete user.webcamRecorder;
    elements.webcamRec.style.backgroundImage = `url(styles/webcam.png)`;
};

elements.webcamRec.addEventListener(`click`, () => {
    if (user.webcamRecorder) {
        stopWebcamVideo();
    } else {
        startWebcamVideo();
    }
});

const stopAudio = () => {
    if (typeof recorder != 'object') {
        return;
    }
    changeIcon();
    delete user.audio;
    recorder.stop();
    recorder.stream.getTracks().map(track => track.stop());
    elements.audioRec.style.backgroundImage = `url(styles/audio.png)`;
};

elements.reconnect.addEventListener(`click`, async () => {
    if (!user.room) {
        return;
    }
    const reconnect = await swal({
        title: `Переподключение`,
        text: `Переподключиться к комнате ${user.room.name} ?`,
        buttons: ["Нет", "Да"],
        icon: "warning",
    });
    if (reconnect) {
        const oldRoom = user.room;
        await user.disconnect();
        await connectToTheRoom(oldRoom.password, oldRoom._id, oldRoom.color, oldRoom.name);
    }
});

elements.send.addEventListener(`click`, async () => {
    if (user.room && user.audio) {
        return stopAudio();
    }
    if (user.room) {
        if (!elements.inputMessage.textContent.length && !user.audio) {
            return startAudio();
        } else {
            changeIcon(`audio`);
        }
        send();
    } else {
        showErrorModal(`Вы ещё не вошли в комнату!`);
    }
});

getElem(`createDump`).addEventListener(`click`, async () => {
    if (!user._dump.length) {
        return showErrorDialog(`Пока нет переписки для сохранения!`);
    }
    let password = getElem(`dumpPassword`).value;
    if (!password) {
        return showErrorDialog(`Слишком короткий пароль`);
    }
    password = Buffer.from(hashPassword(password), `hex`);
    const iv = password.slice(0, 16);
    const [dumpPath] = (await dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        properties: [`openDirectory`]
    })).filePaths;
    if (dumpPath) {
        const data = encryptAES(await zlib.deflate(JSON.stringify(user._dump)), password, iv);
        const curDate = new Date();
        await fs.writeFile(`${dumpPath}${path.sep}${await getRandomId(3)}_${curDate.getDate().toString().padStart(2, `0`)}-${(curDate.getMonth() + 1).toString().padStart(2, `0`)}-${curDate.getFullYear()}_${await getRandomId(3)}.hdmp`, data);
    }
});

getElem(`loadDump`).addEventListener(`click`, async () => {
    let [file] = (await dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        filters: [{
            name: 'Дамп переписки',
            extensions: ['hdmp']
        }],
        properties: [`openFile`]
    })).filePaths;
    if (file) {
        let password = getElem(`dumpLoadPassword`).value;
        if (!password) {
            return showErrorDialog(`Слишком короткий пароль`);
        }
        password = Buffer.from(hashPassword(password), `hex`);
        const iv = password.slice(0, 16);
        const data = await fs.readFile(file);
        try {
            const dump = JSON.parse(await zlib.unzip(decryptAES(data, password, iv)));
            elements.dialog.innerHTML = ``;
            for (let i = 0; i < dump.length; i++) {
                const message = dump[i];
                let additional = ``;
                if (message.confirmed) {
                    message.badges.forEach(bdg => {
                        additional += `<img src="styles/confirmed/${bdg.badge}.png" class="confirmed" onclick="describe('${bdg.description}', ${bdg.badge})">`;
                    });
                }
                const date = new Date(message.date);
                const hours = date.getHours().toString();
                const minutes = date.getMinutes().toString();
                const seconds = date.getSeconds().toString();
                let nameBlock;
                if (message.user) {
                    nameBlock = `<span onclick="copyText('${message.user}')" class="user" style="color:${message.color}">${message.name}</span>`;
                } else {
                    nameBlock = message.name;
                }
                if (message.file) {
                    const {
                        file
                    } = message;
                    const {
                        fileId,
                        ext
                    } = file;
                    const data = Buffer.from(file.fileData, `base64`);
                    let desc = file.info && file.info.description;
                    let ht = file.info && desc ? `<span>${desc}</span><br>` : ``;
                    let msg;
                    user.files[fileId] = {
                        path: path.join(hendrixdir, `${fileId}${ext}`)
                    };
                    await fs.writeFile(user.files[fileId].path, data);
                    if (ext.match(/(png)|(jpg)|(gif)|(jpeg)/i)) {
                        msg = `<img src="${user.files[fileId].path}" style="max-width: 100%">`;
                        msg += `<br>${ht}`;
                    } else if (ext.match(/(mp3)|(wav)|(ogg)/i)) {
                        msg = `<audio src="${user.files[fileId].path}" controls></audio>`;
                    } else if (ext.match(/(mp4)|(webm)|(ogv)/i)) {
                        msg = `<video src="${user.files[fileId].path}" controls></video>`;
                    } else {
                        msg = `<span class="readyFile"><span class="lnk" onclick="openFile('${fileId}')">${fileId}${ext}</span><img onclick="openFileWithDefaultProgram('${fileId}')" class="launchImage" src="styles/start.png" class="launcIcon"></span>`;
                    }
                    elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock({
                        nameBlock: `${nameBlock}${additional}`,
                        date: `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`,
                        message: msg
                    }));
                } else {
                    elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock({
                        nameBlock: `${nameBlock}${additional}`,
                        date: `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`,
                        message: message.message
                    }));
                }
            }
        } catch (e) {
            showErrorDialog(`Error: ${e.message}\nНевалидный дамп или неправильный пароль!`);
        }
    }
});

elements.inputMessage.addEventListener(`input`, () => {
    const curDate = new Date();
    if (curDate - user.lastPress >= 3000 || !user.lastPress) {
        user.lastPress = curDate;
        sendMessageToRoom({action: 'typing'});
    }
})

const changeHistoryPos = {
    ArrowUp: 1,
    ArrowDown: -1
};

elements.inputMessage.addEventListener(`keydown`, function (e) {
    if (!(e.ctrlKey && /[vм]/i.test(e.key))) {
        const sel = getSelection();
        curPastePos = sel.anchorOffset;
        curAnchorNodeLength = sel.anchorNode.length || 0;
    }
    if (e.ctrlKey && user._history.length && changeHistoryPos[e.key]) {
        user._historyPos += changeHistoryPos[e.key];
        user._historyPos = user._historyPos < 0 ? 0 : user._historyPos > user._history.length - 1 ? user._history.length - 1 : user._historyPos;
        e.preventDefault();
        this.innerHTML = user._history[user._historyPos];
    }
    if (e.ctrlKey && /[eу]/i.test(e.key)) {
        try {
            const expression = this.innerText.match(/[0-9()*+/-\s\.]+/g).join('');
            if (expression) {
                this.innerHTML = eval(expression);
            }
        } catch  (e) { }
    }
    if (e.key == `Enter` && !e.shiftKey) {
        e.preventDefault();
        send();
    } else if (e.key.match(/page((up)|(down))/i)) { //page up down disable here
        e.preventDefault();
    }
});
let curPastePos, curAnchorNodeLength;

const pasteInputHandler = function (e) {
    e.preventDefault();
    document.execCommand(`insertHTML`, false, e.clipboardData.getData(`text/plain`).replace(/\n/g, `<br>`));
    for (let childNone of this.childNodes) {
        if (childNone instanceof Text) {
            childNone.textContent = childNone.textContent.replace(/\n/g, '');
        }
    }
    const sel = getSelection();
    const range = document.createRange();
    const {
        anchorNode
    } = sel;
    const newPos = Math.abs(curPastePos + anchorNode.length - curAnchorNodeLength);
    range.setStart(this.childNodes[[...this.childNodes].indexOf(anchorNode)], newPos > anchorNode.length ? anchorNode.length : newPos);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
};

elements.inputMessage.addEventListener(`paste`, pasteInputHandler);

let lastL;

const changeIcon = name => {
    let curL;
    if (!name) {
        curL = +!!elements.inputMessage.textContent.length;
    }
    elements.send.style.transform = `scale(0, 0)`;
    setTimeout(() => {
        elements.send.innerHTML = `<img src="styles/${name ? name : [`audio`, `send`][curL]}.png" style="width: 32px;">`;
        elements.send.style.transform = `scale(1, 1)`;
    }, 100);
    if (curL !== undefined) {
        lastL = curL;
    }
}

elements.inputMessage.addEventListener(`input`, function (e) {
    const curL = +!!this.textContent.length;
    if (curL ^ lastL && !user.audio) {
        changeIcon();
    }
    lastL = curL;
});

const waitWriteStream = WriteStream => new Promise(res => {
    WriteStream.on(`finish`, () => res(true));
});

const getMessageBlock = ({nameBlock, date, message, backgroundClr, messageId = '', userId, backgroundImg} = {}) => {
    return `
    <div class="messageBlock textMsg" ${backgroundClr ? `style="background-color: ${backgroundClr}"` : ``} messageid="${messageId}" userid="${userId}">
        <div class="avatar"><img class="imgAvatar" src="${backgroundImg || defaultAvatar}"></div>
        <div class="name">
            ${nameBlock}
        </div>
        <div class="date">
            ${date}
        </div>
        <pre class="message">${message}</pre>
    </div>
`;
};

const createMessageBlock = (color, name, date, messageId = '', userId = '', fileId = '', backgroundImg) => {
    const messageBlock = document.createElement(`div`);
    messageBlock.setAttribute('messageid', messageId);
    messageBlock.setAttribute('userid', userId);
    messageBlock.setAttribute('fileid', fileId);
    messageBlock.classList.add(`messageBlock`);
    messageBlock.classList.add(`fileMsg`);
    const nameBlock = document.createElement(`div`);
    nameBlock.style.color = color;
    nameBlock.innerHTML = name;
    nameBlock.classList.add(`name`);
    const dateBlock = document.createElement(`div`);
    dateBlock.innerHTML = date;
    dateBlock.classList.add(`date`);
    const msg = document.createElement(`pre`);
    msg.classList.add(`message`);
    const fileBlock = document.createElement(`span`);
    fileBlock.classList.add(`sendFile`);
    const fileLink = document.createElement(`span`);
    const fileProgress = document.createElement(`span`);
    const launchIcon = document.createElement(`span`);
    fileBlock.appendChild(fileLink);
    fileBlock.appendChild(fileProgress);
    fileBlock.appendChild(launchIcon);
    msg.appendChild(fileBlock);
    const avatarBlock = document.createElement('div');
    avatarBlock.classList.add('avatar');
    const imgAvatarBlock = document.createElement('img');
    imgAvatarBlock.classList.add('imgAvatar');
    imgAvatarBlock.src = backgroundImg || defaultAvatar;
    avatarBlock.appendChild(imgAvatarBlock);
    messageBlock.appendChild(avatarBlock);
    messageBlock.appendChild(nameBlock);
    messageBlock.appendChild(dateBlock);
    messageBlock.appendChild(msg);
    return {
        messageBlock,
        childs: {
            nameBlock,
            dateBlock,
            msgBlock: {
                msg,
                fileLink,
                fileProgress,
                launchIcon
            }
        }
    };
};

const addMessageSound = (message, user) => {
    if (message.user == user._id) {
        playSound(getInpSound());
    } else {
        playSound(getOutSound());
    }
};

const colorReg = `(?:#(?:[\\da-f]{3}){1,2})|(?:aqua)|(?:black)|(?:blue)|(?:fuchsia)|(?:gray)|(?:green)|(?:lime)|(?:maroon)|(?:navy)|(?:olive)|(?:orange)|(?:purple)|(?:red)|(?:silver)|(?:teal)|(?:white)|(?:yellow)|(?:pink)`;

const compiledRegs = [
    new RegExp(`(?:\\W|^)clr\\s*=\\s*(${colorReg})`, `i`),
    new RegExp(`(?:\\W|^)bgclr\\s*=\\s*(${colorReg})`, `i`)
];

const getReplacer = (reg, conditionCallback, pos, string, handlers) => (style, r) => {
    const match = style.match(reg);
    const condition = !!conditionCallback(match);
    if (condition) {
        if (handlers) {
            r[pos].push(string.replace(/\{\s*(\d+)\s*\}/g, (m, pos) => handlers[pos] ? handlers[pos](match[pos]) : match[pos]));
        } else {
            r[pos].push(string.replace(/\{\s*(\d+)\s*\}/g, (m, pos) => match[pos]));
        }
    }
    return condition;
};

const regs = [{
        replace: getReplacer(compiledRegs[0], match => match, 2, `color:{1};`)
    },
    {
        replace: getReplacer(compiledRegs[1], match => match, 2, `background-color:{1};`)
    },
    {
        replace: getReplacer(/(?:\W|^)hd/i, match => match, 5, `hidden`)
    },
    {
        replace: getReplacer(/(?:\W|^)size\s*=\s*(\d+)/i, match => match && +match[1] <= 100, 2, `font-size:{1}px;`)
    },
    {
        replace: getReplacer(/(?:\W|^)opacity\s*=\s*(\d+)/i, match => match && +match[1] <= 100, 2, `opacity:{1};`, {
            1: opacity => opacity / 100
        })
    },
    {
        replace: getReplacer(/(?:\W|^)text\s*=\s*((?:undr)|(?:ovrl)|(?:lh))/i, match => match, 2, `text-decoration:{1};`, {
            1: (style) => {
                style = style.toLowerCase();
                const obj = {
                    undr: `underline`,
                    ovrl: `overline`,
                    lh: `line-through`
                }
                return obj[style];
            }
        })
    },
    {
        replace: getReplacer(/(?:\W|^)bold/i, match => match, 2, `font-weight:bold;`)
    },
    {
        replace: getReplacer(/(?:\W|^)itc/i, match => match, 2, `font-style:italic;`)
    },
    {
        replace: getReplacer(/(?:\W|^)font\s*=\s*([a-z]+)/i, match => match, 2, `font-family:{1};`)
    }
];

const replaceInsertByPos = (text, beginPos, len, repText) => `${text.slice(0, beginPos)}${repText}${text.slice(text.length - (text.length - (beginPos + len)))}`;

const parseStyles = text => {
    let bgcounter = 0;
    let endcounter = 0;
    text = text.replace(/\[([^\]\/]*)\]/g, (match, style) => {
        const r = [`<span `, `style="`, [], `" `, `class="`, [], `">`];
        let worked = false;
        for (let i = 0; i < regs.length; i++) {
            if (regs[i].replace(style, r)) {
                worked = true;
            }
        }
        if (worked) {
            bgcounter++;
            return r.map(e => typeof e == `object` ? e.join(` `) : e).join(``);
        } else {
            return match;
        }
    });
    const endreg = /\[\s*\/\s*\]/g;
    const ends = [];
    let res;
    while (res = endreg.exec(text)) {
        ends.push(res);
    }
    ends.reverse();
    let i = 0;
    while (endcounter < bgcounter && i < ends.length) {
        const m = ends[i];
        text = replaceInsertByPos(text, m.index, m[0].length, `</span>`);
        endcounter++;
        i++;
    }
    return text;
};

setInterval(() => {
    let keys = Object.keys(nowTypingList);
    if (keys.length > 7) {
        keys = keys.slice(0, 7);
    }
    if (keys.length) {
        elements.typing.innerHTML = `<pre>${keys.map(_id => nowTypingList[_id]).join(`, `)}${keys.length == 1 ? ` печатает` : ` печатают`}${`.`.repeat(dotsCount++)}</pre>`;
        if (dotsCount > 4) {
            dotsCount = 0;
        }
    } else {
        elements.typing.innerHTML = ``;
        dotsCount = 0;
    }
}, 200);

const scroll = () => {
    if (elements.dialog.scrollHeight - (elements.dialog.scrollTop + elements.dialog.clientHeight) <= 200) {
        elements.dialog.scrollTo(0, elements.dialog.scrollHeight);
    }
};

getElem(`next`).addEventListener(`click`, async function (e) {
    this.blur();
    e.preventDefault();
    let name = getElem(`name`).value;
    const match = name.match(/\s+/);
    const ip = elements.serverIp.value;
    const port = elements.serverPort.value;
    if (!testEncrypt(name, testCipher)) {
        showErrorModal(`Недопустимые символы`);
    } else if (!name.length) {
        showErrorModal(`Слишком короткое имя`);
    } else if (name.length >= 32) {
        showErrorModal(`Слишком длинное имя`);
    } else if (match && match[0].length == name.length) {
        showErrorModal(`Имя не может быть только из пробелов!`);
    } else if (!net.isIPv4(ip)) {
        showErrorModal(`Некорректный ip!`);
    } else if (!Number.isInteger(+port) || parseInt(port) < 0 || parseInt(port) >= 2 ** 16) {
        showErrorModal(`Некорректный порт!`);
    } else {
        server = `http://${ip}:${port}`;
        const versionCheck = await requestPostAsync({
            url: `${server}/check`,
            form: {
                version: remote.app.getVersion()
            }
        }, true);
        if (!versionCheck) {
            return;
        }
        localStorage.ip = ip;
        localStorage.port = port;
        ipcRenderer.send(`serverSend`, server);
        const userObj = {
            _history: [],
            roomsHistory: {},
            _historyPos: -1,
            files: {},
            cachedAvatars: {},
            showNotifications: true,
            _dump: [],
            async subNotifications(canceled) {
                const obj = {
                    secretString: this.secretString
                };
                if (canceled) {
                    obj.canceled = canceled;
                }
                let notification = await requestPostAsync({
                    url: `${server}/subNotifications`,
                    form: {
                        data: await getDataProperty(obj, this),
                        _id: this._id
                    }
                });
                if (!notification) {
                    await sleep(1000);
                    return setImmediate(this.subNotifications);
                }
                notification = await getDecryptedData(notification.data, this);
                const div = document.createElement(`div`);
                div.innerHTML = notification.message;
                const answer = await swal({
                    content: div,
                    buttons: [`Отмена`, `Подключиться`]
                });
                if (answer) {
                    if (this.room) {
                        await this.disconnect();
                    }
                    let auth = await checkPasswordRoom(notification.password, notification._id);
                    if (auth.banned) {
                        showErrorModal(`Вы забанены в этой комнате!`);
                        return setImmediate(this.subNotifications, {
                            _id: notification._id
                        });
                    } else if (auth.multi) {
                        showErrorModal(`Вы уже есть в этой комнате в одном из окон!`);
                        return setImmediate(this.subNotifications, {
                            _id: notification._id
                        });
                    } else {
                        await connectToTheRoom(notification.password, notification._id, notification.color, notification.name);
                    }
                    setImmediate(this.subNotifications);
                } else {
                    setImmediate(this.subNotifications, {
                        _id: notification._id
                    });
                }
            },
            async oneToOneSubscribe() {
                const encryptedMessage = await requestPostAsync({
                    url: `${server}/oneToOneSub`,
                    form: {
                        _id: this._id
                    }
                });
                if (!encryptedMessage) {
                    await sleep(1000);
                    return setImmediate(this.oneToOneSubscribe);
                }
                const message = await getDecryptedData(encryptedMessage.data, this);
                addOneToOneMessage(message.from, this, message.text, message.date);
                setImmediate(this.oneToOneSubscribe);
            },
            async disconnect() {
                if (!this.room) {
                    return;
                }
                this.cachedAvatars = {};
                this.roomsHistory[this.room._id] = elements.dialog.innerHTML;
                delete this.room;
                if (this.roomSocket) {
                    this.roomSocket.close(4100);
                    delete this.roomSocket;
                }
                this._dump = [];
                elements.titleText.innerHTML = ``;
                elements.dialog.childNodes.forEach(node => {
                    if (node.tagName == 'DIV') {
                        deleteElementWithAnimation(node);
                    }
                });
                await new Promise(resolve => {
                    animate({
                        timing: circAnimateFunc,
                        draw(progress) {
                            elements.chat.style.gridTemplateRows = `minmax(18px, 3vh) ${80 + 20 * progress}vh 3vh 11vh 5vh`;
                        },
                        duration: 200,
                        endAnimation() {
                            getElem(`message`).style.display = `none`;
                            resolve();
                        }
                    });
                });
                await sleep(250);
                elements.dialog.dispatchEvent(new CustomEvent(`scroll`));
            }
        };
        let color, _token;
        color = `#${getElem(`color`).value}`;
        _token = getElem(`token`).value;
        localStorage.setItem(`name`, name);
        localStorage.setItem(`color`, color);
        localStorage.setItem(`_token`, _token);
        user = userObj;
        user.name = name;
        user.color = color;
        user._token = _token;
        user.oneToOneSubscribe = user.oneToOneSubscribe.bind(user);
        user.subNotifications = user.subNotifications.bind(user);
        if (localStorage.avatar) {
            user.avatar = localStorage.avatar;
            avatarPreview.innerHTML = `<img src="${user.avatar}">`;
        }
        const {
            accountId,
            accountPassword
        } = localStorage;
        if (accountId && accountPassword) {
            getElem(`idAcc`).value = accountId;
            getElem(`passwordAcc`).value = accountPassword;
        }
        elements.main.style.transform = `scale(0, 0)`;
        await sleep(500);
        await getFirstKeys();
        if (user.avatar) {
            await requestPostAsync({
                url: `${server}/loadUserAvatar`,
                form: {
                    data: await getDataProperty(user.avatar),
                    _id: user._id
                }
            });
        }
        user.subNotifications();
        user.oneToOneSubscribe();
        ipcRenderer.send(`alive`, user._id);
        await showRooms();
        setInterval(async () => {
            await showRooms();
        }, 2000);
        setTimeout(() => {
            elements.main.style.display = `none`;
            elements.chat.style.transform = `scale(1, 1)`;
        }, 1000);
    }
    getElem(`about-program`).addEventListener(`click`, () => {
        const div = document.createElement(`div`);
        div.innerHTML = `<div style="width:100%;word-wrap: break-word;user-select: text;"><img src = "logo.png" style="user-select: none;"><br style="user-select: none;"><br style="user-select: none;">Private messenger <span style="color:#66CCFF">Hendrix ${version}</span> by <span style="color:#FFA000">HuHguZ</span><br><br>Ваш Id в системе:<br><span style="color: ${user.color}">${user._id}</span></div>`;
        swal({
            content: div,
            button: false
        });
    });
});

if (localStorage.name) {
    getElem(`name`).value = localStorage.name;
}

if (localStorage._token) {
    getElem(`token`).value = localStorage._token;
}

if (localStorage.color) {
    getElem('color').jscolor.fromString(localStorage.color);
}

if (localStorage.ip) {
    elements.serverIp.value = localStorage.ip;
}

if (localStorage.port) {
    elements.serverPort.value = localStorage.port;
}

const divideBuf = (buf, part = highWaterMark) => {
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

document.addEventListener(`keydown`, e => {
    if (e.ctrlKey && e.key.match(/[vм]/i)) {
        if (user && user.room) {
            const img = clipboard.readImage();
            const url = img.toDataURL();
            let imageBuffer = img.toPNG();
            if (imageBuffer.length) {
                const div = document.createElement(`div`);
                div.innerHTML = `<img src="${url}" style="max-width: 75%; max-height: 75%;"><br><input type="text" id="description">`;
                swal({
                    title: `Отправка изображения`,
                    content: div,
                    buttons: ["Отмена", "Отправить"],
                }, false, () => getElem(`description`).focus()).then(async answer => {
                    if (answer) {
                        const desc = getElem(`description`).value;
                        filesSendCallbacksStack.push(async () => {
                            await sendBuffer(imageBuffer, `.png`, {
                                description: desc.length <= highWaterMark ? desc : ``
                            });
                        });
                    }
                    elements.inputMessage.focus();
                });
            }
        }
    }
});

const sendBuffer = async (buffer, ext, info, fileName) => {
    const len = buffer.length;
    buffer = divideBuf(buffer, highWaterMark).reverse();
    const readable = Readable();
    readable._read = function () {
        if (buffer.length) {
            this.push(buffer.pop());
        } else {
            this.push(null);
        }
    }
    await sendFile(null, len, readable, ext, info, fileName);
};

const waitSocketSend = ws => new Promise(resolve => {
    const timer = setInterval(() => {
        if (!ws.bufferedAmount) {
            clearInterval(timer);
            resolve(true);
        }
    });
});

const sendFile = async (file, size, readable, extn, info, fileName) => {
    if (user.roomFileSocket.readyState != WebSocket.OPEN) {
        return;
    }
    let readStream; 
    let ext;
    if (file) {
        readStream = fs.createReadStream(file, {
            highWaterMark
        });
        ext = path.extname(file);
    } else {
        readStream = readable;
        ext = extn;
    }
    const fileId = fileName || await getRandomId();
    let pr = 0;
    let position = 0;
    for await (const data of readStream) {
        if (!user.room) {
            currentWindow.setProgressBar(0);
            readStream.destroy();
            break;
        }
        pr += data.length;
        position++;
        const progress = pr / size;
        currentWindow.setProgressBar(progress);
        const filePart = data;
        let obj = {
            filePart,
            fileId,
            ext,
            progress,
            position
        };
        if (position == 1) {
            obj.info = info;
            if (user.messagesBackgroundColor) {
                obj.backgroundColor = user.messagesBackgroundColor;
            }
        }
        readStream.pause();
        user.roomFileSocket.send(encryptAES(v8.serialize({file: obj}), user.cipherInfo.symmetricKey, user.cipherInfo.iv));
        await waitSocketSend(user.roomFileSocket);
        readStream.resume();
    }
    user.roomFileSocket.send(encryptAES(v8.serialize({
        file: {
            fileId,
            ext,
            ready: true
        }
    }), user.cipherInfo.symmetricKey, user.cipherInfo.iv));
    currentWindow.setProgressBar(0);
};

const filesSendCallbacksStack = [];

setTimeout(async function execFilesCallbacks() {
    while (filesSendCallbacksStack.length) {
        const filesSendCallback = filesSendCallbacksStack.pop();
        if (+elements.sendMessageTimer.value) {
            setTimeout(() => {
                filesSendCallback();
            }, elements.sendMessageTimer.value * 1000);
        } else {
            await filesSendCallback();
        }
    }
    setTimeout(execFilesCallbacks, 100);
}, 0);

const getCallbackFromFiles = files => async () => {
    if (!files || !files.length) {
        return;
    }
    let skipped = 0;
    for (let i = 0; i < files.length; i++) {
        const fullPath = files[i];
        const info = await fs.stat(fullPath);
        if (!info.size) {
            skipped++;
            showErrorModal(`${fullPath} пуст, не можем отправить!`);
            continue;
        }
        await sendFile(fullPath, info.size, null, path.extname(fullPath), null, elements.saveFilesNames.checked ? path.basename(fullPath, path.extname(fullPath)): false);
    };
    swal(`${files.length - skipped} файлов успешно отправлено на сервер!`);
};

getElem(`file`).addEventListener(`click`, async () => {
    if (user.room) {
        const {
            filePaths
        } = await dialog.showOpenDialog(currentWindow, {
            properties: [`openFile`, `multiSelections`]
        });
        filesSendCallbacksStack.push(getCallbackFromFiles(filePaths));
    } else {
        showErrorModal(`Вы ещё не вошли в комнату!`);
    }
});

document.ondragover = function () {
    return false;
};

document.ondragleave = function () {
    return false;
};

document.addEventListener(`drop`, event => {
    event.preventDefault();
    if (!user.room) {
        return;
    }
    filesSendCallbacksStack.push(getCallbackFromFiles([...event.dataTransfer.files].map(file => file.path)));
});

const handleError = async err => {
    const errorStack = {};
    Error.captureStackTrace(errorStack);
    const {
        stack
    } = errorStack;
    await requestPostAsync({
        url: `${server}/unhandledError`,
        form: {
            data: await getDataProperty({
                date: date.format(new Date()),
                message: err.message || `Сообщение отсутствует. Проброшено примитивное значение ${err || `undefined`}`,
                stack: err.stack || stack
            }),
            _id: user._id
        }
    });
    const {response} = (await dialog.showMessageBox(currentWindow, {
        type: `error`,
        title: `Что-то пошло не так...`,
        message: `Необработанное исключение ${err.message || err || `undefined`}. Что делаем?`,
        buttons: [`Выйти из Hendrix`, `Перезапустить Hendrix`, `Ничего`],
    }));
    switch(response) {
        case 1:
            remote.app.relaunch();
        case 0:
            remote.app.quit();
    }
};

window.addEventListener(`unhandledrejection`, function (promiseRejectionEvent) {
    handleError(promiseRejectionEvent.reason);
});

process.on(`uncaught`, err => {
    handleError(err);
});

const passwordAccNew = getElem(`passwordAccNew`);
const idCreatedAcc = getElem(`idCreatedAcc`);
const idAcc = getElem(`idAcc`);
const passwordAcc = getElem(`passwordAcc`);
const newPasswordInput = getElem(`newPasswordValue`);
const accState = getElem(`accState`);
const balance = getElem(`balance`);
const accOperationsState = getElem(`accOperationsState`);
const operationHistory = getElem(`operationHistory`);
const accOperationtitle = getElem(`accOperationtitle`);
const opsClear = getElem(`opsClear`);
const operationsBlock = getElem(`operations`);
const pageNum = getElem(`pageNum`);

const getHistoryByPage = async page => {
    const {
        _id,
        password
    } = user._account;
    const encryptedAnswer = await requestPostAsync({
        url: `${server}/getOperationsHistory`,
        form: {
            data: await getDataProperty({
                _id,
                password,
                page
            }),
            _id: user._id
        }
    });
    return await getDecryptedData(encryptedAnswer.data);
};

const date = {
    options: {
        hour: `numeric`,
        minute: `numeric`,
        second: `numeric`,
    },
    format(date) {
        return `${date.getDate().toString().padStart(2, 0)}.${(date.getMonth() + 1).toString().padStart(2, 0)}.${date.getFullYear()} ${date.toLocaleString(`ru`, this.options)}:${date.getMilliseconds()}`;
    }
};

const showHistoryPage = async page => {
    const {
        historyPart: history
    } = await getHistoryByPage(page);
    const {
        operations
    } = history;
    let r = ``;
    if (operations.length) {
        opsClear.textContent = ``;
        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            let sender = `Вы`,
                recipient = operation._id;
            if (!operation.outgoing) {
                [sender, recipient] = [recipient, sender];
            }
            r +=
                `<tr class="historyString">
    <td>${sender}</td>
    <td><span class="opstd"><img src="styles/send.png" style="height: 25px;"></span></td>
    <td>${recipient}</td>
    <td><span style="font-weight: bold; color: ${operation.value < 0 ? `red` : `green`}">${operation.value > 0 ? `+`: ``}${operation.value}</span></td>
    <td>${date.format(new Date(operation.date))}</td>
    <td>${operation.comment}</td>
</tr>`;
        }
    } else {
        opsClear.textContent = `Здесь пока пусто`;
    }
    operationsBlock.innerHTML = `<table style="display: inline-block; user-select: text; border-collapse: collapse;">${r}</table>`;
};

let curPage = 0;

getElem(`pageNumForm`).addEventListener(`submit`, e => {
    e.preventDefault();
    const newPage = +pageNum.value;
    if (Number.isInteger(newPage) && newPage >= 0) {
        opsClear.textContent = ``;
        curPage = newPage;
        showHistoryPage(curPage);
    } else {
        pageNum.value = 0;
        opsClear.textContent = `Номер страницы должен быть целым положительным числом`;
    }
});

getElem(`operationsNext`).addEventListener(`click`, () => {
    curPage++;
    pageNum.value = curPage;
    showHistoryPage(curPage);
});

getElem(`operationsBack`).addEventListener(`click`, () => {
    if (curPage) {
        curPage--;
        pageNum.value = curPage;
        showHistoryPage(curPage);
    }
});

getElem(`showOperationHistory`).addEventListener(`click`, async () => {
    if (user._account) {
        operationHistory.style.display = `block`;
        accOperationtitle.textContent = `История операций счета ${user._account._id}`;
        await showHistoryPage(curPage);
        swal({
            content: operationHistory,
            button: false
        }, true).then(() => {
            swal({
                content: elements.moneyAccount,
                button: false
            });
        });
    } else {
        accOperationsState.textContent = `У вас нет счета!`;
    }
});

getElem(`deleteAcc`).addEventListener(`click`, async () => {
    if (user._account) {
        swal({
            title: `Внимание!`,
            text: "Вы уверены, что хотите удалить счет? Вернуть удаленные данные не представляется возможным!",
            buttons: ["Отмена", "Да"],
            icon: "warning",
        }, true).then(async answer => {
            if (answer) {
                const {
                    _id,
                    password
                } = user._account;
                const answer = await requestPostAsync({
                    url: `${server}/deleteAccount`,
                    form: {
                        data: await getDataProperty({
                            _id,
                            password,
                        }),
                        _id: user._id
                    }
                });
                if (answer.success) {
                    delete user._account;
                    accOperationsState.textContent = `Счет удален.`;
                    balance.textContent = ``;
                    accState.textContent = ``;
                } else {
                    accOperationsState.textContent = `Не удалось удалить счет.`;
                }
            }
            swal({
                content: elements.moneyAccount,
                button: false
            });
        });
    } else {
        accOperationsState.textContent = `У вас нет счета!`;
    }
});

getElem(`loginInAcc`).addEventListener(`click`, async () => {
    const p = passwordAcc.value;
    const password = hashPassword(p);
    const _id = idAcc.value;
    const encryptedAnswer = await requestPostAsync({
        url: `${server}/loginInAccount`,
        form: {
            data: await getDataProperty({
                _id,
                password
            }),
            _id: user._id
        }
    });
    const answer = await getDecryptedData(encryptedAnswer.data);
    if (answer.logIn) {
        accState.textContent = `Ваш текущий счет: ${_id}`;
        accOperationsState.textContent = ``;
        balance.textContent = answer.balance;
        balance.style.color = !answer.balance ? `inherit` : answer.balance > 0 ? `green` : `red`;
        localStorage.setItem(`accountId`, _id);
        localStorage.setItem(`accountPassword`, p);
        user._account = {
            _id,
            password
        };
    } else {
        accState.textContent = `Неправильный id или пароль`;
        delete user._account;
        balance.textContent = ``;
        accOperationsState.textContent = ``;
    }
});

getElem(`changePasswordAcc`).addEventListener(`click`, () => {
    if (user._account) {
        swal({
            title: `Внимание!`,
            text: "Вы уверены, что хотите изменить пароль счета?",
            buttons: ["Отмена", "Да"],
            icon: "warning",
        }, true).then(async answer => {
            if (answer) {
                const {
                    _id,
                    password
                } = user._account;
                const newPassword = hashPassword(newPasswordInput.value);
                const answer = await requestPostAsync({
                    url: `${server}/changeAccountPassword`,
                    form: {
                        data: await getDataProperty({
                            _id,
                            password,
                            newPassword
                        }),
                        _id: user._id
                    }
                });
                if (answer.success) {
                    delete user._account;
                    accOperationsState.textContent = `Пароль успешно изменен.`;
                    balance.textContent = ``;
                    accState.textContent = ``;
                } else {
                    accOperationsState.textContent = `Пароли не должны совпадать!`;
                }
            }
            swal({
                content: elements.moneyAccount,
                button: false
            });
        });
    } else {
        accOperationsState.textContent = `У вас нет счета!`;
    }
});

let once = false;
let createdId;

getElem(`createMoneyAcc`).addEventListener(`click`, async () => {
    if (once) {
        idCreatedAcc.textContent = `Вы уже создали счет. Его id: ${createdId}`;
        return;
    }
    const encryptedAnswer = await requestPostAsync({
        url: `${server}/createAccount`,
        form: {
            data: await getDataProperty({
                password: hashPassword(passwordAccNew.value)
            }),
            _id: user._id
        }
    });
    const {
        _id
    } = await getDecryptedData(encryptedAnswer.data);
    createdId = _id;
    idCreatedAcc.textContent = `id созданного счета: ${_id}`;
    once = !once;
});

elements.money.addEventListener(`click`, () => {
    elements.moneyAccount.style.display = `block`;
    swal({
        content: elements.moneyAccount,
        button: false
    });
});

const oneToOneBlock = getElem(`oneToOneBlock`);
const oneToOneMessagesTable = getElem(`oneToOneMessagesTable`);
const oneToOneRecipient = getElem(`oneToOneRecipient`);
const oneToOneMessage = getElem(`oneToOneMessage`);
const oneToOneStatus = getElem(`oneToOneStatus`);

const addOneToOneMessage = (sender, recipient, text, date) => {
    if (elements.oneToOneMessageSound.checked) {
        playSound(getOneToOneSound());
    }
    return oneToOneMessagesTable.insertAdjacentHTML(`beforeEnd`,
        `<tr class="historyString">
    <td><span class="user" style="font-weight: bold; color: ${sender.color}" onclick="copyText('${sender._id}')">${sender.name}</span></td>
    <td><span class="opstd"><img src="styles/send.png" style="height: 25px;"></span></td>
    <td><span class="user" style="font-weight: bold; color: ${recipient.color}" onclick="copyText('${recipient._id}')">${recipient.name}</span></td>
    <td>${text}</td>
    <td>${date}</td>
</tr>`)
};

getElem(`oneToOneMessageSend`).addEventListener(`click`, async () => {
    const text = oneToOneMessage.value;
    const dt = date.format(new Date());
    const encryptedAnswer = await requestPostAsync({
        url: `${server}/oneToOnePublish`,
        form: {
            data: await getDataProperty({
                _id: oneToOneRecipient.value,
                text,
                date: dt
            }),
            _id: user._id
        }
    });
    const answer = await getDecryptedData(encryptedAnswer.data);
    if (answer.success) {
        oneToOneStatus.textContent = ``;
        addOneToOneMessage(user, answer.recipientInfo, text, dt);
    } else {
        oneToOneStatus.textContent = `Сообщение не отправлено`;
    }
});

getElem(`oneToOneMessagesClear`).addEventListener(`click`, () => {
    oneToOneMessagesTable.innerHTML = ``;
});

getElem(`oneToone`).addEventListener(`click`, () => {
    oneToOneBlock.style.display = `block`;
    swal({
        content: oneToOneBlock,
        button: false
    });
});