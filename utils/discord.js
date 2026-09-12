import axios from 'axios';

export const sendWarningNotification = async (warning) => {
  try {
    if (!process.env.DISCORD_WEBHOOK_WARNS) {
      console.log('მიმართე პანდას, კონფიგურირებული არარი ბოტითქო');
      return;
    }

    const embed = {
      title: '⚠️ ადმინისტრაციული გაფრთხილება',
      color: warning.type === 'მსუბუქი გაფრთხილება' ? 0xFF4444 : 0xFFAA44,
      fields: [
        {
          name: 'ადმინისტრატორი',
          value: warning.targetUsername,
          inline: true
        },
        {
          name: 'გაფრთხილების ტიპი',
          value: warning.type,
          inline: true
        },
        {
          name: 'მიზეზი',
          value: warning.reason,
          inline: false
        },
        {
          name: 'პასუხისმგებელი ადმინი',
          value: warning.issuedByUsername,
          inline: true
        },
        {
          name: 'დაწერა',
          value: new Date(warning.issuedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          inline: true
        },
        {
          name: 'გაფრთხილება იწურება',
          value: new Date(warning.expiresAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          inline: true
        },
        {
          name: 'გაფრთხილების ID',
          value: warning._id.toString(),
          inline: false
        }
      ],
      timestamp: new Date(),
      footer: {
        text: 'LandsCraft Admin Warns by Panda'
      }
    };

    await axios.post(process.env.DISCORD_WEBHOOK_WARNS, {
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error sending warning notification to Discord:', error.message);
  }
};

export const sendBlacklistNotification = async (blacklist, action) => {
  try {
    if (!process.env.DISCORD_WEBHOOK_BLACKLIST) {
      console.log('Discord webhook for blacklist not configured');
      return;
    }

    const titleMap = {
      added: '🚫 BLACKLIST ENTRY ADDED',
      edited: '🔄 BLACKLIST ENTRY EDITED',
      removed: '✅ BLACKLIST ENTRY REMOVED'
    };

    const colorMap = {
      added: 0xFF4444,
      edited: 0xFFAA44,
      removed: 0x44AA44
    };

    const embed = {
      title: titleMap[action] || 'BLACKLIST ACTION',
      color: colorMap[action] || 0x444444,
      fields: [
        {
          name: 'Username',
          value: blacklist.username,
          inline: true
        },
        {
          name: 'Action',
          value: action.charAt(0).toUpperCase() + action.slice(1),
          inline: true
        },
        {
          name: 'Reason',
          value: blacklist.reason,
          inline: false
        },
        {
          name: 'Added By',
          value: blacklist.addedByUsername,
          inline: true
        },
        {
          name: 'Added',
          value: new Date(blacklist.addedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          inline: true
        },
        {
          name: 'Blacklist ID',
          value: blacklist._id.toString(),
          inline: false
        }
      ],
      timestamp: new Date(),
      footer: {
        text: 'Admin Blacklist System'
      }
    };

    if (blacklist.expiresAt) {
      embed.fields.push({
        name: 'Expires',
        value: new Date(blacklist.expiresAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        inline: true
      });
    }

    await axios.post(process.env.DISCORD_WEBHOOK_BLACKLIST, {
      embeds: [embed]
    });
  } catch (error) {
    console.error('Error sending blacklist notification to Discord:', error.message);
  }
};
