export const blackFootedFerretRediscovery1981 = {
  slug: 'black-footed-ferret-rediscovery-1981',
  title: 'The Ferret Thought Lost to the Wild',
  // Noon UTC keeps the DATE column on 1981-09-26 across ordinary server time zones.
  eventDate: new Date('1981-09-26T12:00:00.000Z'),
  category: 'Nature',
  type: null,
  subtype: null,
  // Verify the exact discovery date before publishing this as a September 26 story.
  // Smithsonian materials give both September 24 and September 26. Stored as draft
  // because StoryStatus has no needs_review value and no editorial-note column.
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'In September 1981, the discovery of black-footed ferrets near Meeteetse, Wyoming, gave conservationists a chance to help a species thought to have disappeared from the wild.',
  body: [
    {
      type: 'paragraph',
      text: 'In September 1981, a small population of black-footed ferrets was discovered near Meeteetse, Wyoming. The species had been thought to have disappeared from the wild.',
    },
    {
      type: 'image',
      mediaKey: 'black-footed-ferret',
    },
    {
      type: 'heading',
      text: 'A second chance',
    },
    {
      type: 'paragraph',
      text: 'Finding living ferrets gave conservationists an opportunity to study and protect the remaining population. The discovery became a turning point in efforts to recover the species.',
    },
  ],
  sources: [
    {
      title: 'Black-Footed Ferrets: Top Milestones — Smithsonian National Zoo',
      publisher: 'Smithsonian National Zoo',
      url: 'https://nationalzoo.si.edu/animals/news/black-footed-ferrets-top-milestones-species-once-presumed-extinct',
    },
    {
      title: 'Black-Footed Ferret Kits Receive Names — Smithsonian National Zoo',
      publisher: 'Smithsonian National Zoo',
      url: 'https://nationalzoo.si.edu/news/black-footed-ferret-kits-receive-names-smithsonian-conservation-biology-institute',
    },
  ],
  media: [
    {
      key: 'black-footed-ferret',
      type: 'image' as const,
      url: null,
      caption: 'A surviving wild population was found in Wyoming in 1981.',
      altText: 'Black-footed ferret standing in prairie habitat',
      credit: '[Add credit after selecting an image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
  ],
};
