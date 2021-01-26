const gdal = require("gdal-next");
const { create } = require("xmlbuilder2");

// "/media/martin/ecf9e826-7b6b-4992-adad-71232022b316/martin/dmr5/R_02_17_s.tif"

const wgs84 = gdal.SpatialReference.fromEPSG(4326);

const srs = gdal.SpatialReference.fromProj4(
  "+proj=krovak +lat_0=49.5 +lon_0=24.8333333333333 +alpha=30.2881397527778 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=485.021,169.465,483.839,7.786342,4.397554,4.102655,0 +units=m +no_defs"
);

const coord_transform = new gdal.CoordinateTransformation(wgs84, srs);
const coord_transform1 = new gdal.CoordinateTransformation(srs, wgs84);

const https = require("https");

const chunks = [];

// [bbox:{{bbox}}]
const query = Buffer.from(`[out:json][timeout:90];
(
  node[natural=peak](area:3600014296);
);
(._;>;);
out meta;
`);

const req = https.request(
  {
    hostname: "overpass.freemap.sk",
    port: 443,
    path: "/api/interpreter",
    method: "POST",
    headers: {
      "Content-Length": query.length,
    },
  },
  (res) => {
    res.on("data", (d) => {
      chunks.push(d);
    });

    res.on("end", () => {
      adjust(JSON.parse(chunks.join("")).elements);
    });
  }
);

req.write(query);

req.end();

function adjust(elements) {
  const root = create({ version: "1.0" }).ele("osm", {
    version: "0.6",
    generator: "peak-position-adjuster",
  });

  const ds = gdal.open(process.argv[2]);

  const band = ds.bands.get(1);

  const geotransform = ds.geoTransform;

  const oob = [];

  outer: for (const element of elements) {
    const center = coord_transform.transformPoint({
      x: element.lat,
      y: element.lon,
    });

    const cx = Math.round(center.x);
    const cy = Math.round(center.y);

    let maxEle = -Infinity;
    let px;
    let py;
    let pd;

    try {
      for (let x = cx - 100; x < cx + 100; x++) {
        for (let y = cy - 100; y < cy + 100; y++) {
          const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

          if (d < 100) {
            const ele = band.pixels.get(
              x - geotransform[0],
              geotransform[3] - y
            );

            if (ele < -9000) {
              process.stderr.write("-");
              continue outer;
            }

            if (ele > maxEle) {
              maxEle = ele;
              px = x;
              py = y;
              pd = d;
            }
          }
        }
      }

      if (pd > 95) {
        oob.push(element.id);
        continue;
      }

      const latlon = coord_transform1.transformPoint({ x: px, y: py });

      process.stderr.write("X");

      const node = root.ele("node", {
        id: element.id,
        version: element.version,
        lat: latlon.x,
        lon: latlon.y,
        user: element.user,
        timestamp: element.timestamp,
        visible: "true",
        action: "modify",
      });

      for (const [k, v] of Object.entries(element.tags)) {
        node.ele("tag", { k, v });
      }
    } catch (err) {
      if (!err.message.includes("out of")) {
        throw err;
      }

      process.stderr.write(".");
    }
  }

  console.error("\nOut of bounds peaks: " + oob.join(" "));

  console.log(root.end({ prettyPrint: true }));
}
