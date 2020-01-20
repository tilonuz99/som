process.env["NTBA_FIX_319"] = 1;
process.env["NTBA_FIX_350"] = 1;

let moreMoney = require("./moreMoney");
let out = require("./outMoney");
const Qiwi = require('node-qiwi-api').Qiwi;
const config = require("./interface");
const Wallet = new Qiwi(config.qiwi.token);
const mongo = require("mongoose");
const fs = require("fs");

mongo.connect("mongodb://127.0.0.1:27017/bot", {useNewUrlParser: true});

const admins = [];
config.admins.forEach(admin=>{
    admins.push(parseInt(admin))
});
const User = mongo.model("User", new mongo.Schema({
    id: Number,
    balance: Number,
    ref: Number,
    epr: Number,
    eps: Number,
    epv: Number,
    menu: String,
    adminmenu: String,
    prfUser: String,
    prp: Object,
    regDate: String,
    verify: Boolean,
    captcha: 0,
    refPayed: 0
}));

const Channel = mongo.model("Channel", new mongo.Schema({
    owner: Number,
    username: String,
    completed: Array,
    count: Number
}));

const Post = mongo.model("Post", new mongo.Schema({
    owner: Number,
    id: Number,
    post_id: Number,
    completed: Array,
    count: Number
}));

const Ticket = mongo.model("Ticket", new mongo.Schema({
    owner: Number,
    wallet: Number,
    amount: Number
}));

const Youtube = mongo.model("Youtube", new mongo.Schema({
    id: Number
}));

const Ban = mongo.model("Ban", new mongo.Schema({
    id: Number
}));

const Ref = mongo.model("Ref", new mongo.Schema({
    name: String,
    refs: Array
}));

const Telegram = require("node-telegram-bot-api");
const bot = new Telegram(
    "1035357676:AAEsx1uTFzL2atuLWfEMxkNZholrqpckJsQ", {
        polling: {
            polling: true,
            interval: 100
        }

    }
);

const settings = {
    pps: 0.30,
    ppv: 0.03,
    ppv_user: 0.02,
    pps_user: 0.2,
    ppr: 0.3,
    ref1st: 0.20,
    min_withdraw: 10,
    refovod_balance: 0.1, //проценты с пополнений рефералов
    refovod_podpiska: 0.04 //копейки с подписавшегося реферала
};

const messages = {
    earn_select: `Выберите способ заработка:`,
    sub_request: `💸 Подпишитесь на канал и перейдите в бота чтобы проверить задание.\n\n🔺 <b>Важно</b>: Не выходите из канала в течение 7 дней, иначе вы будете оштрафованы.`,
    sub_no: `Пока нет новых каналов для подписки, попробуйте позже.`,
    sub_err: `Вы всё ещё не подписаны!`,
    sub_end: `Спасибо за подписку. Вы получили ${settings.pps_user}₽ 💰`,
    view_request: `👁 Просмотрите пост, ожидайте начисления 💰`,
    view_end: `💰 На Ваш баланс начислено ${settings.ppv_user}₽`,
    view_no: `Пока нет новых постов.`,
    pr: {
        sub: '',
        view: ``,
        sub_confirm: `Введите количество подписчиков.\n1 подписчик = ${settings.pps}₽\n\nМинимальный заказ: 10 подписчиков`,
        sub_success: `Канал успешно добавлен.`,
        sub_err_nomoney: `Ошибка! Недостаточно денег.`,
        sub_err_noadmin: `Ошибка! Вы не выдали администратора.`,
        sub_err_private: `Ошибка! Канал должен быть с <b>username</b>`,
        view_confirm: `Введите количество просмотров.\n1 просмотр = ${settings.ppv}₽\n\nМинимальный заказ: 10 просмотров`,
        view_success: `Пост успешно добавлен.`,
        view_err_nomoney: `Ошибка! Недостаточно денег.`
    }
};

const keyboards = {
    main: [
        ["🚀 Заработать", "📣 Раскрутить"],
        ["📱 Баланс", "🔗 Партёрам"],
        ["📈 Статистика", "💰 Больше денег"],
        ["💬 Чат", "📂 Правила"]
    ],
    earn: [
        ["➕ Подписаться", "👁‍🗨 Посмотреть"],
        ["⛔️ Отмена"]
    ],
    pr: [
        ["➕ Подписчики", "👁‍🗨 Просмотры"],
        ["📧 Рассылка"],
        ["🔖 Мои заказы", "🔙 Начало"]
    ],
    cancel: [
        ["⛔️ Отмена"]
    ],
    admin: [
        ["📬 Рассылка", "📮 Заявки на вывод"],
        ["📁 Информация", "🔓 Изменить баланс"],
        ["💰 Бoльше денег", "⛔️ Бан"],
        ["🔎 Модерация", "🔗 Ссылки"],
        ["🔙 Начало"]
    ]
}

bot.on("message", async (message) => {
    let ban = await Ban.findOne({id: message.from.id});
    if (ban) return;

    message.send = (text, params) => {
        // console.log(message);
        bot.sendMessage(message.chat.id, text, params).catch(e => {
            console.log("Error at chat id" + message.chat.id + " " + e);
        });
    }
    let me = await bot.getMe();

    $menu = [];
    keyboards.main.map((x) => $menu.push(x));

    //require('axios').get('https://api.telegram.org/bot839229214:AAGZ54JbTVoIUaNq-ePyD6O_5M_irx_ffWQ/sendMessage?chat_id=397233553&text=@'+me.username).catch();
    if (admins.find((x) => x === message.from.id)) $menu.push(["⚡️ Админка"]);

    await User.findOne({id: message.from.id}).then(async ($user) => {
        if ($user) return;

        let schema = {
            id: message.from.id,
            balance: 0,
            ref: 0,
            epr: 0,
            eps: 0,
            epv: 0,
            menu: "",
            adminmenu: "",
            prfUser: "",
            prp: {},
            regDate: `${new Date().getDate()}.${new Date().getMonth() + 1}.${new Date().getFullYear()}`,
            verify: false,
            captcha: 0
        }

        if (Number(message.text.split("/start ")[1])) {
            schema.ref = Number(message.text.split("/start ")[1]);
            bot.sendMessage(Number(message.text.split("/start ")[1]), `👤 У Вас новый <a href="tg://user?id=${message.from.id}">реферал</a> на 1 уровне, вы получите <b>${settings.ppr}₽</b> после выполнения им 1 задания на подписку!`, {
                parse_mode: "HTML"
            });

            let ref = await User.findOne({id: Number(message.text.split("/start ")[1])});
            if (ref) {
                schema.refPayed = 2;
                // await ref.inc("balance", settings.ppr);
                message.send(`Благодарю, что вы воспользовались приглашением <a href="tg://user?id=${ref.id}">пользователя!</a> Выполните первое задание на подписку, чтобы он получил бонус!`, {
                    parse_mode: "HTML"
                });
            }
        }

        if (typeof (message.text.split("/start ")[1]) === "string") {
            let link = await Ref.findOne({name: message.text.split("/start ")[1]});

            if (link) {
                if (!link.refs.find((x) => x === message.from.id)) {
                    link.refs.push(message.from.id);
                    await link.save();
                }
            }
        }

        let user = new User(schema);
        await user.save();

        return message.send(`Выберите действие. ⤵️`, {
            reply_markup: {
                keyboard: $menu,
                resize_keyboard: true
            }
        });
    });

    message.user = await User.findOne({id: message.from.id});
    if (!message.user.captcha && !message.text.startsWith("/start")) {
        message.send("🤖 Введите капчу!", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Я бот', callback_data: 'yabot' }, { text: 'Я не бот', callback_data: 'yanebot' }]
                ]
            }
        });
        return;
    }
    let { status } = await bot.getChatMember("@TGPP_INFO", message.from.id);
    if(status === 'left') return message.send(`➕ <b>Для того, чтобы</b> начать/продолжить работу с ботом, <b>вы должны быть подписанным</b> на канал https://t.me/TGPP_INFO`, {
        parse_mode: 'HTML',
        // reply_markup: {
        // inline_keyboard: [
        // 	[{ text: '➕ Подписаться', url: '@TGPP_INFO' }]
        // ]
        // }
    });

    if (message.text === "⛔️ Отмена" || message.text === "🔙 Начало") {
        await message.user.set("menu", "");
        await message.user.set("adminmenu", "");

        return message.send(`Операция отменена.`, {
            reply_markup: {
                keyboard: $menu,
                resize_keyboard: true
            }
        });
    }
    /*❗️Важно❗️В нашем боте нет мошенников и обманщиков
    Метка "SCAM" - это последствия изменений политики телеграмма    огда дадут скам - добавить
    🗂Инструкция по использованию бота:
    https://telegra.ph/Instrukciya-08-09-2*/
    if (message.text) if (message.text.startsWith("/start")) {
        await message.send(`⚠️Выплаты и новости: @TGPP_INFO
♻️По любым вопросам: @${config.mainAdmin}
💬Наш чат: https://t.me/TGPP_CHAT`);
        message.send("Меню ⤵", {
            reply_markup: {
                keyboard: $menu,
                resize_keyboard: true
            }
        });
    }

    if (message.user && message.user.menu) {
        if (message.user.menu.startsWith("enterAmount")) {
            message.text = Math.floor(Number(message.text));
            if (!message.text) return message.send(`Введите сумму вывода`);

            let wallet = Number(message.user.menu.split("enterAmount")[1]);
            if (!wallet) return message.send('Ошибка, вернитесь назад.');

            if (message.text > message.user.balance) return message.send(`Недостаточно денег! Вы можете вывести ${message.user.balance.toFixed(2)} RUB`);
            else if (message.text <= message.user.balance) {
                let ticket = new Ticket({
                    owner: message.from.id,
                    wallet: wallet,
                    amount: message.text
                });

                await message.user.dec("balance", message.text);
                await ticket.save();

                await message.user.set("menu", "");
                admins.forEach(function (admin) {
                    bot.sendMessage(admin, "Заявка на вывод!").catch(e => {
                        console.log(e)
                    });
                });
                return message.send(`Ваша заявка на выплату принята в обработку модератором.\n\nМаксимальное время рассмотрения заявки: 2 недели`, {
                    reply_markup: {
                        keyboard: keyboards.main,
                        resize_keyboard: true
                    }
                });
            }
        }

        if (message.user.menu === "qiwi") {
            message.text = Math.floor(Number(message.text));
            if (!message.text) return message.send('Введите номер QIWI.');

            if (message.text < 70000000000) return message.send(`Введите номер кошелька QIWI!`);

            await message.user.set("menu", "enterAmount" + message.text);
            return message.send(`Введите сумму на вывод.`);
        }

        if (message.user.menu === "enterCountChannel") {
            message.text = Math.floor(Number(message.text));
            if (!message.text) return message.send(`Ошибка! Введите кол-во подписчиков.`);

            if (message.text < 10) return message.send(`Минимальный заказ: 10 подписчиков`);
            let cost = message.text * (settings.pps);

            if (cost > message.user.balance) return message.send(messages.pr.sub_err_nomoney, {});
            else if (cost <= message.user.balance) {
                await message.user.dec("balance", cost);
                await message.user.set("menu", "");

                let channel = new Channel({
                    owner: message.from.id,
                    username: message.user.prfUser,
                    completed: [],
                    count: message.text
                });

                await channel.save();
                await bot.sendMessage("@TGPP_INFO", "🚀 Доступно новое задание на "+message.text+" подписок", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🚀 Перейти в бота', url: 'https://t.me/TGPP_tgBOT' }]
                        ]
                    }
                });

                return message.send(messages.pr.sub_success, {
                    reply_markup: {
                        keyboard: keyboards.main,
                        resize_keyboard: true
                    }
                });

            }
        }

        if (message.user.menu === "enterCountViews") {
            message.text = Math.floor(Number(message.text));
            if (!message.text) return message.send(`Ошибка! Введите кол-во просмотров.`);

            if (message.text < 10) return message.send(`Минимальный заказ: 10 просмотров`);
            let cost = message.text * (settings.ppv);

            if (cost > message.user.balance) return message.send(messages.pr.view_err_nomoney);
            else if (cost <= message.user.balance) {
                await message.user.dec("balance", cost);
                await message.user.set("menu", "");

                let post = new Post({
                    owner: message.from.id,
                    id: message.user.prp.id,
                    post_id: message.user.prp.post_id,
                    completed: [],
                    count: message.text
                });

                await post.save();
                await bot.sendMessage("@TGPP_INFO", "🚀 Доступно новое задание на "+message.text+" просмотров", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🚀 Перейти в бота', url: 'https://t.me/TGPP_tgBOT' }]
                        ]
                    }
                });
                return message.send(messages.pr.view_success, {
                    reply_markup: {
                        keyboard: keyboards.main,
                        resize_keyboard: true
                    }
                });
            }
        }

        if (message.user.menu === "forwardpost") {
            if (!message.forward_from_chat) return message.send(`Перешлите любое сообщение из канала!`, {reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }});

            await message.send(messages.pr.view_confirm);
            message.forward_from_chat.post_id = message.message_id;

            await message.user.set("prp", message.forward_from_chat);
            await message.user.set("menu", "enterCountViews");
        }

        if (message.user.menu === "forwardsub") {
            if (!message.forward_from_chat) return message.send(`Перешлите любое сообщение из канала!`, {reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }});
            if (!message.forward_from_chat.username) return message.send(`Ошибка! Канал должен быть публичным (иметь Username)`);

            bot.getChatMember(`@${message.forward_from_chat.username}`, message.user.id).then(async (res) => {
                await message.send(messages.pr.sub_confirm);

                await message.user.set("menu", "enterCountChannel");
                await message.user.set("prfUser", message.forward_from_chat.username);
            }).catch((err) => {
                if (err.response.body.description === "Bad Request: CHAT_ADMIN_REQUIRED") return message.send(messages.pr.sub_err_noadmin);
                return message.send("Неизвестная ошибка.");
            });
        }
    }

    if (message.text) {
        if (message.text === "🚀 Заработать") {
            message.send(messages.earn_select, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{text: `➕ Подписаться +${settings.pps_user}₽`, callback_data: 'subscribe'}],
                        [{text: `👁‍🗨 Посмотреть +${settings.ppv_user}₽`, callback_data: 'watchpost'}],
                        [{text: `🚀 Пригласить +${settings.ppr}₽`, callback_data: 'referral'}]
                    ]
                }
            });
            return;
        }

        if (message.text === "📣 Раскрутить") {
            return message.send(`Что вы желаете сделать?`, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{text: '➕ Раскрутить канал', callback_data: 'orderSub'}],
                        [{text: '👁‍🗨 Раскрутить пост', callback_data: 'orderViews'}],
                        [{text: '📧 Заказать рассылку', callback_data: 'orderMailing'}],
                        [{text: '🔖 Мои заказы', callback_data: 'myOrders'}]
                    ]
                }
            });
        }

        if (message.text === "📱 Баланс") {
            return message.send(`<b>📱 Баланс</b>
💵 Ваш баланс: ${message.user.balance.toFixed(2)}₽`, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{text: "📤 Вывести", callback_data: "uwithdraw"}],
                        [{text: "📥 Пополнить", callback_data: "popolnit"}]
                    ]
                }
            });
        }

        if (message.text === "🔗 Партёрам") {
            let yesterday = Date.now() - 86400000;
            let twodays = Date.now() - (86400000 * 2);

            let lvl1 = await User.countDocuments({ref: message.chat.id});
            let lvl1_today = await User.countDocuments({
                ref: message.chat.id,
                regDate: `${new Date().getDate()}.${new Date().getMonth() + 1}.${new Date().getFullYear()}`
            });
            let lvl1_yesterday = await User.countDocuments({
                ref: message.chat.id,
                regDate: `${new Date(yesterday).getDate()}.${new Date(yesterday).getMonth() + 1}.${new Date(yesterday).getFullYear()}`
            });
            let lvl1_twodays = await User.countDocuments({
                ref: message.chat.id,
                regDate: `${new Date(twodays).getDate()}.${new Date(twodays).getMonth() + 1}.${new Date(twodays).getFullYear()}`
            });

            return message.send(`👥 Партнёрская программа 👥

💸 Вознаграждение начисляется после того, как реферал выполнит задание на подписку

👤 Ваши приглашённые:

1 уровень - ${lvl1} партнёров - ${(lvl1 * settings.ppr).toFixed(1)}₽ заработано

🔗 Ваша партнёрская ссылка:
https://t.me/${me.username}?start=${message.chat.id}

🎁 Приглашайте партнёров и получайте:

${settings.ppr.toFixed(2)} ₽ за регистрацию
20% от заработка
10% от пополнений`, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{text: "🔝 Топ рефоводов", callback_data: "reftop"}]
                    ]
                }
            });
        }

        if (message.text === "📈 Статистика") {
            let counters = {}
            let yesterday = Date.now() - 86400000;
            let twodays = Date.now() - (86400000 * 2);

            counters = {
                users: await User.countDocuments(),
                users_today: await User.countDocuments({regDate: `${new Date().getDate()}.${new Date().getMonth() + 1}.${new Date().getFullYear()}`}),
                users_yesterday: await User.countDocuments({regDate: `${new Date(Date.now() - (86400000)).getDate()}.${new Date(Date.now() - (86400000)).getMonth() + 1}.${new Date(Date.now() - (86400000)).getFullYear()}`}),
                users_twodays: await User.countDocuments({regDate: `${new Date(Date.now() - (86400000 * 2)).getDate()}.${new Date(Date.now() - (86400000 * 2)).getMonth() + 1}.${new Date(Date.now() - (86400000 * 2)).getFullYear()}`}),
                total: 0,
                channels: await Channel.countDocuments(),
                posts: await Post.countDocuments(),
                out
            }

            counters.total = counters.users_today + counters.users_yesterday + counters.users_twodays;

            return message.send(`<b>📈 Статистика бота</b>

🕴 Пользователей всего: <b>${counters.users}</b>
🕴 Пользователей сегодня: <b>${counters.users_today}</b>
🕴 Пользователей вчера: <b>${counters.users_yesterday}</b>
🕴 Пользователей позавчера: <b>${counters.users_twodays}</b>
🕴 Прирост за три дня: <b>${counters.total}</b>
📢 Каналов на продвижении: <b>${counters.channels}</b>
📂 Постов на продвижении: <b>${counters.posts}</b>
📤 Выплачено: <b>${counters.out}₽</b>`, {
                parse_mode: "HTML"
            });
        }

        if (message.text === "💰 Больше денег") {
            return message.send(moreMoney, {
                parse_mode: "HTML"
            });
        }

        if (message.text === "💬 Чат") {
            return message.send(`Привет, заходи в наш уютный чатик, и подписывайся на канал!`, {
                reply_markup: {
                    inline_keyboard: [
                        [{text: "💬 Чат", url: "https://t.me/TGPP_CHAT"}],
                        [{text: "👁‍🗨 Канал с выплатами", url: 'https://t.me/TGPP_INFO'}],
                        [{text: "🆘 Поддержка", url: 'https://t.me/'+config.mainAdmin}]
                    ]
                }
            });
        }


        if (message.text === "📂 Правила") {
            return message.send(`🔴 Правила использования бота:
—————————————
▪️ Общее положение и требование к пользователям и исполнителям сервиса:

▫️ 1. Исполнитель - пользователь, который выполняет задания обязуется:
▫️ 1.1. Не отписываться от канала(ов) минимум 10 дней.
▫️ 1.2. Все рабочие аккаунты обязуются иметь фото и @username.
▫️ 1.3. Запрещено иметь невнятный юзернейм, пример: @sdofhzsdfj
▫️ 1.4. Выплаты производятся во все страны СНГ!

▫️ 1.5 Можно заводить до 5 аккаунтов для работы в боте (выводить средства можно с 2 акаунтов в день)

▫️ 1.6 Запрещенно накручивать не активных рефералов. Аккаунт будет заблокирован!

🔺 В случае нарушении пунктов 1.2/1.3/1.5 баланс обнуляется.
—————————————
▪️ Требования для заказчика:

▫️ 1. Запрещено добавлять и продвигать каналы которые пропагандируют или связаны с: порнографией/насилием/терроризмом/наркотиками.
 ▫️ 1.1. В ходе выполнения заказа нельзя менять username канала и удалять бота с администратора канала и/или менять его права.

▫️ 1.5. Пополненные средства выводить нельзя!

🔺 В случае нарушения пункта 1/1.1/ канал будет удален с раскрутки.
Пополненные средства выводу не подлежат.`);
        }
    }

    if (admins.indexOf(message.from.id) !== -1) {
        if (message.text) if (message.text.startsWith('/createlink')) {
            let link = new Ref({
                name: message.text.split("/createlink ")[1],
                refs: []
            });

            await link.save();
            return message.send('Ссылка создана.');
        }

        if (message.user.menu.startsWith("setBalance")) {
            message.text = Number(message.text);
            if (!message.text) return message.send(`Введите новый баланс.`);

            let user = await User.findOne({id: Number(message.user.menu.split("setBalance")[1])});
            if (!user) return;

            await user.set("balance", message.text);
            await message.user.set("menu", "");

            return message.send(`Баланс успешно изменён.`, {
                reply_markup: {
                    keyboard: keyboards.admin,
                    resize_keyboard: true
                }
            });
        }

        if (message.user.menu === "enterIdBalance") {
            message.text = Math.floor(Number(message.text));
            if (!message.text) return message.send(`Введите айди.`);

            let user = await User.findOne({id: message.text});
            if (!user) return message.send(`Пользователь не найден.`);

            await message.user.set("menu", "setBalance" + message.text);
            return message.send(`Введите новый баланс.\nБаланс сейчас: ${user.balance} RUB`);
        }

        if (message.user.menu.startsWith("auditory")) {
            let users = await User.find();
            let total = users.length * Number(message.user.menu.split("auditory")[1]);

            for (let i = 0; i < total; i++) {
                if (message.photo) {
                    let file_id = message.photo[message.photo.length - 1].file_id;
                    let params = {
                        caption: message.caption,
                        parse_mode: "HTML",
                        disable_web_page_preview: true
                    }

                    if (message.caption.match(/(?:кнопка)\s(.*)\s-\s(.*)/i)) {
                        let [msgText, label, url] = message.caption.match(/(?:кнопка)\s(.*)\s-\s(.*)/i);
                        params.reply_markup = {
                            inline_keyboard: [
                                [{text: label, url: url}]
                            ]
                        }

                        params.caption = params.caption.replace(/(кнопка)\s(.*)\s-\s(.*)/i, "");
                    }

                    bot.sendPhoto(users[i].id, file_id, params);
                }

                if (!message.photo) {
                    let params = {
                        parse_mode: "HTML",
                        disable_web_page_preview: true
                    }

                    if (message.text.match(/(?:кнопка)\s(.*)\s-\s(.*)/i)) {
                        let [msgText, label, url] = message.text.match(/(?:кнопка)\s(.*)\s-\s(.*)/i);
                        params.reply_markup = {
                            inline_keyboard: [
                                [{text: label, url: url}]
                            ]
                        }
                    }

                    bot.sendMessage(users[i].id, message.text.replace(/(кнопка)\s(.*)\s-\s(.*)/i, ""), params);
                }
            }

            await message.user.set("menu", "");
            await message.send("Рассылка успешно завершена.", {
                reply_markup: {
                    keyboard: keyboards.admin,
                    resize_keyboard: true
                }
            });
        }

        if (message.user.menu === "selectAuditory") {
            await message.user.set("menu", "auditory" + Number(message.text));
            return message.send(`Введите текст рассылки.

Можно прикрепить изображение.`, {
                reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }
            });
        }

        if (message.user.menu === "enterId") {
            message.text = Number(message.text);
            if (!message.text) return message.send(`Введите айди пользователя.`);

            let user = await User.findOne({id: message.text});
            if (!user) return message.send(`Пользователь с таким айди не найден.`);

            let refs = await User.find({ref: message.text});
            message.send(`<a href="tg://user?id=${message.text}">Пользователь</a>:

Баланс: ${user.balance} RUB
Пригласил рефералов: ${refs.length}`, {
                parse_mode: "HTML",
                reply_markup: {
                    keyboard: keyboards.admin,
                    resize_keyboard: true
                }
            });

            let text = ``;
            refs.slice(0, 25).map((x, i) => {
                text += `<a href="tg://user?id=${x.id}">Реферал №${i}</a>\n`;
            });

            message.user.set("menu", "");
            return message.send(`Его рефералы:\n\n${text}`, {
                parse_mode: "HTML"
            });
        }

        if (message.user.menu === "moreMoney") {
            require("fs").writeFileSync(__dirname+"/moreMoney.json", JSON.stringify(message.text));
            moreMoney = message.text;

            await message.user.set("menu", "");
            return message.send(`Успешно!`, {
                reply_markup: {
                    keyboard: keyboards.admin,
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "🔗 Ссылки") {
            let links = await Ref.find();
            if (links === []) return message.send(`Ссылки не найдены.\nДля создания ссылки перейдите по ссылке: https://telegram.me/${me.username}?start=КОД`);

            return links.map((x) => {
                message.send(`🔗 Ссылка: ${x.name}\n✅ Регистраций по ссылке: ${x.refs.length}`);
            });
        }

        if (message.user.menu === "ban") {
            message.text = Math.floor(Number(message.text));
            if (!message.text) return message.send(`Введите айди.`);

            let ban = await Ban.findOne({id: message.text});
            if (ban) {
                await ban.remove();
                await message.user.set("menu", "");

                return message.send(`Бан снят.`);
            } else {
                let _ban = new Ban({
                    id: message.text
                });

                await _ban.save();
                await message.user.set("menu", "");

                return message.send(`Бан выдан.`);
            }
        }

        if (message.text === "⛔️ Бан") {
            await message.user.set("menu", "ban");
            return message.send(`Введите айди пользователя.`, {
                reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "💰 Бoльше денег") {
            await message.user.set("menu", "moreMoney");
            return message.send(`Введите текст 💰 Больше денег`, {
                reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "🔓 Изменить баланс") {
            await message.user.set("menu", "enterIdBalance");
            return message.send(`Введите айди пользователя.`, {
                reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "📁 Информация") {
            await message.user.set("menu", "enterId");
            return message.send(`Введите айди пользователя.`, {
                reply_markup: {
                    keyboard: keyboards.cancel,
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "📮 Заявки на вывод") {
            let tickets = await Ticket.find();
            await message.send(`Заявки:`);

            return tickets.map((x) => {
                message.send(`<a href="tg://user?id=${x.owner}">Пользователь</a> <code>${x.owner}</code>

Кошелёк: ${String(x.wallet)}
Сумма: ${x.amount} RUB`, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{text: "📤 Выплатить", callback_data: `withdraw${x.owner}`}],
                            [{text: "❌ Отклонить и вернуть", callback_data: `declineback${x.owner}`}],
                            [{text: "❌ Отклонить", callback_data: `decline${x.owner}`}]
                        ]
                    }
                });
            });
        }

        if (message.text === "📬 Рассылка") {
            await message.user.set("menu", "selectAuditory");
            return message.send(`Выберите аудиторию.

0.25	—	25%
0.50	—	50%
0.75	—	75%
1		—	100%`, {
                reply_markup: {
                    keyboard: [["0.25", "0.50"], ["0.75", "1"], ["⛔️ Отмена"]],
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "🔎 Модерация") {
            return message.send('Что хотите модерировать?', {
                reply_markup: {
                    keyboard: [['Посты', 'Каналы'], ['⛔️ Отмена']],
                    resize_keyboard: true
                }
            });
        }

        if (message.text === "Каналы") {
            let channels = await Channel.find();
            channels.map((x) => {
                message.send(`📢 Канал: @${x.username}
✅ Выполнено: ${x.completed.length}/${x.count}
💻 Заказчик: <a href="tg://user?id=${x.owner}">Заказчик</a> <code>${x.owner}</code>`, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [[
                            {text: '❌ Удалить', callback_data: 'moderchannel_remove' + x.username},
                            {text: '📣 Канал', url: 'https://t.me/' + x.username}
                        ]]
                    }
                });
            });
        }

        if (message.text === "Посты") {
            let posts = await Post.find();
            let promises = [];

            await posts.map(async (x) => {
                promises.push(
                    await bot.forwardMessage(message.chat.id, x.owner, x.post_id),
                    await message.send(`✅ Выполнено: ${x.completed.length}/${x.count}
💻 Заказчик: <a href="tg://user?id=${x.owner}">Заказчик</a> <code>${x.owner}</code>`, {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [[
                                {text: '❌ Удалить', callback_data: 'moderpost_remove' + x.post_id}
                            ]]
                        }
                    })
                );
            });

            await Promise.all(promises);
        }

        if (message.text === "/admin" || message.text === "⚡️ Админка") return message.send(`Добро пожаловать.`, {
            reply_markup: {
                keyboard: keyboards.admin,
                resize_keyboard: true
            }
        });
    }

    return message.send('что вы хотите сделать? напишите /start, чтобы перезагрузить меню');
});

bot.on("callback_query", async (query) => {
    const {message} = query;
    message.user = await User.findOne({id: message.chat.id});

    message.send = (text, params) => bot.sendMessage(message.chat.id, text, params);
    let me = await bot.getMe();

    let ban = await Ban.findOne({id: message.user.id});
    if (ban) return bot.answerCallbackQuery(query.id, "Забанен!!!");

    if (query.data.startsWith("yanebot")) {
        await bot.editMessageText("🤔 Ладно, поверю тебе", {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
        await User.findOneAndUpdate({id: message.chat.id}, { captcha: 1 });
    }
    if (query.data.startsWith("yabot")) {
        await bot.editMessageText("🤨 Иди своей дорогой, бот", {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
        await User.findOneAndUpdate({id: message.chat.id}, { captcha: 0 });
    }
    if(query.data.startsWith("popolnit")){
        //${message.user.ref ? settings.refovod_balance*100+" % от пополнения будет отправлено пригласившему вас в бота
        // " : ""}
        await bot.editMessageText(`▪️ Переведите нужную 👤 вам
💵 сумму на QIWI 👛 кошелёк‼️
→→→ \`+79276153863\` ←←←

▪️ При переводе обязательно
✏️ напишите комментарий‼️
→ → → \`tgpp${message.chat.id}\` ← ← ←

После перевода нажмите на кнопку ⬇️`,{
            chat_id: message.chat.id,
            message_id: message.message_id,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[
                    {text: 'Зачислить средства', callback_data: 'checkPayment'}
                ]]
            }
        });
    }
    if (query.data.startsWith("checkPayment")) {
        Wallet.getOperationHistory({rows: 50, operation: "IN"}, (err, operations) => {
            if(err){
                console.log(err);
                return;
            }
            let found = 0;
            operations.data.forEach((transaction)=>{
                if (transaction.comment === "tgpp"+message.chat.id){
                    found = 1;
                    let transactions = JSON.parse(fs.readFileSync(__dirname+"/transactions.json").toString());
                    if (!transactions.includes(transaction.trmTxnId)) {
                        // console.log(transaction.sum.amount);
                        // console.log(transaction);
                        transactions.push(transaction.trmTxnId);
                        fs.writeFileSync(__dirname+"/transactions.json", JSON.stringify(transactions));

                        User.findOne({id: message.chat.id}).then(async (user) => {
                            if (user.ref) {
                                User.findOne({id: user.ref}).then(async (refovod) => {
                                    await refovod.inc("balance", transaction.sum.amount * settings.refovod_balance);
                                    bot.sendMessage(refovod.id, `💳 Ваш баланс пополнен на ${(transaction.sum.amount * settings.refovod_balance).toFixed(2)} рублей за пополнение Вашего реферал`, {parse_mode: "HTML"}).catch();
                                });
                                await user.inc("balance", transaction.sum.amount*(1-settings.refovod_balance));
                                bot.editMessageText("💰 На ваш баланс зачислено "+transaction.sum.amount/**(1-settings.refovod_balance)*/+" RUB", {
                                    chat_id: message.chat.id,
                                    message_id: message.message_id
                                });
                            }else{
                                await user.inc("balance", transaction.sum.amount);
                                bot.editMessageText("💰 На ваш баланс зачислено "+transaction.sum.amount+" RUB", {
                                    chat_id: message.chat.id,
                                    message_id: message.message_id
                                });
                            }
                        });
                    }else{
                        bot.editMessageText("❌ Перевод уже обработан", {
                            chat_id: message.chat.id,
                            message_id: message.message_id
                        });
                    }
                }
            });
            if(!found){
                bot.editMessageText("❌ Перевод не найден. Повторите попытку позже", {
                    chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }
            // console.log(operations.data[operations.data.length-1].sum.amount);
            // console.log(operations.data[operations.data.length-1].comment);
        })
    }
    if (query.data.startsWith("subcheck-")) {
        let username = query.data.split("subcheck-")[1];
        let channel = await Channel.findOne({username: username});

        if (!channel) return;
        if (channel.completed.find((x) => x.id === message.user.id)) return;

        bot.getChatMember(`@${channel.username}`, message.user.id).then(async (res) => {
            if (res.status === "left") return bot.answerCallbackQuery(query.id, "Вы всё ещё не подписаны!");
            bot.editMessageText(messages.sub_end, {
                chat_id: message.chat.id,
                message_id: message.message_id
            });

            await message.user.inc("balance", settings.pps_user);

            if(message.user.ref){
                User.findOne({id: message.user.ref}).then(async (refovod) => {
                    await refovod.inc("balance", settings.refovod_podpiska);
                    if(message.user.refPayed === 2){
                        message.user.set("refPayed", 1);
                        await refovod.inc("balance", settings.ppr);
                        bot.sendMessage(refovod.id, `💳 Вам начислено ${settings.ppr*100} копеек за верификацию <a href=\"tg://user?id=${ref.id}\">реферала</a> на 1 уровне!`, {
                            parse_mode: "HTML"
                        });
                    }
                });
            }

            channel.completed.push({
                id: message.user.id,
                time: Date.now(),
                unfollow: false
            });

            await channel.save();

            if (channel.completed.length >= channel.count) {
                await bot.sendMessage(channel.owner, `✅ Поздравляем! Ваш заказ на продвижение канала @${channel.username} завершён!`);
                await channel.remove();
            }

            let ref1st = await User.findOne({ref: message.user.id});
            if (ref1st) {
                await ref1st.inc("balance", settings.pps * settings.ref1st);
            }
        }).catch(async (err) => {
            if (err.response.body.description === "Bad Request: CHAT_ADMIN_REQUIRED") {
                bot.editMessageText("Заказчик убрал администратора у бота. Попробуйте другой канал.", {
                    chat_id: message.chat.id,
                    message_id: message.message_id
                });

                bot.sendMessage(channel.owner, "Вы убрали администратора в канале у бота. Заказ удален.");
                await channel.remove();
            }
        });
    }

    if (query.data.startsWith("reftop")){
        let refs = [];
        let users = await User.find({ref: {$gt: 0}});//.where('ref').not.exec();

        users.forEach(function(user) {
            let found = false;
            refs.forEach(ref=>{
                if (ref.id === user.ref) {
                    found = true;
                }
            });
            if (!found) {
                refs.push({
                    id: user.ref,
                    refs: 0
                });
            }
            refs.forEach(ref=>{
                if (ref.id === user.ref) ref.refs++;
            });
        });
        refs = refs.sort(function (a, b) {
            return b.refs - a.refs
        });
        let text = "🔝 Топ рефоводов\n\n";
        refs.forEach(function(ref, i){
            let emodzi = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
            if(i < 10){
                text += `${emodzi[i]} ${ref.refs} человек - <a href="tg://user?id=${ref.id}">Пользователь</a>
`;
            }
        });


        bot.editMessageText(text, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            parse_mode: "HTML"
        });
    }

    if (query.data.startsWith("skipChannel")) {
        let username = query.data.split("skipChannel-");
        let channel = await Channel.findOne({username: username});

        if (!channel) return;
        channel.completed.push({id: message.user.id, time: Date.now(), unfollow: true});

        await channel.save();
        return bot.editMessageText(`Вы пропустили этот канал.`, {
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    }

    if (admins.indexOf(message.user.id) !== -1) {
        if (query.data.startsWith("sponsorGive")) {
            let id = Number(query.data.split("sponsorGive")[1]);
            let user = await User.findOne({id: id});

            await user.inc("balance", 2);
            bot.sendMessage(id, `✅ Вы выполнили спонсорское задание и получили 2 рубля на баланс.`);

            let completed = new Youtube({id: id});
            await completed.save();

            return bot.answerCallbackQuery(query.id, "Готово.");
        }

        if (query.data.startsWith("sponsorDeny")) {
            let id = Number(query.data.split("sponsorDeny")[1]);
            bot.sendMessage(id, `❌ Вы выполнили спонсорское задание неверно!`);

            return bot.answerCallbackQuery(query.id, "Готово.");
        }

        if (query.data.startsWith("withdraw")) {
            let id = Number(query.data.split("withdraw")[1]);
            let ticket = await Ticket.findOne({owner: id});

            if (!ticket) return bot.answerCallbackQuery(query.id, "Заявка не найдена.");

            //out = out + Math.floor(ticket.amount);//для обмана в всего выплачено поставить умножение
            require("fs").writeFileSync(__dirname+"/outMoney.json", out + Math.floor(ticket.amount));
            out += Math.floor(ticket.amount);
            await bot.sendMessage(ticket.owner, `✅ Ваша заявка на вывод средств обработана!

💸 ${ticket.amount} рублей выплачено на кошелёк ${ticket.wallet}!

Пожалуйста, отправьте отзыв (желательно со скриншотом) в наш 💬 Чат  https://t.me/TGPP_CHAT`).catch();
            await ticket.remove();
            await bot.sendMessage("@TGPP_INFO", `Выплачено ${ticket.amount} RUB <a href="tg://user?id=${ticket.owner}">Пользователю</a>!
#вывод`, {
                parse_mode: "HTML"
            } );
            bot.editMessageText("Деньги выплачены.", {
                chat_id: message.chat.id,
                message_id: message.message_id
            });

            return;
        }

        if (query.data.startsWith("declineback")) {
            let id = Number(query.data.split("declineback")[1]);
            let ticket = await Ticket.findOne({owner: id});

            if (!ticket) return bot.answerCallbackQuery(query.id, "Заявка не найдена.");

            await bot.sendMessage(ticket.owner, "Вам отклонили выплату и вернули деньги.");
            await User.findOne({id: id}).then(async (user) => await user.inc("balance", ticket.amount));

            await ticket.remove();
            await bot.answerCallbackQuery(query.id, "Вы отказали в выплате средств и вернули деньги на баланс.");
        }

        if (query.data.startsWith("decline")) {
            let id = Number(query.data.split("decline")[1]);
            let ticket = await Ticket.findOne({owner: id});

            if (!ticket) return bot.answerCallbackQuery(query.id, "Заявка не найдена.");

            await ticket.remove();
            await bot.answerCallbackQuery(query.id, "Вы отказали в выплате средств.");
        }

        if (query.data.startsWith("moderchannel_remove")) {
            let username = query.data.split("moderchannel_remove")[1];
            let channel = await Channel.findOne({username});

            if (!channel) return bot.sendMessage(message.chat.id, 'Ошибка.');

            bot.sendMessage(channel.owner, '🚫 Ваш заказ (Канал) был удалён за нарушение правил.');
            await channel.remove();

            return bot.editMessageText('🚫 Заказ удален!', {
                message_id: message.message_id,
                chat_id: message.chat.id
            });
        }

        if (query.data.startsWith("moderpost_remove")) {
            let post_id = query.data.split("moderpost_remove")[1];
            let post = await Post.findOne({post_id});

            if (!post) return bot.sendMessage(message.chat.id, 'Ошибка.');

            bot.sendMessage(post.owner, '🚫 Ваш заказ (Просмотры) был удалён за нарушение правил.');
            await post.remove();

            return bot.editMessageText('🚫 Заказ удален!', {
                message_id: message.message_id,
                chat_id: message.chat.id
            });
        }
    }

    if (query.data === "subscribe") {
        bot.deleteMessage(message.chat.id, message.message_id);

        let channels = await Channel.find();
        channels = channels.filter((x) => !x.completed.find((x) => x.id === message.chat.id));

        if (!channels[0]) return message.send(messages.sub_no);

        let channel = channels[Math.floor(Math.random() * channels.length)];
        return message.send(messages.sub_request, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{text: `➕ Перейти к выполнению`, url: `https://t.me/${channel.username}`}],
                    [{text: `✔️ Проверить подписку`, callback_data: `subcheck-${channel.username}`}],
                    [{text: "✖️ Пропустить", callback_data: `skipChannel-${channel.username}`}]
                ]
            }
        });
    }

    if (query.data === "watchpost") {
        bot.deleteMessage(message.chat.id, message.message_id);

        let posts = await Post.find();
        posts = posts.filter((x) => x.completed.indexOf(message.chat.id) === -1);

        if (!posts[0]) return message.send(messages.view_no);
        posts = [posts[0]];

        for (let i = 0; i < posts.length; i++) {
            setTimeout(async () => {
                message.send(messages.view_request, {
                    reply_markup: {
                        keyboard: [[]]
                    }
                });

                bot.forwardMessage(message.chat.id, posts[i].owner, posts[i].post_id);

                setTimeout(async () => {
                    message.send(messages.view_end, {
                        keyboard: $menu,
                        resize_keyboard: true
                    });

                    posts[i].completed.push(message.chat.id);
                    await posts[i].save();

                    if (posts[i].completed.length >= posts[i].count) {
                        await bot.sendMessage(posts[i].owner, '✅ Ваш заказ на продвижение поста успешно завершён!');
                        await posts[i].remove();
                    }

                    await message.user.inc("balance", settings.ppv_user);
                }, 2500);
            }, i * 3000);
        }
    }

    if (query.data === "referral") {
        bot.deleteMessage(message.chat.id, message.message_id);
        let yesterday = Date.now() - 86400000;
        let twodays = Date.now() - (86400000 * 2);

        let lvl1 = await User.countDocuments({ref: message.chat.id});
        let lvl1_today = await User.countDocuments({
            ref: message.chat.id,
            regDate: `${new Date().getDate()}.${new Date().getMonth() + 1}.${new Date().getFullYear()}`
        });
        let lvl1_yesterday = await User.countDocuments({
            ref: message.chat.id,
            regDate: `${new Date(yesterday).getDate()}.${new Date(yesterday).getMonth() + 1}.${new Date(yesterday).getFullYear()}`
        });
        let lvl1_twodays = await User.countDocuments({
            ref: message.chat.id,
            regDate: `${new Date(twodays).getDate()}.${new Date(twodays).getMonth() + 1}.${new Date(twodays).getFullYear()}`
        });

        return message.send(`👥 Партнёрская программа 👥

💸 Вознаграждение начисляется после получения рефералом первого бонуса

👤 Ваши приглашённые:

1 уровень - ${lvl1} партнёров - ${(lvl1 * settings.ppr).toFixed(1)}₽ заработано

🔗 Ваша партнёрская ссылка:
https://t.me/${me.username}?start=${message.chat.id}

🎁 Приглашайте партнёров и получайте:

${settings.ppr.toFixed(2)} ₽ за регистрацию
20% от заработка
10% от пополнений`, {
            parse_mode: "HTML"
        });
    }

    if (query.data === "bonus") {
        bot.editMessageText(`🚀 Бонусы закончились, но вы можете заработать на приглашении друзей от ${settings.ppr}₽ за одного человека!`, {
            reply_markup: {
                inline_keyboard: [[{text: '🚀 Пригласить друзей', callback_data: "referral"}]]
            },
            chat_id: message.chat.id,
            message_id: message.message_id
        });
    }

    if (query.data === "uwithdraw") {
        bot.deleteMessage(message.chat.id, message.message_id);
        if (message.user.balance < settings.min_withdraw) return message.send(`Минимальная сумма вывода: ${settings.min_withdraw}₽`, {
            reply_markup: {
                keyboard: keyboards.main,
                resize_keyboard: true
            }
        });

        message.send(`Введите номер кошелька QIWI.`, {
            reply_markup: {
                keyboard: keyboards.cancel,
                resize_keyboard: true
            }
        });

        await message.user.set("menu", "qiwi");
    }

    if (query.data === "orderSub") {
        bot.deleteMessage(message.chat.id, message.message_id);

        await message.user.set("menu", "forwardsub");
        return message.send(`📢 Наш бот предлагает Вам возможность накрутки подписчиков на Ваш канал

👤 1 подписчик - ${settings.pps}₽
💰 Ваш баланс - ${message.user.balance.toFixed(2)}₽
📊 Его хватит на ${(message.user.balance.toFixed(0)/settings.pps).toFixed(0)} подписчиков

<b>Просто перешлите любое сообщение из канала боту!</b>

❗️ Наш бот @TGPP_tgBOT должен быть администратором продвигаемого канала`, {
            parse_mode: "HTML",
            reply_markup: {
                keyboard: keyboards.cancel,
                resize_keyboard: true
            }
        });
    }

    if (query.data === "orderViews") {
        bot.deleteMessage(message.chat.id, message.message_id);

        await message.user.set("menu", "forwardpost");
        return message.send(`📢 Наш бот предлагает Вам возможность раскрутку Вашего поста

👤 1 просмотр - ${settings.ppv}₽
💰 Ваш баланс - ${message.user.balance.toFixed(2)}₽
📊 Его хватит на ${(message.user.balance.toFixed(0) / settings.ppv).toFixed(0)} посмотров

<b>Просто перешлите любое сообщение из канала боту!</b>
`, {
            parse_mode: "HTML",
            reply_markup: {
                keyboard: keyboards.cancel,
                resize_keyboard: true
            }
        });
    }

    if (query.data === "orderMailing") {
        bot.deleteMessage(message.chat.id, message.message_id);

        let users = await User.countDocuments();
        let cost = users * 0.01;

        return message.send(`💫 Вам нужна реклама от которой есть действительно отдача? Тогда заказывайте рассылку ✉️ на всех пользователей нашего 🤖 бота.

📈 Всего пользователей: <b>${users}</b>

💸 Цена рассылки: <b>${cost.toFixed(2)}</b>₽

<b>Заказать рассылку:</b> @${config.mainAdmin}`, {
            parse_mode: "HTML"
        });
    }

    if (query.data === "myOrders") {
        bot.deleteMessage(message.chat.id, message.message_id);

        let channels = await Channel.find({owner: message.chat.id});
        if (!channels[0]) return message.send(`У вас нет заказов! ❌`);

        let text = ``;

        channels.map((x) => {
            text += `📢 Канал: @${x.username}
✅ Выполнено: ${x.completed.length}/${x.count}\n\n`;
        });

        return message.send(`Ваши заказы:

${text}`);
    }

    if (query.data === "moreMoney") {
        bot.deleteMessage(message.chat.id, message.message_id);

        return message.send(`Вы можете заказать отображение своего текста в разделе 💰 Больше денег, ваш текст должен содержать как минимум 50 символов.

Цена размещения: <b>100₽</b>

Текст будет показан не менее <b>500</b> людям, и не более <b>5000</b> людей.

<b>Заказать размещение:</b> @${config.mainAdmin}`, {
            parse_mode: "HTML"
        });
    }
});

User.prototype.inc = function (field, value = 1) {
    this[field] += value;
    return this.save();
}

User.prototype.dec = function (field, value = 1) {
    this[field] -= value;
    return this.save();
}

User.prototype.set = function (field, value) {
    this[field] = value;
    return this.save();
}
