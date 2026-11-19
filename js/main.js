// Dear Reader — start-up, and one listener for every click, form and input.
import * as B from "./books.js";
import { app, actions, forms, live, render, closeSheet, isSheetOpen } from "./core.js";
import { shell } from "./views.js";
import { applyLook, renderUnlock, renderSetup, renderSharedWishlist, bookSheet, yearCard } from "./flows.js";
import { blankState } from "./model.js";
import { demoState } from "./demo.js";
import * as store from "./store.js";

const params = new URLSearchParams(location.search);
app.demo = params.has("demo");
app.photo = app.demo && params.has("photo");
app.view = "home";

function renderApp() { const y = scrollY; document.getElementById("app").innerHTML = shell(); fitShelves(); if (y) scrollTo(0, y); }

// Shelves: put as many spines on each shelf as fit the screen, then start a new shelf.
function fitShelves() {
  const cs = document.querySelector(".case[data-fit]");
  const first = cs && cs.querySelector(".shelf"), spines = cs ? [...cs.querySelectorAll(".spine")] : [];
  if (!spines.length) return;
  const st = getComputedStyle(first), gap = parseFloat(st.columnGap) || 0;
  const room = first.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
  const rows = []; let row = [], used = 0;
  for (const s of spines) { const w = s.offsetWidth + gap; if (row.length && used + s.offsetWidth > room) { rows.push(row); row = []; used = 0; } row.push(s); used += w; }
  rows.push(row);
  cs.replaceChildren(...rows.map(r => { const d = document.createElement("div"); d.className = "shelf"; d.append(...r); return d; }));
}
let fitTimer; addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitShelves, 150); });
app.start = () => { app.renderFn = renderApp; applyLook(); renderApp(); if (app.demo) demoExtras(); };

// Demo only: open a given screen straight away (for listing photos and videos).
//   ?demo&photo  &look=reading_nook  &view=library  &shelf=all  &open=scan | add | book:<title> | finish:<title> | year | import
function demoExtras() {
  const look = params.get("look"), view = params.get("view"), open = params.get("open") || "";
  if (look) { app.S.profile.look = look; applyLook(); }
  if (params.get("shelf")) app.shelfShow = params.get("shelf");
  if (view) app.view = view;
  if (look || view || params.get("shelf")) render();
  const fire = (act, data = {}) => { const el = document.createElement("button"); Object.assign(el.dataset, data); actions[act]?.(el); };
  const byTitle = t => app.S.books.find(b => b.title.toLowerCase() === t.toLowerCase());
  if (open === "scan") { fire("add-book", { mode: "scan" }); setTimeout(() => fire("demo-scan"), 50); }
  if (open === "add") fire("add-book", { mode: "search", q: params.get("q") || "" });
  if (open.startsWith("book:")) { const b = byTitle(open.slice(5)); if (b) bookSheet(b); }
  if (open.startsWith("finish:")) { const b = byTitle(open.slice(7)); if (b) fire("finish", { id: b.id }); }
  if (open === "year") fire("year-card", { year: String(B.yearOf(app.today)) });
  if (open === "import") fire("import");
  if (open === "yearcard") yearCard(B.yearOf(app.today)).then(blob => { document.body.style.margin = "0"; document.body.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="" style="display:block;width:1080px;height:1920px">`; });
}

document.addEventListener("click", e => {
  const scrim = e.target.closest("[data-scrim]");
  if (scrim && e.target === scrim) { closeSheet(); return; }
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("submit", e => { const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault(); forms[f.dataset.form]?.(f, e); });
const isChoice = el => el.type === "checkbox" || el.type === "radio" || el.tagName === "SELECT";
document.addEventListener("input", e => { const el = e.target.closest("[data-live]"); if (el && !isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("change", e => { const el = e.target.closest("[data-live]"); if (el && isChoice(el)) live[el.dataset.live]?.(el, e); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && isSheetOpen()) closeSheet(); });
function checkDay() { const t = B.todayISO(); if (t !== app.today) { app.today = t; if (app.renderFn && !isSheetOpen()) render(); } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDay(); });
setInterval(checkDay, 60000);

async function boot() {
  app.today = B.todayISO();
  if (location.hash.startsWith("#w=") && renderSharedWishlist(location.hash)) return;
  if (app.demo) { app.S = demoState(app.today); app.start(); return; }
  const s = await store.load();
  app.S = s || blankState();
  applyLook();
  if (!s || !s.meta.unlocked) return renderUnlock();
  if (!s.meta.setupDone) return renderSetup();
  app.start();
}
boot().catch(err => {
  console.error(err);
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card"><h1 class="fr" style="color:var(--head)">Something went wrong</h1><p style="margin:.6rem 0 1rem">Your books are safe on this device. Try reloading. If it keeps happening, message the shop with this: ${String(err && err.message || err).replace(/[<>&]/g, "")}</p><button class="btn primary" onclick="location.reload()">Reload</button></div></div>`;
});
if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
