const STORAGE_KEY = 'pft_transactions_v1';
const THEME_KEY = 'pft_theme_v1';

/* DOM refs */
const balanceValue = document.getElementById('balanceValue');
const incomeValue = document.getElementById('incomeValue');
const expenseValue = document.getElementById('expenseValue');

const categoryCtx = document.getElementById('categoryChart').getContext('2d');
const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');

const transactionsTableBody = document.querySelector('#transactionsTable tbody');

const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter'); // hidden select inside custom-dropdown

const exportCSVBtn = document.getElementById('exportCSV');
const exportPDFBtn = document.getElementById('exportPDF');
const clearAllBtn = document.getElementById('clearAll');
const refreshBtn = document.getElementById('refreshBtn');

const themeToggle = document.getElementById('themeToggle');

const newsletterForm = document.getElementById('newsletterForm');
const newsletterEmail = document.getElementById('newsletterEmail');

const modalOverlay = document.getElementById('modalOverlay');
const modalCloseX = document.getElementById('modalCloseX');
const modalCloseBtn = document.getElementById('modalClose');

let pieChart = null;
let lineChart = null;
let modalTimer = null;

/* Load transactions from localStorage */
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

/* Helpers */
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

/* Custom dropdown initializer (same behavior as York) */
function initCustomDropdowns() {
  document.querySelectorAll('.custom-dropdown').forEach(drop => {
    const selected = drop.querySelector('.dropdown-selected');
    const list = drop.querySelector('.dropdown-list');
    const hiddenSelect = drop.querySelector('select');
    const items = list.querySelectorAll('li');

    drop.addEventListener('click', e => {
      if (e.target.tagName.toLowerCase() !== 'li') {
        document.querySelectorAll('.custom-dropdown').forEach(d => {
          if (d !== drop) d.classList.remove('open');
        });
        drop.classList.toggle('open');
      }
    });

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

    document.addEventListener('click', e => {
      if (!drop.contains(e.target)) drop.classList.remove('open');
    });
  });
}

/* Theme handling */
const applyTheme = theme => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌗';
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

/* Summary update */
function updateSummary(list = transactions) {
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  incomeValue.textContent = formatNaira(income);
  expenseValue.textContent = formatNaira(expense);
  balanceValue.textContent = formatNaira(balance);

  incomeValue.style.color = income > 0 ? 'var(--income)' : 'var(--muted)';
  expenseValue.style.color = expense > 0 ? 'var(--expense)' : 'var(--muted)';
  balanceValue.style.color = balance > 0 ? 'var(--accent)' : (balance < 0 ? 'var(--expense)' : 'var(--text)');
}

/* Build category */
function buildCategoryChart(list = transactions) {
  const categories = {};
  list.forEach(t => {
    const key = t.type === 'income' ? 'Income' : 'Expense';
    categories[key] = (categories[key] || 0) + Number(t.amount);
  });

  const labels = Object.keys(categories);
  const data = labels.map(l => categories[l]);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(categoryCtx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: ['#ef4444', '#10b981'] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } } } }
  });
}

/* Build monthly cumulative line chart (last 8 months) */
function buildMonthlyChart(list = transactions) {
  const map = {};
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0,7);
    map[key] = map[key] || 0;
  }

  list.forEach(t => {
    const key = (t.date || '').slice(0,7);
    if (!key) return;
    map[key] = (map[key] || 0) + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
  });

  const keys = Object.keys(map).sort();
  let running = 0;
  const cum = keys.map(k => { running += Math.round((map[k] || 0) * 100) / 100; return running; });

  if (lineChart) lineChart.destroy();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c3aed';
  // compute rgba bg
  let bg = 'rgba(124,58,237,0.12)';
  try {
    const hex = accent.replace(/\s/g,'');
    if (hex[0] === '#') {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      bg = `rgba(${r},${g},${b},0.12)`;
    }
  } catch(e){}

  lineChart = new Chart(monthlyCtx, {
    type: 'line',
    data: {
      labels: keys.map(k => { const [y,m] = k.split('-'); return new Date(y, m-1, 1).toLocaleString('default', { month: 'short', year: 'numeric' }); }),
      datasets: [{ label: 'Cumulative', data: cum, borderColor: accent, backgroundColor: bg, tension: 0.3, fill: true }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } }, y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } } } }
  });
}

/* Render transactions table using current filters */
function renderTransactionsTable() {
  const q = (searchInput.value || '').trim().toLowerCase();
  const ft = (typeFilter && typeFilter.value) ? typeFilter.value : 'all';
  transactionsTableBody.innerHTML = '';

  const filtered = transactions.filter(t => {
    const matchesQ = !q || (t.title && t.title.toLowerCase().includes(q));
    const matchesType = ft === 'all' || t.type === ft;
    return matchesQ && matchesType;
  });

  if (!filtered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="padding:12px;color:var(--muted)">No transactions found.</td>`;
    transactionsTableBody.appendChild(tr);
    updateSummary([]);
    buildCategoryChart([]);
    buildMonthlyChart([]);
    return;
  }

  filtered.forEach(t => {
    const tr = document.createElement('tr');
    const date = new Date(t.date).toLocaleString();
    const typeBadge = `<span class="badge ${t.type}">${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</span>`;
    tr.innerHTML = `
      <td style="padding:10px 6px">${date}</td>
      <td style="padding:10px 6px">${t.title}</td>
      <td style="padding:10px 6px">${typeBadge}</td>
      <td style="padding:10px 6px;font-weight:700">${formatNaira(t.amount)}</td>
    `;
    transactionsTableBody.appendChild(tr);
  });

  updateSummary(filtered);
  buildCategoryChart(filtered);
  buildMonthlyChart(filtered);
}

/* Exports */
function exportCSV(all = true) {
  const rows = [['id','title','amount','type','date'], ...transactions.map(t => [t.id,t.title,t.amount,t.type,t.date])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'transactions.csv'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function exportPDF() {
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
    pdf.save('reports.pdf');
  } catch (err) {
    console.error(err);
    alert('Failed to export PDF. Try again.');
  }
}

/* Newsletter modal (same behavior) */
const showModal = (title='Thank you for subscribing!', message='You’ve joined the Expense Tracker tips list. Look out for helpful emails soon.') => {
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

/* Wire up controls */
searchInput && searchInput.addEventListener('input', renderTransactionsTable);
typeFilter && typeFilter.addEventListener('change', renderTransactionsTable);

exportCSVBtn && exportCSVBtn.addEventListener('click', () => {
  if (!transactions.length) return alert('No transactions to export.');
  exportCSV();
});

exportPDFBtn && exportPDFBtn.addEventListener('click', () => {
  if (!transactions.length) return alert('No transactions to export.');
  exportPDF();
});

clearAllBtn && clearAllBtn.addEventListener('click', () => {
  if (!transactions.length) return alert('No transactions to clear.');
  if (confirm('Clear all transactions? This cannot be undone.')) {
    transactions = [];
    save();
    renderTransactionsTable();
  }
});

refreshBtn && refreshBtn.addEventListener('click', () => {
  renderTransactionsTable();
});

/* Newsletter subscribe front-end */
newsletterForm && newsletterForm.addEventListener('submit', e => {
  e.preventDefault();
  const email = (newsletterEmail.value || '').trim();
  if (!email) return alert('Please enter an email address.');
  newsletterForm.reset();
  showModal('Thank you for subscribing!', `We’ll send tips & updates to ${email}.`);
});

/* Fade-up reveal (same as York) */
const toReveal = document.querySelectorAll('.fade-up');
if (toReveal.length) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  toReveal.forEach(n => io.observe(n));
}

/* Init */
(() => {
  loadTheme();
  initCustomDropdowns();
  renderTransactionsTable();

  // sticky header safety
  const header = document.querySelector('header');
  if (header) {
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.zIndex = '1000';
  }
})();

const hamburger = document.querySelector('.hamburger:not(.sidebar-close)');
const sidebar = document.querySelector('.sidebar');
const sidebarClose = document.querySelector('.sidebar-close');

// Toggle sidebar & hamburger
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  sidebar.classList.toggle('active');
});

// Also allow closing via X inside sidebar
sidebarClose.addEventListener('click', () => {
  sidebar.classList.remove('active');
  hamburger.classList.remove('open');
});

// Optional: close sidebar when clicking outside
document.addEventListener('click', e => {
  if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
    sidebar.classList.remove('active');
    hamburger.classList.remove('open');
  }
});