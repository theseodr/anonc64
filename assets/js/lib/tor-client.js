// tor-client.js – simple Tor-aware fetch helper
// This assumes a local HTTP proxy (e.g. Privoxy) listening on 127.0.0.1:8118
// that forwards traffic into the Tor network.

export let torEnabled = false;

/**
 * Enable or disable Tor mode.
 * @param {boolean} flag
 */
export function setTorEnabled(flag) {
  torEnabled = !!flag;
}

/**
 * Fetch wrapper that respects the Tor flag.
 * When Tor is enabled, it will try to send the request via a local proxy
 * at http://127.0.0.1:8118/?url=ENCODED_TARGET and fall back to direct
 * fetch if that fails.
 *
 * @param {RequestInfo|string} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function torFetch(input, init = {}) {
  const target = typeof input === 'string' ? input : input.url;

  if (!torEnabled) {
    console.log('[torFetch] Tor disabled, direct fetch:', target);
    return fetch(input, init);
  }

  const proxy = 'http://127.0.0.1:8118/';
  const proxied = proxy + '?url=' + encodeURIComponent(target);
  console.log('[torFetch] Tor enabled, using proxy for:', target);

  try {
    const resp = await fetch(proxied, init);
    return resp;
  } catch (e) {
    console.error('[torFetch] Proxy fetch failed – falling back to direct fetch:', e);
    return fetch(input, init);
  }
}
