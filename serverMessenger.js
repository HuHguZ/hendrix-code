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

const encoding = `base64`;

const generateSessionKeyAES = async () => {
    const p = (await crypto.randomBytes(32)).toString(`hex`);
    const s = (await crypto.randomBytes(32)).toString(`hex`);
    return pbkdf2.pbkdf2Sync(p, s, 1, 256 / 8, 'sha512').toString(`hex`);
};

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

const disconnect = (room, user, _id) => {
    if (!room) {
        console.log(`${date.format(new Date())} комнаты нет, баг.`);
        console.log(user);
    }
    room.members.splice(room.members.indexOf(_id), 1);
    room.out[_id] = 1;
    delete user.curRoom;
    room.stackMessages.push(getSystemMessage({
        message: `[clr=${user.color}]${user.name}[/] вышел из комнаты [clr=${room.color}]${room.name}[/]!`,
        out: _id,
    }));
};

const getData = async (data, key) => {
    return JSON.parse(await zlib.unzip(Buffer.from(decryptAES(data, key), encoding)));
}

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
    extended: false
}));

// app.use((req, res, next) => {
//     console.log(req.url);
//     next();
// })

const server = http.listen(8080, function () {
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
    const data = await getData(req.body.data, user.aesKeyBytes);
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
            message: `suck!`
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
        const user = await getData(req.body.data, aesKeyBytes);
        const {
            name,
            color,
            secretString,
            _token
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
    const room = await getData(req.body.data, Users[userId].aesKeyBytes);;
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
    const roomData = await getData(req.body.data, key);
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
        if (!room.members.includes(userId)) {
            room.members.push(userId);
        }
        if (!room.roulette.users[userId]) {
            room.roulette.users[userId] = {
                balance: 100,
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
    } else {
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
    const roomData = await getData(req.body.data, key);
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

setInterval(() => {
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
                filter[i] = 1;
                continue;
            }
            if (!room.out[userId]) {
                response.send(encryptObjAES(Object.assign({}, message), Users[userId].aesKeyBytes));
            }
        }
        room.stackResMessage = room.stackResMessage.filter((response, position) => filter[position]);
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
        message: `Доступно только создателям комнаты!`
    }));
});

const getAdminHandler = handler => getHandlerWithCondition((match, user, userId, room, roomId) => confirmed[user._token] && confirmed[user._token].root, handler, (match, user, userId, room, roomId) => {
    room.stackMessages.push(getSystemMessage({
        message: `Доступ запрещён.`
    }));
});

const commands = [{
        reg: /[!/]кто\s+([\s\S]+)/gi,
        handler(match, user, userId, room, roomId) {
            const roomUsers = room.members;
            const randomUser = Users[room.members[Math.random() * room.members.length ^ 0]];
            room.stackMessages.push(getSystemMessage({
                message: `[clr=${randomUser.color}]${randomUser.name}[/] ${match[1]}`
            }));
        }
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
        handler: getRoomCreatorHandler((match, user, userId, room, roomId) => {
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
        })
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
                            message: `Не такого варианта!`
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
        handler(match, user, userId, room, roomId) {
            room.stackMessages.push(getSystemMessage({
                message: `[clr=${user.color}]${user.name}[/], Ваш баланс [clr=${user.color} bold]${room.roulette.users[userId].balance}[/]!`
            }));
        }
    },
    {
        reg: /[!/]перевести\s+(\d+)\s+([a-f\d]+)/gi,
        handler(match, user, userId, room, roomId) {
            const count = +match[1];
            const whom = Users[match[2]];
            if (whom) {
                if (match[2] == userId) {
                    return room.stackMessages.push(getSystemMessage({
                        message: `Зачем переводить самому себе?`
                    }));
                }
                if (!count) {
                    return room.stackMessages.push(getSystemMessage({
                        message: `Слишком маленькая сумма для транзакции!`
                    }));
                }
                const yourData = room.roulette.users[userId];
                if (yourData.balance < count) {
                    room.stackMessages.push(getSystemMessage({
                        message: `Недостаточно средств!`
                    }));
                } else {
                    yourData.balance -= count;
                    room.roulette.users[match[2]].balance += count;
                    room.stackMessages.push(getSystemMessage({
                        message: `[clr=${user.color}]${user.name}[/], Вы успешно перевели [clr=${user.color} bold]${count}[/] пользователю [clr=${whom.color}]${whom.name}[/]`
                    }));
                }
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Пользователь не существует!`
                }));
            }
        }
    },
    {
        reg: /[!/]ставка\s+(\d+(?:\.\d+)?)\s+([\d-\sа-яё!]+)/gi,
        handler(match, user, userId, room, roomId) {
            let count = +match[1];
            if (room.roulette.users[userId].balance < count) {
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
                count
            };
            const winned = Math.round(count * bet.coef);
            room.roulette.bets[userId] = bet;
            const userBet = room.roulette.users[userId];
            userBet.totalBets++;
            userBet.balance -= bet.count;
            room.stackMessages.push(getSystemMessage({
                message: `[clr=${user.color}]${user.name}[/], ставка сделана!\nШанс на победу: [bold]${(bet.chance * 100).toFixed(3)}%[/]\nКоэффициент: [bold]${bet.coef.toFixed(3)}[/]\nВыбранные числа: [bold]${bet.numbers.map(num => `[clr=${num % 2 ? `#01ADF7` : `red`} bold]${num}[/]`).join(` `)}[/]\nВ случае победы вы получите [bold]${winned} ([clr=green]+${winned - count}[/])[/]\nБаланс: ${userBet.balance}\nРезультаты ставки через ${Math.round(((+roulette.maximumBetTime + roulette.delay) - curDate)/ 1000)} секунд`
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
        handler(match, user, userId, room, roomId) {
            const users = [];
            let message = `Рейтинг:\n`;
            for (_id in room.roulette.users) {
                if (!Users[_id]) {
                    //Если пользователь вышел, хранить его статистику больше не имеет смысла
                    delete room.roulette.users[_id];
                    continue;
                }
                const user = room.roulette.users[_id];
                users.push({
                    balance: user.balance,
                    _id
                });
            }
            users.sort((b, a) => a.balance - b.balance);
            for (let i = 0; i < users.length; i++) {
                const user = Users[users[i]._id];
                message += `${i + 1}. [clr=${user.color} bold]${user.name}[/] ${users[i].balance}\n`;
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
        handler: getAdminHandler((match, user, userId, room, roomId) => {
            const count = +match[1];
            const whom = Users[match[2]];
            if (!whom) {
                return room.stackMessages.push(getSystemMessage({
                    message: `Пользователь не существует!`
                }));
            }
            if (count) {
                room.roulette.users[match[2]].balance += count;
                return room.stackMessages.push(getSystemMessage({
                    message: `Баланс [clr=${whom.color}]${whom.name}[/] изменён на [clr=${count > 0 ? `green bold]+` : `red bold]`}${count}[/]!`
                }));
            } else {
                room.stackMessages.push(getSystemMessage({
                    message: `Неправильная сумма!`
                }));
            }
        })
    }
];

const getRouletteCallback = room => res => {
    room.placeBet = false;
    let message = `Результаты ставки ${roulette.round} - [clr=${res % 2 ? `#01ADF7` : `red`} bold]${res}[/]\n`;
    for (let _id in room.roulette.bets) {
        const bet = room.roulette.bets[_id];
        const user = Users[_id];
        const userBet = room.roulette.users[_id];
        if (bet.numbers.includes(res)) {
            const winned = Math.round(bet.coef * bet.count);
            room.roulette.users[_id].balance += winned;
            message += `[clr=${user.color}]${user.name}[/] выиграл [clr=green bold]+${winned}[/]\n`;
            userBet.wins += 1;
            userBet.totalWon += (winned - bet.count);
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
    const data = await getData(req.body.data, Users[req.body._id].aesKeyBytes);
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
    const roomData = await getData(req.body.data, key);
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
    const roomData = await getData(req.body.data, key);
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
    const data = await getData(req.body.data, user.aesKeyBytes);
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

app.post(`/check`, (req, res) => {
    res.send({
        success: true
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