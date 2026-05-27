/* =========================================================
   PHYSICA · app.js
   Связь UI с движком: список законов, контролы, readout, кнопки.
   v2: поле значения — редактируемый <input type="number">.
       При потере фокуса значение клампируется к [min, max].
       Слайдер и поле синхронизированы двусторонне.
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

  // ── Список законов ──────────────────────────────────────────────
  const all = Laws.all();
  lawCount.textContent = String(all.length).padStart(2, '0');
  all.forEach((law, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="law-item" data-id="${law.id}" role="tab">
        <span class="law-item__num">${String(i + 1).padStart(2, '0')}</span>
        <span class="law-item__name">${law.title}</span>
        <span class="law-item__dot"></span>
      </button>`;
    lawList.appendChild(li);
  });

  // ── Загрузка закона ─────────────────────────────────────────────
  function selectLaw(id) {
    const law = Laws.get(id);
    if (!law) return;
    const idx = all.findIndex(l => l.id === id);
    lawTitle.textContent   = law.title;
    lawDesc.textContent    = law.description || '';
    lawFormula.textContent = law.formula || '';
    lawIndex.textContent   = String(idx + 1).padStart(2, '0');
    document.querySelectorAll('.law-item').forEach(b => {
      b.classList.toggle('is-active', b.dataset.id === id);
    });
    engine.setLaw(law);
    buildControls(law);
    if (window.matchMedia('(max-width: 900px)').matches) {
      sidebar.classList.remove('is-open');
    }
  }

  // ── Утилита: форматирование значения для поля ввода ─────────────
  function fmtInput(v, step) {
    if (step === undefined || step === null) return String(v);
    const digits = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    return v.toFixed(digits);
  }

  // ── Построение контролов ────────────────────────────────────────
  function buildControls(law) {
    controlsList.innerHTML = '';
    law.params.forEach((p, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'control';
      wrap.style.animationDelay = (i * 40) + 'ms';
      const unit = p.unit ? ` ${p.unit}` : '';

      // ---- toggle ------------------------------------------------
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

      // ---- select ------------------------------------------------
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

      // ---- range (слайдер + числовое поле) -----------------------
      const initFmt = fmtInput(p.value, p.step);
      wrap.innerHTML = `
        <div class="control__head">
          <span class="control__label">${p.latex ? '<em>' + p.latex + '</em>' : ''}${p.label || p.id}</span>
          <input class="control__value"
                 type="number"
                 id="val-${p.id}"
                 min="${p.min}" max="${p.max}" step="${p.step ?? 1}"
                 value="${initFmt}"
                 title="Введите значение и нажмите Enter"/>
        </div>
        <input class="control__slider" type="range"
               data-id="${p.id}"
               min="${p.min}" max="${p.max}" step="${p.step ?? 1}" value="${p.value}"/>`;

      controlsList.appendChild(wrap);

      const slider  = wrap.querySelector('.control__slider');
      const numEl   = wrap.querySelector('.control__value');

      // Обновление градиента трека слайдера
      const updateTrack = (val) => {
        const pct = ((val - p.min) / (p.max - p.min)) * 100;
        slider.style.setProperty('--p', pct + '%');
      };
      updateTrack(p.value);

      // Применить значение (клампировать, обновить всё)
      const applyValue = (raw) => {
        let v = parseFloat(raw);
        if (!isFinite(v)) {
          // Мигаем красным и возвращаем предыдущее значение
          numEl.classList.add('is-error');
          setTimeout(() => numEl.classList.remove('is-error'), 400);
          numEl.value = fmtInput(+slider.value, p.step);
          return;
        }
        // Клампирование к допустимому диапазону
        if (v < p.min) v = p.min;
        if (v > p.max) v = p.max;
        // Снапинг к шагу
        if (p.step) {
          v = Math.round((v - p.min) / p.step) * p.step + p.min;
          v = parseFloat(v.toFixed(10)); // убираем float-мусор
        }
        engine.setParam(p.id, v);
        slider.value  = v;
        numEl.value   = fmtInput(v, p.step);
        updateTrack(v);
      };

      // Слайдер → обновляет поле
      slider.addEventListener('input', () => {
        const v = +slider.value;
        engine.setParam(p.id, v);
        numEl.value = fmtInput(v, p.step);
        updateTrack(v);
      });

      // Поле ввода: Enter или потеря фокуса → применяем
      numEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyValue(numEl.value); numEl.blur(); }
        if (e.key === 'Escape') { numEl.value = fmtInput(+slider.value, p.step); numEl.blur(); }
      });
      numEl.addEventListener('blur', () => applyValue(numEl.value));

      // Не даём колесу мыши над числом случайно крутить страницу
      numEl.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    });
  }

  // ── Кнопки ──────────────────────────────────────────────────────
  playBtn.addEventListener('click', () => {
    engine.running = !engine.running;
    playIcon.textContent  = engine.running ? '❚❚' : '▶';
    playLabel.textContent = engine.running ? 'Пауза' : 'Запустить';
  });

  resetBtn.addEventListener('click', () => {
    engine.resetParams();
    if (engine.law) buildControls(engine.law);
  });

  lawList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    selectLaw(btn.dataset.id);
  });

  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('is-open');
  });

  // ── Readout (обновляется ~10 fps) ───────────────────────────────
  let lastRO = 0;
  function renderReadout(ts) {
    if (ts - lastRO > 100 && engine.law && engine.state) {
      lastRO = ts;
      const lines = engine.law.readout ? engine.law.readout(engine.state) : [];
      readoutEl.innerHTML = lines.map(l =>
          `<div class="readout__line"><span class="readout__k">${l.k}</span><span class="readout__v">${l.v}</span></div>`
      ).join('');
    }
    requestAnimationFrame(renderReadout);
  }
  requestAnimationFrame(renderReadout);

  // ── Старт ───────────────────────────────────────────────────────
  engine.start();
  if (all.length) selectLaw(all[0].id);
})();