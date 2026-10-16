/**
 * ============================================
 *  functions/api/quiz/generate.ts — Cloudflare Pages Function
 * ============================================
 *
 * POST /api/quiz/generate — генерирует вопросы квиза по тексту лекции
 * через Gemini. Ничего не пишет в PocketBase — сохранение делает клиент
 * (spec раздел 6.1). Текст приходит от клиента уже извлечённым из HTML
 * (без тегов), сервер его не парсит.
 *
 * Переменные окружения (Cloudflare Pages → Settings → Variables and Secrets,
 * либо `.dev.vars` локально для `wrangler pages dev`):
 *   GEMINI_API_KEY   (secret, обязательно)
 *   GEMINI_MODEL     (по умолчанию gemini-2.5-flash)
 *   PB_URL           (адрес PocketBase, с https://)
 *   QUIZ_DAILY_LIMIT (по умолчанию 20)
 */

interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  PB_URL: string;
  QUIZ_DAILY_LIMIT?: string;
}

interface GenerateRequestBody {
  lectureId?: string;
  title?: string;
  text?: string;
  size?: number;
}

type QuestionType = "mcq" | "recall";

interface RawQuestion {
  type?: string;
  topic?: string;
  prompt?: string;
  options?: string[];
  correct_index?: number;
  answer?: string;
  explanation?: string;
  quote?: string;
}

interface ValidQuestion {
  type: QuestionType;
  topic: string;
  prompt: string;
  options?: string[];
  correct_index?: number;
  answer?: string;
  explanation: string;
  quote: string | null;
}

const ALLOWED_SIZES = [5, 8, 12];
const MIN_TEXT_LENGTH = 400;
const MAX_TEXT_LENGTH = 24000;
const GEMINI_TIMEOUT_MS = 25000;
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_DAILY_LIMIT = 20;

const SYSTEM_INSTRUCTION_TEMPLATE = (size: number) =>
  `Ты помогаешь студенту проверить себя по его собственному конспекту. Составь ровно ${size} вопросов строго по тексту ниже. Не используй факты, которых нет в тексте. Не придумывай даты, номера статей и имена, если их нет в тексте. Примерно 70% вопросов типа \`mcq\` (4 варианта, один верный, неверные варианты правдоподобные и взяты из соседних понятий текста), остальные типа \`recall\` (вопрос «объясни своими словами», в \`answer\` краткий эталонный ответ из текста). Каждому вопросу дай \`topic\`: короткое название темы (до 5 слов), по возможности как заголовок раздела в тексте; одинаковые темы пиши одинаково. В \`explanation\` одним-двумя предложениями объясни верный ответ по тексту. В \`quote\` поставь дословную цитату из текста (до 200 символов), на которой основан вопрос. Вопросы не должны повторяться и должны покрывать разные части текста. Пиши по-русски.`;

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["mcq", "recall"] },
    topic: { type: "string" },
    prompt: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correct_index: { type: "integer" },
    answer: { type: "string" },
    explanation: { type: "string" },
    quote: { type: "string" },
  },
  required: ["type", "topic", "prompt", "explanation"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: { type: "array", items: QUESTION_SCHEMA },
  },
  required: ["questions"],
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(error: string, status: number): Response {
  return json({ error }, status);
}

/** Обрезать текст по границе абзаца, не разрывая слово/предложение. */
function truncateAtParagraph(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastBreak = slice.lastIndexOf("\n\n");
  return lastBreak > max * 0.5 ? slice.slice(0, lastBreak) : slice;
}

/** Нормализация для проверки quote как подстроки текста лекции. */
function normalizeForQuoteCheck(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"""]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function pbAuthRefresh(
  pbUrl: string,
  token: string
): Promise<{ id: string } | null> {
  try {
    const res = await fetch(
      `${pbUrl}/api/collections/users/auth-refresh`,
      {
        method: "POST",
        headers: { Authorization: token },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { record?: { id?: string } };
    if (!data.record?.id) return null;
    return { id: data.record.id };
  } catch {
    return null;
  }
}

async function pbLectureBelongsToUser(
  pbUrl: string,
  token: string,
  lectureId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${pbUrl}/api/collections/lectures/records/${encodeURIComponent(lectureId)}`,
      { headers: { Authorization: token } }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function pbQuizzesToday(
  pbUrl: string,
  token: string
): Promise<number> {
  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const filter = encodeURIComponent(`created>="${y}-${m}-${d} 00:00:00"`);
  const res = await fetch(
    `${pbUrl}/api/collections/quizzes/records?filter=${filter}&perPage=1`,
    { headers: { Authorization: token } }
  );
  if (!res.ok) return 0;
  const data = (await res.json()) as { totalItems?: number };
  return data.totalItems ?? 0;
}

/** Один вызов Gemini generateContent с таймаутом. Бросает при сетевой ошибке/таймауте. */
async function callGemini(
  apiKey: string,
  model: string,
  title: string,
  text: string,
  size: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION_TEMPLATE(size) }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `Лекция: ${title}\n\n${text}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.4,
          },
        }),
      }
    );
    if (!res.ok) {
      // TEMP-DEBUG: детали ошибки Gemini в тексте исключения, чтобы увидеть
      // причину 502 в проде без доступа к логам Cloudflare. Убрать после
      // диагностики — see docs/decisions.md.
      const bodyText = await res.text().catch(() => "");
      throw new Error(`gemini_http_${res.status}: ${bodyText.slice(0, 500)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Достать JSON-текст из ответа Gemini (candidates[0].content.parts[0].text). */
function extractGeminiJsonText(geminiResponse: unknown): string | null {
  const r = geminiResponse as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = r.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : null;
}

/**
 * Ручная валидация ответа (без zod — зависимости в проекте нет).
 * Возвращает валидированные вопросы или null, если схема не подошла.
 */
function validateQuestions(
  raw: unknown,
  size: number,
  lectureTextNormalized: string
): ValidQuestion[] | null {
  if (typeof raw !== "object" || raw === null) return null;
  const questions = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) return null;
  if (questions.length < size - 2) return null;

  const result: ValidQuestion[] = [];
  for (const q of questions as RawQuestion[]) {
    if (typeof q !== "object" || q === null) return null;
    const { type, topic, prompt, explanation } = q;
    if (type !== "mcq" && type !== "recall") return null;
    if (!topic || typeof topic !== "string") return null;
    if (!prompt || typeof prompt !== "string") return null;
    if (!explanation || typeof explanation !== "string") return null;

    if (type === "mcq") {
      const options = q.options;
      if (!Array.isArray(options) || options.length !== 4) return null;
      const unique = new Set(options.map((o) => String(o).trim().toLowerCase()));
      if (unique.size !== 4) return null;
      if (
        typeof q.correct_index !== "number" ||
        !Number.isInteger(q.correct_index) ||
        q.correct_index < 0 ||
        q.correct_index > 3
      ) {
        return null;
      }
    } else {
      if (!q.answer || typeof q.answer !== "string") return null;
    }

    // quote: невалидные не выбрасывают вопрос, просто становятся null.
    let quote: string | null = null;
    if (typeof q.quote === "string" && q.quote.trim()) {
      const normalizedQuote = normalizeForQuoteCheck(q.quote);
      if (normalizedQuote && lectureTextNormalized.includes(normalizedQuote)) {
        quote = q.quote;
      }
    }

    result.push({
      type,
      topic,
      prompt,
      explanation,
      options: type === "mcq" ? (q.options as string[]) : undefined,
      correct_index: type === "mcq" ? q.correct_index : undefined,
      answer: type === "recall" ? q.answer : undefined,
      quote,
    });
  }

  return result;
}

async function generateValidated(
  apiKey: string,
  model: string,
  title: string,
  text: string,
  size: number,
  lectureTextNormalized: string,
  debugOut?: { message?: string }
): Promise<ValidQuestion[] | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const geminiResponse = await callGemini(apiKey, model, title, text, size);
      const jsonText = extractGeminiJsonText(geminiResponse);
      if (!jsonText) {
        if (debugOut) debugOut.message = `no_text_in_response: ${JSON.stringify(geminiResponse).slice(0, 500)}`;
        continue;
      }
      const parsed = JSON.parse(jsonText) as unknown;
      const validated = validateQuestions(parsed, size, lectureTextNormalized);
      if (validated) return validated;
      if (debugOut) debugOut.message = `schema_invalid: ${jsonText.slice(0, 500)}`;
    } catch (e) {
      // TEMP-DEBUG: see note above callGemini.
      if (debugOut) debugOut.message = e instanceof Error ? e.message : String(e);
    }
  }
  return null;
}

// TEMP-DEBUG: список моделей от Google, чтобы выбрать подходящую по лимитам.
// Убрать целиком после диагностики (см. docs/decisions.md).
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models",
    { headers: { "x-goog-api-key": context.env.GEMINI_API_KEY } }
  );
  const data = await res.text();
  return new Response(data, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", 401);
  }

  const pbUrl = env.PB_URL;
  const user = await pbAuthRefresh(pbUrl, authHeader);
  if (!user) {
    return errorResponse("unauthorized", 401);
  }

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return errorResponse("invalid_body", 400);
  }

  const { lectureId, title, text, size } = body;
  if (!lectureId || !title || !text || !size) {
    return errorResponse("invalid_body", 400);
  }

  const belongsToUser = await pbLectureBelongsToUser(pbUrl, authHeader, lectureId);
  if (!belongsToUser) {
    return errorResponse("not_found", 404);
  }

  if (!ALLOWED_SIZES.includes(size)) {
    return errorResponse("invalid_size", 422);
  }
  if (text.length < MIN_TEXT_LENGTH) {
    return errorResponse("not_enough_text", 422);
  }
  const truncatedText = truncateAtParagraph(text, MAX_TEXT_LENGTH);

  const dailyLimit = env.QUIZ_DAILY_LIMIT
    ? parseInt(env.QUIZ_DAILY_LIMIT, 10)
    : DEFAULT_DAILY_LIMIT;
  const todayCount = await pbQuizzesToday(pbUrl, authHeader);
  if (todayCount >= dailyLimit) {
    return errorResponse("daily_limit", 429);
  }

  // TEMP-DEBUG: игнорируем env.GEMINI_MODEL для проверки новой модели —
  // в дашборде пока старое значение. Вернуть `env.GEMINI_MODEL || DEFAULT_MODEL`.
  const model = DEFAULT_MODEL;
  const lectureTextNormalized = normalizeForQuoteCheck(truncatedText);

  const debugOut: { message?: string } = {};
  const questions = await generateValidated(
    env.GEMINI_API_KEY,
    model,
    title,
    truncatedText,
    size,
    lectureTextNormalized,
    debugOut
  );

  if (!questions) {
    // TEMP-DEBUG: модель и причину отдаём в ответе, чтобы продиагностировать
    // без доступа к логам Cloudflare. Убрать debug-поле после диагностики.
    return json({ error: "generation_failed", debug: debugOut.message, model }, 502);
  }

  return json({ model, questions }, 200);
};
