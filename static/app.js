/**
 * Event Usher – Frontend logic
 * Talks to the Python OCR backend at /api/ocr
 */

// ========== STATE ==========
let pricePerPerson = 1000;
let currentImage = null;   // compressed dataURL for storage
let entries = [];

// ========== DOM ==========
const priceInput   = document.getElementById('priceInput');
const fileInput    = document.getElementById('fileInput');
const previewImg   = document.getElementById('previewImg');
const uploadPrompt = document.getElementById('uploadPrompt');
const ocrLoading   = document.getElementById('ocrLoading');
const txIdInput    = document.getElementById('txIdInput');
const amountInput  = document.getElementById('amountInput');
const guestInput   = document.getElementById('guestInput');
const calcHint     = document.getElementById('calcHint');
const confirmBtn   = document.getElementById('confirmBtn');
const minusBtn     = document.getElementById('minusBtn');
const plusBtn      = document.getElementById('plusBtn');
const resetBtn     = document.getElementById('resetBtn');
const timeline     = document.getElementById('timeline');
const emptyState   = document.getElementById('emptyState');
const logCount     = document.getElementById('logCount');
const totalRevenue = document.getElementById('totalRevenue');
const totalPeople  = document.getElementById('totalPeople');
const totalEntries = document.getElementById('totalEntries');
const ocrStatus    = document.getElementById('ocrStatus');
const modal        = document.getElementById('modal');
const modalImg     = document.getElementById('modalImg');

// ========== STORAGE ==========
function loadState() {
  try {
    const saved = localStorage.getItem('eventUsherCBE');
    if (saved) {
      const data = JSON.parse(saved);
      pricePerPerson = data.pricePerPerson || 1000;
      entries = data.entries || [];
      priceInput.value = pricePerPerson;
    }
  } catch (e) {
    entries = [];
  }
  render();
}

function saveState() {
  try {
    localStorage.setItem('eventUsherCBE', JSON.stringify({
      pricePerPerson,
      entries
    }));
  } catch (e) {
    alert('Storage full – please reset old data');
  }
}

// ========== IMAGE HELPERS ==========
function compressForStorage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 360;
      let w = img.width, h = img.height;
      if (w > max) {
        h = Math.round(h * max / w);
        w = max;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.45));
    };
    img.src = dataUrl;
  });
}

// ========== OCR CALL (to Python backend) ==========
async function callOCR(dataUrl) {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl })
  });
  if (!response.ok) throw new Error('OCR request failed');
  return await response.json();
}

// ========== UI HELPERS ==========
function formatMoney(n) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0
  }).format(n).replace('ETB', 'Br');
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function updateCalcHint() {
  const amount = Number(amountInput.value) || 0;
  const calc = pricePerPerson > 0 ? Math.round(amount / pricePerPerson) : 0;
  calcHint.textContent = amount
    ? `${amount} Br ÷ ${pricePerPerson} = ${calc} people`
    : '';
}

function updateConfirmState() {
  confirmBtn.disabled = !(
    currentImage &&
    txIdInput.value.length > 5 &&
    Number(amountInput.value) > 0 &&
    Number(guestInput.value) > 0
  );
}

// ========== RENDER ==========
function renderDashboard() {
  const revenue = entries.reduce((s, e) => s + e.amount, 0);
  const people  = entries.reduce((s, e) => s + e.guestCount, 0);
  totalRevenue.textContent = formatMoney(revenue);
  totalPeople.textContent  = people;
  totalEntries.textContent = entries.length;
  logCount.textContent     = entries.length;
}

function renderTimeline() {
  if (entries.length === 0) {
    timeline.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  timeline.innerHTML = sorted.map(e => `
    <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex gap-3">
      <img src="${e.image}" class="w-14 h-14 rounded-lg object-cover flex-shrink-0 cursor-pointer"
           onclick="openModal('${e.image}')" alt="" />
      <div class="flex-1 min-w-0">
        <div class="flex justify-between gap-2">
          <div>
            <p class="text-xs text-slate-400">${formatTime(e.timestamp)}</p>
            <p class="font-mono text-sm font-medium truncate">${e.txId}</p>
          </div>
          <span class="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-full">
            🎟️ ${e.guestCount}
          </span>
        </div>
        <p class="text-sm font-semibold text-emerald-600 mt-1">${formatMoney(e.amount)}</p>
      </div>
    </div>
  `).join('');
}

function render() {
  renderDashboard();
  renderTimeline();
}

// ========== EVENTS ==========
priceInput.addEventListener('input', () => {
  pricePerPerson = Math.max(1, Number(priceInput.value) || 1000);
  updateCalcHint();
  saveState();
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    ocrLoading.classList.remove('hidden');
    ocrStatus.textContent = '';
    txIdInput.value = '';
    amountInput.value = '';
    guestInput.value = 1;

    try {
      // Compress for localStorage + timeline
      currentImage = await compressForStorage(ev.target.result);
      previewImg.src = currentImage;
      previewImg.classList.remove('hidden');
      uploadPrompt.classList.add('hidden');

      // Send original (higher quality) to Python OCR
      const result = await callOCR(ev.target.result);

      if (result.tx_id) txIdInput.value = result.tx_id;
      if (result.amount > 0) {
        amountInput.value = result.amount;
        guestInput.value = Math.max(1, Math.round(result.amount / pricePerPerson));
      }

      updateCalcHint();
      updateConfirmState();

      if (result.success) {
        ocrStatus.textContent = '✓ Ready to confirm';
        ocrStatus.classList.remove('text-red-500');
      } else {
        ocrStatus.textContent = 'Could not read clearly – try better lighting or retake';
        ocrStatus.classList.add('text-red-500');
      }
    } catch (err) {
      console.error(err);
      ocrStatus.textContent = 'Server error – is the Python backend running?';
      ocrStatus.classList.add('text-red-500');
    } finally {
      ocrLoading.classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);
});

guestInput.addEventListener('input', updateConfirmState);

minusBtn.addEventListener('click', () => {
  guestInput.value = Math.max(1, (Number(guestInput.value) || 1) - 1);
  updateConfirmState();
});

plusBtn.addEventListener('click', () => {
  guestInput.value = (Number(guestInput.value) || 0) + 1;
  updateConfirmState();
});

confirmBtn.addEventListener('click', () => {
  if (confirmBtn.disabled) return;

  entries.push({
    id: Date.now().toString(36),
    timestamp: Date.now(),
    txId: txIdInput.value.trim(),
    amount: Number(amountInput.value),
    guestCount: Number(guestInput.value),
    image: currentImage
  });
  saveState();
  render();

  // Reset form
  currentImage = null;
  previewImg.src = '';
  previewImg.classList.add('hidden');
  uploadPrompt.classList.remove('hidden');
  fileInput.value = '';
  txIdInput.value = '';
  amountInput.value = '';
  guestInput.value = 1;
  calcHint.textContent = '';
  ocrStatus.textContent = '';
  updateConfirmState();

  confirmBtn.textContent = '✓ Admitted';
  setTimeout(() => confirmBtn.textContent = 'Confirm & Admit', 800);
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Clear all data?')) return;
  entries = [];
  pricePerPerson = 1000;
  priceInput.value = 1000;
  currentImage = null;
  previewImg.src = '';
  previewImg.classList.add('hidden');
  uploadPrompt.classList.remove('hidden');
  fileInput.value = '';
  txIdInput.value = '';
  amountInput.value = '';
  guestInput.value = 1;
  calcHint.textContent = '';
  ocrStatus.textContent = '';
  updateConfirmState();
  saveState();
  render();
});

window.openModal = (src) => {
  modalImg.src = src;
  modal.classList.remove('hidden');
};

window.closeModal = () => {
  modal.classList.add('hidden');
  modalImg.src = '';
};

// ========== START ==========
loadState();
updateConfirmState();
