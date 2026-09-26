type StoryBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2; text: string }
  | { type: 'image'; mediaKey: string };

export const skylab3Return1973 = {
  slug: 'skylab-3-return-1973',
  title: 'Skylab 3: The 59-Day Journey That Changed Spaceflight',
  // Noon UTC keeps the DATE column on 1973-09-25 across ordinary server time zones.
  eventDate: new Date('1973-09-25T12:00:00.000Z'),
  category: 'space',
  type: 'science',
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 25, 1973, the Skylab 3 crew returned to Earth after 59 days and 11 hours in space.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 25, 1973, three astronauts returned to Earth after spending 59 days and 11 hours in space. Their Apollo command module splashed down in the Pacific Ocean, about 230 miles southwest of San Diego. Waiting to recover them was the USS New Orleans.',
    },
    {
      type: 'paragraph',
      text: 'The crew — commander Alan Bean, science pilot Owen Garriott, and pilot Jack Lousma — had completed the longest human spaceflight in history up to that point.',
    },
    {
      type: 'image',
      mediaKey: 'crew-recovery',
    },
    {
      type: 'heading',
      level: 2,
      text: 'A home and laboratory above Earth',
    },
    {
      type: 'paragraph',
      text: 'The astronauts launched from Kennedy Space Center on July 28, 1973, and docked with Skylab about eight hours later. Skylab was America\'s first space station: a place where crews could live and work in orbit for weeks while studying the Sun, observing Earth, and investigating how the human body responds to life in space.',
    },
    {
      type: 'paragraph',
      text: 'The first days were difficult. The crew experienced space motion sickness, then settled into their work. They conducted scientific experiments, maintained the station, and prepared for spacewalks outside it.',
    },
    {
      type: 'image',
      mediaKey: 'skylab-earth',
    },
    {
      type: 'heading',
      level: 2,
      text: 'Science, repairs, and life in orbit',
    },
    {
      type: 'paragraph',
      text: 'During their mission, the astronauts observed the Sun and Earth and carried out medical studies of long-duration spaceflight. Researchers investigated how living in orbit affected the crew\'s cardiovascular system, movement, muscles, nutrition, and physical condition.',
    },
    {
      type: 'paragraph',
      text: 'During a spacewalk on August 6, Garriott and Lousma installed an additional sunshade to help cool Skylab and replaced film canisters in its solar telescope equipment. The crew completed three spacewalks during the mission.',
    },
    {
      type: 'image',
      mediaKey: 'bean-spacewalk',
    },
    {
      type: 'paragraph',
      text: 'The crew became so efficient that they completed about 300 more hours of research than originally planned. Their work helped NASA learn what people could accomplish during longer stays in space.',
    },
    {
      type: 'heading',
      level: 2,
      text: 'The return to Earth',
    },
    {
      type: 'paragraph',
      text: 'After 59 days and 11 hours, the crew left Skylab and headed home in their command module. It splashed down in the Pacific on September 25, 1973, and the astronauts were recovered by the USS New Orleans.',
    },
    {
      type: 'paragraph',
      text: 'Their flight more than doubled the previous 28-day record set by the first Skylab crew. It showed that astronauts could return from a much longer mission in good physical condition when exercise, nutrition, and medical monitoring were carefully planned.',
    },
    {
      type: 'paragraph',
      text: 'Skylab 3 was a milestone in learning how to live and work beyond Earth. The record would eventually be broken, but the mission returned valuable knowledge about the possibilities of human spaceflight.',
    },
  ] satisfies StoryBlock[],
  sources: [
    {
      title: 'Skylab 3: A Record 59 Days in Space',
      publisher: 'NASA',
      url: 'https://www.nasa.gov/history/skylab-3-a-record-59-days-in-space/',
    },
    {
      title: 'Skylab 3',
      publisher: 'NASA',
      url: 'https://www.nasa.gov/mission/skylab-3/',
    },
  ],
  /**
   * url stays null until a real address exists. Do not invent S3, CloudFront,
   * Reel, or image links. Matching is by story plus key, so a second run
   * updates that item instead of inserting another.
   * Put the reel first (sortOrder 0) and archival photographs after it.
   * Set isAiGenerated true only for the AI reel, and false for NASA photographs.
   */
  media: [
    {
      key: 'crew-recovery',
      type: 'image' as const,
      url: null,
      caption:
        'Jack Lousma, Owen Garriott, and Alan Bean aboard the USS New Orleans on September 25, 1973.',
      altText: 'The three Skylab 3 astronauts aboard their recovery ship',
      credit: 'NASA',
      isAiGenerated: false,
      sortOrder: 0,
    },
  ],
};
