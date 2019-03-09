const electron = require(`electron`);

const {
    remote,
    ipcRenderer,
    nativeImage,
    webFrame,
    shell,
    clipboard
} = electron;

const {
    dialog
} = remote;

webFrame.setZoomFactor(1);
webFrame.setVisualZoomLevelLimits(1, 1);
webFrame.setLayoutZoomLevelLimits(0, 0);

// shell.showItemInFolder(`${__dirname}/main.js`); //открытие проводника с указанным файлом
// setInterval(() => {
//     shell.beep(); //Проигрывание стандартного уведомления
// }, 500);
//currentWindow.setProgressBar(0); //управление прогресс баром
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
const Readable = require(`stream`).Readable;

require(`./recorder/audioRecord`);

let recorder;

const getRec = () => new Promise((resolve, reject) => {
    audioRecorder.requestDevice(function (rec) {
        resolve(rec);
    });
});

const encoding = `base64`;

const transformPassword = password => pbkdf2.pbkdf2Sync(password, ``, 10, 32, `sha512`).toString(`hex`);

const getDataProperty = async (data, user) => {
    return encryptAES((await zlib.deflate(JSON.stringify(data))).toString(encoding), user.aesKeyBytes);
};

/*

new Notification({
title :`23`,
body: `test`,
icon: `logo.png`
})

взять лого как иконка в трее
При клике на уведомление открывать мессенджер

*/

fs.stat = util.promisify(fs.stat);
zlib.deflate = util.promisify(zlib.deflate);
zlib.unzip = util.promisify(zlib.unzip);
fs.readFile = util.promisify(fs.readFile);
fs.writeFile = util.promisify(fs.writeFile);

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

const constraints = {
    audio: true,
    video: false
};

//Битность ключей RSA, должна быть минимум 2048
const b = 2048 //2048;
//размер чанка при передачи файлов
const highWaterMark = 4096;

const version = remote.app.getVersion();

const getElem = id => document.getElementById(id);

global.copyText = text => clipboard.writeText(text);
global.openLink = link => shell.openExternal(link);
global.openFile = fileId => shell.showItemInFolder(user.files[fileId].path);
global.describe = (description, num) => {
    const div = document.createElement(`div`);
    div.innerHTML = `<div class="h3">Подтверждённая сущность</div><img src ="styles/confirmed/${num}.png" style="height: 28px; margin-left:5px;"><div style="width:100%">${description}</div>`;
    div.classList.add(`des`);
    swal({
        content: div,
        button: false
    });
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
    settingsBlock: getElem(`settingsBlock`)
    //повесить на roomFilter листенер keydown. Когда Enter - отправлять запрос на сервер по фильтрации комнат
};

let dotsCount = 0;

let volume = 1;

const nowTypingList = {};

const typingTimers = {};

const server = `http://62.109.31.175:8080`;

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
}

const encryptAES = (text, key) => {
    if (typeof key == `string`) {
        key = aes.utils.hex.toBytes(key);
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
        key = aes.utils.hex.toBytes(key);
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

const testKey = transformPassword(`test`);
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
        try {
            JSON.parse(body)
        } catch (e) {
            dialog.showMessageBox(currentWindow, {
                type: `error`,
                title: `Критическая ошибка!`,
                message: `Пакет файла потерян. Его структура нарушена, отправьте файл ещё раз/попросите отправителя!`,
            });
            return resolve(false);
        }
        resolve(JSON.parse(body));
    });
});

const getFirstKeys = async () => {
    const key = new RSA({
        b
    });
    user.RSAkey = key;
    let getAESKey = await requestPostAsync({
        url: `${server}/getAESKey`,
        form: {
            key: key.exportKey(`pkcs8-public-pem`)
        }
    });
    user.aesKey = key.decrypt(Buffer.from(aes.utils.hex.toBytes(getAESKey.aeskeyencrypted)).toString(`base64`), `utf8`);
    user.aesKeyBytes = aes.utils.hex.toBytes(user.aesKey);
    user.secretString = await getRandomId();
    console.log(await getRandomId(64));
    return (await requestPostAsync({
        url: `${server}/savePerson`,
        form: {
            pos: getAESKey.pos,
            data: await getDataProperty({
                name: user.name,
                color: user.color,
                secretString: user.secretString,
                _token: user._token
            }, user),
            _id: user._id
        }
    })).success;
};

const updateKeys = async () => {
    swal(`Обновляю сеансовые ключи. Пожалуйста, подождите...`);
    const key = new RSA({
        b
    });
    let updateAESKey = await requestPostAsync({
        url: `${server}/updateAESKey`,
        form: {
            data: await getDataProperty({
                key: key.exportKey(`pkcs8-public-pem`),
                secretString: user.secretString
            }, user),
            _id: user._id
        }
    });
    user.aesKey = key.decrypt(Buffer.from(aes.utils.hex.toBytes(updateAESKey.aeskeyencrypted)).toString(`base64`), `utf8`);
    user.aesKeyBytes = aes.utils.hex.toBytes(user.aesKey);
    console.log(`new key is ${user.aesKey}`);
    return true;
    document.getElementsByClassName(`swal-button swal-button--confirm`)[0].click();
};

//setInterval
//setTimeout

//починю позже

// setInterval(() => {
//     updateKeys();
// }, 10000); //300000

const showErrorModal = text => swal(`У-упс!`, text, `error`, {
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
                data: await getDataProperty(user.room, user),
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
                    additional += `<img src="styles/confirmed/${bdg.badge}.png" class="confirmed" onclick="describe('${bdg.description}', ${bdg.badge})">`;
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
            data: await getDataProperty(user.room, user),
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
            }, user),
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
                        password = transformPassword(password);
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
let currentWindow = remote.getCurrentWindow();
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
    if (e.which == 2) {
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

getElem(`volume`).addEventListener(`change`, function () {
    volume = +this.value;
    getElem(`curVolume`).textContent = `${(this.value * 100).toFixed(0)}%`;
});

getElem(`folder`).addEventListener(`click`, () => {
    shell.openItem(hendrixdir);
});

elements.settings.addEventListener(`click`, () => {
    elements.settingsBlock.style.display = `block`;
    swal({
        content: elements.settingsBlock,
        button: false
    });
    getElem(`downloads`).value = hendrixdir;
});

const playSound = src => {
    const sound = new Audio();
    sound.src = src;
    sound.volume = volume;
    sound.play();
}

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
    playSound(`sounds/clear.mp3`);
});

//при резких движениях колесом может не исчезнуть

elements.scrolldown.addEventListener(`click`, () => {
    elements.dialog.scrollTo(0, elements.dialog.scrollHeight);
    elements.scrolldown.style.display = `none`;
});

elements.dialog.addEventListener(`wheel`, function (e) {
    if (this.scrollHeight - (this.scrollTop + this.clientHeight) > 400) {
        elements.scrolldown.style.display = `block`;
    } else {
        elements.scrolldown.style.display = `none`;
    }
});

getElem(`opncls`).addEventListener(`click`, function () {
    const pos = +(toggle = !toggle);
    elements.chat.style.gridTemplateColumns = [`25vw 75vw`, `5vw 95vw`][pos];
    elements.roomFilter.style.backgroundColor = elements.servers.style.backgroundColor = [`#0e1621`, `#17212b`][pos];
    elements.roomFilter.style.display = getElem(`rooms`).style.display = [`inline-block`, `none`][pos];
    this.style.height =
        this.style.width =
        getElem(`showRoomModal`).style.height =
        getElem(`showRoomModal`).style.width =
        getElem(`connectToTheHiddenRoom`).style.height =
        getElem(`connectToTheHiddenRoom`).style.width = [`32px`, `24px`][pos];
});

getElem(`close-button`).addEventListener(`click`, () => {
    // remote.app.quit();
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
        const password = !getElem(`roomPassword`).value || hidden ? `` : transformPassword(getElem(`roomPassword`).value);
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
                    }, user),
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
    const match = this.value.match(/\s+/);
    if (!this.value.length || match && match[0].length == this.value.length) {
        return showErrorModal(`Слишком пусто :C, мы не можем это отправить`);
    } else if (this.value.length > 4096) {
        return showErrorModal(`Ваша щедрость губительна для нас! Давайте полехче`);
    }
    delete user.lastPress;
    user.publish({
        message: this.value
    });
    this.value = ``;
}).bind(elements.inputMessage);

getElem(`disconnect`).addEventListener(`click`, async () => {
    if (user.room) {
        const name = user.room.name;
        await user.disconnect();
        swal(`Вы успешно вышли из комнаты!`);
        elements.inputMessage.blur();
    }
});

elements.send.addEventListener(`click`, async () => {
    if (user.room && user.audio) {
        changeIcon();
        delete user.audio;
        recorder.stop();
        return recorder.exportMP3(blob => {
            const url = URL.createObjectURL(blob);
            const div = document.createElement(`div`);
            div.innerHTML = `<audio src="${url}" controls>`;
            swal({
                title: `Отправка голосового сообщения`,
                content: div,
                buttons: ["Отмена", "Отправить"],
            }).then(answer => {
                if (answer) {
                    const fileReader = new FileReader();
                    fileReader.readAsArrayBuffer(blob);
                    fileReader.addEventListener(`loadend`, async () => {
                        sendBuffer(await zlib.deflate(Buffer.from(fileReader.result)), `.mp3`);
                    });
                }
            });
        });
    }
    if (user.room) {
        if (!elements.inputMessage.value.length && !user.audio) {
            swal(`Запись голоса началась!`);
            changeIcon(`send`);
            recorder = await getRec();
            recorder.record();
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
    password = transformPassword(password);
    console.log(password);
    const path = dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        properties: [`openDirectory`]
    });
    if (path) {
        const data = Buffer.from(encryptAES((await zlib.deflate(JSON.stringify(user._dump))).toString(encoding), password), encoding);
        const curDate = new Date();
        await fs.writeFile(`${path}\\${await getRandomId(3)}_${curDate.getDate().toString().padStart(2, `0`)}-${(curDate.getMonth() + 1).toString().padStart(2, `0`)}-${curDate.getFullYear()}_${await getRandomId(3)}.hdmp`, data);
        console.log(`okay`, data);
    }
});

getElem(`loadDump`).addEventListener(`click`, async () => {
    let file = dialog.showOpenDialog(currentWindow, {
        defaultPath: hendrixdir,
        properties: [`openFile`]
    });
    if (file) {
        let password = getElem(`dumpLoadPassword`).value;
        if (!password) {
            return showErrorDialog(`Слишком короткий пароль`);
        }
        password = transformPassword(password);
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
                    const {file} = message;
                    const {fileId, ext} = file;
                    const data = Buffer.from(file.fileData, `base64`);
                    const url = URL.createObjectURL(new Blob([data]));
                    let desc = file.info && file.info.description;
                    let ht = file.info && desc ? `<span>${desc}</span><br>` : ``;
                    let msg;
                    if (ext.match(/(png)|(jpg)|(gif)|(jpeg)/)) {
                        msg = `<img src="${url}" style="max-width: 100%">`
                    } else if (ext.match(/(mp3)|(wav)|(ogg)/)) {
                        msg = `<audio src="${url}" controls></audio>`;
                    } else if (ext.match(/(mp4)|(webm)|(ogv)/)) {
                        msg = `<video src="${url}" controls></video>`;
                    } else {
                        await fs.writeFile(path.join(hendrixdir, `${fileId}${ext}`), () => {});
                        msg = `<span class="lnk" onclick="openFile('${fileId}')">${fileId}${ext}</span>`;   
                    }
                    msg += `<br>${ht}`;
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

elements.inputMessage.addEventListener(`keydown`, function (e) {
    if (e.key == `Enter` && !e.ctrlKey) {
        e.preventDefault();
        if (!user.audio) {
            lastL = 0;
            changeIcon(`audio`);
        }
        send();
    } else if (e.key == `Enter` && e.ctrlKey) {
        this.value += `\n`;
    }
});

let lastL;

const changeIcon = name => {
    let curL;
    if (!name) {
        curL = +!!elements.inputMessage.value.length;
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
    const curL = +!!this.value.length;
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
    fileBlock.appendChild(fileLink);
    fileBlock.appendChild(fileProgress);
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
                fileProgress
            }
        }
    };
};

const addMessageSound = (message, user) => {
    if (message.user == user._id) {
        playSound(`sounds/inp.mp3`);
    } else {
        playSound(`sounds/out.mp3`);
    }
};

const sleep = time => new Promise(res => {
    setTimeout(() => {
        res(true);
    }, time);
});

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
    const name = getElem(`name`).value;
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
        if (localStorage.length) {
            ({
                ...user
            } = localStorage);
        } else {
            const color = `#${getElem(`color`).value}`;
            const _token = getElem(`token`).value;
            user = {
                name,
                color,
                _token
            };
            localStorage.setItem(`name`, name);
            localStorage.setItem(`color`, color);
            localStorage.setItem(`_token`, _token);
        }
        user.files = {};
        user.subNotifications = (async function (canceled) {
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
                process.nextTick(this.subNotifications);
            } else {
                process.nextTick(this.subNotifications, {
                    _id: notification._id
                });
            }
        }).bind(user);
        user.subscribe = (async function () {
            if (!this.room) {
                return;
            }
            let message = await requestPostAsync({
                url: `${server}/subscribe`,
                form: {
                    data: await getDataProperty(this.room, user),
                    _id: this._id
                }
            });
            if (message.success == false) {
                return await user.disconnect();
            }
            if (!message) {
                return process.nextTick(this.subscribe);
            }
            message = JSON.parse(await zlib.unzip(Buffer.from(decryptAES(message.data, this.aesKeyBytes), encoding)));
            if (message.typing) {
                if (message.user != user._id) {
                    nowTypingList[message.user] = `<span style="color:${message.color}"><b>${message.name}</b></span>`;
                    if (typingTimers[message.user]) {
                        clearTimeout(typingTimers[message.user]);
                    }
                    typingTimers[message.user] = setTimeout(() => {
                        delete nowTypingList[message.user];
                    }, 5000);
                }
                return process.nextTick(this.subscribe);
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
                    if (user.files[fileId]) {
                        SSort((a, b) => a - b, user.files[fileId].positions, user.files[fileId].parts);
                    } else {
                        const fileBlock = createMessageBlock(message.color, `${message.name}${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`);
                        elements.dialog.appendChild(fileBlock.messageBlock);
                        addMessageSound(message, this);
                        user.files[fileId] = {
                            path: path.join(hendrixdir, `${fileId}${ext}`),
                            fileMsg: fileBlock.childs.msgBlock
                        };
                    }
                    if (user.files[fileId].writeStream) {
                        if (user.files[fileId].positions[0] == 1 && user.files[fileId].positions.every((e, p, a) => !p || e - a[p - 1] == 1)) {
                            const data = await zlib.unzip(Buffer.concat(user.files[fileId].parts.map(e => Buffer.from(e, encoding))));
                            user.files[fileId].writeStream.write(data);
                            message.file.fileData = data.toString(`base64`);
                            const info = user.files[fileId].info;
                            if (info) {
                                message.file.info = info;
                            }
                            user._dump.push(message);
                            user.files[fileId].writeStream.end();
                            await waitWriteStream(user.files[fileId].writeStream);
                        } else {
                            showErrorModal(`Файл ${user.files[fileId].path} повреждён!`);
                        }
                    }
                    delete user.files[fileId].writeStream;
                    delete user.files[fileId].parts;
                    delete user.files[fileId].positions;
                    let desc = user.files[fileId].info && user.files[fileId].info.description;
                    let ht = user.files[fileId].info && desc ? `<span>${desc}</span><br>` : ``;
                    user.files[fileId].fileMsg.msg.innerHTML =
                    `${ext.match(/(png)|(jpg)|(gif)|(jpeg)/) ?
                    `<img src="${user.files[fileId].path}" style="max-width: 100%" onclick="openFile('${fileId}')">`
                    : ext.match(/(mp3)|(wav)|(ogg)/) ?
                    `<audio src="${user.files[fileId].path}" controls></audio>`
                    : ext.match(/(mp4)|(webm)|(ogv)/) ?
                    `<video src="${user.files[fileId].path}" controls></video>`
                    : `<span class="lnk" onclick="openFile('${fileId}')">${fileId}${ext}</span>`}<br>${ht}`;
                    delete user.files[fileId].fileMsg;
                } else {
                    if (!user.files[fileId]) {
                        const fileBlock = createMessageBlock(message.color, `<span onclick="copyText('${message.user}')" class="user">${message.name}</span>${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`);
                        elements.dialog.appendChild(fileBlock.messageBlock);
                        addMessageSound(message, this);
                        scroll();
                        user.files[fileId] = {
                            path: path.join(hendrixdir, `${fileId}${ext}`),
                            positions: [position],
                            parts: [filePart],
                            fileMsg: fileBlock.childs.msgBlock,
                            linkCreated: false
                        };
                        if (message.file.info) {
                            user.files[fileId].info = message.file.info;
                        }
                        user.files[fileId].writeStream = fs.createWriteStream(user.files[fileId].path);
                    } else {
                        user.files[fileId].positions.push(position);
                        user.files[fileId].parts.push(filePart);
                    }
                    if (!user.files[fileId].linkCreated) {
                        user.files[fileId].fileMsg.fileLink.innerHTML = `<span class="sendFile"><img src = "styles/file.png" style="-webkit-user-select: none;height: 16px;margin-right: 5px;"><span class="lnk" onclick="openFile('${fileId}')">${fileId}${ext} </span></span>`;
                        user.files[fileId].linkCreated = true;
                    }
                    user.files[fileId].fileMsg.fileProgress.innerHTML = `(${(progress * 100).toFixed(3)}%)`;
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
                user._dump.push(message);
                let nameBlock;
                if (message.user) {
                    nameBlock = `<span onclick="copyText('${message.user}')" class="user">${message.name}</span>`;
                } else {
                    nameBlock = message.name;
                }
                elements.dialog.insertAdjacentHTML(`beforeEnd`, getMessageBlock(message.color, `${nameBlock}${additional}`, `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}:${seconds.padStart(2, `0`)}`, text));
                addMessageSound(message, this);
                scroll();
                if (message.system && message.out == this._id) {
                    return;
                }
            }
            process.nextTick(this.subscribe);
        }).bind(user);
        user.publish = (async function (message) {
            const obj = Object.assign(message, this.room);
            let messagejson = JSON.stringify(obj);
            if (testEncrypt(messagejson, this.aesKeyBytes)) {
                requestPostAsync({
                    url: `${server}/publish`,
                    form: {
                        data: await getDataProperty(obj, user),
                        _id: this._id
                    }
                });
            } else {
                showErrorModal(`Недопустимые символы`);
            }
        }).bind(user);
        user.disconnect = (async function () {
            await requestPostAsync({
                url: `${server}/disconnect`,
                form: {
                    data: await getDataProperty(this.room, user),
                    _id: this._id
                }
            });
            delete this.room;
            this._dump = [];
            elements.dialog.innerHTML = elements.titleText.innerHTML = ``;
            return true;
        }).bind(user);
        elements.main.style.transform = `scale(0, 0)`;
        await sleep(500);
        user._id = await getRandomId();
        user._dump = [];
        const success = await getFirstKeys();
        user.subNotifications();
        console.log(user, success);
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
                }).then(async answer => {
                    if (answer) {
                        const desc = getElem(`description`).value;
                        sendBuffer(await zlib.deflate(imageBuffer), `.png`, {
                            description: desc.length <= highWaterMark ? desc : ``
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
                    data: await getDataProperty(obj, user),
                    _id: user._id
                }
            });
            return true;
        });
    });
    await waitStream(readStream);
    for (let i = 0; i < callbackStack.length; i++) {
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
            }, user),
            _id: user._id
        }
    });
    return true;
};

getElem(`file`).addEventListener(`click`, async () => {
    if (user.room) {
        const files = dialog.showOpenDialog(currentWindow, {
            properties: [`openFile`, `multiSelections`]
        });
        if (!files) {
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
            swal(`Все файлы успешно отправлены на сервер!`);
        }
    } else {
        showErrorModal(`Вы ещё не вошли в комнату!`);
    }
});