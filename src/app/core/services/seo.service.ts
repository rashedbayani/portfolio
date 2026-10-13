import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import site from '../config/site.config.json';

export interface PageSeo {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
  noindex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  update(page: PageSeo = {}): void {
    const title = page.title ? `${page.title} | ${site.name}` : site.name;
    const description = page.description ?? site.description;
    const canonical = new URL(page.path ?? '/', site.baseUrl).href;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: page.noindex ? 'noindex, follow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: new URL(page.image ?? site.image, site.baseUrl).href });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = canonical;
  }
}
