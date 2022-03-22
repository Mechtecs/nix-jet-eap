const {get} = require('axios');
const { writeFile, realpath } = require('fs/promises');

const jetbrainsAPI = {
  host: 'data.services.jetbrains.com',
  codes: {
    // dotUltimate suite - Windows only
    dotUltimate: {
      DC: 'dotCover',
      DM: 'dotMemory',
      DP: 'dotTrace',
      DPK: 'dotPeek',
      RC: 'ReSharperCpp',
      RS: 'ReSharper',
    },

    // macOS only
    macOS: {
      AC: 'AppCode',
    },

    server: {
      YTD: 'YouTrack',
      TC: 'TeamCity',
    },

    // tools available for linux
    IDE: {
      CL: 'CLion',
      DG: 'DataGrip',
      DS: 'DataSpell',
      GO: 'GoLand',
      HB: 'Hub',
      IIE: 'IntelliJ IDEA Edu',
      IIU: 'IntelliJ IDEA',
      MPS: 'MPS',
      PCE: 'PyCharm Edu',
      PCP: 'PyCharm',
      PS: 'PhpStorm',
      RD: 'Rider',
      RM: 'RubyMine',
      TBA: 'Toolbox',
      WS: 'WebStorm',
    },
  },
  ressources: {
    productReleases: '/products/releases',
  },
};

/**
 * fetch releases from jetbrains
 *
 * @param codes string[]
 * @param queryParams object
 * @return {Promise<AxiosResponse<any>>}
 */
function fetchReleases(codes, additionalParams = {}) {
  return get(`https://${jetbrainsAPI.host}${jetbrainsAPI.ressources.productReleases}`, {
    params: {
      latest: 'true',
      code: codes.join(','),
      ...additionalParams,
    },
  });
}

function extractBuildInformation(products) {
  let builds = [];
  for (const code in products) {
    const product = products[code][0] ?? null;
    if (!product || !product.downloads.linux) {
      continue;
    }
    builds.push({
      code,
      type: product.type,
      build: product.type === 'release' ? product.version : product.build,
      link: {
        archive: product.downloads.linux.link,
        checksum: product.downloads.linux.checksumLink,
      }
    });
  }
  return builds;
}

async function loadBuildMetadata(build) {
  return {
    ...build,
    sha256: await get(build.link.checksum).then(response => response.data.split(' ')[0]),
  }
}

function mapBuildsToObject(builds) {
  let buildsObject = {};
  for (const build of builds) {
    buildsObject[build.code] = {
      ver: build.build,
      archive: build.link.archive,
      sha256: build.sha256,
    };
  }
  return buildsObject;
}

function sortBuildsByCode(builds) {
  return builds.sort((a, b) => a.code.localeCompare(b.code));
}

async function run() {
  const productCodes = Object.keys(jetbrainsAPI.codes.IDE);
  const queries = [
    fetchReleases(productCodes),
    fetchReleases(productCodes, {type: 'eap'}),
  ];
  const responses = (await Promise.all(queries)).map(response => response.data);
  const stableBuilds = sortBuildsByCode(await Promise.all(extractBuildInformation(responses[0]).map(loadBuildMetadata)));
  const eapBuilds = sortBuildsByCode(await Promise.all(extractBuildInformation(responses[1]).map(loadBuildMetadata)));

  const products = {
    stable: mapBuildsToObject(stableBuilds),
    eap: mapBuildsToObject(eapBuilds),
  };

  const versionFile = await realpath(__dirname + '/../versions.json');
  console.log(':: writing new version file %s', versionFile);
  await writeFile(versionFile, JSON.stringify(products, null, 2));

  console.log(':: done');
}

run();
