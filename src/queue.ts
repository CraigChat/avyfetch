import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fastq from 'fastq';

import { logger } from './logger.js';

const S3 = new S3Client({
  region: 'auto',
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

type Task = {
  id: string;
  hash: string;
};

const BUCKET = process.env.AWS_BUCKET;

export const q = fastq.promise<unknown, Task, void>(asyncWorker, 1);

q.error((err, { id, hash }) => {
  if (!err) return;
  logger.error(`Avatar fetch failed (${id}/${hash})`, err);
});

async function asyncWorker(task: Task): Promise<void> {
  const KEY = `discord-avatars/${task.id}.png`;
  const headResponse = await S3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: KEY })).catch(() => null);
  if (
    !headResponse ||
    headResponse.Metadata!.avatarhash !== task.hash ||
    Date.now() - headResponse.LastModified!.valueOf() > 1000 * 60 * 60 * 24 * 30
  ) {
    const avatarResponse = await fetch(`https://cdn.discordapp.com/avatars/${task.id}/${task.hash}.png?size=2048`);
    if (avatarResponse.status !== 200) throw new Error(`Failed to fetch avatar from Discord (${avatarResponse.status})`);
    await S3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: KEY,
        Body: (await avatarResponse.arrayBuffer()) as Buffer,
        Metadata: { AvatarHash: task.hash },
        ContentType: 'image/png'
      })
    );
    logger.info(`Avatar uploaded for ${task.id} (${task.hash})`);
  }
}
