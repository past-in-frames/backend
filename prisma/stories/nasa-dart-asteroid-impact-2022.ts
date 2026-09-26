export const nasaDartAsteroidImpact2022 = {
  slug: 'nasa-dart-asteroid-impact-2022',
  title: 'NASA’s DART Mission: The Day Humanity Changed an Asteroid’s Orbit',
  // Noon UTC keeps the DATE column on 2022-09-26 across ordinary server time zones.
  eventDate: new Date('2022-09-26T12:00:00.000Z'),
  category: 'Space Exploration',
  type: null,
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 26, 2022, NASA deliberately crashed the DART spacecraft into Dimorphos. The impact tested whether a spacecraft could change an asteroid’s motion.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 26, 2022, NASA’s DART spacecraft deliberately flew into Dimorphos, a small asteroid orbiting a larger asteroid called Didymos. The collision was the first test of a planetary defense technique known as kinetic impact: striking an asteroid with a spacecraft to change its motion.',
    },
    {
      type: 'image',
      mediaKey: 'dart-approaching-dimorphos',
    },
    {
      type: 'heading',
      text: 'Why hit an asteroid?',
    },
    {
      type: 'paragraph',
      text: 'Dimorphos was not on a collision course with Earth. NASA chose it as a test target because astronomers could measure how long it took to orbit Didymos before and after the impact. The question was whether a small change made deliberately, with enough warning, could become a useful tool for planetary defense.',
    },
    {
      type: 'image',
      mediaKey: 'didymos-dimorphos-diagram',
    },
    {
      type: 'heading',
      text: 'The spacecraft’s final seconds',
    },
    {
      type: 'paragraph',
      text: 'As DART closed in, its onboard camera sent images of Dimorphos back to Earth. The asteroid grew larger in each frame. The last complete image was captured about two seconds before the spacecraft struck its surface.',
    },
    {
      type: 'image',
      mediaKey: 'dart-final-image',
    },
    {
      type: 'heading',
      text: 'Did the test work?',
    },
    {
      type: 'paragraph',
      text: 'Yes. Before the impact, Dimorphos took about 11 hours and 55 minutes to orbit Didymos. Measurements after the collision put its orbital period at about 11 hours and 23 minutes: roughly 32 minutes shorter. The result showed that a spacecraft impact can measurably alter an asteroid’s motion.',
    },
    {
      type: 'image',
      mediaKey: 'dart-impact-debris',
    },
    {
      type: 'heading',
      text: 'Why September 26 matters',
    },
    {
      type: 'paragraph',
      text: 'DART did not stop an asteroid that was heading for Earth. It tested a method that could help protect Earth if a hazardous asteroid were discovered far enough in advance. On September 26, 2022, that idea moved from planning to a successful experiment in space.',
    },
  ],
  sources: [
    {
      title: 'DART Mission — NASA Science',
      publisher: 'NASA Science',
      url: 'https://science.nasa.gov/mission/dart/',
    },
    {
      title: 'NASA Confirms DART Mission Impact Changed Asteroid’s Motion in Space',
      publisher: 'NASA',
      url: 'https://www.nasa.gov/news-release/nasa-confirms-dart-mission-impact-changed-asteroids-motion-in-space/',
    },
    {
      title: 'DART’s Final Images Prior to Impact — NASA',
      publisher: 'NASA',
      url: 'https://www.nasa.gov/solar-system/darts-final-images-prior-to-impact/',
    },
  ],
  /**
   * url stays null until a real address exists. Do not invent S3, CloudFront,
   * or image links. Matching is by story plus key, so a second run updates
   * that item instead of inserting another.
   */
  media: [
    {
      key: 'dart-approaching-dimorphos',
      type: 'image' as const,
      url: null,
      caption: 'DART was sent to strike Dimorphos in a planetary defense test.',
      altText: 'Illustration of NASA’s DART spacecraft approaching Dimorphos',
      credit: '[Add credit for the selected image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
    {
      key: 'didymos-dimorphos-diagram',
      type: 'image' as const,
      url: null,
      caption: 'Astronomers measured the time Dimorphos took to orbit Didymos.',
      altText: 'Diagram showing Dimorphos orbiting the larger asteroid Didymos',
      credit: '[Add credit for the selected diagram]',
      isAiGenerated: false,
      sortOrder: 1,
    },
    {
      key: 'dart-final-image',
      type: 'image' as const,
      url: null,
      caption: 'DART captured this view of Dimorphos about two seconds before impact.',
      altText: 'DART spacecraft’s final complete image of Dimorphos before impact',
      credit: 'NASA/Johns Hopkins APL',
      isAiGenerated: false,
      sortOrder: 2,
    },
    {
      key: 'dart-impact-debris',
      type: 'image' as const,
      url: null,
      caption: 'The collision sent dust and rocky material into space.',
      altText: 'Dust and debris around Dimorphos after the DART impact',
      credit: '[Add credit for the selected image]',
      isAiGenerated: false,
      sortOrder: 3,
    },
  ],
};
