// Everything written on the profile lives here.
// Run `node scripts/build.mjs` after editing; it rewrites README.md and assets/.
// Everything the build fetches comes from `accounts` below.

export default {
  user: 'Sablerite',

  // Activity and language data come from these accounts only.
  accounts: ['Sablerite'],
  // Repositories left out of the language spectrum and growth zoning.
  exclude: ['Sablerite/Sablerite'],

  hero: {
    pronunciation: '\\ ˈsā-bəl-ˌrīt \\',
    partOfSpeech: 'noun',
    senses: [
      'A dark crystal that grows slowly, one facet at a time. Found in Rust and C++, in microcontroller firmware, and in the occasional captive portal.',
      'A handle on the internet. Builds things mostly to find out how they work.',
    ],
    caption: 'Fig. 1. The specimen, turning slowly in the light.',
    crystal: { seed: 23, sides: 6 },
  },

  intro:
    'Rust, C++, and firmware for small boards. I build things to find out how they work, and keep the ones that teach me something.',

  specimen: {
    fields: [
      { label: 'Formula', formula: '(C++)_3 Rs_2 · nC_8H_10N_4O_2', note: 'n is the number of coffees. It varies.' },
      { label: 'Crystal system', value: 'Hexagonal, still growing. Faces so far: systems, firmware and tooling.' },
      { label: 'Habit', value: 'Small, sharp projects: a captive portal on an ESP32, a Rust and C++ workspace kept honest by CI.' },
      { label: 'Hardness', value: '7. Harder than a segfault, softer than the borrow checker.' },
      { label: 'Luster', value: 'Vitreous. Brightest around 3 a.m.' },
      { label: 'Cleavage', value: 'Perfect, along the plane between “one more build” and sleep.' },
      { label: 'Associated with', value: 'Rust, C++, CMake, PlatformIO, ESP32-S3, GitHub Actions.' },
      { label: 'Locality', value: 'Undisclosed.', emphasis: true },
    ],
    // Optional notes for growth bands, keyed by year ("2027") or month ("2026-07").
    zoneNotes: {
      '2026-07': 'first specimens: Rust and C++',
      '2026-08': 'firmware for an ESP32-S3',
    },
  },

  // Cards in "In the collection". `seed` shapes each card's crystal.
  collection: [
    {
      repo: 'Sablerite/ESP32-WIFI-BROADCAST',
      title: 'ESP32 Wi-Fi Broadcast',
      stack: 'C++, ESP32-S3, PlatformIO',
      blurb: 'A Wi-Fi network that looks too good to be true. Join it and a captive portal takes you to a custom page. Built to Rickroll people.',
      tint: '#e7b54a',
      seed: 505,
    },
    {
      repo: 'Sablerite/magicule',
      title: 'magicule',
      stack: 'Rust, C++, CMake, GitHub Actions',
      blurb: 'A Rust library and a C++ core in one workspace, with tests, benches, examples and CI keeping both honest.',
      tint: '#3fd0b8',
      seed: 707,
    },
  ],

  // Smaller pieces, written as one sentence under the cards.
  drawer: [],

  links: [{ label: '@Sablerite on X', href: 'https://x.com/Sablerite' }],

  signoff: 'Handle with curiosity.',
};
