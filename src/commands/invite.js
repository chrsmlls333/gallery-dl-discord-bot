const { Constants } = require('discord.js');
const { ChannelTypes } = Constants;

// const logger = require('winston');

const utils = require('../utils');


module.exports = {

  name: 'invite',
  aliases: ['getinvite'],

  description: 'Get a link for inviting this bot to another server you have Manage Server permissions on...',

  allowedChannelTypes: [
    ChannelTypes.DM, 
    ChannelTypes.GROUP_DM,
    ChannelTypes.GUILD_TEXT,
    ChannelTypes.GUILD_PUBLIC_THREAD,
  ],

  autodetection: false,

  argsMandatory: false,
  usage: null,
  
  execute(message) {

    utils.generateInvite(message.client)
      .then(link => {
        const embed = utils.embedTemplate(message.client)
          .setTitle(`Invite ${message.client.user.username} to other servers!`)
          .setURL(link);
        return message.channel.send({ embeds: [embed] });
      });
    
  },
};
