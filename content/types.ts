export const pageKeys = [
  "home",
  "about",
  "approach",
  "curriculum",
  "research",
  "resources",
  "support",
  "login",
  "contact",
  "demos",
  "privacy",
  "terms",
] as const;

export type PageKey = (typeof pageKeys)[number];

export type Locale = "en" | "es";

export const demoIds = ["conversion-1-2", "conversion-1-4"] as const;

export type DemoId = (typeof demoIds)[number];

export interface PageMetadata {
  title: string;
  description: string;
}

export interface LinkContent {
  label: string;
  href: string;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  summary: string;
  primaryAction?: LinkContent;
  secondaryAction?: LinkContent;
}

export interface TextSection {
  id: string;
  eyebrow?: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface FeatureCard {
  id: string;
  title: string;
  description: string;
  detail?: string;
}

export interface CalloutContent {
  title: string;
  body: string;
  action?: LinkContent;
}

export interface SiteNavigation {
  ariaLabel: string;
  homeLabel: string;
  links: LinkContent[];
  supportAction: LinkContent;
  languageLabel: string;
  languageNames: Record<Locale, string>;
  openMenuLabel: string;
  closeMenuLabel: string;
}

export interface SiteFooter {
  summary: string;
  exploreLabel: string;
  helpLabel: string;
  exploreLinks: LinkContent[];
  helpLinks: LinkContent[];
  languageNote: string;
  legalNote: string;
}

export interface SharedContent {
  siteName: string;
  siteTagline: string;
  skipToContent: string;
  statusLabel: string;
  statusMessage: string;
  externalLinkLabel: string;
  requiredFieldLabel: string;
  navigation: SiteNavigation;
  footer: SiteFooter;
}

export interface HomeContent {
  metadata: PageMetadata;
  hero: HeroContent & {
    supportingNote: string;
  };
  status: CalloutContent & {
    label: string;
  };
  audiences: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: FeatureCard[];
  };
  approach: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: FeatureCard[];
    action: LinkContent;
  };
  demos: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<FeatureCard & { action: LinkContent }>;
    note: string;
  };
  closing: CalloutContent;
}

export interface AboutContent {
  metadata: PageMetadata;
  hero: HeroContent;
  story: TextSection[];
  principles: {
    eyebrow: string;
    title: string;
    cards: FeatureCard[];
  };
  today: CalloutContent;
}

export interface ApproachContent {
  metadata: PageMetadata;
  hero: HeroContent;
  foundations: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: FeatureCard[];
  };
  learningSequence: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: Array<FeatureCard & { step: string }>;
  };
  supportLayers: TextSection;
  teacherRole: CalloutContent;
}

export interface CurriculumContent {
  metadata: PageMetadata;
  hero: HeroContent;
  archiveNotice: CalloutContent;
  domains: {
    eyebrow: string;
    title: string;
    intro: string;
    cards: FeatureCard[];
  };
  lessonFlow: {
    eyebrow: string;
    title: string;
    steps: Array<FeatureCard & { step: string }>;
  };
  availability: TextSection;
  closing: CalloutContent;
}

export type EvidenceStatus = "archived" | "verification" | "context";

export interface EvidenceEntry {
  id: string;
  title: string;
  dateLabel: string;
  status: EvidenceStatus;
  statusLabel: string;
  summary: string;
  interpretation: string;
  sourceLabel: string;
}

export interface ResearchContent {
  metadata: PageMetadata;
  hero: HeroContent;
  evidenceNotice: CalloutContent;
  entriesLabel: string;
  entries: EvidenceEntry[];
  reviewPolicy: TextSection;
  request: CalloutContent;
}

export type ResourceStatus = "available" | "review" | "request";

export interface ResourceEntry {
  id: string;
  title: string;
  format: string;
  dateLabel: string;
  status: ResourceStatus;
  statusLabel: string;
  description: string;
  action: LinkContent;
}

export interface ResourcesContent {
  metadata: PageMetadata;
  hero: HeroContent;
  archiveNotice: CalloutContent;
  filters: {
    ariaLabel: string;
    all: string;
    program: string;
    research: string;
    technical: string;
  };
  items: ResourceEntry[];
  accessibleCopies: CalloutContent;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export interface SupportContent {
  metadata: PageMetadata;
  hero: HeroContent;
  currentStatus: {
    eyebrow: string;
    title: string;
    items: FeatureCard[];
  };
  faqLabel: string;
  faqs: FaqEntry[];
  contact: CalloutContent;
}

export interface LoginContent {
  metadata: PageMetadata;
  hero: HeroContent;
  alert: CalloutContent;
  options: {
    eyebrow: string;
    title: string;
    cards: Array<FeatureCard & { action: LinkContent }>;
  };
  safetyNote: string;
}

export interface DemoListItem {
  id: DemoId;
  title: string;
  summary: string;
  conceptLabel: string;
  concept: string;
  statusLabel: string;
  statusDetail: string;
  action: LinkContent;
}

export interface DemosContent {
  metadata: PageMetadata;
  hero: HeroContent;
  previewNotice: CalloutContent;
  listLabel: string;
  items: DemoListItem[];
  quality: TextSection;
  accessibility: CalloutContent;
}

export interface DemoDetailContent {
  metadata: PageMetadata;
  eyebrow: string;
  title: string;
  summary: string;
  statusLabel: string;
  statusDetail: string;
  instructionsTitle: string;
  instructions: string[];
  playerLabel: string;
  loadingLabel: string;
  unavailableTitle: string;
  unavailableMessage: string;
  replayLabel: string;
  restartLabel: string;
  pauseLabel: string;
  playLabel: string;
  reducedMotionNote: string;
  accessibilityTitle: string;
  accessibilityNotes: string[];
  disclaimerTitle: string;
  disclaimer: string;
  backAction: LinkContent;
  supportAction: LinkContent;
}

export interface SelectOptionContent {
  value: string;
  label: string;
}

export interface ContactContent {
  metadata: PageMetadata;
  hero: HeroContent;
  responseNote: CalloutContent;
  form: {
    title: string;
    intro: string;
    fields: {
      role: string;
      name: string;
      email: string;
      organization: string;
      topic: string;
      message: string;
      privacyConsent: string;
    };
    placeholders: {
      name: string;
      email: string;
      organization: string;
      message: string;
    };
    roleOptions: SelectOptionContent[];
    topicOptions: SelectOptionContent[];
    submitLabel: string;
    submittingLabel: string;
    successTitle: string;
    successMessage: string;
    errorTitle: string;
    errorMessage: string;
    validation: {
      required: string;
      invalidEmail: string;
      consentRequired: string;
      messageTooLong: string;
    };
  };
  privacyWarning: CalloutContent;
  studentNote: string;
}

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalContent {
  metadata: PageMetadata;
  hero: HeroContent;
  effectiveDateLabel: string;
  effectiveDate: string;
  reviewNotice: string;
  sections: LegalSection[];
  contact: CalloutContent;
}

export interface SiteContent {
  locale: Locale;
  shared: SharedContent;
  pages: {
    home: HomeContent;
    about: AboutContent;
    approach: ApproachContent;
    curriculum: CurriculumContent;
    research: ResearchContent;
    resources: ResourcesContent;
    support: SupportContent;
    login: LoginContent;
    contact: ContactContent;
    demos: DemosContent;
    demoDetails: Record<DemoId, DemoDetailContent>;
    privacy: LegalContent;
    terms: LegalContent;
  };
}
