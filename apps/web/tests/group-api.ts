/** Общие помощники API-тестов группы (без браузера, одноразовые тестовые аккаунты). */
import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";

export const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
export const PASSWORD = "Test-pass-12345";
export const stamp = Date.now();

export interface Session {
  id: string;
  token: string;
  email: string;
}

export const h = (s: Session) => ({ Authorization: s.token });

let counter = 0;
export const uid = () => `${stamp}-${(counter += 1)}`;

export async function register(request: APIRequestContext, tag: string): Promise<Session> {
  const email = `c-${tag}-${uid()}@example.test`;
  const created = await request.post(`${PB}/api/collections/users/records`, {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, name: `C ${tag}` },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const auth = await request.post(`${PB}/api/collections/users/auth-with-password`, {
    data: { identity: email, password: PASSWORD },
  });
  const body = await auth.json();
  return { id: body.record.id, token: body.token, email };
}

export async function superToken(request: APIRequestContext): Promise<string | null> {
  const su = process.env.SUPER_EMAIL;
  if (!su) return null;
  const r = await request.post(`${PB}/api/collections/_superusers/auth-with-password`, {
    data: { identity: su, password: process.env.SUPER_PASS ?? "" },
  });
  return r.ok() ? ((await r.json()).token as string) : null;
}

export async function createGroup(request: APIRequestContext, s: Session, name: string, open = true) {
  const r = await request.post(`${PB}/api/groups/create`, { headers: h(s), data: { name } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const group = (await r.json()) as { id: string };
  if (open) {
    const on = await request.post(`${PB}/api/groups/${group.id}/invite/enable`, { headers: h(s), data: { enabled: true } });
    expect(on.ok(), await on.text()).toBeTruthy();
  }
  return group;
}

export async function inviteCode(request: APIRequestContext, s: Session, groupId: string): Promise<string> {
  const r = await request.get(`${PB}/api/groups/${groupId}/invite`, { headers: h(s) });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).code as string;
}

export function join(request: APIRequestContext, s: Session, code: string): Promise<APIResponse> {
  return request.post(`${PB}/api/groups/join`, { headers: h(s), data: { code } });
}

/** Новая группа с владельцем и участниками, ссылка открыта. */
export async function groupWith(request: APIRequestContext, owner: Session, members: Session[], name = "G") {
  const g = await createGroup(request, owner, `${name}-${uid()}`);
  const code = await inviteCode(request, owner, g.id);
  for (const m of members) {
    const r = await join(request, m, code);
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  return { id: g.id, code };
}

export async function createLecture(request: APIRequestContext, s: Session, title: string, extra: Record<string, unknown> = {}) {
  const r = await request.post(`${PB}/api/collections/lectures/records`, {
    headers: h(s),
    data: { title, slug: `c-${uid()}`, content: "<p>секретный текст конспекта</p>", owner: s.id, ...extra },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

export async function canGet(request: APIRequestContext, s: Session, collection: string, id: string): Promise<boolean> {
  return (await request.get(`${PB}/api/collections/${collection}/records/${id}`, { headers: h(s) })).ok();
}

export async function list(request: APIRequestContext, s: Session, collection: string, filter = "") {
  const r = await request.get(`${PB}/api/collections/${collection}/records`, {
    headers: h(s),
    params: { perPage: "200", ...(filter ? { filter } : {}) },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return ((await r.json()).items ?? []) as Record<string, any>[];
}

export async function grantShare(
  request: APIRequestContext,
  owner: Session,
  lecture: string,
  grantee: Session,
  group: string,
  allowCopy = false
) {
  return request.post(`${PB}/api/collections/lecture_shares/records`, {
    headers: h(owner),
    data: { lecture, owner: owner.id, grantee: grantee.id, group, allow_copy: allowCopy },
  });
}

export async function setPreview(request: APIRequestContext, s: Session, groupId: string, on: boolean) {
  const rows = await list(request, s, "group_members", `group="${groupId}" && user="${s.id}"`);
  const r = await request.patch(`${PB}/api/collections/group_members/records/${rows[0].id}`, {
    headers: h(s),
    data: { preview_enabled: on },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
}

export async function createCourse(request: APIRequestContext, s: Session, name: string): Promise<string> {
  const r = await request.post(`${PB}/api/collections/courses/records`, {
    headers: h(s),
    data: { name, owner: s.id, slug: `c-${uid()}` },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

export async function createExam(request: APIRequestContext, s: Session, course: string, group = "") {
  const r = await request.post(`${PB}/api/collections/exams/records`, {
    headers: h(s),
    data: { course, owner: s.id, title: "Экзамен", ...(group ? { group, mode: "group" } : {}) },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

export async function createTicket(request: APIRequestContext, s: Session, exam: string, number: number, question: string, extra = {}) {
  const r = await request.post(`${PB}/api/collections/exam_tickets/records`, {
    headers: h(s),
    data: { exam, number, question, status: "empty", ...extra },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

export async function cleanup(request: APIRequestContext, sessions: (Session | undefined)[], groups: string[] = []) {
  const token = await superToken(request);
  for (const g of groups) {
    if (token) await request.delete(`${PB}/api/collections/groups/records/${g}`, { headers: { Authorization: token } });
  }
  for (const s of sessions) {
    if (!s) continue;
    await request.delete(`${PB}/api/collections/users/records/${s.id}`, { headers: token ? { Authorization: token } : h(s) });
  }
}
