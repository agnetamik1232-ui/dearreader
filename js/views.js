// Dear Reader — the screens.
import * as B from "./books.js";
import { app, esc, money, fd, fdLong, fdShort, fMonthShort, isIOS, isStandalone } from "./core.js";
import { cover, stars, spiceRow, progressText, progressBar, genreColor, STATUS_LABEL, ratingText } from "./ui.js";
import { LOOKS } from "./looks.js";
import { CURRENCIES } from "./model.js";

export const ETSY_URL = "https://dearagneta.etsy.com";
export const APP_VERSION = "1.0.0";
const NAV = [["home", "Home"], ["library", "Library"], ["shelves", "Shelves"], ["series", "Series"], ["wishlist", "Wishlist"], ["stats", "Stats"]];
const S = () => app.S;
const book = b => `data-act="open-book" data-id="${b.id}"`;

export function shell() {
  const v = app.view, cur = k => (v === k || (k === "more" && ["shelves", "wishlist", "stats", "settings", "more"].includes(v)) ? ' aria-current="page"' : "");
  return `${app.demo && !app.photo ? `<div class="demo-bar"><span>Free demo with an example reader. Try anything, nothing is saved.</span><a href="${ETSY_URL}" target="_blank" rel="noopener">Get Dear Reader</a></div>` : ""}
  <header class="top"><div class="top-in">
    <div class="logo fr it">Dear Reader <img src="img/motif.png" alt=""></div>
    <nav class="nav" aria-label="Main">${NAV.map(([k, l]) => `<button type="button" data-act="nav" data-view="${k}"${v === k ? ' aria-current="page"' : ""}>${l}</button>`).join("")}</nav>
    <div class="top-right"><button type="button" class="btn primary small scan-top" data-act="add-book" data-mode="scan">Scan a book</button><button type="button" class="chip" data-act="nav" data-view="settings"${v === "settings" ? ' aria-current="page"' : ""}>Settings</button></div>
  </div></header>
  <main class="main" id="main">${(views[v] || views.home)()}</main>
  <nav class="tabbar" aria-label="Main">
    <button type="button" data-act="nav" data-view="home"${cur("home")}>Home</button>
    <button type="button" data-act="nav" data-view="library"${cur("library")}>Library</button>
    <button type="button" class="add" data-act="add-book" data-mode="scan" aria-label="Scan a book">Scan</button>
    <button type="button" data-act="nav" data-view="series"${cur("series")}>Series</button>
    <button type="button" data-act="nav" data-view="more"${cur("more")}>More</button>
  </nav>`;
}

// ---------------- HOME ----------------
function home() {
  const st = B.yearStats(S(), B.yearOf(app.today), app.today);
  const rd = B.reading(S());
  const name = S().profile.name ? `Good ${greet()}, ${esc(S().profile.name)}. Happy <em class="it">reading.</em>` : `Happy <em class="it">reading.</em>`;
  if (!S().books.length) return `<div class="hello"><div><div class="caps">${esc(fdLong(app.today))}</div><h1 class="fr">${name}</h1></div></div>
    <div class="grid"><section class="card s12 welcome"><h2>Your library starts here</h2><p>Scan the barcode on a book, search by title, or bring your books over from Goodreads, StoryGraph or your Dear Agneta Book Tracker.</p>
    <div class="row-btns"><button type="button" class="btn primary" data-act="add-book" data-mode="scan">Scan a book</button><button type="button" class="btn ghost" data-act="add-book" data-mode="search">Search by title</button><button type="button" class="btn text" data-act="import">Import my books</button></div></section></div>`;
  const due = S().books.filter(b => b.dueDate && b.status !== "read" && B.diffDays(app.today, b.dueDate) <= 7 && B.diffDays(app.today, b.dueDate) >= -30);
  const todayAmt = B.loggedOn(S(), app.today);
  return `<div class="hello"><div><div class="caps">${esc(fdLong(app.today))}</div><h1 class="fr">${name}</h1></div><div class="script">one more chapter</div></div>
  <div class="grid">
    <section class="card s7"><h3>Currently reading <small>${rd.length ? `${rd.length} ${rd.length === 1 ? "book" : "books"}${todayAmt ? ` · ${todayAmt} today` : ""}` : "nothing yet"}</small>${rd.length ? `<button type="button" class="act" data-act="add-book" data-mode="search">Start another</button>` : ""}</h3>
      ${rd.length ? `<div class="reading">${rd.slice(0, 2).map(readingCard).join("")}</div>${rd.length > 2 ? `<p class="small muted" style="margin-top:.8rem">and ${rd.length - 2} more in your Library</p>` : ""}`
        : `<div class="empty">Pick something from Up next and tap "Start reading".</div>`}
    </section>
    <section class="card s5 goal"><h3>${B.yearOf(app.today)} reading goal<button type="button" class="act" data-act="edit-goal">Change</button></h3>
      ${st.goal ? `<div class="big fr">${st.books} <small>of ${st.goal} books</small></div><div class="bar thick"><i style="width:${Math.min(100, st.books / st.goal * 100).toFixed(1)}%"></i></div>
      <p>${st.pace && st.pace.left > 0 ? `${st.pace.left} to go in ${weeks(st.pace.daysLeft)}, about one every ${st.pace.everyDays} ${st.pace.everyDays === 1 ? "day" : "days"}.` : st.books >= st.goal ? "Goal reached. Everything from here is a bonus." : ""}</p>`
        : `<div class="big fr">${st.books} <small>books this year</small></div><p>Set a goal if you'd like one. No pressure either way.</p>`}
      <div class="budget"><div><span class="caps">Spent</span><b>${money(st.spent, "r")}</b><small>this year</small></div><div><span class="caps">Saved</span><b class="good">${money(st.saved, "r")}</b><small>by borrowing</small></div><div><span class="caps">Per book</span><b>${st.perBook != null ? money(st.perBook) : "&ndash;"}</b><small>you read</small></div></div>
    </section>
    ${quiltCard(st)}
    <section class="card s5"><h3>Up next <small>from your to-read pile</small>${B.upNext(S()).length ? `<button type="button" class="act" data-act="pick-one">Pick one for me</button>` : ""}</h3>
      <div class="covers">${B.upNext(S(), 4).map(b => `<button type="button" class="cv" ${book(b)}>${cover(b, 92)}</button>`).join("") || `<div class="empty">Add books you want to read and they line up here.</div>`}</div>
      ${seriesHint()}${due.map(b => `<div class="note">${esc(b.title)} is due back at the library ${B.diffDays(app.today, b.dueDate) < 0 ? "and is overdue" : `on ${esc(fd(b.dueDate))}`}.</div>`).join("")}
    </section>
    <section class="card s12"><h3>Recently finished<button type="button" class="act" data-act="nav" data-view="library">Library</button></h3>
      <div class="covers wide">${S().books.flatMap(B.reads).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(r => `<button type="button" class="cv" ${book(r.book)}>${cover(r.book, 104)}${stars(r.rating, 14)}</button>`).join("") || `<div class="empty">Books you finish show up here.</div>`}</div>
    </section>
  </div>`;
}
const greet = () => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; };
const weeks = d => d >= 14 ? `${Math.round(d / 7)} weeks` : `${d} ${d === 1 ? "day" : "days"}`;

function readingCard(b) {
  const audio = b.format === "audio";
  return `<div class="rb"><button type="button" class="cv" ${book(b)}>${cover(b, 92)}</button><div class="info">
    <b>${esc(b.title)}</b><span class="au">${esc(b.author)}${audio ? " · audiobook" : b.format === "ebook" ? " · ebook" : ""}</span>
    ${progressBar(b)}<div class="pg"><span>${esc(progressText(b))}</span><span>${B.percent(b)}%</span></div>
    <div class="acts">${audio ? `<button type="button" class="btn soft small" data-act="add-progress" data-id="${b.id}" data-n="30">+30m</button><button type="button" class="btn soft small" data-act="add-progress" data-id="${b.id}" data-n="60">+1h</button>`
      : `<button type="button" class="btn soft small" data-act="add-progress" data-id="${b.id}" data-n="10">+10</button><button type="button" class="btn soft small" data-act="add-progress" data-id="${b.id}" data-n="25">+25</button>`}
      <button type="button" class="btn ghost small" data-act="finish" data-id="${b.id}">Finished</button></div></div></div>`;
}

function quiltCard(st) {
  const q = B.quilt(S(), st.year);
  const used = [...new Set(q.squares.map(s => s.genre))];
  return `<section class="card s7"><h3>Reading quilt <small>one square per book, in the order you read them</small></h3>
    <div class="quilt">${q.squares.map(s => `<i style="background:${genreColor(s.genre)}" title="${esc(s.title)} · ${esc(fdShort(s.date))}"></i>`).join("")}${'<i class="e"></i>'.repeat(Math.min(q.empty, 200))}</div>
    <div class="legend">${used.map(g => `<span><span class="sq" style="background:${genreColor(g)}"></span>${esc(g)}</span>`).join("")}${q.empty ? `<span><span class="sq e"></span>still to read</span>` : ""}</div></section>`;
}

function seriesHint() {
  const g = B.series(S()).find(x => x.nextRead && x.nextRead.status === "tbr" && x.read > 0);
  return g ? `<div class="note">${esc(g.nextRead.title)} is next in a series you're reading (#${g.nextRead.seriesNo}).</div>` : "";
}

// ---------------- LIBRARY ----------------
export const LIB_FILTERS = [["all", "All"], ["reading", "Reading"], ["tbr", "Want to read"], ["read", "Read"], ["dnf", "DNF"], ["owned", "Owned"], ["borrowed", "Borrowed"]];
function libraryList() {
  const f = app.libFilter || "all", q = (app.libQuery || "").toLowerCase().trim(), g = app.libGenre || "";
  let list = S().books.filter(b => b.status !== "wish");
  if (f === "owned") list = list.filter(B.isOwned); else if (f === "borrowed") list = list.filter(B.isBorrowed); else if (f !== "all") list = list.filter(b => b.status === f);
  if (g) list = list.filter(b => b.genre === g);
  if (q) list = list.filter(b => `${b.title} ${b.author} ${b.series} ${b.isbn} ${(b.tropes || []).join(" ")}`.toLowerCase().includes(q));
  const sort = app.libSort || "recent";
  const key = b => b.finished || b.started || b.addedAt || "";
  list.sort(sort === "title" ? (a, b) => a.title.localeCompare(b.title) : sort === "author" ? (a, b) => a.author.split(" ").pop().localeCompare(b.author.split(" ").pop()) : sort === "rating" ? (a, b) => (b.rating || 0) - (a.rating || 0) : (a, b) => key(b).localeCompare(key(a)));
  return list;
}
export function libraryGrid() {
  const list = libraryList(), q = (app.libQuery || "").trim();
  const wish = q ? S().books.filter(b => b.status === "wish" && `${b.title} ${b.author}`.toLowerCase().includes(q.toLowerCase())) : [];
  return `${q ? `<div class="own-check">${list.length ? `<b>${list.some(B.isOwned) ? "Yes, you own it." : list.some(b => b.status === "read") ? "You've read it (not owned)." : "It's in your library."}</b> ${list.length} ${list.length === 1 ? "match" : "matches"}` : wish.length ? `<b>It's on your wishlist.</b>` : `<b>Not in your library.</b> <button type="button" class="btn text small" data-act="add-book" data-mode="search" data-q="${esc(q)}">Find it and add it</button>`}</div>` : ""}
    <div class="wall">${[...list, ...wish].slice(0, 400).map((b, i) => `<button type="button" class="cv tile-b" ${book(b)}>${cover(b, 120, undefined, "", i >= 48)}<span class="tt">${esc(b.title)}</span><span class="ta">${b.status === "read" && b.rating ? stars(b.rating, 12) : esc(STATUS_LABEL[b.status])}</span></button>`).join("") || `<div class="empty" style="grid-column:1/-1">No books match.</div>`}</div>
    ${list.length > 400 ? `<p class="small muted">Showing 400 of ${list.length}. Search to narrow it down.</p>` : ""}`;
}
function library() {
  return `<h1 class="page-title fr">Library</h1><p class="page-sub">Every book you own, read or want to read. Type a title to check if you own it.</p>
  <div class="libbar"><input class="input" type="search" placeholder="Do I own this? Type a title, author or series" value="${esc(app.libQuery || "")}" data-live="lib-q" aria-label="Search your library">
    <select class="input" data-live="lib-genre" aria-label="Genre"><option value="">All genres</option>${S().genres.map(g => `<option${app.libGenre === g ? " selected" : ""}>${esc(g)}</option>`).join("")}</select>
    <select class="input" data-live="lib-sort" aria-label="Sort"><option value="recent">Newest first</option><option value="title"${app.libSort === "title" ? " selected" : ""}>Title A–Z</option><option value="author"${app.libSort === "author" ? " selected" : ""}>Author</option><option value="rating"${app.libSort === "rating" ? " selected" : ""}>Rating</option></select></div>
  <div class="seg" style="margin-bottom:1rem">${LIB_FILTERS.map(([k, l]) => `<button type="button" data-act="lib-filter" data-v="${k}" aria-pressed="${(app.libFilter || "all") === k}">${l}</button>`).join("")}</div>
  <div id="lib-grid">${libraryGrid()}</div>`;
}

// ---------------- SHELVES ----------------
function shelves() {
  const show = app.shelfShow || "owned";
  const list = B.shelfBooks(S(), show);
  const spine = b => { const p = Number(b.pages) || 300; const w = Math.max(18, Math.min(44, Math.round(14 + p / 28))); const h = p > 450 ? 100 : p > 250 ? 90 : 80;
    return `<button type="button" class="spine" ${book(b)} style="--c:${genreColor(b.genre)};width:${w}px;height:${h}%" title="${esc(b.title)} · ${esc(b.author)}"><span>${esc(b.title.length > 26 ? b.title.slice(0, 25) + "…" : b.title)}</span></button>`; };
  return `<h1 class="page-title fr">Shelves</h1><p class="page-sub">Your books as a bookcase, sorted like a rainbow by genre. Tap a spine to open it.</p>
  <div class="seg" style="margin-bottom:1rem">${[["owned", "Books I own"], ["read", "Books I've read"], ["all", "Everything"]].map(([k, l]) => `<button type="button" data-act="shelf-show" data-v="${k}" aria-pressed="${show === k}">${l}</button>`).join("")}</div>
  <div class="case" data-fit>${list.length ? `<div class="shelf">${list.map(spine).join("")}</div>` : `<div class="shelf empty-shelf"><span>Your shelf is waiting for its first book.</span></div>`}</div>
  <p class="small muted" style="margin-top:.8rem">${list.length} ${list.length === 1 ? "book" : "books"} &middot; thicker spines are longer books.</p>`;
}

// ---------------- SERIES ----------------
function seriesView() {
  const all = B.series(S());
  return `<h1 class="page-title fr">Series</h1><p class="page-sub">Every series in order: what you've read, what you own, and what to read or buy next. Add a series name and number on any book.</p>
  <div class="grid">${all.map(g => {
    const status = g.status || g.autoStatus;
    return `<section class="card s6 ser"><h3>${esc(g.name)} <small>${esc(g.author)}</small><button type="button" class="act" data-act="edit-series" data-key="${esc(g.key)}">Edit</button></h3>
      <div class="slots">${g.slots.map(s => `<button type="button" class="slot ${s.state}" ${s.book ? book(s.book) : `data-act="add-book" data-mode="search" data-q="${esc(g.name)} ${s.n}"`} title="${s.book ? esc(s.book.title) : "#" + s.n + " not added"}">${s.n}</button>`).join("")}</div>
      <div class="ser-meta"><span class="pill${status === "Completed" ? " good" : ""}">${esc(status)}</span><span>${g.read} of ${g.slots.length} read</span>
      ${g.nextRead ? `<span>Next to read: <b>${esc(g.nextRead.title)}</b></span>` : ""}${g.allOwned ? `<span class="good-t">Complete set</span>` : g.nextBuy ? `<span>Next to buy: <b>#${g.nextBuy}</b></span>` : ""}</div>
    </section>`; }).join("") || `<section class="card s12"><div class="empty">No series yet. Open a book and add its series name and number (or import from Goodreads, which fills them in).</div></section>`}</div>
  <div class="legend" style="margin-top:1rem"><span><span class="slot-key read"></span>read</span><span><span class="slot-key reading"></span>reading</span><span><span class="slot-key owned"></span>owned</span><span><span class="slot-key wish"></span>wishlist</span><span><span class="slot-key missing"></span>not added</span></div>`;
}

// ---------------- WISHLIST ----------------
function wishlist() {
  const list = S().books.filter(b => b.status === "wish");
  const total = B.sum(list.filter(b => b.forGift), b => b.price);
  return `<h1 class="page-title fr">Wishlist</h1><p class="page-sub">Books you'd love. Tick the ones that would make good gifts and send the list to family.</p>
  <div class="row-btns" style="margin-bottom:1.2rem"><button type="button" class="btn primary" data-act="share-wishlist">Send my wishlist to family</button><button type="button" class="btn ghost" data-act="add-book" data-mode="search" data-status="wish">+ Add a book</button></div>
  <div class="grid">${list.map(b => `<section class="card s4 wish"><div class="wish-in"><button type="button" class="cv" ${book(b)}>${cover(b, 78)}</button><div style="flex:1;min-width:0">
    <b class="fr">${esc(b.title)}</b><span class="muted small">${esc(b.author)}</span>
    <div class="small" style="margin-top:.4rem">${b.price ? money(b.price) : ""}${b.where ? ` · ${esc(b.where)}` : ""}</div>
    <button type="button" class="toggle small-t" data-act="wish-gift" data-id="${b.id}" aria-pressed="${!!b.forGift}"><i></i>Good gift</button>
    <div class="row-btns" style="margin-top:.5rem"><button type="button" class="btn soft small" data-act="wish-got" data-id="${b.id}">I got it</button></div></div></div></section>`).join("")
    || `<section class="card s12"><div class="empty">Nothing on your wishlist yet. Scan a book in a shop and tap "Add to my wishlist".</div></section>`}</div>
  ${list.length ? `<p class="small muted" style="margin-top:.8rem">${list.filter(b => b.forGift).length} marked as gifts${total ? `, about ${money(total, "r")} together` : ""}.</p>` : ""}`;
}

// ---------------- STATS ----------------
function statsView() {
  const years = [...new Set(S().books.flatMap(B.reads).map(r => B.yearOf(r.date)))].sort((a, b) => b - a);
  const Y = app.statsYear || B.yearOf(app.today);
  if (!years.includes(Y)) years.unshift(Y);
  const st = B.yearStats(S(), Y, app.today);
  const maxM = Math.max(1, ...st.byMonth);
  const months = st.byMonth.map((n, i) => `<div class="mbar"><i style="height:${(n / maxM * 100).toFixed(0)}%"></i><b>${n || ""}</b><span>${esc(fMonthShort(`${Y}-${String(i + 1).padStart(2, "0")}`).slice(0, 3))}</span></div>`).join("");
  const genres = Object.entries(st.byGenre).sort((a, b) => b[1] - a[1]);
  const ratings = [5, 4, 3, 2, 1].map(s => [s, st.reads.filter(r => r.rating > 0 && Math.ceil(r.rating) === s).length]);
  const maxR = Math.max(1, ...ratings.map(x => x[1]));
  const tropes = {}; for (const r of st.reads) for (const t of r.book.tropes || []) tropes[t] = (tropes[t] || 0) + 1;
  const topT = Object.entries(tropes).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return `<h1 class="page-title fr">Stats</h1><p class="page-sub">Your reading year in numbers. Every number comes from the books you've logged.</p>
  <div class="row-btns" style="margin-bottom:1rem"><select class="input" style="width:auto" data-live="stats-year" aria-label="Year">${years.map(y => `<option${y === Y ? " selected" : ""}>${y}</option>`).join("")}</select>
    <button type="button" class="btn primary" data-act="year-card" data-year="${Y}">Your year in books</button></div>
  <div class="kpis">
    <div class="card kpi"><span class="caps">Books</span><b>${st.books}</b><small>${st.goal ? `goal ${st.goal}` : ""}${st.dnf ? ` · ${st.dnf} not finished` : ""}</small></div>
    <div class="card kpi"><span class="caps">Pages</span><b>${st.pages.toLocaleString(S().profile.locale)}</b><small>${st.minutes ? `+ ${Math.round(st.minutes / 60)} h of audio` : "&nbsp;"}</small></div>
    <div class="card kpi"><span class="caps">Average rating</span><b>${st.avgRating ?? "&ndash;"}</b><small>${st.fiveStars} five-star reads</small></div>
    <div class="card kpi"><span class="caps">Saved by borrowing</span><b class="good">${money(st.saved, "r")}</b><small>spent ${money(st.spent, "r")}${st.perBook != null ? ` · ${money(st.perBook)} a book` : ""}</small></div>
  </div>
  <div class="grid">
    <section class="card s7"><h3>Books per month${st.busiest != null ? ` <small>busiest: ${esc(fMonthShort(`${Y}-${String(st.busiest + 1).padStart(2, "0")}`))}</small>` : ""}</h3><div class="months">${months}</div></section>
    <section class="card s5"><h3>Genres</h3>${genres.map(([g, n]) => `<div class="gbar"><span class="sq" style="background:${genreColor(g)}"></span><b>${esc(g)}</b><em>${n}</em><div class="bar"><i style="width:${(n / st.books * 100).toFixed(0)}%;background:${genreColor(g)}"></i></div></div>`).join("") || `<div class="empty">No books finished in ${Y} yet.</div>`}</section>
    <section class="card s4"><h3>Ratings</h3>${ratings.map(([s, n]) => `<div class="gbar"><span>${stars(s, 12)}</span><b></b><em>${n}</em><div class="bar"><i style="width:${(n / maxR * 100).toFixed(0)}%;background:var(--gold)"></i></div></div>`).join("")}</section>
    ${S().profile.spice ? `<section class="card s4"><h3>Spice & tropes</h3><div style="margin-bottom:.6rem">${st.spiceAvg != null ? `${spiceRow(Math.round(st.spiceAvg), 18)} <span class="small muted">average ${st.spiceAvg}</span>` : `<span class="small muted">No spice ratings yet.</span>`}</div><div class="chips">${topT.map(([t, n]) => `<span class="chip">${esc(t)} &middot; ${n}</span>`).join("") || `<span class="small muted">Add tropes on a book to see your favourites.</span>`}</div></section>` : ""}
    <section class="card s4"><h3>Book of the year</h3>${st.fav ? `<div style="display:flex;gap:1rem;align-items:center"><button type="button" class="cv" ${book(st.fav.book)}>${cover(st.fav.book, 84)}</button><div><b class="fr" style="font-size:1.15rem;color:var(--head)">${esc(st.fav.book.title)}</b><div class="muted small">${esc(st.fav.book.author)}</div>${stars(st.fav.rating, 15)}</div></div>` : `<div class="empty">Rate the books you finish.</div>`}</section>
  </div>`;
}

// ---------------- SETTINGS ----------------
function settings() {
  const P = S().profile;
  return `<h1 class="page-title fr">Settings</h1><p class="page-sub">Your look, your goals, and your books. Everything stays on this device.</p>
  <div class="grid">
    <section class="card s6"><h2>Look</h2>
      <div class="looks">${Object.entries(LOOKS).map(([k, l]) => `<button type="button" class="look" data-act="set-look" data-v="${k}" aria-pressed="${P.look === k}" style="--sw:${l.swatch};--pp:${l.paper}"><i></i>${esc(l.name)}</button>`).join("")}</div>
      <div class="field" style="margin-top:1rem"><span>Reading</span>
        <button type="button" class="toggle" data-act="set-big" aria-pressed="${P.bigText}"><i></i>Bigger text</button><br>
        <button type="button" class="toggle" data-act="set-easy" aria-pressed="${P.easyFont}"><i></i>Easy-reading font</button><br>
        <button type="button" class="toggle" data-act="set-spice" aria-pressed="${P.spice}"><i></i>Spice and tropes on books</button></div>
    </section>
    <section class="card s6"><h2>You and your goals</h2>
      <form data-form="profile">
        <label class="field"><span>Your name (optional)</span><input class="input" name="name" value="${esc(P.name)}" autocomplete="given-name"></label>
        <div class="row2"><label class="field"><span>Books a year</span><input class="input" name="yearGoal" type="number" min="0" max="999" inputmode="numeric" value="${P.yearGoal || ""}"></label>
        <label class="field"><span>Book budget a month</span><input class="input" name="monthBudget" inputmode="decimal" value="${P.monthBudget || ""}" placeholder="optional"></label></div>
        <div class="row2"><label class="field"><span>Currency</span><select class="input" name="currency">${CURRENCIES.map(([c, l]) => `<option value="${c}"${c === P.currency ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <label class="field"><span>Date style</span><select class="input" name="locale">${[["en-GB", "20 Nov 2026"], ["en-US", "Nov 20, 2026"], ["de-DE", "20. Nov. 2026"], ["fr-FR", "20 nov. 2026"], ["lt-LT", "2026 lapkr. 20"], ["nl-NL", "20 nov 2026"]].map(([l, d]) => `<option value="${l}"${l === P.locale ? " selected" : ""}>${d}</option>`).join("")}</select></label></div>
        <button class="btn primary" type="submit">Save</button>
      </form>
      <div class="sumline" style="margin-top:1rem"><span>Genres and their colours</span><button type="button" class="btn text small" data-act="edit-genres">Edit</button></div>
    </section>
    <section class="card s6"><h2>Your books <small>only on this device</small></h2>
      <div class="sumline"><span>Import from Goodreads, StoryGraph or your Book Tracker sheet</span><button type="button" class="btn soft small" data-act="import">Import</button></div>
      <div class="sumline"><span>Back up<span class="small muted" style="display:block;font-weight:600">A small file to keep in Files, Drive or email. Do it weekly.</span></span><button type="button" class="btn soft small" data-act="backup">Back up now</button></div>
      <div class="sumline"><span>Restore from a backup</span><button type="button" class="btn text small" data-act="restore">Choose file</button></div>
      <div class="sumline"><span>Move to my phone or laptop</span><button type="button" class="btn text small" data-act="move-phone">How</button></div>
      <div class="sumline"><span>Export for Google Sheets / Excel</span><button type="button" class="btn text small" data-act="export-csv">Export</button></div>
      <div class="sumline"><span>Library due dates in my phone calendar</span><button type="button" class="btn text small" data-act="ics">Get file</button></div>
    </section>
    <section class="card s6"><h2>Help</h2>
      <div class="sumline"><span>Put Dear Reader on my home screen</span><button type="button" class="btn text small" data-act="install-help">Show me</button></div>
      <div class="sumline"><span>Questions or ideas</span><a class="btn text small" href="${ETSY_URL}" target="_blank" rel="noopener">Message Dear Agneta</a></div>
      ${app.demo ? "" : `<div class="sumline"><span>Start over (erase everything on this device)</span><button type="button" class="btn danger small" data-act="erase">Erase</button></div>`}
      <p class="small muted" style="margin-top:.8rem">Dear Reader ${APP_VERSION} &middot; by Dear Agneta &middot; book details and covers from Open Library and Google Books.</p>
    </section>
  </div>`;
}

function more() {
  return `<h1 class="page-title fr">More</h1><div class="stack">
    <button type="button" class="opt" data-act="nav" data-view="shelves"><div class="t"><b>Shelves</b></div><small>Your bookcase, sorted like a rainbow</small></button>
    <button type="button" class="opt" data-act="nav" data-view="wishlist"><div class="t"><b>Wishlist</b></div><small>Books you'd love, and a list to send to family</small></button>
    <button type="button" class="opt" data-act="nav" data-view="stats"><div class="t"><b>Stats</b></div><small>Your year in books</small></button>
    <button type="button" class="opt" data-act="add-book" data-mode="search"><div class="t"><b>Add a book by title</b></div><small>Search, or type it in yourself</small></button>
    <button type="button" class="opt" data-act="nav" data-view="settings"><div class="t"><b>Settings</b></div><small>Look, goals, import, backup, help</small></button>
    ${!isStandalone() && isIOS() ? `<button type="button" class="opt" data-act="install-help"><div class="t"><b>Put it on my home screen</b></div><small>So it opens like an app and keeps your books safe</small></button>` : ""}
  </div>`;
}

export const views = { home, library, shelves, series: seriesView, wishlist, stats: statsView, settings, more };
