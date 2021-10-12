const { 
  Client, 
  Intents, 
  Collection, 
  Permissions,
  Constants,
} = require('discord.js');
const { ChannelTypes } = Constants;

const fs = require('fs');

const logger = require('./configuration/logConfig');

const utils = require('./utils');
const { parseArgs } = require('./utils');
const anonymous = utils.getAnonymous();
if (anonymous) logger.info('Running anonymously...');
const prefix = utils.getPrefix();
const userId = utils.getAllowedUserId();


// =========================================

const client = new Client({ 
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_INVITES,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGE_TYPING,
  ], 
  partials: ['CHANNEL'], // handle DMs
});


client.commands = new Collection();
const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));
commandFiles.forEach(file => {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const command = require(`./commands/${file}`); 
  client.commands.set(command.name, command);
});


// const cooldowns = new Collection();


// =========================================

client.on('ready', async () => {
  logger.info(`I am ready! Logged in as ${client.user.tag}!`);
  logger.info(`Bot has started, with ${client.users.cache.size} users, in ${client.channels.cache.size} channels of ${client.guilds.cache.size} guilds.`); 

  // client.user.setActivity('the upright organ');
  const link = utils.generateInvite(client);
  logger.info(`Generated bot invite link: ${link}`);
});


client.on('guildCreate', guild => {
  const embed = utils.embedTemplate(client)
    .setTitle('Thanks for adding me to your server!')
    .setDescription(`I'm a downloader bot which can pull attachments and embeds into a big list to download later. \n\nFor a list of commands, send \`${prefix}help [command name]\` here or in your server!`);
  return guild.fetchOwner()
    .then(member => member.send({ embeds: [embed] }));
});


client.on('messageCreate', async message => {
  // Check message for basic validity
  if (message.author.bot) return;
  if (!message.channel.isText()) return;

  if (userId !== null && message.author.id !== userId) return; 
    
  if (message.channel.type !== ChannelTypes[ChannelTypes.DM]) {
    const perms = await message.channel.permissionsFor(client.user);
    if (!perms.has(Permissions.FLAGS.SEND_MESSAGES)) return;
  }
  
  // Parse command
  const args = parseArgs(message);
  if (!args.length) return;
  let commandNameGuess = null;
  if (args[0].startsWith(prefix)) {
    commandNameGuess = args.shift()
      .slice(prefix.length)
      .toLowerCase();
  }
  
  // Find command in collection
  const findCommand = (commandName) => client.commands.get(commandName) ||
    client.commands.find(cmd => cmd.aliases?.includes(commandName)) || null;
  let command = findCommand(commandNameGuess);
  // Find command in DM auto-commands
  if (message.channel.type === ChannelTypes[ChannelTypes.DM]) { 
    command ||= client.commands.find(
      c => (c.autodetectTest ? c.autodetectTest(message) : 0) === true,
    );
  }
  if (!command) return;
  
  // Log received command!
  if (message.channel.type === ChannelTypes[ChannelTypes.DM]) {
    const { tag, username } = message.channel.recipient;
    logger.debug(`@${username} (${tag}): '${message.content}'`); 
  } else {
    logger.debug(`${message.guild.name} #${message.channel.name}: '${message.content}'`); 
  }

  // Check for allowed use
  const allowedTypes = command.allowedChannelTypes.map(t => ChannelTypes[t]);
  if (!allowedTypes.some(t => t === message.channel.type)) {
    message.reply({ content: 'I can\'t execute that command here!', ...utils.doNotNotifyReply });
    return;
  }

  // Handle no args
  if (command.argsMandatory && !args.length) {
    let reply = `You didn't provide any arguments, ${message.author.username}!`;
    if (command.usage) reply += `\nThe proper usage would be: \`${prefix}${command.name}${command.usage ? ` ${command.usage}` : ''}\``;
    message.reply({ content: reply, ...utils.doNotNotifyReply });
    return;
  }

  // // Handle cooldowns
  // if (!cooldowns.has(command.name)) {
  //   cooldowns.set(command.name, new Collection());
  // }

  // const now = Date.now();
  // const timestamps = cooldowns.get(command.name);
  // const cooldownAmount = (command.cooldown || 3) * 1000;

  // if (timestamps.has(message.author.id)) {
  //   const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

  //   if (now < expirationTime) {
  //     const timeLeft = (expirationTime - now) / 1000;
  //     message.reply({ 
  //       content: `please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`, 
  //       ...utils.doNotNotifyReply,
  //     });
  //     return;
  //   }
  // }
  
  // timestamps.set(message.author.id, now);
  // setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);


  // Finally execute command
  try {
    logger.debug('Execute!');
    await command.execute(message, args);
  } catch (error) {
    // if (error.message) logger.error(error.message);
    logger.error(error.stack);
    const defaultErrorMessage = 'there was an error trying to execute that command!';
    await message.reply({ 
      content: `${error.name}: ${error.message ? error.message : defaultErrorMessage}`, 
      ...utils.doNotNotifyReply,
    });
  }

});

// client.on("debug", function(info){
//   console.log(`debug -> ${info}`);
// });

client.on('disconnect', (event) => {
  logger.info(`The WebSocket has closed and will no longer attempt to reconnect: ${event}`);
});

client.on('error', (error) => {
  logger.error(`client's WebSocket encountered a connection error: ${error}`);
});

client.on('warn', (info) => {
  logger.warn(`warn: ${info}`);
});

// process.on('SIGINT', function() {
//   process.exit();
// });

client.login(process.env.BOT_TOKEN);
