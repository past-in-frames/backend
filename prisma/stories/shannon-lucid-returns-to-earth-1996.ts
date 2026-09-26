export const shannonLucidReturnsToEarth1996 = {
  slug: 'shannon-lucid-returns-to-earth-1996',
  title: 'Shannon Lucid Returns After 188 Days in Space',
  // Noon UTC keeps the DATE column on 1996-09-26 across ordinary server time zones.
  eventDate: new Date('1996-09-26T12:00:00.000Z'),
  category: 'Space Exploration',
  type: null,
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 26, 1996, astronaut Shannon Lucid returned to Earth aboard Atlantis after spending 188 days in space, most of them aboard the Mir station.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 26, 1996, astronaut Shannon Lucid returned to Earth aboard space shuttle Atlantis. She had spent 188 days in space, including a long stay aboard the Russian space station Mir.',
    },
    {
      type: 'image',
      mediaKey: 'atlantis-sts-79-landing',
    },
    {
      type: 'heading',
      text: 'An extended stay aboard Mir',
    },
    {
      type: 'paragraph',
      text: "Lucid's return was delayed while NASA prepared the shuttle mission that would bring her home. By the time Atlantis landed, her stay had set a U.S. spaceflight-duration record and a world record for a woman at that time.",
    },
    {
      type: 'heading',
      text: 'Why September 26 matters',
    },
    {
      type: 'paragraph',
      text: 'Her return marked the end of an extraordinary mission and demonstrated what a long stay in orbit could involve for an astronaut and the teams supporting her on Earth.',
    },
  ],
  sources: [
    {
      title: 'STS-79 — NASA',
      publisher: 'NASA',
      url: 'https://www.nasa.gov/mission/sts-79/',
    },
    {
      title: 'STS-79: First American Handover — NASA History',
      publisher: 'NASA History',
      url: 'https://www.nasa.gov/history/SP-4225/sts79/sts-79.htm',
    },
  ],
  media: [
    {
      key: 'atlantis-sts-79-landing',
      type: 'image' as const,
      url: null,
      caption: 'Atlantis returned Shannon Lucid to Earth on September 26, 1996.',
      altText: 'Space shuttle Atlantis landing after mission STS-79',
      credit: '[Add credit for the selected NASA image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
  ],
};
