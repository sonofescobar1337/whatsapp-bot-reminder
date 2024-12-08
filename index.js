const { Client, LocalAuth } = require('whatsapp-web.js');
const schedule = require('node-schedule');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client({
    puppeteer: {
        args: ['--no-sandbox'],
    },
    authStrategy: new LocalAuth()
});

// Load reminders
let reminders = [];
const remindersFile = './reminders.json';

if (fs.existsSync(remindersFile)) {
    reminders = JSON.parse(fs.readFileSync(remindersFile, 'utf8'));
}

// Save reminders to file
const saveReminders = () => {
    fs.writeFileSync(remindersFile, JSON.stringify(reminders, null, 2));
};

// Function to schedule a reminder
const scheduleReminder = (reminder) => {
    const { chatId, date, task, priority } = reminder;

    schedule.scheduleJob(date, () => {
        client.sendMessage(
            chatId,
            `⏰ Reminder! Task: *${task}*\nPriority: *${priority.toUpperCase()}*`
        );
    });
};

// Reschedule reminders on startup
reminders.forEach(scheduleReminder);

// WhatsApp Events
client.on('qr', (qr) => {
    console.log("Scan your QR Code for login")
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp bot is ready!');
});

client.on('message', async (message) => {
    if (message.body.startsWith('/remind')) {
        try {
            // Parse command
            const args = message.body.split(' ');
            if (args.length < 5) {
                message.reply(
                    'Format salah! Gunakan: /remind <date> <hours> <task> <priority>\n' +
                    'Contoh: /remind 2024-12-10 14:00 Kerjakan tugas high'
                );
                return;
            }

            const dateStr = args[1];
            const timeStr = args[2];
            const task = args.slice(3, -1).join(' ');
            const priority = args[args.length - 1].toLowerCase();

            if (!['low', 'medium', 'high'].includes(priority)) {
                message.reply('Priority harus salah satu dari: low, medium, high.');
                return;
            }

            const date = new Date(`${dateStr}T${timeStr}:00`);
            if (isNaN(date.getTime())) {
                message.reply('Format tanggal/waktu salah! Gunakan format: YYYY-MM-DD HH:mm.');
                return;
            }

            // Create reminder
            const reminder = {
                chatId: message.from,
                date,
                task,
                priority,
            };

            reminders.push(reminder);
            saveReminders();
            scheduleReminder(reminder);

            message.reply(`Reminder disimpan! ⏰\nTask: *${task}*\nPriority: *${priority.toUpperCase()}*\nWaktu: ${date}`);
        } catch (err) {
            console.error(err);
            message.reply('Terjadi kesalahan saat menyimpan pengingat.');
        }
    }
});

// Start the bot
client.initialize();
