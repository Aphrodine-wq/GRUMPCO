/**
 * Bonjour/mDNS Service - advertise G-Rump backend on local network
 * Enables discovery for Electron and other clients.
 */

import { createRequire } from 'module';
import logger from '../../middleware/logger.js';

const require = createRequire(import.meta.url);

interface MdnsResponder {
  respond: (opts: { answers: unknown[] }) => void;
  destroy?: () => void;
}
let responder: MdnsResponder | null = null;

export function startBonjour(port: number, name = 'G-Rump'): void {
  if (responder) return;
  try {
    const mdns = require('multicast-dns');
    const r = mdns();
    responder = r;
    r.respond({
      answers: [
        {
          name: `_grump._tcp.local`,
          type: 'SRV',
          data: { port, target: 'localhost', priority: 0, weight: 0 },
          ttl: 120,
        },
        {
          name: `_grump._tcp.local`,
          type: 'TXT',
          data: Buffer.from(JSON.stringify({ name, port })),
          ttl: 120,
        },
      ],
    });
    logger.info({ port, name }, 'Bonjour/mDNS advertising started');
  } catch (e) {
    logger.debug({ err: (e as Error).message }, 'Bonjour not available');
  }
}

export function stopBonjour(): void {
  if (responder) {
    responder.destroy?.();
    responder = null;
    logger.info('Bonjour advertising stopped');
  }
}
