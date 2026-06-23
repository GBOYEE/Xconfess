/**
 * Wave 5 Demo Seed Script
 *
 * Creates idempotent local demo data: admin + regular users, anonymous users,
 * confessions, reactions, comments, tags, and sample tips.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo.ts
 *
 * Environment (defaults):
 *   DB_HOST=localhost DB_PORT=55432 DB_USERNAME=postgres DB_PASSWORD=postgres DB_NAME=xconfess
 *
 * Idempotency: uses upsert-or-skip pattern for users (by username) and
 * checks for existing records before inserting. Re-running should not create duplicates.
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

dotenv.config();

import { User } from '../src/user/entities/user.entity';
import { AnonymousUser } from '../src/user/entities/anonymous-user.entity';
import { AnonymousConfession } from '../src/confession/entities/confession.entity';
import { Comment } from '../src/comment/entities/comment.entity';
import { Reaction } from '../src/reaction/entities/reaction.entity';
import { Tag } from '../src/confession/entities/tag.entity';
import { ConfessionTag } from '../src/confession/entities/confession-tag.entity';
import { Tip } from '../src/tipping/entities/tip.entity';

// Config
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '55432', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.DB_NAME || 'xconfess';

// Demo data constants
const ADMIN_USER = {
  username: 'demo-admin',
  email: 'admin@xconfess.demo',
  password: 'demo-admin-password-2025',
};

const REGULAR_USER = {
  username: 'demo-user',
  email: 'user@xconfess.demo',
  password: 'demo-user-password-2025',
};

const DEMO_TAGS = ['funny', 'serious', 'question', 'story', 'advice'];

const DEMO_CONFESSIONS = [
  {
    message: 'I secretly feed the office plants coffee every Monday. They seem to grow faster.',
    gender: 'male',
    tags: ['funny', 'story'],
  },
  {
    message: 'Does anyone else get anxious when the voice assistant lights up unexpectedly?',
    gender: 'female',
    tags: ['question', 'funny'],
  },
  {
    message: 'I moved to a new city last month and told everyone I love it here. Truth is, I miss home every day.',
    gender: 'non_binary',
    tags: ['serious', 'story'],
  },
  {
    message: 'My cat learned to open the pantry. I now have a very fat cat and an empty pantry.',
    gender: 'male',
    tags: ['funny', 'advice'],
  },
  {
    message: 'I think the best advice I ever received was "just start, even badly." It changed how I approach everything.',
    gender: 'female',
    tags: ['advice', 'serious'],
  },
  {
    message: 'Sometimes I pretend to be busy at work just so I can eat lunch in peace.',
    gender: 'non_binary',
    tags: ['funny', 'question'],
  },
];

const REACTIONS_LIST = ['heart', 'laugh', 'wow', 'thumbsup', 'pray'];

// Helpers
function makeEncryptedEmailParts(email: string) {
  const hex = Buffer.from(email).toString('hex').padEnd(64, '0').slice(0, 64);
  const iv = randomUUID().replace(/-/g, '').slice(0, 32);
  const tag = randomUUID().replace(/-/g, '').slice(0, 32);
  return {
    emailEncrypted: hex,
    emailIv: iv,
    emailTag: tag,
    emailHash: Buffer.from(email).toString('hex').padEnd(64, '0').slice(0, 64),
  };
}

// Main seed logic
async function seed() {
  console.log('Connecting to PostgreSQL at ' + DB_HOST + ':' + DB_PORT + '/' + DB_NAME + '...');

  const dataSource = new DataSource({
    type: 'postgres',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
    entities: [
      User,
      AnonymousUser,
      AnonymousConfession,
      Comment,
      Reaction,
      Tag,
      ConfessionTag,
      Tip,
    ],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected.');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Users (upsert by username)
    const userRepo = dataSource.getRepository(User);

    const adminParts = makeEncryptedEmailParts(ADMIN_USER.email);
    const existingAdmin = await userRepo.findOne({
      where: { username: ADMIN_USER.username },
    });
    let admin: User;
    if (existingAdmin) {
      console.log('  Admin user "' + ADMIN_USER.username + '" already exists, skipping.');
      admin = existingAdmin;
    } else {
      admin = await userRepo.save(
        userRepo.create({
          username: ADMIN_USER.username,
          password: ADMIN_USER.password,
          role: 'admin',
          isActive: true,
          notificationPreferences: {},
          privacySettings: {
            isDiscoverable: true,
            canReceiveReplies: true,
            showReactions: true,
            dataProcessingConsent: true,
          },
          ...adminParts,
        }),
      );
    }

    const userParts = makeEncryptedEmailParts(REGULAR_USER.email);
    const existingUser = await userRepo.findOne({
      where: { username: REGULAR_USER.username },
    });
    let regular: User;
    if (existingUser) {
      console.log('  Regular user "' + REGULAR_USER.username + '" already exists, skipping.');
      regular = existingUser;
    } else {
      regular = await userRepo.save(
        userRepo.create({
          username: REGULAR_USER.username,
          password: REGULAR_USER.password,
          role: 'user',
          isActive: true,
          notificationPreferences: {},
          privacySettings: {
            isDiscoverable: true,
            canReceiveReplies: true,
            showReactions: true,
            dataProcessingConsent: true,
          },
          ...userParts,
        }),
      );
    }

    console.log('  Users: admin=' + admin.username + ', user=' + regular.username);

    // 2. Anonymous Users
    const anonRepo = dataSource.getRepository(AnonymousUser);
    const anonUsers: AnonymousUser[] = [];

    for (let i = 0; i < 3; i++) {
      const existing = await anonRepo.findOne({ where: { id: 'seed-anon-' + i } });
      if (existing) {
        console.log('  Anonymous user seed-anon-' + i + ' already exists, skipping.');
        anonUsers.push(existing);
      } else {
        const au = await anonRepo.save(anonRepo.create({ id: 'seed-anon-' + i }));
        anonUsers.push(au);
      }
    }

    // 3. Tags (upsert by name)
    const tagRepo = dataSource.getRepository(Tag);
    const tagEntities: Tag[] = [];

    for (const tagName of DEMO_TAGS) {
      let tag = await tagRepo.findOne({ where: { name: tagName } });
      if (!tag) {
        tag = await tagRepo.save(
          tagRepo.create({
            name: tagName,
            description: 'Demo tag: ' + tagName,
          }),
        );
        console.log('  Created tag: ' + tagName);
      } else {
        console.log('  Tag "' + tagName + '" already exists, skip.');
      }
      tagEntities.push(tag);
    }

    // 4. Confessions
    const confessionRepo = dataSource.getRepository(AnonymousConfession);
    const confessionTagRepo = dataSource.getRepository(ConfessionTag);
    const createdConfessions: AnonymousConfession[] = [];

    for (let i = 0; i < DEMO_CONFESSIONS.length; i++) {
      const demo = DEMO_CONFESSIONS[i];
      const anonUser = anonUsers[i % anonUsers.length];

      const existing = await confessionRepo.findOne({
        where: { message: demo.message, anonymousUserId: anonUser.id },
      });

      if (existing) {
        console.log('  Confession already exists, skip.');
        createdConfessions.push(existing);
        continue;
      }

      const confession = await confessionRepo.save(
        confessionRepo.create({
          message: demo.message,
          gender: demo.gender,
          anonymousUserId: anonUser.id,
          viewCount: Math.floor(Math.random() * 50),
          moderationStatus: 'approved',
          moderationScore: 0.01,
          moderationFlags: [],
          requiresReview: false,
          isHidden: false,
          isDeleted: false,
        }),
      );
      createdConfessions.push(confession);

      for (const tagName of demo.tags) {
        const tag = tagEntities.find((t) => t.name === tagName);
        if (tag) {
          const ctExists = await confessionTagRepo.findOne({
            where: { confessionId: confession.id, tagId: tag.id },
          });
          if (!ctExists) {
            await confessionTagRepo.save(
              confessionTagRepo.create({
                confessionId: confession.id,
                tagId: tag.id,
              }),
            );
          }
        }
      }

      console.log('  Created confession: ' + demo.message.slice(0, 50) + '...');
    }

    // 5. Reactions
    const reactionRepo = dataSource.getRepository(Reaction);
    let reactionCount = 0;

    for (const confession of createdConfessions) {
      const numReactions = 2 + (Math.random() > 0.5 ? 1 : 0);
      for (let r = 0; r < numReactions; r++) {
        const emoji = REACTIONS_LIST[(r + reactionCount) % REACTIONS_LIST.length];
        const reactor = anonUsers[(r + reactionCount) % anonUsers.length];

        const exists = await reactionRepo.findOne({
          where: { confessionId: confession.id, anonymousUserId: reactor.id, emoji },
        });
        if (!exists) {
          await reactionRepo.save(
            reactionRepo.create({
              emoji,
              confessionId: confession.id,
              anonymousUserId: reactor.id,
            }),
          );
          reactionCount++;
        }
      }
    }
    console.log('  Created ' + reactionCount + ' reactions');

    // 6. Comments
    const commentRepo = dataSource.getRepository(Comment);
    const sampleComments = [
      'This is so relatable.',
      'I feel seen right now.',
      'Sending virtual hugs!',
      'Wait, what happened next?',
      'I needed to hear this today.',
    ];
    let commentCount = 0;

    for (let i = 0; i < createdConfessions.length; i++) {
      const confession = createdConfessions[i];
      const numComments = 1 + (i % 2);
      for (let c = 0; c < numComments; c++) {
        const commenter = anonUsers[(i + c) % anonUsers.length];
        const content = sampleComments[(i + c) % sampleComments.length];

        const exists = await commentRepo.findOne({
          where: { confessionId: confession.id, anonymousUserId: commenter.id, content },
        });
        if (!exists) {
          await commentRepo.save(
            commentRepo.create({
              content,
              confessionId: confession.id,
              anonymousUserId: commenter.id,
              isDeleted: false,
            }),
          );
          commentCount++;
        }
      }
    }
    console.log('  Created ' + commentCount + ' comments');

    // 7. Tips
    const tipRepo = dataSource.getRepository(Tip);
    let tipCount = 0;

    for (let i = 0; i < Math.min(3, createdConfessions.length); i++) {
      const confession = createdConfessions[i];
      const txId = 'seed-tip-' + randomUUID();

      const exists = await tipRepo.findOne({ where: { txId } });
      if (!exists) {
        await tipRepo.save(
          tipRepo.create({
            confessionId: confession.id,
            amount: (i + 1) * 0.5,
            txId,
            senderAddress: 'GDEMO' + randomUUID().replace(/-/g, '').slice(0, 50),
            verificationStatus: 'verified',
            verifiedAt: new Date(),
          }),
        );
        tipCount++;
      }
    }
    console.log('  Created ' + tipCount + ' tips');

    // Commit
    await queryRunner.commitTransaction();
    console.log('Seed complete! Demo data is ready.');
    console.log('Credentials:');
    console.log('  Admin:  ' + ADMIN_USER.username + ' / ' + ADMIN_USER.password);
    console.log('  User:   ' + REGULAR_USER.username + ' / ' + REGULAR_USER.password);
    console.log('See docs/local-demo-data-seed-guide.md for full details.');

  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed:', err);
    process.exitCode = 1;
    throw err;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
