export const biosphere2FirstMission1991 = {
  slug: 'biosphere-2-first-mission-1991',
  title: 'Eight People Entered Biosphere 2',
  // Noon UTC keeps the DATE column on 1991-09-26 across ordinary server time zones.
  eventDate: new Date('1991-09-26T12:00:00.000Z'),
  category: 'Science',
  type: null,
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 26, 1991, eight participants began a two-year experiment inside the enclosed Biosphere 2 facility in Arizona.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 26, 1991, eight people entered Biosphere 2 in Arizona for a planned two-year stay. Inside the glass-enclosed facility, they would live and work as part of an experiment involving interconnected ecosystems.',
    },
    {
      type: 'image',
      mediaKey: 'biosphere-2-exterior',
    },
    {
      type: 'heading',
      text: 'A world inside glass',
    },
    {
      type: 'paragraph',
      text: 'Biosphere 2 was designed to help researchers examine how people and living systems function within an enclosed environment. Its first mission turned that idea into a demanding, long-duration experiment.',
    },
    {
      type: 'heading',
      text: 'Why it matters',
    },
    {
      type: 'paragraph',
      text: 'The experiment drew attention to the connections between people, air, water, food and ecosystems. It also exposed how difficult those relationships are to reproduce and manage.',
    },
  ],
  sources: [
    {
      title: 'About Biosphere 2: Purpose and Evolution',
      publisher: 'Biosphere 2',
      url: 'https://biosphere2.org/about/about-biosphere-2',
    },
    {
      title: 'Biosphere 2 historical article',
      publisher: 'Biosphere 2',
      url: 'https://biosphere2.org/sites/default/files/2021-08/B21216_Press_02_Discover02lo.pdf',
    },
  ],
  media: [
    {
      key: 'biosphere-2-exterior',
      type: 'image' as const,
      url: null,
      caption: 'The first Biosphere 2 crew began its mission in September 1991.',
      altText: 'Exterior of the Biosphere 2 glass-enclosed research facility in Arizona',
      credit: '[Add credit after selecting an image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
  ],
};
