// Everything written on the profile lives here.
// Run `node scripts/build.mjs` after editing; it rewrites README.md and assets/.
// Everything the build fetches comes from `accounts` below.

export default {
  user: 'Sablerite',

  // Activity, language and commit data come from these accounts only.
  accounts: ['Sablerite'],
  // Repositories left out of languages, "building" and the commit log.
  exclude: ['Sablerite/Sablerite'],

  // The spinning crystal on the left of the header.
  crystal: { seed: 23, sides: 6 },

  // The terminal on the right of the header. Keep each line under ~60 characters.
  terminal: {
    host: 'sablerite@github',
    name: 'Sablerite',
    role: 'systems & embedded developer',
    about: 'Rust and C++, mostly on microcontrollers.',
    stack: 'Rust, C++, CMake, PlatformIO, ESP32-S3',
    commits: 3,
  },

  links: [{ label: 'X / Twitter', href: 'https://x.com/Sablerite' }],
};
