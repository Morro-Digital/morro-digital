/**
 * @file config.js
 * @description Configurações centralizadas da aplicação
 */

export const CONFIG = {
  apiKeys: {
    openRouteService:
      "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3",
  },
  map: {
    center: [-13.3841, -38.9153], // Coordenadas de Morro de São Paulo
    defaultZoom: 16,
    minZoom: 14,
    maxZoom: 19,
  },
  navigation: {
    defaultProfile: "foot-walking",
    rotationInterval: 1000,
    recalculationThreshold: 30, // metros
    arrivalThreshold: 15, // metros
    recalculationCooldown: 30000, // 30 segundos entre recálculos
  },
  defaultLanguage: "pt",
  // Flag para determinar ambiente de desenvolvimento ou produção
  isDevelopment: true,
};
