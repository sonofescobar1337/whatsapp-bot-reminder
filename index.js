const { Client, LocalAuth } = require('whatsapp-web.js');
const schedule = require('node-schedule');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Initialize WhatsApp Client
const client = new Client({
    puppeteer: { args: ['--no-sandbox'] },
    authStrategy: new LocalAuth(),
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
    const { chatId, date, task, priority, taskId } = reminder;

    schedule.scheduleJob(date, () => {
        client.sendMessage(
            chatId,
            `⏰ Reminder! Task: *${task}*\nPriority: *${priority.toUpperCase()}*\nTask ID: *${taskId}*`
        );
    });
};

// Reschedule reminders on startup
reminders.forEach(scheduleReminder);

// WhatsApp Events
client.on('qr', (qr) => {
    console.log('Scan your QR Code for login');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp bot is ready!');
});

client.on('message', async (message) => {
    // Handle /remind command
    if (message.body.startsWith('/remind')) {
        try {
            const args = message.body.replace('/remind ', '').split('|');
            if (args.length !== 4) {
                message.reply(
                    'Format salah! Gunakan: /remind <date>|<time>|<task>|<priority>\n' +
                    'Contoh: /remind 2024-12-10|14:00|Kerjakan tugas|high'
                );
                return;
            }

            const [dateStr, timeStr, task, priority] = args;
            if (!['low', 'medium', 'high'].includes(priority.toLowerCase())) {
                message.reply('Priority harus salah satu dari: low, medium, high.');
                return;
            }

            const date = new Date(`${dateStr}T${timeStr}:00`);
            if (isNaN(date.getTime())) {
                message.reply('Format tanggal/waktu salah! Gunakan format: YYYY-MM-DD|HH:mm.');
                return;
            }

            // Create reminder
            const reminder = {
                taskId: uuidv4(),
                chatId: message.from,
                date,
                task,
                priority: priority.toLowerCase(),
            };

            reminders.push(reminder);
            saveReminders();
            scheduleReminder(reminder);

            message.reply(`Reminder disimpan! ⏰\nTask: *${task}*\nPriority: *${priority.toUpperCase()}*\nWaktu: ${date}\nTask ID: *${reminder.taskId}*`);
        } catch (err) {
            console.error(err);
            message.reply('Terjadi kesalahan saat menyimpan pengingat.');
        }
    }

    // Handle /list command
    else if (message.body === '/list') {
        if (reminders.length === 0) {
            message.reply('Task List kosong.');
            return;
        }

        const taskList = reminders
            .map(
                (r, index) =>
                    `${index + 1}. [${r.taskId}] ⏰ ${r.date} - Task: *${r.task}* (Priority: *${r.priority.toUpperCase()}*)`
            )
            .join('\n');

        message.reply(`Task List:\n${taskList}`);
    }

    // Handle /done <taskid> command
    else if (message.body.startsWith('/done')) {
        const taskId = message.body.replace('/done ', '').trim();

        const taskIndex = reminders.findIndex((r) => r.taskId === taskId);
        if (taskIndex === -1) {
            message.reply('Task ID tidak ditemukan.');
            return;
        }

        reminders.splice(taskIndex, 1);
        saveReminders();

        message.reply(`Task dengan ID *${taskId}* telah ditandai selesai dan dihapus dari daftar.`);
    }
});

// Start the bot
client.initialize();
