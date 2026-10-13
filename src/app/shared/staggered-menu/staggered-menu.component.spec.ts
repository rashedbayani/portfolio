import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { gsap } from 'gsap';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { StaggeredMenuComponent } from './staggered-menu.component';

describe('StaggeredMenuComponent', () => {
  let fixture: ComponentFixture<StaggeredMenuComponent>;
  let element: HTMLElement;
  let originalOverflow: string;

  beforeEach(async () => {
    originalOverflow = document.body.style.overflow;
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    // JSDOM cannot resolve percentage CSS transforms into layout matrices.
    // Exercise GSAP's inline transforms without the prerender-only CSS offsets.
    TestBed.overrideComponent(StaggeredMenuComponent, { set: { styles: [], styleUrls: [] } });
    fixture = TestBed.createComponent(StaggeredMenuComponent);
    fixture.componentRef.setInput('isFixed', true);
    fixture.componentRef.setInput('items', [
      { label: 'Home', link: '/' },
      { label: 'Projects', link: '/projects' },
    ]);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
    document.body.style.overflow = originalOverflow;
  });

  async function toggle(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
  }

  it('keeps closed navigation inert and emits open/close events while restoring scroll', async () => {
    const opened = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.menuOpen.subscribe(opened);
    fixture.componentInstance.menuClose.subscribe(closed);
    const panel = element.querySelector('nav')!;
    expect(panel.hasAttribute('inert')).toBe(true);
    await toggle();
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(element.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(opened).toHaveBeenCalledTimes(1);
    await toggle();
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('closes with Escape and returns focus to the toggle', async () => {
    await toggle();
    element.querySelector<HTMLAnchorElement>('nav a')!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(element.querySelector('button'));
  });

  it('cycles keyboard focus inside a fixed open menu', async () => {
    await toggle();
    const links = element.querySelectorAll<HTMLAnchorElement>('a');
    links[links.length - 1].focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(links[0]);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(links[links.length - 1]);
  });

  it('respects click-away configuration and closes on route navigation', async () => {
    fixture.componentRef.setInput('closeOnClickAway', false);
    await toggle();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(fixture.componentInstance.open()).toBe(true);
    fixture.componentRef.setInput('closeOnClickAway', true);
    await fixture.whenStable();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    await toggle();
    await TestBed.inject(Router).navigateByUrl('/projects');
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(element.querySelector('a[aria-current="page"]')!.textContent).toContain('Projects');
  });

  it('settles rapid toggles and left-side animations immediately for reduced motion', async () => {
    fixture.componentRef.setInput('position', 'left');
    await fixture.whenStable();
    const panel = element.querySelector('nav')!;
    expect(gsap.getProperty(panel, 'xPercent')).toBe(-100);
    await toggle();
    expect(gsap.getProperty(panel, 'xPercent')).toBe(0);
    fixture.componentInstance.toggleMenu();
    fixture.componentInstance.toggleMenu();
    fixture.componentInstance.toggleMenu();
    await fixture.whenStable();
    expect(gsap.getProperty(panel, 'xPercent')).toBe(-100);
    expect(element.querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('supports optional socials and numbering and releases scroll lock on destruction', async () => {
    fixture.componentRef.setInput('socialItems', [
      { label: 'GitHub', link: 'https://github.com/example' },
    ]);
    fixture.componentRef.setInput('displayItemNumbering', false);
    await toggle();
    const social = element.querySelector<HTMLAnchorElement>('.sm-social-link')!;
    expect(social.target).toBe('_blank');
    expect(social.rel).toBe('noopener noreferrer');
    expect(element.querySelector('.sm-number')).toBeNull();
    fixture.componentRef.setInput('displaySocials', false);
    await fixture.whenStable();
    expect(element.querySelector('.sm-social-link')).toBeNull();
    fixture.destroy();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });
});
