const { Collection, MessageAttachment } = require('discord.js');

const logger = require('winston');

const path = require('path');
const urlLib = require('url');
const fsp = require('fs').promises;

const dayjs = require('dayjs');
dayjs.extend(require('dayjs/plugin/advancedFormat'));
dayjs.extend(require('dayjs/plugin/relativeTime'));
dayjs.extend(require('dayjs/plugin/isSameOrAfter'));

const chrono = require('chrono-node');

const pug = require('pug');
const pugRender = pug.compileFile('src/templates/download.pug');

const utils = require('../utils');
const {
  fetchIterationsMax, 
  fetchPageSize, 
  fetchDelay, 
  statusMessageDeleteDelay,
  htmlDebugPath,
  cssFilePath,
  botAttribution,
} = require('../configuration/config.json');

const prefix = utils.checkPrefix();


// =======================================================================================

const dl = {

  name: 'download',
  aliases: ['dl', 'save'],
  cancelAliases: ['cancel', 'stop', 'halt'],

  description: `
    Download... something! Takes a channel, then a user, then a time in plain english. 
    Remember you can cancel while this is running.
  `,

  guildOnly: true,

  args: true,
  usage: '[...#channel, here, this, all, any] [@user] [time]',
  
  
  // Parse command arguments ======================================================
  
  parseChannel: async (data) => {
    const { scanChannels, commandMessage: m, commandMessageArgs: a } = data;
    let { allChannels } = data;

    if (scanChannels) return data;
    if (!a.length) return data;

    const channelsFound = new Collection();
    while (a.length) {
      const arg = a[0];
      let c = utils.getChannelFromMention(m, arg);
      if (!c && arg.match(/^(this|here)$/i)) c = m.channel;
      if (!c && arg.match(/^(all|any)$/i)) {
        if (m.channel.type === 'DM') throw new Error("I really can't do this in a DM!");
        if (!m.channel.guild.available) throw new Error("I don't see your server!");
        allChannels = true;
        const textChannels = m.channel.guild.channels.cache.filter(gc => gc.type === 'GUILD_TEXT' && !gc.deleted && gc.viewable);
        textChannels.each((chan) => channelsFound.set(chan.id, chan));
        c = textChannels.first(); // To appease current if/else structure
      }
      if (!c) break; // Nothing found
      channelsFound.set(c.id, c);
      a.shift(); 
    }

    if (!channelsFound.size) throw new Error("I don't see a channel mention, or all/here/this, sorry!");
    logger.info(channelsFound.size);
    return {
      ...data,
      scanChannels: channelsFound,
      commandMessageArgs: a,
      allChannels,
    };
  },

  parseUser: async (data) => {
    const { scanUsers, commandMessage: m, commandMessageArgs: a } = data;
    if (scanUsers) return data;
    if (!a.length) return data;

    const usersFound = new Collection();
    while (a.length) {
      const arg = a[0];
      const u = utils.getUserFromMention(m, arg);
      if (!u) {
        if (utils.isRoleFromMention(arg)) {
          m.reply({ 
            content: "I don't know what to do with roles and bots. Ignoring that bit!", 
            ...utils.doNotNotifyReply,
          });
        }
        break;
      }
      usersFound.set(u.id, u);
      a.shift();
    }
    
    if (!usersFound.size) {
      // await m.reply("I don't see a user mention, but that's fine I guess!");
      return data;
    }

    return {
      ...data,
      scanUsers: usersFound,
      commandMessageArgs: a,
    };
  },

  parseTime: async (data) => {
    const { commandMessageArgs: a, scanDateLimit } = data;
    if (scanDateLimit) return data;
    if (!a.length) return data;

    const s = a.join(' ');
    logger.debug(`Time string to interpret: ${s}`);
    const date = chrono.parseDate(s);

    if (!dayjs(date).isValid()) return data;
    if (!dayjs(date).isBefore()) return data;

    return {
      ...data,
      scanDateLimit: date,
      commandMessageArgs: [],
    };
  },

  spoutUnderstanding: async (data) => {
    // Reply with plain english understanding of command
    const { 
      commandMessage: m, 
      scanChannels: c, 
      scanUsers: u, 
      allChannels: all,
      scanDateLimit: d,
    } = data;

    /* eslint-disable no-multi-spaces, indent, no-constant-condition */
    let     s =  `I hear you want to scan messages `;
    if (u)  s += `posted by ${[...u.values()].join(' & ')} `;
            s += `in ${all ? 'all channels' : [...c.values()].join(' & ')} `;
    if (d)  s += `since ${dayjs(d).fromNow()} (${dayjs(d).format('MMMM Do YYYY')}) `;
            s += `for any direct attachments. One sec...`;
    /* eslint-enable no-multi-spaces, indent, no-constant-condition */

    const spoutMessage = await m.reply({ content: s, ...utils.doNotNotifyReply });
    logger.info(spoutMessage.cleanContent);
    return data;
  },

  // Fetch data from message history! ===================================================

  statusMessageExpire: (data) => {
    utils.deleteMessage(data.statusMessage, statusMessageDeleteDelay);
    return data;
  },

  fetch: (fetchData) => fetchData.scanChannels
    .get(fetchData.currentChannelId).messages
    .fetch({ before: fetchData.earliestSnowflake, limit: fetchPageSize })
    .then(async messages => {
      const {
        commandMessage,
        statusMessage,
        scanChannels,
        currentChannelId,
        scanUsers,
        scanDateLimit,
      } = fetchData;
      let { 
        iterations,
        earliestSnowflake,
        collectedTotal,
        collectionFiltered,
      } = fetchData;

      const i = ++iterations;
      // logger.debug(`Fetch! ${i}`);

      // CHECK FOR CANCEL
      if (fetchData.cancelCollector.ended) {
        utils.deleteMessage(statusMessage);
        throw new Error('I\'m cancelling!');
      }
      
      // CHECK FOR NOTHING / END / MAXLOOP / TIME
      const noMessages = !messages.size;
      const reachedDebugMax = fetchIterationsMax && i > fetchIterationsMax;
      let pastTimeLimit = false;
      if (!noMessages && scanDateLimit) {
        const timestamps = messages.map(m => m.createdTimestamp);
        const newestTimestamp = timestamps.reduce((a, b) => Math.max(a, b), -Infinity);
        // eslint-disable-next-line max-len
        const newestDate = messages.find(m => m.createdTimestamp === newestTimestamp).createdAt || null;
        if (dayjs(newestDate).isValid()) {
          pastTimeLimit = dayjs(newestDate).isBefore(scanDateLimit);
        }
      }
      if (noMessages || reachedDebugMax || pastTimeLimit) {
        if (statusMessage) {
          return utils.appendEdit(statusMessage, ` Finished!`)
            .then(message => {
              logger.info(message.cleanContent);
              return { ...fetchData, statusMessage: message };
            })
            .then(dl.statusMessageExpire);
        }
        // Simple return if no status to report
        return fetchData;
      }

      // GET EARLIEST
      const timestamps = messages.map(m => m.createdTimestamp);
      const earliestTimestamp = timestamps.reduce((a, b) => Math.min(a, b), Infinity);
      earliestSnowflake = messages.findKey(m => m.createdTimestamp === earliestTimestamp);

      // FILTER /////////////////////////////////////////////////////////////////////////
      let creme = [];

      // Filter attachments
      creme = messages.filter(m => { // make sure at least one attachment or embed
        if (m.attachments.size) return true;
        if (m.embeds.length) return m.embeds.some(e => new RegExp('image|video').test(e.type));
        return false;
      }); 
      
      // Filter for specced users
      if (scanUsers && scanUsers.size) {
        creme = creme.filter(m => scanUsers.some(u => u.id === m.author.id));
      }

      // Filter for date
      if (scanDateLimit) {
        creme = creme.filter(m => dayjs(m.createdAt).isSameOrAfter(scanDateLimit));
      }

      // UPDATE DATA /////////////////////////////////////////////////////////////
      collectedTotal += messages.size;
      collectionFiltered = collectionFiltered.concat(creme);
      
      // REPORT AND LOOP
      return utils.replyOrEdit(commandMessage, statusMessage, 
        `for ${scanChannels.get(currentChannelId)} I see ${collectionFiltered.size}/${collectedTotal} results here from ${i}${fetchIterationsMax ? `/${fetchIterationsMax}` : ''} pass${i !== 1 ? 'es' : ''}!`)
        .then(message => ({
          ...fetchData,
          statusMessage: message,
          iterations,
          earliestSnowflake,
          collectedTotal,
          collectionFiltered,
        }))
        .then(utils.sleepThenPass(fetchDelay))
        .then(dl.fetch);
    }),


  fetchChannelsCombine: (data) => {

    // Setup cancelling by command
    const cancelRegex = new RegExp(`^\\${prefix}(${dl.cancelAliases.join('|')})$`, 'i');
    const filter = m => cancelRegex.test(m.content) && 
                        m.author.id === data.commandMessage.author.id;
    const cancelCollector = (
      data.commandMessage.channel.createMessageCollector({ filter, max: 1 })
    );
    cancelCollector.on('collect', m => logger.debug(`Collected ${m.content}`));
    
    // Start Per-Channel Fetch in Parallel
    const fetches = data.scanChannels.map((c, k) => {
      const fetchInitData = {
        commandMessage: data.commandMessage,
        commandMessageArgs: data.commandMessageArgs,
        statusMessage: null,
        
        scanChannels: data.scanChannels && data.scanChannels.clone(),
        currentChannelId: k,
        scanUsers: data.scanUsers && data.scanUsers.clone(),
        scanDateLimit: data.scanDateLimit,
      
        iterations: 0,
        
        collectedTotal: 0,
        collectionFiltered: new Collection(),

        cancelCollector,
        
        earliestSnowflake: null,
      };

      return dl.fetch(fetchInitData); // recursive
    });

    return Promise.all(fetches).then(fetchResults => {
      // stop cancel watch
      cancelCollector.stop();

      // delete all statusMessages 
      // const statusMessages = fetchResults.map(f => f.statusMessage);
      // eslint-disable-next-line max-len
      // setTimeout(() => data.commandMessage.channel.bulkDelete(statusMessages), statusMessageDeleteDelay);

      // combine results
      let { collectedTotal, collectionLoadedMessages } = data;
      collectedTotal = fetchResults.reduce((acc, result) => acc + result.collectedTotal, 0);
      const filteredEach = fetchResults.map(f => f.collectionFiltered);
      collectionLoadedMessages = new Collection().concat(...filteredEach);
      return { ...data, collectedTotal, collectionLoadedMessages };
    });

  },


  // Prepare for export ====================================================================

  buildLinkCollection: (data) => {
    if (!data.collectionLoadedMessages || !data.collectionLoadedMessages.size) throw new Error('No messages, no attachments! Simple as that!');
    
    const messages = data.collectionLoadedMessages;
    const allAttachments = new Collection();

    messages.each((m, sfm) => {

      const ingestAttachmentEmbed = (key, url) => {
        const username = m.author.username.replace(/[^\w-]+/g, '') || m.author.tag;
        const createdString = dayjs(m.createdAt).format('YYYYMMDD-HHmmss');
        let basename = path.basename(urlLib.parse(url).pathname);
        basename = basename.replace(/^(SPOILER_)/, '');
        const newname = path.join(m.guild.name, m.channel.name, `${username}_${createdString}_${basename}`);

        allAttachments.set(key, {
          message: m,
          basename,
          newname,
          url,
        });
      };

      m.attachments.each((a, sfa) => ingestAttachmentEmbed(sfa, a.url));

      m.embeds.forEach((e, i) => {
        const garbageSnowflake = `${sfm}-embed-${i}`;
        if (new RegExp('image|video').test(e.type) && e.url) ingestAttachmentEmbed(garbageSnowflake, e.url);
      });
    });

    if (!allAttachments.size) throw new Error('Seems there weren\'t any attachments in your search results!');

    return { ...data, collectionMedia: allAttachments };
  },

  buildDownloadHtml: async (data) => {
    const {
      scanChannels,
      allChannels: all,
      scanUsers,
      scanDateLimit,
      collectionMedia,
    } = data;

    const css = await fsp.readFile(cssFilePath)
      .then(txt => Buffer.from(txt).toString('base64'));

    const html = pugRender({
      dayjs, // import
      server: scanChannels.first().guild.name,
      iconURL: scanChannels.first().guild.iconURL({ format: 'jpg', dynamic: true, size: 128 }),
      channels: all ? 'all' : scanChannels.map(c => c.name).join('&#'),
      users: (scanUsers && scanUsers.size) ? scanUsers.map(u => u.tag).join(' & ') : null,
      attachments: [...collectionMedia.values()],
      stylesheet: `data:text/css;base64,${css}`,
      dateLimit: dayjs(scanDateLimit).isValid() ? scanDateLimit : null,
      botAttribution: utils.checkAnonymous() ? null : botAttribution,
    });

    return { ...data, html };
  },

  distributeHTMLData: (data) => {
    const {
      html, 
      commandMessage, 
      scanChannels,
      allChannels: all,
    } = data;

    if (!html) throw new Error('There was no html generated.');
    const htmlData = Buffer.from(html);

    fsp.writeFile(htmlDebugPath, htmlData, 'utf8')
      .then(() => logger.debug(`Deliverable HTML saved to ${htmlDebugPath}!`))
      .catch(error => {
        logger.error('No luck writin\' them files then? Its just the one file, actually...');
        logger.error(error.stack);
      });
    
    let channelstring = null;
    if (all) channelstring = 'all';
    if (!channelstring && scanChannels.size === 1) channelstring = scanChannels.first().name;
    if (!channelstring) channelstring = `${scanChannels.size}channels`;

    const attachment = new MessageAttachment(htmlData, `${commandMessage.guild.name.replace(' ', '')}_${channelstring}_attachments.html`);
    return commandMessage.reply({ content: `Here you go!`, files: [attachment] })
      .then(() => data);
  },


  // RUN ALL =====================================================================================

  async execute(_message, _args) {

    const initData = {
      commandMessage: _message,
      commandMessageArgs: _args,
    
      scanChannels: null,
      allChannels: false,
      scanUsers: null,
      scanDateLimit: null,

      collectionLoadedMessages: null,
      collectionMedia: null,
      collectedTotal: 0,
      
      html: null,
    };
    
    return Promise.resolve(initData)
      .then(dl.parseChannel)
      .then(dl.parseUser)
      .then(dl.parseTime)
      .then(dl.spoutUnderstanding)
      .then(dl.fetchChannelsCombine)
      .then(dl.buildLinkCollection)
      .then(dl.buildDownloadHtml)
      .then(dl.distributeHTMLData);
  },

};

module.exports = dl;
