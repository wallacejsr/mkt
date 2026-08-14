import dns from 'dns/promises';
import { URL } from 'url';

export interface FetchResult {
  url: string;
  ok: boolean;
  status?: number;
  html?: string;
  error?: string;
}

/**
 * Checks if an IP address belongs to private/internal IP ranges (SSRF Protection).
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 Private & Loopback & Link-Local & Cloud Metadata ranges
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true; // Loopback 127.0.0.0/8
    if (a === 10) return true; // Private 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // Private 172.16.0.0/12
    if (a === 192 && b === 168) return true; // Private 192.168.0.0/16
    if (a === 169 && b === 254) return true; // Link-Local / AWS/GCP Metadata 169.254.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
  }

  // IPv6 Loopback / Link-local
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1' || ip.toLowerCase().startsWith('fe80:')) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF rules before making network requests.
 */
export async function validateUrlForSSRF(targetUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Protocol '${parsed.protocol}' is not allowed. Only http and https are allowed.`);
  }

  const hostname = parsed.hostname;
  if (!hostname || hostname === 'localhost') {
    throw new Error('Access to localhost is blocked for security');
  }

  // Resolve hostname to IP to verify it is not private
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error(`Access to private IP range (${addr.address}) is blocked`);
      }
    }
  } catch (err: any) {
    if (err.message?.includes('blocked')) throw err;
    // If DNS resolution fails, let fetch handle or throw error
  }

  return parsed;
}

/**
 * Safely fetches public website HTML with SSRF validation, timeout, and response size limits.
 */
export async function fetchPageHtml(targetUrl: string, timeoutMs = 6000): Promise<FetchResult> {
  try {
    const validatedUrl = await validateUrlForSSRF(targetUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(validatedUrl.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'MarketingOSBot/1.0 (+https://marketingos.app/b2b-prospecting)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    // Re-validate target URL in case of HTTP redirects
    if (response.url && response.url !== validatedUrl.toString()) {
      await validateUrlForSSRF(response.url);
    }

    if (!response.ok) {
      return { url: targetUrl, ok: false, status: response.status, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('xhtml') && !contentType.includes('text/plain')) {
      return { url: targetUrl, ok: false, error: 'Content-Type is not HTML' };
    }

    // Limit download size to 2MB to prevent memory exhaustion
    const reader = response.body?.getReader();
    if (!reader) {
      const rawText = await response.text();
      return { url: targetUrl, ok: true, status: response.status, html: cleanHtmlContent(rawText) };
    }

    let receivedLength = 0;
    const maxBytes = 2 * 1024 * 1024; // 2MB max
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedLength += value.length;
        if (receivedLength > maxBytes) {
          reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }

    const combined = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      combined.set(chunk, position);
      position += chunk.length;
    }

    const decoder = new TextDecoder('utf-8');
    const htmlText = decoder.decode(combined);

    return {
      url: targetUrl,
      ok: true,
      status: response.status,
      html: cleanHtmlContent(htmlText),
    };
  } catch (error: any) {
    return {
      url: targetUrl,
      ok: false,
      error: error.name === 'AbortError' ? 'Request timeout' : error.message || 'Fetch failed',
    };
  }
}

/**
 * Cleans raw HTML by stripping out scripts, styles, iframes, and dangerous tags.
 */
function cleanHtmlContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}
