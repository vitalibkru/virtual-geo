/**
 * Virtual GEO — фоновый скрипт
 * Отвечает за:
 *  - инициализацию настроек при установке
 *  - работу через Chrome DevTools Protocol (режим отладки)
 *  - рассылку обновлений координат во все вкладки
 */

// Значения по умолчанию (Нацбанк РБ, Минск)
const defaultCoords = {
  latitude: 53.8999146,
  longitude: 27.5203637,
  accuracy: 10,
  altitude: 241,
  altitudeAccuracy: 5
};

// Список вкладок, к которым подключён debugger
const attachedTabs = new Set();
let currentDebugMode = false;

// === Инициализация при установке/обновлении расширения ===
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.storage.local.get(['geoCoords', 'debugMode'], (result) => {
      if (!result.geoCoords) {
        chrome.storage.local.set({ geoCoords: defaultCoords, debugMode: false });
      }
      currentDebugMode = result.debugMode || false;
      applyMode();
    });
  }
});

// === Запуск браузера ===
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['debugMode'], (result) => {
    currentDebugMode = result.debugMode || false;
    applyMode();
  });
});

// === Страховка: при загрузке service worker ===
chrome.storage.local.get(['debugMode'], (result) => {
  currentDebugMode = result.debugMode || false;
  applyMode();
});

// === Обработка сообщений от popup ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GEO_UPDATED') {
    if (message.debugMode !== undefined) {
      currentDebugMode = message.debugMode;
    }
    applyMode(message.coords);
    sendResponse({ success: true });
    return false;
  }
});

// === Применение текущего режима ===
async function applyMode(coords = null) {
  if (!coords) {
    const result = await chrome.storage.local.get(['geoCoords']);
    coords = result.geoCoords || defaultCoords;
  }

  if (currentDebugMode) {
    // Режим отладки — подключаемся через CDP
    await attachToAllTabs(coords);
  } else {
    // Обычный режим — отключаем debugger, работает content_scripts
    await detachFromAllTabs();
  }
}

// === Режим отладки: подключение через Chrome DevTools Protocol ===

async function attachToAllTabs(coords) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      continue;
    }
    await attachToTab(tab.id, coords);
  }
}

async function attachToTab(tabId, coords) {
  try {
    if (!attachedTabs.has(tabId)) {
      await chrome.debugger.attach({ tabId: tabId }, '1.3');
      attachedTabs.add(tabId);
    }

    if (coords) {
      // Устанавливаем виртуальную геолокацию на уровне браузера
      await chrome.debugger.sendCommand({ tabId: tabId }, 'Emulation.setGeolocationOverride', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      });
    }
  } catch (err) {
    // Игнорируем ошибки для недоступных вкладок
  }
}

async function detachFromAllTabs() {
  for (const tabId of attachedTabs) {
    try {
      await chrome.debugger.detach({ tabId: tabId });
    } catch (err) {
      // Вкладка уже закрыта
    }
  }
  attachedTabs.clear();
}

// === Обработка событий вкладок ===

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
  if (currentDebugMode && tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') && 
      !tab.url.startsWith('about:')) {
    chrome.storage.local.get(['geoCoords'], (result) => {
      attachToTab(tab.id, result.geoCoords || defaultCoords);
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (currentDebugMode && changeInfo.status === 'complete' && tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') && 
      !tab.url.startsWith('about:')) {
    chrome.storage.local.get(['geoCoords'], (result) => {
      attachToTab(tabId, result.geoCoords || defaultCoords);
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});