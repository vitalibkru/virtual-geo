/**
 * Virtual GEO — скрипт виртуальной геолокации
 * Выполняется в контексте страницы (MAIN world).
 * Перехватывает вызовы navigator.geolocation и возвращает заданные координаты.
 */
(function () {
  // === Получение текущих виртуальных координат ===
  function getCoords() {
    return window.__GEO_OVERRIDE__ || {
      latitude: 53.8999146,
      longitude: 27.5203637,
      accuracy: 10,
      altitude: 241,
      altitudeAccuracy: 5
    };
  }

  // === Добавление небольшого "шума" для реалистичности ===
  function addGpsNoise(coords) {
    const noise = () => (Math.random() - 0.5) * 0.00002;
    return {
      latitude: coords.latitude + noise(),
      longitude: coords.longitude + noise(),
      accuracy: Math.max(1, coords.accuracy + (Math.random() - 0.5) * 2),
      altitude: coords.altitude + (Math.random() - 0.5) * 0.5,
      altitudeAccuracy: coords.altitudeAccuracy,
      heading: null,
      speed: null
    };
  }

  // === Приём обновлений координат от content.js ===
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'UPDATE_GEO') {
      window.__GEO_OVERRIDE__ = event.data.coords;
    }
  });

  // === Виртуальный getCurrentPosition ===
  function fakeGetCurrentPosition(success, error, options) {
    try {
      success({
        coords: addGpsNoise(getCoords()),
        timestamp: Date.now()
      });
    } catch (err) {
      if (error) error({ code: 0, message: err.message });
    }
  }

  // === Виртуальный watchPosition с периодическим обновлением ===
  function fakeWatchPosition(success, error, options) {
    const watchId = Math.floor(Math.random() * 10000);

    // Первый вызов сразу
    try {
      success({
        coords: addGpsNoise(getCoords()),
        timestamp: Date.now()
      });
    } catch (err) {
      if (error) error({ code: 0, message: err.message });
      return watchId;
    }

    // Периодические вызовы каждые 2 секунды
    const intervalId = setInterval(() => {
      try {
        success({
          coords: addGpsNoise(getCoords()),
          timestamp: Date.now()
        });
      } catch (err) {
        // Игнорируем ошибки в периодических вызовах
      }
    }, 2000);

    window.__GEO_WATCH_INTERVALS__ = window.__GEO_WATCH_INTERVALS__ || {};
    window.__GEO_WATCH_INTERVALS__[watchId] = intervalId;

    return watchId;
  }

  // === Виртуальный clearWatch ===
  function fakeClearWatch(watchId) {
    if (window.__GEO_WATCH_INTERVALS__ && window.__GEO_WATCH_INTERVALS__[watchId]) {
      clearInterval(window.__GEO_WATCH_INTERVALS__[watchId]);
      delete window.__GEO_WATCH_INTERVALS__[watchId];
    }
  }

  // === Установка виртуальной геолокации ===
  if (navigator.geolocation) {
    try {
      Object.defineProperty(navigator.geolocation, 'getCurrentPosition', {
        value: fakeGetCurrentPosition, writable: false, configurable: true
      });
      Object.defineProperty(navigator.geolocation, 'watchPosition', {
        value: fakeWatchPosition, writable: false, configurable: true
      });
      Object.defineProperty(navigator.geolocation, 'clearWatch', {
        value: fakeClearWatch, writable: false, configurable: true
      });
    } catch (err) {
      // Fallback: прямое присваивание
      navigator.geolocation.getCurrentPosition = fakeGetCurrentPosition;
      navigator.geolocation.watchPosition = fakeWatchPosition;
      navigator.geolocation.clearWatch = fakeClearWatch;
    }

    // Оборачиваем в Proxy для отслеживания всех обращений
    const geoProxy = new Proxy(navigator.geolocation, {
      get(target, prop) { return target[prop]; }
    });

    try {
      Object.defineProperty(navigator, 'geolocation', {
        value: geoProxy, writable: false, configurable: true
      });
    } catch (err) {
      // Игнорируем, если свойство нельзя переопределить
    }
  }

  // === Виртуальное разрешение на геолокацию ===
  if (navigator.permissions && navigator.permissions.query) {
    const originalQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function (permissionDesc) {
      if (permissionDesc.name === 'geolocation') {
        return Promise.resolve({ state: 'granted', onchange: null });
      }
      return originalQuery(permissionDesc);
    };
  }
})();