export interface Anchor {
  /** Primary structural CSS selector (id + nth-of-type path). */
  selector: string;
  /** Lowercase tag name, used as a fallback filter. */
  tag: string;
  /** Trimmed innerText snippet, used to re-anchor after edits. */
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
  /** Page path the comment was left on, e.g. "/" or "/about". */
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
