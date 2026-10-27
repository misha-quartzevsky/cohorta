import { describe, expect, it } from "vitest";
import { loginErrorMessage, registerErrorMessage } from "./authErrors";

const pbError = (data: Record<string, { code?: string; message?: string }>, message = "Failed to create record.") =>
  Object.assign(new Error(message), { response: { data } });

describe("registerErrorMessage", () => {
  it("почта уже занята", () => {
    expect(registerErrorMessage(pbError({ email: { code: "validation_not_unique" } }))).toBe("Эта почта уже зарегистрирована.");
  });
  it("почта неверного формата (оба кода PocketBase)", () => {
    expect(registerErrorMessage(pbError({ email: { code: "validation_invalid_email" } }))).toBe("Введи корректную почту.");
    expect(registerErrorMessage(pbError({ email: { code: "validation_is_email" } }))).toBe("Введи корректную почту.");
  });
  it("любой другой код почты — общая подсказка про почту", () => {
    expect(registerErrorMessage(pbError({ email: { code: "validation_something" } }))).toBe(
      "Проверь почту: она уже занята или введена неверно."
    );
  });
  it("ошибка пароля", () => {
    expect(registerErrorMessage(pbError({ password: { code: "validation_length_out_of_range" } }))).toBe(
      "Пароль слишком короткий: нужно не меньше 8 символов."
    );
  });
  it("данные лежат в err.data (другая версия SDK)", () => {
    const e = Object.assign(new Error("x"), { data: { email: { code: "validation_not_unique" } } });
    expect(registerErrorMessage(e)).toBe("Эта почта уже зарегистрирована.");
  });
  it("сеть, таймаут и всё нераспознанное — общий фолбэк", () => {
    expect(registerErrorMessage(new TypeError("Failed to fetch"))).toBe("Не удалось зарегистрироваться. Попробуй ещё раз.");
    expect(registerErrorMessage("что-то")).toBe("Не удалось зарегистрироваться. Попробуй ещё раз.");
    expect(registerErrorMessage(null)).toBe("Не удалось зарегистрироваться. Попробуй ещё раз.");
  });
});

describe("loginErrorMessage", () => {
  it("всегда одно и то же сообщение, причину не раскрывает", () => {
    expect(loginErrorMessage(new Error("Failed to authenticate."))).toBe("Не удалось войти. Проверь почту и пароль.");
    expect(loginErrorMessage(undefined)).toBe("Не удалось войти. Проверь почту и пароль.");
  });
});
