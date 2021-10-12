const { Constants } = require('discord.js');
const { ChannelTypes } = Constants;

const logger = require('winston');

const getUrls = require('get-urls');

const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const execConfig = require('../configuration/config.json').exec;


// =======================================================================================

const dl = {

  name: 'download',
  aliases: ['dl', 'save'],
  cancelAliases: ['cancel', 'stop', 'halt'],

  description: `
    Download... something! Takes a single URL or a list.
    Remember you can cancel while this is running.
  `,

  allowedChannelTypes: [
    ChannelTypes.DM, 
    ChannelTypes.GROUP_DM,
    ChannelTypes.GUILD_TEXT,
    ChannelTypes.GUILD_PUBLIC_THREAD,
  ],

  argsMandatory: true,
  usage: '[url...]',


  // Autodetection in DM ======================================================
  
  autodetection: true,
  autodetectTest: (message) => {
    const foundURLs = getUrls(message.content);
    return !![...foundURLs].length;
  },

  // RUN ALL =====================================================================================

  async execute(_message, _args) {

    const foundURLs = getUrls(_message.content);
    [...foundURLs].forEach((u, i) => logger.debug(`${i}: ${u}`));
    if (![...foundURLs].length) return;

    const command = `${execConfig.command} ${[...foundURLs].join(' ')}`;
    const { stdout, stderr } = await exec(command, { ...execConfig.options });
    if (stderr) _message.channel.send(`\`\`\`${stderr}\`\`\``);
    if (stdout) _message.channel.send(`\`\`\`${stdout}\`\`\``);
    _message.channel.send('Finished!');

  },

};

module.exports = dl;
