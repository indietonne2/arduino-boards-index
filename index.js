// index.js — full, patched version
//
// Generates package_macchina_index.json and injects Arduino’s
// bossac + GCC tool-chain (which already supports linux-aarch64).

const Octokat = require('octokat');
const token   = process.env['GITHUB_TOKEN'];
const octo    = token ? new Octokat({ token }) : new Octokat();

const rp = require('request-promise-native');

const publishingRepositories = [
  "macchina/arduino-boards-sam"
];

// ───────────────────────────────────────── helpers ──

function createRepo(qualifiedRepoName) {
  const [owner, repo] = qualifiedRepoName.split('/');
  return octo.repos(owner, repo);
}

function getReleases(repository) {
  return createRepo(repository).releases.fetchAll();
}

async function getPlatform(release) {
  const asset = release.assets.find(a => a.name === 'platform.json');
  if (!asset) return;                     // skip if no platform.json
  return JSON.parse(await rp(asset.browserDownloadUrl));
}

function clean(obj) {                     // drop null/undefined elements
  Object.keys(obj).forEach(k => (obj[k] == null) && delete obj[k]);
}

/**
 * Ensure every platform depends on Arduino’s arm-ready bossac & GCC.
 * Removes any older self-hosted entries first.
 */
function ensureArm64Deps(p) {
  const wanted = [
    { packager: "arduino", name: "bossac",            version: "1.9.1-arduino2" },
    { packager: "arduino", name: "arm-none-eabi-gcc", version: "7-2017q4"       }
  ];

  p.toolsDependencies = (p.toolsDependencies || [])
    .filter(d => !(d.name === "bossac" || d.name === "arm-none-eabi-gcc"))
    .concat(wanted);

  return p;
}

// ───────────────────────────────────────── main ──

async function main() {
  // flatten all releases from every publishing repo
  const releaseArrays = await Promise.all(publishingRepositories.map(getReleases));
  const releases      = [].concat(...releaseArrays);

  // fetch platform.json for each release
  let platforms = await Promise.all(releases.map(getPlatform));
  clean(platforms);                        // drop null entries
  platforms = platforms.map(ensureArm64Deps);

  const index = {
    packages: [
      {
        name:        "macchina",
        maintainer:  "Macchina",
        websiteURL:  "https://github.com/macchina/arduino-boards-index",
        email:       "info@macchina.cc",
        help:        { online: "https://forum.macchina.cc/" },
        platforms,
        tools: []
      }
    ]
  };

  return JSON.stringify(index, null, 2);
}

if (require.main === module) {
  main()
    .then(console.log)
    .catch(err => { console.error(err); process.exit(2); });
}
