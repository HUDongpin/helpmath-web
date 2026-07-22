import type {MetadataRoute} from 'next';

import {SITE_DESCRIPTION} from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HELP Math',
    short_name: 'HELP Math',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdf7',
    theme_color: '#1768d4',
    lang: 'en',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ]
  };
}
