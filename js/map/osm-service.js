// osm-service.js – Consulta de pontos de interesse via Overpass API (ou mock local)

import { mapInstance } from "../main.js"; // Importa a instância do mapa

/* O que esse módulo faz:
Usa a Overpass API para buscar POIs de categorias específicas.
Está preparado para funcionar offline com dados mockados durante o desenvolvimento.
Fácil de expandir com novas categorias e novas fontes de dados no futuro.*/

export const apiKey =
  "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3";
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

// Queries Overpass
export const queries = {
  "touristSpots-submenu":
    '[out:json];node["tourism"="attraction"](around:10000,-13.376,-38.917);out body;',
  "tours-submenu":
    '[out:json];node["tourism"="information"](around:10000,-13.376,-38.917);out body;',
  "beaches-submenu":
    '[out:json];node["natural"="beach"](around:15000,-13.376,-38.917);out body;',
  "nightlife-submenu":
    '[out:json];node["amenity"="nightclub"](around:10000,-13.376,-38.917);out body;',
  "restaurants-submenu":
    '[out:json];node["amenity"="restaurant"](around:15000,-13.376,-38.917);out body;',
  "inns-submenu":
    '[out:json];node["tourism"="hotel"](around:15000,-13.376,-38.917);out body;',
  "shops-submenu":
    '[out:json];node["shop"](around:15000,-13.376,-38.917);out body;',
  "emergencies-submenu":
    '[out:json];node["amenity"~"hospital|police"](around:10000,-13.376,-38.917);out body;',
  "tips-submenu":
    '[out:json];node["tips"](around:10000,-13.376,-38.913);out body;',
  "about-submenu":
    '[out:json];node["about"](around:10000,-13.376,-38.913);out body;',
  "education-submenu":
    '[out:json];node["education"](around:10000,-13.376,-38.913);out body;',
};

/**
 * Busca dados da API Overpass com base na query fornecida.
 * @param {string} queryKey - Chave da query (ex: 'restaurants-submenu').
 * @returns {Promise<Array>} Lista de resultados formatados.
 */
export async function fetchOSMData(queryKey) {
  const query = queries[queryKey];
  if (!query) {
    throw new Error(`Query não encontrada para a chave: ${queryKey}`);
  }

  const url = `${OVERPASS_API_URL}?data=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro na requisição Overpass API: ${response.status}`);
    }

    const data = await response.json();

    // Extrai e formata os dados relevantes
    return data.elements
      .filter((element) => element.lat && element.lon) // Garante que as coordenadas existam
      .map((element) => ({
        id: element.id,
        name: element.tags.name || "Local sem nome",
        lat: element.lat,
        lon: element.lon,
        tags: element.tags, // Inclui todas as tags para uso futuro
        category: queryKey, // Adiciona a categoria para referência
      }));
  } catch (error) {
    console.error("Erro ao buscar dados da Overpass API:", error);
    throw error;
  }
}

/**
 * Carrega os itens do submenu com base na chave da query fornecida.
 * @param {string} queryKey - Chave da query (ex: 'restaurants-submenu').
 */
export async function loadSubMenu(queryKey) {
  const container = document.getElementById("submenuContainer");
  if (!container) return console.error("Submenu container não encontrado.");

  container.innerHTML = "<p>Carregando...</p>";

  try {
    selectedFeature = queryKey;

    const results = await fetchOSMData(queryKey);
    console.log("[OSM Data]", results); // Verifique os dados retornados aqui

    submenuData[queryKey] = results;
    renderSubmenuItems(container, results);
  } catch (err) {
    container.innerHTML = "<p>Erro ao carregar dados.</p>";
    console.error("Erro no submenu:", err);
  }
}

/**
 * Valida as coordenadas fornecidas usando a API Nominatim.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<Object>} Coordenadas validadas ou originais.
 */
export async function validateCoordinates(lat, lon) {
  const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.error("Erro ao validar coordenadas:", error);
  }
  return { lat, lon }; // Retorna as coordenadas originais se não houver correção
}

export const ROUTE_API_CONFIG = {
  BASE_URL: "https://api.openrouteservice.org/v2",
  ENDPOINTS: {
    directions: "/directions/foot-walking/geojson",
  },
  API_KEY: "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3",
};

/**
 * Consulta a API OpenRouteService, obtém as coordenadas e plota a rota no mapa.
 * @param {number} startLat - Latitude de partida.
 * @param {number} startLon - Longitude de partida.
 * @param {number} destLat - Latitude do destino.
 * @param {number} destLon - Longitude do destino.
 * @param {string} [profile="foot-walking"] - Perfil de navegação.
 * @returns {Promise<{ distance: number, duration: number, instructions: Array } | null>}}
 */
export async function plotRouteOnMap(
  startLat,
  startLon,
  destLat,
  destLon,
  profile = "foot-walking"
) {
  const url = `${ROUTE_API_CONFIG.BASE_URL}/directions/${profile}/geojson`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: ROUTE_API_CONFIG.API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [startLon, startLat],
          [destLon, destLat],
        ],
        instructions: true,
        units: "km",
        language: "pt",
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return processRouteResponse(data, startLat, startLon, destLat, destLon);
  } catch (error) {
    console.error("[plotRouteOnMap] Error:", error);
    return createFallbackRoute(startLat, startLon, destLat, destLon);
  }
}

function processRouteResponse(data, startLat, startLon, destLat, destLon) {
  try {
    const coords = data.features[0].geometry.coordinates;
    const latLngs = coords.map(([lon, lat]) => [lat, lon]);

    if (window.currentRoute) {
      mapInstance.removeLayer(window.currentRoute);
    }

    window.currentRoute = L.polyline(latLngs, {
      color: "blue",
      weight: 5,
    }).addTo(mapInstance);

    mapInstance.fitBounds(window.currentRoute.getBounds(), {
      padding: [50, 50],
    });

    const segments = data.features[0].properties.segments[0];
    return {
      distance: segments.distance,
      duration: segments.duration,
      instructions: segments.steps.map((step) => ({
        text: step.instruction,
        distance: step.distance,
        duration: step.duration,
        maneuver: step.type,
      })),
    };
  } catch (error) {
    console.error("[processRouteResponse] Error:", error);
    return createFallbackRoute(startLat, startLon, destLat, destLon);
  }
}

function createFallbackRoute(startLat, startLon, destLat, destLon) {
  const distance = calculateHaversineDistance(
    startLat,
    startLon,
    destLat,
    destLon
  );
  const duration = calculateEstimatedDuration(distance);
  const path = [
    [startLat, startLon],
    [destLat, destLon],
  ];

  // Create fallback route visualization
  if (window.currentRoute) {
    mapInstance.removeLayer(window.currentRoute);
  }

  window.currentRoute = L.polyline(path, {
    color: "gray",
    weight: 3,
    dashArray: "5, 10",
    opacity: 0.8,
  }).addTo(mapInstance);

  return {
    distance,
    duration,
    instructions: [
      {
        text: "Siga em direção ao destino",
        distance,
        duration,
        maneuver: "straight",
      },
    ],
  };
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Retorna em metros para manter consistência com a API
  return distance * 1000;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

async function retryFetch(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if (i === retries - 1) throw new Error(`Failed after ${retries} retries`);

      // Espera exponencial entre tentativas
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
}
