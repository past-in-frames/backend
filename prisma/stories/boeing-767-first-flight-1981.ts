export const boeing767FirstFlight1981 = {
  slug: 'boeing-767-first-flight-1981',
  title: 'The Boeing 767 Takes Flight for the First Time',
  // Noon UTC keeps the DATE column on 1981-09-26 across ordinary server time zones.
  eventDate: new Date('1981-09-26T12:00:00.000Z'),
  category: 'Aviation',
  type: null,
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 26, 1981, the Boeing 767-200 made its first flight. The twin-engine widebody would later become an important aircraft for long-distance travel.',
  body: [
    {
      type: 'paragraph',
      text: "On September 26, 1981, the Boeing 767-200 made its first flight. Built as a twin-engine widebody passenger jet, it began a new chapter in Boeing's aircraft program.",
    },
    {
      type: 'image',
      mediaKey: 'boeing-767-first-flight',
    },
    {
      type: 'heading',
      text: 'An aircraft built for a changing industry',
    },
    {
      type: 'paragraph',
      text: 'The 767 combined a wide passenger cabin with two engines. Its first flight was a test of a new aircraft, not the start of passenger service: flight testing and certification still lay ahead.',
    },
    {
      type: 'image',
      mediaKey: 'boeing-767-aircraft',
    },
    {
      type: 'heading',
      text: 'From test flight to airline service',
    },
    {
      type: 'paragraph',
      text: 'The 767 entered airline service in 1982. Over the following years, the aircraft became associated with longer routes. In 1985, the 767 received approval for extended twin-engine operations that helped open regular transatlantic routes to twin-engine jets.',
    },
    {
      type: 'image',
      mediaKey: 'boeing-767-in-flight',
    },
    {
      type: 'heading',
      text: 'Why September 26 matters',
    },
    {
      type: 'paragraph',
      text: 'Every new aircraft has a moment when its design leaves the ground for the first time. For the Boeing 767, that moment came on September 26, 1981.',
    },
  ],
  sources: [
    {
      title: 'Boeing Products: 767 Commercial Transport',
      publisher: 'Boeing',
      url: 'https://www.boeing.com/content/dam/boeing/boeingdotcom/history/pdf/Boeing_Products.pdf',
    },
    {
      title: 'Boeing Chronology',
      publisher: 'Boeing',
      url: 'https://www.boeing.com/content/dam/boeing/boeingdotcom/history/pdf/Boeing-Chronology.pdf',
    },
    {
      title: 'FAA: Boeing 767 History',
      publisher: 'FAA',
      url: 'https://www.faa.gov/lessons_learned/transport_airplane/accidents/OE-LAV',
    },
  ],
  /**
   * url stays null until a real address exists. Do not invent S3, CloudFront,
   * or image links. Matching is by story plus key, so a second run updates
   * that item instead of inserting another.
   */
  media: [
    {
      key: 'boeing-767-first-flight',
      type: 'image' as const,
      url: null,
      caption: 'The Boeing 767-200 made its first flight on September 26, 1981.',
      altText: 'Boeing 767-200 during an early flight',
      credit: '[Add photographer or rights holder after selecting an image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
    {
      key: 'boeing-767-aircraft',
      type: 'image' as const,
      url: null,
      caption: 'The 767 was designed as a twin-engine widebody aircraft.',
      altText: 'Boeing 767 aircraft showing its two engines and wide body',
      credit: '[Add photographer or rights holder]',
      isAiGenerated: false,
      sortOrder: 1,
    },
    {
      key: 'boeing-767-in-flight',
      type: 'image' as const,
      url: null,
      caption: 'The 767 entered airline service in 1982.',
      altText: 'Boeing 767 flying above the clouds',
      credit: '[Add photographer or rights holder]',
      isAiGenerated: false,
      sortOrder: 2,
    },
  ],
};
