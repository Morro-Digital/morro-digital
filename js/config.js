export const CONFIG = {
  development: {
    API_BASE_URL: "http://localhost:3000/api",
    USE_PROXY: true,
  },
  production: {
    API_BASE_URL: "https://api.openrouteservice.org/v2",
    USE_PROXY: false,
  },
};

export const ENV =
  window.location.hostname === "localhost" ? "development" : "production";
export const CURRENT_CONFIG = CONFIG[ENV];
