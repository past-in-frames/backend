export const discoverySts48Returns1991 = {
  slug: 'discovery-sts-48-returns-1991',
  title: 'Discovery Returns from an Atmospheric Research Mission',
  // Noon UTC keeps the DATE column on 1991-09-26 across ordinary server time zones.
  eventDate: new Date('1991-09-26T12:00:00.000Z'),
  category: 'Space Exploration',
  type: null,
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 26, 1991, space shuttle Discovery returned to Kennedy Space Center after the STS-48 mission.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 26, 1991, the space shuttle Discovery returned to Kennedy Space Center, bringing the STS-48 mission to an end.',
    },
    {
      type: 'image',
      mediaKey: 'discovery-sts-48',
    },
    {
      type: 'heading',
      text: "Studying Earth's atmosphere",
    },
    {
      type: 'paragraph',
      text: "During the mission, Discovery deployed the Upper Atmosphere Research Satellite. The observatory was designed to investigate Earth's upper atmosphere, including the protective ozone layer.",
    },
    {
      type: 'heading',
      text: 'Why it matters',
    },
    {
      type: 'paragraph',
      text: 'STS-48 connected human spaceflight with research about our own planet. The shuttle delivered a scientific observatory to orbit and then returned its crew to Earth.',
    },
  ],
  sources: [
    {
      title: 'STS-48 — NASA',
      publisher: 'NASA',
      url: 'https://www.nasa.gov/mission/sts-48/',
    },
  ],
  media: [
    {
      key: 'discovery-sts-48',
      type: 'image' as const,
      url: null,
      caption: 'Discovery returned to Kennedy Space Center on September 26, 1991.',
      altText: 'Space shuttle Discovery during the STS-48 mission',
      credit: '[Add credit after selecting an image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
  ],
};
