/**
 * Módulo: route.js
 * Descrição: Este módulo gerencia a criação de rotas, cálculo de distâncias, manipulação de polylines e exibição de rotas no mapa.
 */
// Exemplo de chaves e constantes
export const ORS_API_KEY =
  '5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3';

// Importações de funções externas
import { showNotification } from '../ui/notifications.js';
import { finalizeRouteMarkers } from '../ui/routeMarkers.js';
import { plotRouteOnMap } from './routeUi/plotRouteOnMap.js';
// Importações de variáveis globais
import { getCurrentLocation } from '../geolocation/tracking.js';
import { showRouteSummary } from '../route/routeUi/routeSummary.js';
// Exemplo de chaves e constantes
export const apiKey =
  '5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export let lastSelectedFeature = null;
export let lastSelectedDestination = null; // Último destino selecionado pelo usuário
// Variáveis para controle e exibição de marcadores e rota
export let markers = []; // Array que armazena todos os marcadores adicionados ao mapa
export let currentRoute = null; // Camada (polyline) da rota atual exibida no mapa
export let userMarker = null; // Marcador que representa a posição atual do usuário
export let destinationMarker = null; // Marcador para o destino

// Variáveis auxiliares de navegação e controle de UI

export let currentLocation = null;

export let routingControl = null;

// Perfil de rota padrão
export let userLocationMarker = null;
export let userCurrentLocation = null;
export let currentRouteData = null;
export let isNavigationActive = false;
export let currentRouteSteps = [];
export let cachedLocation = null;
export let locationPermissionGranted = false;

export let trackingActive = false;
export let watchId = null;
export let userPosition = null;

/////////////////////////////
// 1. FLUXO PRINCIPAL
/////////////////////////////

export let userLocation = null; // Última localização conhecida do usuário (atualizada pelo GPS)
export let selectedDestination = {}; // Objeto com as propriedades do destino (lat, lon, name, etc.)
export let currentStepIndex = 0; // Índice do passo atual na rota
export let lastRecalculationTime = 0; // Timestamp da última recalculação de rota
export let lastDeviationTime = 0; // Timestamp da última desvio de rota
export let instructions = []; // Instruções da rota
export let currentStep = null; // Passo atual da rota
export let debounceTimer = null; // Timer para debouncing de eventos
export let navigationWatchId = null; // ID do watchPosition (se aplicável)
export let isnavigationPaused = false; // Indica se a navegação está pausada
export let selectedProfile = 'foot-walking'; // Perfil de rota padrão

/**
 * 1.1. startRouteCreation
 * Inicia a criação de uma nova rota.
 */

export async function startRouteCreation() {
  if (!selectedDestination || !validateDestination(selectedDestination)) {
    console.error(
      '[startRouteCreation] Destino inválido. Selecione um destino válido.'
    );
    return;
  }

  try {
    console.log('[startRouteCreation] Iniciando criação de rota...');
    const userLocation = await getCurrentLocation();
    if (!userLocation) {
      console.error('[startRouteCreation] Localização do usuário não obtida.');
      return;
    }

    const routeData = await createRoute(userLocation);
    if (!routeData) {
      console.error(
        '[startRouteCreation] Erro ao criar rota. Fluxo interrompido.'
      );
      return;
    }

    currentRouteData = routeData;
    console.log(
      '[startRouteCreation] Rota criada com sucesso:',
      currentRouteData
    );
    showRouteSummary();
  } catch (error) {
    console.error(
      '[startRouteCreation] Erro ao iniciar criação de rota:',
      error.message
    );
  }
}

/**
 * 1.2. createRoute
 * Cria uma rota a partir da localização do usuário até o destino selecionado.
 *
 * @param {Object} userLocation - Localização do usuário ({ latitude, longitude }).
 * @returns {Object|null} - Dados da rota ou null em caso de erro.
 */
export async function createRoute(userLocation) {
  try {
    validateDestination();

    const routeData = await plotRouteOnMap(
      userLocation.latitude,
      userLocation.longitude,
      selectedDestination.lat,
      selectedDestination.lon
    );

    if (!routeData) {
      showNotification('Erro ao calcular rota. Tente novamente.', 'error');
      return null;
    }

    // Atualiza currentRouteData com os dados da rota
    currentRouteData = routeData;

    finalizeRouteMarkers(
      userLocation.latitude,
      userLocation.longitude,
      selectedDestination
    );
    return routeData;
  } catch (error) {
    console.error('Erro ao criar rota:', error);
    showNotification(
      'Erro ao criar rota. Verifique sua conexão e tente novamente.',
      'error'
    );
    return null;
  }
}

/////////////////////////////
// 2. FUNÇÕES AUXILIARES
/////////////////////////////

/**
 * 2.1. validateSelectedDestination
 * Valida se o destino selecionado é válido.
 */
/**
 * 3. validateDestination
 * Verifica se o destino fornecido (ou o global selectedDestination) possui coordenadas válidas.
 * Agora também verifica os limites geográficos.
 * @param {Object} [destination=selectedDestination] - Objeto com as propriedades lat e lon.
 * @returns {boolean} - true se o destino for válido; false caso contrário. */
export function validateDestination(destination = selectedDestination) {
  console.log('[validateDestination] Verificando destino...');

  if (!destination) {
    console.warn('[validateDestination] Destino não fornecido.');
    return false;
  }

  const { lat, lon, name, description, feature } = destination;
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lon) ||
    !name ||
    !description ||
    !feature
  ) {
    console.warn('[validateDestination] Propriedades inválidas:', destination);
    return false;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    console.warn(
      '[validateDestination] Coordenadas fora dos limites:',
      destination
    );
    return false;
  }

  console.log('[validateDestination] Destino válido:', destination);
  return true;
}
