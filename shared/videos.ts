/* All nine URLs from the brief were checked against YouTube's public oEmbed
   endpoint before being seeded. Titles/channels/thumbnails below are the REAL
   values returned. oEmbed does NOT return duration, so durationSeconds is null
   for every resource — no duration has been invented.
   No independent English .vtt track exists for any of these videos yet, so
   every one is explicitly marked "Subtitles not supplied" until ACECODES
   uploads and checks a caption file. */

export interface SeedVideo {
  key: string;
  url: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  lessonSlugs: string[];   // attached to these lessons, not presented as one long lesson
  note: string;
}

export const SEED_VIDEOS: SeedVideo[] = [
  {
    key: 'html-css-fcc', url: 'https://www.youtube.com/watch?v=a_iQb1lnAEQ', videoId: 'a_iQb1lnAEQ',
    title: 'Learn HTML & CSS – Full Course for Beginners', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/a_iQb1lnAEQ/hqdefault.jpg',
    lessonSlugs: ['s1-l1', 's1-l3', 's2-l1', 's2-l4'],
    note: 'Split across four short lessons: HTML structure, links/images, CSS rules, and layout. This is a long course; each lesson points at a different concept, not the whole video.',
  },
  {
    key: 'html-fcc', url: 'https://www.youtube.com/watch?v=kUMe1FH4CHE', videoId: 'kUMe1FH4CHE',
    title: 'Learn HTML – Full Tutorial for Beginners', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/kUMe1FH4CHE/hqdefault.jpg',
    lessonSlugs: ['s1-l2', 's1-l4', 's1-l5'],
    note: 'Used as supporting material for attributes/nesting, forms and semantics.',
  },
  {
    key: 'css-fcc', url: 'https://www.youtube.com/watch?v=OXGznpKZ_sA', videoId: 'OXGznpKZ_sA',
    title: 'CSS Tutorial – Full Course for Beginners', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/OXGznpKZ_sA/hqdefault.jpg',
    lessonSlugs: ['s2-l2', 's2-l3', 's2-l5', 's2-l6'],
    note: 'Supporting material for colour/type, the box model, responsive design and variables.',
  },
  {
    key: 'js-fcc', url: 'https://www.youtube.com/watch?v=jS4aFq5-91M', videoId: 'jS4aFq5-91M',
    title: 'JavaScript Programming - Full Course', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/jS4aFq5-91M/hqdefault.jpg',
    lessonSlugs: ['s3-l1', 's3-l3', 's3-l5', 's4-l1'],
    note: 'Divided into the JavaScript fundamentals lessons and the first DOM lesson.',
  },
  {
    key: 'git-github', url: 'https://www.youtube.com/watch?v=r8jQ9hVA2qs', videoId: 'r8jQ9hVA2qs',
    title: 'A brief introduction to Git for beginners | GitHub', channel: 'GitHub',
    thumbnailUrl: 'https://i.ytimg.com/vi/r8jQ9hVA2qs/hqdefault.jpg',
    lessonSlugs: ['s5-l1', 's5-l2'],
    note: 'Introductory overview used alongside the hands-on commits and branches lessons.',
  },
  {
    key: 'react-fcc', url: 'https://www.youtube.com/watch?v=x4rFhThSX04', videoId: 'x4rFhThSX04',
    title: "Learn React JS - Full Beginner’s Tutorial & Practice Projects", channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/x4rFhThSX04/hqdefault.jpg',
    lessonSlugs: ['s6-l1', 's6-l2', 's6-l3', 's6-l5'],
    note: 'Divided across components, state, lists/forms and routing/data lessons.',
  },
  {
    key: 'backend-fcc', url: 'https://www.youtube.com/watch?v=KOutPbKc9UM', videoId: 'KOutPbKc9UM',
    title: 'Intro to Backend Web Development – Node.js & Express Tutorial for Beginners', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/KOutPbKc9UM/hqdefault.jpg',
    lessonSlugs: ['s8-l1', 's8-l2', 's8-l3'],
    note: 'IMPORTANT: this tutorial demonstrates MongoDB for database work. In DANIELLACODES it is used only for backend/Express concepts; PostgreSQL and SQL are taught separately in Session 9.',
  },
  {
    key: 'sql-fcc', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', videoId: 'HXV3zeQKqGY',
    title: 'SQL Tutorial - Full Database Course for Beginners', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/HXV3zeQKqGY/hqdefault.jpg',
    lessonSlugs: ['s9-l1', 's9-l3', 's9-l5', 's9-l6'],
    note: 'Supporting material for tables/keys, SELECT/WHERE, joins/aggregation and PostgreSQL.',
  },
  {
    key: 'typescript-fcc', url: 'https://www.youtube.com/watch?v=SpwzRDUQ1GI', videoId: 'SpwzRDUQ1GI',
    title: 'Learn TypeScript - Full Course for Beginners', channel: 'freeCodeCamp.org',
    thumbnailUrl: 'https://i.ytimg.com/vi/SpwzRDUQ1GI/hqdefault.jpg',
    lessonSlugs: ['s13-l2'],
    note: 'Optional extension resource for the capstone planning lesson. Not part of the core required path.',
  },
];
