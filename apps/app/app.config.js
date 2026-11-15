// Extends app.json. EXPO_BASE_URL serves the web build from a sub-path (the website uses /app).
module.exports = ({ config }) =>
  process.env.EXPO_BASE_URL ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL } } : config;
