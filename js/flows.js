// Dear Reader — everything that opens in a sheet, plus unlock, setup and the shared wishlist page.
import * as B from "./books.js";
import { app, actions, forms, live, esc, money, fmt, fd, fdShort, parseMoney, commit, render, toast, openSheet, updateSheet, closeSheet, sheetHead, shareOrDownload, pickFile, isIOS, isStandalone } from "./core.js";
import { uid, blankState, newBook, normalise, STATUSES, FORMATS, SOURCES, TROPES, MOODS, CURRENCIES } from "./model.js";
import { LOOKS, GENRES } from "./looks.js";
import { cover, stars, chilli, ratingText, progressText, STATUS_LABEL, genreColor } from "./ui.js";
import { libraryGrid, ETSY_URL } from "./views.js";
import { byISBN, search as searchBooks } from "./lookup.js";
import { startScan, canScan } from "./scan.js";
import { readFile, plan as importPlan, SOURCE_NAMES } from "./importers.js";
import { DEMO_SCAN } from "./demo.js";
import * as store from "./store.js";

const S = () => app.S;
const num = v => { const n = parseMoney(v); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
const val = (f, n) => f.elements[n]?.value ?? "";
const findById = id => S().books.find(b => b.id === id);

// ============ Navigation, looks, filters ============
actions["nav"] = el => { app.view = el.dataset.view; render(); scrollTo({ top: 0 }); };
actions["close-sheet"] = () => closeSheet();
export function applyLook() {
  const P = S()?.profile || {}, h = document.documentElement;
  h.dataset.look = P.look in LOOKS ? P.look : "academia";
  P.bigText ? h.setAttribute("data-big", "") : h.removeAttribute("data-big");
  P.easyFont ? h.setAttribute("data-easy", "") : h.removeAttribute("data-easy");
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(h).getPropertyValue("--card").trim() || "#FBF8F1";
}
actions["set-look"] = el => commit(s => { s.profile.look = el.dataset.v; applyLook(); });
actions["set-big"] = () => commit(s => { s.profile.bigText = !s.profile.bigText; applyLook(); });
actions["set-easy"] = () => commit(s => { s.profile.easyFont = !s.profile.easyFont; applyLook(); });
actions["set-spice"] = () => commit(s => { s.profile.spice = !s.profile.spice; });
actions["lib-filter"] = el => { app.libFilter = el.dataset.v; render(); };
actions["shelf-show"] = el => { app.shelfShow = el.dataset.v; render(); };
live["lib-q"] = el => { app.libQuery = el.value; const g = document.getElementById("lib-grid"); if (g) g.innerHTML = libraryGrid(); };
live["lib-genre"] = el => { app.libGenre = el.value; render(); };
live["lib-sort"] = el => { app.libSort = el.value; render(); };
live["stats-year"] = el => { app.statsYear = Number(el.value); render(); };
actions["open-book"] = el => { const b = findById(el.dataset.id); if (b) bookSheet(b); };
actions["pick-one"] = () => { const list = B.upNext(S(), 50); if (!list.length) return; const b = list[Math.floor(Math.random() * list.length)]; toast(`How about ${b.title}?`); bookSheet(b); };

// ============ Progress and finishing ============
actions["add-progress"] = el => {
  const b = findById(el.dataset.id); if (!b) return;
  const n = Number(el.dataset.n), L = B.length(b);
  const before = Number(b.progress) || 0, after = L ? Math.min(L, before + n) : before + n, added = after - before;
  const entry = { id: uid(), date: app.today, bookId: b.id, amount: added };
  commit(s => { const x = s.books.find(y => y.id === b.id); x.progress = after; if (added > 0) s.log.push(entry); if (!x.started) x.started = app.today; });
  if (L && after >= L) finishSheet(findById(b.id));
  else toast(`${b.format === "audio" ? `+${n} min` : `+${added} pages`} · ${progressText(findById(b.id))}`, () => commit(s => { s.books.find(y => y.id === b.id).progress = before; s.log = s.log.filter(l => l.id !== entry.id); }));
};
let fin = null;
function finishSheet(b) {
  fin = { id: b.id, rating: b.rating || 0, spice: b.spice || 0, tropes: [...(b.tropes || [])] };
  openSheet(`${sheetHead(`Finished <em class="it">${esc(b.title)}</em>`, "Later")}
    <form data-form="finish"><div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem">${cover(b, 70)}<p class="muted small" style="font-weight:700">Lovely. Two taps to remember how it felt, or skip and save.</p></div>
    ${ratingField(fin.rating)}${S().profile.spice ? spiceField(fin.spice) : ""}
    ${S().profile.spice ? `<div class="field"><span>Tropes</span>${chipPicker("fin-trope", TROPES.slice(0, 10), fin.tropes)}</div>` : ""}
    <label class="field"><span>Finished on</span><input class="input" type="date" name="date" value="${app.today}" max="${app.today}"></label>
    <button class="btn primary full" type="submit">Save to my read books</button></form>`, { label: "Finished" });
}
actions["finish"] = el => { const b = findById(el.dataset.id); if (b) finishSheet(b); };
forms["finish"] = f => {
  const b = findById(fin.id); if (!b) return;
  const date = val(f, "date") || app.today, L = B.length(b), left = L ? Math.max(0, L - (Number(b.progress) || 0)) : 0;
  commit(s => {
    const x = s.books.find(y => y.id === b.id);
    Object.assign(x, { status: "read", finished: date, rating: fin.rating, spice: fin.spice, tropes: fin.tropes, progress: L || x.progress, started: x.started || date });
    if (left) s.log.push({ id: uid(), date, bookId: x.id, amount: left });
  });
  closeSheet();
  const st = B.yearStats(S(), B.yearOf(app.today), app.today);
  toast(st.goal ? `${st.books} of ${st.goal} this year. Well read!` : "Saved to your read books.");
};

// ============ Rating, spice and chips (shared by the finish and book sheets) ============
const ratingField = r => `<div class="field"><span>Your rating <b class="rating-t" style="margin-left:.4rem">${esc(ratingText(r))}</b></span><div class="rating-row"><span class="rating-stars">${stars(r, 30)}</span><input type="range" min="0" max="5" step="0.25" value="${r}" data-live="rating" aria-label="Rating" class="range"></div></div>`;
const spiceField = n => `<div class="field"><span>Spice</span><div class="spice-pick">${Array.from({ length: 5 }, (_, i) => `<button type="button" data-act="spice" data-v="${i + 1}" aria-label="Spice ${i + 1}">${chilli(i < n, 30)}</button>`).join("")}<button type="button" class="btn text small" data-act="spice" data-v="0">none</button></div></div>`;
function chipPicker(act, base, chosen) {
  const all = [...new Set([...chosen, ...base])];
  return `<div class="chips pick">${all.map(t => `<button type="button" class="chip${chosen.includes(t) ? " on" : ""}" data-act="${act}" data-v="${esc(t)}" aria-pressed="${chosen.includes(t)}">${esc(t)}</button>`).join("")}<button type="button" class="chip line" data-act="${act}" data-v="+">+ your own</button></div>`;
}
const target = () => (document.querySelector('form[data-form="finish"]') ? fin : ed);
live["rating"] = el => { const t = target(); t.rating = Number(el.value); el.closest(".field").querySelector(".rating-stars").innerHTML = stars(t.rating, 30); el.closest(".field").querySelector(".rating-t").textContent = ratingText(t.rating); };
actions["spice"] = el => { const t = target(); t.spice = Number(el.dataset.v); el.closest(".spice-pick").querySelectorAll("[data-act=spice][aria-label]").forEach((b, i) => { b.innerHTML = chilli(i < t.spice, 30); }); };
function toggleChip(el, list) {
  let v = el.dataset.v;
  if (v === "+") { v = (prompt("Add your own:") || "").trim().toLowerCase().slice(0, 30); if (!v) return; if (!list.includes(v)) list.push(v); const b = document.createElement("button"); b.type = "button"; b.className = "chip on"; b.dataset.act = el.dataset.act; b.dataset.v = v; b.textContent = v; b.setAttribute("aria-pressed", "true"); el.before(b); return; }
  const i = list.indexOf(v); i >= 0 ? list.splice(i, 1) : list.push(v);
  el.classList.toggle("on", i < 0); el.setAttribute("aria-pressed", String(i < 0));
}
actions["fin-trope"] = el => toggleChip(el, fin.tropes);
actions["ed-trope"] = el => toggleChip(el, ed.tropes);
actions["ed-mood"] = el => toggleChip(el, ed.moods);

// ============ The book page ============
let ed = null;
export function bookSheet(b) {
  ed = { id: b.id, rating: b.rating || 0, spice: b.spice || 0, tropes: [...(b.tropes || [])], moods: [...(b.moods || [])], quotes: (b.quotes || []).map(q => ({ ...q })), status: b.status, format: b.format };
  drawBook(b);
}
function drawBook(b) {
  const audio = ed.format === "audio";
  const h = m => (m ? Math.round(m / 6) / 10 : "");
  const html = `${sheetHead(esc(b.title) || "Book", "Close")}
  <form data-form="book" data-id="${b.id}">
    <div class="bp-top">${cover({ ...b, status: ed.status }, 110)}<div style="flex:1;min-width:0">
      <label class="field"><span>Title</span><input class="input" name="title" value="${esc(b.title)}" required></label>
      <label class="field"><span>Author</span><input class="input" name="author" value="${esc(b.author)}"></label>
      <div class="seg">${STATUSES.map(([k, l]) => `<button type="button" data-act="ed-status" data-v="${k}" aria-pressed="${ed.status === k}">${l}</button>`).join("")}</div>
    </div></div>
    ${ed.status === "reading" ? `<div class="row2"><label class="field"><span>${audio ? "Listened (hours)" : "Page I'm on"}</span><input class="input" name="progress" inputmode="decimal" value="${audio ? h(b.progress) : b.progress || ""}"></label><label class="field"><span>Started</span><input class="input" type="date" name="started" value="${b.started || app.today}"></label></div>${paceLine(b)}` : ""}
    ${ed.status === "read" || ed.status === "dnf" ? `<div class="row2"><label class="field"><span>Started</span><input class="input" type="date" name="started" value="${b.started || ""}"></label><label class="field"><span>${ed.status === "dnf" ? "Stopped on" : "Finished"}</span><input class="input" type="date" name="finished" value="${b.finished || app.today}"></label></div>` : ""}
    ${ed.status === "dnf" ? `<label class="field"><span>Stopped at page</span><input class="input" name="dnfPage" inputmode="numeric" value="${b.dnfPage || ""}"></label>` : ""}
    ${ed.status === "read" || ed.status === "dnf" || ed.status === "reading" ? ratingField(ed.rating) + (S().profile.spice ? spiceField(ed.spice) : "") : ""}
    ${S().profile.spice ? `<div class="field"><span>Tropes</span>${chipPicker("ed-trope", TROPES, ed.tropes)}</div>` : ""}
    <div class="field"><span>Mood</span>${chipPicker("ed-mood", MOODS, ed.moods)}</div>
    <div class="row3"><label class="field"><span>Genre</span><select class="input" name="genre">${S().genres.map(g => `<option${g === b.genre ? " selected" : ""}>${esc(g)}</option>`).join("")}</select></label>
      <label class="field"><span>Format</span><select class="input" name="format" data-live="ed-format">${FORMATS.map(([k, l]) => `<option value="${k}"${k === ed.format ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>${audio ? "Length (hours)" : "Pages"}</span><input class="input" name="length" inputmode="decimal" value="${audio ? h(b.minutes) : b.pages || ""}"></label></div>
    <div class="row3"><label class="field"><span>Where from</span><select class="input" name="source">${SOURCES.map(([k, l]) => `<option value="${k}"${k === b.source ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>Price</span><input class="input" name="price" inputmode="decimal" value="${b.price ?? ""}" placeholder="optional"><small>Borrowed books count as money saved.</small></label>
      <label class="field"><span>Library due</span><input class="input" type="date" name="dueDate" value="${b.dueDate || ""}"></label></div>
    <label class="check"><input type="checkbox" name="owned"${B.isOwned(b) ? " checked" : ""}> I own a copy</label>
    <div class="row3"><label class="field"><span>Series</span><input class="input" name="series" value="${esc(b.series)}" placeholder="e.g. Anne of Green Gables" list="series-list"></label>
      <label class="field"><span>Number</span><input class="input" name="seriesNo" inputmode="decimal" value="${b.seriesNo ?? ""}"></label>
      <label class="field"><span>Books in series</span><input class="input" name="seriesTotal" inputmode="numeric" value="${b.seriesTotal ?? ""}"></label></div>
    <datalist id="series-list">${[...new Set(S().books.map(x => x.series).filter(Boolean))].map(s => `<option value="${esc(s)}">`).join("")}</datalist>
    <div class="field"><span>Favourite quotes</span>${ed.quotes.map((q, i) => `<div class="quote-row"><textarea class="input" name="q${i}" rows="2">${esc(q.text)}</textarea><button type="button" class="x" data-act="ed-quote-del" data-i="${i}" aria-label="Remove quote">&times;</button></div>`).join("")}<button type="button" class="btn soft small" data-act="ed-quote-add">+ Add a quote</button></div>
    <label class="field"><span>Notes</span><textarea class="input" name="notes" rows="3">${esc(b.notes)}</textarea></label>
    <div class="row2"><label class="field"><span>ISBN</span><input class="input" name="isbn" value="${esc(b.isbn)}" inputmode="numeric"></label><label class="field"><span>Bought on</span><input class="input" type="date" name="boughtOn" value="${b.boughtOn || ""}"></label></div>
    ${(b.rereads || []).length ? `<p class="small muted">Read ${b.rereads.length + 1} times.</p>` : ""}
    <button class="btn primary full" type="submit">Save</button>
    <div class="row-btns" style="justify-content:center;margin-top:.6rem">${b.status === "read" ? `<button type="button" class="btn text small" data-act="reread" data-id="${b.id}">Start a re-read</button>` : ""}<button type="button" class="btn text small" data-act="delete-book" data-id="${b.id}">Delete this book</button></div>
  </form>`;
  document.querySelector("#sheet-root .sheet") ? updateSheet(html) : openSheet(html, { wide: true, label: b.title });
}
function paceLine(b) {
  const p = B.pace(S(), b, app.today);
  return p.perDay ? `<p class="note" style="margin:-.3rem 0 .9rem">About ${p.perDay} ${b.format === "audio" ? "minutes" : "pages"} a day. ${p.finishOn ? `Finish around ${esc(fd(p.finishOn))}.` : ""}</p>` : "";
}
function syncEd() {
  const f = document.querySelector('form[data-form="book"]'); if (!f) return;
  ed.quotes = ed.quotes.map((q, i) => ({ ...q, text: f.elements["q" + i]?.value ?? q.text }));
  ed.draft = Object.fromEntries([...f.elements].filter(e => e.name).map(e => [e.name, e.type === "checkbox" ? e.checked : e.value]));
}
function redraw() { syncEd(); const b = { ...findById(ed.id), ...draftToBook(ed.draft || {}) }; drawBook(b); }
actions["ed-status"] = el => { ed.status = el.dataset.v; redraw(); };
live["ed-format"] = el => { ed.format = el.value; redraw(); };
actions["ed-quote-add"] = () => { syncEd(); ed.quotes.push({ text: "" }); redraw(); };
actions["ed-quote-del"] = el => { syncEd(); ed.quotes.splice(Number(el.dataset.i), 1); redraw(); };
function draftToBook(d) {
  const out = {};
  for (const k of ["title", "author", "genre", "source", "series", "notes", "isbn"]) if (k in d) out[k] = String(d[k]).trim();
  for (const k of ["started", "finished", "dueDate", "boughtOn"]) if (k in d) out[k] = d[k] || null;
  if ("owned" in d) out.owned = !!d.owned;
  if ("price" in d) out.price = num(d.price);
  if ("seriesNo" in d) out.seriesNo = num(d.seriesNo);
  if ("seriesTotal" in d) out.seriesTotal = num(d.seriesTotal);
  if ("dnfPage" in d) out.dnfPage = num(d.dnfPage);
  const audio = (d.format || ed.format) === "audio";
  if ("length" in d) { const v = num(d.length); if (audio) out.minutes = v ? Math.round(v * 60) : null; else out.pages = v ? Math.round(v) : null; }
  if ("progress" in d) { const v = num(d.progress); out.progress = v == null ? 0 : audio ? Math.round(v * 60) : Math.round(v); }
  return out;
}
forms["book"] = f => {
  syncEd();
  const id = f.dataset.id, d = draftToBook(ed.draft);
  if (!d.title) return toast("Give the book a title.");
  const prev = findById(id);
  commit(s => {
    const x = s.books.find(y => y.id === id);
    const before = Number(x.progress) || 0;
    Object.assign(x, d, { status: ed.status, format: ed.format, rating: ed.rating, spice: ed.spice, tropes: ed.tropes, moods: ed.moods, quotes: ed.quotes.filter(q => q.text && q.text.trim()) });
    if (x.status === "reading" && !x.started) x.started = app.today;
    if (x.status === "read" && !x.finished) x.finished = app.today;
    if (x.status === "read" && B.length(x) && (Number(x.progress) || 0) < B.length(x)) x.progress = B.length(x);
    if (OWNED_SOURCES.includes(x.source)) x.owned = true;
    const gained = (Number(x.progress) || 0) - before;
    if (gained > 0 && prev.status === "reading") s.log.push({ id: uid(), date: app.today, bookId: x.id, amount: gained });
  });
  closeSheet(); toast("Saved.");
};
const OWNED_SOURCES = ["bought", "gift"];
actions["delete-book"] = el => {
  const b = findById(el.dataset.id); if (!b) return;
  const logs = S().log.filter(l => l.bookId === b.id);
  commit(s => { s.books = s.books.filter(x => x.id !== b.id); s.log = s.log.filter(l => l.bookId !== b.id); });
  closeSheet(); toast(`${b.title} deleted.`, () => commit(s => { s.books.push(b); s.log.push(...logs); }));
};
actions["reread"] = el => {
  commit(s => { const x = s.books.find(y => y.id === el.dataset.id); x.rereads = [...(x.rereads || []), { started: x.started, finished: x.finished, rating: x.rating }]; Object.assign(x, { status: "reading", started: app.today, finished: null, progress: 0 }); });
  closeSheet(); toast("Enjoy the re-read.");
};

// ============ Adding a book: scan, search or type ============
let add = null, stopScan = null;
function stopCamera() { if (stopScan) { try { stopScan(); } catch { /* ignore */ } stopScan = null; } }
actions["add-book"] = el => { add = { mode: el.dataset.mode || "scan", q: el.dataset.q || "", status: el.dataset.status || null, results: null }; drawAdd(); };
actions["add-mode"] = el => { stopCamera(); add.mode = el.dataset.v; add.results = null; drawAdd(); };
function drawAdd() {
  const tabs = `<div class="seg" style="margin-bottom:1rem">${[["scan", "Scan"], ["search", "Search"], ["manual", "Type it in"]].map(([k, l]) => `<button type="button" data-act="add-mode" data-v="${k}" aria-pressed="${add.mode === k}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (add.mode === "scan") body = app.demo ? `<div class="cam demo-cam"><div class="frame"><div class="code">${"<i></i>".repeat(30)}</div></div><div class="hint">Demo: tap to try a pretend scan</div></div><button type="button" class="btn primary full" data-act="demo-scan" style="margin-top:.8rem">Scan the example book</button>`
    : canScan() ? `<div class="cam"><video id="cam" playsinline muted></video><div class="frame"></div><div class="hint">Point at the barcode on the back of the book</div></div><p class="small muted" style="margin-top:.6rem">Camera not working? Use Search, or type the ISBN under the barcode.</p>`
    : `<div class="empty">This browser can't use the camera. Use Search instead.</div>`;
  if (add.mode === "search") body = `<form data-form="add-search" class="libbar" style="margin-bottom:.8rem"><input class="input" name="q" type="search" placeholder="Title, author or ISBN" value="${esc(add.q)}" autofocus autocomplete="off"><button class="btn primary" type="submit">Search</button></form>
    <div id="add-results">${resultsHTML()}</div>`;
  if (add.mode === "manual") body = manualForm({});
  const html = `${sheetHead(add.status === "wish" ? "Add to my wishlist" : "Add a book")}${tabs}${body}`;
  document.querySelector("#sheet-root .sheet") ? updateSheet(html) : openSheet(html, { label: "Add a book", onClose: stopCamera });
  if (add.mode === "scan" && !app.demo && canScan()) setTimeout(beginScan, 50);
  if (add.mode === "search" && add.q && !add.results) setTimeout(() => forms["add-search"](document.querySelector('form[data-form="add-search"]')), 30);
}
async function beginScan() {
  const v = document.getElementById("cam"); if (!v) return;
  try { stopScan = await startScan(v, async code => { stopScan = null; await showLookup(code); }); }
  catch (e) { const c = document.querySelector(".cam"); if (c) c.outerHTML = `<div class="empty">${e && e.name === "NotAllowedError" ? "Camera access was blocked. Allow it in your browser settings, or use Search." : "The camera couldn't start. Use Search, or type the ISBN."}</div>`; }
}
actions["demo-scan"] = () => scanResult({ ...DEMO_SCAN });
async function showLookup(code) {
  updateSheet(`${sheetHead("Add a book")}<div class="empty">Looking up ${esc(code)}&hellip;</div>`);
  const mine = B.findBook(S(), { isbn: code });
  if (mine) return scanResult({ isbn: code, title: mine.title, author: mine.author, pages: mine.pages, cover: mine.cover }, mine);
  const found = await byISBN(code).catch(() => null);
  if (!found) { add.mode = "manual"; updateSheet(`${sheetHead("Add a book")}<p class="note" style="margin-bottom:1rem">I couldn't find details for ${esc(code)}${navigator.onLine === false ? " (you're offline)" : ""}. Type them in, it only takes a moment.</p>${manualForm({ isbn: code })}`); return; }
  scanResult(found, B.findBook(S(), found));
}
let pending = null;
function scanResult(info, mine = B.findBook(S(), info)) {
  pending = info;
  const state = B.bookState(mine);
  const headline = { new: "Not on your shelves yet", wish: "It's on your wishlist", owned: "You own this", "owned-read": "You own this, and you've read it", read: "You've read this", reading: "You're reading this", tbr: "It's on your to-read list", dnf: "You didn't finish this one" }[state] || "In your library";
  const ctx = info.series ? null : B.authorContext(S(), info.author);
  const ser = info.series ? B.series(S()).find(g => B.seriesKey(g.name) === B.seriesKey(info.series)) : null;
  const serLine = ser ? `<div class="lab">${esc(ser.name)} series</div><div class="dots">${ser.slots.map(s => `<i class="${s.state === "read" ? "r" : s.n === Number(info.seriesNo) ? "n" : s.book ? "o" : "m"}"></i>`).join("")}</div><small class="b">${info.seriesNo ? `This is #${info.seriesNo}. ` : ""}${ser.read ? `You've read ${ser.read === 1 ? "#1" : `1 to ${ser.read}`}.` : ""}</small>`
    : ctx && ctx.read ? `<small class="b">You've read ${ctx.read} ${ctx.read === 1 ? "book" : "books"} by ${esc(info.author.split(",")[0])}.</small>` : "";
  const book = mine || newBook({ ...info, genre: "Other" });
  updateSheet(`${sheetHead("Add a book")}
    <div class="res"><span class="tag ${state === "new" ? "" : "good-t"}">${esc(headline)}</span>
    <div style="display:flex;gap:1rem">${cover(book, 90)}<div style="flex:1;min-width:0"><h4 class="fr">${esc(info.title)}</h4><small class="muted" style="font-weight:700">${esc(info.author || "")}${info.pages ? ` &middot; ${info.pages} pages` : ""}</small>${serLine}
    ${mine && mine.status === "read" ? `<div style="margin-top:.5rem">${stars(mine.rating, 14)} <span class="small muted">read ${mine.finished ? esc(fdShort(mine.finished)) : ""}</span></div>` : ""}</div></div>
    ${mine ? `<div class="row-btns" style="margin-top:1rem"><button type="button" class="btn primary" data-act="open-book" data-id="${mine.id}">Open it</button>${mine.status === "wish" ? `<button type="button" class="btn ghost" data-act="wish-got" data-id="${mine.id}">I got it</button>` : ""}<button type="button" class="btn text" data-act="add-mode" data-v="scan">Scan another</button></div>`
      : `<div class="row-btns" style="margin-top:1rem"><button type="button" class="btn primary" data-act="add-pending" data-how="bought">I bought it</button><button type="button" class="btn ghost" data-act="add-pending" data-how="library">Borrowed it</button><button type="button" class="btn ghost" data-act="add-pending" data-how="reading">Start reading</button></div>
      <div style="text-align:center;margin-top:.6rem"><button type="button" class="btn text" data-act="add-pending" data-how="wish">Add to my wishlist</button></div>`}
    </div>`);
}
actions["add-pending"] = el => {
  const how = add?.status === "wish" ? "wish" : el.dataset.how;
  const i = pending;
  const b = newBook({ title: i.title, author: i.author || "", isbn: i.isbn || "", pages: i.pages || null, cover: i.cover || "", series: i.series || "", seriesNo: i.seriesNo || null,
    status: how === "wish" ? "wish" : how === "reading" ? "reading" : "tbr", source: how === "bought" ? "bought" : how === "library" ? "library" : "",
    owned: how === "bought", boughtOn: how === "bought" ? app.today : null, started: how === "reading" ? app.today : null });
  const ser = b.series ? S().books.find(x => B.seriesKey(x.series) === B.seriesKey(b.series)) : null;
  if (ser) { b.genre = ser.genre; b.series = ser.series; b.seriesTotal = ser.seriesTotal; }
  commit(s => s.books.push(b));
  stopCamera(); closeSheet();
  toast(how === "wish" ? "Added to your wishlist." : `${b.title} added.`);
  bookSheet(findById(b.id));
};
function resultsHTML() {
  if (add.results === null) return `<p class="small muted">Covers and details come from Open Library. You need internet only while adding.</p>`;
  if (add.results === "loading") return `<div class="empty">Searching&hellip;</div>`;
  if (add.results === "error") return `<div class="empty">Couldn't search right now${navigator.onLine === false ? " (you're offline)" : ""}. <button type="button" class="btn text small" data-act="add-mode" data-v="manual">Type it in instead</button></div>`;
  if (!add.results.length) return `<div class="empty">Nothing found. <button type="button" class="btn text small" data-act="add-mode" data-v="manual">Type it in</button></div>`;
  return `<div class="results">${add.results.map((r, i) => `<button type="button" class="result" data-act="pick-result" data-i="${i}">${cover(newBook({ ...r, genre: "Other" }), 52)}<div><b>${esc(r.title)}</b><small>${esc(r.author)}${r.year ? ` &middot; ${esc(r.year)}` : ""}</small></div></button>`).join("")}</div>
    <p class="small muted" style="margin-top:.6rem">Not the right one? <button type="button" class="btn text small" data-act="add-mode" data-v="manual">Type it in</button></p>`;
}
forms["add-search"] = async f => {
  if (!f) return;
  add.q = val(f, "q").trim(); if (!add.q) return;
  add.results = "loading"; document.getElementById("add-results").innerHTML = resultsHTML();
  const r = await searchBooks(add.q).catch(() => null);
  add.results = r === null ? "error" : r;
  const box = document.getElementById("add-results"); if (box) box.innerHTML = resultsHTML();
};
actions["pick-result"] = el => { const r = add.results[Number(el.dataset.i)]; scanResult(r); };
function manualForm(p) {
  return `<form data-form="add-manual"><label class="field"><span>Title</span><input class="input" name="title" required value="${esc(p.title || "")}"></label>
    <label class="field"><span>Author</span><input class="input" name="author" value="${esc(p.author || "")}"></label>
    <div class="row2"><label class="field"><span>Pages</span><input class="input" name="pages" inputmode="numeric"></label><label class="field"><span>ISBN (optional)</span><input class="input" name="isbn" value="${esc(p.isbn || "")}" inputmode="numeric"></label></div>
    <button class="btn primary full" type="submit">Next</button></form>`;
}
forms["add-manual"] = f => { const t = val(f, "title").trim(); if (!t) return; scanResult({ title: t, author: val(f, "author").trim(), pages: Number(val(f, "pages")) || null, isbn: B.cleanISBN(val(f, "isbn")), cover: "" }); };

// ============ Goal, series, genres ============
actions["edit-goal"] = () => openSheet(`${sheetHead("Reading goal", "Cancel")}<form data-form="goal"><label class="field"><span>Books this year</span><input class="input" name="goal" type="number" min="0" max="999" inputmode="numeric" value="${S().profile.yearGoal || ""}" autofocus><small>Set 0 for no goal. Re-reads count too.</small></label><button class="btn primary full" type="submit">Save</button></form>`, { label: "Goal" });
forms["goal"] = f => { commit(s => { s.profile.yearGoal = Math.max(0, Number(val(f, "goal")) || 0); }); closeSheet(); };
actions["edit-series"] = el => {
  const g = B.series(S()).find(x => x.key === el.dataset.key); if (!g) return;
  openSheet(`${sheetHead(esc(g.name), "Cancel")}<form data-form="series" data-key="${esc(g.key)}">
    <label class="field"><span>Series name</span><input class="input" name="name" value="${esc(g.name)}"></label>
    <div class="row2"><label class="field"><span>Books in the series</span><input class="input" name="total" inputmode="numeric" value="${g.total || ""}"></label>
    <label class="field"><span>Status</span><select class="input" name="status">${["", "Not started", "In progress", "Waiting for the next book", "On hold", "Completed", "Did not finish"].map(s => `<option value="${s}"${s === g.status ? " selected" : ""}>${s || "Work it out for me"}</option>`).join("")}</select></label></div>
    <button class="btn primary full" type="submit">Save</button></form>`, { label: "Series" });
};
forms["series"] = f => {
  const key = f.dataset.key, name = val(f, "name").trim(), total = Number(val(f, "total")) || null, status = val(f, "status");
  commit(s => { for (const b of s.books) if (B.seriesKey(b.series) === key) Object.assign(b, { series: name || b.series, seriesTotal: total, seriesStatus: status }); });
  closeSheet(); toast("Series saved.");
};
let genreDraft = [];
actions["edit-genres"] = () => { genreDraft = [...S().genres]; drawGenres(); };
function drawGenres() {
  const html = `${sheetHead("Genres", "Cancel")}<p class="small muted" style="margin-bottom:.8rem">Each genre has its own colour on the quilt and the shelves. Rename, add or remove.</p>
    <form data-form="genres">${genreDraft.map((g, i) => `<div class="er" style="display:grid;grid-template-columns:1.2rem 1fr 2.6rem;gap:.5rem;align-items:center;margin-bottom:.45rem"><span class="sq" style="background:var(--p${i % 9});width:1rem;height:1rem"></span><input class="input" name="g${i}" value="${esc(g)}"><button type="button" class="x" data-act="genre-del" data-i="${i}" aria-label="Remove">&times;</button></div>`).join("")}
    <button type="button" class="btn soft small" data-act="genre-add">+ Add a genre</button><button class="btn primary full" type="submit" style="margin-top:1rem">Save genres</button></form>`;
  document.querySelector("#sheet-root .sheet") ? updateSheet(html) : openSheet(html, { label: "Genres" });
}
const syncGenres = () => { const f = document.querySelector('form[data-form="genres"]'); if (f) genreDraft = genreDraft.map((g, i) => f.elements["g" + i]?.value ?? g); };
actions["genre-add"] = () => { syncGenres(); genreDraft.push(""); drawGenres(); };
actions["genre-del"] = el => { syncGenres(); genreDraft.splice(Number(el.dataset.i), 1); drawGenres(); };
forms["genres"] = () => {
  syncGenres();
  const old = S().genres, next = genreDraft.map(g => g.trim()).filter(Boolean);
  const renamed = {}; old.forEach((g, i) => { if (genreDraft[i] && genreDraft[i].trim() && genreDraft[i].trim() !== g) renamed[g] = genreDraft[i].trim(); });
  commit(s => { s.genres = next.length ? next : [...GENRES]; for (const b of s.books) { if (renamed[b.genre]) b.genre = renamed[b.genre]; if (!s.genres.includes(b.genre)) b.genre = s.genres[s.genres.length - 1]; } });
  closeSheet(); toast("Genres saved.");
};

// ============ Wishlist ============
actions["wish-gift"] = el => commit(s => { const b = s.books.find(x => x.id === el.dataset.id); b.forGift = !b.forGift; });
actions["wish-got"] = el => {
  commit(s => { const b = s.books.find(x => x.id === el.dataset.id); Object.assign(b, { status: "tbr", source: b.source || "bought", owned: true, boughtOn: app.today, forGift: false }); });
  closeSheet(); toast("Moved to your to-read pile.");
};
const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
actions["share-wishlist"] = async () => {
  const list = S().books.filter(b => b.status === "wish" && b.forGift);
  const use = list.length ? list : S().books.filter(b => b.status === "wish");
  if (!use.length) return toast("Add a book to your wishlist first.");
  const data = { n: S().profile.name || "", l: S().profile.look, b: use.slice(0, 60).map(b => [b.title, b.author, B.cleanISBN(b.isbn), b.where || ""]) };
  const link = `${location.origin}${location.pathname}#w=${b64(JSON.stringify(data))}`;
  const text = `${S().profile.name ? S().profile.name + "'s" : "My"} book wishlist`;
  try { if (navigator.share) { await navigator.share({ title: text, url: link }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(link); toast("Link copied. Paste it in a message to family."); } catch { prompt("Copy this link:", link); }
};
export function renderSharedWishlist(hash) {
  let d;
  try { d = JSON.parse(unb64(hash.slice(3))); } catch { return false; }
  document.documentElement.dataset.look = d.l in LOOKS ? d.l : "academia";
  const items = (d.b || []).map(([title, author, isbn, where]) => ({ title, author, isbn, where }));
  document.getElementById("app").innerHTML = `<div class="main" style="max-width:900px"><div class="logo fr it" style="margin-bottom:1rem">Dear Reader <img src="img/motif.png" alt=""></div>
    <h1 class="page-title fr">${d.n ? esc(d.n) + "'s" : "A"} book <em class="it" style="color:var(--deep)">wishlist</em></h1><p class="page-sub">Any of these would make a lovely gift. Look them up in your favourite bookshop by title or ISBN.</p>
    <div class="grid">${items.map(b => `<section class="card s6 wish"><div class="wish-in">${cover({ ...newBook({ title: b.title, author: b.author, genre: "Other" }), cover: b.isbn ? `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg?default=false` : "" }, 72)}<div><b class="fr">${esc(b.title)}</b><div class="muted small">${esc(b.author)}</div>${b.isbn ? `<div class="small" style="margin-top:.3rem">ISBN ${esc(b.isbn)}</div>` : ""}${b.where ? `<div class="small">${esc(b.where)}</div>` : ""}</div></div></section>`).join("")}</div>
    <p class="small muted" style="margin-top:1.5rem">Shared from Dear Reader. Only this list is shared, nothing else.</p></div>`;
  return true;
}

// ============ Your year in books (a story card picture) ============
actions["year-card"] = async el => {
  const Y = Number(el.dataset.year) || B.yearOf(app.today);
  openSheet(`${sheetHead("Your year in books")}<div class="empty">Making your card&hellip;</div>`, { label: "Year in books" });
  const blob = await yearCard(Y);
  const url = URL.createObjectURL(blob);
  updateSheet(`${sheetHead("Your year in books")}<img src="${url}" alt="Your ${Y} in books" class="yc"><div class="row-btns" style="margin-top:1rem"><button type="button" class="btn primary" data-act="year-save">Save or share</button></div><p class="small muted" style="margin-top:.5rem">Made for Instagram and TikTok stories (1080 × 1920).</p>`);
  actions["year-save"] = async () => {
    const file = new File([blob], `my-${Y}-in-books.png`, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
};
async function yearCard(Y) {
  const st = B.yearStats(S(), Y, app.today), q = B.quilt(S(), Y);
  const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue("--" + n).trim();
  const dark = LOOKS[S().profile.look]?.dark;
  const bg = dark ? v("card") : v("head"), fg = dark ? v("ink") : v("bg"), gold = v("gold") || "#E6D3A8";
  try { await Promise.all(["800 90px Fraunces", "italic 800 90px Fraunces", "800 30px Nunito", "700 40px 'Dancing Script'"].map(f => document.fonts.load(f))); } catch { /* fonts optional */ }
  const W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const P = 90;
  x.fillStyle = gold; x.font = "800 30px Nunito"; x.textBaseline = "top";
  const name = S().profile.name;
  x.fillText(`${name ? name.toUpperCase() + "'S" : "MY"} ${Y} IN BOOKS`.split("").join(String.fromCharCode(8202)), P, 170);
  x.fillStyle = fg; x.font = "800 108px Fraunces";
  x.fillText(`${st.books} ${st.books === 1 ? "book," : "books,"}`, P, 230);
  x.fillStyle = gold; x.font = "italic 800 108px Fraunces";
  x.fillText("one lovely year.", P, 350);
  const cells = [[st.pages.toLocaleString("en-GB"), "pages read"], [st.topGenre || "–", "top genre"], [st.avgRating != null ? String(st.avgRating) : "–", "average rating"], [st.saved ? fmt(st.saved).replace(/\.00$/, "") : "–", "saved by borrowing"], [String(st.fiveStars), "five-star reads"], [st.busiest != null ? new Date(Date.UTC(Y, st.busiest, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" }) : "–", "busiest month"]];
  cells.forEach(([a, b], i) => {
    const cx = P + (i % 2) * 460, cy = 540 + Math.floor(i / 2) * 170;
    x.fillStyle = gold; x.globalAlpha = .45; x.fillRect(cx, cy, 400, 2); x.globalAlpha = 1;
    x.fillStyle = fg; x.font = "800 64px Fraunces"; x.fillText(a.length > 11 ? a.slice(0, 11) + "…" : a, cx, cy + 22);
    x.fillStyle = gold; x.font = "700 28px Nunito"; x.fillText(b, cx, cy + 102);
  });
  const cols = 10, gap = 10, size = (W - 2 * P - gap * (cols - 1)) / cols, top = 1080;
  q.squares.slice(0, 50).forEach((s, i) => { x.fillStyle = css.getPropertyValue(genreColor(s.genre).slice(4, -1)).trim() || "#999"; x.fillRect(P + (i % cols) * (size + gap), top + Math.floor(i / cols) * (size + gap), size, size); });
  if (st.fav) {
    const fy = 1560, b = st.fav.book;
    x.fillStyle = css.getPropertyValue(genreColor(b.genre).slice(4, -1)).trim() || "#8C2F39"; x.fillRect(P, fy, 150, 225);
    x.strokeStyle = gold; x.globalAlpha = .6; x.strokeRect(P + 16, fy + 16, 118, 193); x.globalAlpha = 1;
    x.fillStyle = "#F6F1E7"; x.font = "800 24px Fraunces"; wrap(x, b.title, P + 22, fy + 26, 106, 28, 4);
    x.fillStyle = gold; x.font = "800 26px Nunito"; x.fillText("BOOK OF THE YEAR", P + 190, fy + 40);
    x.fillStyle = fg; x.font = "800 56px Fraunces"; wrap(x, b.title, P + 190, fy + 84, 700, 60, 2);
  }
  x.fillStyle = gold; x.font = "700 44px 'Dancing Script'"; x.textAlign = "center"; x.fillText("made with Dear Reader", W / 2, 1830);
  return await new Promise(r => c.toBlob(r, "image/png"));
}
function wrap(x, text, X, Y, w, lh, maxLines) {
  const words = String(text).split(/\s+/); let line = "", n = 0;
  for (const word of words) { const t = line ? line + " " + word : word; if (x.measureText(t).width > w && line) { x.fillText(line, X, Y + n * lh); line = word; if (++n >= maxLines) return; } else line = t; }
  if (line && n < maxLines) x.fillText(line, X, Y + n * lh);
}

// ============ Import, backup, export, calendar ============
actions["import"] = async () => {
  const f = await pickFile(".csv,text/csv,text/plain");
  if (!f) return;
  let res; try { res = readFile(f.text, S().profile.locale); } catch { return toast("I couldn't read that file."); }
  const { fresh, dupes } = importPlan(S(), res.books);
  openSheet(`${sheetHead("Import books", "Cancel")}
    <p style="font-weight:700;color:var(--head);margin-bottom:.6rem">From ${esc(SOURCE_NAMES[res.kind])}: ${res.books.length} books found${dupes.length ? `, ${dupes.length} already in your library` : ""}.</p>
    <ul class="small" style="margin:0 0 1rem 1.2rem;color:var(--head);font-weight:600">
      <li>${fresh.filter(b => b.status === "read").length} read, ${fresh.filter(b => b.status === "reading").length} reading, ${fresh.filter(b => b.status === "tbr").length} to read${fresh.filter(b => b.status === "dnf").length ? `, ${fresh.filter(b => b.status === "dnf").length} not finished` : ""}${fresh.filter(b => b.status === "wish").length ? `, ${fresh.filter(b => b.status === "wish").length} wishlist` : ""}</li>
      <li>${fresh.filter(b => b.series).length} in a series, ${fresh.filter(b => b.isbn).length} with an ISBN (their covers appear by themselves)</li></ul>
    <button type="button" class="btn primary full" data-act="import-go"${fresh.length ? "" : " disabled"}>Import ${fresh.length} ${fresh.length === 1 ? "book" : "books"}</button>`, { label: "Import" });
  actions["import-go"] = () => {
    for (const b of fresh) if (b.isbn && !b.cover) b.cover = `https://covers.openlibrary.org/b/isbn/${B.isbnKey(b.isbn)}-M.jpg?default=false`;
    commit(s => s.books.push(...fresh)); closeSheet(); toast(`${fresh.length} books imported.`); app.view = "library"; render();
  };
};
actions["backup"] = async () => {
  const data = JSON.stringify({ app: "dearreader", version: 1, exportedAt: new Date().toISOString(), state: S() });
  const r = await shareOrDownload(`dear-reader-backup-${app.today}.json`, data, "application/json");
  if (r === "cancelled") return;
  commit(s => { s.meta.lastBackup = new Date().toISOString(); });
  toast(r === "shared" ? "Backup ready. Save it to Files, Drive or email." : "Backup saved to your downloads.");
};
actions["restore"] = async () => {
  const f = await pickFile(".json,application/json"); if (!f) return;
  let d; try { d = JSON.parse(f.text); } catch { return toast("That file isn't a Dear Reader backup."); }
  if (d?.app !== "dearreader" || !d.state) return toast("That file isn't a Dear Reader backup.");
  openSheet(`${sheetHead("Restore this backup?", "Cancel")}<p style="font-weight:600;color:var(--head);margin-bottom:1rem">Backup from ${esc(fd(String(d.exportedAt || "").slice(0, 10) || app.today))} with ${(d.state.books || []).length} books. It replaces what's on this device now.</p><button type="button" class="btn primary full" data-act="restore-go">Yes, restore it</button>`, { label: "Restore" });
  actions["restore-go"] = () => { const st = normalise(d.state); st.meta.unlocked = true; st.meta.setupDone = true; st.meta.demo = app.demo; app.S = st; commit(null); applyLook(); closeSheet(); app.view = "home"; render(); toast("Restored. Welcome back."); };
};
actions["move-phone"] = () => {
  const link = location.origin + location.pathname.replace(/index\.html$/, "");
  openSheet(`${sheetHead("Move to my phone (or laptop)")}<p class="small muted" style="margin-bottom:1rem">Your books live on this device only, for privacy. Moving them takes a minute.</p>
    <ol class="steps"><li>Make a backup here<div style="margin-top:.4rem"><button type="button" class="btn soft small" data-act="backup">Back up now</button></div></li><li>Send the file to yourself<small>AirDrop, WhatsApp to yourself, email or Google Drive.</small></li>
    <li>On the other device, open Dear Reader<small><span style="word-break:break-all">${esc(link)}</span></small></li><li>Unlock, then Settings &rarr; Restore from a backup</li></ol>`, { label: "Move" });
};
actions["export-csv"] = async () => {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Title", "Author", "ISBN", "Status", "Genre", "Format", "Where from", "Owned", "Pages", "Started", "Finished", "Rating", "Spice", "Tropes", "Moods", "Series", "Series #", "Price", "Bought on", "Quotes", "Notes"];
  const rows = S().books.map(b => [q(b.title), q(b.author), q(b.isbn), STATUS_LABEL[b.status], q(b.genre), b.format, b.source, B.isOwned(b) ? "yes" : "", b.pages || "", b.started || "", b.finished || "", b.rating || "", b.spice || "", q((b.tropes || []).join(", ")), q((b.moods || []).join(", ")), q(b.series), b.seriesNo ?? "", b.price ?? "", b.boughtOn || "", q((b.quotes || []).map(x => x.text).join(" | ")), q(b.notes)].join(","));
  await shareOrDownload(`dear-reader-books-${app.today}.csv`, "﻿" + [head.join(","), ...rows].join("\r\n"), "text/csv");
  toast("Exported. Open it in Google Sheets (File, Import) or Excel.");
};
actions["ics"] = async () => {
  const due = S().books.filter(b => b.dueDate && b.status !== "read");
  if (!due.length) return toast("No library due dates yet. Add one on a borrowed book.");
  const D = s => s.replace(/-/g, ""), e = s => String(s).replace(/[\\;,]/g, m => "\\" + m);
  const ev = due.map(b => ["BEGIN:VEVENT", `UID:due-${b.id}@dearreader`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${D(b.dueDate)}`, `DTEND;VALUE=DATE:${D(B.addDays(b.dueDate, 1))}`, `SUMMARY:${e(`Library book due: ${b.title}`)}`, "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${e(`${b.title} is due back tomorrow`)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT"].join("\r\n"));
  await shareOrDownload("dear-reader-due-dates.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dear Agneta//Dear Reader//EN", ...ev, "END:VCALENDAR", ""].join("\r\n"), "text/calendar");
  toast("Open the file to add your due dates to your calendar.");
};
let deferredPrompt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
actions["install-help"] = () => openSheet(`${sheetHead("Put Dear Reader on your home screen")}<p class="small muted" style="margin-bottom:1rem">Then it opens like an app, works offline, and your phone keeps your books safe.</p>
  ${deferredPrompt ? `<button type="button" class="btn primary full" data-act="install-now" style="margin-bottom:1rem">Install now</button>` : ""}
  <h3 class="fr it" style="color:var(--head);margin-bottom:.5rem">iPhone or iPad</h3><ol class="steps"><li>Open this page in Safari</li><li>Tap the Share button<small>The square with an arrow.</small></li><li>Tap "Add to Home Screen", then "Add"</li></ol>
  <h3 class="fr it" style="color:var(--head);margin:.4rem 0 .5rem">Android</h3><ol class="steps"><li>Open this page in Chrome</li><li>Tap the three dots, top right</li><li>Tap "Install app" or "Add to Home screen"</li></ol>
  <h3 class="fr it" style="color:var(--head);margin:.4rem 0 .5rem">Laptop</h3><ol class="steps"><li>Chrome or Edge: the install icon at the right end of the address bar</li><li>Safari on Mac: File, then "Add to Dock"</li></ol>`, { label: "Install" });
actions["install-now"] = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; closeSheet(); };
actions["erase"] = () => openSheet(`${sheetHead("Erase everything?", "Cancel")}<p style="font-weight:600;color:var(--head);margin-bottom:1rem">This deletes every book on this device. It can't be undone. Make a backup first if you might want them back.</p><button type="button" class="btn soft full" data-act="backup" style="margin-bottom:.6rem">Back up first</button><button type="button" class="btn danger full" data-act="erase-go">Yes, erase everything</button>`, { label: "Erase" });
actions["erase-go"] = async () => { await store.wipe(); location.reload(); };
forms["profile"] = f => {
  commit(s => Object.assign(s.profile, { name: val(f, "name").trim().slice(0, 30), yearGoal: Math.max(0, Number(val(f, "yearGoal")) || 0), monthBudget: num(val(f, "monthBudget")) || 0, currency: val(f, "currency"), locale: val(f, "locale") }));
  toast("Saved.");
};

// ============ Unlock and setup ============
const CODE_HASH = "d916c3344af637508bb5b24702c4461cf12bcbd62fe99208cea314e41d372fa3";
async function codeOK(code) {
  try { const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""))); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("") === CODE_HASH; }
  catch { return false; }
}
export function renderUnlock(msg = "") {
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card"><div class="logo fr it">Dear Reader <img src="img/motif.png" alt=""></div>
    <h1 class="fr" style="font-size:1.7rem;color:var(--head);margin-bottom:.4rem">Welcome, <em class="it" style="color:var(--deep)">reader.</em></h1>
    <p style="font-weight:600;margin-bottom:1.2rem">Type the unlock code from your Etsy download (the PDF). You only do this once on each device.</p>
    <form data-form="unlock"><label class="field"><span>Unlock code</span><input class="input" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXXXX-XXXX" autofocus></label>
    ${msg ? `<p style="color:var(--link);font-weight:800;margin:-.3rem 0 .8rem">${esc(msg)}</p>` : ""}<button class="btn primary full" type="submit">Unlock</button></form>
    <p class="small muted" style="margin-top:1rem">Haven't bought it yet? <a href="?demo">Try the free demo</a>, or <a href="${ETSY_URL}" target="_blank" rel="noopener">find it on Etsy</a>.</p></div></div>`;
}
forms["unlock"] = async f => {
  if (!(await codeOK(val(f, "code")))) return renderUnlock("That code doesn't match. Check the PDF, or message the shop and we'll help.");
  app.S = blankState(); app.S.meta.unlocked = true; store.save(app.S); await store.flush(); wz = null; renderSetup();
};
let wz = null;
export function renderSetup() {
  if (!wz) wz = { step: 1, name: "", currency: guessCurrency(), look: "academia", goal: 30, budget: "", spice: true };
  document.documentElement.dataset.look = wz.look;
  const prog = `<div class="progress">${[1, 2, 3].map(i => `<i class="${i <= wz.step ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (wz.step === 1) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Hello, reader. Let's make it yours.</h1><p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">Three quick steps. You can change everything later.</p>
    <label class="field"><span>What should I call you? <span class="muted">(optional)</span></span><input class="input" name="name" value="${esc(wz.name)}" autocomplete="given-name"></label>
    <div class="field"><span>Pick your look</span><div class="looks">${Object.entries(LOOKS).map(([k, l]) => `<button type="button" class="look" data-act="wz-look" data-v="${k}" aria-pressed="${wz.look === k}" style="--sw:${l.swatch};--pp:${l.paper}"><i></i>${esc(l.name)}</button>`).join("")}</div></div>`;
  if (wz.step === 2) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Your reading year</h1><p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">A goal is optional. No streaks, no pressure.</p>
    <div class="row2"><label class="field"><span>Books this year</span><input class="input" name="goal" type="number" min="0" inputmode="numeric" value="${wz.goal}"></label>
    <label class="field"><span>Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, l]) => `<option value="${c}"${c === wz.currency ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label></div>
    <label class="field"><span>Book budget a month <span class="muted">(optional)</span></span><input class="input" name="budget" inputmode="decimal" value="${esc(wz.budget)}" placeholder="0"><small>Dear Reader shows what books cost you, and what borrowing saves.</small></label>
    <label class="check"><input type="checkbox" name="spice"${wz.spice ? " checked" : ""}> Show spice levels and tropes on books</label>`;
  if (wz.step === 3) body = `<h1 class="fr" style="font-size:1.8rem;color:var(--head)">Bring your books</h1><p class="muted" style="margin:.4rem 0 1.2rem;font-weight:600">Already track your reading somewhere? Bring it all in one go.</p>
    <button type="button" class="opt" data-act="wz-import"><div class="t"><b>Import from Goodreads or StoryGraph</b></div><small>Goodreads: My Books, Import and export, Export library. StoryGraph: Manage account, Export.</small></button>
    <button type="button" class="opt" data-act="wz-import"><div class="t"><b>Import my Dear Agneta Book Tracker</b></div><small>In the sheet: File, Download, CSV (on the Books tab).</small></button>
    <button type="button" class="opt" data-act="wz-done" data-then="scan"><div class="t"><b>Scan or search my first book</b></div><small>Start fresh, one book at a time.</small></button>`;
  document.getElementById("app").innerHTML = `<div class="center-screen"><div class="center-card card" style="max-width:36rem"><div class="logo fr it">Dear Reader <img src="img/motif.png" alt=""></div>${prog}
    <form data-form="setup">${body}<div style="display:flex;gap:.6rem;margin-top:1.2rem">${wz.step > 1 ? `<button type="button" class="btn ghost" data-act="wz-back">Back</button>` : ""}${wz.step < 3 ? `<button class="btn primary" type="submit" style="flex:1">Next</button>` : `<button type="button" class="btn text" data-act="wz-done" style="flex:1">Skip for now</button>`}</div></form></div></div>`;
}
function guessCurrency() { const r = (navigator.language || "").split("-")[1] || ""; return { US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CH: "CHF", IN: "INR", ZA: "ZAR" }[r] || "EUR"; }
function syncWz() { const f = document.querySelector('form[data-form="setup"]'); if (!f) return; if (f.elements.name) wz.name = f.elements.name.value; if (f.elements.goal) { wz.goal = Number(f.elements.goal.value) || 0; wz.currency = f.elements.currency.value; wz.budget = f.elements.budget.value; wz.spice = f.elements.spice.checked; } }
actions["wz-look"] = el => { syncWz(); wz.look = el.dataset.v; renderSetup(); };
actions["wz-back"] = () => { syncWz(); wz.step--; renderSetup(); };
forms["setup"] = () => { syncWz(); wz.step = Math.min(3, wz.step + 1); renderSetup(); };
function finishSetup() {
  Object.assign(S().profile, { name: wz.name.trim().slice(0, 30), look: wz.look, yearGoal: wz.goal, currency: wz.currency, monthBudget: num(wz.budget) || 0, spice: wz.spice });
  S().meta.setupDone = true; S().meta.createdAt = new Date().toISOString();
  commit(null, { render: false }); store.askToPersist(); wz = null; app.view = "home"; app.start();
}
actions["wz-done"] = el => { const then = el.dataset.then; finishSetup(); if (then === "scan") setTimeout(() => actions["add-book"]({ dataset: { mode: canScan() ? "scan" : "search" } }), 300); else if (isIOS() && !isStandalone()) setTimeout(() => actions["install-help"](), 500); };
actions["wz-import"] = () => { finishSetup(); setTimeout(() => actions["import"](), 200); };
