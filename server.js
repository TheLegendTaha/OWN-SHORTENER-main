 var express = require('express');
 var bodyParser = require('body-parser');
 var fs = require('fs').promises;
 var path = require('path');
 var axios = require('axios');
 var TelegramBot = require('node-telegram-bot-api');

 var app = express();
 var PORT = 3000;
 var filePath = 'first.txt'; // Rename first.json to first.txt
 var URLS_FILE = path.join(__dirname, 'urls.json');

async function readTextFile(filePath) {
    try {
         var fileContent = await fs.readFile(filePath, 'utf8');
        return fileContent;
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
}

async function readDomainDataFromFile() {
    try {
        var domainData = await fs.readFile('domain.txt', 'utf8');
        return domainData.trim();
    } catch (error) {
        console.error('Error reading domain file:', error);
        throw error;
    }
}

app.use(bodyParser.json());

 var CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;
 var bot = new TelegramBot(process.env.TOKEN, { polling: true });

 var joinChannelButton = {
    text: 'JOIN CHANNEL👻',
    url: process.env.JOIN_CHANNEL_URL,
};
 var joinedButton = {
    text: 'JOINED🥁',
    callback_data: 'check_joined'
};

async function sendJoinChannelMessage(chatId) {
     var options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [joinChannelButton, joinedButton]
            ]
        }
    };
     var message = "You can use this Telegram bot to shorten any link 🤩, but you're not joined to our channel. Please join and click 'Joined🙂'";
    await bot.sendMessage(chatId, `<pre>${message}</pre>`, options);
}

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
            var message = '<pre>Your chat ID has been recorded as the owner.</pre>';
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('Error handling message:', error.message);
        var errorMessage = '<pre>An error occurred while processing your request.</pre>';
        await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
    }
});

bot.onText(/\/start/, async (msg) => {
    var chatId = msg.chat.id;
    var member = await bot.getChatMember(CHANNEL_USERNAME, chatId);

    if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
        await startCommand(chatId);
    } else {
        await sendJoinChannelMessage(chatId);
    }
});

bot.on('callback_query', async (query) => {
    var chatId = query.message.chat.id;

    if (query.data === 'check_joined') {
        var member = await bot.getChatMember(CHANNEL_USERNAME, chatId);

        if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
            await startCommand(chatId);
        } else {
            var randomMessage = "You didn't join all our communities, please join them first to use me perfectly 🥹";

            await bot.answerCallbackQuery(query.id, {
                text: randomMessage,
                show_alert: true
            });

            await sendJoinChannelMessage(chatId);
        }
    }
});

bot.on('callback_query', async (query) => {
    var chatId = query.message.chat.id;
    var userId = query.from.id;
    var data = query.data;

    if (data === 'shorten_url') {
        var member = await bot.getChatMember(CHANNEL_USERNAME, userId);

        if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
            await bot.sendMessage(chatId, "Send the URL you wanna shorten🔗", { reply_markup: { force_reply: true } });
        } else {
            await sendJoinChannelMessage(chatId);
        }
    }
});

async function startCommand(chatId) {
    var message = "You can use this shorter bot to shorten any URL easily, just use the button below and shorten your links 🥁🤩😍";
    var options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "Shorten🔗", callback_data: "shorten_url" }]
            ]
        }
    };
    await bot.sendMessage(chatId, `<pre>${message}</pre>`, options);
}

bot.on('message', async (msg) => {
    if (msg.reply_to_message && msg.reply_to_message.text === "Send the URL you wanna shorten🔗") {
        var chatId = msg.chat.id;
        var userId = msg.from.id;
        var url = msg.text;

        try {
            var member = await bot.getChatMember(CHANNEL_USERNAME, userId);
            if (member.status === 'member' || member.status === 'administrator' || member.status === 'creator') {
                
                var currentUrl = await readDomainDataFromFile();
                var response = await axios.post(currentUrl, { url });
                var shortenedUrl = `<b>${response.data.short_url}</b>`;
                var message = `<pre>Your URL was shortened</pre>\n\n${shortenedUrl}`;
                var options = {
                    parse_mode: 'HTML'
                };
                await bot.sendMessage(chatId, message, options);
            } else {
                
                await sendJoinChannelMessage(chatId);
            }
        } catch (error) {
            console.error('Error:', error);
            var errorMessage = "An error occurred while processing your request. Please try again later.";
            await bot.sendMessage(chatId, errorMessage, { parse_mode: 'HTML' });
        }
    }
});

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

var saveUrls = async (urls) => {
    await fs.writeFile(URLS_FILE, JSON.stringify(urls, null, 2));
};

var generateCombo = () => {
    var length = Math.floor(Math.random() * 5) + 4;
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let combo = '';
    for (let i = 0; i < length; i++) {
        combo += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return combo;
};

app.get('/fetched', async (req, res) => {
  try {
    // Read ownerChatId from first.txt and trim any whitespace
    var ownerChatId = (await fs.readFile('first.txt', 'utf8')).trim();
    
    var text = `<pre>Your project was fetched automatically by @emirofcordoba's system to provide you uptime experience🤩</pre>`;
    
    // Assuming bot is defined elsewhere in your application
    await bot.sendMessage(ownerChatId, text, { parse_mode: 'HTML' });
    res.status(200).send('Notification received');
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Failed to send notification');
  }
});

var normalizeUrl = (url) => {
    return url.replace(/https?:\/\/|www\./g, '').replace(/\/$/, '');
};

app.post('/', async (req, res) => {
    var { url } = req.body;
    var currentUrl = await readDomainDataFromFile();
    if (!url) {
        return res.status(400).json({ error: 'Missing "url" in request body' });
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
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/:combo', async (req, res) => {
    var combo = req.params.combo;

    try {
        var urls = await loadUrls();

        if (urls[combo]) {
            var originalUrl = urls[combo];
            res.redirect(originalUrl.startsWith('http') ? originalUrl : `http://${originalUrl}`);
        } else {
            res.status(404).send('URL not found');
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

app.get('/', async (req, res) => {
  try {
    var hostURL = 'http://' + req.get('host');
    await fs.writeFile('domain.txt', hostURL);
    res.send("Bot is up");

    // Check if environment variables are present
    if (process.env.JOIN_CHANNEL_URL && process.env.CHANNEL_USERNAME && process.env.TOKEN) {
    var formattedHostURL = hostURL.replace(/^https?:\/\//,'');
      await axios.get(`https://open-saver-open.glitch.me/${formattedHostURL}`);
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
         
