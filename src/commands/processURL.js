const { Constants } = require('discord.js');
const { ChannelTypes } = Constants;

const logger = require('winston');

const getUrls = require('get-urls');

const { exec } = require('child_process');

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

  channel: null,

  async execute(_message, _args) {
    this.channel = _message.channel;

    const foundURLs = getUrls(_message.content);
    // [...foundURLs].forEach((u, i) => logger.debug(`${i}: ${u}`));
    if (![...foundURLs].length) return;

    const command = `${execConfig.command} ${[...foundURLs].join(' ')}`;
    await this.customExec(command, { ...execConfig.options });

    // const { stdout, stderr } = await exec(command, { ...execConfig.options });
    // if (stderr) _message.channel.send(`\`\`\`err:\n${stderr}\`\`\``);
    // if (stdout) _message.channel.send(`\`\`\`${stdout}\`\`\``);
    // _message.channel.send('Finished!');
  },

  async customExec(command, options) {
    return new Promise((resolve, reject) => {
      const process = exec(command, options);

      process.stdout.on('data', (data) => {
        this.channel.send(`\`\`\`\n${data.toString()}\n\`\`\``)
          .then(() => this.channel.sendTyping());
      });

      process.stderr.on('data', (data) => {
        const err = data.toString();
        if (err.startsWith('[1')) return; // default separators on multi-url commands
        logger.warn(err);
        this.channel.send(`\`\`\`fix\n${err}\n\`\`\``);
      });

      process.on('error', (err) => {
        this.channel.send(`Exec Error:\n\`\`\`fix\n${err.toString()}\n\`\`\``);
        reject(err);
      });

      process.on('exit', (code) => {
        this.channel.send(`*Finished!*`);
        resolve(`Exited with code ${code.toString()}`);
      });
    });
  },

};

module.exports = dl;
