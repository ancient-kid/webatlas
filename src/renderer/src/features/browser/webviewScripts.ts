// Scripts run inside the embedded browser page with `webview.executeJavaScript`.
// Each one is a single expression (an IIFE) that returns plain JSON data and never
// throws: a failure returns an empty value so capture can still create a card.
// This module is pure (no Vite-only imports) so tests can load it directly;
// `readability.ts` binds the Readability source for the app.

export interface PageMeta {
  title: string
  ogTitle: string
  ogImage: string
  description: string
  siteName: string
  contentType: string
  favicon: string
}

/** Reads title, Open Graph fields, description, content type and an absolute favicon URL. */
export const META_SCRIPT = `(() => {
  const pick = (sel) => { const el = document.querySelector(sel); return el ? (el.getAttribute('content') || '').trim() : '' };
  const abs = (href) => { try { return href ? new URL(href, location.href).href : '' } catch (e) { return '' } };
  const icon = document.querySelector('link[rel~="icon"]');
  return {
    title: (document.title || '').trim(),
    ogTitle: pick('meta[property="og:title"]'),
    ogImage: abs(pick('meta[property="og:image"]')),
    description: pick('meta[name="description"]') || pick('meta[property="og:description"]'),
    siteName: pick('meta[property="og:site_name"]'),
    contentType: document.contentType || '',
    favicon: icon ? abs(icon.getAttribute('href')) : (location.protocol.startsWith('http') ? location.origin + '/favicon.ico' : '')
  };
})()`

/** Maximum characters of article text kept per page. */
export const MAX_TEXT_CHARS = 20000

/**
 * Builds the article-text script: Mozilla Readability runs on a clone of the page so
 * the live page is untouched. Returns '' when Readability fails (e.g. Trusted Types pages).
 */
export function readabilityScript(readabilitySource: string): string {
  return `(() => {
  try {
    ${readabilitySource}
    const doc = document.cloneNode(true);
    const parsed = new Readability(doc).parse();
    return parsed ? (parsed.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, ${MAX_TEXT_CHARS}) : '';
  } catch (e) {
    return '';
  }
})()`
}

/** Returns the user's current text selection in the page, trimmed. */
export const SELECTION_SCRIPT = `(() => {
  try { return String(window.getSelection() || '').trim() } catch (e) { return '' }
})()`
