export interface Anchor {
  selector: string;
  tag: string;
  text: string;
}

export type FeedbackStatus = "open" | "resolved" | "archived";

export interface Reply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Feedback {
  id: string;
  anchor: Anchor;
  text: string;
  author: string;
  status: FeedbackStatus;
  createdAt: string;
  page: string;
  /** Conversation replies, oldest first. Optional for back-compat. */
  replies?: Reply[];
}

export interface TourStep {
  id: string;
  anchor: Anchor;
  title: string;
  body: string;
  order: number;
  page: string;
}

export interface Settings {
  /** When true, the tour auto-starts for reviewers on first load. */
  autoStartTour: boolean;
}

export interface ServerOptions {
  /** Directory to serve (static mode) — mutually exclusive with proxyTarget. */
  dir?: string;
  /** Origin of an existing dev server to reverse-proxy, e.g. http://localhost:5173 */
  proxyTarget?: string;
  /** Where .protofeedback/ lives; defaults to dir or cwd. */
  dataDir?: string;
  port?: number;
  host?: string;
}
