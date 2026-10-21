// Сверка B5: node scripts/b5-audit-shots.mjs <папка>
// Снимает экраны волны на 1440 и 390 (локальная база, демо-аккаунт, лекции из seed-b5-quiz.mjs).
import { chromium } from "playwright";
import PocketBase from "pocketbase";

const out = process.argv[2];
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";

const pb = new PocketBase(PB);
await pb.collection("users").authWithPassword("asyaobraz17@gmail.com", "12345678");
const idOf = async (slug) => (await pb.collection("lectures").getFirstListItem(`slug="${slug}"`)).id;
const ids = {
  none: await idOf("b5-no-quiz"),
  created: await idOf("b5-quiz-created"),
  started: await idOf("b5-quiz-started"),
  done: await idOf("b5-quiz-done"),
};
const decks = await pb.collection("decks").getFullList({ fields: "id,slug,title" }).catch(() => []);
const deckSlug = decks.find((d) => d.slug)?.slug;
console.log("decks", decks.map((d) => d.slug).join(","));

const LECT = (slug) => `/s/demo/math-analysis/${slug}`;
const desktop = [
  ["understanding-none", LECT("b5-no-quiz")],
  ["understanding-created", LECT("b5-quiz-created")],
  ["understanding-started", LECT("b5-quiz-started")],
  ["understanding-done", LECT("b5-quiz-done")],
  ["quiz-question", `/quiz/${ids.created}`],
  ["cards", "/decks"],
  ["deck", deckSlug ? `/decks/${deckSlug}` : "/decks"],
  ["cards-review", deckSlug ? `/decks/${deckSlug}/review` : "/cards/review"],
];
const mobile = [
  ["m-more", "/more"],
  ["m-profile", "/profile"],
  ["m-cards", "/decks"],
  ["m-deck", deckSlug ? `/decks/${deckSlug}` : "/decks"],
  ["m-quiz", `/quiz/${ids.created}`],
  ["m-home", "/s/demo"],
  ["m-schedule", "/schedule"],
  ["m-lectures", "/s/demo/lectures"],
];

const b = await chromium.launch();
async function run(width, height, list, mobileFlag) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: mobileFlag, isMobile: mobileFlag });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
  await p.fill('input[type="password"]', "12345678");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/s\//, { timeout: 15000 });
  for (const [name, url] of list) {
    await p.goto(`${BASE}${url}`);
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `${out}/${name}.png` });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(name, "overflow-x:", over);
  }
  await ctx.close();
}
await run(1440, 900, desktop, false);
await run(390, 900, mobile, true);
await b.close();
