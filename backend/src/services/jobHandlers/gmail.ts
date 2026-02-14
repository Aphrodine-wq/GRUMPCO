import logger from '../../middleware/logger.js';
import { GmailService } from '../integrations/gmailService.js';
import { from } from '../platform/supabaseClient.js';

interface ProcessGmailWebhookJob {
  emailAddress: string;
  historyId: string;
}

export async function handleProcessGmailWebhook(job: { data: ProcessGmailWebhookJob }) {
  const { emailAddress, historyId } = job.data;
  logger.info({ emailAddress, historyId }, 'Processing Gmail webhook job');

  const { data: userRow, error } = await from('users')
    .select('id')
    .eq('email', emailAddress)
    .single();

  if (error || !userRow) {
    logger.error({ emailAddress, error: error?.message }, 'Could not find user for Gmail webhook');
    return;
  }

  const user = userRow as { id: string };
  const userId = user.id;

  const gmailService = new GmailService(userId);
  const history = await gmailService.getNewEmails(historyId);

  for (const item of history) {
    if (item.messagesAdded) {
      for (const msg of item.messagesAdded) {
        const message = await gmailService.getMessage(msg.message.id);
        logger.info(
          {
            messageId: msg.message.id,
            subject: message.payload.headers.find(
              (h: { name: string; value: string }) => h.name === 'Subject'
            )?.value,
          },
          'Processed new email'
        );
      }
    }
  }
}
