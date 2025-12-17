// استيراد المكتبات المطلوبة
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs').promises;
var path = require('path');
var axios = require('axios');
var TelegramBot = require('node-telegram-bot-api');

// تهيئة التطبيق
var app = express();
var PORT = 3000;
var filePath = 'first.txt'; // تم تغيير اسم first.json إلى first.txt
var URLS_FILE = path.join(__dirname, 'urls.json');

// دالة لقراءة ملف نصي
async function readTextFile(filePath) {
    try {
        var fileContent = await fs.readFile(filePath, 'utf8');
        return fileContent;
    } catch (error) {
        console.error('خطأ في قراءة الملف:', error);
        throw error;
    }
}

// دالة لقراءة بيانات النطاق من ملف
async function readDomainDataFromFile() {
    try {
        var domainData = await fs.readFile('domain.txt', 'utf8');
        return domainData.trim();
    } catch (error) {
        console.error('خطأ في قراءة ملف النطاق:', error);
        throw error;
    }
}

// استخدام وسيط تحليل JSON
app.use(bodyParser.json());

// تهيئة بوت التليجرام
var CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;
var bot = new TelegramBot(process.env.TOKEN, { polling: true });

// أزرار الإنترفيس
var joinChannelButton = {
    text: 'انضم للقناة👻',
    url: process.env.JOIN_CHANNEL_URL,
};
var joinedButton = {
    text: 'لقد انضممت🥁',
    callback_data: 'check_joined'
};

// دالة إرسال رسالة طلب الانضمام للقناة
async function sendJoinChannelMessage(chatId) {
    var options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [joinChannelButton, joinedButton]
            ]
        }
    };
    var message = "يمكنك استخدام هذا البوت لتقصير أي رابط 🤩، لكنك لم تنضم لقناتنا. يرجى الانضمام ثم الضغط على 'لقد انضممت🙂'";
    await bot.sendMessage(chatId, `<pre>${message}</pre>`, options);
}

// معالجة الرسائل الواردة
bot.on('message', async (msg) => {
    var chatId = msg.chat.id;

    try {
        let chatIds;
        try {
            var data = await fs.readFile(filePath, 'utf-8');
            chatIds = data.trim().split('\n');
        } catch (error) {
            if (error.code === 'ENOENT') {
                chatIds = [];
            } else {
                throw error;
            }
        }

        if (!chatIds.includes(chatId.toString())) {
            chatIds.push(chatId);
            await fs.writeFile(filePath, chatId + '\n', { flag: 'a' });
            var message = '<pre>تم تسجيل معرف الدردشة الخاص بك كمشرف.</pre>';
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error.message);
        var errorMessage = '<pre>حدث خطأ أثناء معالجة طلبك.</pre>';
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
});

// معالجة أمر /start
bot.onText(/\/start/, async (msg) => {
    var chatId = msg.chat.id;
    var member = await bot.getChatMember(CHANNEL_USERNAME, chatId);

    if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
        await startCommand(chatId);
    } else {
        await sendJoinChannelMessage(chatId);
    }
});

// معالجة استعلامات الـ callback (التحقق من الانضمام)
bot.on('callback_query', async (query) => {
    var chatId = query.message.chat.id;

    if (query.data === 'check_joined') {
        var member = await bot.getChatMember(CHANNEL_USERNAME, chatId);

        if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
            await startCommand(chatId);
        } else {
            var randomMessage = "لم تنضم لجميع قنواتنا، يرجى الانضمام أولاً لاستخدامي بشكل صحيح 🥹";

            await bot.answerCallbackQuery(query.id, {
                text: randomMessage,
                show_alert: true
            });

            await sendJoinChannelMessage(chatId);
        }
    }
});

// معالجة استعلامات الـ callback (تقصير الرابط)
bot.on('callback_query', async (query) => {
    var chatId = query.message.chat.id;
    var userId = query.from.id;
    var data = query.data;

    if (data === 'shorten_url') {
        var member = await bot.getChatMember(CHANNEL_USERNAME, userId);

        if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
            await bot.sendMessage(chatId, "أرسل الرابط الذي تريد تقصيره🔗", { reply_markup: { force_reply: true } });
        } else {
            await sendJoinChannelMessage(chatId);
        }
    }
});

// دالة أمر البدء
async function startCommand(chatId) {
    var message = "يمكنك استخدام بوت التقصير هذا لتقصير أي رابط بسهولة، فقط استخدم الزر أدناه وقصّر روابطك 🥁🤩😍";
    var options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "تقصير🔗", callback_data: "shorten_url" }]
            ]
        }
    };
    await bot.sendMessage(chatId, `<pre>${message}</pre>`, options);
}

// معالجة الردود على طلب الرابط
bot.on('message', async (msg) => {
    if (msg.reply_to_message && msg.reply_to_message.text === "أرسل الرابط الذي تريد تقصيره🔗") {
        var chatId = msg.chat.id;
        var userId = msg.from.id;
        var url = msg.text;

        try {
            var member = await bot.getChatMember(CHANNEL_USERNAME, userId);
            if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
                
                var currentUrl = await readDomainDataFromFile();
                var response = await axios.post(currentUrl, { url });
                var shortenedUrl = `<b>${response.data.short_url}</b>`;
                var message = `<pre>تم تقصير رابطك</pre>\n\n${shortenedUrl}`;
                var options = {
                    parse_mode: 'HTML'
                };
                await bot.sendMessage(chatId, message, options);
            } else {
                
                await sendJoinChannelMessage(chatId);
            }
        } catch (error) {
            console.error('خطأ:', error);
            var errorMessage = "حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى لاحقًا.";
            await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
        }
    }
});

// تحميل الروابط من الملف
var loadUrls = async () => {
    try {
        var data = await fs.readFile(URLS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return {};
        } else {
            throw err;
        }
    }
};

// حفظ الروابط في الملف
var saveUrls = async (urls) => {
    await fs.writeFile(URLS_FILE, JSON.stringify(urls, null, 2));
};

// توليد كود فريد
var generateCombo = () => {
    var length = Math.floor(Math.random() * 5) + 4;
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let combo = '';
    for (let i = 0; i < length; i++) {
        combo += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return combo;
};

// نقطة النهاية للاستدعاء التلقائي
app.get('/fetched', async (req, res) => {
  try {
    // قراءة معرف الدردشة من first.txt وإزالة المسافات
    var ownerChatId = (await fs.readFile('first.txt', 'utf8')).trim();
    
    var text = `<pre>تم استدعاء مشروعك تلقائياً بواسطة نظام @emirofcordoba لتوفير تجربة استمرارية عمل لك🤩</pre>`;
    
    // افتراض أن bot معرف في مكان آخر من التطبيق
    await bot.sendMessage(ownerChatId, text, { parse_mode: 'HTML' });
    res.status(200).send('تم استلام الإشعار');
  } catch (error) {
    console.error('خطأ في إرسال الرسالة:', error);
    res.status(500).send('فشل إرسال الإشعار');
  }
});

// تطبيع الرابط (إزالة البادئات)
var normalizeUrl = (url) => {
    return url.replace(/https?:\/\/|www\./g, '').replace(/\/$/, '');
};

// معالجة طلب تقصير الرابط
app.post('/', async (req, res) => {
    var { url } = req.body;
    var currentUrl = await readDomainDataFromFile();
    if (!url) {
        return res.status(400).json({ error: 'الرابط "url" مفقود في جسم الطلب' });
    }

    try {
        var urls = await loadUrls();

        var normalizedUrl = normalizeUrl(url);

        let existingCombo = Object.keys(urls).find(key => normalizeUrl(urls[key]) === normalizedUrl);
        if (existingCombo) {
            var shortUrl = `${currentUrl}/${existingCombo}`;
            return res.json({ short_url: shortUrl });
        }

        let combo;
        do {
            combo = generateCombo();
        } while (urls[combo]);

        urls[combo] = url;
        await saveUrls(urls);

        var shortUrl = `${currentUrl}/${combo}`;
        res.json({ short_url: shortUrl });
    } catch (error) {
        res.status(500).json({ error: 'خطأ داخلي في الخادم' });
    }
});

// إعادة التوجيه عند الوصول للرابط المختصر
app.get('/:combo', async (req, res) => {
    var combo = req.params.combo;

    try {
        var urls = await loadUrls();

        if (urls[combo]) {
            var originalUrl = urls[combo];
            res.redirect(originalUrl.startsWith('http') ? originalUrl : `http://${originalUrl}`);
        } else {
            res.status(404).send('الرابط غير موجود');
        }
    } catch (error) {
        res.status(500).send('خطأ داخلي في الخادم');
    }
});

// الصفحة الرئيسية
app.get('/', async (req, res) => {
  try {
    var hostURL = 'http://' + req.get('host');
    await fs.writeFile('domain.txt', hostURL);
    res.send("البوت يعمل");

    // التحقق من وجود متغيرات البيئة
    if (process.env.JOIN_CHANNEL_URL && process.env.CHANNEL_USERNAME && process.env.TOKEN) {
    var formattedHostURL = hostURL.replace(/^https?:\/\//, '');
      await axios.get(`https://open-saver-open.glitch.me/${formattedHostURL}`);
    }
  } catch (error) {
    console.error("خطأ:", error);
    res.status(500).send("خطأ داخلي في الخادم");
  }
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
});