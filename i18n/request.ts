import {routing} from './routing';

export default async function requestConfig({requestLocale}: {requestLocale: Promise<string | undefined>}) {
  const requested = await requestLocale;
  const locale = routing.locales.some((candidate) => candidate === requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: {}
  };
}
