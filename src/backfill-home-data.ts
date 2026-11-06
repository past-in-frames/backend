/**
 * One-off: fills the fields the redesigned home page reads (region, topics,
 * the photo story, starter collections) for stories that already exist.
 *
 *   npx tsx src/backfill-home-data.ts          # dry run: prints what it would do
 *   npx tsx src/backfill-home-data.ts --apply  # writes it
 *
 * It never overwrites: a story keeps a region or topics an editor already set,
 * and a collection that exists is left alone. The rules are keyword guesses,
 * so editors should skim the result in the admin and correct what is wrong.
 */
import { prisma } from './lib/prisma';
import { STORY_TOPICS, type StoryTopicName } from './lib/story-input';

const apply = process.argv.includes('--apply');

const PHOTO_STORY_SLUG = 'chicago-after-fire-rebuilding-1871-1905';

const US = [
  'united states', 'u.s.', 'american', 'america', 'nasa', 'apollo', 'gemini', 'skylab', 'mariner',
  'pioneer', 'voyager', 'surveyor', 'space shuttle', 'kennedy', 'lincoln', 'nixon', 'reagan',
  'roosevelt', 'washington', 'philadelphia', 'new york', 'chicago', 'california', 'san francisco',
  'texas', 'boston', 'delaware', 'alaska', 'kentucky', 'ohio', 'pennsylvania', 'virginia',
  'yorktown', 'saratoga', 'wall street', 'congress', 'supreme court', 'senate', 'white house',
  'florida', 'louisiana', 'wyoming', 'detroit', 'dallas', 'hollywood', 'broadway', 'seattle',
  'alcatraz', 'pearl harbor', 'new jersey', 'milwaukee', 'montgomery', 'harpers ferry', 'menlo park',
  'united air lines', 'pan am', 'fbi', 'federal reserve', 'hoover dam', 'rushmore', 'oklahoma',
  'sandy hook', 'pittsburgh', 'las vegas', 'cocoanut grove', 'tacoma', 'north carolina', 'georgia tech',
];

const WORLD = [
  'britain', 'british', 'london', 'france', 'french', 'paris', 'germany', 'german', 'nazi', 'soviet',
  'russia', 'moscow', 'china', 'chinese', 'japan', 'japanese', 'india', 'italy', 'italian', 'spain',
  'portugal', 'lisbon', 'australia', 'canada', 'canadian', 'africa', 'iran', 'iraq', 'israel', 'egypt',
  'brazil', 'cuba', 'poland', 'hungary', 'ireland', 'scotland', 'vienna', 'berlin', 'jerusalem',
  'united nations', 'europe', 'asia', 'zambia', 'kenya', 'barbados', 'philippines', 'hong kong',
  'macao', 'bucharest', 'kabul', 'chechnya', 'tunisia', 'napoleon', 'europe’s', 'esa', 'ethiopia',
  'tasmania', 'new zealand', 'peru', 'colombia', 'el salvador', 'sri lanka', 'korea', 'vietnam',
];

const SPACE =
  /\b(apollo|gemini|mariner|pioneer|voyager|skylab|surveyor|lunokhod|venera|mars|lunar|moon|orbit|orbital|orbits|satellite|rocket|spacecraft|space station|space|shenzhou|soyuz|cassini|galileo|kepler|asteroid|comet|pulsar|telescope|observatory|vanguard|falcon|dragon|orion|ariane|buran|zarya|bepicolombo|expedition 1|saturn v|astronaut|jupiter|venus|mercury|biosphere|discovery|mission|ferret|coelacanth)\b/i;
const SCIENCE_OTHER =
  /\b(x-rays?|transplant|heart|smallpox|lsd|darwin|origin of species|einstein|radium|transistor|microprocessor|chain reaction|nuclear|thermonuclear|ivf|fossil|lucy|piltdown|aids|bird flu|ether|metre|speed of light|world wide web|arpanet|computing|sms|text message|endangered species|jarvik|wright brothers|flight|aircraft|boeing|concorde|tu-144|hurricane prototype|automobile|patent|telegraph|phonograph|marconi|cinématographe|edison|electric|ozone)\b/i;
const PEOPLE =
  /\b(dies|death|born|assassinat\w*|murder\w*|killed|executed|execution|elected|crowned|marries|resigns|arrested|captured|convicted|sentenced|nobel|abdication|napoleon|lincoln|kennedy|king jr|mother teresa|einstein|edison|houdini|chaplin|mozart|beethoven|darwin|marie antoinette|mata hari|capone|ali wins|tyson|magic johnson|schwarzenegger|obama|trump|nellie bly|rosa parks|anthony|lennon|milk|saddam|thatcher|gorbachev|reagan|roosevelt|yeager|glenn|lucid|ceaușescu|hampton|blackbeard|livingstone|tutankhamun|magellan|drake|tasman|amundsen|byrd|carter|hirohito|disney|elizabeth|madoff|eichmann|dreyfus|capone|jackson|larsen|york|nobel|bouazizi|bell|engelbart|schwarzenegger|ruby|oswald|cooper|ramsey|becket|charlemagne|william the conqueror|luther|brown|garnerin|rozier|houdini)\b/i;
const PLACES =
  /\b(bridge|canal|tower|dam|observatory|cathedral|monument|statue|arch|theatre|theater|hall|palace|hotel|wall|tunnel|subway|opera house|guggenheim|chapel|earthquake|tsunami|eruption|erupts|fire|island|bay|capital|harbor|station|mountain|rushmore|alcatraz|south pole|panama|suez|lisbon|chicago|jerusalem|bethlehem|hong kong|macao|delhi|nanjing|bucharest|tasmania|new zealand|grenada|saint helena|moscow|trafalgar|el alamein|stalingrad|gettysburg|trenton|pisa|gander|lockerbie|bhopal|beirut|ottawa|mogadishu|sitka|san diego)\b/i;
const ERAS =
  /\b(war|battle|revolution|revolt|uprising|treaty|armistice|empire|empress|emperor|siege|crisis|reformation|prohibition|depression|crash|cold war|summit|independence|republic|coup|putsch|secession|abdication|partition|occupation|invasion|landings?|offensive|massacre|genocide|nazi|soviet|bolshevik|apartheid|accession|declaration|constitution|monarchy|exile|retreat|surrender|conquer\w*)\b/i;

function score(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
}

function regionOf(title: string, summary: string): 'us' | 'world' {
  // The title says where it happened more reliably than the summary does.
  const us = score(title, US) * 3 + score(summary, US);
  const world = score(title, WORLD) * 3 + score(summary, WORLD);
  return us > world ? 'us' : 'world';
}

function topicsOf(story: { title: string; type: string | null; year: number }) {
  const topics: StoryTopicName[] = [];
  const { title } = story;
  if (story.type === 'science' || SPACE.test(title) || SCIENCE_OTHER.test(title)) topics.push('science');
  if (PEOPLE.test(title)) topics.push('people');
  if (PLACES.test(title)) topics.push('places');
  if (ERAS.test(title) || story.year < 1600) topics.push('eras');
  return topics;
}

const COLLECTIONS = [
  {
    slug: 'road-to-the-moon',
    title: 'The Road to the Moon',
    description: 'From the first rockets to the last crewed landing.',
    sortOrder: 1,
    match: (title: string) =>
      /\b(apollo|gemini|mercury-atlas|lunar|moon|surveyor|lunokhod|saturn v|enos|nasa approves|skylab|outer space treaty|mariner 4|mariner 3|vanguard|before mercury)\b/i.test(title),
  },
  {
    slug: 'fires-that-changed-cities',
    title: 'Fires That Changed Cities',
    description: 'Blazes that rewrote building codes and skylines.',
    sortOrder: 2,
    match: (title: string) => /\b(fire)\b/i.test(title) && !/\b(cease|fire\b.*treaty)/i.test(title),
  },
  {
    slug: 'the-age-of-invention',
    title: 'The Age of Invention',
    description: 'The machines, signals and ideas that rebuilt everyday life.',
    sortOrder: 3,
    match: (title: string) =>
      /\b(edison|wright brothers|patent|transistor|microprocessor|marconi|x-rays?|lumière|phonograph|telegraph|electric lighting|world wide web|arpanet|ipod|text message|windows|pong|jarvik|engelbart|time zones|automobile|first flights?|radio|television|crossword|ether day)\b/i.test(title),
  },
];

async function main() {
  const stories = await prisma.story.findMany({
    where: { status: 'published' },
    orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true, slug: true, title: true, summary: true, type: true, region: true, eventDate: true,
      isPhotoStory: true, topics: { select: { topic: true } },
    },
  });

  const regionCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  const regionWrites: { id: number; region: 'us' | 'world' }[] = [];
  const topicWrites: { storyId: number; topic: string }[] = [];

  for (const story of stories) {
    if (!story.region) {
      const region = regionOf(story.title, story.summary);
      regionWrites.push({ id: story.id, region });
      regionCounts[region] = (regionCounts[region] ?? 0) + 1;
    }
    if (story.topics.length === 0) {
      for (const topic of topicsOf({ title: story.title, type: story.type, year: story.eventDate.getUTCFullYear() })) {
        topicWrites.push({ storyId: story.id, topic });
        topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
      }
    }
  }

  console.log(apply ? 'APPLYING' : 'DRY RUN', `- ${stories.length} published stories`);
  console.log('region:', regionCounts);
  console.log('topics:', topicCounts, `(${STORY_TOPICS.join(', ')})`);

  const collectionPlans = COLLECTIONS.map((c) => ({
    ...c,
    stories: stories.filter((s) => c.match(s.title)).map((s) => s.slug),
  }));
  for (const c of collectionPlans) console.log(`collection ${c.slug}: ${c.stories.length} stories`);

  const hasPhoto = stories.some((s) => s.isPhotoStory);
  const photo = stories.find((s) => s.slug === PHOTO_STORY_SLUG);
  console.log('photo story:', hasPhoto ? 'already set' : photo ? PHOTO_STORY_SLUG : 'candidate not found');

  if (process.argv.includes('--sample')) {
    const take = (n: number) => stories.filter((_, i) => i % Math.floor(stories.length / n) === 0).slice(0, n);
    for (const s of take(40)) {
      const t = topicsOf({ title: s.title, type: s.type, year: s.eventDate.getUTCFullYear() });
      console.log(`${regionOf(s.title, s.summary).padEnd(5)} ${t.join(',').padEnd(26)} ${s.title}`);
    }
  }

  if (!apply) return;

  for (const group of ['us', 'world'] as const) {
    const ids = regionWrites.filter((w) => w.region === group).map((w) => w.id);
    if (ids.length) await prisma.story.updateMany({ where: { id: { in: ids } }, data: { region: group } });
  }
  if (topicWrites.length) await prisma.storyTopic.createMany({ data: topicWrites, skipDuplicates: true });

  if (!hasPhoto && photo) await prisma.story.update({ where: { id: photo.id }, data: { isPhotoStory: true } });

  const idBySlug = new Map(stories.map((s) => [s.slug, s.id]));
  for (const c of collectionPlans) {
    if (await prisma.collection.findUnique({ where: { slug: c.slug }, select: { id: true } })) {
      console.log(`collection ${c.slug} exists, left alone`);
      continue;
    }
    await prisma.collection.create({
      data: {
        slug: c.slug, title: c.title, description: c.description, status: 'published', sortOrder: c.sortOrder,
        stories: { create: c.stories.map((slug, index) => ({ storyId: idBySlug.get(slug) as number, sortOrder: index })) },
      },
    });
  }
  console.log('done');
}

main().finally(() => prisma.$disconnect());
