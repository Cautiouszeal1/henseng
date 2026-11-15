import { forwardRef, useImperativeHandle, useRef } from "react";
import type { DappWebViewHandle, DappWebViewProps } from "./dapp-webview";
export type { DappWebViewHandle, DappWebViewProps } from "./dapp-webview";

/**
 * Websites can't be embedded in a web page (they block iframes), so on web and in the Chrome
 * extension dApps open in a normal browser tab. This iframe version exists only for automated
 * testing against a local same-origin test page, and is compiled in only when
 * EXPO_PUBLIC_DAPP_IFRAME_TEST=1.
 */
export const IN_APP_BROWSER = process.env.EXPO_PUBLIC_DAPP_IFRAME_TEST === "1";

export const DappWebView = forwardRef<DappWebViewHandle, DappWebViewProps>(function DappWebView(p, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const win = () => frame.current?.contentWindow as (Window & { eval(js: string): unknown }) | null | undefined;
  useImperativeHandle(ref, () => ({
    inject: (js) => void win()?.eval(js),
    goBack: () => win()?.history.back(),
    reload: () => win()?.location.reload(),
  }));
  if (!IN_APP_BROWSER) return null;
  return (
    <iframe
      ref={frame}
      src={p.url}
      title="dApp"
      style={{ flex: 1, border: 0, width: "100%", height: "100%", background: "#101014" }}
      onLoad={() => {
        const w = win();
        if (!w) return;
        (w as any).ReactNativeWebView = { postMessage: (data: string) => p.onMessage(data, w.location.href) };
        w.eval(p.injectedScript);
        w.dispatchEvent(new Event("henseng#ready"));
        p.onNav({ url: w.location.href, title: w.document.title, canGoBack: w.history.length > 1, loading: false });
      }}
    />
  );
});
