/**
 * Virtual GEO — панель настроек
 * Управляет сохранением координат и режима работы
 */
document.addEventListener('DOMContentLoaded', () => {
  // Ссылки на поля ввода
  const inputs = {
    latitude: document.getElementById('latitude'),
    longitude: document.getElementById('longitude'),
    accuracy: document.getElementById('accuracy'),
    altitude: document.getElementById('altitude'),
    altitudeAccuracy: document.getElementById('altitudeAccuracy')
  };

  const debugModeCheckbox = document.getElementById('debugMode');
  const statusEl = document.getElementById('status');

  // Значения по умолчанию (Нацбанк РБ, Минск)
  const defaultCoords = {
    latitude: 53.8999146,
    longitude: 27.5203637,
    accuracy: 10,
    altitude: 241,
    altitudeAccuracy: 5
  };

  // === Загрузка сохранённых настроек при открытии окна ===
  chrome.storage.local.get(['geoCoords', 'debugMode'], (result) => {
    if (result.geoCoords) {
      for (const key in inputs) {
        if (result.geoCoords[key] !== undefined) {
          inputs[key].value = result.geoCoords[key];
        }
      }
    }
    debugModeCheckbox.checked = result.debugMode || false;
  });

  // === Сохранение настроек ===
  document.getElementById('saveBtn').addEventListener('click', () => {
    // Собираем значения из полей, подставляя дефолты при ошибке
    const coords = {
      latitude: parseFloat(inputs.latitude.value) || defaultCoords.latitude,
      longitude: parseFloat(inputs.longitude.value) || defaultCoords.longitude,
      accuracy: parseInt(inputs.accuracy.value) || defaultCoords.accuracy,
      altitude: parseInt(inputs.altitude.value) || defaultCoords.altitude,
      altitudeAccuracy: parseInt(inputs.altitudeAccuracy.value) || defaultCoords.altitudeAccuracy
    };

    const debugMode = debugModeCheckbox.checked;

    // Сохраняем в хранилище расширения
    chrome.storage.local.set({ geoCoords: coords, debugMode: debugMode }, () => {
      // Уведомляем background-скрипт об изменениях
      chrome.runtime.sendMessage({
        type: 'GEO_UPDATED',
        coords: coords,
        debugMode: debugMode
      }).catch(err => {
        console.warn('[Virtual GEO] Не удалось отправить сообщение:', err);
      });

      // Показываем статус сохранения
      statusEl.style.display = 'block';
      setTimeout(() => statusEl.style.display = 'none', 2000);
    });
  });

  // === Открытие тестовой страницы ===
  document.getElementById('testBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://browserleaks.com/geo' });
  });
});