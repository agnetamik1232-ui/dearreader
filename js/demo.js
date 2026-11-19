// Dear Reader — the free demo: Mia's reading life, always dated around today.
// Public-domain classics only, and only real quotes from them (never invented ones).
import { addDays, iso, parts, diffDays } from "./books.js";
import { blankState, newBook, uid } from "./model.js";

const CAT = [
  // title, author, pages, genre
  ["Pride and Prejudice", "Jane Austen", 432, "Romance"], ["Emma", "Jane Austen", 474, "Romance"], ["Northanger Abbey", "Jane Austen", 251, "Romance"],
  ["Mansfield Park", "Jane Austen", 507, "Romance"], ["North and South", "Elizabeth Gaskell", 521, "Romance"], ["Wuthering Heights", "Emily Brontë", 416, "Romance"],
  ["Far from the Madding Crowd", "Thomas Hardy", 433, "Romance"], ["The Scarlet Pimpernel", "Baroness Orczy", 288, "Romance"],
  ["Jane Eyre", "Charlotte Brontë", 532, "Classics"], ["Great Expectations", "Charles Dickens", 505, "Classics"], ["A Tale of Two Cities", "Charles Dickens", 489, "Classics"],
  ["Anna Karenina", "Leo Tolstoy", 864, "Classics"], ["Madame Bovary", "Gustave Flaubert", 329, "Classics"], ["Crime and Punishment", "Fyodor Dostoevsky", 671, "Classics"],
  ["The Great Gatsby", "F. Scott Fitzgerald", 180, "Literary"], ["Little Women", "Louisa May Alcott", 759, "Literary"], ["The Age of Reason", "Thomas Paine", 220, "Non-fiction"],
  ["Anne of Green Gables", "L. M. Montgomery", 320, "Literary"], ["Anne of Avonlea", "L. M. Montgomery", 288, "Literary"], ["Anne of the Island", "L. M. Montgomery", 272, "Literary"],
  ["Alice's Adventures in Wonderland", "Lewis Carroll", 96, "Fantasy"], ["Through the Looking-Glass", "Lewis Carroll", 112, "Fantasy"], ["The Wonderful Wizard of Oz", "L. Frank Baum", 154, "Fantasy"],
  ["The Marvelous Land of Oz", "L. Frank Baum", 287, "Fantasy"], ["Peter Pan", "J. M. Barrie", 176, "Fantasy"], ["The Princess and the Goblin", "George MacDonald", 224, "Romantasy"],
  ["The Phantom of the Opera", "Gaston Leroux", 360, "Romantasy"], ["Beauty and the Beast", "Jeanne-Marie Leprince de Beaumont", 96, "Romantasy"],
  ["A Study in Scarlet", "Arthur Conan Doyle", 188, "Thriller"], ["The Sign of the Four", "Arthur Conan Doyle", 160, "Thriller"], ["The Hound of the Baskervilles", "Arthur Conan Doyle", 256, "Thriller"],
  ["The Moonstone", "Wilkie Collins", 528, "Thriller"], ["The Woman in White", "Wilkie Collins", 672, "Thriller"], ["Strange Case of Dr Jekyll and Mr Hyde", "Robert Louis Stevenson", 144, "Thriller"],
  ["The Turn of the Screw", "Henry James", 120, "Thriller"], ["The Thirty-Nine Steps", "John Buchan", 138, "Thriller"],
  ["Frankenstein", "Mary Shelley", 280, "Sci-fi"], ["The Time Machine", "H. G. Wells", 118, "Sci-fi"], ["The War of the Worlds", "H. G. Wells", 192, "Sci-fi"],
  ["Twenty Thousand Leagues Under the Seas", "Jules Verne", 437, "Sci-fi"], ["Journey to the Centre of the Earth", "Jules Verne", 240, "Sci-fi"],
  ["Walden", "Henry David Thoreau", 352, "Non-fiction"], ["Meditations", "Marcus Aurelius", 254, "Non-fiction"], ["Narrative of the Life of Frederick Douglass", "Frederick Douglass", 122, "Non-fiction"],
  ["The Secret Garden", "Frances Hodgson Burnett", 331, "Other"], ["A Little Princess", "Frances Hodgson Burnett", 242, "Other"], ["Black Beauty", "Anna Sewell", 255, "Other"], ["Heidi", "Johanna Spyri", 288, "Other"],
  ["The Picture of Dorian Gray", "Oscar Wilde", 254, "Classics"], ["Middlemarch", "George Eliot", 880, "Literary"], ["A Room with a View", "E. M. Forster", 256, "Romance"],
  ["The Odyssey", "Homer", 416, "Classics"], ["Treasure Island", "Robert Louis Stevenson", 292, "Other"], ["The Jungle Book", "Rudyard Kipling", 224, "Other"],
  ["Sense and Sensibility", "Jane Austen", 409, "Romance"], ["Dracula", "Bram Stoker", 418, "Thriller"], ["Persuasion", "Jane Austen", 288, "Romance"],
];
const SERIES = { "Anne of Green Gables": ["Anne of Green Gables", 1, 8], "Anne of Avonlea": ["Anne of Green Gables", 2, 8], "Anne of the Island": ["Anne of Green Gables", 3, 8],
  "A Study in Scarlet": ["Sherlock Holmes", 1, 4], "The Sign of the Four": ["Sherlock Holmes", 2, 4], "The Hound of the Baskervilles": ["Sherlock Holmes", 3, 4],
  "The Wonderful Wizard of Oz": ["Oz", 1, 14], "The Marvelous Land of Oz": ["Oz", 2, 14], "Alice's Adventures in Wonderland": ["Alice", 1, 2], "Through the Looking-Glass": ["Alice", 2, 2],
  "Little Women": ["Little Women", 1, 3] };
const QUOTES = {
  "Pride and Prejudice": "I declare after all there is no enjoyment like reading!",
  "Jane Eyre": "I am no bird; and no net ensnares me.",
  "Little Women": "I'm not afraid of storms, for I'm learning how to sail my ship.",
  "Anne of Green Gables": "Isn't it nice to think that tomorrow is a new day with no mistakes in it yet?",
  "Frankenstein": "Beware; for I am fearless, and therefore powerful.",
  "Wuthering Heights": "Whatever our souls are made of, his and mine are the same.",
  "Persuasion": "You pierce my soul. I am half agony, half hope.",
};
const TROPES = { "Pride and Prejudice": ["enemies to lovers", "slow burn"], "Persuasion": ["second chance", "slow burn", "letters"], "Jane Eyre": ["slow burn", "morally grey"],
  "North and South": ["enemies to lovers", "grumpy sunshine"], "Emma": ["friends to lovers", "small town"], "Wuthering Heights": ["morally grey"], "The Phantom of the Opera": ["morally grey"],
  "Little Women": ["found family", "coming of age"], "Anne of Green Gables": ["found family", "small town"], "The Hound of the Baskervilles": ["locked room"] };
const SPICE = { "Wuthering Heights": 1, "Persuasion": 1, "Pride and Prejudice": 1, "North and South": 1, "The Phantom of the Opera": 2, "Madame Bovary": 2, "Anna Karenina": 1, "Beauty and the Beast": 1 };
const MOOD = { Romance: ["romantic", "hopeful"], Classics: ["reflective", "emotional"], Literary: ["cosy", "emotional"], Fantasy: ["adventurous", "funny"], Romantasy: ["romantic", "dark"],
  Thriller: ["mysterious", "tense"], "Sci-fi": ["adventurous", "tense"], "Non-fiction": ["reflective", "inspiring"], Other: ["cosy", "hopeful"] };

function rng(seed) { let x = seed; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; }

export function demoState(today) {
  const S = blankState();
  const [Y] = parts(today);
  S.profile = { ...S.profile, name: "Mia", currency: "EUR", locale: "en-GB", yearGoal: 50, monthBudget: 20, spice: true };
  S.meta = { ...S.meta, setupDone: true, unlocked: true, demo: true, lastBackup: new Date(Date.now() - 2 * 86400000).toISOString(), installHintSeen: true };
  const r = rng(Y * 7 + 3);
  const pick = a => a[Math.floor(r() * a.length)];
  const by = {};
  const add = (row, extra) => {
    const [title, author, pages, genre] = row;
    const sr = SERIES[title];
    const b = newBook({ title, author, pages, genre, moods: MOOD[genre], tropes: TROPES[title] || [], spice: SPICE[title] || 0,
      series: sr ? sr[0] : "", seriesNo: sr ? sr[1] : null, seriesTotal: sr ? sr[2] : null, quotes: QUOTES[title] ? [{ text: QUOTES[title] }] : [], ...extra });
    S.books.push(b); by[title] = b; return b;
  };
  const special = new Set(["Persuasion", "Sense and Sensibility", "Dracula", "Middlemarch", "A Room with a View", "The Odyssey", "Treasure Island", "The Jungle Book", "The Age of Reason"]);
  const pool = CAT.filter(c => !special.has(c[0]));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // This year: 41 finished reads spread from early January to a few days ago.
  const dayOfYear = diffDays(iso(Y, 1, 1), today);
  const n = Math.max(3, Math.min(41, pool.length, Math.round(48.5 * (dayOfYear + 1) / 366)));
  // Uneven gaps between finished books, like a real reading year (busy holidays, slow months).
  const gaps = Array.from({ length: n }, (_, i) => 0.35 + r() * 1.3 + (i % 9 === 4 ? 1.4 : 0));
  const total = gaps.reduce((a, b) => a + b, 0), span = Math.max(n * 0.25, dayOfYear - 3);
  let acc = 0; const at = gaps.map(g => (acc += g) / total * span);
  const sources = ["bought", "bought", "library", "library", "ku", "gift", "bought", "library"];
  for (let i = 0; i < n; i++) {
    const fin = addDays(today, -Math.max(1, Math.round(span + 2 - at[i])));
    const started = addDays(fin, -(5 + Math.floor(r() * 12)));
    const src = sources[i % sources.length];
    const price = src === "gift" ? null : Math.round((7.99 + r() * 8) * 100) / 100;
    const rating = [3.5, 3.75, 4, 4, 4.25, 4.5, 4.5, 5][Math.floor(r() * 8)];
    add(pool[i], { status: "read", started, finished: fin, rating, format: i % 7 === 3 ? "ebook" : "paper", source: src, owned: src === "bought" || src === "gift",
      price: src === "bought" || src === "library" || src === "ku" ? price : null, boughtOn: src === "bought" ? started : null, addedAt: addDays(started, -10) });
  }
  // Last year: a handful, for the look-back numbers.
  for (const [i, row] of pool.slice(n).entries()) add(row, { status: "read", started: iso(Y - 1, 3 + i, 2), finished: iso(Y - 1, 3 + i, 20), rating: 4, source: "bought", owned: true, price: 9.99, boughtOn: iso(Y - 1, 3 + i, 1), addedAt: iso(Y - 1, 3 + i, 1) });
  by["Jane Eyre"].rating = 5; by["Pride and Prejudice"].rating = 5; by["Anne of Green Gables"].rating = 5; by["Little Women"].rating = 4.75;
  // Reading now.
  const p = add(CAT.find(c => c[0] === "Persuasion"), { status: "reading", started: addDays(today, -22), progress: 212, source: "library", price: 9.99, dueDate: addDays(today, 13), rating: 4.25 });
  const mc = add(["The Count of Monte Cristo", "Alexandre Dumas", 1276, "Classics"], { status: "reading", format: "audio", minutes: 2760, progress: 480, started: addDays(today, -9), source: "ku", price: 14.99 });
  for (let d = 13; d >= 0; d--) {
    if (d % 4 !== 2) S.log.push({ id: uid(), date: addDays(today, -d), bookId: p.id, amount: 18 + Math.floor(r() * 14) });
    if (d % 3 === 0) S.log.push({ id: uid(), date: addDays(today, -d), bookId: mc.id, amount: 40 + Math.floor(r() * 30) });
  }
  // Up next and did-not-finish.
  for (const t of ["Middlemarch", "Dracula", "Sense and Sensibility", "Treasure Island", "The Odyssey"]) add(CAT.find(c => c[0] === t), { status: "tbr", source: "bought", owned: true, price: 9.49, boughtOn: addDays(today, -40), addedAt: addDays(today, -40) });
  add(["Little Men", "Louisa May Alcott", 376, "Literary"], { status: "tbr", source: "gift", owned: true, series: "Little Women", seriesNo: 2, seriesTotal: 3 });
  add(["The Valley of Fear", "Arthur Conan Doyle", 224, "Thriller"], { status: "tbr", source: "library", series: "Sherlock Holmes", seriesNo: 4, seriesTotal: 4 });
  add(["Moby-Dick", "Herman Melville", 635, "Classics"], { status: "dnf", dnfPage: 212, started: addDays(today, -70), finished: addDays(today, -60), source: "library", price: 11.99, notes: "Too many whales for now. Maybe next summer." });
  // Wishlist.
  add(CAT.find(c => c[0] === "A Room with a View"), { status: "wish", price: 8.99, where: "Local bookshop", forGift: true });
  add(["Jo's Boys", "Louisa May Alcott", 352, "Literary"], { status: "wish", price: 10.5, where: "Any bookshop", forGift: true, series: "Little Women", seriesNo: 3, seriesTotal: 3 });
  add(["The Age of Innocence", "Edith Wharton", 336, "Romance"], { status: "wish", price: 9.99, where: "Local bookshop", forGift: true });
  add(["The Jungle Book", "Rudyard Kipling", 224, "Other"], { status: "wish", price: 6.99, where: "Second-hand", forGift: false });
  return S;
}

// The pretend scan in the demo: a real book that isn't on Mia's shelves yet, but continues a series she reads.
export const DEMO_SCAN = { isbn: "", title: "Anne of Windy Poplars", author: "L. M. Montgomery", pages: 304, cover: "", series: "Anne of Green Gables", seriesNo: 4 };
