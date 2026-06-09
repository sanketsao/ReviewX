// Server build entry: injected by the local proxy/static server at /__pf/overlay.js.
// Talks to the same-origin /__pf/* API. Role is stamped server-side (loopback =
// author, tunnel = reviewer).
import { boot } from "./app";
import { httpBackend } from "./backend";

boot(httpBackend());
