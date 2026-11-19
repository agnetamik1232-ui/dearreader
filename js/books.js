// Dear Reader — the reading maths. Pure functions only (no DOM), so they can be tested in Node.
// Dates are "YYYY-MM-DD" strings in the reader's own calendar.
import { BORROWED, OWNED } from "./model.js";

const DAY = 86400000;
export const pad = n => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = s => s.split("-").map(Number);
export const dayNum = s => { const [y, m, d] = parts(s); return Math.round(Date.UTC(y, m - 1, d) / DAY); };
export const fromDayNum = n => { const t = new Date(n * DAY); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
export const diffDays = (a, b) => dayNum(b) - dayNum(a);
export const todayISO = (now = new Date()) => iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const yearOf = s => (s ? Number(String(s).slice(0, 4)) : null);
export const sum = (a, f = x => x) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
export const round2 = n => Math.round(n * 100) / 100;

// ---------- ISBN ----------
export const cleanISBN = s => String(s || "").toUpperCase().replace(/[^0-9X]/g, "");
export function isbn10to13(i) {
  if (i.length !== 10) return i;
  const core = "978" + i.slice(0, 9);
  let t = 0; for (let k = 0; k < 12; k++) t += Number(core[k]) * (k % 2 ? 3 : 1);
  return core + ((10 - (t % 10)) % 10);
}
export const isbnKey = s => { const c = cleanISBN(s); return c.length === 10 ? isbn10to13(c) : c; };
export function validISBN(s) {
  const c = cleanISBN(s);
  if (c.length === 13 && /^\d{13}$/.test(c)) { let t = 0; for (let k = 0; k < 12; k++) t += Number(c[k]) * (k % 2 ? 3 : 1); return (10 - (t % 10)) % 10 === Number(c[12]); }
  if (c.length === 10) { let t = 0; for (let k = 0; k < 10; k++) t += (c[k] === "X" ? 10 : Number(c[k])) * (10 - k); return t % 11 === 0; }
  return false;
}

// ---------- Ownership and reads ----------
export const isOwned = b => !!b.owned || OWNED.includes(b.source);
export const isBorrowed = b => BORROWED.includes(b.source);
// Every finished read of a book: the main one and any re-reads.
export function reads(b) {
  const out = [];
  if (b.status === "read" && b.finished) out.push({ book: b, date: b.finished, rating: b.rating });
  for (const r of b.rereads || []) if (r.finished) out.push({ book: b, date: r.finished, rating: r.rating || b.rating });
  return out;
}
export const readsIn = (S, year) => S.books.flatMap(reads).filter(r => yearOf(r.date) === year).sort((a, b) => a.date.localeCompare(b.date));
export const length = b => (b.format === "audio" ? Number(b.minutes) || 0 : Number(b.pages) || 0);
export const percent = b => { const L = length(b); return L > 0 ? Math.max(0, Math.min(100, Math.round((Number(b.progress) || 0) / L * 100))) : 0; };

// ---------- Year stats ----------
export function yearStats(S, year, today) {
  const r = readsIn(S, year);
  const rated = r.filter(x => x.rating > 0);
  const byGenre = {}, byMonth = Array(12).fill(0);
  for (const x of r) { byGenre[x.book.genre || "Other"] = (byGenre[x.book.genre || "Other"] || 0) + 1; byMonth[Number(x.date.slice(5, 7)) - 1]++; }
  const topGenre = Object.entries(byGenre).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const busiest = byMonth.some(Boolean) ? byMonth.indexOf(Math.max(...byMonth)) : null;
  const spiced = r.filter(x => (x.book.spice || 0) > 0);
  const fav = [...rated].sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0] || null;
  const spent = round2(sum(S.books.filter(b => b.source === "bought" && yearOf(b.boughtOn || b.addedAt) === year && b.status !== "wish"), b => b.price));
  const savedBooks = S.books.filter(b => isBorrowed(b) && (yearOf(b.finished) === year || yearOf(b.started) === year));
  const saved = round2(sum(savedBooks, b => b.price));
  const goal = Number(S.profile.yearGoal) || 0;
  const done = r.length;
  let pace = null;
  if (goal > 0 && year === yearOf(today)) {
    const daysLeft = diffDays(today, iso(year, 12, 31)) + 1;
    const left = Math.max(0, goal - done);
    const expected = goal * (diffDays(iso(year, 1, 1), today) + 1) / (diffDays(iso(year, 1, 1), iso(year, 12, 31)) + 1);
    pace = { left, daysLeft, everyDays: left > 0 ? Math.max(1, Math.round(daysLeft / left)) : null, ahead: Math.round(done - expected) };
  }
  return {
    year, reads: r, books: done, pages: sum(r, x => x.book.format === "audio" ? 0 : x.book.pages), minutes: sum(r, x => x.book.format === "audio" ? x.book.minutes : 0),
    avgRating: rated.length ? round2(sum(rated, x => x.rating) / rated.length) : null, fiveStars: rated.filter(x => x.rating >= 5).length,
    byGenre, topGenre, byMonth, busiest, spiceAvg: spiced.length ? round2(sum(spiced, x => x.book.spice) / spiced.length) : null,
    fav, spent, saved, perBook: done ? round2(spent / done) : null, goal, pace, dnf: S.books.filter(b => b.status === "dnf" && yearOf(b.finished || b.started) === year).length,
  };
}

export function monthSpent(S, ym) {
  return round2(sum(S.books.filter(b => b.source === "bought" && (b.boughtOn || b.addedAt || "").slice(0, 7) === ym && b.status !== "wish"), b => b.price));
}

// One square per finished read this year, in reading order, coloured by genre; empty squares up to the goal.
export function quilt(S, year) {
  const r = readsIn(S, year);
  const squares = r.map(x => ({ genre: x.book.genre || "Other", title: x.book.title, date: x.date }));
  const goal = Number(S.profile.yearGoal) || 0;
  return { squares, empty: Math.max(0, goal - squares.length) };
}

// ---------- Reading now ----------
export function reading(S) {
  const last = {};
  for (const l of S.log) if (!last[l.bookId] || l.date > last[l.bookId]) last[l.bookId] = l.date;
  return S.books.filter(b => b.status === "reading").sort((a, b) => (last[b.id] || b.started || "").localeCompare(last[a.id] || a.started || ""));
}
export const loggedOn = (S, day) => sum(S.log.filter(l => l.date === day), l => l.amount);

// Pages (or minutes) a day for one book over the last two weeks, and a finish estimate.
export function pace(S, b, today) {
  const from = addDays(today, -13);
  const recent = S.log.filter(l => l.bookId === b.id && l.date >= from && l.date <= today);
  const first = recent.map(l => l.date).sort()[0];
  const per = recent.length ? sum(recent, l => l.amount) / (diffDays(first, today) + 1) : 0;
  const left = Math.max(0, length(b) - (Number(b.progress) || 0));
  return { perDay: Math.round(per), left, daysToGo: per > 0 ? Math.ceil(left / per) : null, finishOn: per > 0 ? addDays(today, Math.ceil(left / per)) : null };
}

// ---------- Up next ----------
export function upNext(S, n = 6) {
  const nextInSeries = new Set(series(S).map(s => s.nextRead?.id).filter(Boolean));
  return S.books.filter(b => b.status === "tbr")
    .sort((a, b) => (nextInSeries.has(b.id) - nextInSeries.has(a.id)) || (isOwned(b) - isOwned(a)) || (a.addedAt || "").localeCompare(b.addedAt || ""))
    .slice(0, n);
}

// ---------- Series ----------
export const seriesKey = s => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9à-ž]+/g, " ").trim();
export function series(S) {
  const groups = new Map();
  for (const b of S.books) {
    if (!b.series) continue;
    const k = seriesKey(b.series);
    if (!groups.has(k)) groups.set(k, { key: k, name: b.series.trim(), books: [], total: 0, status: "" });
    const g = groups.get(k);
    g.books.push(b);
    g.total = Math.max(g.total, Number(b.seriesTotal) || 0, Number(b.seriesNo) || 0);
    if (b.seriesStatus && !g.status) g.status = b.seriesStatus;
  }
  return [...groups.values()].map(g => {
    g.books.sort((a, b) => (Number(a.seriesNo) || 999) - (Number(b.seriesNo) || 999));
    g.author = g.books[0]?.author || "";
    g.slots = [];
    for (let n = 1; n <= Math.max(g.total, 1); n++) {
      const b = g.books.find(x => Number(x.seriesNo) === n);
      g.slots.push({ n, book: b || null, state: !b ? "missing" : b.status === "read" ? "read" : b.status === "reading" ? "reading" : b.status === "wish" ? "wish" : isOwned(b) ? "owned" : "listed" });
    }
    g.read = g.slots.filter(s => s.state === "read").length;
    g.nextRead = g.slots.find(s => s.book && s.state !== "read" && s.state !== "wish")?.book || null;
    const buy = g.slots.find(s => s.state === "missing" || s.state === "wish" || (s.book && s.state === "listed" && !isBorrowed(s.book)));
    g.nextBuy = buy ? buy.n : null;
    g.allOwned = g.slots.every(s => s.book && (isOwned(s.book) || s.state === "read"));
    g.autoStatus = g.read === g.slots.length && g.total > 0 ? "Completed" : g.read > 0 || g.slots.some(s => s.state === "reading") ? "In progress" : "Not started";
    return g;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- "Do I own this?" ----------
const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export function findBook(S, { isbn, title, author } = {}) {
  const key = isbn ? isbnKey(isbn) : "";
  if (key) { const b = S.books.find(x => x.isbn && isbnKey(x.isbn) === key); if (b) return b; }
  if (title) {
    const t = norm(title).replace(/\s*\b(a novel|novel)\b/g, "");
    const a = norm(author).split(" ").pop();
    return S.books.find(x => { const xt = norm(x.title); return (xt === t || (t.length > 6 && (xt.startsWith(t) || t.startsWith(xt)))) && (!a || norm(x.author).includes(a)); }) || null;
  }
  return null;
}
export function bookState(b) {
  if (!b) return "new";
  if (b.status === "wish") return "wish";
  if (b.status === "read" || (b.rereads || []).length) return isOwned(b) ? "owned-read" : "read";
  if (isOwned(b)) return "owned";
  return b.status;
}
// What you've read by the same author, for the "scan in a bookshop" card.
export function authorContext(S, author) {
  const a = norm(author).split(" ").pop();
  if (!a) return null;
  const mine = S.books.filter(b => norm(b.author).includes(a));
  if (!mine.length) return null;
  const ser = series(S).filter(g => g.books.some(b => norm(b.author).includes(a)));
  return { count: mine.length, read: mine.filter(b => b.status === "read").length, series: ser };
}

// Parse "Title (Series Name, #3)" the way Goodreads and many shops write it.
export function splitSeries(title) {
  const m = String(title || "").match(/^(.*?)\s*\(([^()#]+?),?\s*#\s*(\d+(?:\.\d+)?)\)\s*$/);
  return m ? { title: m[1].trim(), series: m[2].trim(), seriesNo: Number(m[3]) } : { title: String(title || "").trim(), series: "", seriesNo: null };
}

// ---------- Shelves: spines sorted like a rainbow by genre colour ----------
export function shelfBooks(S, show = "owned") {
  const list = S.books.filter(b => show === "all" ? b.status !== "wish" : show === "read" ? b.status === "read" : isOwned(b) && b.status !== "wish");
  const order = S.genres;
  return list.sort((a, b) => (order.indexOf(a.genre) - order.indexOf(b.genre)) || a.author.localeCompare(b.author) || a.title.localeCompare(b.title));
}
