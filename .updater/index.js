const axios = require('axios');
const {writeFile, realpath} = require('fs/promises');

const jetbrainsAPI = {
  host: 'data.services.jetbrains.com',
  codes: ["SPA", "TBA", "IIU", "PCP", "WS", "PS", "RS", "RD", "CL", "DS", "DG", "RM", "AC", "GO", "RC", "DPK", "DP", "DM", "DC", "YTD", "TC", "HB", "MPS", "PCE", "IIE"],
  products: [
    {
      name: 'CLion',
      code: 'CL'
    }, {
      name: 'Datagrip',
      code: 'DG',
    }, {
      name: 'GoLand',
      code: 'GO',
    }, {
      name: 'IntelliJ IDEA Ultimate',
      code: 'IIU',
    }, {
      name: 'PHPStorm',
      code: 'PS',
    },
    {

      name: 'WebStorm',

      code: 'WS',
    }
  ],
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
function fetchReleases(codes, queryParams) {
  return axios.get(`https://${jetbrainsAPI.host}${jetbrainsAPI.ressources.productReleases}`, {
    params: {
      code: codes.join(','),
      ...queryParams,
    },
  });
};

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
    sha256: await axios.get(build.link.checksum).then(response => response.data.split(' ')[0]),
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

async function run() {
  const productCodes = jetbrainsAPI.products.map(product => product.code);
  const queries = [
    fetchReleases(productCodes, {
      latest: 'true',
    }),
    fetchReleases(productCodes, {
      latest: 'true',
      type: 'eap',
    }),
  ];
  const responses = (await Promise.all(queries)).map(response => response.data);
  const stableBuilds = await Promise.all(await extractBuildInformation(responses[0]).map(loadBuildMetadata));
  const eapBuilds = await Promise.all(await extractBuildInformation(responses[1]).map(loadBuildMetadata));

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
