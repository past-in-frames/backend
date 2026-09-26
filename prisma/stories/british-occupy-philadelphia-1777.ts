export const britishOccupyPhiladelphia1777 = {
  slug: 'british-occupy-philadelphia-1777',
  title: 'When British Troops Occupied Philadelphia',
  // Noon UTC keeps the DATE column on 1777-09-26 across ordinary server time zones.
  eventDate: new Date('1777-09-26T12:00:00.000Z'),
  category: 'History',
  type: null,
  subtype: null,
  status: 'draft' as const,
  publishedAt: null,
  summary:
    'On September 26, 1777, British troops entered Philadelphia during the American Revolutionary War.',
  body: [
    {
      type: 'paragraph',
      text: 'On September 26, 1777, British troops marched into Philadelphia. The city had been the meeting place of the Continental Congress and the setting for the Declaration of Independence just a year earlier.',
    },
    {
      type: 'image',
      mediaKey: 'philadelphia-1777',
    },
    {
      type: 'heading',
      text: 'A city at the center of the Revolution',
    },
    {
      type: 'paragraph',
      text: 'Philadelphia held enormous political importance to the American cause. As the British advanced, the Continental Congress left the city and continued its work elsewhere.',
    },
    {
      type: 'heading',
      text: 'What happened next?',
    },
    {
      type: 'paragraph',
      text: "The occupation did not end the war. George Washington's army continued its campaign, while Philadelphia remained under British control until the following year.",
    },
  ],
  sources: [
    {
      title: 'Today in History: September 26 — Library of Congress',
      publisher: 'Library of Congress',
      url: 'https://www.loc.gov/item/today-in-history/september-26/',
    },
    {
      title: 'The Philadelphia Campaign of 1777 — National Park Service',
      publisher: 'National Park Service',
      url: 'https://www.nps.gov/articles/000/philadelphia-campaign-1777.htm',
    },
  ],
  media: [
    {
      key: 'philadelphia-1777',
      type: 'image' as const,
      url: null,
      caption: 'British forces occupied Philadelphia on September 26, 1777.',
      altText: 'Historical depiction or map of Philadelphia in 1777',
      credit: '[Add credit after selecting an image]',
      isAiGenerated: false,
      sortOrder: 0,
    },
  ],
};
