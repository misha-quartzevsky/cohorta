import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AccountDeleteFlow from "../components/settings/AccountDeleteFlow";
import { useAuth } from "../hooks/useAuth";
import { nameInitials, pluralRu, userName } from "../lib/format";
import { useSemester } from "../lib/semesterContext";
import { dateRangeLabel } from "../lib/studyPeriods";
import { isValidHandle } from "../features/onboarding/handle";
import { exportAccountZip } from "../services/accountExport";
import { uploadAvatar, UsernameTakenError, setUsername } from "../services/onboardingService";
import {
  avatarUrl,
  fetchUniversityName,
  setCityUniversity,
  setDegreeAndCourse,
} from "../services/profileService";
import { fetchCities, fetchUniversitiesByCity } from "../services/universityService";
import { fetchTrash, TRASH_DAYS } from "../services/trashService";
import type { DegreeLevel, University } from "../lib/types";
import { Button, EditableRow, Input, PickField, RowSaveError } from "../ui";
import type { PickOption } from "../ui";
import { getCourseOptions } from "../features/onboarding/courseOptions";
import { DEGREE_LABEL } from "../lib/degree";
import SettingsLayout from "../components/settings/SettingsLayout";
import { SETTINGS_SECTION_IDS } from "../components/settings/sections";

const DEGREE_OPTIONS: PickOption[] = (Object.keys(DEGREE_LABEL) as DegreeLevel[]).map((v) => ({
  value: v,
  label: DEGREE_LABEL[v],
}));

const TYPE_PLURAL: Record<string, string> = {
  semester: "Семестры",
  trimester: "Триместры",
  quarter: "Четверти",
  module: "Модули",
  custom: "Периоды",
};

function CityUniEditor({
  draft,
  setDraft,
  error,
}: {
  draft: { city: string; uniId: string; uniCustom: string };
  setDraft: (d: { city: string; uniId: string; uniCustom: string }) => void;
  error: string;
}) {
  const [cities, setCities] = useState<string[]>([]);
  const [unis, setUnis] = useState<University[]>([]);

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);
  useEffect(() => {
    const c = draft.city.trim();
    if (!c || !cities.includes(c)) {
      setUnis([]);
      return;
    }
    fetchUniversitiesByCity(c)
      .then(setUnis)
      .catch(() => setUnis([]));
  }, [draft.city, cities]);

  const inList = unis.length > 0;
  const uniValue = draft.uniId || (draft.uniCustom || !inList ? "__custom" : "");
  return (
    <div className="c-erow-fields">
      <Input
        label="Город"
        value={draft.city}
        list="c-settings-cities"
        onChange={(e) => setDraft({ city: e.target.value, uniId: "", uniCustom: draft.uniCustom })}
        autoComplete="off"
      />
      <datalist id="c-settings-cities">
        {cities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {inList ? (
        <PickField
          label="Вуз"
          value={uniValue}
          sheetTitle="Вуз"
          options={[
            { value: "", label: "Выбери вуз" },
            ...unis.map((u) => ({ value: u.id, label: u.name })),
            { value: "__custom", label: "Не нашёл свой вуз" },
          ]}
          onChange={(v) =>
            setDraft(v === "__custom" ? { ...draft, uniId: "", uniCustom: draft.uniCustom || " " } : { ...draft, uniId: v, uniCustom: "" })
          }
        />
      ) : null}
      {(!inList || uniValue === "__custom") && (
        <Input
          label="Название вуза"
          value={draft.uniCustom.trim() === "" ? "" : draft.uniCustom}
          onChange={(e) => setDraft({ ...draft, uniId: "", uniCustom: e.target.value })}
          autoComplete="off"
          error={error || undefined}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { user } = useAuth();
  const { semesters, current } = useSemester();
  const [active, setActive] = useState("profile");
  const [uniName, setUniName] = useState("");
  const [trashCount, setTrashCount] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  // После клика по оглавлению прокрутка плавная: пока она идёт, подсветку не переписываем.
  const lockUntil = useRef(0);

  useEffect(() => {
    if (user?.university) void fetchUniversityName(user.university).then(setUniName);
    else setUniName("");
  }, [user?.university]);

  useEffect(() => {
    fetchTrash()
      .then((l) => setTrashCount(l.length))
      .catch(() => setTrashCount(null));
  }, []);

  // Оглавление: текущий раздел подсвечивается при прокрутке.
  useEffect(() => {
    const els = SETTINGS_SECTION_IDS.map((id) => refs.current[id]).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockUntil.current) return;
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [user]);

  const scrollTo = useCallback((id: string) => {
    setActive(id);
    lockUntil.current = Date.now() + 900;
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Пришли со страницы периодов по пункту оглавления («/settings#data»).
  useEffect(() => {
    const id = hash.replace("#", "");
    if (id && refs.current[id]) refs.current[id]!.scrollIntoView({ block: "start" });
  }, [hash, user]);

  if (!user) return null;
  const name = userName(user);
  const photo = avatarUrl(user);
  const handle = String(user.username ?? "");
  const degree = (user.degree_level ?? "") as DegreeLevel | "";
  const course = user.course ?? null;
  const periodWord = current?.type ? TYPE_PLURAL[current.type] : semesters[0]?.type ? TYPE_PLURAL[semesters[0].type!] : "Периоды";
  const currentLabel = current?.label ? String(current.label).toLowerCase() : "";

  const changePhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      await uploadAvatar(file);
    } catch (e) {
      console.warn("Не удалось загрузить фото:", e);
    } finally {
      setPhotoBusy(false);
    }
  };

  const section = (id: string) => (el: HTMLElement | null) => {
    refs.current[id] = el;
  };

  const download = async () => {
    setExporting("Собираем архив…");
    try {
      await exportAccountZip((done, total) => setExporting(`Собираем архив: ${done} из ${total}`));
      setExporting("Архив скачан");
    } catch (e) {
      console.error("Выгрузка:", e);
      setExporting("Не удалось собрать архив. Попробуй ещё раз.");
    }
  };

  return (
    <SettingsLayout active={active} onPick={scrollTo}>
      <section id="profile" ref={section("profile")} className="c-settings-card">
        <h2>Профиль</h2>
        <div className="c-settings-me">
          <span className="av">{photo ? <img src={photo} alt="" /> : nameInitials(name)}</span>
          <div className="tx">
            <span className="n">{name}</span>
            <span className="e">{user.email}</span>
          </div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={photoBusy}>
            Сменить фото
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void changePhoto(e.target.files?.[0] ?? null)} />
        </div>
        <EditableRow
          kind="text"
          label="Имя пользователя"
          value={handle ? `@${handle}` : "Не задано"}
          hint={`Твоя личная страница: ${handle || "имя"}.cohorta.ru`}
          initial={handle}
          placeholder="например, anastasia"
          validate={(v) => (isValidHandle(v) ? "" : "Только латинские буквы, цифры и дефис, от 3 до 40 знаков")}
          onSave={async (v) => {
            try {
              await setUsername(v);
            } catch (e) {
              if (e instanceof UsernameTakenError) throw new RowSaveError("Это имя уже занято. Попробуй другое.");
              throw e;
            }
          }}
        />
        <EditableRow
          kind="custom"
          label="Город и вуз"
          value={[user.city, uniName || user.university_custom].filter(Boolean).join(", ") || "Не указано"}
          initial={{ city: user.city ?? "", uniId: user.university ?? "", uniCustom: user.university_custom ?? "" }}
          render={(d, set, err) => <CityUniEditor draft={d} setDraft={set} error={err} />}
          validate={(d) => (d.city.trim() && (d.uniId || d.uniCustom.trim()) ? "" : "Укажи город и вуз")}
          onSave={async (d) => {
            await setCityUniversity({ city: d.city, universityId: d.uniId, universityCustom: d.uniCustom });
          }}
        />
      </section>

      <section id="study" ref={section("study")} className="c-settings-card">
        <h2>Учёба</h2>
        <EditableRow
          kind="custom"
          label="Уровень и курс"
          value={degree ? `${DEGREE_LABEL[degree]}${course ? `, ${course} курс` : ""}` : "Не указано"}
          initial={{ degree: (degree || "bachelor") as DegreeLevel, course: String(course ?? 1) }}
          render={(d, set) => (
            <div className="c-erow-fields">
              <PickField
                label="Уровень"
                value={d.degree}
                options={DEGREE_OPTIONS}
                sheetTitle="Уровень"
                onChange={(v) => set({ degree: v as DegreeLevel, course: "1" })}
              />
              <PickField
                label="Курс"
                value={d.course}
                options={(getCourseOptions(d.degree) ?? [1, 2, 3, 4, 5, 6]).map((n) => ({ value: String(n), label: `${n} курс` }))}
                sheetTitle="Курс"
                onChange={(v) => set({ ...d, course: v })}
              />
            </div>
          )}
          onSave={async (d) => {
            await setDegreeAndCourse(d.degree, Number(d.course));
          }}
        />
        <div className="c-erow">
          <div className="tx">
            <span className="lbl">Периоды учёбы</span>
            <span className="val">
              {semesters.length
                ? `${periodWord} · ${semesters.length} ${pluralRu(semesters.length, ["период", "периода", "периодов"])}${currentLabel ? `, сейчас ${currentLabel}` : ""}`
                : "Периодов пока нет"}
            </span>
            {current?.date_from && current?.date_to ? (
              <span className="hint">{dateRangeLabel(current.date_from, current.date_to, true)}</span>
            ) : null}
          </div>
          <Link className="act" to="/settings/periods">
            Настроить
          </Link>
        </div>
      </section>

      <section id="data" ref={section("data")} className="c-settings-card">
        <h2>Данные и безопасность</h2>
        <div className="c-erow">
          <div className="tx">
            <span className="lbl">Политика данных</span>
            <span className="val">Как мы храним и используем данные</span>
          </div>
          <Link className="act" to="/privacy">
            Читать
          </Link>
        </div>
        <div className="c-erow">
          <div className="tx">
            <span className="lbl">Корзина</span>
            <span className="val">
              {trashCount == null
                ? "Удалённые лекции и предметы"
                : `${trashCount} ${pluralRu(trashCount, ["элемент", "элемента", "элементов"])}, хранятся ${TRASH_DAYS} дней`}
            </span>
          </div>
          <Link className="act" to="/trash">
            Открыть
          </Link>
        </div>
        <div className="c-erow">
          <div className="tx">
            <span className="lbl">Экспорт</span>
            <span className="val">Скачать все конспекты и билеты архивом</span>
            {exporting ? (
              <span className="hint" role="status">
                {exporting}
              </span>
            ) : null}
          </div>
          <button type="button" className="act" onClick={() => void download()}>
            Скачать
          </button>
        </div>
      </section>

      <section className="c-settings-danger">
        <div className="tx">
          <h2>Удалить аккаунт и данные</h2>
          <p>Мы скроем аккаунт сразу и удалим данные через 14 дней. Перед этим можно скачать архив.</p>
        </div>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          Удалить аккаунт
        </Button>
      </section>

      <AccountDeleteFlow
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDone={() => navigate("/login?deletion=1", { replace: true })}
      />
    </SettingsLayout>
  );
}
