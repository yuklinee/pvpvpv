/* =========================================================
   PHYSICA · core.js
   Ядро приложения: реестр законов + движок canvas + утилиты
   ========================================================= */
(function (global) {
  'use strict';

  // ---------- Реестр законов ----------
  // Каждый закон — объект:
  // {
  //   id: 'unique-id',
  //   title: 'Название',
  //   description: 'Краткое описание',
  //   formula: 'I = U/R',          // отображается рядом с заголовком
  //   params: [ {id, label, latex, min, max, step, value, unit, type:'range'|'select'|'toggle', options?} ],
  //   readout(state) { return [{k:'I', v:'1.2 А'}, ...] },
  //   reset(state) {},             // (необязательно) — сброс к умолчаниям
  //   init(ctx, state, w, h) {},   // вызывается при выборе закона
  //   update(state, dt) {},        // dt в секундах
  //   render(ctx, state, w, h, t) {} // полная отрисовка кадра
  // }
  const Laws = {
    _list: [],
    // law.group — строка-идентификатор группы, например '1.13' или 'BETA'
    register(law) {
      law.params = (law.params || []).map(p => ({ ...p, value: p.value ?? p.default ?? p.min ?? 0 }));
      this._list.push(law);
    },
    all() { return this._list.slice(); },
    get(id) { return this._list.find(l => l.id === id); },
    // Возвращает массив групп: [{id, label, laws:[...]}, ...]
    groups() {
      const map = new Map();
      for (const law of this._list) {
        const g = law.group || 'Без группы';
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(law);
      }
      return Array.from(map.entries()).map(([id, laws]) => ({ id, laws }));
    }
  };

  // ---------- Утилиты ----------
  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    fmt(v, digits = 2) {
      if (!isFinite(v)) return '—';
      const abs = Math.abs(v);
      if (abs !== 0 && (abs < 0.01 || abs >= 1e5)) return v.toExponential(2);
      return v.toFixed(digits);
    },
    // плавное приближение значения к целевому (экспоненциальное сглаживание)
    smooth(current, target, dt, halfLife = 0.12) {
      if (!isFinite(current)) return target;
      const k = 1 - Math.pow(0.5, dt / halfLife);
      return current + (target - current) * k;
    },
    // привязанная к dpr и контейнеру настройка canvas
    fitCanvas(canvas) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w, h, dpr };
    }
  };

  // ---------- Движок ----------
  // Управляет циклом анимации: вызывает update/render текущего закона.
  // Сделан так, что dt всегда ограничено сверху — анимация остаётся плавной даже при подвисаниях.
  function Engine(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.law = null;
    this.state = null;
    this.running = true;
    this.t = 0;
    this._lastTs = 0;
    this._raf = null;
    this._size = { w: 0, h: 0 };
  }

  Engine.prototype.setLaw = function (law) {
    this.law = law;
    this.t = 0;
    this.state = { params: {} };
    (law.params || []).forEach(p => { this.state.params[p.id] = p.value; });
    const fit = U.fitCanvas(this.canvas);
    this._size = { w: fit.w, h: fit.h };
    // Полностью очищаем canvas при смене закона — никаких артефактов от предыдущей сцены
    fit.ctx.clearRect(0, 0, fit.w, fit.h);
    if (typeof law.init === 'function') law.init(fit.ctx, this.state, fit.w, fit.h);
  };

  Engine.prototype.setParam = function (id, value) {
    if (!this.state) return;
    this.state.params[id] = value;
    if (this.law && typeof this.law.onParam === 'function') {
      this.law.onParam(id, value, this.state);
    }
  };

  Engine.prototype.resetParams = function () {
    if (!this.law) return;
    this.law.params.forEach(p => {
      this.state.params[p.id] = (p.default !== undefined ? p.default : p.value);
    });
    if (typeof this.law.reset === 'function') this.law.reset(this.state);
  };

  Engine.prototype.play  = function () { this.running = true;  };
  Engine.prototype.pause = function () { this.running = false; };

  Engine.prototype.start = function () {
    cancelAnimationFrame(this._raf);
    this._lastTs = performance.now();
    const loop = (ts) => {
      let dt = (ts - this._lastTs) / 1000;
      // Ограничиваем dt — если вкладка была свернута, не получим скачок
      if (dt > 0.05) dt = 0.05;
      this._lastTs = ts;
      if (this.running) this.t += dt;

      const fit = U.fitCanvas(this.canvas);
      this._size = { w: fit.w, h: fit.h };

      if (this.law) {
        if (this.running && typeof this.law.update === 'function') {
          this.law.update(this.state, dt);
        }
        // Полная очистка каждый кадр. Законам, которым нужен «след»
        // (brownian, gravity), достаточно рисовать полупрозрачный фон
        // в самом начале своего render() — они уже это делают.
        const ctx = fit.ctx;
        ctx.clearRect(0, 0, fit.w, fit.h);

        this.law.render(fit.ctx, this.state, fit.w, fit.h, this.t);
      }

      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  };

  // ---------- Хелперы рисования ----------
  // Эти функции доступны всем модулям через window.Draw
  const Draw = {
    bgGrid(ctx, w, h, step = 32, color = 'rgba(255,255,255,0.04)') {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      ctx.restore();
    },
    text(ctx, str, x, y, opts = {}) {
      ctx.save();
      ctx.font = opts.font || '11px "JetBrains Mono", monospace';
      ctx.fillStyle = opts.color || '#8a96a8';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'top';
      ctx.fillText(str, x, y);
      ctx.restore();
    },
    glowLine(ctx, points, color, width = 2, glow = 12) {
      if (points.length < 2) return;
      ctx.save();
      ctx.shadowBlur = glow;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
      ctx.restore();
    },
    // hex → rgba с заданной альфой (для удобства тонирования)
    rgba(hex, a) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
  };

  // ---------- Экспорт в глобальную область ----------
  global.Physica = { Laws, U, Draw, Engine };

})(window);
