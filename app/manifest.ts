import type { MetadataRoute } from 'next';
import { BRAND } from '@/constants/brand.constants';

/**
 * What a phone needs to install the dashboard on its home screen (NOT-220):
 * standalone, so it opens without browser chrome, and push notifications on
 * iPhone only work from that icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: BRAND.ink,
    background_color: BRAND.ink,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
