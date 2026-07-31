const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    Events 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages // تفعيل استقبال رسائل الخاص
    ],
    partials: [Partials.Channel, Partials.Message] // لضمان استجابة الخاص
});

// ==================== الإعدادات الأساسية ====================
const TOKEN = 'YOUR_BOT_TOKEN_HERE'; // ضع توكن البوت هنا
const ADMIN_CHANNEL_ID = 'YOUR_ADMIN_CHANNEL_ID_HERE'; // ايدي روم التقديمات للإدارة
// ==========================================================

// قائمة الأسئلة بالترتيب
const QUESTIONS = [
    "1️⃣ كم عمرك؟ وما هي اللغة/اللغات التي تجيدها بالتواصل؟",
    "2️⃣ هل عندك خبرة سابقة في إدارة سيرفرات ديسكورد؟ (يرجى ذكر اسم السيرفرات أو طبيعة المهام اللي قمت بيها).",
    "3️⃣ كم عدد الساعات التي يمكنك تواجدها وتفقد السيرفر فيها يومياً؟ وفي أي أوقات تكون متواجد؟",
    "4️⃣ لو حصلت مشكلة أو مشادة بين أعضاء في شات عام، أو شفت شخص بيخالف القوانين.. إيه أول خطوة هتعملها؟",
    "5️⃣ ليه حابب تنضم لفريق إدارة سيرفرنا بالذات؟ وإيه الإضافة أو الأفكار الترفيهية اللي تقدر تقدمها للسيرفر؟"
];

// لتخزين مراحل وإجابات التقديم لكل عضو
const activeApplications = new Map();

client.once(Events.ClientReady, c => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${c.user.tag}`);
});

// أمر إنشاء زر التقديم في السيرفر (!setup)
client.on(Events.MessageCreate, async message => {
    if (!message.guild) return;

    if (message.content === '!setup' && message.member.permissions.has('Administrator')) {
        const embed = new EmbedBuilder()
            .setTitle('👑 التقديم على إدارة السيرفر')
            .setDescription('إذا كنت ترغب في الانضمام لفريق الإدارة والتطوير معنا، يرجى الضغط على الزر أسفله.\n\n✨ **ملاحظة:** سيرسل لك البوت الأسئلة في الخاص سؤالاً تلو الآخر!')
            .setColor('#5865F2')
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'تأكد من فتح الرسائل الخاصة (DMs) لاستقبال الأسئلة 📩' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('start_apply_dm')
                    .setLabel('تقديم للإدارة')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝')
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }
});

// التعامل مع أزرار التقديم والقبول والرفض
client.on(Events.InteractionCreate, async interaction => {
    
    // 1. عند ضغط العضو على زر التقديم في السيرفر
    if (interaction.isButton() && interaction.customId === 'start_apply_dm') {
        if (activeApplications.has(interaction.user.id)) {
            return interaction.reply({ 
                content: '⚠️ لديك تقديم جارٍ بالفعل في الخاص! يرجى الإجابة على السؤال الحالي هناك.', 
                ephemeral: true 
            });
        }

        try {
            const dmChannel = await interaction.user.createDM();
            
            // بداية التقديم وإرسال السؤال الأول
            const dmEmbed = new EmbedBuilder()
                .setTitle('✨ أهلاً بك في استمارة التقديم للإدارة')
                .setDescription(`سنقوم بطرح **5 أسئلة** عليك. أجب على كل سؤال برسالة واحدة منفصلة.\n\n📌 **السؤال الأول:**\n${QUESTIONS[0]}`)
                .setColor('#FEE75C')
                .setTimestamp();

            await dmChannel.send({ embeds: [dmEmbed] });

            // حفظ بيانات الجلسة الحالية للعضو
            activeApplications.set(interaction.user.id, {
                step: 0,
                answers: [],
                guildId: interaction.guild.id
            });

            await interaction.reply({ 
                content: '✅ تم إرسال السؤال الأول لك في الخاص! اذهب لرسائل الخاص للبدء 📥', 
                ephemeral: true 
            });

        } catch (error) {
            await interaction.reply({ 
                content: '❌ لم أستطع إرسال الأسئلة في الخاص! يرجى التأكد من **فتح الرسائل الخاصة (Direct Messages)** في إعدادات خصوصية السيرفر.', 
                ephemeral: true 
            });
        }
    }

    // 2. عند الضغط على أزرار القبول أو الرفض من الإدارة
    if (interaction.isButton() && (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('reject_'))) {
        const isAccept = interaction.customId.startsWith('accept_');
        const userId = interaction.customId.split('_')[1];

        const guild = interaction.guild;
        const applicant = await guild.members.fetch(userId).catch(() => null);

        const statusText = isAccept ? '✅ تم القبول' : '❌ تم الرفض';
        const color = isAccept ? '#57F287' : '#ED4245';

        // تعديل الرسالة في روم الإدارة
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(color)
            .setTitle(`📩 طلب تقديم إدارة (${statusText})`)
            .setFooter({ text: `تم اتخاذ القرار بواسطة الإداري: ${interaction.user.tag}` });

        await interaction.update({ embeds: [updatedEmbed], components: [] });

        // إرسال نتيجة التقديم للعضو في الخاص
        if (applicant) {
            const resultEmbed = new EmbedBuilder()
                .setTitle(isAccept ? '🎉 مبروك! تم قبول طلبك' : '❌ نتيجة تقديم الإدارة')
                .setDescription(
                    isAccept 
                        ? `تهانينا! تم قبول طلب انضمامك لفريق إدارة **${guild.name}**.\n\n🏷️ **سيتم وضع شارة/رتبة الإدارة لك في أقرب وقت.**\nسيتم التواصل معك قريباً لشرح باقي التفاصيل.`
                        : `للأسف، تم رفض طلب تقديمك للانضمام لإدارة **${guild.name}** في الوقت الحالي.\nنتمنى لك التوفيق في المرات القادمة!`
                )
                .setColor(color)
                .setTimestamp();

            await applicant.send({ embeds: [resultEmbed] }).catch(() => {});
        }
    }
});

// 3. استقبال الإجابات خطوة بخطوة في الخاص
client.on(Events.MessageCreate, async message => {
    // التأكد من أن الرسالة في الخاص وليست من بوت
    if (message.guild || message.author.bot) return;

    const appData = activeApplications.get(message.author.id);
    if (!appData) return; // إذا لم يكن في جلسة تقديم جارية

    // حفظ الإجابة الحالية والانتقال للخطوة التالية
    appData.answers.push(message.content);
    appData.step++;

    // إذا كان هناك أسئلة متبقية
    if (appData.step < QUESTIONS.length) {
        const nextQuestionEmbed = new EmbedBuilder()
            .setTitle(`📌 السؤال (${appData.step + 1}/${QUESTIONS.length})`)
            .setDescription(QUESTIONS[appData.step])
            .setColor('#3498DB');

        await message.channel.send({ embeds: [nextQuestionEmbed] });
    } else {
        // انتهت الأسئلة -> إرسال التقديم لروم الإدارة
        const guild = client.guilds.cache.get(appData.guildId);
        const adminChannel = guild?.channels.cache.get(ADMIN_CHANNEL_ID);

        if (adminChannel) {
            const appEmbed = new EmbedBuilder()
                .setTitle('📩 طلب تقديم إدارة جديد')
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setColor('#FEE75C')
                .addFields(
                    { name: '👤 المتقدم:', value: `${message.author} (${message.author.tag})`, inline: false },
                    { name: QUESTIONS[0], value: appData.answers[0] },
                    { name: QUESTIONS[1], value: appData.answers[1] },
                    { name: QUESTIONS[2], value: appData.answers[2] },
                    { name: QUESTIONS[3], value: appData.answers[3] },
                    { name: QUESTIONS[4], value: appData.answers[4] }
                )
                .setTimestamp();

            const reviewRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_${message.author.id}`)
                        .setLabel('قبول')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_${message.author.id}`)
                        .setLabel('رفض')
                        .setStyle(ButtonStyle.Danger)
                );

            await adminChannel.send({ embeds: [appEmbed], components: [reviewRow] });

            // إرسال تأكيد الانتهاء في الخاص
            const doneEmbed = new EmbedBuilder()
                .setTitle('🎉 تم إكمال التقديم بنجاح!')
                .setDescription('شكراً لك، تم إرسال كافة إجاباتك للإدارة.\nستتلقى النتيجة (قبول أو رفض) هنا في الخاص فور مراجعتها من قِبَل الأونر والإدارة.')
                .setColor('#57F287')
                .setTimestamp();

            await message.channel.send({ embeds: [doneEmbed] });
        } else {
            await message.channel.send('❌ حدث خطأ في إرسال طلبك للإدارة، يرجى التواصل مع المسؤولين.');
        }

        // مسح العضو من القائمة النشطة
        activeApplications.delete(message.author.id);
    }
});

client.login(TOKEN);
