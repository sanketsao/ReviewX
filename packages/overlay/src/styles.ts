export const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

.pf-launcher {
  position: fixed; bottom: 16px; right: 16px; z-index: 2147483600;
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  background: #111827; color: #f9fafb; border: 0;
  padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 600;
  box-shadow: 0 8px 30px rgba(0,0,0,.35);
}
.pf-launcher:hover { background: #1f2937; }
.hidden { display: none !important; }

.pf-banner {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  z-index: 2147483600;
  display: flex; align-items: center; gap: 8px;
  background: #111827; color: #f9fafb;
  padding: 8px 10px; border-radius: 999px;
  box-shadow: 0 8px 30px rgba(0,0,0,.35);
  font-size: 13px;
}
.pf-title { font-weight: 600; padding: 0 6px; display: flex; align-items: center; gap: 6px; }
.pf-dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; }
.pf-btn {
  border: 0; cursor: pointer; border-radius: 999px;
  padding: 6px 12px; font-size: 13px; font-weight: 500;
  background: #374151; color: #e5e7eb;
}
.pf-btn:hover { background: #4b5563; }
.pf-btn.active { background: #6366f1; color: #fff; }
.pf-btn.icon { padding: 6px 9px; background: transparent; color: #9ca3af; }
.pf-btn.icon:hover { color: #fff; }
.pf-btn.gear { background: transparent; color: #d1d5db; font-size: 22px; line-height: 1; padding: 4px 8px; }
.pf-btn.gear:hover { background: transparent; color: #fff; }
.pf-count { background:#ef4444; color:#fff; border-radius:999px; font-size:11px; padding:1px 6px; margin-left:2px; }

/* Prominent primary actions (reviewer-facing) */
.pf-cta {
  border: 0; cursor: pointer; border-radius: 999px;
  padding: 9px 16px; font-size: 14px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 6px;
  background: #6366f1; color: #fff;
}
.pf-cta.tour { background: #6366f1; }
.pf-cta.tour:hover { background: #4f46e5; }
.pf-cta.tour.active { background: #4338ca; box-shadow: inset 0 0 0 2px rgba(255,255,255,.3); }
.pf-cta.feedback { background: #10b981; }
.pf-cta.feedback:hover { background: #059669; }
.pf-cta.feedback.active { background: #047857; box-shadow: inset 0 0 0 2px rgba(255,255,255,.3); }

.pf-check {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 13px; color: #374151;
  padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb;
}
.pf-check input { width: 16px; height: 16px; cursor: pointer; }

.pf-hint {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  z-index: 2147483600; background: #6366f1; color: #fff;
  padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 500;
  box-shadow: 0 4px 16px rgba(0,0,0,.25);
}

.pf-highlight {
  position: fixed; z-index: 2147483500; pointer-events: none;
  border: 2px solid #6366f1; border-radius: 4px;
  background: rgba(99,102,241,.12); transition: all .04s linear;
}

.pf-layer { position: fixed; inset: 0; z-index: 2147483550; pointer-events: none; }
.pf-pin {
  position: fixed; pointer-events: auto; cursor: pointer;
  width: 24px; height: 24px; border-radius: 50% 50% 50% 2px;
  background: #ef4444; color: #fff; font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.3); transform: translate(-50%, -100%);
}
.pf-pin.resolved { background: #10b981; }

.pf-popover {
  position: fixed; z-index: 2147483645; width: 280px;
  background: #fff; color: #111827; border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,.3); padding: 12px;
  font-size: 13px;
}
.pf-popover h4 { margin: 0 0 6px; font-size: 13px; }
.pf-popover textarea {
  width: 100%; min-height: 64px; resize: vertical; padding: 8px;
  border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit;
}
.pf-popover input[type=text] {
  width: 100%; padding: 6px 8px; border: 1px solid #d1d5db;
  border-radius: 6px; font-size: 13px; margin-bottom: 6px;
}
.pf-row { display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-top: 8px; }
.pf-primary { background: #6366f1; color: #fff; border: 0; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-weight: 500; }
.pf-primary:hover { background: #4f46e5; }
.pf-ghost { background: transparent; border: 0; color: #6b7280; cursor: pointer; padding: 7px 10px; }
.pf-ghost:hover { color: #111827; }
.pf-meta { color: #6b7280; font-size: 11px; margin-bottom: 6px; }
.pf-comment-text { white-space: pre-wrap; line-height: 1.4; }

.pf-spot {
  position: fixed; z-index: 2147483500; pointer-events: none;
  border-radius: 6px; box-shadow: 0 0 0 9999px rgba(17,24,39,.55);
  border: 2px solid #6366f1; transition: all .15s ease;
}
.pf-progress { color: #6b7280; font-size: 12px; }

/* Slide-over panel (feedback list + tour builder) */
.pf-panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 380px; max-width: 92vw;
  z-index: 2147483640; background: #fff; color: #111827;
  box-shadow: -8px 0 40px rgba(0,0,0,.3); display: flex; flex-direction: column;
}
.pf-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
.pf-panel-head h3 { font-size: 15px; margin: 0; }
.pf-panel-body { overflow-y: auto; padding: 12px 16px; flex: 1; }
.pf-panel-foot { padding: 12px 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; }

.pf-tabs { display: flex; gap: 6px; padding: 10px 16px 0; }
.pf-tab { font-size: 12px; padding: 5px 10px; border-radius: 999px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; color: #374151; }
.pf-tab.active { background: #111827; color: #fff; border-color: #111827; }

.pf-fb { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
.pf-fb .pf-comment-text { font-size: 13px; }
.pf-fb-meta { color: #6b7280; font-size: 11px; margin: 4px 0 8px; }
.pf-badge { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; font-weight: 600; }
.pf-badge.open { background: #fee2e2; color: #b91c1c; }
.pf-badge.resolved { background: #d1fae5; color: #047857; }
.pf-badge.archived { background: #e5e7eb; color: #6b7280; }
.pf-fb-actions { display: flex; gap: 6px; margin-top: 8px; }
.pf-mini { font-size: 12px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 4px 10px; cursor: pointer; color: #374151; }
.pf-mini:hover { background: #f3f4f6; }
.pf-empty { color: #6b7280; font-size: 13px; text-align: center; padding: 28px 0; }

/* Compact feedback window (bottom-left floating card) */
.pf-win {
  position: fixed; bottom: 80px; right: 16px;
  width: 320px; max-width: calc(100vw - 32px); max-height: 56vh;
  z-index: 2147483600; background: #fff; color: #111827;
  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.28);
  display: flex; flex-direction: column; overflow: hidden;
}
.pf-win.min { max-height: none; }
.pf-win.min .pf-win-body, .pf-win.min .pf-win-foot { display: none; }
.pf-win-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
.pf-win.min .pf-win-head { border-bottom: 0; }
.pf-win-head h3 { font-size: 14px; margin: 0; }
.pf-win-ctl { display: flex; align-items: center; gap: 2px; }
.pf-win-body { overflow-y: auto; padding: 8px 10px; flex: 1; }
.pf-win-foot { padding: 8px 10px; border-top: 1px solid #e5e7eb; display: flex; flex-wrap: wrap; gap: 6px; }
.pf-x { border: 0; background: transparent; color: #9ca3af; font-size: 15px; line-height: 1; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.pf-x:hover { color: #111827; background: #f3f4f6; }
.pf-mini.primary { background: #6366f1; color: #fff; border-color: #6366f1; }
.pf-mini.primary:hover { background: #4f46e5; }

/* Download dropdown */
.pf-dl { position: relative; }
.pf-dl-menu {
  display: none; position: absolute; bottom: calc(100% + 6px); left: 0; min-width: 150px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 4px; z-index: 2147483646;
}
.pf-dl-menu.open { display: block; }
.pf-dl-item {
  display: block; width: 100%; text-align: left; border: 0; background: transparent;
  padding: 7px 10px; border-radius: 6px; font-size: 13px; color: #111827; cursor: pointer;
}
.pf-dl-item:hover { background: #f3f4f6; }

/* Threaded replies — feedback rows + index badge */
.pf-fb-click { cursor: pointer; transition: background .08s ease; }
.pf-fb-click:hover { background: #f9fafb; }
.pf-fb-head { display: flex; align-items: center; gap: 8px; }
.pf-idx {
  flex: none; width: 20px; height: 20px; border-radius: 50%;
  background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.pf-idx.resolved { background: #10b981; }
.pf-idx.off { background: #e5e7eb; color: #9ca3af; }
.pf-reply-count { margin-left: auto; font-size: 12px; color: #6366f1; font-weight: 600; }
.pf-win .pf-fb { padding: 8px 10px; margin-bottom: 6px; }
.pf-win .pf-fb-meta { margin: 4px 0 6px; }
.pf-win .pf-mini { padding: 3px 8px; }

/* In-context thread popover (anchored to the element's pin) */
.pf-thread-pop { width: 300px; display: flex; flex-direction: column; gap: 8px; }
.pf-thread-head { display: flex; align-items: center; justify-content: space-between; }
.pf-thread { max-height: 40vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.pf-thread-msg { background: #f3f4f6; border-radius: 8px; padding: 8px 10px; }
.pf-reply { border-left: 2px solid #c7d2fe; margin-left: 10px; padding: 6px 0 2px 10px; }
.pf-thread .pf-comment-text { font-size: 13px; }
.pf-thread-compose { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
.pf-thread-compose .pf-primary { align-self: flex-end; }
.pf-field { margin-bottom: 8px; }
.pf-field label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 3px; }
.pf-field input, .pf-field textarea { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit; }
`;
