# Peak Position Adjuster

Tool adjusts peak positions according to DEM. It produces JOSM osm change file.

## Installation

1. install Node 12 or above
1. clone the project
1. chdir to the cloned project
1. run `npm i`

## Running

Program downloads all peaks in Slovakia from Overpass; for different region just modify the query in `index.js`.

1. run `node . /path/to/dmr1.tif [/path/to/dmr2.tif ...] > output.osm` (DEM data must be in EPSG:8353)
