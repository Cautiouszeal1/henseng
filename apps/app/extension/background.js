// HENSENG extension service worker. It only opens the app in Chrome's side panel when the
// toolbar icon is clicked. The wallet never runs here: keys live only in the open app page,
// in memory, and are dropped when the panel closes.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
