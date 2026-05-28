/* =========================================================
   PHYSICA · Эффект Доплера  v2
   f_obs = f₀ · v / (v ∓ vₛ)

   Знак зависит от направления движения источника:
     • источник движется К наблюдателю  → «−» → f_obs > f₀
     • источник движется ОТ наблюдателя → «+» → f_obs < f₀

   Фронты хранятся в кольцевом пуле фиксированного размера —
   никаких прерываний и резких исчезновений.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  // Фиксированный размер пула волновых фронтов
  const POOL_SIZE = 24;

  Laws.register({
    id: 'doppler',
    group: 'BETA',
    title: 'Эффект Доплера',
    description: 'Наблюдаемая частота зависит от направления движения источника: при движении К наблюдателю волны сжимаются (f растёт), при удалении — растягиваются (f падает). Частоты у левого и правого наблюдателей меняются местами при смене направления.',
    formula: 'f = f₀ · v / (v ∓ vₛ)',

    params: [
      { id: 'f0', label: 'Частота источника',  latex: 'f₀', min: 100, max: 800, step: 10, value: 440, default: 440, unit: 'Гц',  type: 'range' },
      { id: 'vs', label: 'Скорость источника', latex: 'vₛ', min: 0,   max: 300, step: 5,  value: 120, default: 120, unit: 'м/с', type: 'range' },
      { id: 'v',  label: 'Скорость звука',     latex: 'v',  min: 100, max: 500, step: 5,  value: 340, default: 340, unit: 'м/с', type: 'range' },
    ],

    // Частоты с учётом направления движения источника
    // dir > 0 — источник едет вправо
    _freqs(f0, vs, v, dir) {
      const vsCl = Math.min(vs, v - 1);
      // Правый наблюдатель: если dir > 0, источник приближается → f↑; dir < 0 → удаляется → f↓
      const fR = dir > 0
        ? f0 * v / (v - vsCl)   // к правому
        : f0 * v / (v + vsCl);  // от правого
      // Левый — всегда противоположно
      const fL = dir > 0
        ? f0 * v / (v + vsCl)   // от левого
        : f0 * v / (v - vsCl);  // к левому
      return { fL, fR };
    },

    readout(s) {
      const { f0, vs, v } = s.params;
      const { fL, fR } = this._freqs(f0, vs, v, s.srcVX || 1);
      return [
        { k: 'fₗ', v: U.fmt(fL, 0) + ' Гц' },
        { k: 'fᵣ', v: U.fmt(fR, 0) + ' Гц' },
      ];
    },

    init(ctx, state, w, h) {
      state.srcX     = w / 2;
      state.srcVX    = 1;         // +1 вправо, -1 влево
      state.emitTimer = 0;
      // Кольцевой пул: каждый фронт — {cx, r, active}
      state.pool = Array.from({ length: POOL_SIZE }, () => ({ cx: 0, r: 0, active: false }));
      state.poolHead = 0;         // куда записываем следующий фронт
    },

    update(state, dt) {
      const { vs, v, f0 } = state.params;
      const speedPx = vs * 0.28;
      const wavePx  = v  * 0.28; // скорость расширения (те же единицы, что и speedPx)
      const margin  = 80;        // будет уточнено в render, здесь берём константу

      state.srcX += state.srcVX * speedPx * dt;

      // Расширяем активные фронты
      for (const wf of state.pool) {
        if (wf.active) {
          wf.r += wavePx * dt;
          if (wf.r > 1600) wf.active = false; // ушёл за экран — деактивируем тихо
        }
      }

      // Эмиттер: испускаем фронты с интервалом, привязанным к f0
      // Нормируем так, чтобы при f0=440 интервал ≈ 0.055с → ~18 фронтов/сек
      const emitInterval = Math.max(0.16, 88 / f0); // ×4 от исходного — ещё меньше волн
      state.emitTimer += dt;
      if (state.emitTimer >= emitInterval) {
        state.emitTimer -= emitInterval; // вычитаем, не обнуляем → нет пропусков
        const slot = state.pool[state.poolHead % POOL_SIZE];
        slot.cx     = state.srcX;
        slot.r      = 0;
        slot.active = true;
        state.poolHead++;
      }
    },

    render(ctx, state, w, h) {
      Draw.bgGrid(ctx, w, h, 40);
      const cy = h / 2;
      const { f0, vs, v } = state.params;
      const margin = w * 0.11;

      // Границы и смена направления
      if (state.srcX > w - margin) { state.srcX = w - margin; state.srcVX = -1; }
      if (state.srcX < margin)     { state.srcX = margin;     state.srcVX =  1; }

      const dir = state.srcVX;
      const { fL, fR } = this._freqs(f0, vs, v, dir);

      // ── Ось движения ────────────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.setLineDash([3, 7]);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Волновые фронты ─────────────────────────────────────────
      ctx.save();
      ctx.shadowBlur  = 5;
      ctx.shadowColor = '#7cf2c8';
      for (const wf of state.pool) {
        if (!wf.active || wf.r < 1) continue;
        // Плавное затухание по радиусу
        const alpha = Math.max(0, 0.6 * (1 - wf.r / 900));
        if (alpha < 0.01) continue;
        ctx.strokeStyle = `rgba(124,242,200,${alpha.toFixed(3)})`;
        ctx.lineWidth   = 1.3;
        ctx.beginPath();
        ctx.arc(wf.cx, cy, wf.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // ── Наблюдатели ─────────────────────────────────────────────
      const obsLx = margin * 0.35;
      const obsRx = w - margin * 0.35;

      const drawObserver = (x, freq, label) => {
        // Тело наблюдателя
        ctx.save();
        ctx.strokeStyle = '#8a96a8';
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.moveTo(x, cy - 26); ctx.lineTo(x, cy + 18); ctx.stroke();

        // Пульсирующий кружок — частота визуально выше/ниже f0
        const col    = freq > f0 * 1.01 ? '#ff6e9c'
                     : freq < f0 * 0.99 ? '#5ac8fa'
                     : '#7cf2c8';
        // Используем глобальное время через количество активных фронтов — грубый пульс.
        // Вместо этого используем просто синус от текущего радиуса ближайшего фронта.
        const t      = performance.now() / 1000;
        const pulse  = Math.sin(t * freq * 0.15) * 0.5 + 0.5;
        ctx.shadowBlur  = 10 * pulse;
        ctx.shadowColor = col;
        ctx.fillStyle   = col;
        ctx.globalAlpha = 0.55 + pulse * 0.45;
        ctx.beginPath(); ctx.arc(x, cy - 34, 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Подпись частоты
        const freqLabel = `${U.fmt(freq, 0)} Гц`;
        const col2 = freq > f0 * 1.01 ? '#ff6e9c' : freq < f0 * 0.99 ? '#5ac8fa' : '#7cf2c8';
        Draw.text(ctx, freqLabel, x, cy + 26,
          { color: col2, align: 'center', font: '700 12px JetBrains Mono, monospace' });
        Draw.text(ctx, label, x, cy + 40,
          { color: '#5a6577', align: 'center', font: '10px JetBrains Mono, monospace' });

        // Стрелка-индикатор: частота выше/ниже базовой
        if (Math.abs(freq - f0) > 1) {
          const arrowUp = freq > f0;
          const ax = x, ay = cy + 55;
          ctx.save();
          ctx.fillStyle = col2;
          ctx.shadowBlur = 6; ctx.shadowColor = col2;
          ctx.beginPath();
          if (arrowUp) {
            ctx.moveTo(ax, ay - 8); ctx.lineTo(ax - 6, ay); ctx.lineTo(ax + 6, ay);
          } else {
            ctx.moveTo(ax, ay);     ctx.lineTo(ax - 6, ay - 8); ctx.lineTo(ax + 6, ay - 8);
          }
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      };

      drawObserver(obsLx, fL, 'наблюдатель ←');
      drawObserver(obsRx, fR, '→ наблюдатель');

      // ── Источник ────────────────────────────────────────────────
      const sx = state.srcX;
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = '#7cf2c8';
      ctx.fillStyle   = '#0f1e2e';
      ctx.strokeStyle = '#7cf2c8';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.roundRect(sx - 20, cy - 13, 40, 20, 6);
      ctx.fill(); ctx.stroke();

      // Динамик — дуги в сторону движения
      const dSide = dir > 0 ? sx + 16 : sx - 16;
      for (let r = 4; r <= 12; r += 4) {
        const a0 = dir > 0 ? -Math.PI * 0.55 :  Math.PI * 0.45;
        const a1 = dir > 0 ?  Math.PI * 0.55 :  Math.PI * 1.55;
        ctx.strokeStyle = `rgba(124,242,200,${0.8 - r * 0.045})`;
        ctx.lineWidth   = 1.2;
        ctx.shadowBlur  = 0;
        ctx.beginPath(); ctx.arc(dSide, cy - 3, r, a0, a1); ctx.stroke();
      }

      // Стрелка направления
      ctx.strokeStyle = '#5ac8fa'; ctx.lineWidth = 2;
      ctx.shadowBlur  = 8; ctx.shadowColor = '#5ac8fa';
      const ax0 = sx, ay0 = cy - 24, ax1 = sx + dir * 30;
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay0); ctx.stroke();
      ctx.fillStyle = '#5ac8fa';
      ctx.beginPath();
      ctx.moveTo(ax1, ay0);
      ctx.lineTo(ax1 - dir * 7, ay0 - 4);
      ctx.lineTo(ax1 - dir * 7, ay0 + 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // Подписи над/под источником
      Draw.text(ctx, `f₀ = ${f0} Гц`, sx, cy - 38,
        { color: '#7cf2c8', align: 'center', font: '10px JetBrains Mono' });
      Draw.text(ctx, `vₛ = ${vs} м/с`, sx, cy + 16,
        { color: '#5ac8fa', align: 'center', font: '10px JetBrains Mono' });

      // ── Строка внизу: направление и число Маха ──────────────────
      const mach = vs / v;
      const dirLabel = dir > 0 ? '→ движется вправо' : '← движется влево';
      const machStr  = mach >= 1
        ? `⚡ M = ${U.fmt(mach, 2)} — сверхзвук!`
        : `M = ${U.fmt(mach, 2)}  |  ${dirLabel}`;
      Draw.text(ctx, machStr, w / 2, h - 16,
        { color: mach >= 0.9 ? '#ff6e9c' : '#5a6577', align: 'center', font: '11px JetBrains Mono' });
    }
  });
})();
