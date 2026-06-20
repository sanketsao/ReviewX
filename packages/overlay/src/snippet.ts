// CDN snippet entry: the zero-install front door. Authors drop one line into a
// prototype and reviewers see the overlay with no install.
//
//   <script src="https://cdn.jsdelivr.net/npm/reviewsx@1" data-reviewsx></script>
//
// Optional config via data-* attributes or a window.ReviewSX object set before
// the script:
//   data-role="author"               author tools (default reviewer)
//   data-endpoint="https://…/api"    shared inbox (default: per-browser localStorage)
//   data-project="my-proto"          logical id keying the data (default: page host)
//   data-token="secret"              author copy only — authorizes resolve/edit/
//                                    tour/export against the inbox; omit on the
//                                    copy you share with reviewers
import { boot } from "./app";
import { pickBackend, resolveConfig } from "./backend";

const cfg = resolveConfig();
// Seed the role hint so OverlayApp.resolveRole() can pick it up; an explicit
// ?pf= URL param still wins over this.
if (cfg.role) (window as unknown as { __PF_ROLE?: string }).__PF_ROLE = cfg.role;

boot(pickBackend(cfg));
