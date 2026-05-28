/* =========================================================
   PHYSICA · Заряд/разряд конденсатора (RC-цепь)
   q(t) = Q₀ · (1 − e^{−t/τ})   заряд
   q(t) = Q₀ · e^{−t/τ}          разряд
   τ = R · C — постоянная времени

   Визуализация:
   — Схема цепи: источник ЭМС, резистор, конденсатор, ключ
   — Пластины конденсатора заполняются по мере заряда
   — Электроны движутся по проводам; скорость ∝ току i(t)
   — Live-график U_C(t) накапливается правее схемы
   — Кнопка «Зарядить / Разрядить» меняет режим
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const N_ELECTRONS = 40;

  Laws.register({
    id: 'rc-circuit',
    group: 'BETA',
    title: 'RC-цепь: заряд конденсатора',
    description: 'Напряжение на конденсаторе нарастает (или спадает) по экспоненте с постоянной времени τ = R·C. За время τ конденсатор заряжается на ≈63% от максимального значения.',
    formula: 'U(t) = U₀·(1 − e^{−t/τ})',

    params: [
      { id: 'R',    label: 'Сопротивление', latex: 'R',  min: 10,  max: 500,  step: 10,  value: 100, default: 100, unit: 'Ом', type: 'range' },
      { id: 'C',    label: 'Ёмкость',       latex: 'C',  min: 100, max: 5000, step: 100, value: 1000,default: 1000,unit: 'мкФ',type: 'range' },
      { id: 'Umax', label: 'ЭМС источника', latex: 'U₀', min: 1,   max: 24,   step: 0.5, value: 12,  default: 12,  unit: 'В',  type: 'range' },
      { id: 'mode', label: 'Режим', type: 'select', value: 'charge', default: 'charge',
        options: [{ value: 'charge', label: 'Заряд' }, { value: 'discharge', label: 'Разряд' }] },
    ],

    readout(s) {
      const tau = s.params.R * s.params.C / 1e6; // τ в секундах (C в мкФ)
      const UC  = s.UC || 0;
      const i   = Math.abs((s.params.Umax * (s.params.mode === 'charge' ? 1 : 0) - UC) / s.params.R) * 1e6;
      return [
        { k: 'τ',    v: U.fmt(tau, 3) + ' с' },
        { k: 'U_C',  v: U.fmt(UC, 3) + ' В' },
        { k: 'i',    v: U.fmt(i, 2) + ' мкА' },
      ];
    },

    init(ctx, state, w, h) {
      this.reset(state);
    },

    reset(state) {
      state.UC        = state.params.mode === 'charge' ? 0 : state.params.Umax;
      state.simTime   = 0;
      state.history   = []; // {t, UC}
      state.electrons = [];
      for (let i = 0; i < N_ELECTRONS; i++) {
        state.electrons.push({ s: i / N_ELECTRONS, speed: 0 });
      }
    },

    onParam(id, value, state) {
      if (id === 'mode') {
        state.UC      = value === 'charge' ? 0 : state.params.Umax;
        state.simTime = 0;
        state.history = [];
      }
    },

    update(state, dt) {
      const { R, C, Umax, mode } = state.params;
      const tau = R * C / 1e6; // с (C в мкФ)

      // Аналитическое решение — нет численного дрейфа
      state.simTime += dt;
      const t = state.simTime;
      if (mode === 'charge') {
        state.UC = Umax * (1 - Math.exp(-t / tau));
      } else {
        state.UC = Umax * Math.exp(-t / tau);
      }

      // Ток: i = (Umax - UC)/R при заряде, -UC/R при разряде
      const i = mode === 'charge'
        ? (Umax - state.UC) / R
        : -state.UC / R;
      const iNorm = Math.abs(i) / (Umax / R); // 0..1

      // Скорость электронов ∝ |i|
      const speed = iNorm * 1.2;
      const dir   = mode === 'charge' ? 1 : -1;
      for (const e of state.electrons) {
        e.s = ((e.s + dir * speed * dt) % 1 + 1) % 1;
      }

      // История для графика (не чаще ~60 точек/сек)
      state.history.push({ t, UC: state.UC });
      if (state.history.length > 300) state.history.shift();
    },

    // Геометрия схемы: прямоугольный контур
    // Верх: провод с резистором посередине
    // Право: провод с конденсатором посередине
    // Низ: провод
    // Лево: провод с ЭМС посередине
    _circuitPath(w, h) {
      const pad = Math.min(w, h) * 0.09;
      const schW = Math.min(w * 0.52, 340);
      const schH = Math.min(h * 0.60, 260);
      const x0 = pad + 10;
      const y0 = (h - schH) / 2;
      const x1 = x0 + schW;
      const y1 = y0 + schH;
      return { x0, y0, x1, y1, schW, schH };
    },

    _pointOnCircuit(s, geo) {
      const { x0, y0, x1, y1, schW, schH } = geo;
      const perimeter = 2 * (schW + schH);
      const d = s * perimeter;
      // Верх →
      if (d < schW) return { x: x0 + d,        y: y0 };
      // Право ↓
      if (d < schW + schH) return { x: x1, y: y0 + (d - schW) };
      // Низ ←
      if (d < 2 * schW + schH) return { x: x1 - (d - schW - schH), y: y1 };
      // Лево ↑
      return { x: x0, y: y1 - (d - 2 * schW - schH) };
    },

    render(ctx, state, w, h) {
      Draw.bgGrid(ctx, w, h, 36);
      const { R, C, Umax, mode } = state.params;
      const tau  = R * C / 1e6;
      const UC   = state.UC;
      const geo  = this._circuitPath(w, h);
      const { x0, y0, x1, y1, schW, schH } = geo;
      const cx0  = x0, cy0 = y0, cx1 = x1, cy1 = y1;
      const chargeRatio = UC / Math.max(Umax, 0.001);

      // ── Провода контура ────────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); // верх
      ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); // право
      ctx.moveTo(x1, y1); ctx.lineTo(x0, y1); // низ
      ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); // лево
      ctx.stroke();
      ctx.restore();

      // ── Резистор (на верхнем проводе, посередине) ─────────────
      const rxC = (x0 + x1) / 2, ry = y0;
      const rW = Math.min(70, schW * 0.28), rH = 16;
      ctx.save();
      ctx.fillStyle   = '#1a2230';
      ctx.strokeStyle = '#ffb86b';
      ctx.lineWidth   = 1.5;
      // «Закрашиваем» провод под корпусом
      ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(rxC - rW / 2, ry); ctx.lineTo(rxC + rW / 2, ry); ctx.stroke();
      ctx.fillStyle   = '#1a2230';
      ctx.strokeStyle = '#ffb86b';
      ctx.lineWidth   = 1.5;
      ctx.fillRect(rxC - rW / 2, ry - rH / 2, rW, rH);
      ctx.strokeRect(rxC - rW / 2, ry - rH / 2, rW, rH);
      // Зигзаг резистора
      ctx.strokeStyle = '#ffb86b'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const xz = rxC - rW / 2 + (i / steps) * rW;
        const yz = ry + (i % 2 === 0 ? -4 : 4);
        i === 0 ? ctx.moveTo(xz, yz) : ctx.lineTo(xz, yz);
      }
      ctx.stroke();
      ctx.restore();
      Draw.text(ctx, `R = ${R} Ом`, rxC, ry - rH / 2 - 8,
        { color: '#ffb86b', align: 'center', font: '10px JetBrains Mono, monospace' });

      // ── Конденсатор (на правом проводе, посередине) ───────────
      const cxV = x1, cyC = (y0 + y1) / 2;
      const cGap = 10, cPlateH = Math.min(50, schH * 0.30);
      ctx.save();
      // Провод за конденсатором
      ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cxV, cyC - cPlateH * 0.7); ctx.lineTo(cxV, cyC + cPlateH * 0.7); ctx.stroke();

      // Заряженность — заливка между пластинами
      if (chargeRatio > 0.01) {
        const fillAlpha = chargeRatio * 0.35;
        const fieldCol  = mode === 'charge' ? `rgba(90,200,250,${fillAlpha})` : `rgba(255,107,156,${fillAlpha})`;
        ctx.fillStyle = fieldCol;
        ctx.fillRect(cxV - cGap / 2 - 1, cyC - cPlateH / 2, cGap + 2, cPlateH);
      }

      // Пластины конденсатора
      const plateCol = `rgb(${Math.round(90 + chargeRatio * 130)},${Math.round(200 - chargeRatio * 80)},${Math.round(250 - chargeRatio * 160)})`;
      ctx.strokeStyle = plateCol;
      ctx.lineWidth   = 3.5;
      ctx.lineCap     = 'round';
      ctx.shadowBlur  = chargeRatio * 14;
      ctx.shadowColor = plateCol;
      // Левая пластина (+)
      ctx.beginPath(); ctx.moveTo(cxV - cGap / 2, cyC - cPlateH / 2); ctx.lineTo(cxV - cGap / 2, cyC + cPlateH / 2); ctx.stroke();
      // Правая пластина (−)
      ctx.beginPath(); ctx.moveTo(cxV + cGap / 2, cyC - cPlateH / 2); ctx.lineTo(cxV + cGap / 2, cyC + cPlateH / 2); ctx.stroke();
      ctx.restore();

      // Знаки на пластинах
      const signCol = chargeRatio > 0.05 ? plateCol : '#5a6577';
      Draw.text(ctx, '+', cxV - cGap / 2 - 12, cyC - 4, { color: signCol, align: 'center', font: 'bold 14px Fraunces, serif' });
      Draw.text(ctx, '−', cxV + cGap / 2 + 12, cyC - 4, { color: signCol, align: 'center', font: 'bold 14px Fraunces, serif' });
      Draw.text(ctx, `C = ${C} мкФ`, cxV + 22, cyC - cPlateH / 2 - 8,
        { color: '#5ac8fa', font: '10px JetBrains Mono, monospace' });

      // ── ЭМС-источник (на левом проводе) ───────────────────────
      const emfX = x0, emfY = (y0 + y1) / 2;
      const emfR = 18;
      ctx.save();
      ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(emfX, emfY - emfR); ctx.lineTo(emfX, emfY + emfR); ctx.stroke();
      ctx.fillStyle   = '#0f1922';
      ctx.strokeStyle = '#7cf2c8';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 12; ctx.shadowColor = '#7cf2c8';
      ctx.beginPath(); ctx.arc(emfX, emfY, emfR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7cf2c8';
      ctx.font      = 'bold 11px Fraunces, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText('ε', emfX, emfY);
      ctx.restore();
      Draw.text(ctx, `U₀ = ${Umax} В`, emfX - emfR - 6, emfY - 6,
        { color: '#7cf2c8', align: 'right', font: '10px JetBrains Mono, monospace' });

      // ── Электроны на контуре ───────────────────────────────────
      const iAbs = Math.abs(mode === 'charge' ? (Umax - UC) / R : UC / R);
      const iNorm = Math.min(iAbs / (Umax / R), 1);
      if (iNorm > 0.01) {
        ctx.save();
        const eCol = mode === 'charge' ? '#7cf2c8' : '#ff6e9c';
        ctx.shadowBlur  = 8;
        ctx.shadowColor = eCol;
        ctx.fillStyle   = eCol;
        for (const e of state.electrons) {
          const p = this._pointOnCircuit(e.s, geo);
          ctx.globalAlpha = 0.4 + iNorm * 0.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // ── Вольтметр (дуга на конденсаторе) ─────────────────────
      const vmX = x1 + 55, vmY = cyC;
      const vmR = 26;
      ctx.save();
      ctx.fillStyle   = '#0f1922';
      ctx.strokeStyle = '#3a4452';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(vmX, vmY, vmR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Шкала
      const aS = Math.PI * 0.75, aE = Math.PI * 2.25;
      const pNorm = chargeRatio;
      const aPtr  = aS + (aE - aS) * pNorm;
      ctx.strokeStyle = '#3a4452'; ctx.lineWidth = 1;
      for (let ti = 0; ti <= 6; ti++) {
        const ta = aS + (aE - aS) * (ti / 6);
        ctx.beginPath();
        ctx.moveTo(vmX + Math.cos(ta) * (vmR - 4), vmY + Math.sin(ta) * (vmR - 4));
        ctx.lineTo(vmX + Math.cos(ta) * (vmR - 8), vmY + Math.sin(ta) * (vmR - 8));
        ctx.stroke();
      }
      // Стрелка
      ctx.strokeStyle = '#5ac8fa'; ctx.lineWidth = 2;
      ctx.shadowBlur  = 8; ctx.shadowColor = '#5ac8fa';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(vmX, vmY);
      ctx.lineTo(vmX + Math.cos(aPtr) * (vmR - 8), vmY + Math.sin(aPtr) * (vmR - 8));
      ctx.stroke();
      ctx.fillStyle = '#5ac8fa';
      ctx.beginPath(); ctx.arc(vmX, vmY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      Draw.text(ctx, `${U.fmt(UC, 2)} В`, vmX, vmY + 5, { color: '#5ac8fa', align: 'center', font: '700 11px JetBrains Mono' });
      Draw.text(ctx, 'U_C', vmX, vmY + vmR + 12, { color: '#5a6577', align: 'center', font: '10px JetBrains Mono' });
      // Соединение вольтметра с конденсатором
      ctx.save();
      ctx.strokeStyle = 'rgba(90,200,250,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([2,4]);
      ctx.beginPath(); ctx.moveTo(x1 + 8, cyC - 12); ctx.lineTo(vmX - vmR, vmY - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 + 8, cyC + 12); ctx.lineTo(vmX - vmR, vmY + 8); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();

      // ── График U_C(t) ─────────────────────────────────────────
      const gx0 = x1 + 100, gxW = w - gx0 - 16;
      const gTop = y0, gBot = y1, gH = gBot - gTop;
      if (gxW < 40 || gH < 40) return;

      ctx.save();
      ctx.fillStyle   = 'rgba(0,0,0,0.25)';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.roundRect(gx0, gTop, gxW, gH, 6); ctx.fill(); ctx.stroke();
      ctx.restore();

      // Оси
      ctx.save();
      ctx.strokeStyle = '#3a4452'; ctx.lineWidth = 1;
      // Y-ось
      ctx.beginPath(); ctx.moveTo(gx0 + 24, gTop + 6); ctx.lineTo(gx0 + 24, gBot - 18); ctx.stroke();
      // X-ось
      ctx.beginPath(); ctx.moveTo(gx0 + 24, gBot - 18); ctx.lineTo(gx0 + gxW - 6, gBot - 18); ctx.stroke();
      ctx.restore();
      Draw.text(ctx, 'U_C', gx0 + 4, gTop + 8, { color: '#5a6577', font: '9px JetBrains Mono' });
      Draw.text(ctx, `${U.fmt(Umax, 0)} В`, gx0 + 4, gTop + 20, { color: '#5ac8fa', font: '9px JetBrains Mono' });
      Draw.text(ctx, 't', gx0 + gxW - 8, gBot - 20, { color: '#5a6577', font: '9px JetBrains Mono' });

      // Линия τ
      const tauFraction = Math.min(tau * 4, state.history.length > 0 ? state.history[state.history.length - 1].t : 0);
      if (tauFraction > 0 && state.history.length > 1) {
        const tMax = state.history[state.history.length - 1].t;
        const tauX = gx0 + 24 + (tau / Math.max(tMax, tau * 1.2)) * (gxW - 30);
        if (tauX < gx0 + gxW - 6) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,184,107,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(tauX, gTop + 6); ctx.lineTo(tauX, gBot - 18); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          Draw.text(ctx, 'τ', tauX, gTop + 8, { color: '#ffb86b', align: 'center', font: '9px JetBrains Mono' });
        }
      }

      // Теоретическая кривая (светлая)
      if (state.history.length > 1) {
        const tMax = state.history[state.history.length - 1].t;
        const plotW = gxW - 30, plotH = gH - 24;
        ctx.save();
        ctx.strokeStyle = 'rgba(90,200,250,0.2)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        for (let xi = 0; xi <= plotW; xi += 2) {
          const tt   = (xi / plotW) * tMax;
          const uTh  = mode === 'charge'
            ? Umax * (1 - Math.exp(-tt / tau))
            : Umax * Math.exp(-tt / tau);
          const xp   = gx0 + 24 + xi;
          const yp   = gBot - 18 - (uTh / Umax) * plotH;
          xi === 0 ? ctx.moveTo(xp, yp) : ctx.lineTo(xp, yp);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Реальная накопленная линия
      const n = state.history.length;
      if (n > 1) {
        const tMax  = state.history[n - 1].t;
        const plotW = gxW - 30, plotH = gH - 24;
        ctx.save();
        ctx.strokeStyle = '#5ac8fa';
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 6; ctx.shadowColor = '#5ac8fa';
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const { t, UC: u } = state.history[i];
          const xp = gx0 + 24 + (t / Math.max(tMax, 1e-9)) * plotW;
          const yp = gBot - 18 - U.clamp(u / Umax, 0, 1) * plotH;
          i === 0 ? ctx.moveTo(xp, yp) : ctx.lineTo(xp, yp);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Метка τ на графике: горизонтальная линия 0.632·Umax
      {
        const y63 = gBot - 18 - 0.632 * (gH - 24);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,184,107,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(gx0 + 24, y63); ctx.lineTo(gx0 + gxW - 6, y63); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        Draw.text(ctx, '63%', gx0 + gxW - 4, y63 - 4,
          { color: '#ffb86b', align: 'right', font: '8px JetBrains Mono' });
      }

      // ── Нижняя строка ─────────────────────────────────────────
      Draw.text(ctx,
        `τ = R·C = ${U.fmt(tau, 3)} с  |  режим: ${mode === 'charge' ? 'заряд ↑' : 'разряд ↓'}`,
        (x0 + x1) / 2, y1 + 20,
        { color: '#5a6577', align: 'center', font: '10px JetBrains Mono, monospace' });
    },
  });
})();
