/**
 * ============================================
 *  tests/group-screens.spec.ts — экраны группы (волна C) глазами людей
 * ============================================
 *
 * Правила доступа и сервер проверены API-спеками (group-access, group-lifecycle, group-exams …). Здесь проверяется то,
 * что видит и делает человек на экранах, нарисованных в макетах `docs/design/screens/Screen-group-*`:
 * создание, вступление по ссылке, предпросмотр, выдача и запрос доступа, коллективный экзамен.
 * Каждый человек: отдельный контекст браузера. Группа, предметы, лекции и билеты, не относящиеся к сценарию, создаются через API.
 * Код приглашения читается с экрана, а не из ответа сервера.
 */
import { test, expect } from "@playwright/test";
import { createExam, createGroup, h, list, PB, setPreview, uid } from "./group-api";
import { addLecture, closeAll, lectureInCourse, makeGroup, newPerson, openGroup, setPreviewInUi, type Person } from "./group-ui";

/** Код приглашения с экрана владельца: «Пригласить» → строка «Код …». */
async function readInviteCode(owner: Person): Promise<string> {
  await openGroup(owner);
  await owner.page.getByRole("button", { name: "Пригласить", exact: true }).click();
  const code = owner.page.locator(".c-gr-invite-pop:visible .code b");
  await expect(code).toHaveText(/\S{4,}/);
  return ((await code.textContent()) ?? "").trim();
}

test.describe("создание группы (Screen-group-create)", () => {
  test("форма «Создать группу»: код, карточка группы, владелец в «Людях», ссылка закрыта", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Создатель");
    try {
      // человек без группы: режим «Группа» ведёт на «Вступи в свою группу», оттуда — к созданию
      await a.page.locator('.c-shell-mode [role="radio"]', { hasText: "Группа" }).dispatchEvent("click");
      await expect(a.page.getByRole("heading", { name: "Вступи в свою группу" })).toBeVisible();
      await a.page.getByRole("button", { name: "Создать свою группу" }).click();

      await expect(a.page.getByRole("heading", { name: "Новая группа" })).toBeVisible();
      const submit = a.page.getByRole("button", { name: "Создать группу", exact: true });
      await expect(submit, "без названия создать нельзя").toBeDisabled();

      // код выдан сразу и виден на форме
      const codebox = a.page.locator(".c-gr-codebox");
      await expect(codebox).toHaveText(/\S{4,}/);

      const groupName = `МК ${uid()}`;
      await a.page.getByLabel("Название").fill(groupName);
      await expect(submit).toBeEnabled();
      await submit.click();

      // карточка группы: название, владелец один в «Людях», предпросмотр у новой группы закрыт
      await expect(a.page).toHaveURL(/\/s\/1\/group\?invite=1$/);
      await expect(a.page.getByRole("heading", { level: 1, name: groupName })).toBeVisible();
      await expect(a.page.locator(".c-gr-head .sub .d-only")).toContainText("1 студент · ты владелец");
      // «Люди» — одногруппники без самого человека: у новой группы список пуст, фильтр считает 0
      await expect(a.page.locator(".c-gr-person")).toHaveCount(0);
      await expect(a.page.getByRole("tab", { name: "Все 0" })).toBeVisible();
      await expect(a.page.getByText("Пока в группе только ты.")).toBeVisible();

      // после создания открыто окно «Пригласить»: ссылка у новой группы закрыта, владелец открывает её сам
      const pop = a.page.locator(".c-gr-invite-pop:visible");
      await expect(pop).toContainText(`Пригласить в ${groupName}`);
      await expect(pop).toContainText("Ссылка закрыта");
      await expect(pop.getByRole("button", { name: "Открыть ссылку" })).toBeVisible();
    } finally {
      await closeAll(a);
    }
  });

  /** Окно «Пригласить» мышью: открыть ссылку, скопировать, сбросить код, закрыть; `?invite=1` после закрытия очищается. */
  async function useInvitePopover(owner: Person, groupName: string) {
    const page = owner.page;
    const pop = page.locator(".c-gr-invite-pop");
    await expect(pop).toHaveCount(1);
    await expect(pop).toContainText(`Пригласить в ${groupName}`);
    await pop.getByRole("button", { name: "Открыть ссылку" }).click();
    const code = pop.locator(".code b");
    await expect(code).toHaveText(/\S{4,}/);
    const first = ((await code.textContent()) ?? "").trim();
    await expect(pop).toContainText(`cohorta.ru/join/${first}`);

    await pop.getByRole("button", { name: "Копировать" }).click();
    await expect(pop.getByRole("button", { name: "Скопировано" })).toBeVisible();

    await pop.getByRole("button", { name: "Сбросить код" }).click();
    await expect(code).not.toHaveText(first);
    const second = ((await code.textContent()) ?? "").trim();
    await expect(pop).toContainText(`cohorta.ru/join/${second}`);
    await expect(pop, "окно не закрылось от кликов внутри").toBeVisible();

    await pop.getByRole("button", { name: "Закрыть" }).click();
    await expect(pop).toHaveCount(0);
    await expect(page).toHaveURL(/\/s\/1\/group$/);
  }

  test("окно «Пригласить» на 1440: «Открыть ссылку», «Копировать», «Сбросить код» работают мышью, ?invite=1 очищается", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Создатель");
    try {
      await a.page.setViewportSize({ width: 1440, height: 900 });
      await a.page.goto("/s/1/group/new");
      await expect(a.page.locator(".c-gr-codebox")).toHaveText(/\S{4,}/);
      const groupName = `МК ${uid()}`;
      await a.page.getByLabel("Название").fill(groupName);
      await a.page.getByRole("button", { name: "Создать группу", exact: true }).click();
      await expect(a.page).toHaveURL(/\/s\/1\/group\?invite=1$/);
      await useInvitePopover(a, groupName);
    } finally {
      await closeAll(a);
    }
  });

  test("окно «Пригласить» на 390: те же действия, ?invite=1 очищается", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Создатель");
    try {
      const groupName = `МК ${uid()}`;
      await createGroup(request, a.api, groupName, false);
      await a.page.setViewportSize({ width: 390, height: 844 });
      await a.page.goto("/s/1/group?invite=1");
      await useInvitePopover(a, groupName);
    } finally {
      await closeAll(a);
    }
  });
});

test.describe("вступление по ссылке (Screen-group-join, Screen-group-join-confirm)", () => {
  test("/join/КОД: экран подтверждения, автовступления нет, вступление только по кнопке; неверный код — сообщение", async ({ browser, request }) => {
    const owner = await newPerson(browser, request, "Староста");
    const guest = await newPerson(browser, request, "Новенький");
    try {
      const groupName = `Группа ${uid()}`;
      const g = await createGroup(request, owner.api, groupName);
      const code = await readInviteCode(owner);

      // неверный код: форма «Код группы» ведёт на подтверждение и показывает сообщение, группы нет
      await openGroup(guest, "/join");
      await guest.page.getByLabel("Код группы").fill("zzzz-9999");
      await guest.page.getByRole("button", { name: "Найти группу" }).click();
      await expect(guest.page).toHaveURL(/\/join\/zzzz-9999$/);
      await expect(guest.page.getByText("Группа с таким кодом не найдена.")).toBeVisible();
      await expect(guest.page.getByRole("button", { name: /^Вступить в / })).toHaveCount(0);

      // верный код из ссылки: видно, куда идёт человек
      await guest.page.goto(`/join/${encodeURIComponent(code)}`);
      await expect(guest.page.getByRole("heading", { name: "Вступи в свою группу" })).toBeVisible();
      const joinBtn = guest.page.getByRole("button", { name: `Вступить в ${groupName}` });
      await expect(joinBtn).toBeVisible();
      await expect(guest.page.locator(".c-join-group")).toContainText(groupName);
      await expect(guest.page.locator(".c-join-group")).toContainText("1 студент");
      await expect(guest.page.locator(".c-join-group")).toContainText(`Создатель группы: ${owner.name}`);
      await expect(guest.page.locator(".c-join-note")).toContainText("твои лекции для группы закрыты");

      // автовступления нет: пока не нажата кнопка, в группе один человек
      const members = () => list(request, owner.api, "group_members", `group="${g.id}"`);
      expect((await members()).map((m) => m.user)).toEqual([owner.api.id]);

      // «Это не та группа» сбрасывает выбор
      await guest.page.getByRole("button", { name: "Это не та группа" }).click();
      await expect(guest.page).toHaveURL(/\/join$/);
      await expect(joinBtn).toHaveCount(0);

      await guest.page.goto(`/join/${encodeURIComponent(code)}`);
      await joinBtn.click();
      await expect(guest.page).toHaveURL(/\/s\/1\/group$/);
      await expect(guest.page.getByRole("heading", { level: 1, name: groupName })).toBeVisible();
      // у новичка в «Людях» староста, у старосты — новичок (самого себя в списке нет)
      const names = guest.page.locator(".c-gr-person .name");
      await expect(names).toHaveText([owner.name]);
      await openGroup(owner);
      await expect(owner.page.locator(".c-gr-person .name")).toHaveText([guest.name]);
      expect((await members()).map((m) => m.user).sort()).toEqual([owner.api.id, guest.api.id].sort());
    } finally {
      await closeAll(owner, guest);
    }
  });
});

const UNAVAILABLE = "Эта лекция недоступна: автор закрыл доступ или её удалил.";

test.describe("предпросмотр (Screen-group-home, Screen-group-member, Screen-group-thumbnails)", () => {
  test("закрытый предпросмотр: «Лекции скрыты»; открытый: только названия, текст чужой лекции не открывается", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Автор");
    const b = await newPerson(browser, request, "Читатель");
    try {
      const group = await makeGroup(request, a, [b], "Предпросмотр");
      const secret = `секрет-${uid()}`;
      const course = `Философия ${uid()}`;
      const title = `Античная философия ${uid()}`;
      const lecture = await lectureInCourse(request, a, course, title, `<p>${secret}</p>`);

      // предпросмотр выключен: у автора на карточке «Лекции скрыты», кнопки «Открыть» нет
      await openGroup(b);
      const card = b.page.locator(".c-gr-person", { hasText: a.name });
      await expect(card).toContainText("Предпросмотр закрыт");
      await expect(card).toContainText("Лекции скрыты");
      await expect(card.getByRole("button", { name: "Открыть" })).toHaveCount(0);
      await expect(b.page.getByRole("tab", { name: "С открытым предпросмотром 0" })).toBeVisible();

      // адрес страницы автора и адрес его лекции без доступа ничего не показывают
      await b.page.goto(`/s/1/group/people/${a.api.id}`);
      await expect(b.page.getByText("не открыл предпросмотр")).toBeVisible();
      await expect(b.page.getByText(title)).toHaveCount(0);
      await b.page.goto(`/s/1/group/lecture/${lecture.id}`);
      await expect(b.page.getByText(UNAVAILABLE)).toBeVisible();
      await expect(b.page.getByText(secret)).toHaveCount(0);

      // автор открывает предпросмотр переключателем на «Мой доступ»
      await setPreviewInUi(a, request, group, true);

      await openGroup(b);
      await expect(card).toContainText("Предпросмотр открыт");
      await expect(b.page.getByRole("tab", { name: "С открытым предпросмотром 1" })).toBeVisible();
      await card.getByRole("button", { name: "Открыть" }).click();
      await expect(b.page).toHaveURL(new RegExp(`/group/people/${a.api.id}$`));
      await expect(b.page.getByRole("heading", { level: 1, name: a.name })).toBeVisible();

      // предмет автора: список его лекций, видны названия, на закрытой лекции «Запросить доступ»
      const subject = b.page.locator(".c-gr-row", { hasText: course });
      await expect(subject).toContainText("1 лекция");
      await subject.click();
      const row = b.page.locator(".c-gr-row", { hasText: title });
      await expect(row).toBeVisible();
      await expect(row.getByRole("button", { name: "Запросить доступ" })).toBeVisible();
      await expect(b.page.getByText(secret)).toHaveCount(0);

      // прямой адрес лекции по-прежнему закрыт: предпросмотр — это только название
      await b.page.goto(`/s/1/group/lecture/${lecture.id}`);
      await expect(b.page.getByText(UNAVAILABLE)).toBeVisible();
      await expect(b.page.getByText(secret)).toHaveCount(0);
    } finally {
      await closeAll(a, b);
    }
  });
});

/** Меню лекции автора → «Доступ в группе» → окно «Доступ к лекции». */
async function openAccessDialog(owner: Person, href: string) {
  await owner.page.goto(href);
  await owner.page.locator(".c-shell-more-d").getByRole("button", { name: "Меню лекции" }).click();
  await owner.page.getByRole("menuitem", { name: "Доступ в группе" }).click();
  return owner.page.getByRole("dialog", { name: "Доступ к лекции" });
}

test.describe("выдача и отзыв доступа (Screen-group-access, Screen-shared-lecture)", () => {
  test("автор открывает лекцию участнику из меню лекции, тот читает; после «Убрать» доступа нет", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Автор");
    const b = await newPerson(browser, request, "Читатель");
    try {
      await makeGroup(request, a, [b], "Доступ");
      const secret = `секрет-${uid()}`;
      const title = `Экзистенциализм ${uid()}`;
      const lecture = await lectureInCourse(request, a, `Философия ${uid()}`, title, `<p>${secret}</p>`);
      const readerUrl = `/s/1/group/lecture/${lecture.id}`;

      // до выдачи доступа читатель лекцию не открывает
      await b.page.goto(readerUrl);
      await expect(b.page.getByText(UNAVAILABLE)).toBeVisible();

      // автор: «Добавить человека или подгруппу» → читатель
      const dialog = await openAccessDialog(a, lecture.href);
      await expect(dialog).toContainText(title);
      await expect(dialog).toContainText("Пока никто.");
      await dialog.getByRole("button", { name: "Добавить человека или подгруппу" }).click();
      await dialog.locator(".c-gr-addlist .it", { hasText: b.name }).click();
      const reader = dialog.locator(".c-gr-acc-list .c-gr-prow", { hasText: b.name });
      await expect(reader).toContainText("Читает");
      await expect(reader.getByRole("checkbox", { name: "Можно копировать" }), "копирование по умолчанию выключено").not.toBeChecked();

      // читатель видит лекцию целиком, без кнопки копирования
      await b.page.goto(readerUrl);
      await expect(b.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(b.page.getByText(secret)).toBeVisible();
      // выданный доступ загружен (в шапке «доступ открыт …»), и только теперь проверяем, что копирования нет
      await expect(b.page.locator(".c-lecture-meta")).toContainText("доступ открыт");
      await expect(b.page.getByRole("button", { name: "Добавить в мои конспекты" })).toHaveCount(0);

      // автор видит читателя и на экране «Мой доступ»
      await openGroup(a, "/access");
      await expect(a.page.locator(".c-gr-who .c-gr-prow", { hasText: b.name })).toContainText(`Читает «${title}»`);

      // отзыв: «Убрать» у читателя, лекция снова закрыта
      const dialog2 = await openAccessDialog(a, lecture.href);
      await dialog2.locator(".c-gr-acc-list .c-gr-prow", { hasText: b.name }).getByRole("button", { name: "Убрать" }).click();
      await expect(dialog2.locator(".c-gr-acc-list .c-gr-prow")).toHaveCount(0);
      await expect(dialog2).toContainText("Пока никто.");

      await b.page.goto(readerUrl);
      await expect(b.page.getByText(UNAVAILABLE)).toBeVisible();
      await expect(b.page.getByText(secret)).toHaveCount(0);
    } finally {
      await closeAll(a, b);
    }
  });
});

test.describe("запрос доступа (Screen-group-thumbnails, Screen-group-access-my)", () => {
  test("участник запрашивает доступ, владелец одобряет или отклоняет; статус виден обоим", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Автор");
    const b = await newPerson(browser, request, "Читатель");
    try {
      const group = await makeGroup(request, a, [b], "Запрос");
      await setPreview(request, a.api, group.id, true);
      const secret = `секрет-${uid()}`;
      const course = `История ${uid()}`;
      const granted = `Запрос принят ${uid()}`;
      const declined = `Запрос отклонён ${uid()}`;
      const first = await lectureInCourse(request, a, course, granted, `<p>${secret}</p>`);
      await addLecture(request, a, first.courseId, declined);

      const openSubject = async () => {
        await openGroup(b);
        await b.page.locator(".c-gr-person", { hasText: a.name }).getByRole("button", { name: "Открыть" }).click();
        await b.page.locator(".c-gr-row", { hasText: course }).click();
      };
      const rowOf = (title: string) => b.page.locator(".c-gr-row", { hasText: title });

      // читатель просит обе лекции: на строках «Запрос отправлен»
      await openSubject();
      await rowOf(granted).getByRole("button", { name: "Запросить доступ" }).click();
      await expect(rowOf(granted)).toContainText("Запрос отправлен");
      await rowOf(declined).getByRole("button", { name: "Запросить доступ" }).click();
      await expect(rowOf(declined)).toContainText("Запрос отправлен");

      // у автора два запроса с именем читателя
      await openGroup(a, "/access");
      const requests = a.page.locator(".c-gr-section", { has: a.page.getByRole("heading", { name: "Запросы" }) });
      await expect(requests.locator(".c-gr-new")).toContainText("2 новых");
      const askGranted = requests.locator(".c-gr-prow", { hasText: `Просит «${granted}»` });
      const askDeclined = requests.locator(".c-gr-prow", { hasText: `Просит «${declined}»` });
      await expect(askGranted).toContainText(b.name);
      await expect(askDeclined).toContainText(b.name);

      // одобрение: запрос уходит из списка, читатель появляется в «Кому открыты лекции»
      await askGranted.getByRole("button", { name: "Открыть" }).click();
      await expect(askGranted).toHaveCount(0);
      await expect(a.page.locator(".c-gr-who .c-gr-prow", { hasText: b.name })).toContainText(`Читает «${granted}»`);

      // отклонение: запрос тоже уходит, доступа нет
      await askDeclined.getByRole("button", { name: "Отклонить" }).click();
      await expect(askDeclined).toHaveCount(0);
      await expect(requests).toContainText("Запросов нет.");
      await expect(a.page.locator(".c-gr-who .c-gr-prow")).toHaveCount(1);

      // читатель: одобренная лекция читается, у отклонённой снова можно запросить доступ
      await openSubject();
      await expect(rowOf(granted).getByRole("button", { name: "Запросить доступ" })).toHaveCount(0);
      await expect(rowOf(granted)).not.toContainText("Запрос отправлен");
      await expect(rowOf(declined)).not.toContainText("Запрос отправлен");
      await expect(rowOf(declined).getByRole("button", { name: "Запросить доступ" })).toBeVisible();
      await rowOf(granted).click();
      await expect(b.page).toHaveURL(new RegExp(`/group/lecture/${first.id}$`));
      await expect(b.page.getByRole("heading", { level: 1, name: granted })).toBeVisible();
      await expect(b.page.getByText(secret)).toBeVisible();
    } finally {
      await closeAll(a, b);
    }
  });
});

test.describe("коллективный экзамен (Screen-group-exams, Screen-group-exam, Screen-ticket-group)", () => {
  test("экзамен группы, подгруппа, билет; «Занят» блокирует правку другому участнику и снимается", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Автор");
    const b = await newPerson(browser, request, "Напарник");
    try {
      await makeGroup(request, a, [b], "Экзамен");
      const course = `Гражданское право ${uid()}`;
      await lectureInCourse(request, a, course, `Лекция ${uid()}`);

      // создание экзамена группы из списка «Экзамены группы»
      await openGroup(a, "/exams");
      await expect(a.page.getByText("Экзаменов группы пока нет")).toBeVisible();
      await a.page.getByRole("button", { name: "Создать экзамен" }).first().click();
      const examDialog = a.page.getByRole("dialog", { name: "Новый экзамен группы" });
      await examDialog.getByLabel("Предмет").selectOption({ label: course });
      await examDialog.getByRole("button", { name: "Создать экзамен" }).click();
      await expect(a.page).toHaveURL(/\/group\/exams\/[^/]+$/);
      const examId = a.page.url().split("/").pop() as string;
      await expect(a.page.getByRole("heading", { level: 1 })).toContainText(`Экзамен · ${course}`);

      // подгруппа с напарником
      await expect(a.page.getByText("Ты пока не в подгруппе")).toBeVisible();
      await a.page.getByRole("button", { name: "Новая подгруппа" }).click();
      const subDialog = a.page.getByRole("dialog", { name: "Новая подгруппа" });
      const subName = `Вечерняя подготовка ${uid()}`;
      await subDialog.getByLabel("Название").fill(subName);
      await subDialog.getByRole("checkbox", { name: new RegExp(b.name) }).click();
      await subDialog.getByRole("button", { name: "Создать подгруппу" }).click();
      await expect(a.page.locator(".c-gx-pill.on")).toHaveText(subName);
      const people = a.page.locator(".c-gx-people .c-gx-person");
      await expect(people).toHaveCount(2);
      await expect(people.filter({ hasText: b.name })).toHaveCount(1);

      // билет подгруппы (данные, не предмет проверки)
      const sub = (await list(request, a.api, "exam_subgroups", `exam="${examId}"`))[0];
      const question = `Оферта и акцепт ${uid()}`;
      const t = await request.post(`${PB}/api/subgroups/${sub.id}/tickets`, { headers: h(a.api), data: { question, answer: "" } });
      expect(t.ok(), await t.text()).toBeTruthy();
      const created = await t.json();
      const ticketId = created.id as string;
      const ticketUrl = `/s/1/group/exams/${examId}/ticket/${created.number}`;

      // напарник видит экзамен в списке с подписью «Ты в …» и открывает билет
      await openGroup(b, "/exams");
      await expect(b.page.locator(".c-gx-row", { hasText: course })).toContainText(`Ты в «${subName}»`);
      await b.page.goto(ticketUrl);
      await expect(b.page.getByRole("heading", { level: 1 })).toContainText(question);
      await expect(b.page.locator(".c-gx-chip")).toHaveText(`Подгруппа «${subName}»`);
      const editB = b.page.getByRole("button", { name: "Редактировать" });
      const editA = a.page.getByRole("button", { name: "Редактировать" });
      await editB.click();
      await expect(b.page.locator(".c-gx-banner.edit")).toContainText("Правка идёт.");

      // автор: «Занят» — видно, кто правит, правка недоступна
      await a.page.goto(ticketUrl);
      await expect(a.page.locator(".c-gx-banner.warn")).toContainText(`${b.name} редактирует этот билет.`);
      await expect(editA).toBeDisabled();

      // напарник отпускает билет: у автора баннер уходит (билет перечитывается раз в 5 секунд) и правка включается
      await b.page.getByRole("button", { name: "Отмена" }).click();
      await expect(b.page.locator(".c-gx-banner.edit")).toHaveCount(0);
      // билет отпущен на сервере сразу, а не по истечении 30 секунд
      await expect.poll(async () => (await list(request, a.api, "exam_tickets", `id="${ticketId}"`))[0]?.locked_by ?? "").toBe("");
      await expect(a.page.locator(".c-gx-banner.warn")).toHaveCount(0, { timeout: 15_000 });
      await expect(editA).toBeEnabled();

      // и наоборот: теперь правит автор, напарник заблокирован
      await editA.click();
      await expect(a.page.locator(".c-gx-banner.edit")).toContainText("Правка идёт.");
      await expect(b.page.locator(".c-gx-banner.warn")).toContainText(`${a.name} редактирует этот билет.`, { timeout: 15_000 });
      await expect(editB).toBeDisabled();
    } finally {
      await closeAll(a, b);
    }
  });
});

test.describe("расхождения с макетом (класс C)", () => {
  // Screen-group-exam: над картой билетов блок «Готовность подгруппы» с процентом и подписью «3 из 10 билетов готовы».
  // В продукте процента нет: счёт «готово N» стоит только в заголовке карты билетов. Серьёзность низкая.
  test.fixme("[C] экран экзамена показывает «Готовность подгруппы» с процентом и подписью «N из M билетов готовы»", async ({ browser, request }) => {
    const a = await newPerson(browser, request, "Автор");
    try {
      const group = await makeGroup(request, a, [], "Готовность");
      const course = await lectureInCourse(request, a, `Философия ${uid()}`, `Лекция ${uid()}`);
      const exam = await createExam(request, a.api, course.courseId, group.id);
      const s = await request.post(`${PB}/api/exams/${exam}/subgroups`, { headers: h(a.api), data: { name: "Девчонки", members: [] } });
      expect(s.ok(), await s.text()).toBeTruthy();
      const sub = (await s.json()).id as string;
      const ids: string[] = [];
      for (const q of ["Первый билет", "Второй билет"]) {
        const t = await request.post(`${PB}/api/subgroups/${sub}/tickets`, { headers: h(a.api), data: { question: q, answer: "" } });
        expect(t.ok(), await t.text()).toBeTruthy();
        ids.push((await t.json()).id as string);
      }
      const ready = await request.patch(`${PB}/api/collections/exam_tickets/records/${ids[0]}`, { headers: h(a.api), data: { status: "ready" } });
      expect(ready.ok(), await ready.text()).toBeTruthy();

      await a.page.goto(`/s/1/group/exams/${exam}`);
      await expect(a.page.getByText("Готовность подгруппы")).toBeVisible();
      await expect(a.page.getByText("50%")).toBeVisible();
      await expect(a.page.getByText("1 из 2 билетов готовы")).toBeVisible();
    } finally {
      await closeAll(a);
    }
  });
});
