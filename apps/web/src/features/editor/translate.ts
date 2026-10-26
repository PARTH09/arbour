"use client";

export type TranslateLanguage = "en" | "hi" | "gu" | "es" | "fr" | "de";

export const TRANSLATE_LANGUAGES: { id: TranslateLanguage; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi (हिन्दी)" },
  { id: "gu", label: "Gujarati (ગુજરાતી)" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
];

type ChromeTranslator = {
  translate: (text: string) => Promise<string>;
};

type ChromeTranslatorCtor = {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<ChromeTranslator>;
};

/**
 * Translate topic labels. Prefers the browser Translator API when available,
 * otherwise uses the free MyMemory endpoint (best-effort, rate-limited).
 */
export async function translateTexts(
  texts: string[],
  target: TranslateLanguage,
  source: TranslateLanguage | "auto" = "auto",
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  if (!texts.length) return [];
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  const browser = await tryBrowserTranslator(source === "auto" ? "en" : source, target);
  let done = 0;

  for (const text of unique) {
    if (browser) {
      map.set(text, await browser.translate(text));
    } else {
      map.set(text, await translateWithMyMemory(text, source, target));
    }
    done += 1;
    onProgress?.(done, unique.length);
  }

  return texts.map((text) => {
    const trimmed = text.trim();
    if (!trimmed) return text;
    return map.get(trimmed) ?? text;
  });
}

async function tryBrowserTranslator(
  source: string,
  target: string,
): Promise<ChromeTranslator | null> {
  const Translator = (globalThis as { Translator?: ChromeTranslatorCtor }).Translator;
  if (!Translator) return null;
  try {
    const availability = await Translator.availability({ sourceLanguage: source, targetLanguage: target });
    if (availability === "unavailable") return null;
    return await Translator.create({ sourceLanguage: source, targetLanguage: target });
  } catch {
    return null;
  }
}

async function translateWithMyMemory(
  text: string,
  source: TranslateLanguage | "auto",
  target: TranslateLanguage,
): Promise<string> {
  const pair = `${source === "auto" ? "en" : source}|${target}`;
  const chunk = Array.from(text).slice(0, 450).join("");
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(pair)}`;
  const response = await fetch(url);
  if (!response.ok) return text;
  const payload = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  const translated = payload.responseData?.translatedText?.trim();
  if (!translated || payload.responseStatus !== 200) return text;
  if (/^\*\*\s*PLEASE SELECT/i.test(translated)) return text;
  return translated;
}
