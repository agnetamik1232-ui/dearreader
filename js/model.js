// Dear Reader — the shape of a reader's data, and defaults.
import { GENRES } from "./looks.js";
export const VERSION = 1;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const STATUSES = [["reading", "Reading"], ["tbr", "Want to read"], ["read", "Read"], ["dnf", "Did not finish"], ["wish", "Wishlist"]];
export const FORMATS = [["paper", "Paperback / hardback"], ["ebook", "Ebook"], ["audio", "Audiobook"]];
export const SOURCES = [["bought", "Bought"], ["gift", "Gift"], ["library", "Library"], ["ku", "Kindle Unlimited / subscription"], ["borrowed", "Borrowed from a friend"], ["", "Not sure"]];
export const BORROWED = ["library", "ku", "borrowed"];
export const OWNED = ["bought", "gift"];
export const TROPES = ["enemies to lovers", "friends to lovers", "slow burn", "second chance", "found family", "forced proximity", "grumpy sunshine", "fake dating", "chosen one", "morally grey", "small town", "dark academia", "magic school", "heist", "unreliable narrator", "locked room", "letters", "coming of age"];
export const MOODS = ["cosy", "hopeful", "emotional", "funny", "dark", "tense", "adventurous", "romantic", "reflective", "mysterious", "sad", "inspiring"];
export const CURRENCIES = [["EUR", "Euro (€)"], ["USD", "US dollar ($)"], ["GBP", "Pound (£)"], ["CAD", "Canadian dollar"], ["AUD", "Australian dollar"], ["NZD", "New Zealand dollar"], ["CHF", "Swiss franc"], ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"], ["ZAR", "South African rand"], ["INR", "Indian rupee"], ["SGD", "Singapore dollar"], ["JPY", "Japanese yen"], ["MXN", "Mexican peso"], ["BRL", "Brazilian real"], ["PHP", "Philippine peso"]];

export function blankState() {
  return {
    version: VERSION,
    profile: { name: "", currency: "EUR", locale: navLocale(), look: "academia", bigText: false, easyFont: false, spice: true, yearGoal: 30, monthBudget: 0 },
    books: [], log: [], genres: [...GENRES],
    meta: { createdAt: new Date().toISOString(), setupDone: false, unlocked: false, demo: false, lastBackup: null, installHintSeen: false, csvMaps: {} },
  };
}
function navLocale() { try { return navigator.language || "en-GB"; } catch { return "en-GB"; } }

export function newBook(fields = {}) {
  return {
    id: uid(), title: "", author: "", isbn: "", pages: null, minutes: null, cover: "", genre: "Other", format: "paper", source: "", owned: false,
    price: null, boughtOn: null, status: "tbr", progress: 0, started: null, finished: null, rating: 0, spice: 0, tropes: [], moods: [],
    series: "", seriesNo: null, seriesTotal: null, seriesStatus: "", notes: "", quotes: [], dnfPage: null, rereads: [], dueDate: null,
    forGift: false, where: "", addedAt: new Date().toISOString().slice(0, 10), ...fields,
  };
}

export function normalise(s) {
  const b = blankState();
  const out = { ...b, ...s };
  out.profile = { ...b.profile, ...(s.profile || {}) };
  out.meta = { ...b.meta, ...(s.meta || {}) };
  out.books = Array.isArray(s.books) ? s.books.map(x => newBook({ ...x, id: x.id || uid() })) : [];
  out.log = Array.isArray(s.log) ? s.log : [];
  out.genres = Array.isArray(s.genres) && s.genres.length ? s.genres : [...GENRES];
  out.version = VERSION;
  return out;
}
