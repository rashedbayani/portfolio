import { Injectable } from '@angular/core';
import data from '../../data/projects.json';
import { Project } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  // Immutable build-time data needs no mutable state or HTTP request.
  readonly projects: readonly Project[] = [...data].sort((a, b) => a.order - b.order);
  readonly featuredProjects = this.projects.filter(project => project.featured);
  readonly categories = [...new Set(this.projects.map(project => project.category))].sort();

  getByCategory(category: string): readonly Project[] {
    return this.projects.filter(project => project.category === category);
  }

  getBySlug(slug: string): Project | undefined {
    return this.projects.find(project => project.slug === slug);
  }
}
