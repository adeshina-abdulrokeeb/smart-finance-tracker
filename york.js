const txForm = document.getElementById('txForm');
const txTitle = document.getElementById('txTitle');
const txAmount = document.getElementById('txAmount');
const txType = document.getElementById('txType'); // hidden select

const balanceValue = document.getElementById('balanceValue');
const incomeValue = document.getElementById('incomeValue');
const expenseValue = document.getElementById('expenseValue');

const transactionList = document.getElementById('transactionList');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter'); // hidden select

const themeToggle = document.getElementById('themeToggle');
const exportCSVBtn = document.getElementById('exportCSV');
const exportPDFBtn = document.getElementById('exportPDF');
const clearAllBtn = document.getElementById('clearAll');

const newsletterForm = document.getElementById('newsletterForm');
const newsletterEmail = document.getElementById('newsletterEmail');
const newsletterSubscribe = document.getElementById('newsletterSubscribe');

const modalOverlay = document.getElementById('modalOverlay');
const modalCloseX = document.getElementById('modalCloseX');
const modalCloseBtn = document.getElementById('modalClose');

/* storage keys */
const STORAGE_KEY = 'pft_transactions_v1';
const THEME_KEY = 'pft_theme_v1';

/* state */
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let pieChart = null;
let lineChart = null;
let modalTimer = null;

/* helpers */
const uid = () => Date.now() + Math.floor(Math.random() * 1000);
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));

const formatNaira = v => {
  const n = Number(v) || 0;
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n);
  } catch (e) {
    return '₦' + n.toFixed(2);
  }
};

/* === CUSTOM DROPDOWN HANDLER === */
function initCustomDropdowns() {
  document.querySelectorAll('.custom-dropdown').forEach(drop => {
    const selected = drop.querySelector('.dropdown-selected');
    const list = drop.querySelector('.dropdown-list');
    const hiddenSelect = drop.querySelector('select');
    const items = list.querySelectorAll('li');

    // Toggle open/close
    drop.addEventListener('click', e => {
      if (e.target.tagName.toLowerCase() !== 'li') {
        document.querySelectorAll('.custom-dropdown').forEach(d => {
          if (d !== drop) d.classList.remove('open');
        });
        drop.classList.toggle('open');
      }
    });

    // Select an item
    items.forEach(li => {
      li.addEventListener('click', e => {
        const val = li.dataset.value;
        const text = li.textContent.trim();
        selected.textContent = text;
        hiddenSelect.value = val;
        hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        drop.classList.remove('open');
      });
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!drop.contains(e.target)) drop.classList.remove('open');
    });
  });
}

/* === Theme === */
const applyTheme = theme => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌗';
  refreshCharts();
};

const loadTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);
  else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
};

themeToggle && themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(cur);
});

/* === Rendering & summary === */
const updateSummary = (list = transactions) => {
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  incomeValue.textContent = formatNaira(income);
  expenseValue.textContent = formatNaira(expense);
  balanceValue.textContent = formatNaira(balance);

  incomeValue.style.color = income > 0 ? 'var(--success, #16a34a)' : 'var(--muted, #888)';
  expenseValue.style.color = expense > 0 ? 'var(--danger, #dc2626)' : 'var(--muted, #888)';
  balanceValue.style.color =
    balance > 0 ? 'var(--accent, #7c3aed)' :
    balance < 0 ? 'var(--danger, #dc2626)' : 'var(--text, #222)';
};

const renderTransactions = () => {
  const q = (searchInput.value || '').trim().toLowerCase();
  const ft = typeFilter.value || 'all';
  transactionList.innerHTML = '';

  const filtered = transactions.filter(t => {
    const matchesQ = !q || (t.title && t.title.toLowerCase().includes(q));
    const matchesType = ft === 'all' || t.type === ft;
    return matchesQ && matchesType;
  });

  if (!filtered.length) {
    const li = document.createElement('li');
    li.className = 'fade-in';
    li.innerHTML = '<div class="tx-left"><div class="tx-title" style="color:var(--muted)">No transactions yet</div></div>';
    transactionList.appendChild(li);
    updateSummary([]);
    refreshCharts([]);
    return;
  }

  filtered.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'fade-in';
    li.innerHTML = `
      <div class="tx-left">
        <div class="tx-title">${tx.title}</div>
        <div class="tx-meta">${new Date(tx.date).toLocaleString()}</div>
      </div>
      <div class="amount ${tx.type}">${formatNaira(tx.amount)}</div>
      <div class="tx-actions">
        <button class="btn small edit-btn" data-id="${tx.id}">Edit</button>
        <button class="btn small delete-btn" data-id="${tx.id}">Delete</button>
      </div>
    `;
    transactionList.appendChild(li);
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => handleEdit(btn.dataset.id));
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });

  updateSummary(filtered);
  refreshCharts(filtered);
};

/* === Charts === */
const getVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || null;

const buildPie = (list = transactions) => {
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  if (pieChart) pieChart.destroy();
  const ctx = document.getElementById('pieChart').getContext('2d');

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Income', 'Expense'], datasets: [{ data: [income, expense], backgroundColor: ['#10b981', '#ef4444'] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: getVar('--text') } } } }
  });
};

const buildLine = (list = transactions) => {
  const map = {};
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    map[d.toISOString().slice(0,7)] = map[d.toISOString().slice(0,7)] || 0;
  }

  list.forEach(t => {
    const key = (t.date || '').slice(0,7) || new Date(t.date).toISOString().slice(0,7);
    map[key] = (map[key] || 0) + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
  });

  const keys = Object.keys(map).sort();
  let running = 0;
  const cum = keys.map(k => { running += Math.round((map[k] || 0) * 100) / 100; return running; });

  if (lineChart) lineChart.destroy();
  const ctx = document.getElementById('lineChart').getContext('2d');

  const accent = getVar('--accent') || '#7c3aed';
  let bg = 'rgba(124,58,237,0.14)';
  try {
    const hex = accent.replace(/\s/g,'');
    if (hex[0] === '#') {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      bg = `rgba(${r},${g},${b},0.14)`;
    }
  } catch(e){}

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: keys.map(k => { const [y,m] = k.split('-'); return new Date(y, m-1,1).toLocaleString('default',{month:'short', year:'numeric'}); }),
      datasets: [{ label:'Cumulative Balance', data: cum, borderColor: accent, backgroundColor: bg, tension:0.3, fill:true }]
    },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ color:getVar('--text') } }, y:{ ticks:{ color:getVar('--text') } } } }
  });
};

const refreshCharts = (forList = transactions) => { buildPie(forList); buildLine(forList); };

/* === Form submit === */
txForm && txForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = (txTitle.value || '').trim();
  const amount = parseFloat(txAmount.value);
  const type = txType.value;

  if (!title || isNaN(amount) || !type) return alert('Please enter title, amount and type.');

  const tx = { id: uid(), title, amount: Math.abs(amount), type, date: new Date().toISOString() };
  transactions.unshift(tx);
  save();

  txForm.reset();
  renderTransactions();
});

/* === Filters, clear === */
searchInput && searchInput.addEventListener('input', renderTransactions);
typeFilter && typeFilter.addEventListener('change', renderTransactions);

clearAllBtn && clearAllBtn.addEventListener('click', () => {
  if (!transactions.length) return alert('No transactions to clear.');
  if (confirm('Clear all transactions? This cannot be undone.')) {
    transactions = [];
    save();
    renderTransactions();
  }
});

/* === CSV export === */
exportCSVBtn && exportCSVBtn.addEventListener('click', () => {
  if (!transactions.length) return alert('No transactions to export.');
  const rows = [['id','title','amount','type','date'], ...transactions.map(t => [t.id,t.title,t.amount,t.type,t.date])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'transactions.csv'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

/* === PDF export === */
exportPDFBtn && exportPDFBtn.addEventListener('click', async () => {
  if (!transactions.length) return alert('No transactions to export.');
  try {
    const exportArea = document.getElementById('exportArea');
    const canvas = await html2canvas(exportArea, { scale: 2, useCORS:true });
    const img = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','mm','a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(img);
    const imgW = pageW - 20;
    const imgH = (imgProps.height * imgW) / imgProps.width;
    pdf.addImage(img,'PNG',10,10,imgW,imgH);
    pdf.save('expense_tracker.pdf');
  } catch (err) {
    console.error(err);
    alert('Failed to export PDF. Try again.');
  }
});

/* === Newsletter modal === */
const showModal = (title='🎉 Thank you for subscribing!', message='You’ve joined the Expense Tracker tips list. Look out for helpful emails soon.') => {
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  if (modalTitle) modalTitle.textContent = title;
  if (modalMessage) modalMessage.textContent = message;

  modalOverlay.classList.add('visible');
  modalOverlay.setAttribute('aria-hidden','false');

  if (modalTimer) clearTimeout(modalTimer);
  modalTimer = setTimeout(() => closeModal(), 8000);
};

const closeModal = () => {
  modalOverlay.classList.remove('visible');
  modalOverlay.setAttribute('aria-hidden','true');
  if (modalTimer) { clearTimeout(modalTimer); modalTimer = null; }
};

modalCloseX && modalCloseX.addEventListener('click', closeModal);
modalCloseBtn && modalCloseBtn.addEventListener('click', closeModal);

newsletterForm && newsletterForm.addEventListener('submit', e => {
  e.preventDefault();
  const email = (newsletterEmail.value || '').trim();
  if (!email) return alert('Please enter a valid email address.');

  newsletterForm.reset();
  showModal('Thank you for subscribing!', `You’ve been added. We’ll send useful tips and updates to ${email}.`);
});

/* === Fade-up reveal === */
const toReveal = document.querySelectorAll('.fade-up');
if (toReveal.length) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  toReveal.forEach(n => io.observe(n));
}

/* === Init === */
(() => {
  loadTheme();
  initCustomDropdowns();
  renderTransactions();

  const header = document.querySelector('header');
  if (header) {
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.zIndex = '1000';
  }
})();

/* === Edit & Delete Handlers === */
function handleDelete(id) {
  const numericId = Number(id);

  const confirmed = confirm('Are you sure you want to delete this transaction?');
  if (!confirmed) return;

  transactions = transactions.filter(t => t.id !== numericId);
  save();
  renderTransactions();
  renderTransactionsTable?.(); 
}
function handleEdit(id) {
  const numericId = Number(id);
  const tx = transactions.find(t => t.id === numericId);
  if (!tx) return alert('Transaction not found.');
  const newTitle = prompt('Edit Title:', tx.title);
  if (newTitle === null) return; 
  const newAmountStr = prompt('Edit Amount:', tx.amount);
  if (newAmountStr === null) return; 
  const newAmount = parseFloat(newAmountStr);
  if (isNaN(newAmount) || newAmount <= 0) return alert('Please enter a valid amount.');
  const newType = prompt('Edit Type (income/expense):', tx.type);
  if (newType === null) return; 
  if (newType !== 'income' && newType !== 'expense') return alert('Type must be either "income" or "expense".');
  tx.title = newTitle.trim();
  tx.amount = Math.abs(newAmount);
  tx.type = newType;
  save();
  renderTransactions();
  renderTransactionsTable?.(); 
}