'use client';

import { TileLayer } from 'react-leaflet';

const STREET_TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
};

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const SATELLITE_TILES = {
  url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
  attribution: '&copy; Esri, Maxar, Earthstar Geographics',
};
/**
 * Transparent layers drawn over the imagery, as in a "hybrid" view: road
 * lines and street names, then place names and boundaries. No points of
 * interest — Esri's free reference layers carry none.
 */
const SATELLITE_OVERLAYS = [
  `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
  `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
];

/** Shared look for the buttons floating over a map. */
export const MAP_CONTROL_BUTTON_CLASS =
  'rounded-md bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-wait';

/** The map's background: OpenStreetMap streets, or satellite imagery with streets and place names on top. */
export function BaseTiles({ satellite }: { satellite: boolean }) {
  if (!satellite) return <TileLayer key="streets" url={STREET_TILES.url} attribution={STREET_TILES.attribution} />;
  return (
    <>
      <TileLayer key="imagery" url={SATELLITE_TILES.url} attribution={SATELLITE_TILES.attribution} />
      {SATELLITE_OVERLAYS.map((url) => (
        <TileLayer key={url} url={url} />
      ))}
    </>
  );
}
