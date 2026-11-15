/**
 * JavaScript injected into the main frame of every page in the dApp browser, before the page's
 * own scripts run. It exposes HENSENG as an EIP-1193 provider (`window.ethereum`) and announces it
 * through EIP-6963 so wallet pickers list "HENSENG" by name.
 *
 * Messages to the app carry a per-page secret held in a closure. Embedded iframes (ads, widgets)
 * are cross-origin and can't read it, so they can't make requests in the parent site's name.
 */
export const HENSENG_ICON =
  "data:image/svg+xml;base64," +
  // simple brand mark: purple→blue→orange ring on dark
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjODk1N0ZGIi8+PHN0b3Agb2Zmc2V0PSIuNiIgc3RvcC1jb2xvcj0iIzM5N0JGRiIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0ZGOEEzRCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjE2IiBmaWxsPSIjMTAxMDE0Ii8+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMTgiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNnKSIgc3Ryb2tlLXdpZHRoPSI4Ii8+PC9zdmc+";

export function buildProviderScript(opts: { chainId: number; secret: string; uuid: string; /** false only in the web test harness, where the page itself sits in an iframe */ mainFrameOnly?: boolean }) {
  const cfg = JSON.stringify({ chainId: `0x${opts.chainId.toString(16)}`, secret: opts.secret, uuid: opts.uuid, icon: HENSENG_ICON });
  return `(function () {
  if ((${opts.mainFrameOnly !== false} && window.top !== window) || window.__hensengInstalled) return;
  window.__hensengInstalled = true;
  var cfg = ${cfg};
  var secret = cfg.secret; var nextId = 1; var pending = {}; var listeners = {};
  function post(msg) { msg.s = secret; window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function emit(ev, data) { (listeners[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
  var provider = {
    isHenseng: true,
    chainId: cfg.chainId,
    selectedAddress: null,
    isConnected: function () { return true; },
    request: function (args) {
      if (!args || typeof args.method !== "string") return Promise.reject(Object.assign(new Error("Invalid request"), { code: -32600 }));
      var id = nextId++;
      return new Promise(function (resolve, reject) {
        pending[id] = { resolve: resolve, reject: reject };
        post({ t: "req", id: id, method: args.method, params: args.params });
      });
    },
    on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return provider; },
    addListener: function (ev, fn) { return provider.on(ev, fn); },
    once: function (ev, fn) { function w(d) { provider.removeListener(ev, w); fn(d); } return provider.on(ev, w); },
    removeListener: function (ev, fn) { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); return provider; },
    off: function (ev, fn) { return provider.removeListener(ev, fn); },
    removeAllListeners: function (ev) { if (ev) delete listeners[ev]; else listeners = {}; return provider; },
    enable: function () { return provider.request({ method: "eth_requestAccounts" }); },
    sendAsync: function (payload, cb) {
      provider.request(payload).then(function (r) { cb(null, { id: payload.id, jsonrpc: "2.0", result: r }); }, function (e) { cb(e, { id: payload.id, jsonrpc: "2.0", error: { code: e.code, message: e.message } }); });
    },
    send: function (a, b) {
      if (typeof a === "string") return provider.request({ method: a, params: b });
      if (typeof b === "function") return provider.sendAsync(a, b);
      throw new Error("Synchronous send is not supported");
    }
  };
  // Called by the app with responses and events.
  Object.defineProperty(window, "__hensengReceive", { configurable: false, writable: false, value: function (msg) {
    if (!msg || msg.s !== secret) return;
    if (msg.t === "res") {
      var p = pending[msg.id]; if (!p) return; delete pending[msg.id];
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message), { code: msg.error.code })); else p.resolve(msg.result);
    } else if (msg.t === "ev") {
      if (msg.event === "chainChanged") provider.chainId = msg.data;
      if (msg.event === "accountsChanged") provider.selectedAddress = msg.data[0] || null;
      emit(msg.event, msg.data);
    }
  }});
  try { Object.defineProperty(window, "ethereum", { configurable: true, get: function () { return provider; }, set: function () {} }); } catch (e) { window.ethereum = provider; }
  var info = Object.freeze({ uuid: cfg.uuid, name: "HENSENG", icon: cfg.icon, rdns: "app.henseng" });
  function announce() { window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: info, provider: provider }) })); }
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
  window.dispatchEvent(new Event("ethereum#initialized"));
})(); true;`;
}

/** JS the app injects to deliver a response or event to the page. */
export const deliverScript = (msg: object) => `window.__hensengReceive && window.__hensengReceive(${JSON.stringify(msg)}); true;`;
