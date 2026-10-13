export interface ProjectImage {
  readonly src: string;
  readonly alt: string;
}

export interface Project {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly year: number;
  readonly coverImage: string;
  readonly images: readonly ProjectImage[];
  readonly featured: boolean;
  readonly order: number;
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly image?: string;
  };
}
