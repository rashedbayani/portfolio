import site from './site.config.json';

/** Resolve application paths inside the site's deployment directory. */
export function siteUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), site.baseUrl).href;
}
