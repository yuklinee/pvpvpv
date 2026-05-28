/* =========================================================
   PHYSICA · app.js  v3
   Список законов разбит на сворачиваемые группы.
   Группа определяется полем law.group ('1.14' | 'BETA' | …).
   ========================================================= */
(function () {
  'use strict';
  const { Laws, U } = window.Physica;

  const $ = (id) => document.getElementById(id);
  const lawList      = $('lawList');
  const lawCount     = $('lawCount');
  const lawTitle     = $('lawTitle');
  const lawDesc      = $('lawDesc');
  const lawFormula   = $('lawFormula');
  const lawIndex     = $('lawIndex');
  const controlsList = $('controlsList');
  const readoutEl    = $('readout');
  const canvas       = $('scene');
  const playBtn      = $('playBtn');
  const playIcon     = $('playIcon');
  const playLabel    = $('playLabel');
  const resetBtn     = $('resetBtn');
  const toggleSidebarBtn = $('toggleSidebar');
  const sidebar      = $('sidebar');

  const engine = new window.Physica.Engine(canvas);

  // ── Конфигурация внешнего вида групп ────────────────────────────
  const GROUP_META = {
    '1.14': { tagClass: 'law-group__tag--stable', label: '1.14' },
    'BETA':  { tagClass: 'law-group__tag--beta',   label: 'BETA'  },
  };

  // ── Построение списка с группами ────────────────────────────────
  const all    = Laws.all();
  const groups = Laws.groups();
  lawCount.textContent = String(all.length).padStart(2, '0');

  // Глобальный счётчик для сквозной нумерации законов
  let globalIdx = 0;

  groups.forEach((grp) => {
    const meta = GROUP_META[grp.id] || { tagClass: 'law-group__tag--stable', label: grp.id };

    // Корневой элемент группы
    const grpEl = document.createElement('li');
    grpEl.className = 'law-group';
    grpEl.dataset.group = grp.id;

    // Заголовок группы
    const hdr = document.createElement('div');
    hdr.className = 'law-group__header';
    hdr.setAttribute('role', 'button');
    hdr.setAttribute('tabindex', '0');
    hdr.innerHTML = `
      <span class="law-group__tag ${meta.tagClass}">${meta.label}</span>
      <span class="law-group__meta">
        <span class="law-group__count">${grp.laws.length} ${grp.laws.length === 1 ? 'закон' : grp.laws.length < 5 ? 'закона' : 'законов'}</span>
      </span>
      <span class="law-group__arrow">▼</span>`;
    grpEl.appendChild(hdr);

    // Тело группы — список законов
    const body = document.createElement('div');
    body.className = 'law-group__body';

    const ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;padding:0;margin:0';

    grp.laws.forEach((law) => {
      globalIdx++;
      const li = document.createElement('li');
      li.innerHTML = `
        <button class="law-item" data-id="${law.id}" role="tab">
          <span class="law-item__num">${String(globalIdx).padStart(2, '0')}</span>
          <span class="law-item__name">${law.title}</span>
          <span class="law-item__dot"></span>
        </button>`;
      ul.appendChild(li);
    });

    body.appendChild(ul);
    grpEl.appendChild(body);
    lawList.appendChild(grpEl);

    // BETA свёрнута по умолчанию
    if (grp.id === 'BETA') grpEl.classList.add('is-collapsed');

    // Сворачивание / разворачивание
    const toggle = () => grpEl.classList.toggle('is-collapsed');
    hdr.addEventListener('click', toggle);
    hdr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  // ── Выбор закона ────────────────────────────────────────────────
  function selectLaw(id) {
    const law = Laws.get(id);
    if (!law) return;
    // Глобальный порядковый номер
    const idx = all.findIndex(l => l.id === id);

    lawTitle.textContent   = law.title;
    lawDesc.textContent    = law.description || '';
    lawFormula.textContent = law.formula || '';
    lawIndex.textContent   = String(idx + 1).padStart(2, '0');

    // Бейдж группы рядом с индексом
    const badge = document.getElementById('lawGroupBadge');
    if (badge) {
      const meta = GROUP_META[law.group] || { tagClass: 'law-group__tag--stable', label: law.group || '' };
      badge.textContent  = meta.label;
      badge.className    = `law-group__tag ${meta.tagClass}`;
      badge.style.display = law.group ? '' : 'none';
    }

    document.querySelectorAll('.law-item').forEach(b => {
      b.classList.toggle('is-active', b.dataset.id === id);
    });

    engine.setLaw(law);
    buildControls(law);

    if (window.matchMedia('(max-width: 900px)').matches) {
      sidebar.classList.remove('is-open');
    }
  }

  // ── Форматирование числа для поля ввода ─────────────────────────
  function fmtInput(v, step) {
    if (step === undefined || step === null) return String(v);
    const d = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    return v.toFixed(d);
  }

  // ── Построение контролов ────────────────────────────────────────
  function buildControls(law) {
    controlsList.innerHTML = '';
    law.params.forEach((p, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'control';
      wrap.style.animationDelay = (i * 40) + 'ms';
      const unit = p.unit ? ` ${p.unit}` : '';

      if (p.type === 'toggle') {
        wrap.innerHTML = `
          <div class="control__head">
            <span class="control__label">${p.label || p.id}</span>
          </div>
          <label class="control__toggle">
            <input type="checkbox" data-id="${p.id}" ${p.value ? 'checked' : ''}/>
            <span class="toggle-box"></span>
            <span style="font-size:11px;color:var(--text-mute)">${p.value ? 'вкл' : 'выкл'}</span>
          </label>`;
        controlsList.appendChild(wrap);
        const cb  = wrap.querySelector('input[type=checkbox]');
        const lbl = wrap.querySelector('label span:last-child');
        cb.addEventListener('change', () => {
          const v = cb.checked ? 1 : 0;
          engine.setParam(p.id, v);
          lbl.textContent = v ? 'вкл' : 'выкл';
        });
        return;
      }

      if (p.type === 'select' && p.options) {
        wrap.innerHTML = `
          <div class="control__head">
            <span class="control__label">${p.latex ? '<em>' + p.latex + '</em>' : ''}${p.label || p.id}</span>
          </div>
          <select class="control__select" data-id="${p.id}">
            ${p.options.map(o => `<option value="${o.value}" ${o.value === p.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>`;
        controlsList.appendChild(wrap);
        const sel = wrap.querySelector('select');
        sel.addEventListener('change', () => {
          engine.setParam(p.id, isNaN(+sel.value) ? sel.value : +sel.value);
        });
        return;
      }

      // range: слайдер + числовое поле ввода
      const initFmt = fmtInput(p.value, p.step);
      wrap.innerHTML = `
        <div class="control__head">
          <span class="control__label">${p.latex ? '<em>' + p.latex + '</em>' : ''}${p.label || p.id}</span>
          <input class="control__value" type="number" id="val-${p.id}"
                 min="${p.min}" max="${p.max}" step="${p.step ?? 1}"
                 value="${initFmt}" title="Введите значение и нажмите Enter"/>
        </div>
        <input class="control__slider" type="range" data-id="${p.id}"
               min="${p.min}" max="${p.max}" step="${p.step ?? 1}" value="${p.value}"/>`;
      controlsList.appendChild(wrap);

      const slider = wrap.querySelector('.control__slider');
      const numEl  = wrap.querySelector('.control__value');

      const updateTrack = (val) => {
        const pct = ((val - p.min) / (p.max - p.min)) * 100;
        slider.style.setProperty('--p', pct + '%');
      };
      updateTrack(p.value);

      const applyValue = (raw) => {
        let v = parseFloat(raw);
        if (!isFinite(v)) {
          numEl.classList.add('is-error');
          setTimeout(() => numEl.classList.remove('is-error'), 400);
          numEl.value = fmtInput(+slider.value, p.step);
          return;
        }
        if (v < p.min) v = p.min;
        if (v > p.max) v = p.max;
        if (p.step) v = parseFloat((Math.round((v - p.min) / p.step) * p.step + p.min).toFixed(10));
        engine.setParam(p.id, v);
        slider.value = v;
        numEl.value  = fmtInput(v, p.step);
        updateTrack(v);
      };

      slider.addEventListener('input', () => {
        const v = +slider.value;
        engine.setParam(p.id, v);
        numEl.value = fmtInput(v, p.step);
        updateTrack(v);
      });
      numEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); applyValue(numEl.value); numEl.blur(); }
        if (e.key === 'Escape') { numEl.value = fmtInput(+slider.value, p.step); numEl.blur(); }
      });
      numEl.addEventListener('blur', () => applyValue(numEl.value));
      numEl.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    });
  }

  // ── Клик по закону в любой группе ───────────────────────────────
  lawList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    selectLaw(btn.dataset.id);
  });

  // ── Кнопки управления ───────────────────────────────────────────
  playBtn.addEventListener('click', () => {
    engine.running = !engine.running;
    playIcon.textContent  = engine.running ? '❚❚' : '▶';
    playLabel.textContent = engine.running ? 'Пауза' : 'Запустить';
  });
  resetBtn.addEventListener('click', () => {
    engine.resetParams();
    if (engine.law) buildControls(engine.law);
  });
  toggleSidebarBtn.addEventListener('click', () => sidebar.classList.toggle('is-open'));

  // ── Readout ─────────────────────────────────────────────────────
  let lastRO = 0;
  (function loop(ts) {
    if (ts - lastRO > 100 && engine.law && engine.state) {
      lastRO = ts;
      const lines = engine.law.readout ? engine.law.readout(engine.state) : [];
      readoutEl.innerHTML = lines.map(l =>
        `<div class="readout__line"><span class="readout__k">${l.k}</span><span class="readout__v">${l.v}</span></div>`
      ).join('');
    }
    requestAnimationFrame(loop);
  })(0);

  // ── Старт: бейдж группы в stage__index ──────────────────────────
  // Добавляем span для бейджа группы рядом с индексом
  const idxEl = $('lawIndex');
  const badgeEl = document.createElement('span');
  badgeEl.id = 'lawGroupBadge';
  badgeEl.style.display = 'none';
  idxEl.insertAdjacentElement('afterend', badgeEl);

  engine.start();
  if (all.length) selectLaw(all[0].id);
})();
