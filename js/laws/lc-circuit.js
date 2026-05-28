/* =========================================================
   PHYSICA · LC-контур (электромагнитные колебания)
   ω = 1/√(LC),   T = 2π√(LC)
   q(t) = Q₀·cos(ωt + φ₀)
   i(t) = −Q₀·ω·sin(ωt + φ₀)

   Бесконечные незатухающие колебания (идеальный контур).
   Параметры меняют частоту и амплитуду в реальном времени.

   Визуализация:
   — Схема: катушка L и конденсатор C в контуре
   — Анимированный заряд на пластинах конденсатора
   — Анимированное магнитное поле катушки
   — Электроны пульсируют в такт i(t)
   — Два живых графика: q(t) и i(t) — бесконечная лента
   — Фазовый портрет (q, i) — эллипс, вращается непрерывно
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const N_EL = 36; // электронов в контуре

  Laws.register({
    id: 'lc-circuit',
    group: 'BETA',
    title: 'LC-контур',
    description: 'В идеальном LC-контуре энергия бесконечно перекачивается между электрическим полем конденсатора и магнитным полем катушки. Частота колебаний ω = 1/√(LC) не зависит от амплитуды.',
    formula: 'ω = 1/√(L·C)',

    params: [
      { id: 'L',  label: 'Индуктивность',  latex: 'L',  min: 1,   max: 100,  step: 1,   value: 20,  default: 20,  unit: 'мГн', type: 'range' },
      { id: 'C',  label: 'Ёмкость',        latex: 'C',  min: 1,   max: 100,  step: 1,   value: 20,  default: 20,  unit: 'мкФ', type: 'range' },
      { id: 'Q0', label: 'Нач. заряд',     latex: 'Q₀', min: 1,   max: 20,   step: 0.5, value: 10,  default: 10,  unit: 'мкКл',type: 'range' },
      { id: 'R',  label: 'Затухание',      latex: 'R',  min: 0,   max: 30,   step: 0.5, value: 0,   default: 0,   unit: 'Ом',  type: 'range' },
    ],

    readout(s) {
      const { L, C } = s.params;
      const L_H  = L  * 1e-3;  // мГн → Гн
      const C_F  = C  * 1e-6;  // мкФ → Ф
      const omega = 1 / Math.sqrt(L_H * C_F);
      const T     = 2 * Math.PI / omega;
      const f     = omega / (2 * Math.PI);
      return [
        { k: 'ω', v: U.fmt(omega, 1) + ' рад/с' },
        { k: 'f', v: U.fmt(f,     1) + ' Гц'    },
        { k: 'T', v: U.fmt(T * 1000, 2) + ' мс' },
      ];
    },

    init(ctx, state, w, h) {
      state.phase    = 0;      // текущая фаза колебаний (рад)
      state.amp      = 1;      // текущая амплитуда (нормированная, 0..1, затухает при R>0)
      state.histQ    = [];     // история q(t)
      state.histI    = [];     // история i(t)
      state.electrons = Array.from({ length: N_EL }, (_, i) => ({ s: i / N_EL }));
    },

    update(state, dt) {
      const { L, C, Q0, R } = state.params;
      const L_H   = L * 1e-3;
      const C_F   = C * 1e-6;
      const omega  = 1 / Math.sqrt(L_H * C_F);

      // Логарифмический декремент затухания: δ = R/(2L)
      const delta  = R / (2 * L_H);

      // Фаза растёт со временем — параметры влияют мгновенно (нет памяти о прошлом)
      state.phase += omega * dt;

      // Амплитуда экспоненциально затухает при R > 0
      if (delta > 0) {
        state.amp *= Math.exp(-delta * dt);
        // Перезапускаем когда амплитуда упала до 2%
        if (state.amp < 0.02) { state.amp = 1; state.phase = 0; }
      } else {
        state.amp = 1;
      }

      const q = Q0 * state.amp * Math.cos(state.phase);          // мкКл
      const i = -Q0 * state.amp * omega * Math.sin(state.phase); // А (в условн. единицах)
      const iNorm = Math.sin(state.phase); // −1..+1 для анимации

      // Двигаем электроны в такт с током
      for (const e of state.electrons) {
        e.s = ((e.s + iNorm * 0.4 * dt + 1) % 1);
      }

      // История для графиков (скользящее окно)
      state.histQ.push(q);
      state.histI.push(i);
      const maxHist = 280;
      if (state.histQ.length > maxHist) { state.histQ.shift(); state.histI.shift(); }

      // Кешируем текущие значения для render
      state._q = q;
      state._i = i;
      state._omega = omega;
    },

    // Позиция точки на прямоугольном контуре (s ∈ [0,1))
    _ptOn(s, geo) {
      const { lx, ly, rw, rh } = geo;
      const perim = 2 * (rw + rh);
      const d = s * perim;
      if (d < rw)             return { x: lx + d,            y: ly      };
      if (d < rw + rh)        return { x: lx + rw,           y: ly + (d - rw)       };
      if (d < 2 * rw + rh)    return { x: lx + rw - (d - rw - rh), y: ly + rh };
      return                         { x: lx,                 y: ly + rh - (d - 2*rw - rh) };
    },

    render(ctx, state, w, h, t) {
      Draw.bgGrid(ctx, w, h, 36);

      const { L, C, Q0, R } = state.params;
      const L_H   = L  * 1e-3;
      const C_F   = C  * 1e-6;
      const omega  = state._omega || 1 / Math.sqrt(L_H * C_F);
      const q      = state._q     || 0;
      const i_val  = state._i     || 0;
      const qNorm  = q / Q0;         // −1..+1
      const iMax   = Q0 * omega;
      const iNorm  = iMax > 0 ? i_val / iMax : 0; // −1..+1

      // ── Геометрия схемы ────────────────────────────────────────────
      const pad  = 18;
      const schW = Math.min(w * 0.38, 260);
      const schH = Math.min(h * 0.52, 220);
      const lx   = pad + 10;
      const ly   = (h - schH) / 2;
      const geo  = { lx, ly, rw: schW, rh: schH };

      // ── Провода контура ────────────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = '#3a4a5a';
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.strokeRect(lx, ly, schW, schH);
      ctx.restore();

      const topMidX  = lx + schW / 2;
      const topY     = ly;
      const botMidX  = topMidX;
      const botY     = ly + schH;
      const rightX   = lx + schW;
      const midY     = ly + schH / 2;

      // ── Конденсатор (верхний провод, посередине) ───────────────────
      const cGap = 12, cPH = Math.min(44, schH * 0.28);
      // Перекрываем провод
      ctx.save();
      ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(topMidX - 20, topY); ctx.lineTo(topMidX + 20, topY); ctx.stroke();

      // Заряд = цвет пластин и заливки
      const chargeCol = qNorm >= 0
        ? `rgba(255,107,156,${Math.abs(qNorm) * 0.8 + 0.15})`
        : `rgba(90,200,250,${Math.abs(qNorm) * 0.8 + 0.15})`;

      // Заливка между пластинами
      ctx.fillStyle = qNorm >= 0
        ? `rgba(255,107,156,${Math.abs(qNorm) * 0.25})`
        : `rgba(90,200,250,${Math.abs(qNorm) * 0.25})`;
      ctx.fillRect(topMidX - cGap / 2, topY - cPH / 2, cGap, cPH);

      // Пластины
      ctx.strokeStyle = chargeCol;
      ctx.lineWidth   = 3.5; ctx.lineCap = 'round';
      ctx.shadowBlur  = Math.abs(qNorm) * 14; ctx.shadowColor = chargeCol;
      ctx.beginPath(); ctx.moveTo(topMidX - cGap/2, topY - cPH/2); ctx.lineTo(topMidX - cGap/2, topY + cPH/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(topMidX + cGap/2, topY - cPH/2); ctx.lineTo(topMidX + cGap/2, topY + cPH/2); ctx.stroke();
      ctx.restore();

      // Знаки зарядов
      const signCol = Math.abs(qNorm) > 0.05 ? chargeCol : '#3a4a5a';
      Draw.text(ctx, qNorm >= 0 ? '+' : '−', topMidX - cGap/2 - 10, topY - 4,
        { color: signCol, align: 'center', font: 'bold 13px Fraunces, serif' });
      Draw.text(ctx, qNorm >= 0 ? '−' : '+', topMidX + cGap/2 + 10, topY - 4,
        { color: signCol, align: 'center', font: 'bold 13px Fraunces, serif' });
      Draw.text(ctx, `C = ${C} мкФ`, topMidX, topY - cPH/2 - 12,
        { color: '#5ac8fa', align: 'center', font: '10px JetBrains Mono' });

      // ── Катушка (нижний провод, посередине) ───────────────────────
      const coilN  = 5;    // витков
      const coilW  = 60;
      const coilH  = 12;
      const coilX0 = botMidX - coilW / 2;
      const coilY  = botY;

      ctx.save();
      ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(coilX0 - 8, botY); ctx.lineTo(coilX0 + coilW + 8, botY); ctx.stroke();

      // Полукружья катушки
      const magNorm = Math.abs(iNorm);
      const coilCol = `rgba(255,184,107,${0.5 + magNorm * 0.5})`;
      ctx.strokeStyle = coilCol;
      ctx.lineWidth   = 2.5;
      ctx.shadowBlur  = magNorm * 16; ctx.shadowColor = '#ffb86b';
      for (let ci = 0; ci < coilN; ci++) {
        const cx = coilX0 + (ci + 0.5) * (coilW / coilN);
        ctx.beginPath();
        ctx.arc(cx, botY, coilW / coilN / 2, Math.PI, 0);
        ctx.stroke();
      }
      // Магнитные силовые линии (пунктир внутри катушки при токе)
      if (magNorm > 0.1) {
        const dir = iNorm > 0 ? '→' : '←';
        for (let fi = 1; fi <= 3; fi++) {
          const fy  = botY - fi * 14;
          const falpha = magNorm * (1 - fi * 0.25);
          ctx.strokeStyle = `rgba(255,184,107,${falpha.toFixed(2)})`;
          ctx.lineWidth   = 1; ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(coilX0 + 6, fy); ctx.lineTo(coilX0 + coilW - 6, fy);
          ctx.stroke(); ctx.setLineDash([]);
          // Стрелка
          const ax = iNorm > 0 ? coilX0 + coilW - 14 : coilX0 + 14;
          const adx = iNorm > 0 ? 1 : -1;
          ctx.fillStyle = `rgba(255,184,107,${falpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(ax + adx*8, fy);
          ctx.lineTo(ax, fy - 3); ctx.lineTo(ax, fy + 3);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
      Draw.text(ctx, `L = ${L} мГн`, botMidX, botY + coilH + 10,
        { color: '#ffb86b', align: 'center', font: '10px JetBrains Mono' });

      // ── Электроны ─────────────────────────────────────────────────
      if (Math.abs(iNorm) > 0.02) {
        ctx.save();
        const eAlpha = 0.4 + Math.abs(iNorm) * 0.6;
        const eCol   = iNorm > 0 ? '#7cf2c8' : '#ff6e9c';
        ctx.shadowBlur = 8; ctx.shadowColor = eCol; ctx.fillStyle = eCol;
        for (const e of state.electrons) {
          const p = this._ptOn(e.s, geo);
          ctx.globalAlpha = eAlpha;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // ── Амперметр на правом проводе ────────────────────────────────
      const amR = 18;
      const amX = rightX, amY = midY;
      ctx.save();
      ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(amX, amY - amR); ctx.lineTo(amX, amY + amR); ctx.stroke();
      ctx.fillStyle = '#0f1922'; ctx.strokeStyle = '#3a4452'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(amX, amY, amR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = iNorm > 0.05 ? '#7cf2c8' : iNorm < -0.05 ? '#ff6e9c' : '#8a96a8';
      ctx.font = 'italic bold 12px Fraunces, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('A', amX, amY);
      ctx.restore();
      Draw.text(ctx, U.fmt(i_val * 1e3, 1) + ' мА', amX + amR + 6, amY - 5,
        { color: '#8a96a8', font: '9px JetBrains Mono' });

      // ── Правая панель: два графика + фазовый портрет ───────────────
      const panX  = lx + schW + 48;
      const panW  = w - panX - pad;
      if (panW < 60) return;

      const rowH  = (h - 2 * pad) / 3;
      const gpad  = 22;

      const drawGraph = (histArr, color, labelY, labelTop, yPos) => {
        const gx = panX, gy = yPos, gw = panW, gh = rowH - 10;
        const n  = histArr.length;
        // Рамка
        ctx.save();
        ctx.fillStyle   = 'rgba(0,0,0,0.2)';
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 5); ctx.fill(); ctx.stroke();
        ctx.restore();
        Draw.text(ctx, labelTop, gx + 4, gy + 4, { color: '#5a6577', font: '9px JetBrains Mono' });
        // Нулевая линия
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx, gy + gh / 2); ctx.lineTo(gx + gw, gy + gh / 2); ctx.stroke();
        ctx.restore();
        if (n < 2) return;
        const maxV = Math.max(...histArr.map(Math.abs), 1e-9);
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1.8;
        ctx.shadowBlur  = 5; ctx.shadowColor = color;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const xp = gx + (k / (n - 1)) * gw;
          const yp = gy + gh / 2 - (histArr[k] / maxV) * (gh / 2 - 4);
          k === 0 ? ctx.moveTo(xp, yp) : ctx.lineTo(xp, yp);
        }
        ctx.stroke();
        ctx.restore();
        // Текущее значение
        Draw.text(ctx, labelY + ' = ' + U.fmt(histArr[n - 1], 2),
          gx + gw - 4, gy + gh - 12,
          { color, align: 'right', font: '10px JetBrains Mono' });
      };

      drawGraph(state.histQ, '#ff6e9c', 'q', 'q(t), мкКл', pad);
      drawGraph(state.histI.map(v => v * 1e3), '#7cf2c8', 'i', 'i(t), мА', pad + rowH);

      // ── Фазовый портрет (q, i) ─────────────────────────────────────
      const fpY = pad + rowH * 2;
      const fpH = rowH - 10;
      const fpW = panW;
      const fpX = panX;
      ctx.save();
      ctx.fillStyle   = 'rgba(0,0,0,0.2)';
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(fpX, fpY, fpW, fpH, 5); ctx.fill(); ctx.stroke();
      ctx.restore();
      Draw.text(ctx, 'фазовый портрет (q, i)', fpX + 4, fpY + 4,
        { color: '#5a6577', font: '9px JetBrains Mono' });

      // Оси
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fpX + fpW/2, fpY + 4); ctx.lineTo(fpX + fpW/2, fpY + fpH - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fpX + 4, fpY + fpH/2); ctx.lineTo(fpX + fpW - 4, fpY + fpH/2); ctx.stroke();
      ctx.restore();
      Draw.text(ctx, 'q', fpX + fpW - 8, fpY + fpH/2 - 10, { color: '#ff6e9c', font: '9px JetBrains Mono' });
      Draw.text(ctx, 'i', fpX + fpW/2 + 4, fpY + 10,       { color: '#7cf2c8', font: '9px JetBrains Mono' });

      // Эллипс фазового портрета
      const n    = state.histQ.length;
      if (n > 2) {
        const maxQ = Math.max(...state.histQ.map(Math.abs), 1e-9);
        const maxI = Math.max(...state.histI.map(Math.abs), 1e-9);
        const rx   = fpW / 2 - 8;
        const ry   = fpH / 2 - 12;
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.lineJoin  = 'round';
        // Тонкая «тень» всего пути
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const xp = fpX + fpW/2 + (state.histQ[k] / maxQ) * rx;
          const yp = fpY + fpH/2 - (state.histI[k] / maxI) * ry;
          k === 0 ? ctx.moveTo(xp, yp) : ctx.lineTo(xp, yp);
        }
        ctx.stroke();
        // Последние 60 точек — яркий след
        const tail = Math.min(60, n);
        ctx.beginPath();
        for (let k = n - tail; k < n; k++) {
          const alpha = (k - (n - tail)) / tail;
          const xp = fpX + fpW/2 + (state.histQ[k] / maxQ) * rx;
          const yp = fpY + fpH/2 - (state.histI[k] / maxI) * ry;
          k === n - tail ? ctx.moveTo(xp, yp) : ctx.lineTo(xp, yp);
        }
        const grad = ctx.createLinearGradient(fpX, fpY, fpX + fpW, fpY + fpH);
        grad.addColorStop(0, 'rgba(255,107,156,0.6)');
        grad.addColorStop(1, 'rgba(124,242,200,0.9)');
        ctx.strokeStyle = grad;
        ctx.shadowBlur  = 6; ctx.shadowColor = '#7cf2c8';
        ctx.stroke();
        // Текущая точка
        const curX = fpX + fpW/2 + (q / maxQ) * rx;
        const curY = fpY + fpH/2 - (i_val / maxI) * ry;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10; ctx.shadowColor = '#7cf2c8';
        ctx.beginPath(); ctx.arc(curX, curY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── Нижняя строка ─────────────────────────────────────────────
      const f_hz = omega / (2 * Math.PI);
      const dampStr = R > 0 ? `  |  R = ${R} Ом (затухание)` : '  |  R = 0 (идеальный контур)';
      Draw.text(ctx,
        `f = ${U.fmt(f_hz, 1)} Гц${dampStr}`,
        panX + panW / 2, h - 10,
        { color: '#5a6577', align: 'center', font: '10px JetBrains Mono' });
    },
  });
})();
