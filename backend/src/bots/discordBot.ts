/**
 * Discord Bot
 * Listens for messages and routes to messagingService. Sends replies in the same channel.
 * Requires DISCORD_BOT_TOKEN. Does not run in serverless (needs persistent WebSocket).
 */

// @ts-expect-error discord.js types have known issues with GatewayIntentBits export
import { Client, GatewayIntentBits, type TextChannel } from 'discord.js';
import { processMessage } from '../services/messagingService.js';
import { setDiscordSendFn } from '../services/messagingShipNotifier.js';
import logger from '../middleware/logger.js';

let client: Client | null = null;

async function sendToChannel(channelId: string, text: string): Promise<void> {
  if (!client) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isSendable()) {
      await channel.send(text.slice(0, 2000));
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, channelId }, 'Discord send failed');
    throw err;
  }
}

export async function startDiscordBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  setDiscordSendFn(sendToChannel);

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content?.trim();
    if (!content) return;

    const channelId = message.channel.id;
    try {
      const reply = await processMessage('discord', channelId, content);
      if (reply && 'send' in message.channel) {
        await (message.channel as TextChannel).send(reply.slice(0, 2000));
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message, channelId }, 'Discord processMessage failed');
      try {
        if ('send' in message.channel) {
          await (message.channel as TextChannel).send('Sorry, something went wrong.');
        }
      } catch {
        // ignore
      }
    }
  });

  client.once('ready', () => {
    logger.info({ user: client?.user?.tag }, 'Discord bot connected');
  });

  client.on('error', (err) => {
    logger.error({ err: err.message }, 'Discord client error');
  });

  await client.login(token);
}
