/**
 * Virtual GEO — контент-скрипт
 * Работает в обычном режиме (без отладки).
 * Инжектит inject.js в контекст страницы для виртуальной геолокации.
 */

// Проверяем режим работы ДО инжекта
chrome.storage.local.get(['debugMode', 'geoCoords'], (result) => {
  // В режиме отладки работает background.js через CDP — здесь ничего не делаем
  if (result.debugMode) return;

  // === Инжектим скрипт виртуальной геолокации ===
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.charset = 'UTF-8';
  script.onload = () => script.remove();
  (document.documentElement || document.head || document.body).appendChild(script);

  // === Передаём начальные координаты ===
  const coords = result.geoCoords || {
    latitude: 53.8999146,
    longitude: 27.5203637,
    accuracy: 10,
    altitude: 241,
    altitudeAccuracy: 5
  };
  window.postMessage({ type: 'UPDATE_GEO', coords: coords }, '*');
});

// === Слушаем изменения настроек на лету ===
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // Если включили режим отладки — больше не работаем через JS
  if (changes.debugMode && changes.debugMode.newValue === true) return;

  // Обновляем координаты на странице
  if (changes.geoCoords) {
    chrome.storage.local.get(['debugMode'], (result) => {
      if (result.debugMode) return;
      window.postMessage({ type: 'UPDATE_GEO', coords: changes.geoCoords.newValue }, '*');
    });
  }
});