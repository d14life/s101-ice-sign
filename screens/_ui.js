/* Общий слой интерактива для экранов 31–54.
   Экраны остаются статическими файлами: ни сети, ни хранилища —
   перезагрузка возвращает исходное состояние. Поведение задаётся
   конфигурацией на номер экрана, разметку почти не трогаем.

   pick   — группа, где выбран ровно один элемент (вкладки, чипы, сегменты)
   multi  — группа, где элементы включаются независимо (галочки)
   sort   — таблица, которую можно сортировать щелчком по заголовку
   filter — группа, которая прячет часть карточек или строк
   extra  — то, что считается: калькуляторы и подсветка связей          */

(() => {
  // В собранной одностраничной версии экран живёт в srcdoc-фрейме,
  // где location бесполезен — там номер приходит атрибутом на body.
  const SCREEN = document.body?.dataset.screen
    || (location.pathname.match(/\/(\d+)-/) || [])[1] || '';

  const CONFIG = {
    31: { pick: ['.seg'] },
    32: { sort: ['table'] },
    33: { pick: ['.stats'] },
    34: { sort: [] },
    35: { sort: ['table'] },
    36: { pickChild: ['.list'] },
    37: { sort: ['table'] },
    38: { sort: ['table'] },
    39: { pickChild: ['.strip'] },
    40: { pickChild: ['.flow'], sort: [] },
    41: { pick: ['.chips'], toggle: ['aside .f'], filter: { group: '.chips', items: '.grid .card' } },
    42: { pick: ['.filters'], sort: ['table'], filter: { group: '.filters', items: 'table tr[data-cat]' } },
    43: { pick: ['.sel'], filter: { group: '.sel', items: '.tray .item' } },
    44: { extra: 'calcCleaning' },
    45: { pick: ['.tabs'], extra: 'pickFlat' },
    46: { toggle: ['aside .ck'], filter: { group: 'aside .fg', items: '.list .ad' } },
    47: { pick: ['.tabs', '.days', '.times', '.guests', '.zone'], filter: { group: '.tabs', items: '.menu .dish' }, extra: 'bookTable' },
    48: { pick: ['.chips'], filter: { group: '.chips', items: '.grid .c' } },
    49: { pickChild: ['.feed'] },
    50: { extra: 'calcCar' },
    51: { multi: ['.chk'], toggle: ['.pills .pill'], sort: ['table'], filter: { group: '.pills', items: 'table tr[data-cat]' } },
    52: { pickChild: ['.lanes'] },
    53: { pick: ['.period'], pickChild: ['.mods'], sort: ['table'] },
    54: { extra: 'ecoHighlight' },
  };
  const C = CONFIG[SCREEN] || {};

  const kids = (g) => [...g.children].filter((n) => n.nodeType === 1);
  const owner = (g, t) => kids(g).find((ch) => ch === t || ch.contains(t));
  const on = (el) => el && el.classList.contains('on');

  /* --- выбор одного из группы ------------------------------------- */
  const bindPick = (g, cb) => {
    if (!g || g.dataset.uiBound) return;
    g.dataset.uiBound = '1';
    kids(g).forEach((k) => (k.style.cursor = 'pointer'));
    g.addEventListener('click', (e) => {
      const it = owner(g, e.target);
      if (!it || it.classList.contains('no') || it.classList.contains('nope')) return;
      kids(g).forEach((k) => k.classList.remove('on'));
      it.classList.add('on');
      cb && cb(it, g);
    });
  };

  /* --- независимые переключатели ---------------------------------- */
  const bindMulti = (g, cb) => {
    if (!g || g.dataset.uiBound) return;
    g.dataset.uiBound = '1';
    kids(g).forEach((k) => (k.style.cursor = 'pointer'));
    g.addEventListener('click', (e) => {
      const it = owner(g, e.target);
      if (!it) return;
      it.classList.toggle('on');
      cb && cb(it, g);
    });
  };

  /* --- сортировка таблицы ----------------------------------------- */
  const num = (s) => {
    const t = String(s).replace(/ |\s/g, '').replace(/[₽%]/g, '').replace(',', '.');
    const m = t.match(/^[-−+]?\d+(\.\d+)?$/);
    return m ? parseFloat(t.replace('−', '-')) : null;
  };
  const bindSort = (table) => {
    const head = table.querySelector('tr:has(th)') || table.querySelector('tr');
    if (!head || !head.querySelector('th') || table.dataset.uiBound) return;
    table.dataset.uiBound = '1';
    const ths = [...head.querySelectorAll('th')];
    ths.forEach((th, i) => {
      if (!th.textContent.trim()) return;
      th.style.cursor = 'pointer';
      th.title = 'Сортировать';
      th.addEventListener('click', () => {
        const rows = [...table.querySelectorAll('tr')].filter((r) => r !== head && r.querySelector('td'));
        const grp = rows.filter((r) => r.querySelector('td[colspan]'));
        if (grp.length) return;                       // таблицы с группами не сортируем
        const dir = th.dataset.dir === 'asc' ? -1 : 1;
        ths.forEach((o) => (o.dataset.dir = ''));
        th.dataset.dir = dir === 1 ? 'asc' : 'desc';
        rows.sort((a, b) => {
          const x = a.cells[i]?.innerText.trim() ?? '';
          const y = b.cells[i]?.innerText.trim() ?? '';
          const nx = num(x), ny = num(y);
          if (nx !== null && ny !== null) return (nx - ny) * dir;
          return x.localeCompare(y, 'ru') * dir;
        });
        const parent = rows[0].parentNode;
        rows.forEach((r) => parent.appendChild(r));
      });
    });
  };

  /* --- фильтрация карточек и строк -------------------------------- */
  const bindFilter = (cfg) => {
    const groups = [...document.querySelectorAll(cfg.group)];
    const items = [...document.querySelectorAll(cfg.items)];
    if (!groups.length || !items.length) return;
    const apply = () => {
      // Внутри группы условия складываются по «или», между группами — по «и»:
      // «магазин или частник» И «с доставкой» — так фильтр и понимают.
      const sets = groups.map((g) => {
        const s = new Set();
        kids(g).forEach((k) => { if (on(k) && k.dataset.cat) k.dataset.cat.split(' ').forEach((c) => s.add(c)); });
        s.delete('all');
        return s;
      }).filter((s) => s.size);
      items.forEach((it) => {
        const cats = (it.dataset.cat || '').split(' ').filter(Boolean);
        const show = sets.every((s) => cats.some((c) => s.has(c)));
        it.style.display = show ? '' : 'none';
      });
      const n = items.filter((i) => i.style.display !== 'none').length;
      document.querySelectorAll('[data-count]').forEach((el) => (el.textContent = el.dataset.count.replace('%', n)));
    };
    // Обработчик выбора навешен раньше и на тот же узел, поэтому к моменту
    // всплытия классы уже переставлены — ждать нечего.
    groups.forEach((g) => g.addEventListener('click', apply));
    apply();
  };

  /* --- калькулятор уборки (44) ------------------------------------ */
  const calcCleaning = () => {
    const rate = { 'Поддерживающая': 70, 'Генеральная': 110, 'После ремонта': 160 };
    const extra = { 'Окна': 1200, 'Холодильник': 700, 'Балкон': 900 };
    const bath = { '1': 0, '2': 900, '3': 1800, '4+': 2700 };
    const groups = [...document.querySelectorAll('.calc .opt')];
    const track = document.querySelector('.track');
    const marks = document.querySelectorAll('.mk span');
    const total = document.querySelector('.total b');
    const label = document.querySelector('.total span');
    let area = 64;

    const sel = (g) => kids(g).find(on)?.textContent.trim() || '';
    const recalc = () => {
      const type = sel(groups[0]);
      const nb = sel(groups[1]);
      const dops = kids(groups[2]).filter(on).map((k) => k.textContent.trim());
      let sum = area * (rate[type] || 110) + (bath[nb] ?? 900);
      dops.forEach((d) => (sum += extra[d] || 0));
      sum = Math.round(sum / 10) * 10;
      total.textContent = sum.toLocaleString('ru-RU') + ' ₽';
      label.innerHTML = 'Итого за уборку<br>' + area + ' м² · ' + (nb || '2') + ' санузла'
        + (dops.length ? ' · ' + dops.join(', ').toLowerCase() : '');
      if (marks[1]) marks[1].textContent = area + ' м²';
    };
    groups.forEach((g, i) => (i === 2 ? bindMulti(g, recalc) : bindPick(g, recalc)));
    if (track) {
      track.style.cursor = 'pointer';
      track.addEventListener('click', (e) => {
        const r = track.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        area = Math.round(20 + p * 130);
        track.querySelector('i').style.width = (p * 100).toFixed(1) + '%';
        track.querySelector('b').style.left = (p * 100).toFixed(1) + '%';
        recalc();
      });
    }
    recalc();
  };

  /* --- конфигуратор автомобиля (50) ------------------------------- */
  const calcCar = () => {
    // Цена комплектации — с базовым мотором 1.6; двигатель добавляется строкой.
    // Prestige 2 880 000 + 310 000 за 2.0 = те самые 3 190 000 из прайса.
    const base = { Base: 2080000, Comfort: 2430000, Prestige: 2880000, Max: 3280000 };
    const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';
    const price = (el) => {
      const m = (el.querySelector('u')?.textContent || '').replace(/\s| /g, '').match(/([-−+]?\d+)/);
      return m ? parseInt(m[1].replace('−', '-'), 10) : 0;
    };
    const trim = document.querySelector('.trim');
    const groups = [...document.querySelectorAll('.grp')];
    const engines = groups[0] ? kids(groups[0]) : [];
    const opts = groups[1] ? kids(groups[1]) : [];
    const sum = document.querySelector('.sum');
    const tot = document.querySelector('.tot b');
    const totSub = document.querySelector('.tot span:last-child');
    const COLOUR = 64000, TRADE = -410000, CREDIT = -120000;

    const render = () => {
      const t = kids(trim).find(on)?.textContent.trim() || 'Prestige';
      const eng = engines.find(on);
      const chosen = opts.filter((o) => on(o) && !o.classList.contains('no'));
      const rows = [[`Кроссовер ${t}`, base[t] || 2880000]];
      if (eng && price(eng) > 0) rows.push([eng.querySelector('b').textContent.trim(), price(eng)]);
      rows.push(['Изумрудный металлик', COLOUR]);
      chosen.forEach((o) => rows.push([o.querySelector('b').textContent.trim(), price(o)]));
      const goods = rows.reduce((a, r) => a + r[1], 0);
      const total = goods + TRADE + CREDIT;

      sum.querySelectorAll('.sr').forEach((n) => n.remove());
      const tot_ = sum.querySelector('.tot');
      rows.forEach(([n, v]) => {
        const d = document.createElement('div');
        d.className = 'sr';
        d.innerHTML = `<span>${n}</span><b>${rub(v)}</b>`;
        sum.insertBefore(d, tot_);
      });
      [['Trade-in, оценка авто', TRADE], ['Скидка при кредите', CREDIT]].forEach(([n, v]) => {
        const d = document.createElement('div');
        d.className = 'sr neg';
        d.innerHTML = `<span>${n}</span><b>−${rub(Math.abs(v))}</b>`;
        sum.insertBefore(d, tot_);
      });
      tot.textContent = rub(total);
      if (totSub) totSub.textContent = 'или от ' + rub(Math.round(total * 0.8 / 60 / 100) * 100)
        + ' в месяц · первый взнос 20 %, 5 лет';
    };

    bindPick(trim, render);
    if (groups[0]) bindPick(groups[0], render);
    if (groups[1]) {
      bindMulti(groups[1], render);
      opts.filter((o) => o.classList.contains('no')).forEach((o) => (o.style.cursor = 'not-allowed'));
      groups[1].addEventListener('click', (e) => {
        const it = owner(groups[1], e.target);
        if (it && it.classList.contains('no')) it.classList.remove('on');
      });
    }
    const sw = document.querySelector('.swatches');
    if (sw) bindPick(sw, render);
    render();
  };

  /* --- выбор квартиры в шахматке (45) ----------------------------- */
  const pickFlat = () => {
    const cells = [...document.querySelectorAll('.u.sale, .u.free, .u.pick')];
    const lab = document.querySelector('.right .lab');
    cells.forEach((c) => (c.style.cursor = 'pointer'));
    document.querySelector('.floors')?.addEventListener('click', (e) => {
      const c = e.target.closest('.u');
      if (!c || c.classList.contains('sold')) return;
      cells.forEach((x) => x.classList.remove('pick'));
      c.classList.add('pick');
      const row = c.closest('.fr');
      const floor = row?.previousElementSibling?.textContent.trim() || '';
      const idx = [...row.children].indexOf(c) + 1;
      if (lab) lab.textContent = `Квартира ${floor}-${String(idx).padStart(2, '0')}`;
    });
  };

  /* --- бронь стола (47) ------------------------------------------- */
  const bookTable = () => {
    const go = document.querySelector('.go');
    const guestWord = (g) => {
      const n = parseInt(g, 10);
      if (g.includes('+')) return g + ' гостей';
      if (n === 1) return '1 гость';
      return n + (n >= 2 && n <= 4 ? ' гостя' : ' гостей');
    };
    const upd = () => {
      const d = document.querySelector('.days .on')?.textContent.trim();
      const t = document.querySelector('.times .on')?.textContent.trim();
      const g = document.querySelector('.guests .on')?.textContent.trim();
      const z = document.querySelector('.zone .on')?.textContent.trim();
      if (!go || !d || !t) return;
      go.textContent = `Забронировать · ${d} сентября, ${t}`
        + (g ? ` · ${guestWord(g)}` : '') + (z ? ` · ${z.toLowerCase()}` : '');
    };
    // Выбор навешен раньше на те же узлы, поэтому классы уже переставлены.
    ['.days', '.times', '.guests', '.zone'].forEach((sel) => {
      document.querySelector(sel)?.addEventListener('click', upd);
    });
    upd();
  };

  /* --- подсветка связей в экосистеме (54) ------------------------- */
  const ecoHighlight = () => {
    const roles = document.querySelector('.band');
    const prods = [...document.querySelectorAll('.prod')];
    const MAP = { 0: [0, 4], 1: [1, 5], 2: [2], 3: [3], 4: [5], 5: [5, 1] };
    if (!roles) return;
    bindPick(roles, (item, g) => {
      const i = kids(g).indexOf(item);
      const keep = MAP[i] || [];
      prods.forEach((p, j) => (p.style.opacity = keep.includes(j) ? '1' : '.28'));
    });
    kids(roles).forEach((k) => (k.title = 'Показать, чем пользуется'));
    document.querySelector('.core')?.addEventListener('click', () => {
      kids(roles).forEach((k) => k.classList.remove('on'));
      prods.forEach((p) => (p.style.opacity = '1'));
    });
  };

  const EXTRA = { calcCleaning, calcCar, pickFlat, bookTable, ecoHighlight };

  /* --- запуск ------------------------------------------------------ */
  (C.pick || []).forEach((s) => document.querySelectorAll(s).forEach((g) => bindPick(g)));
  (C.multi || []).forEach((s) => document.querySelectorAll(s).forEach((g) => bindMulti(g)));
  (C.pickChild || []).forEach((s) => document.querySelectorAll(s).forEach((g) => bindPick(g)));
  (C.toggle || []).forEach((s) => document.querySelectorAll(s).forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => el.classList.toggle('on'));
  }));
  (C.sort || []).forEach((s) => document.querySelectorAll(s).forEach(bindSort));
  if (C.filter) bindFilter(C.filter);
  if (C.extra && EXTRA[C.extra]) { try { EXTRA[C.extra](); } catch (e) { console.warn('extra', C.extra, e); } }
})();
