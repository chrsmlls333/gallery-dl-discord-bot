const { MessageEmbed, Permissions } = require('discord.js');

const logger = require('./configuration/logConfig');

const { defaultPrefix, embedColor, botAttribution } = require('./configuration/config.json');


const utils = {

  // check Prefix setting

  getPrefix: () => {
    const p = process.env.PREFIX || defaultPrefix;
    return p;
  },

  // check Anonymous Mode

  getAnonymous: () => {
    let a = process.env.ANONYMOUS || false;
    if (typeof a === 'string') {
      if (a.toLowerCase() === 'false' ||
          a === '0') {
        a = false;
      }
    }
    return a;
  },

  // check Allowed User

  getAllowedUserId: () => {
    const id = process.env.ALLOWED_USER_ID || null;
    if (id == null) {
      logger.warn('No ALLOWED_USER_ID environment variable, operating dangerously.');
    }
    return id;
  },

  // Get Invite // Set permissions here

  generateInvite: (client) => client.generateInvite({
    scopes: ['bot'], 
    permissions: [
      Permissions.FLAGS.ADD_REACTIONS,
      Permissions.FLAGS.VIEW_CHANNEL,
      Permissions.FLAGS.SEND_MESSAGES,
      Permissions.FLAGS.EMBED_LINKS,
      Permissions.FLAGS.ATTACH_FILES,
      Permissions.FLAGS.READ_MESSAGE_HISTORY,
      Permissions.FLAGS.CHANGE_NICKNAME,
    ],
  }),


  // Parsing Command Arguments

  parseArgs: (message, command = null) => {
    if (!message) return [];
    const args = message.content.split(/ +/);
    if (command === null) return args; // common exit
    
    const prefix = utils.getPrefix();
    const { name } = command;
    if (!name) return args;
    if (args[0].toLowerCase() === (prefix + name).toLowerCase()) {
      args.shift();
      return args;
    }
    return args;
  },


  // Parsing Mentions

  CHAN_REGEX: /^<#(\d+)>$/,
  USER_REGEX: /^<@!?(\d+)>$/,
  ROLE_REGEX: /^<@&(\d+)>$/,

  isChannelFromMention: (mention) => mention.match(utils.CHAN_REGEX) !== null,

  getChannelFromMention(message, mention) {
    const matches = mention.match(utils.CHAN_REGEX);
    if (!matches) return null;
    const id = matches[1];
    return message.client.channels.cache.get(id);
  },

  isUserFromMention: (mention) => mention.match(utils.USER_REGEX) !== null,

  getUserFromMention: (message, mention) => {
    const matches = mention.match(utils.USER_REGEX);
    if (!matches) return null;
    const id = matches[1];
    return message.client.users.cache.get(id);
  },

  isRoleFromMention: (mention) => mention.match(utils.ROLE_REGEX) !== null,


  // Messaging / Editing

  replyOrEdit: async (originalMessage, newMessage, content, ping = false) => {
    let c = { content };
    if (!ping) c = { ...c, ...utils.doNotNotifyReply };
    if (!newMessage) return originalMessage.reply(c);
    if (!newMessage.editable) return newMessage;
    return newMessage.edit(c);
  },

  sendOrEdit: async (channel, newMessage, content) => {
    if (!newMessage) return channel.send({ content });
    if (!newMessage.editable) return newMessage;
    return newMessage.edit({ content });
  },

  appendEdit: async (message, content) => {
    if (!message) return message;
    if (!message.editable) return message;
    return message.edit({ content: (message.content + content) });
  },

  deleteMessage: (message, ms = 0) => {
    if (!message) return null;
    if (!message.deletable || message.deleted) return null;
    return utils.sleep(ms).then(() => message.delete());
  },

  doNotNotifyReply: {
    allowedMentions: { 
      repliedUser: false, 
    },
  },


  // Embeds

  embedTemplate: (client) => {
    const embed = new MessageEmbed()
      .setAuthor(client.user.username, client.user.avatarURL())
      .setColor(embedColor)
      .setTimestamp();
    if (!utils.getAnonymous()) {
      embed.setAuthor(client.user.username, client.user.avatarURL(), botAttribution.github);
      embed.setFooter(botAttribution.name);
    }
    return embed;
  },


  // String Functions

  titleCase: (str) => { 
    if ((str === null) || (str === '')) return str; 
    const s = str.toString(); 
    return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()); 
  },


  // Sleep and Delays

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  sleepThenPass: (ms) => (x) => new Promise(resolve => setTimeout(() => resolve(x), ms)),


};

module.exports = utils;
