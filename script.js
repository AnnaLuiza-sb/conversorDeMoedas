// Elementos DOM
const form = document.getElementById('converterForm');
const amount = document.getElementById('amount');
const fromCurrency = document.getElementById('fromCurrency');
const toCurrency = document.getElementById('toCurrency');
const convertedAmount = document.getElementById('convertedAmount');
const loading = document.querySelector('.loading');
const result = document.querySelector('.result');
const error = document.querySelector('.error');
const historyBtn = document.getElementById('showHistoryBtn');
const historyModal = document.getElementById('historyModal');
const closeModal = document.querySelector('.close-modal');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const ctx = document.getElementById('exchangeRateChart').getContext('2d');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.querySelector('.close-settings');
const updateFrequency = document.getElementById('updateFrequency');
const enableNotifications = document.getElementById('enableNotifications');
const notificationThreshold = document.getElementById('notificationThreshold');
const saveSettings = document.getElementById('saveSettings');

// Variáveis globais
let exchangeRateChart;
let updateInterval;
let lastRates = {};
const Api_URL = 'https://api.frankfurter.app/latest?from=';

// ======================
// FUNÇÕES PRINCIPAIS
// ======================

async function fetchHistoricalRates(days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}?from=${fromCurrency.value}&to=${toCurrency.value}`
    );
    
    if (!response.ok) throw new Error("API indisponível");
    
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error("Erro ao buscar dados históricos:", error);
    return null;
  }
}

async function updateChart() {
  try {
    const days = parseInt(document.getElementById('chartPeriod').value);
    const rates = await fetchHistoricalRates(days);
    
    if (!rates) {
      console.warn("Dados históricos não disponíveis");
      return;
    }

    const labels = Object.keys(rates).sort();
    const values = labels.map(date => rates[date][toCurrency.value]);

    if (exchangeRateChart) {
      exchangeRateChart.destroy();
    }

    exchangeRateChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${fromCurrency.value} para ${toCurrency.value}`,
          data: values,
          borderColor: '#08dd9d',
          backgroundColor: 'rgba(8, 221, 157, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: '#e1e1e6'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#8d8d99'
            },
            grid: {
              color: 'rgba(255,255,255,0.1)'
            }
          },
          y: {
            ticks: {
              color: '#8d8d99'
            },
            grid: {
              color: 'rgba(255,255,255,0.1)'
            }
          }
        }
      }
    });
  } catch (e) {
    console.error("Erro ao atualizar gráfico:", e);
  }
}

// ======================
// FUNÇÕES DE HISTÓRICO
// ======================

function saveToHistory(amount, from, to, result, rate) {
  if (!amount || isNaN(amount)) return;

  const conversion = {
    date: new Date().toLocaleString(),
    amount: parseFloat(amount),
    from,
    to,
    result: parseFloat(result),
    rate: parseFloat(rate)
  };

  let history = JSON.parse(localStorage.getItem('conversionHistory')) || [];
  history.unshift(conversion);
  if (history.length > 10) history.pop();
  localStorage.setItem('conversionHistory', JSON.stringify(history));
}

function displayHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('conversionHistory')) || [];
    historyList.innerHTML = history.length > 0 
      ? history.map(item => `
          <li>
            <strong>${item.date}</strong><br>
            ${item.amount.toFixed(2)} ${item.from} → ${item.result.toFixed(2)} ${item.to}<br>
            <small>Taxa: 1 ${item.from} = ${item.rate.toFixed(6)} ${item.to}</small>
          </li>
        `).join('')
      : '<li>Nenhuma conversão registrada</li>';
  } catch (e) {
    console.error("Erro ao exibir histórico:", e);
    historyList.innerHTML = '<li>Erro ao carregar histórico</li>';
  }
}

// ======================
// FUNÇÕES DE CONFIGURAÇÕES (ASYNC)
// ======================

async function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('converterSettings')) || {};
    return {
      updateFrequency: settings.updateFrequency || 60,
      enableNotifications: settings.enableNotifications || false,
      notificationThreshold: settings.notificationThreshold || 2
    };
  } catch (e) {
    console.error("Erro ao carregar configurações:", e);
    return {
      updateFrequency: 60,
      enableNotifications: false,
      notificationThreshold: 2
    };
  }
}

async function saveSettingsToStorage() {
  try {
    const settings = {
      updateFrequency: parseInt(updateFrequency.value),
      enableNotifications: enableNotifications.checked,
      notificationThreshold: parseFloat(notificationThreshold.value)
    };
    await localStorage.setItem('converterSettings', JSON.stringify(settings));
    await applySettings();
  } catch (e) {
    console.error("Erro ao salvar configurações:", e);
    throw e;
  }
}

async function checkNotificationPermission() {
  try {
    if (!('Notification' in window)) {
      console.warn('Seu navegador não suporta notificações');
      return false;
    }

    if (Notification.permission === 'granted') return true;

    if (Notification.permission === 'denied') {
      console.info(
        'Permissão bloqueada! Acesse as configurações do navegador para liberar.',
        5000
      );
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.info('Notificações ativadas com sucesso!');
      return true;
    }
    return false;
    
  } catch (e) {
    console.error('Erro ao verificar permissão:', e);
    return false;
  }
}

async function applySettings() {
  try {
    const settings = await loadSettings();
    
    clearInterval(updateInterval);
    
    if (settings.updateFrequency > 0) {
      updateInterval = setInterval(async () => {
        await updateRates();
      }, settings.updateFrequency * 60 * 1000);
    }
    
    if (settings.enableNotifications) {
      await checkNotificationPermission();
    }
  } catch (e) {
    console.error("Erro ao aplicar configurações:", e);
  }
}

async function updateRates() {
  try {
       const ctx = document.getElementById('exchangeRateChart')?.getContext('2d');
    if (!ctx) throw new Error("Canvas não encontrado");
    
    const response = await fetch(Api_URL + fromCurrency.value);
    const data = await response.json();
    checkRateChanges(data.rates);
    return data.rates;
  } catch (error) {
    console.error("Erro ao atualizar taxas:", error);
    return null;
  }
}

async function checkRateChanges(newRates) {
  try {
    const settings = await loadSettings();
    if (!settings.enableNotifications) return;

    const threshold = settings.notificationThreshold / 100;
    
    for (const currency in newRates) {
      if (lastRates[currency]) {
        const variation = Math.abs(newRates[currency] - lastRates[currency]) / lastRates[currency];
        if (variation > threshold) {
          await showNotification(
            `Variação de ${(variation * 100).toFixed(2)}% na ${currency}`,
            `Taxa atual: ${newRates[currency].toFixed(4)} (anterior: ${lastRates[currency].toFixed(4)})`
          );
        }
      }
    }
    
    lastRates = {...newRates};
  } catch (e) {
    console.error("Erro ao verificar mudanças:", e);
  }
}

// ======================
// FUNÇÃO PRINCIPAL DE CONVERSÃO
// ======================

async function showLoading() {
  loading.style.display = 'block';
  error.style.display = 'none';
  result.style.display = 'none';

  try {
    const response = await fetch(Api_URL + fromCurrency.value);
    if (!response.ok) throw new Error("API fora do ar");
    
    const data = await response.json();
    const rate = data.rates[toCurrency.value];
    const convertedValue = (amount.value * rate).toFixed(2);

    saveToHistory(amount.value, fromCurrency.value, toCurrency.value, convertedValue, rate);
    convertedAmount.value = convertedValue;
    result.style.display = 'block';
    result.innerHTML = `
      <div style="font-size: 1.3rem;"> 
        ${amount.value} ${fromCurrency.value} = ${convertedValue} ${toCurrency.value}
      </div>
      <div style="font-size: 0.9rem; opacity: 0.8; margin-top: 6px"> 
        Taxa: 1 ${fromCurrency.value} = ${rate} ${toCurrency.value}
      </div>
    `;

    // Atualiza cache para modo offline
    const cache = {
      timestamp: new Date().getTime(),
      rates: data.rates,
      base: fromCurrency.value
    };
    localStorage.setItem('exchangeRateCache', JSON.stringify(cache));

  } catch (err) {
    console.error(err);
    error.style.display = 'block';
    error.innerHTML = `Falha ao buscar a taxa de câmbio. Tente novamente`;
  } finally {
    loading.style.display = 'none';
  }
}


// Configurações
settingsBtn.addEventListener('click', async () => {
  try {
    const settings = await loadSettings();
    updateFrequency.value = settings.updateFrequency;
    enableNotifications.checked = settings.enableNotifications;
    notificationThreshold.value = settings.notificationThreshold;


    settingsModal.style.display = 'block';
  } catch (e) {
    console.error("Erro ao abrir configurações:", e);
  }
});

closeSettings.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

saveSettings.addEventListener('click', async () => {
  try {
    // 1. Salva as configurações primeiro
    const settings = {
      updateFrequency: parseInt(updateFrequency.value),
      enableNotifications: enableNotifications.checked,
      notificationThreshold: parseFloat(notificationThreshold.value)
    };
    
    localStorage.setItem('converterSettings', JSON.stringify(settings));

    // 2. Aplica as configurações
    clearInterval(updateInterval);
    
    if (settings.updateFrequency > 0) {
      updateInterval = setInterval(updateRates, settings.updateFrequency * 60 * 1000);
    }
    
    // 3. Só solicita permissão se o usuário ativou notificações
    if (settings.enableNotifications) {
      const hasPermission = await checkNotificationPermission();
      if (!hasPermission) {
        // Reverte a opção se o usuário negar
        enableNotifications.checked = false;
        localStorage.setItem('converterSettings', 
          JSON.stringify({...settings, enableNotifications: false}));
      }
    }
    
    settingsModal.style.display = 'none';
    alert('Configurações salvas com sucesso!');
    
  } catch (e) {
    console.error('Erro ao salvar configurações:', e);
    alert('Erro ao salvar: ' + e.message);
  }
});

document.getElementById('notificationPermissionBtn')?.addEventListener('click', checkNotificationPermission);

// Histórico
historyBtn.addEventListener('click', () => {
  historyModal.style.display = 'block';
  displayHistory();
});

closeModal.addEventListener('click', () => {
  historyModal.style.display = 'none';
});

clearHistoryBtn.addEventListener('click', () => {
  if (confirm("Tem certeza que deseja limpar todo o histórico?")) {
    localStorage.removeItem('conversionHistory');
    displayHistory();
  }
});

// Conversor
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!amount.value || isNaN(amount.value)) {
    error.style.display = 'block';
    error.innerHTML = "Digite um valor válido";
    return;
  }
  await showLoading();
});

// Gráfico
document.getElementById('updateChartBtn').addEventListener('click', updateChart);
fromCurrency.addEventListener('change', updateChart);
toCurrency.addEventListener('change', updateChart);



window.addEventListener('load', async () => {
  try {
    // Carrega configurações
    await applySettings();
    
    // Primeira atualização
    const rates = await updateRates();
    if (rates) lastRates = rates;
    
    // Inicia gráfico
    await updateChart();
    
  } catch (e) {
    console.error("Erro na inicialização:", e);
  }
});

// Monitora conexão
window.addEventListener('online', () => {
  console.log("Conexão restabelecida");
  updateChart();
});

window.addEventListener('offline', () => {
  console.log("Modo offline ativado");
  error.innerHTML = "Modo offline - usando cache local";
  error.style.display = 'block';
});

//Backdrop para modal

