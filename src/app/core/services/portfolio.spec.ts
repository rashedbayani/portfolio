import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { ProjectService } from './project.service';
import { SeoService } from './seo.service';
import { DOCUMENT } from '@angular/core';

describe('Portfolio infrastructure', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('sorts and filters the shared dataset', () => {
    const service = TestBed.inject(ProjectService);
    expect(service.projects.map(project => project.order)).toEqual([...service.projects.map(project => project.order)].sort((a, b) => a - b));
    expect(service.featuredProjects).toEqual(service.projects.filter(project => project.featured));
    for (const category of service.categories) {
      expect(service.getByCategory(category)).toEqual(service.projects.filter(project => project.category === category));
    }
    expect(service.getBySlug('missing')).toBeUndefined();
  });

  it('replaces metadata and reuses the canonical link', () => {
    const seo = TestBed.inject(SeoService);
    const document = TestBed.inject(DOCUMENT);
    seo.update({ title: 'First', image: '/first.svg', noindex: true });
    seo.update({ title: 'Second', path: '/about' });
    expect(document.title).toContain('Second');
    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/about$/);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).not.toContain('first.svg');
  });

  it('updates reused project routes and handles invalid slugs and unknown pages', async () => {
    const harness = await RouterTestingHarness.create();
    const projects = TestBed.inject(ProjectService).projects;
    for (const project of projects) {
      await harness.navigateByUrl(`/projects/${project.slug}`);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(project.title);
      expect(TestBed.inject(DOCUMENT).title).toContain(project.seo.title);
    }
    for (const path of ['/projects/missing', '/unknown']) {
      await harness.navigateByUrl(path);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Page not found');
    }
    await harness.navigateByUrl('/about');
    expect(TestBed.inject(DOCUMENT).querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
  });
});
