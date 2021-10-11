/* eslint-disable curly */

// const { } = require('discord.js');
// const logger = require('winston');
const utils = require('../utils');

const prefix = utils.checkPrefix();

module.exports = {

  name: 'help',
  aliases: ['h', 'commands'],

  description: 'List all of my commands or info about a specific command.',

  guildOnly: false,

  args: false,
  usage: '[command name or alias]',
  
  execute(message, args) {

    const data = [];
    const { commands } = message.client;

    // Just help!!
    if (!args.length) {
      data.push("Here's a list of all my commands:");
      data.push(commands.map(command => command.name).join(', '));
      data.push(`\nYou can send \`${prefix}help [command name]\` to get info on a specific command!`);

      const embed = utils.embedTemplate(message.client) // Makes a pretty embed
        .setTitle('Here are all of my commands...')
        // .setDescription('Here are all of my commands...')
        .addFields(
          { name: 'Commands', value: `${commands.map(command => command.name).join(', ')}` },
          // { name: '\u200B', value: '\u200B' },
          { name: 'Learn More', value: `\nYou can send \`${prefix}help [command name]\` to get info on a specific command!` },
        );
      return message.channel.send({ embeds: [embed] });
    }


    // I ACTUALLY WANT INFO

    const name = args[0].toLowerCase();
    const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));

    if (!command) return message.reply({ content: 'that\'s not a valid command!', ...utils.doNotNotifyReply });

    const usageInline = command.name !== 'download'; // handle long strings
    const embed = utils.embedTemplate(message.client);
    embed.setTitle(utils.titleCase(command.name));
    embed.addFields(
      { name: 'Command Name', value: `${prefix}${command.name}`, inline: true },
    );
    if (command.aliases && command.aliases.length) embed.addFields(
      { name: 'Aliases', value: `${command.aliases.map(a => prefix + a).join(', ')}`, inline: true },
    );
    if (command.cancelAliases && command.cancelAliases.length) embed.addFields(
      { name: 'Cancel With', value: `${command.cancelAliases.map(a => prefix + a).join(', ')}`, inline: true },
    );
    embed.addFields(
      { name: 'Description', value: `${command.description}` },
      // { name: '\u200B', value: '\u200B' },
      { name: 'Usage', value: `${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}`, inline: usageInline },
      { name: 'Arguments Required?', value: utils.titleCase(command.args), inline: true },
    );
    
    return message.channel.send({ embeds: [embed] });
    
  },
};
