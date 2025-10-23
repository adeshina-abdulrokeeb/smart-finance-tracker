/* tips.js
   - Tips list, search, category filter (custom dropdown)
   - Favorites saved to localStorage under key: pft_tips_favs_v1
   - Uses same theme key pft_theme_v1 so theme toggles stay consistent
*/

const THEME_KEY = 'pft_theme_v1';
const FAV_KEY = 'pft_tips_favs_v1';

/* DOM refs */
const searchInput = document.getElementById('searchInput');
const tipCategory = document.getElementById('tipCategory'); // hidden select
const tipsGrid = document.getElementById('tipsGrid');
const popularList = document.getElementById('popularList');
const tipsCount = document.getElementById('tipsCount');
const favCount = document.getElementById('favCount');

const newsletterForm = document.getElementById('newsletterForm');
const newsletterEmail = document.getElementById('newsletterEmail');

const modalOverlay = document.getElementById('modalOverlay');
const modalCloseX = document.getElementById('modalCloseX');
const modalCloseBtn = document.getElementById('modalClose');

const themeToggle = document.getElementById('themeToggle');
const clearAllBtn = document.getElementById('clearAll');

/* sample tips data */
const tipsData = [
  { id: 't1', title: 'Create a weekly grocery budget', category: 'shopping', summary: 'Set a fixed weekly amount for groceries and stick to it.', content: 'Plan meals, buy in bulk where it makes sense, and shop with a list to avoid impulse purchases.' },
  { id: 't2', title: 'Pay yourself first', category: 'saving', summary: 'Treat savings like a regular expense.' , content: 'Automatically move a small percentage of income into savings right when you get paid.' },
  { id: 't3', title: 'Use envelopes for discretionary spending', category: 'budgeting', summary: 'Physical envelopes help control cash flow.', content: 'Allocate cash into envelopes for categories like dining out, entertainment — when it’s gone, it’s gone.' },
  { id: 't4', title: 'Round-up micro-savings', category: 'saving', summary: 'Save spare change automatically.', content: 'Use apps or bank features that round purchases up to the nearest naira and move the difference to savings.' },
  { id: 't5', title: 'Prioritize high-interest debt', category: 'debt', summary: 'Attack the debt that costs you the most.', content: 'List debts by interest rate and pay extra on the highest-rate account while maintaining minimums on others.' },
  { id: 't6', title: 'Buy generics when possible', category: 'shopping', summary: 'Generics often match brand quality at lower cost.', content: 'Compare active ingredients and packaging — many generics have the same formulation.' },
  { id: 't7', title: 'Start small with investing', category: 'investing', summary: 'Regular small investments compound over time.', content: 'Set up an automated monthly contribution — consistency matters more than amount at the start.' },
];

/* load favorites */
let favorites = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');

/* helpers */
function saveFavs() { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); }
function isFav(id) { return favorites.includes(id); }

/* Custom dropdown initializer (same as York) */
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
        if (hiddenSelect) {
          hiddenSelect.value = val;
          hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        drop.classList.remove('open');
      });
    });

    document.addEventListener('click', e => {
      if (!drop.contains(e.target)) drop.classList.remove('open');
    });
  });
}

/* Theme handling (same keystore) */
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

/* Render tips grid */
function renderTips() {
  const q = (searchInput.value || '').trim().toLowerCase();
  const cat = (tipCategory && tipCategory.value) ? tipCategory.value : 'all';
  tipsGrid.innerHTML = '';

  const filtered = tipsData.filter(t => {
    const matchesQ = !q || t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.content.toLowerCase().includes(q);
    const matchesCat = cat === 'all' || t.category === cat;
    return matchesQ && matchesCat;
  });

  tipsCount.textContent = filtered.length;
  favCount.textContent = favorites.length;

  if (!filtered.length) {
    const el = document.createElement('div');
    el.style.color = 'var(--muted)';
    el.style.padding = '12px';
    el.textContent = 'No tips found.';
    tipsGrid.appendChild(el);
    return;
  }

  filtered.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tip-card';
    card.innerHTML = `
      <div class="tip-icon">${t.title.split(' ').map(s=>s[0]).slice(0,2).join('')}</div>
      <div class="tip-body">
        <div class="tip-title">${t.title}</div>
        <div class="tip-meta"><span class="badge ${t.category}">${t.category}</span> · ${t.summary}</div>
        <div class="tip-actions">
          <button class="btn ghost btn-read" data-id="${t.id}">Read</button>
          <button class="btn-fav ${isFav(t.id) ? 'active' : ''}" data-id="${t.id}" aria-label="Favorite tip">${isFav(t.id) ? '♥' : '♡'}</button>
        </div>
      </div>
    `;
    tipsGrid.appendChild(card);
  });

  // attach handlers
  document.querySelectorAll('.btn-read').forEach(b => {
    b.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      const tip = tipsData.find(x => x.id === id);
      if (!tip) return;
      const modalTitle = document.getElementById('modalTitle');
      const modalMessage = document.getElementById('modalMessage');
      modalTitle.textContent = tip.title;
      modalMessage.textContent = tip.content;
      modalOverlay.classList.add('visible');
      modalOverlay.setAttribute('aria-hidden','false');
    });
  });

  document.querySelectorAll('.btn-fav').forEach(b => {
    b.addEventListener('click', e => {
      const id = e.currentTarget.dataset.id;
      if (isFav(id)) {
        favorites = favorites.filter(f => f !== id);
        e.currentTarget.classList.remove('active');
        e.currentTarget.textContent = '♡';
      } else {
        favorites.push(id);
        e.currentTarget.classList.add('active');
        e.currentTarget.textContent = '♥';
      }
      saveFavs();
      favCount.textContent = favorites.length;
    });
  });

  renderPopular();
}

/* Render popular topics (simple aggregation) */
function renderPopular() {
  const counts = {};
  tipsData.forEach(t => counts[t.category] = (counts[t.category]||0)+1);
  const keys = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  popularList.innerHTML = '';
  keys.forEach(k => {
    const el = document.createElement('div');
    el.className = 'popular-item';
    el.innerHTML = `<div style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.04)">${k[0].toUpperCase()}</div>
      <div style="flex:1"><strong style="display:block">${k}</strong><small style="color:var(--muted)">${counts[k]} tips</small></div>`;
    popularList.appendChild(el);
  });
}

/* modal close logic */
const closeModal = () => {
  modalOverlay.classList.remove('visible');
  modalOverlay.setAttribute('aria-hidden','true');
};
modalCloseX && modalCloseX.addEventListener('click', closeModal);
modalCloseBtn && modalCloseBtn.addEventListener('click', closeModal);
document.addEventListener('click', e => {
  const overlay = document.getElementById('modalOverlay');
  if (overlay && overlay.classList.contains('visible') && e.target === overlay) closeModal();
});

/* newsletter */
newsletterForm && newsletterForm.addEventListener('submit', e => {
  e.preventDefault();
  const email = (newsletterEmail.value || '').trim();
  if (!email) return alert('Please enter an email address.');
  newsletterForm.reset();
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  modalTitle.textContent = 'Thank you for subscribing!';
  modalMessage.textContent = `We’ll send tips & updates to ${email}.`;
  modalOverlay.classList.add('visible');
  modalOverlay.setAttribute('aria-hidden','false');
});

/* clear favorites (header clear) */
clearAllBtn && clearAllBtn.addEventListener('click', () => {
  if (!favorites.length) return alert('No favorites to clear.');
  if (!confirm('Clear all favorites?')) return;
  favorites = [];
  saveFavs();
  renderTips();
});

/* wire inputs */
searchInput && searchInput.addEventListener('input', renderTips);
tipCategory && tipCategory.addEventListener('change', renderTips);

/* Fade-up reveal (reused) */
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

/* init */
(() => {
  loadTheme();
  initCustomDropdowns();
  renderTips();
  // header sticky safety
  const header = document.querySelector('header');
  if (header) {
    header.style.position = 'sticky';
    header.style.top = '0';
    header.style.zIndex = '1000';
  }
})();
