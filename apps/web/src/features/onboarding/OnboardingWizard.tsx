import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { useSemester } from "../../lib/semesterContext";
import type { DegreeLevel, PeriodType, Semester } from "../../lib/types";
import {
  completeOnboarding,
  saveProfile,
  setUsername,
  uploadAvatar,
  UsernameTakenError,
} from "../../services/onboardingService";
import { isValidHandle } from "./handle";
import StepName from "./steps/StepName";
import StepUsername from "./steps/StepUsername";
import StepCityUniversity, {
  type CityUniValue,
} from "./steps/StepCityUniversity";
import StepDegreeLevel from "./steps/StepDegreeLevel";
import StepCourse from "./steps/StepCourse";
import StepPeriodType from "./steps/StepPeriodType";
import StepPeriods from "./steps/StepPeriods";
import StepAvatar from "./steps/StepAvatar";

const STEP_COPY = [
  {
    title: "Давай познакомимся",
    subtitle: "Как тебя зовут — так мы будем обращаться к тебе внутри Cohorta",
  },
  {
    title: "Придумай адрес профиля",
    subtitle: "Он станет твоей личной ссылкой вида username.cohorta.ru",
  },
  {
    title: "Найдём твоих одногруппников",
    subtitle: "Город и вуз помогут собрать твоё учебное сообщество",
  },
  {
    title: "На какой ты ступени",
    subtitle: "Бакалавриат, специалитет или магистратура — программы отличаются",
  },
  {
    title: "Курс имеет значение",
    subtitle: "Так мы поймём, сколько всего у тебя ещё впереди",
  },
  {
    title: "Как устроена твоя учёба",
    subtitle: "Семестры, триместры, четверти — выбери то, что ближе",
  },
  {
    title: "Разложим год по полочкам",
    subtitle: "Создадим периоды сразу, чтобы не возвращаться к этому позже",
  },
  { title: "Последний штрих", subtitle: "Фото необязательно, но с ним профиль живее" },
];

const LAST_STEP = STEP_COPY.length - 1;

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchPeriods } = useSemester();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [stepBusy, setStepBusy] = useState(false);
  const [error, setError] = useState("");

  // --- Форма (только React state, без localStorage) ---
  const [name, setNameValue] = useState("");
  const [username, setUsernameValue] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [cityUni, setCityUni] = useState<CityUniValue>({
    city: "",
    universityId: "",
    universityCustom: "",
    customMode: false,
  });
  const [degreeLevel, setDegreeLevel] = useState<DegreeLevel | "">("");
  const [degreeCustom, setDegreeCustom] = useState("");
  const [course, setCourse] = useState<number | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType | "">("");
  const [periodCustomWord, setPeriodCustomWord] = useState("");
  const [periods, setPeriods] = useState<Semester[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Онбординг уже пройден — сюда попадать незачем.
  if (user && user.onboarding_completed === true) {
    return <Navigate to="/" replace />;
  }

  const canNext = ((): boolean => {
    switch (step) {
      case 0:
        return name.trim().length > 0;
      case 1:
        return isValidHandle(username);
      case 2:
        return (
          cityUni.city.trim().length > 0 &&
          (Boolean(cityUni.universityId) ||
            (cityUni.customMode && cityUni.universityCustom.trim().length > 0))
        );
      case 3:
        return (
          degreeLevel !== "" &&
          (degreeLevel !== "other" || degreeCustom.trim().length > 0)
        );
      case 4:
        return course != null && course > 0;
      case 5:
        return (
          periodType !== "" &&
          (periodType !== "custom" || periodCustomWord.trim().length > 0)
        );
      case 6:
        return periods.length > 0;
      default:
        return true;
    }
  })();

  const finalize = async () => {
    setSubmitting(true);
    setError("");
    try {
      await saveProfile({
        name,
        city: cityUni.city,
        university: cityUni.universityId,
        universityCustom: cityUni.universityCustom,
        degreeLevel: degreeLevel as DegreeLevel,
        degreeLevelCustom: degreeCustom,
        course,
      });
      if (avatarFile) {
        try {
          await uploadAvatar(avatarFile);
        } catch (avaErr) {
          console.warn("Не удалось загрузить аватар:", avaErr);
        }
      }
      await completeOnboarding();
      // Провайдер семестров смонтирован с пустым списком (0 периодов на
      // входе) — обновляем его, иначе HomeRedirect снова уведёт в мастер.
      await refetchPeriods();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Ошибка завершения онбординга:", err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Не удалось сохранить профиль. Попробуйте ещё раз."
      );
      setSubmitting(false);
    }
  };

  const goNext = async () => {
    if (submitting || stepBusy) return;

    // Шаг 1 (адрес профиля) — пишем сразу, чтобы поймать коллизию логина.
    if (step === 1) {
      setSubmitting(true);
      setUsernameError("");
      try {
        await setUsername(username);
      } catch (err) {
        setSubmitting(false);
        if (err instanceof UsernameTakenError) {
          setUsernameError(err.message);
        } else if (err instanceof Error && err.message) {
          setUsernameError(err.message);
        } else {
          setUsernameError("Не удалось сохранить логин. Попробуйте ещё раз.");
        }
        return;
      }
      setSubmitting(false);
      setStep(2);
      return;
    }

    if (step === LAST_STEP) {
      await finalize();
      return;
    }

    setStep((s) => Math.min(LAST_STEP, s + 1));
  };

  const goBack = () => {
    if (submitting || stepBusy) return;
    setError("");
    setStep((s) => Math.max(0, s - 1));
  };

  const copy = STEP_COPY[step];

  return (
    <div className="onb-page">
      <div className="onb-shell">
        <aside className="onb-aside">
          <div className="onb-brand">
            <img src="/cohorta-black.svg" alt="Cohorta" className="onb-logo" />
          </div>
          <div className="onb-aside-copy">
            <h1 className="onb-aside-title">{copy.title}</h1>
            <p className="onb-aside-sub">{copy.subtitle}</p>
          </div>
          <div className="onb-dots">
            {STEP_COPY.map((_, i) => (
              <span
                key={i}
                className={
                  "onb-dot" +
                  (i === step ? " onb-dot--on" : i < step ? " onb-dot--done" : "")
                }
              />
            ))}
          </div>
        </aside>

        <div className="onb-main">
          <div className="onb-progress">Шаг {step + 1} из {STEP_COPY.length}</div>

          <div className="onb-body">
            {step === 0 && (
              <StepName value={name} onChange={setNameValue} />
            )}
            {step === 1 && (
              <StepUsername
                value={username}
                onChange={(v) => {
                  setUsernameValue(v);
                  setUsernameError("");
                }}
                error={usernameError}
              />
            )}
            {step === 2 && (
              <StepCityUniversity
                value={cityUni}
                onChange={(patch) => setCityUni((v) => ({ ...v, ...patch }))}
              />
            )}
            {step === 3 && (
              <StepDegreeLevel
                value={degreeLevel}
                custom={degreeCustom}
                onChange={(patch) => {
                  if (patch.degreeLevel !== undefined) {
                    setDegreeLevel(patch.degreeLevel);
                    setCourse(null); // диапазон курса зависит от ступени
                  }
                  if (patch.custom !== undefined) setDegreeCustom(patch.custom);
                }}
              />
            )}
            {step === 4 && (
              <StepCourse
                degreeLevel={degreeLevel}
                value={course}
                onChange={setCourse}
              />
            )}
            {step === 5 && (
              <StepPeriodType
                value={periodType}
                customWord={periodCustomWord}
                onChange={(patch) => {
                  if (patch.type !== undefined) setPeriodType(patch.type);
                  if (patch.customWord !== undefined)
                    setPeriodCustomWord(patch.customWord);
                }}
              />
            )}
            {step === 6 && periodType !== "" && (
              <StepPeriods
                periodType={periodType}
                customWord={periodCustomWord}
                periods={periods}
                setPeriods={setPeriods}
                onBusyChange={setStepBusy}
              />
            )}
            {step === 7 && (
              <StepAvatar file={avatarFile} onFileChange={setAvatarFile} />
            )}
          </div>

          {error && <p className="onb-error">{error}</p>}

          <div className="onb-nav">
            <button
              type="button"
              className="onb-linkbtn"
              onClick={goBack}
              disabled={step === 0 || submitting || stepBusy}
            >
              <ArrowLeft size={15} /> Назад
            </button>

            <div className="onb-nav-right">
              {step === LAST_STEP && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={finalize}
                  disabled={submitting}
                >
                  Пропустить
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary onb-next"
                onClick={goNext}
                disabled={!canNext || submitting || stepBusy}
              >
                {submitting && <Loader2 size={16} className="spin" />}
                {step === LAST_STEP ? "Готово" : "Далее"}
                {!submitting && <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
