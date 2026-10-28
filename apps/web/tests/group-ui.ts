/**
 * Помощники UI-тестов группы: человек = отдельный контекст браузера (вошёл через интерфейс) + сессия API
 * для данных, которые к сценарию не относятся (группа, лекции, предметы, билеты). Код приглашения и всё,
 * что проверяется, читается из интерфейса.
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { registerFresh } from "./helpers";
import { PB, createGroup, h, inviteCode, join, list, uid, type Session } from "./group-api";

/** Пароль, с которым registerFresh регистрирует аккаунт. */
const UI_PASSWORD = "test12345";

export interface Person {
  ctx: BrowserContext;
  page: Page;
  email: string;
  /** Имя в профиле: уникальное, по нему человека находят в списках группы. */
  name: string;
  api: Session;
}

/** Новый человек: регистрация и онбординг в своём окне браузера, плюс сессия API под тем же аккаунтом. */
export async function newPerson(browser: Browser, request: APIRequestContext, tag: string): Promise<Person> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const name = `${tag} ${uid()}`;
  const email = await registerFresh(page, "gui", name);
  const auth = await request.post(`${PB}/api/collections/users/auth-with-password`, { data: { identity: email, password: UI_PASSWORD } });
  expect(auth.ok(), await auth.text()).toBeTruthy();
  const body = await auth.json();
  return { ctx, page, email, name, api: { id: body.record.id, token: body.token, email } };
}

/** Предмет в семестре «1» (его создаёт онбординг) и лекция в нём. Возвращает id и адреса. */
export async function lectureInCourse(request: APIRequestContext, p: Person, courseName: string, title: string, content = `<p>текст ${uid()}</p>`) {
  const sem = (await list(request, p.api, "semesters", `slug="1"`))[0];
  expect(sem, "семестр 1 после онбординга").toBeTruthy();
  const courseSlug = `c-${uid()}`;
  const c = await request.post(`${PB}/api/collections/courses/records`, {
    headers: h(p.api),
    data: { name: courseName, owner: p.api.id, slug: courseSlug, semesters: sem.id },
  });
  expect(c.ok(), await c.text()).toBeTruthy();
  const courseId = (await c.json()).id as string;
  const lectureSlug = `l-${uid()}`;
  const l = await request.post(`${PB}/api/collections/lectures/records`, {
    headers: h(p.api),
    data: { title, slug: lectureSlug, content, owner: p.api.id, field: courseId },
  });
  expect(l.ok(), await l.text()).toBeTruthy();
  const id = (await l.json()).id as string;
  return { id, courseId, courseSlug, lectureSlug, href: `/s/1/${courseSlug}/${lectureSlug}`, content };
}

/** Ещё одна лекция в уже созданном предмете. */
export async function addLecture(request: APIRequestContext, p: Person, courseId: string, title: string, content = `<p>текст ${uid()}</p>`) {
  const r = await request.post(`${PB}/api/collections/lectures/records`, {
    headers: h(p.api),
    data: { title, slug: `l-${uid()}`, content, owner: p.api.id, field: courseId },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

/** Группа с открытой ссылкой: владелец и участники (вступили по коду через API). Название нужно экранам, поэтому возвращается. */
export async function makeGroup(request: APIRequestContext, owner: Person, members: Person[], label = "Группа") {
  const name = `${label} ${uid()}`;
  const g = await createGroup(request, owner.api, name);
  const code = await inviteCode(request, owner.api, g.id);
  for (const m of members) expect((await join(request, m.api, code)).ok()).toBeTruthy();
  return { id: g.id, name };
}

/** Открывает экран «Люди» группы (режим «Группа» включается самим адресом). */
export async function openGroup(p: Person, path = ""): Promise<void> {
  await p.page.goto(`/s/1/group${path}`);
}

/** «Мой доступ»: включает или выключает предпросмотр для группы переключателем на экране. */
export async function setPreviewInUi(p: Person, groupName: string, on: boolean): Promise<void> {
  await openGroup(p, "/access");
  const sw = p.page.getByRole("switch", { name: `Предпросмотр для ${groupName}` });
  await expect(sw).toBeVisible();
  if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", String(on));
}

export async function closeAll(...people: (Person | undefined)[]): Promise<void> {
  for (const p of people) await p?.ctx.close();
}
