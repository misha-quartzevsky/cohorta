import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

import type { University } from "../../../lib/types";
import {
  fetchCities,
  fetchUniversitiesByCity,
} from "../../../services/universityService";

export interface CityUniValue {
  city: string;
  /** id из `universities` ("" — не выбран / ручной ввод). */
  universityId: string;
  universityCustom: string;
  /** Пользователь жмёт «Не нашёл свой вуз» либо город введён вручную. */
  customMode: boolean;
}

interface Props {
  value: CityUniValue;
  onChange: (patch: Partial<CityUniValue>) => void;
}

/** Экран 2 — каскад «Город → Вуз» с эскейпом на ручной ввод. */
export default function StepCityUniversity({ value, onChange }: Props) {
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [cityQuery, setCityQuery] = useState(value.city);
  const [cityOpen, setCityOpen] = useState(false);
  const [unis, setUnis] = useState<University[]>([]);
  const [unisLoading, setUnisLoading] = useState(false);
  const comboRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCities()
      .then((list) => alive && setCities(list))
      .catch(() => alive && setCities([]))
      .finally(() => alive && setCitiesLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Список вузов выбранного города (только когда город из справочника).
  const cityInDirectory = cities.includes(value.city);
  useEffect(() => {
    if (!value.city || !cityInDirectory) {
      setUnis([]);
      return;
    }
    let alive = true;
    setUnisLoading(true);
    fetchUniversitiesByCity(value.city)
      .then((list) => alive && setUnis(list))
      .catch(() => alive && setUnis([]))
      .finally(() => alive && setUnisLoading(false));
    return () => {
      alive = false;
    };
  }, [value.city, cityInDirectory]);

  // Клик вне комбобокса — закрыть выпадашку.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 8);
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [cityQuery, cities]);

  const pickCity = (city: string) => {
    setCityQuery(city);
    setCityOpen(false);
    onChange({
      city,
      universityId: "",
      universityCustom: "",
      customMode: false,
    });
  };

  const useTypedCity = () => {
    const city = cityQuery.trim();
    if (!city) return;
    setCityOpen(false);
    // Города нет в справочнике — сразу ручной ввод вуза.
    onChange({ city, universityId: "", customMode: true });
  };

  return (
    <div className="onb-step onb-step--stack">
      <div className="onb-combo" ref={comboRef}>
        <label className="onb-label" htmlFor="onb-city">
          Город
        </label>
        <input
          id="onb-city"
          className="field"
          value={cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setCityOpen(true);
            if (value.city) {
              onChange({ city: "", universityId: "", customMode: false });
            }
          }}
          onFocus={() => setCityOpen(true)}
          placeholder="Начните вводить город"
          autoComplete="off"
        />
        {cityOpen && (matches.length > 0 || cityQuery.trim() || citiesLoading) && (
          <div className="onb-combo-list">
            {matches.map((c) => (
              <button
                key={c}
                type="button"
                className="onb-combo-item"
                onClick={() => pickCity(c)}
              >
                {c}
              </button>
            ))}
            {citiesLoading && (
              <span className="onb-combo-item onb-combo-item--muted">
                Загружаем список городов…
              </span>
            )}
            {!citiesLoading &&
              cityQuery.trim() &&
              !cities.includes(cityQuery.trim()) && (
                <button
                  type="button"
                  className="onb-combo-item onb-combo-item--muted"
                  onClick={useTypedCity}
                >
                  Использовать «{cityQuery.trim()}» — моего города нет в списке
                </button>
              )}
          </div>
        )}
      </div>

      {value.city && !value.customMode && (
        <div className="onb-step">
          <span className="onb-label">Вуз</span>
          {unisLoading ? (
            <p className="onb-hint">Загружаем список…</p>
          ) : (
            <div className="onb-options">
              {unis.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={
                    "onb-option" +
                    (value.universityId === u.id ? " onb-option--on" : "")
                  }
                  onClick={() => onChange({ universityId: u.id, universityCustom: "" })}
                >
                  <span>{u.name}</span>
                  {value.universityId === u.id && <Check size={16} />}
                </button>
              ))}
              <button
                type="button"
                className="onb-option onb-option--dashed"
                onClick={() => onChange({ customMode: true, universityId: "" })}
              >
                Не нашёл свой вуз
              </button>
            </div>
          )}
        </div>
      )}

      {value.city && value.customMode && (
        <div className="onb-step">
          <label className="onb-label" htmlFor="onb-uni-custom">
            Название вуза
          </label>
          <input
            id="onb-uni-custom"
            className="field"
            value={value.universityCustom}
            onChange={(e) => onChange({ universityCustom: e.target.value })}
            placeholder="Впишите название вручную"
            autoComplete="off"
          />
          {cityInDirectory && (
            <button
              type="button"
              className="onb-linkbtn"
              onClick={() =>
                onChange({ customMode: false, universityCustom: "" })
              }
            >
              ← Выбрать из списка
            </button>
          )}
        </div>
      )}
    </div>
  );
}
