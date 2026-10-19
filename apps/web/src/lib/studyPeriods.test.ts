import { describe, expect, it } from "vitest";

import { dateRangeLabel, parseRuDate, periodTitle, planPeriods, ruDate } from "./studyPeriods";

const OCT_2026 = new Date(2026, 9, 19);

describe("planPeriods", () => {
  it("специалитет, 2 курс, осень 2026: 12 семестров, текущий — третий", () => {
    const p = planPeriods({ degree: "specialist", course: 2, type: "semester", today: OCT_2026 });
    expect(p).toHaveLength(12);
    expect(p[0]).toMatchObject({ label: "Семестр 1", date_from: "2025-09-01", date_to: "2026-01-31" });
    expect(p[1]).toMatchObject({ label: "Семестр 2", date_from: "2026-02-01", date_to: "2026-06-30" });
    expect(p[2]).toMatchObject({ label: "Семестр 3", date_from: "2026-09-01", is_current: true });
    expect(p.filter((x) => x.is_current)).toHaveLength(1);
  });

  it("бакалавриат и магистратура: 4 и 2 года по 2 семестра", () => {
    expect(planPeriods({ degree: "bachelor", course: 1, type: "semester", today: OCT_2026 })).toHaveLength(8);
    expect(planPeriods({ degree: "master", course: 1, type: "semester", today: OCT_2026 })).toHaveLength(4);
  });

  it("триместры и четверти: больше периодов в году, дат нет, текущий — первый периода курса", () => {
    const t = planPeriods({ degree: "bachelor", course: 2, type: "trimester", today: OCT_2026 });
    expect(t).toHaveLength(12);
    expect(t[0].date_from).toBeUndefined();
    expect(t.findIndex((x) => x.is_current)).toBe(3);
    expect(planPeriods({ degree: "master", course: 1, type: "quarter", today: OCT_2026 })).toHaveLength(8);
  });

  it("весной текущий — второй семестр года; летом — ближайший следующий", () => {
    const spring = planPeriods({ degree: "specialist", course: 2, type: "semester", today: new Date(2027, 2, 10) });
    expect(spring.find((x) => x.is_current)?.order).toBe(4);
    const summer = planPeriods({ degree: "specialist", course: 2, type: "semester", today: new Date(2027, 6, 15) });
    expect(summer.find((x) => x.is_current)?.order).toBe(5);
  });

  it("курс больше срока обучения прижимается к последнему году", () => {
    const p = planPeriods({ degree: "master", course: 6, type: "semester", today: OCT_2026 });
    expect(p).toHaveLength(4);
    expect(p.filter((x) => x.is_current)).toHaveLength(1);
  });
});

describe("подписи и даты", () => {
  it("название периода", () => {
    expect(periodTitle(3, "semester")).toBe("Семестр 3");
    expect(periodTitle(1, "custom", "модуль")).toBe("Модуль 1");
    expect(periodTitle(1, "custom", "")).toBe("Период 1");
  });
  it("диапазон дат как в макете", () => {
    expect(dateRangeLabel("2025-09-01", "2026-01-31")).toBe("1 сен – 31 янв");
    expect(dateRangeLabel("2025-09-01", "2026-01-31", true)).toBe("1 сен 2025 – 31 янв 2026");
    expect(dateRangeLabel(undefined, undefined)).toBe("");
  });
  it("дата туда и обратно", () => {
    expect(ruDate("2025-09-01 00:00:00.000Z")).toBe("01.09.2025");
    expect(parseRuDate("01.09.2025")).toBe("2025-09-01");
    expect(parseRuDate("31.02.2025")).toBe("");
    expect(parseRuDate("abc")).toBe("");
  });
});
