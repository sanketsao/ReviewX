"use strict";(()=>{var x=d=>window.CSS&&CSS.escape?CSS.escape(d):d.replace(/([^\w-])/g,"\\$1");function S(d){try{return document.querySelectorAll(d).length===1}catch(e){return!1}}function u(d){let e=[],t=d;for(;t&&t.nodeType===1&&t.tagName.toLowerCase()!=="html";){if(t.id&&S(`#${x(t.id)}`)){e.unshift(`#${x(t.id)}`);break}let r=t.tagName.toLowerCase(),s=t.parentElement;if(s){let a=Array.prototype.filter.call(s.children,p=>p.tagName===t.tagName);a.length>1&&(r+=`:nth-of-type(${a.indexOf(t)+1})`)}if(e.unshift(r),t===document.body)break;t=s}let o=e.join(" > "),i=(d.textContent||"").replace(/\s+/g," ").trim().slice(0,60);return{selector:o,tag:d.tagName.toLowerCase(),text:i}}function h(d){try{let e=document.querySelector(d.selector);if(e)return e}catch(e){}if(d.text){let t=Array.prototype.slice.call(document.querySelectorAll(d.tag||"*")).find(o=>(o.textContent||"").replace(/\s+/g," ").trim().includes(d.text));if(t)return t}return null}function n(d,e={},...t){let o=document.createElement(d);for(let[i,r]of Object.entries(e))i.startsWith("on")&&typeof r=="function"?o.addEventListener(i.slice(2).toLowerCase(),r):i==="class"?o.className=String(r):r===!0?o.setAttribute(i,""):r!==!1&&o.setAttribute(i,String(r));for(let i of t)o.append(typeof i=="string"?document.createTextNode(i):i);return o}var m=`
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

/* Threaded replies \u2014 feedback rows + index badge */
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
`;var g=class{constructor(e){this.backend=e;this.mode="off";this.feedbacks=[];this.tour=[];this.settings={autoStartTour:!0};this.role="reviewer";this.author=localStorage.getItem("pf_author")||"";this.tourIndex=0;this.collapsed=!1;this.feedbackMin=!1;this.tourNavigating=!1;this.highlight=null;this.popover=null;this.spotlight=null;this.hint=null;this.panelEl=null;this.rafId=0;this.onNav=()=>{this.tourNavigating||(this.endTour(),this.closePopover(),this.renderControls(),this.renderPins(),this.mode==="review"&&this.panelEl&&this.renderFeedbackPanel())};this.onKey=e=>{e.key==="Escape"&&(this.popover?this.closePopover():this.setMode("off"))};this.onMove=e=>{if(this.mode!=="feedback")return;let t=e.target;if(!t||this.isOurs(t)){this.clearHighlight();return}let o=t.getBoundingClientRect();this.highlight||(this.highlight=n("div",{class:"pf-highlight"}),this.root.append(this.highlight)),Object.assign(this.highlight.style,{left:`${o.left}px`,top:`${o.top}px`,width:`${o.width}px`,height:`${o.height}px`})};this.onPick=e=>{if(this.mode!=="feedback")return;let t=e.target;!t||this.isOurs(t)||(e.preventDefault(),e.stopPropagation(),this.clearHighlight(),this.openCommentForm(t,e.clientX,e.clientY))};this.scheduleReposition=()=>{cancelAnimationFrame(this.rafId),this.rafId=requestAnimationFrame(()=>{this.mode==="tour"?this.positionSpotlight():this.positionPins()})};this.host=document.createElement("div"),this.host.id="protofeedback-host",document.documentElement.appendChild(this.host),this.root=this.host.attachShadow({mode:"open"}),this.root.append(n("style",{},m)),this.layer=n("div",{class:"pf-layer"}),this.root.append(this.layer),this.role=this.resolveRole()}resolveRole(){try{let e=new URLSearchParams(location.search).get("pf");if(e==="author"||e==="reviewer")return localStorage.setItem("pf_role",e),e;let t=window.__PF_ROLE;if(t==="author"||t==="reviewer")return t;if(localStorage.getItem("pf_role")==="author")return"author"}catch(e){}return"reviewer"}async init(){this.renderControls(),await this.refreshFeedback();try{this.tour=(await this.backend.listTour()).sort((e,t)=>e.order-t.order)}catch(e){this.tour=[]}try{this.settings=await this.backend.getSettings()}catch(e){}this.renderControls(),window.addEventListener("scroll",this.scheduleReposition,!0),window.addEventListener("resize",this.scheduleReposition),window.addEventListener("hashchange",this.onNav),window.addEventListener("popstate",this.onNav),this.maybeAutoStartTour()}maybeAutoStartTour(){if(this.role==="reviewer"&&!(!this.settings.autoStartTour||!this.tour.length)){try{if(sessionStorage.getItem("pf_toured"))return}catch(e){}this.collapsed=!1,this.setMode("tour")}}get page(){return(location.pathname||"/")+(location.hash||"")}isOurs(e){return e===this.host||e instanceof Node&&this.host.contains(e)}renderControls(){let e=this.feedbacks.filter(s=>s.status==="open"&&s.page===this.page).length,t=this.feedbacks.filter(s=>s.status==="open").length,o=n("button",{class:`pf-launcher ${this.collapsed?"":"hidden"}`,onclick:()=>this.setCollapsed(!1)},n("span",{class:"pf-dot"}),"Prototype Review",e?n("span",{class:"pf-count"},String(e)):document.createTextNode(""));this.launcher?this.launcher.replaceWith(o):this.root.append(o),this.launcher=o;let i=[n("button",{class:`pf-cta feedback ${this.mode==="feedback"?"active":""}`,onclick:()=>this.setMode(this.mode==="feedback"?"off":"feedback")},"\u{1F4AC} Give feedback")];this.role==="author"&&i.push(n("button",{class:`pf-btn ${this.mode==="review"?"active":""}`,title:"Review comments on the page",onclick:()=>this.toggleReview()},"Comments",t?n("span",{class:"pf-count"},String(t)):document.createTextNode(""))),i.push(n("button",{class:`pf-cta tour ${this.mode==="tour"?"active":""}`,onclick:()=>this.setMode(this.mode==="tour"?"off":"tour")},this.tour.length?`\u25B6 Take the tour (${this.tour.length})`:"\u25B6 Take the tour")),this.role==="author"&&i.push(n("button",{class:"pf-btn gear",title:"Create a guided tour",onclick:()=>this.openTourBuilder()},"\u2699")),i.push(n("button",{class:"pf-btn icon",title:"Hide overlay",onclick:()=>this.setCollapsed(!0)},"\xD7"));let r=n("div",{class:`pf-banner ${this.collapsed?"hidden":""}`},...i);this.banner?this.banner.replaceWith(r):this.root.append(r),this.banner=r}setCollapsed(e){this.collapsed=e,e?this.setMode("off"):this.renderControls()}setMode(e){this.exitFeedback(),this.endTour(),this.mode==="review"&&e!=="review"&&(this.closePanel(),this.closePopover()),this.mode=e,this.renderControls(),e==="feedback"&&this.enterFeedback(),e==="tour"&&this.startTour(),this.renderPins()}async toggleReview(){if(this.mode==="review"){this.setMode("off");return}this.setMode("review"),this.feedbackMin=!1,await this.refreshFeedback(),this.renderPins(),this.renderFeedbackPanel();let e=this.feedbacks.filter(t=>t.page===this.page&&t.status!=="archived").length;this.flash(e?"Click a numbered bubble to open its thread.":"No comments on this page yet.")}showHint(e){this.clearHint(),this.hint=n("div",{class:"pf-hint"},e),this.root.append(this.hint)}clearHint(){var e;(e=this.hint)==null||e.remove(),this.hint=null}flash(e){this.showHint(e),setTimeout(()=>this.clearHint(),1500)}enterFeedback(){this.showHint("Feedback mode: click any element to leave a comment. Esc to exit."),document.addEventListener("mousemove",this.onMove,!0),document.addEventListener("click",this.onPick,!0),document.addEventListener("keydown",this.onKey,!0),this.renderPins()}exitFeedback(){document.removeEventListener("mousemove",this.onMove,!0),document.removeEventListener("click",this.onPick,!0),document.removeEventListener("keydown",this.onKey,!0),this.clearHighlight(),this.clearHint()}clearHighlight(){var e;(e=this.highlight)==null||e.remove(),this.highlight=null}openCommentForm(e,t,o){this.closePopover();let i=u(e),r=n("input",{type:"text",placeholder:"Your name",value:this.author}),s=n("textarea",{placeholder:"What should change here?"}),a=async()=>{let c=s.value.trim();c&&(this.author=r.value.trim()||"Anonymous",localStorage.setItem("pf_author",this.author),await this.backend.createFeedback({anchor:i,text:c,author:this.author,page:this.page}),this.closePopover(),await this.refreshFeedback(),this.renderControls(),this.renderPins())},p=n("div",{class:"pf-popover"},n("h4",{},"New comment"),r,s,n("div",{class:"pf-row"},n("button",{class:"pf-ghost",onclick:()=>this.closePopover()},"Cancel"),n("button",{class:"pf-primary",onclick:a},"Comment")));this.placePopover(p,t,o),this.popover=p,this.root.append(p),s.focus()}placePopover(e,t,o){let r=Math.min(Math.max(8,t),window.innerWidth-300-8),s=Math.min(Math.max(8,o),window.innerHeight-220);Object.assign(e.style,{left:`${r}px`,top:`${s}px`})}closePopover(){var e;(e=this.popover)==null||e.remove(),this.popover=null}async refreshFeedback(){try{this.feedbacks=await this.backend.listFeedback()}catch(e){this.feedbacks=[]}}onPageFeedback(){return this.feedbacks.filter(e=>e.page===this.page&&e.status!=="archived")}renderPins(){if(this.layer.innerHTML="",this.mode==="off"){this.stopReposition();return}this.onPageFeedback().forEach((t,o)=>{if(!h(t.anchor))return;let r=n("div",{class:`pf-pin ${t.status==="resolved"?"resolved":""}`,onclick:s=>{s.stopPropagation(),this.openPinPopover(t,r)}},String(o+1));r.dataset.id=t.id,this.layer.append(r)}),this.positionPins(),this.scheduleReposition()}positionPins(){let e=Array.from(this.layer.children);for(let t of e){let o=this.feedbacks.find(s=>s.id===t.dataset.id);if(!o)continue;let i=h(o.anchor),r=i==null?void 0:i.getBoundingClientRect();if(!i||!r||r.width===0&&r.height===0){t.style.display="none";continue}t.style.display="flex",t.style.left=`${r.left+r.width}px`,t.style.top=`${r.top}px`}}stopReposition(){cancelAnimationFrame(this.rafId)}openPinPopover(e,t){this.closePopover();let o=t.getBoundingClientRect(),i=this.buildThreadPopover(e);this.placePopover(i,o.left,o.top+24),this.popover=i,this.root.append(i)}buildThreadPopover(e){let t=e.replies||[],o=n("div",{class:"pf-thread"},n("div",{class:"pf-thread-msg"},n("div",{class:"pf-meta"},`${e.author} \xB7 ${new Date(e.createdAt).toLocaleString()}`),n("div",{class:"pf-comment-text"},e.text)),...t.map(c=>n("div",{class:"pf-reply"},n("div",{class:"pf-meta"},`${c.author} \xB7 ${new Date(c.createdAt).toLocaleString()}`),n("div",{class:"pf-comment-text"},c.text)))),i=n("input",{type:"text",placeholder:"Your name",value:this.author}),r=n("textarea",{placeholder:"Reply\u2026"}),s=async()=>{let c=r.value.trim();if(c){this.author=i.value.trim()||"Anonymous",localStorage.setItem("pf_author",this.author);try{let l=await this.backend.addReply(e.id,{author:this.author,text:c});await this.refreshFeedback(),this.refreshThreadPopover(l),this.panelEl&&this.renderFeedbackPanel()}catch(l){this.flash("Could not send reply.")}}},a=n("button",{class:"pf-ghost",onclick:()=>this.setStatusInThread(e,e.status==="resolved"?"open":"resolved")},e.status==="resolved"?"Reopen":"Resolve"),p=n("button",{class:"pf-ghost",onclick:()=>this.setStatusInThread(e,e.status==="archived"?"open":"archived")},e.status==="archived"?"Unarchive":"Archive");return n("div",{class:"pf-popover pf-thread-pop"},n("div",{class:"pf-thread-head"},n("span",{class:`pf-badge ${e.status}`},e.status),n("button",{class:"pf-ghost",onclick:()=>this.closePopover()},"Close")),o,n("div",{class:"pf-thread-compose"},i,r,n("button",{class:"pf-primary",onclick:s},"Reply")),n("div",{class:"pf-row"},a,p))}refreshThreadPopover(e){if(!this.popover)return;let{left:t,top:o}=this.popover.style,i=this.buildThreadPopover(e);i.style.left=t,i.style.top=o,this.popover.replaceWith(i),this.popover=i}async setStatusInThread(e,t){await this.backend.updateFeedback(e.id,{status:t}),await this.refreshFeedback(),this.renderControls(),this.renderPins();let o=this.feedbacks.find(i=>i.id===e.id);o&&o.status!=="archived"?this.refreshThreadPopover(o):this.closePopover(),this.panelEl&&this.renderFeedbackPanel()}closePanel(){var e;(e=this.panelEl)==null||e.remove(),this.panelEl=null}renderFeedbackPanel(){this.closePanel();let e=this.onPageFeedback(),t=this.feedbacks.filter(s=>!e.includes(s)).sort((s,a)=>a.createdAt.localeCompare(s.createdAt)),o=[...e,...t],i=n("div",{class:"pf-win-body"});o.length||i.append(n("div",{class:"pf-empty"},"No feedback yet.")),o.forEach(s=>i.append(this.feedbackRow(s,e.indexOf(s))));let r=n("div",{class:`pf-win ${this.feedbackMin?"min":""}`},n("div",{class:"pf-win-head"},n("h3",{},`Comments (${o.length})`),n("div",{class:"pf-win-ctl"},n("button",{class:"pf-x",title:this.feedbackMin?"Expand":"Minimize",onclick:()=>{this.feedbackMin=!this.feedbackMin,this.renderFeedbackPanel()}},this.feedbackMin?"\u25A2":"\u2014"),n("button",{class:"pf-x",title:"Close",onclick:()=>this.setMode("off")},"\xD7"))),i,n("div",{class:"pf-win-foot"},...this.exportControls()));this.panelEl=r,this.root.append(r)}exportControls(){let e=n("div",{class:"pf-dl-menu"},n("button",{class:"pf-dl-item",onclick:()=>{this.downloadExcel(),e.classList.remove("open")}},"Excel (.xlsx)"),n("button",{class:"pf-dl-item",onclick:()=>{this.downloadCsv(),e.classList.remove("open")}},"CSV (.csv)"),n("button",{class:"pf-dl-item",onclick:()=>{this.downloadJson(),e.classList.remove("open")}},"JSON (.json)")),t=n("button",{class:"pf-mini primary",onclick:i=>{i.stopPropagation(),e.classList.toggle("open")}},"Download \u25BE"),o=n("button",{class:"pf-mini",title:"Copy feedback as Markdown for an AI",onclick:()=>this.copyMarkdown()},"Copy Markdown");return[n("div",{class:"pf-dl"},t,e),o]}feedbackRows(){let e=["Page","Author","Comment","Status","Created","Element","Replies"],t=this.feedbacks.map(o=>{var i;return[o.page,o.author,o.text,o.status,new Date(o.createdAt).toLocaleString(),((i=o.anchor)==null?void 0:i.selector)||"",(o.replies||[]).map(r=>`${r.author}: ${r.text}`).join(" | ")]});return{head:e,body:t}}downloadExcel(){let e=this.backend.exportXlsxUrl();if(e){let a=document.createElement("a");a.href=e,a.download="feedback.xlsx",a.click();return}let t=a=>String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),{head:o,body:i}=this.feedbackRows(),r=(a,p)=>`<tr>${a.map(c=>`<${p}>${t(c)}</${p}>`).join("")}</tr>`,s=`<html><head><meta charset="utf-8"></head><body><table>${r(o,"th")}${i.map(a=>r(a,"td")).join("")}</table></body></html>`;this.downloadText("feedback.xls",s,"application/vnd.ms-excel")}downloadCsv(){let e=r=>`"${String(r).replace(/"/g,'""')}"`,{head:t,body:o}=this.feedbackRows(),i=[t,...o].map(r=>r.map(e).join(",")).join(`\r
`);this.downloadText("feedback.csv","\uFEFF"+i,"text/csv;charset=utf-8")}downloadJson(){this.downloadText("feedback.json",JSON.stringify(this.feedbacks,null,2),"application/json")}feedbackMarkdown(){let e=["# Prototype feedback",""];for(let t of this.feedbacks){e.push(`- **[${t.status}]** ${t.text.replace(/\s*\n\s*/g," ")}`),e.push(`  - ${t.author} \xB7 \`${t.page}\` \xB7 ${new Date(t.createdAt).toLocaleString()}`),e.push(`  - element: \`${t.anchor.selector}\``);for(let o of t.replies||[])e.push(`  - \u21B3 **${o.author}**: ${o.text.replace(/\s*\n\s*/g," ")} _(${new Date(o.createdAt).toLocaleString()})_`)}return e.join(`
`)+`
`}async copyMarkdown(){let e=this.feedbackMarkdown();try{await navigator.clipboard.writeText(e),this.flash("Copied feedback as Markdown.")}catch(t){this.downloadText("feedback.md",e,"text/markdown")}}downloadText(e,t,o){let i=new Blob([t],{type:o}),r=URL.createObjectURL(i),s=document.createElement("a");s.href=r,s.download=e,s.click(),setTimeout(()=>URL.revokeObjectURL(r),1e3)}feedbackRow(e,t){var s;let o=((s=e.replies)==null?void 0:s.length)||0,i=a=>p=>{p.stopPropagation(),a()},r=t>=0?n("span",{class:`pf-idx ${e.status==="resolved"?"resolved":""}`},String(t+1)):n("span",{class:"pf-idx off",title:"On another page"},"\xB7");return n("div",{class:"pf-fb pf-fb-click",title:"Show on page & open thread",onclick:()=>this.revealThread(e.id)},n("div",{class:"pf-fb-head"},r,n("span",{class:`pf-badge ${e.status}`},e.status),o?n("span",{class:"pf-reply-count"},`\u{1F4AC} ${o}`):document.createTextNode("")),n("div",{class:"pf-comment-text"},e.text),n("div",{class:"pf-fb-meta"},`${e.author}${t>=0?"":` \xB7 ${e.page}`} \xB7 ${new Date(e.createdAt).toLocaleString()}`),n("div",{class:"pf-fb-actions"},n("button",{class:"pf-mini",onclick:i(()=>this.setStatus(e,e.status==="resolved"?"open":"resolved"))},e.status==="resolved"?"Reopen":"Resolve"),n("button",{class:"pf-mini",onclick:i(()=>this.setStatus(e,e.status==="archived"?"open":"archived"))},e.status==="archived"?"Unarchive":"Archive")))}async setStatus(e,t){await this.backend.updateFeedback(e.id,{status:t}),await this.refreshFeedback(),this.renderControls(),this.renderPins(),this.renderFeedbackPanel()}revealThread(e){let t=this.feedbacks.find(i=>i.id===e);if(!t)return;this.mode!=="review"&&(this.setMode("review"),this.renderPins());let o=h(t.anchor);o&&o.scrollIntoView({behavior:"smooth",block:"center"}),setTimeout(()=>{this.positionPins();let i=Array.from(this.layer.children).find(r=>r.dataset.id===e);if(i&&i.style.display!=="none")this.openPinPopover(t,i);else{this.closePopover();let r=this.buildThreadPopover(t);this.placePopover(r,window.innerWidth/2-150,80),this.popover=r,this.root.append(r)}},o?320:0)}async openTourBuilder(){this.setMode("off");try{this.tour=(await this.backend.listTour()).sort((e,t)=>e.order-t.order)}catch(e){this.tour=[]}this.renderTourBuilder()}renderTourBuilder(){this.closePanel();let e=n("div",{class:"pf-panel-body"}),t=n("input",{type:"checkbox"});t.checked=this.settings.autoStartTour,t.addEventListener("change",async()=>{this.settings.autoStartTour=t.checked;try{this.settings=await this.backend.saveSettings({autoStartTour:t.checked})}catch(i){}}),e.append(n("label",{class:"pf-check"},t,"Start tour automatically for reviewers")),this.tour.length||e.append(n("div",{class:"pf-empty"},'No steps yet. Click "+ Add step", then click an element.')),this.tour.forEach((i,r)=>e.append(this.tourStepRow(i,r)));let o=n("div",{class:"pf-panel"},n("div",{class:"pf-panel-head"},n("h3",{},"Tour builder"),n("button",{class:"pf-mini",onclick:()=>this.closePanel()},"Close")),e,n("div",{class:"pf-panel-foot"},n("button",{class:"pf-mini",onclick:()=>this.addTourStep()},"+ Add step"),n("button",{class:"pf-primary",onclick:()=>this.saveTour()},"Save tour")));this.panelEl=o,this.root.append(o)}tourStepRow(e,t){let o=n("input",{type:"text",value:e.title||""});o.placeholder="Step title",o.addEventListener("input",()=>e.title=o.value);let i=n("textarea",{});return i.value=e.body||"",i.placeholder="Description",i.addEventListener("input",()=>e.body=i.value),n("div",{class:"pf-fb"},n("div",{class:"pf-fb-meta"},`Step ${t+1} \xB7 ${e.anchor.selector||"(no element)"} \xB7 ${e.page}`),n("div",{class:"pf-field"},n("label",{},"Title"),o),n("div",{class:"pf-field"},n("label",{},"Description"),i),n("div",{class:"pf-fb-actions"},n("button",{class:"pf-mini",onclick:()=>this.reorderStep(t,-1)},"\u2191"),n("button",{class:"pf-mini",onclick:()=>this.reorderStep(t,1)},"\u2193"),n("button",{class:"pf-mini",onclick:()=>this.pickForStep(e)},"Re-pick"),n("button",{class:"pf-mini",onclick:()=>this.deleteStep(t)},"Delete")))}async addTourStep(){let e=await this.pickAnchor();e&&this.tour.push({id:`pf-${Date.now()}`,anchor:e,title:"",body:"",order:this.tour.length,page:this.page}),this.renderTourBuilder()}async pickForStep(e){let t=await this.pickAnchor();t&&(e.anchor=t,e.page=this.page),this.renderTourBuilder()}reorderStep(e,t){let o=e+t;o<0||o>=this.tour.length||([this.tour[e],this.tour[o]]=[this.tour[o],this.tour[e]],this.renderTourBuilder())}deleteStep(e){this.tour.splice(e,1),this.renderTourBuilder()}async saveTour(){this.tour.forEach((e,t)=>e.order=t);try{this.tour=await this.backend.saveTour(this.tour),this.showHint("Tour saved."),setTimeout(()=>this.clearHint(),1500)}catch(e){this.showHint("Could not save tour.")}this.renderControls(),this.closePanel()}pickAnchor(){return new Promise(e=>{let t=this.panelEl;t&&(t.style.display="none"),this.showHint("Click an element to attach this step. Esc to cancel.");let o=()=>{document.removeEventListener("mousemove",i,!0),document.removeEventListener("click",r,!0),document.removeEventListener("keydown",s,!0),this.clearHighlight(),this.clearHint(),t&&(t.style.display="")},i=a=>{let p=a.target;if(!p||this.isOurs(p)){this.clearHighlight();return}let c=p.getBoundingClientRect();this.highlight||(this.highlight=n("div",{class:"pf-highlight"}),this.root.append(this.highlight)),Object.assign(this.highlight.style,{left:`${c.left}px`,top:`${c.top}px`,width:`${c.width}px`,height:`${c.height}px`})},r=a=>{let p=a.target;!p||this.isOurs(p)||(a.preventDefault(),a.stopPropagation(),o(),e(u(p)))},s=a=>{a.key==="Escape"&&(o(),e(null))};document.addEventListener("mousemove",i,!0),document.addEventListener("click",r,!0),document.addEventListener("keydown",s,!0)})}startTour(){if(!this.tour.length){this.showHint("No tour steps yet. The author can add them with the \u2699 button."),this.mode="off",this.renderControls();return}this.tourIndex=0,this.showStep()}showStep(){this.closePopover();let e=this.tour[this.tourIndex];if(!e)return this.endTour();if(e.page&&e.page!==this.page&&e.page.includes("#")&&this.samePath(e.page)){this.tourNavigating=!0,location.hash=e.page.slice(e.page.indexOf("#")),setTimeout(()=>{this.tourNavigating=!1,this.renderPins(),this.renderResolvedStep(e)},400);return}this.renderResolvedStep(e)}samePath(e){return(e.split("#")[0]||"/")===(location.pathname||"/")}renderResolvedStep(e){let t=h(e.anchor);t&&t.scrollIntoView({behavior:"smooth",block:"center"}),setTimeout(()=>this.renderStep(e,t),t?300:0)}renderStep(e,t){this.closePopover(),this.positionSpotlight(t);let o=this.tourIndex===this.tour.length-1,i=this.tourIndex===0,r=n("div",{class:"pf-popover"},n("div",{class:"pf-progress"},`Step ${this.tourIndex+1} of ${this.tour.length}`),n("h4",{},e.title||"Untitled step"),n("div",{class:"pf-comment-text"},e.body||""),n("div",{class:"pf-row"},n("button",{class:"pf-ghost",onclick:()=>this.endTour()},"Exit"),n("div",{},i?document.createTextNode(""):n("button",{class:"pf-ghost",onclick:()=>this.step(-1)},"Back"),n("button",{class:"pf-primary",onclick:()=>o?this.endTour():this.step(1)},o?"Done":"Next")))),s=window.innerWidth/2-140,a=window.innerHeight-240;if(t){let p=t.getBoundingClientRect();s=p.left,a=p.bottom+12}this.placePopover(r,s,a),this.popover=r,this.root.append(r),this.scheduleReposition()}positionSpotlight(e){var r;let t=this.tour[this.tourIndex],o=e!==void 0?e:t?h(t.anchor):null;if(!o){(r=this.spotlight)==null||r.remove(),this.spotlight=null;return}this.spotlight||(this.spotlight=n("div",{class:"pf-spot"}),this.root.append(this.spotlight));let i=o.getBoundingClientRect();Object.assign(this.spotlight.style,{left:`${i.left-4}px`,top:`${i.top-4}px`,width:`${i.width+8}px`,height:`${i.height+8}px`})}step(e){this.tourIndex=Math.max(0,Math.min(this.tour.length-1,this.tourIndex+e)),this.showStep()}endTour(){var e;if((e=this.spotlight)==null||e.remove(),this.spotlight=null,this.closePopover(),this.mode==="tour"){try{sessionStorage.setItem("pf_toured","1")}catch(t){}this.mode="off",this.renderControls()}}};function v(d){let e=()=>{window.__pfLoaded||(window.__pfLoaded=!0,new g(d).init())};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",e):e()}var k={autoStartTour:!0};function w(d){return`${d}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}function E(d="/__pf"){async function e(o){let i=await fetch(`${d}${o}`,{headers:{Accept:"application/json"}});if(!i.ok)throw new Error(`GET ${o} -> ${i.status}`);return i.json()}async function t(o,i,r){let s=await fetch(`${d}${i}`,{method:o,headers:{"Content-Type":"application/json"},body:JSON.stringify(r)});if(!s.ok)throw new Error(`${o} ${i} -> ${s.status}`);return s.json()}return{label:"this project (server)",shared:!0,listFeedback:()=>e("/feedback"),createFeedback:o=>t("POST","/feedback",o),updateFeedback:(o,i)=>t("PATCH",`/feedback/${o}`,i),addReply:(o,i)=>t("POST",`/feedback/${o}/replies`,i),listTour:()=>e("/tour"),saveTour:o=>t("PUT","/tour",{steps:o}),getSettings:()=>e("/settings"),saveSettings:o=>t("PUT","/settings",o),exportXlsxUrl:()=>`${d}/feedback.xlsx`}}function P(d){let e=`reviewx:${d}`,t=(i,r)=>{try{let s=localStorage.getItem(`${e}:${i}`);return s?JSON.parse(s):r}catch(s){return r}},o=(i,r)=>{try{localStorage.setItem(`${e}:${i}`,JSON.stringify(r))}catch(s){}};return{label:"this browser (local)",shared:!1,async listFeedback(){return t("feedback",[])},async createFeedback(i){let r=t("feedback",[]),s={...i,id:w("fb"),status:"open",createdAt:new Date().toISOString()};return r.push(s),o("feedback",r),s},async updateFeedback(i,r){let s=t("feedback",[]),a=s.find(p=>p.id===i);if(!a)throw new Error("not found");return r.status&&(a.status=r.status),typeof r.text=="string"&&(a.text=r.text),o("feedback",s),a},async addReply(i,r){let s=t("feedback",[]),a=s.find(c=>c.id===i);if(!a)throw new Error("not found");let p={id:w("rp"),author:r.author||"Anonymous",text:r.text,createdAt:new Date().toISOString()};return a.replies=[...a.replies||[],p],o("feedback",s),a},async listTour(){return t("tour",[])},async saveTour(i){return o("tour",i),i},async getSettings(){return{...k,...t("settings",{})}},async saveSettings(i){let r={...k,...t("settings",{}),...i};return o("settings",r),r},exportXlsxUrl:()=>null}}function $(d,e,t){let o=d.replace(/\/$/,""),i=`project=${encodeURIComponent(e)}`,r=t?{"X-PF-Token":t}:{};async function s(p){let c=p.includes("?")?"&":"?",l=await fetch(`${o}${p}${c}${i}`,{headers:{Accept:"application/json",...r}});if(!l.ok)throw new Error(`GET ${p} -> ${l.status}`);return l.json()}async function a(p,c,l){let f=await fetch(`${o}${c}`,{method:p,headers:{"Content-Type":"application/json",...r},body:JSON.stringify({project:e,...l})});if(!f.ok)throw new Error(`${p} ${c} -> ${f.status}`);return f.json()}return{label:"shared inbox",shared:!0,listFeedback:()=>s("/feedback"),createFeedback:p=>a("POST","/feedback",{...p}),updateFeedback:(p,c)=>a("PATCH",`/feedback/${p}`,{...c}),addReply:(p,c)=>a("POST",`/feedback/${p}/replies`,{...c}),listTour:()=>s("/tour"),saveTour:p=>a("PUT","/tour",{steps:p}),getSettings:()=>s("/settings"),saveSettings:p=>a("PUT","/settings",{...p}),exportXlsxUrl:()=>null}}function y(){let d=window.ReviewX||{},e={};try{let t=document.currentScript||document.querySelector("script[data-reviewx]")||document.querySelector('script[src*="reviewx"]'),o=t==null?void 0:t.dataset;o&&(o.backend&&(e.backend=o.backend),o.endpoint&&(e.endpoint=o.endpoint),o.project&&(e.project=o.project),o.role&&(e.role=o.role),o.token&&(e.token=o.token))}catch(t){}return{...e,...d}}function T(d){let e=d.project||location.host||"default",t=d.backend||(d.endpoint?"rest":"local");return t==="http"?E():t==="rest"&&d.endpoint?$(d.endpoint,e,d.token):P(e)}var b=y();b.role&&(window.__PF_ROLE=b.role);v(T(b));})();
