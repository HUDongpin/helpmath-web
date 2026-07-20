import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HELP Math',
    short_name: 'HELP Math',
    description:
      'Interactive, language-rich mathematics learning for multilingual students and educators.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdf7',
    theme_color: '#1768d4',
    lang: 'en'
  };
}
