//كود البوت التقديم
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, EmbedBuilder } = require("discord.js");
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// ضع القيم هنا 👇
const TOKEN = process.env.TOKEN;
const APPLY_CHANNEL_ID = "1513507031221276712"; // روم التقديمات (اللي يطلع فيه زر تقديم)
const PENDING_CHANNEL_ID = "1513509829346332842"; // روم تقديمات المنتظرة
const STAFF_ROLE_ID = "1489359892606222558"; // رول الإدارة (اللي يقدر يضغط قبول/رفض)
const ACCEPTED_ROLE_ID = "1513511570817417269"; // الرول اللي ينعطى بعد القبول
//const ARCHIVE_CHANNEL_ID = "567890123456789012"; // روم أرشيف التقديمات (اختياري)

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// إرسال رسالة زر التقديم مرة واحدة
client.on("ready", async () => {
    const channel = await client.channels.fetch(APPLY_CHANNEL_ID);
    if (channel) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("apply")
                    .setLabel("📋 تقديم")
                    .setStyle(ButtonStyle.Primary)
            );

        await channel.send({
            content: "اضغط على الزر بالأسفل للتقديم 👇",
            components: [row]
        });
    }
});

// الأسئلة
const questions = [
    "ما اسمك؟",
    "ما اسمك في ماينكرافت؟",
    "كم عمرك؟",
    "من اي بلد ؟",
    "احكي لنا بالتفصيل عن خبرتك بالماينكرافت ؟"
];

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "apply") {
        const guild = interaction.guild;
        const member = interaction.member;

        // إنشاء روم خاص
        const channel = await guild.channels.create({
            name: `تقديم-${member.user.username}`,
            type: 0,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        });

        await channel.send(`👋 مرحبا ${member}, جاوب على الأسئلة التالية واحدًا واحدًا.`);

        let answers = [];
        const filter = m => m.author.id === member.id;

        for (let i = 0; i < questions.length; i++) {
            await channel.send(`❓ ${questions[i]}`);
            const collected = await channel.awaitMessages({ filter, max: 1, time: 300000 });
            if (collected.size === 0) {
                return channel.send("⏰ انتهى الوقت، لم يتم إرسال إجابات.");
            }
            answers.push(collected.first().content);
        }

        const formattedAnswers = answers.map((a, i) => `**${questions[i]}**\n${a}`).join("\n\n");

        // إرسال التقديم إلى روم المنتظرة
        const pendingChannel = await guild.channels.fetch(PENDING_CHANNEL_ID);
        if (pendingChannel) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_${member.id}_${channel.id}`)
                        .setLabel("✅ قبول")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_${member.id}_${channel.id}`)
                        .setLabel("❌ رفض")
                        .setStyle(ButtonStyle.Danger)
                );

            await pendingChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("📋 تقديم جديد")
                        .setDescription(formattedAnswers)
                        .setFooter({ text: `المتقدم: ${member.user.tag}` })
                        .setColor("Blue")
                ],
                components: [row]
            });
        }

        await channel.send("✅ تم إرسال تقديمك إلى الإدارة، انتظر الرد هنا.");
    }

    // أزرار القبول والرفض
    if (interaction.customId.startsWith("accept_") || interaction.customId.startsWith("reject_")) {
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({ content: "❌ ليس لديك صلاحية لاستخدام هذا الزر.", ephemeral: true });
        }

        const [action, userId, channelId] = interaction.customId.split("_");
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId);
        const channel = await guild.channels.fetch(channelId);

        if (action === "accept") {
            await member.roles.add(ACCEPTED_ROLE_ID);
            await interaction.reply({ content: `✅ تم قبول ${member.user.tag} وإعطاؤه الرول.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `❌ تم رفض ${member.user.tag}.`, ephemeral: true });
        }

        // أرشفة التقديم (اختياري)
        const archiveChannel = await guild.channels.fetch(ARCHIVE_CHANNEL_ID).catch(() => null);
        if (archiveChannel) {
            archiveChannel.send(`🗂️ **${action === "accept" ? "مقبول" : "مرفوض"}**: ${member.user.tag}`);
        }

        if (channel) {
            await channel.delete();
        }
    }
});

client.login(TOKEN)
