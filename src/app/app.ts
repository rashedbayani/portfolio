import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  StaggeredMenuComponent,
  StaggeredMenuItem,
} from './shared/staggered-menu/staggered-menu.component';
import site from './core/config/site.config.json';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, StaggeredMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly siteName = site.name;
  readonly menuOpen = signal(false);
  readonly menuColors = ['#493021', '#ff9655'];
  readonly menuItems: readonly StaggeredMenuItem[] = [
    { label: 'Home', ariaLabel: 'Go to home page', link: '/' },
    { label: 'About', ariaLabel: 'Learn about me', link: '/about' },
    { label: 'Projects', ariaLabel: 'View my projects', link: '/projects' },
  ];
}
