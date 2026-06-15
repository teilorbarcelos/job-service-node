import { parentPort } from 'node:worker_threads';
import bcrypt from 'bcrypt';

parentPort!.on('message', async (msg: {
  id: string;
  operation: 'hash' | 'compare';
  plainText: string;
  rounds?: number;
  hash?: string;
}) => {
  try {
    let result: string | boolean;

    if (msg.operation === 'hash') {
      result = await bcrypt.hash(msg.plainText, msg.rounds!);
    } else {
      result = await bcrypt.compare(msg.plainText, msg.hash!);
    }

    parentPort!.postMessage({ id: msg.id, result });
  } catch (error) {
    parentPort!.postMessage({ id: msg.id, error: (error as Error).message });
  }
});
