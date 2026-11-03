import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ProductAnimation } from './product-animation';
import { ProductScene, type ProductSceneCallbacks } from './product-scene';
import { clamp01, wordProgress } from '../utils/scroll-progress';

interface ExperienceElements {
  section: HTMLElement;
  stage: HTMLElement;
  viewport: HTMLElement;
  words: HTMLElement[];
  meter: HTMLElement;
  progressLabel: HTMLElement;
  phaseLabel: HTMLElement;
  onReady: (ready: boolean) => void;
  onStatic: (staticMode: boolean) => void;
}

/** Lazy, browser-only runtime. One progress value and one render loop own the entire story. */
type SceneController = Pick<ProductScene, 'parts' | 'render' | 'resize' | 'setSeparation' | 'dispose'>;

export function createProductExperience(
  elements: ExperienceElements,
  createScene: (container: HTMLElement, callbacks: ProductSceneCallbacks) => SceneController =
    (container, callbacks) => new ProductScene(container, callbacks),
): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const { section, stage, words, meter, progressLabel, phaseLabel } = elements;
  let disposed = false;
  let visible = false;
  let meaningfulEntry = false;
  let contextLost = false;
  let staticMode = true;
  let progress = 0;
  let frame = 0;
  let textProgress = -1;
  let reducedMotion = false;
  let shortViewport = false;
  let resizeFrame = 0;
  let entryTween: gsap.core.Tween | undefined;
  let trigger: ScrollTrigger | undefined;
  let scene: SceneController;

  const stop = (): void => { cancelAnimationFrame(frame); frame = 0; };
  const wake = (): void => {
    if (!disposed && !frame && visible && !document.hidden && !contextLost) frame = requestAnimationFrame(render);
  };

  try {
    scene = createScene(elements.viewport, {
      onContextLost: () => {
        contextLost = true;
        stop();
        elements.onReady(false);
        configure();
      },
      onContextRestored: () => {
        contextLost = false;
        elements.onReady(true);
        configure();
        wake();
      },
    });
  } catch {
    elements.onStatic(true);
    elements.onReady(false);
    return () => {};
  }

  const animation = new ProductAnimation(scene.parts);
  const style = getComputedStyle(section);
  const muted = style.getPropertyValue('--color-muted-readable').trim() || '#a99a8e';
  const active = style.getPropertyValue('--color-primary').trim() || '#f5f5f2';
  const mixColor = gsap.utils.interpolate(muted, active);

  function updateText(p: number): void {
    if (p === textProgress) return;
    textProgress = p;
    words.forEach((word, index) => {
      word.style.color = mixColor(wordProgress(p, index, words.length));
    });
    meter.style.transform = `scaleX(${p})`;
    progressLabel.textContent = `${Math.round(p * 100).toString().padStart(2, '0')}%`;
  }

  function render(time: number): void {
    frame = 0;
    const p = staticMode ? 1 : progress;
    animation.update(p, time / 1000, !staticMode);
    scene.setSeparation(animation.separation);
    updateText(p);
    phaseLabel.textContent = staticMode ? 'PRODUCT ANATOMY' : animation.phase === 'complete' ? 'EVERY DETAIL, TOGETHER' : animation.entryComplete ? 'SCROLL TO ASSEMBLE' : 'DESIGNED FROM WITHIN';
    section.dataset['phase'] = animation.phase;
    section.dataset['progress'] = p.toFixed(4);
    scene.render();
    if (!staticMode && p < 1 && animation.hasEntered) wake();
  }

  function beginEntry(): void {
    if (staticMode || animation.hasEntered || !meaningfulEntry) return;
    // Restored scroll positions go directly to their deterministic scroll state.
    if (progress > 0.025) {
      animation.finishEntry();
      wake();
      return;
    }
    animation.beginEntry();
    const entry = { amount: 0 };
    entryTween = gsap.to(entry, {
      amount: 1, delay: 0.16, duration: 1.08, ease: 'power3.inOut',
      onUpdate: () => { animation.setEntryProgress(entry.amount); wake(); },
      onComplete: () => { animation.finishEntry(); wake(); },
    });
    wake();
  }

  const visibility = new IntersectionObserver(entries => {
    const entry = entries[0];
    visible = entry.isIntersecting;
    meaningfulEntry = visible && (entry.intersectionRatio >= 0.35 || stage.getBoundingClientRect().top < 0);
    if (visible) {
      entryTween?.resume();
      if (meaningfulEntry) beginEntry();
      wake();
    } else {
      stop();
      entryTween?.pause();
    }
  }, { threshold: [0, 0.35, 0.65] });
  visibility.observe(stage);

  const media = gsap.matchMedia();
  function configure(): void {
    if (disposed) return;
    trigger?.kill();
    trigger = undefined;
    staticMode = contextLost || reducedMotion || shortViewport;
    section.classList.toggle('is-interactive', !staticMode);
    section.classList.toggle('is-static', staticMode);
    // Text zoom, translation, and small viewports must never trap content outside a sticky stage.
    if (!staticMode && stage.scrollHeight > stage.clientHeight + 3) {
      staticMode = true;
      section.classList.remove('is-interactive');
      section.classList.add('is-static');
    }
    elements.onStatic(staticMode);
    if (staticMode) {
      entryTween?.kill();
      animation.finishEntry();
      updateText(1);
      animation.update(1, 0, false);
      scene.setSeparation(0);
    } else {
      trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        invalidateOnRefresh: true,
        onUpdate: self => {
          progress = clamp01(self.progress);
          // A fast pass finishes entry without an independent timeline continuing past the endpoint.
          if (progress === 1) { entryTween?.kill(); animation.finishEntry(); }
          if (visible && !animation.hasEntered) beginEntry();
          wake();
        },
        onRefresh: self => { progress = clamp01(self.progress); wake(); },
      });
      progress = trigger.progress;
      if (visible) beginEntry();
    }
    scene.resize();
    wake();
  }

  media.add({
    desktop: '(min-width: 768px)',
    mobile: '(max-width: 767px)',
    reduced: '(prefers-reduced-motion: reduce)',
    short: '(max-height: 620px)',
  }, context => {
    reducedMotion = !!context.conditions!['reduced'];
    shortViewport = !!context.conditions!['short'];
    configure();
    return () => { trigger?.kill(); trigger = undefined; };
  });

  const onResize = (): void => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; configure(); });
  };

  const onVisibility = (): void => {
    if (document.hidden) { stop(); entryTween?.pause(); }
    else { if (visible) entryTween?.resume(); wake(); }
  };
  const onPageShow = (): void => { ScrollTrigger.refresh(); wake(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('resize', onResize);
  // Fonts affect the sticky composition and scroll start, including back/forward restoration.
  void document.fonts.ready.then(() => { if (!disposed) { configure(); ScrollTrigger.refresh(); } });
  elements.onReady(true);
  scene.render();

  return () => {
    disposed = true;
    stop();
    cancelAnimationFrame(resizeFrame);
    entryTween?.kill();
    media.revert();
    visibility.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('resize', onResize);
    section.classList.remove('is-interactive');
    scene.dispose();
  };
}
