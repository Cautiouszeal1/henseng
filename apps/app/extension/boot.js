// Runs before the app bundle inside the extension. Chrome opens the app at /index.html,
// but the app's routes live at "/" — rewrite the address so routing starts at the home screen.
if (location.pathname === "/index.html") history.replaceState(null, "", "/" + location.search + location.hash);
