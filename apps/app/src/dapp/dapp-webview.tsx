import { forwardRef, useImperativeHandle, useRef, type ComponentRef } from "react";
import { Linking } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

export interface DappWebViewHandle {
  inject(js: string): void;
  goBack(): void;
  reload(): void;
}
export interface DappWebViewProps {
  url: string;
  /** Runs in the main frame before the page's own scripts */
  injectedScript: string;
  onMessage(data: string, pageUrl: string): void;
  onNav(n: { url: string; title?: string; canGoBack: boolean; loading: boolean }): void;
  onProgress?(p: number): void;
  /** Called for a navigation the browser refuses (non-https) */
  onBlocked?(url: string): void;
}

/** The page view used by the dApp browser on iOS and Android. */
export const DappWebView = forwardRef<DappWebViewHandle, DappWebViewProps>(function DappWebView(p, ref) {
  const wv = useRef<ComponentRef<typeof WebView>>(null);
  useImperativeHandle(ref, () => ({
    inject: (js) => wv.current?.injectJavaScript(js),
    goBack: () => wv.current?.goBack(),
    reload: () => wv.current?.reload(),
  }));
  const nav = (n: WebViewNavigation) => p.onNav({ url: n.url, title: n.title, canGoBack: n.canGoBack, loading: n.loading });
  return (
    <WebView
      ref={wv}
      source={{ uri: p.url }}
      style={{ flex: 1, backgroundColor: "#101014" }}
      injectedJavaScriptBeforeContentLoaded={p.injectedScript}
      injectedJavaScriptBeforeContentLoadedForMainFrameOnly
      injectedJavaScriptForMainFrameOnly
      onMessage={(e) => p.onMessage(e.nativeEvent.data, e.nativeEvent.url)}
      onNavigationStateChange={nav}
      onLoadProgress={(e) => p.onProgress?.(e.nativeEvent.progress)}
      originWhitelist={["https://*"]}
      onShouldStartLoadWithRequest={(r) => {
        if (r.url.startsWith("https://") || r.url === "about:blank" || r.url.startsWith("about:srcdoc") || r.url.startsWith("blob:") || r.url.startsWith("data:")) return true;
        if (/^(mailto|tel):/i.test(r.url)) {
          void Linking.openURL(r.url).catch(() => undefined);
          return false;
        }
        p.onBlocked?.(r.url);
        return false;
      }}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      allowsBackForwardNavigationGestures
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never"
      geolocationEnabled={false}
      webviewDebuggingEnabled={__DEV__}
      pullToRefreshEnabled
      decelerationRate="normal"
      applicationNameForUserAgent="HENSENG"
    />
  );
});

export const IN_APP_BROWSER = true;
