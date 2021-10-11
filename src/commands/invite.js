// const { } = require('discord.js');
// const logger = require('winston');

const utils = require('../utils');


module.exports = {

  name: 'invite',
  aliases: ['getinvite'],

  description: 'Get a link for inviting this bot to another server you have Manage Server permissions on...',

  guildOnly: false,

  args: false,
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
