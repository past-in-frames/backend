import { redactSecrets } from '../src/lib/database-url';
import { prisma } from '../src/lib/prisma';
import { biosphere2FirstMission1991 } from './stories/biosphere-2-first-mission-1991';
import { blackFootedFerretRediscovery1981 } from './stories/black-footed-ferret-rediscovery-1981';
import { boeing767FirstFlight1981 } from './stories/boeing-767-first-flight-1981';
import { britishOccupyPhiladelphia1777 } from './stories/british-occupy-philadelphia-1777';
import { discoverySts48Returns1991 } from './stories/discovery-sts-48-returns-1991';
import { kennedyNixonFirstTelevisedDebate1960 } from './stories/kennedy-nixon-first-televised-debate-1960';
import { marsObserverLaunch1992 } from './stories/mars-observer-launch-1992';
import { nasaDartAsteroidImpact2022 } from './stories/nasa-dart-asteroid-impact-2022';
import { shannonLucidReturnsToEarth1996 } from './stories/shannon-lucid-returns-to-earth-1996';
import { skylab3Return1973 } from './stories/skylab-3-return-1973';

const storySeeds = [
  britishOccupyPhiladelphia1777,
  kennedyNixonFirstTelevisedDebate1960,
  biosphere2FirstMission1991,
  discoverySts48Returns1991,
  blackFootedFerretRediscovery1981,
  shannonLucidReturnsToEarth1996,
  skylab3Return1973,
  marsObserverLaunch1992,
  boeing767FirstFlight1981,
  nasaDartAsteroidImpact2022,
];

const adminPasswordHash =
  'scrypt$S1Dj3nw1Z5bhqJLJOZBwpg$a1aZfYSzs3yutsmLJ7XnS45HiP8pK_UfRy_oOBGPYBU';

async function main() {
  await prisma.adminCredential.upsert({
    where: { id: 1 },
    create: { id: 1, passwordHash: adminPasswordHash },
    update: { passwordHash: adminPasswordHash },
  });
  console.log('seeded admin credential');

  for (const storySeed of storySeeds) {
    const body = JSON.stringify(storySeed.body);

    for (const item of storySeed.media) {
      if (item.url !== null && !/^https?:\/\//.test(item.url)) {
        throw new Error('Story media URL must be a real http(s) address or null. Do not invent one.');
      }
    }

    const story = await prisma.$transaction(async (tx) => {
      const saved = await tx.story.upsert({
        where: { slug: storySeed.slug },
        create: {
          slug: storySeed.slug,
          title: storySeed.title,
          summary: storySeed.summary,
          body,
          eventDate: storySeed.eventDate,
          category: storySeed.category,
          type: storySeed.type,
          subtype: storySeed.subtype,
          status: storySeed.status,
          publishedAt: storySeed.publishedAt,
        },
        update: {
          title: storySeed.title,
          summary: storySeed.summary,
          body,
          eventDate: storySeed.eventDate,
          category: storySeed.category,
          type: storySeed.type,
          subtype: storySeed.subtype,
          status: storySeed.status,
          publishedAt: storySeed.publishedAt,
        },
      });

      for (const source of storySeed.sources) {
        await tx.storySource.upsert({
          where: {
            storyId_url: {
              storyId: saved.id,
              url: source.url,
            },
          },
          create: {
            storyId: saved.id,
            title: source.title,
            url: source.url,
            publisher: source.publisher,
          },
          update: {
            title: source.title,
            publisher: source.publisher,
          },
        });
      }

      for (const item of storySeed.media) {
        const data = {
          type: item.type,
          url: item.url,
          caption: item.caption,
          altText: item.altText,
          credit: item.credit,
          isAiGenerated: item.isAiGenerated,
          sortOrder: item.sortOrder,
        };
        await tx.storyMedia.upsert({
          where: {
            storyId_key: {
              storyId: saved.id,
              key: item.key,
            },
          },
          create: {
            storyId: saved.id,
            key: item.key,
            ...data,
          },
          update: data,
        });
      }

      return saved;
    }, { timeout: 30_000 });

    const [stories, sources, media] = await Promise.all([
      prisma.story.count({ where: { slug: storySeed.slug } }),
      prisma.storySource.count({ where: { storyId: story.id } }),
      prisma.storyMedia.count({ where: { storyId: story.id } }),
    ]);

    console.log(
      `seeded slug=${storySeed.slug} stories=${stories} sources=${sources} media=${media}`,
    );
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactSecrets(message));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
