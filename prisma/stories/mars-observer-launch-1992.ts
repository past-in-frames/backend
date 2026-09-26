export const marsObserverLaunch1992 = {
  slug: 'mars-observer-launch-1992',
  title: 'Mars Observer: The Mission That Went Silent Before Mars',
  // Noon UTC keeps the DATE column on 1992-09-25 across ordinary server time zones.
  eventDate: new Date('1992-09-25T12:00:00.000Z'),
  category: 'Space Exploration',
  type: 'science',
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 25, 1992, NASA launched Mars Observer to study the Red Planet. Nearly 11 months later, contact was lost just before the spacecraft could enter Mars orbit.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 25, 1992, NASA launched Mars Observer from Cape Canaveral, Florida. Designed to orbit Mars, the spacecraft carried instruments to photograph the planet and study its environment. It was the first U.S. mission to Mars in 17 years.',
    },
    {
      type: 'image',
      mediaKey: 'mars-observer-illustration',
    },
    {
      type: 'heading',
      text: 'A new look at the Red Planet',
    },
    {
      type: 'paragraph',
      text: 'Mars Observer was built to study Mars from orbit. Its instruments included a camera, a laser altimeter, and equipment for examining the planet’s temperature and magnetic environment.',
    },
    {
      type: 'image',
      mediaKey: 'mars-observer-instruments',
    },
    {
      type: 'heading',
      text: 'The signal that never returned',
    },
    {
      type: 'paragraph',
      text: 'On August 21, 1993, as the spacecraft approached Mars, its transmitter was switched off as a precaution during preparations for orbit insertion. Controllers expected the signal to return, but it never did. Mars Observer was lost before it could begin its planned survey.',
    },
    {
      type: 'image',
      mediaKey: 'mars-from-space',
    },
    {
      type: 'heading',
      text: 'What happened?',
    },
    {
      type: 'paragraph',
      text: 'Investigators examined several possible causes, including failures in the propulsion, electrical, computer, and transmitter systems. Because the spacecraft was not transmitting when the failure occurred, they could not determine a definitive cause.',
    },
    {
      type: 'heading',
      text: 'Why September 25 matters',
    },
    {
      type: 'paragraph',
      text: 'September 25 marks the launch of an ambitious mission. Its loss nearly a year later, just before arrival at Mars, is an important part of the same story.',
    },
  ],
  sources: [
    {
      title: 'Mars Observer — NASA Science',
      publisher: 'NASA Science',
      url: 'https://science.nasa.gov/mission/mars-observer/',
    },
    {
      title: 'Mars Observer — NASA JPL',
      publisher: 'NASA JPL',
      url: 'https://www.jpl.nasa.gov/missions/mars-observer/',
    },
    {
      title: 'Potential Causes of the Loss of Mars Observer Identified — NASA JPL',
      publisher: 'NASA JPL',
      url: 'https://www.jpl.nasa.gov/news/potential-causes-of-the-loss-of-mars-observer-identified/',
    },
  ],
  media: [
    {
      key: 'mars-observer-illustration',
      type: 'image' as const,
      url: null,
      caption: 'Mars Observer spacecraft. Credit: NASA.',
      altText: 'NASA illustration of the Mars Observer spacecraft',
      credit: null,
      isAiGenerated: false,
      sortOrder: 0,
    },
    {
      key: 'mars-observer-instruments',
      type: 'image' as const,
      url: null,
      caption: 'The spacecraft carried instruments designed to study Mars from orbit.',
      altText: 'Diagram showing the scientific instruments aboard Mars Observer',
      credit: null,
      isAiGenerated: false,
      sortOrder: 1,
    },
    {
      key: 'mars-from-space',
      type: 'image' as const,
      url: null,
      caption: 'Contact was lost before Mars Observer entered orbit.',
      altText: 'Mars viewed from space',
      credit: null,
      isAiGenerated: false,
      sortOrder: 2,
    },
  ],
};
