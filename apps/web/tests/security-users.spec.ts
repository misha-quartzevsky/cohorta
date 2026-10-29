/**
 * ============================================
 *  tests/security-users.spec.ts — поля users, которые клиент не пишет (A-2, A-3, B-6)
 * ============================================
 *
 * Аудит 2026-10 (docs/review/security-2026-10.md). Без браузера, через API.
 * Миграция 1790013000: premium_until, referral_rewarded, invited_by, invited_group нельзя писать
 * ни при регистрации, ни при правке своей записи (их ведут хуки referral.pb.js через app.save).
 *  */
import { test, expect } from "@playwright/test";
import { PB, PASSWORD, cleanup, createGroup, createLecture, h, inviteCode, join, list, register, uid, type Session } from "./group-api";

const rejected = (s: number) => [400, 403, 404].includes(s);

test.describe("users: защищённые поля", () => {
  test("регистрация не принимает premium_until, referral_rewarded, invited_by, invited_group; onboarding_completed не затронут", async ({ request }) => {
    // настоящие id: иначе запрос отклонила бы проверка связи, а не правило
    const real = await register(request, "sec-reg-real");
    const realGroup = await createGroup(request, real, `Группа ${uid()}`);
    for (const extra of [
      { premium_until: "2099-12-31 00:00:00.000Z" },
      { referral_rewarded: true },
      { invited_by: real.id },
      { invited_group: realGroup.id },
    ]) {
      const r = await request.post(`${PB}/api/collections/users/records`, {
        data: { email: `sec-${uid()}@example.test`, password: PASSWORD, passwordConfirm: PASSWORD, ...extra },
      });
      expect(r.status(), `${JSON.stringify(extra)}`).toBe(400);
    }
    // обычная регистрация проходит
    const ok = await request.post(`${PB}/api/collections/users/records`, {
      data: { email: `sec-${uid()}@example.test`, password: PASSWORD, passwordConfirm: PASSWORD, name: "Обычный" },
    });
    expect(ok.status()).toBe(200);
  });

  test("PATCH своей записи: премиум и реферальные поля отклоняются, профиль и onboarding_completed пишутся", async ({ request }) => {
    const a = await register(request, "sec-patch");
    const owner = await register(request, "sec-patch-owner");
    const realGroup2 = await createGroup(request, owner, `Группа ${uid()}`);
    const url = `${PB}/api/collections/users/records/${a.id}`;
    for (const patch of [
      { premium_until: "2099-12-31 00:00:00.000Z" },
      { referral_rewarded: true },
      { invited_by: owner.id },
      { invited_group: realGroup2.id },
    ]) {
      const r = await request.patch(url, { headers: h(a), data: patch });
      expect(r.status(), `${JSON.stringify(patch)}`).toBe(404); // правило update не выполнено: PocketBase отвечает 404
    }
    const me = await (await request.get(url, { headers: h(a) })).json();
    expect(me.premium_until || "").toBe("");
    expect(me.invited_by || "").toBe("");

    const prof = await request.patch(url, { headers: h(a), data: { name: "Новое имя", city: "Москва" } });
    expect(prof.status()).toBe(200);
    const done = await request.patch(url, { headers: h(a), data: { onboarding_completed: true } });
    expect(done.status()).toBe(200);
    await cleanup(request, [a, owner]);
  });

  test("ферма награды: «лекция → удалить → referral_rewarded=false» не продлевает премиум", async ({ request }) => {
    const inviter = await register(request, "sec-farm-inviter");
    const farmer = await register(request, "sec-farm");
    const g = await createGroup(request, inviter, `Ферма ${uid()}`);
    const code = await inviteCode(request, inviter, g.id);
    expect((await join(request, farmer, code)).ok()).toBeTruthy();

    const me = async (s: Session) => (await (await request.get(`${PB}/api/collections/users/records/${s.id}`, { headers: h(s) })).json()) as Record<string, any>;
    expect((await me(farmer)).invited_by, "хук проставил реферера").toBe(inviter.id);

    // первая лекция: законная награда один раз
    const first = await createLecture(request, farmer, "Первая");
    const afterFirst = await me(farmer);
    expect(afterFirst.referral_rewarded).toBe(true);
    const until = afterFirst.premium_until;
    expect(until).toBeTruthy();

    // ферма: сбросить флаг не удаётся
    for (let round = 0; round < 2; round += 1) {
      await request.delete(`${PB}/api/collections/lectures/records/${first}`, { headers: h(farmer) });
      const reset = await request.patch(`${PB}/api/collections/users/records/${farmer.id}`, { headers: h(farmer), data: { referral_rewarded: false } });
      expect(rejected(reset.status())).toBeTruthy();
      await createLecture(request, farmer, `Раунд ${round}`);
    }
    expect((await me(farmer)).premium_until, "премиум не вырос").toBe(until);
    expect(await list(request, farmer, "premium_grants")).toHaveLength(1);
    await cleanup(request, [inviter, farmer], [g.id]);
  });
});
