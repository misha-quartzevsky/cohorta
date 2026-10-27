import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { pluralRu } from "../../lib/format";
import { useSemester } from "../../lib/semesterContext";
import { DEGREE_YEARS, PERIODS_PER_YEAR, dateRangeLabel, planPeriods } from "../../lib/studyPeriods";
import type { DegreeLevel, PeriodType, University } from "../../lib/types";
import { completeOnboarding, saveProfile, uploadAvatar } from "../../services/onboardingService";
import { createPeriod, deleteAllMyPeriods } from "../../services/semesterService";
import { fetchCities, fetchUniversitiesByCity } from "../../services/universityService";
import { Button, Icon, Input } from "../../ui";
import { getCourseOptions } from "./courseOptions";

/**
 * Онбординг в четыре шага (Screen-onboarding-1…4): имя и фото; город и
 * вуз; уровень и курс; периоды. Шага «код группы» нет, адреса профиля
 * (username.cohorta.ru) тоже нет — его меняют в настройках. После
 * последнего шага человек попадает на «Главную» (Соло).
 */

const STEPS = [
  {
    title: "Давай познакомимся",
    sub: "Имя нужно для обращения в cohorta, фото видят только одногруппники. Всё можно поменять в профиле.",
  },
  { title: "Где ты учишься", sub: "Город и вуз нужны, чтобы подсказать одногруппников и расписание." },
  { title: "Уровень и курс", sub: "По ним мы соберём периоды учёбы. Курс здесь значит год обучения." },
  { title: "Периоды учёбы", sub: "" },
];

const DEGREES: { id: DegreeLevel; label: string }[] = [
  { id: "bachelor", label: "Бакалавриат" },
  { id: "specialist", label: "Специалитет" },
  { id: "master", label: "Магистратура" },
  { id: "other", label: "Другое" },
];

const PERIOD_TYPES: { id: PeriodType; label: string }[] = [
  { id: "semester", label: "Семестры" },
  { id: "trimester", label: "Триместры" },
  { id: "quarter", label: "Четверти" },
  { id: "custom", label: "Своё название" },
];

const PER_YEAR_FORMS: Record<PeriodType, [string, string, string]> = {
  semester: ["семестр", "семестра", "семестров"],
  trimester: ["триместр", "триместра", "триместров"],
  quarter: ["четверть", "четверти", "четвертей"],
  module: ["модуль", "модуля", "модулей"],
  custom: ["период", "периода", "периодов"],
};

const YEARS_FORMS: [string, string, string] = ["год", "года", "лет"];

const DEGREE_NAME: Record<DegreeLevel, string> = {
  bachelor: "Бакалавриат",
  specialist: "Специалитет",
  master: "Магистратура",
  other: "Другое",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchPeriods } = useSemester();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [unis, setUnis] = useState<University[]>([]);
  const [uniId, setUniId] = useState("");
  const [uniCustom, setUniCustom] = useState("");
  const [custom, setCustom] = useState(false);
  const [directoryDown, setDirectoryDown] = useState(false);

  const [degree, setDegree] = useState<DegreeLevel | "">("");
  const [course, setCourse] = useState<number | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>("semester");
  const [customWord, setCustomWord] = useState("");

  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  useEffect(() => {
    let alive = true;
    fetchCities()
      .then((list) => {
        if (!alive) return;
        setCities(list);
        if (list.length === 0) {
          setDirectoryDown(true);
          setCustom(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        setDirectoryDown(true);
        setCustom(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const cityInDirectory = cities.includes(city.trim());
  useEffect(() => {
    if (!cityInDirectory) {
      setUnis([]);
      return;
    }
    let alive = true;
    fetchUniversitiesByCity(city.trim())
      .then((l) => alive && setUnis(l))
      .catch(() => alive && setUnis([]));
    return () => {
      alive = false;
    };
  }, [city, cityInDirectory]);

  const cityMatches = useMemo(() => {
    const q = city.trim().toLowerCase();
    return cities.filter((c) => !q || c.toLowerCase().includes(q)).slice(0, 6);
  }, [city, cities]);

  const plan = useMemo(
    () =>
      degree && course
        ? planPeriods({ degree, course, type: periodType, customWord })
        : [],
    [degree, course, periodType, customWord]
  );

  if (user && user.onboarding_completed === true) return <Navigate to="/" replace />;

  const canNext = ((): boolean => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1)
      return city.trim().length > 0 && (custom ? uniCustom.trim().length > 0 : Boolean(uniId));
    if (step === 2) return degree !== "" && course != null;
    return periodType !== "custom" || customWord.trim().length > 0;
  })();

  const finish = async () => {
    if (!degree || !course) return;
    setBusy(true);
    setError("");
    try {
      await saveProfile({
        name,
        city,
        university: custom ? "" : uniId,
        universityCustom: custom ? uniCustom : "",
        degreeLevel: degree,
        degreeLevelCustom: "",
        course,
      });
      if (avatar) {
        try {
          await uploadAvatar(avatar);
        } catch (e) {
          console.warn("Не удалось загрузить фото:", e);
        }
      }
      await deleteAllMyPeriods();
      for (const p of plan) await createPeriod(p);
      await completeOnboarding();
      await refetchPeriods();
      navigate("/", { replace: true });
    } catch (e) {
      console.error("Ошибка завершения онбординга:", e);
      setError(e instanceof Error && e.message ? e.message : "Не удалось сохранить. Попробуй ещё раз.");
      setBusy(false);
    }
  };

  const next = () => {
    if (!canNext || busy) return;
    if (step === STEPS.length - 1) void finish();
    else setStep(step + 1);
  };

  const years = degree ? DEGREE_YEARS[degree] : 0;
  const perYear = PERIODS_PER_YEAR[periodType];
  const yearsLabel = `${years} ${pluralRu(years, YEARS_FORMS)}`;
  const sub =
    step === 3
      ? `Мы подставили типичные: ${yearsLabel} по ${perYear} ${pluralRu(perYear, PER_YEAR_FORMS[periodType])}. Количество и даты можно поменять сейчас или потом в настройках.`
      : STEPS[step].sub;

  return (
    <main className="c-onb">
      <div className="c-onb-card">
        <aside className="c-onb-aside">
          <img className="c-onb-logo" src="/brand/cohorta-logo-inverse.svg" alt="cohorta" />
          <div className="c-onb-copy">
            <h1>{STEPS[step].title}</h1>
            <span>{sub}</span>
          </div>
          <div className="c-onb-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i <= step ? "on" : ""} />
            ))}
          </div>
        </aside>

        <section className="c-onb-main">
          <span className="c-onb-step">
            Шаг {step + 1} из {STEPS.length}
          </span>

          <div className="c-onb-body">
            {step === 0 && (
              <>
                <Input
                  label="Как тебя зовут"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например, Даша"
                  hint="Так к тебе будут обращаться"
                  autoComplete="given-name"
                  autoFocus
                />
                <div className="c-onb-photo">
                  <span className="c-onb-avatar" aria-hidden="true">
                    {preview ? <img src={preview} alt="" /> : <Icon name="user" size={28} />}
                  </span>
                  <div className="tx">
                    <span className="lbl">Фото профиля</span>
                    <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                      {preview ? "Заменить" : "Загрузить"}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="c-onb-combo">
                  <Input
                    label="Город"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setCityOpen(true);
                      setUniId("");
                      if (!directoryDown) setCustom(false);
                    }}
                    onFocus={() => setCityOpen(true)}
                    onBlur={() => setTimeout(() => setCityOpen(false), 150)}
                    placeholder="Начни вводить город"
                    autoComplete="off"
                  />
                  {cityOpen && cityMatches.length > 0 && (
                    <div className="c-onb-sugg">
                      {cityMatches.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCity(c);
                            setCityOpen(false);
                            setUniId("");
                            setCustom(false);
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {city.trim() && (
                  <div className="c-onb-uni">
                    <span className="lbl">Вуз</span>
                    {custom || !cityInDirectory ? (
                      <>
                        <Input
                          value={uniCustom}
                          onChange={(e) => setUniCustom(e.target.value)}
                          placeholder="Название вуза"
                          autoComplete="off"
                        />
                        {cityInDirectory && (
                          <button type="button" className="c-onb-link" onClick={() => setCustom(false)}>
                            Выбрать из списка
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="c-onb-unis" role="listbox" aria-label="Вуз">
                        <div className="scroll">
                        {unis.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            role="option"
                            aria-selected={uniId === u.id}
                            className={uniId === u.id ? "on" : ""}
                            onClick={() => setUniId(u.id)}
                          >
                            <span className="t">{u.name}</span>
                          </button>
                        ))}
                        </div>
                        <button type="button" className="manual" onClick={() => setCustom(true)}>
                          Не нашёл свой вуз: добавить вручную
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="c-onb-group">
                  <span className="lbl">Уровень</span>
                  <div className="c-onb-chips">
                    {DEGREES.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`c-onb-chip${degree === d.id ? " on" : ""}`}
                        aria-pressed={degree === d.id}
                        onClick={() => {
                          setDegree(d.id);
                          setCourse(null);
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="c-onb-group">
                  <span className="lbl">Курс</span>
                  <div className="c-onb-chips">
                    {(getCourseOptions(degree) ?? [1, 2, 3, 4, 5, 6]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`c-onb-round${course === n ? " on" : ""}`}
                        aria-pressed={course === n}
                        aria-label={`${n} курс`}
                        onClick={() => setCourse(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {degree && degree !== "other" && (
                    <span className="c-onb-hint">
                      {DEGREE_NAME[degree]}: {yearsLabel} обучения.
                    </span>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="c-onb-chips">
                  {PERIOD_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`c-onb-chip${periodType === t.id ? " on" : ""}`}
                      aria-pressed={periodType === t.id}
                      onClick={() => setPeriodType(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {periodType === "custom" && (
                  <Input
                    value={customWord}
                    onChange={(e) => setCustomWord(e.target.value)}
                    placeholder="Например: модуль"
                    aria-label="Своё название периода"
                    autoComplete="off"
                  />
                )}
                <div className="c-onb-total">
                  <span>Всего периодов</span>
                  <span className="n">{plan.length}</span>
                  <span className="m">
                    {yearsLabel} × {perYear}
                  </span>
                </div>
                <div className="c-onb-plist">
                  {plan.slice(0, 3).map((p) => (
                    <div key={p.order} className="row">
                      <span>
                        {p.label}
                        {p.is_current ? ", сейчас" : ""}
                      </span>
                      <span className="d">{dateRangeLabel(p.date_from, p.date_to)}</span>
                    </div>
                  ))}
                  {plan.length > 3 && (
                    <div className="more">
                      и ещё {plan.length - 3} {pluralRu(plan.length - 3, ["период", "периода", "периодов"])}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="c-auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="c-onb-nav">
            {step > 0 ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setError("");
                  setStep(step - 1);
                }}
                disabled={busy}
              >
                Назад
              </Button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={next} disabled={!canNext} loading={busy}>
              {step === STEPS.length - 1 ? "Готово" : "Далее"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
