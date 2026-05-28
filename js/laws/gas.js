/* =========================================================
   PHYSICA · Уравнение состояния идеального газа
   p·V = ν·R·T   (уравнение Менделеева — Клапейрона)

   Визуализация v3 — центрированная компоновка:
   Вся группа (термометр | цилиндр | поршень | манометр)
   вычисляется как единый блок и центрируется по ширине canvas.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const R_GAS = 8.314;
  const N_MOL = 70;

  Laws.register({
    id: 'gas',
    group: '1.14',
    title: 'Уравнение состояния газа',
    description: 'p·V = ν·R·T. Изменяйте температуру, объём или количество молекул. Поршень двигается при изменении объёма, молекулы ускоряются при нагреве, манометр показывает давление.',
    formula: 'p · V = ν · R · T',

    params: [
      { id: 'T',  label: 'Температура',     latex: 'T',  min: 100, max: 800, step: 5,   value: 300, default: 300, unit: 'К',    type: 'range' },
      { id: 'V',  label: 'Объём',           latex: 'V',  min: 10,  max: 90,  step: 1,   value: 40,  default: 40,  unit: 'л',    type: 'range' },
      { id: 'nu', label: 'Кол-во вещества', latex: 'ν',  min: 0.5, max: 3,   step: 0.1, value: 1.0, default: 1.0, unit: 'моль', type: 'range' }
    ],

    readout(s) {
      const { T, V, nu } = s.params;
      const p = nu * R_GAS * T / (V / 1000);
      return [
        { k: 'p', v: U.fmt(p / 1000, 2) + ' кПа' },
        { k: 'T', v: U.fmt(T, 0) + ' К' },
        { k: 'V', v: U.fmt(V * 0.5, 1) + ' л' }
      ];
    },

    // ----------------------------------------------------------------
    // Геометрия — единый центрированный блок
    // Состав (слева направо):
    //   [tmZone] [цилиндр vW] [поршень pistonW] [gap] [манометр mZone]
    // Весь блок смещается так, чтобы его центр совпадал с центром canvas.
    // ----------------------------------------------------------------
    _layout(params, w, h) {
      const top = h * 0.12;
      const bot = h * 0.88;
      const vH  = bot - top;

      // Цилиндр: ширина линейно зависит от V
      const ratio  = params.V / 100;
      const minVW  = Math.max(80,  w * 0.15);
      const maxVW  = Math.min(340, w * 0.40);
      const vW     = Math.round(U.lerp(minVW, maxVW, ratio));

      // Фиксированные ширины зон
      const tmZone    = 68;   // термометр + зазор справа от него
      const pistonW   = 22;   // ширина поршня
      const gapM      = 28;   // зазор поршень→манометр
      const mR        = Math.min(50, h * 0.10);
      const mZone     = mR * 2 + 12;

      // Суммарная ширина всего блока
      const totalW = tmZone + vW + pistonW + gapM + mZone;

      // Стартовая X-координата блока (центрирование)
      const gx = Math.round((w - totalW) / 2);

      // Позиции отдельных элементов
      const tmX   = gx;                             // левый край зоны термометра
      const vLeft = gx + tmZone;                    // левая стенка цилиндра
      const pX    = vLeft + vW;                     // левый край поршня
      const mCX   = pX + pistonW + gapM + mR;      // центр манометра
      const mCY   = top + vH * 0.28;

      return { top, bot, vH, vW, vLeft, vRight: vLeft + vW, pistonW, pX, tmX, mCX, mCY, mR };
    },

    init(ctx, state, w, h) {
      const L = this._layout({ V: 40 }, w, h);
      state.molecules = [];
      for (let i = 0; i < N_MOL; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 40;
        state.molecules.push({
          x: L.vLeft + Math.random() * L.vW,
          y: L.top   + Math.random() * L.vH,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 4 + Math.random() * 2
        });
      }
      state.hitFlashes = [];
      state.pSmoothed  = 0;
    },

    update(state, dt) {
      const vTarget = Math.sqrt(state.params.T) * 9.5;
      for (const m of state.molecules) {
        const sp = Math.hypot(m.vx, m.vy) || 1;
        const k  = U.smooth(sp, vTarget, dt, 0.3) / sp;
        m.vx *= k;
        m.vy *= k;
      }
      state.hitFlashes = state.hitFlashes.filter(f => (f.age += dt) < 0.5);
    },

    render(ctx, state, w, h) {
      Draw.bgGrid(ctx, w, h, 36);

      const { T, V, nu } = state.params;
      const L    = this._layout(state.params, w, h);
      const p_Pa = nu * R_GAS * T / (V / 1000);
      state.pSmoothed = U.smooth(state.pSmoothed || p_Pa, p_Pa, 1 / 60, 0.2);

      // ── Физика молекул: движение + отскок от стенок цилиндра ──────
      const dtSub = 1 / 120;
      const hits  = [];
      for (const m of state.molecules) {
        m.x += m.vx * dtSub;
        m.y += m.vy * dtSub;
        if (m.x - m.r < L.vLeft)  { m.x = L.vLeft  + m.r; m.vx =  Math.abs(m.vx); hits.push({ x: L.vLeft,  y: m.y, side: 'L' }); }
        if (m.x + m.r > L.vRight) { m.x = L.vRight - m.r; m.vx = -Math.abs(m.vx); hits.push({ x: L.vRight, y: m.y, side: 'R' }); }
        if (m.y - m.r < L.top)    { m.y = L.top    + m.r; m.vy =  Math.abs(m.vy); hits.push({ x: m.x, y: L.top,  side: 'T' }); }
        if (m.y + m.r > L.bot)    { m.y = L.bot    - m.r; m.vy = -Math.abs(m.vy); hits.push({ x: m.x, y: L.bot,  side: 'B' }); }
      }
      for (const hh of hits) state.hitFlashes.push({ ...hh, age: 0 });

      // ── Термометр ──────────────────────────────────────────────────
      const tmW   = 14;
      const tmX   = L.tmX + 10;   // центр зоны термометра
      const tmTop = L.top + 8;
      const tmH   = L.vH - 16;
      const Tnorm = U.clamp((T - 100) / 700, 0, 1);
      const fillH = tmH * Tnorm;

      ctx.save();
      ctx.fillStyle = '#0d1219';
      ctx.strokeStyle = '#3a4452';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tmX - 1, tmTop - 1, tmW + 2, tmH + 2, 4);
      ctx.fill();
      ctx.stroke();
      const tmGrad = ctx.createLinearGradient(0, tmTop + tmH, 0, tmTop);
      tmGrad.addColorStop(0, 'rgb(60,140,240)');
      tmGrad.addColorStop(1, `rgb(${Math.round(60 + Tnorm * 195)},${Math.round(180 - Tnorm * 130)},${Math.round(240 - Tnorm * 210)})`);
      ctx.fillStyle = tmGrad;
      ctx.fillRect(tmX, tmTop + (tmH - fillH), tmW, fillH);
      // тики шкалы
      for (let i = 0; i <= 4; i++) {
        const ty = tmTop + tmH * (1 - i / 4);
        ctx.strokeStyle = '#3a4452';
        ctx.beginPath();
        ctx.moveTo(tmX - 5, ty); ctx.lineTo(tmX, ty);
        ctx.stroke();
        Draw.text(ctx, Math.round(100 + i * 175) + '', tmX - 7, ty - 4,
          { color: '#5a6577', font: '8px JetBrains Mono', align: 'right' });
      }
      ctx.restore();
      Draw.text(ctx, 'T', tmX + tmW / 2, tmTop - 17, { color: '#e8edf5', font: 'italic 14px Fraunces, serif', align: 'center' });
      Draw.text(ctx, U.fmt(T, 0) + ' К', tmX + tmW / 2, tmTop + tmH + 8, { color: '#e8edf5', font: '10px JetBrains Mono', align: 'center' });

      // ── Заливка газа внутри цилиндра ──────────────────────────────
      ctx.save();
      const gasGrad = ctx.createLinearGradient(L.vLeft, L.top, L.vRight, L.bot);
      gasGrad.addColorStop(0, 'rgba(124,242,200,0.04)');
      gasGrad.addColorStop(1, 'rgba(90,200,250,0.07)');
      ctx.fillStyle = gasGrad;
      ctx.fillRect(L.vLeft, L.top, L.vW, L.vH);
      ctx.restore();

      // ── Стрелки давления ──────────────────────────────────────────
      const pNorm     = U.clamp(p_Pa / (nu * R_GAS * 800 / 0.010), 0, 1);
      const arrowN    = Math.round(2 + pNorm * 4);
      const arrowLen  = 8 + pNorm * 18;
      const arrowCol  = `rgba(255,107,156,${0.4 + pNorm * 0.5})`;

      const drawArrows = (side) => {
        ctx.save();
        ctx.strokeStyle = arrowCol;
        ctx.fillStyle   = arrowCol;
        ctx.lineWidth   = 1.5;
        if (pNorm > 0.4) { ctx.shadowBlur = 8; ctx.shadowColor = arrowCol; }
        for (let i = 0; i < arrowN; i++) {
          const t = (i + 1) / (arrowN + 1);
          let ax, ay, dx, dy;
          if      (side === 'L') { ax = L.vLeft;  ay = L.top + t * L.vH; dx = -arrowLen; dy = 0; }
          else if (side === 'R') { ax = L.vRight; ay = L.top + t * L.vH; dx =  arrowLen; dy = 0; }
          else if (side === 'T') { ax = L.vLeft + t * L.vW; ay = L.top;  dx = 0; dy = -arrowLen; }
          else                   { ax = L.vLeft + t * L.vW; ay = L.bot;  dx = 0; dy =  arrowLen; }
          const ang = Math.atan2(dy, dx);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + dx, ay + dy); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax + dx, ay + dy);
          ctx.lineTo(ax + dx - 5 * Math.cos(ang - 0.5), ay + dy - 5 * Math.sin(ang - 0.5));
          ctx.lineTo(ax + dx - 5 * Math.cos(ang + 0.5), ay + dy - 5 * Math.sin(ang + 0.5));
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      };
      drawArrows('L'); drawArrows('R'); drawArrows('T'); drawArrows('B');

      // ── Контур цилиндра ───────────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = '#4a5568';
      ctx.lineWidth   = 2;
      ctx.strokeRect(L.vLeft, L.top, L.vW, L.vH);
      // крышки
      ctx.fillStyle = '#1e2a3a';
      ctx.fillRect(L.vLeft - 4, L.top - 10, L.vW + 8, 10);
      ctx.fillRect(L.vLeft - 4, L.bot,      L.vW + 8, 10);
      ctx.strokeStyle = '#5a7090'; ctx.lineWidth = 1;
      ctx.strokeRect(L.vLeft - 4, L.top - 10, L.vW + 8, 10);
      ctx.strokeRect(L.vLeft - 4, L.bot,      L.vW + 8, 10);
      ctx.restore();

      // ── Вспышки ударов ────────────────────────────────────────────
      ctx.save();
      for (const f of state.hitFlashes) {
        const a = (1 - f.age / 0.5) * 0.55;
        ctx.fillStyle = `rgba(124,242,200,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 3 + f.age * 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // ── Молекулы ──────────────────────────────────────────────────
      ctx.save();
      for (const m of state.molecules) {
        const sp    = Math.hypot(m.vx, m.vy);
        const heatN = U.clamp(sp / 200, 0, 1);
        const rr = Math.round(80  + heatN * 175);
        const gg = Math.round(220 - heatN * 80);
        const bb = Math.round(255 - heatN * 200);
        const col = `rgb(${rr},${gg},${bb})`;
        ctx.shadowBlur = 8; ctx.shadowColor = col; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${rr},${gg},${bb},0.3)`; ctx.lineWidth = 1.2; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 0.05, m.y - m.vy * 0.05); ctx.stroke();
      }
      ctx.restore();

      // ── Поршень ───────────────────────────────────────────────────
      const pX = L.pX;
      const pW = L.pistonW;
      // шток — горизонтальная палка вправо от поршня до манометра
      const stemEndX = L.mCX - L.mR - 4;
      ctx.save();
      ctx.strokeStyle = '#7a9ab8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pX + pW, L.mCY);
      ctx.lineTo(stemEndX, L.mCY);
      ctx.stroke();
      // тело
      ctx.fillStyle = '#1e2d40'; ctx.strokeStyle = '#5ac8fa'; ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(90,200,250,0.3)';
      ctx.fillRect(pX, L.top, pW, L.vH);
      ctx.strokeRect(pX, L.top, pW, L.vH);
      // риски
      ctx.strokeStyle = '#2a3e54'; ctx.lineWidth = 1; ctx.shadowBlur = 0;
      for (let yy = L.top + 12; yy < L.bot - 4; yy += 14) {
        ctx.beginPath(); ctx.moveTo(pX + 3, yy); ctx.lineTo(pX + pW - 3, yy); ctx.stroke();
      }
      ctx.restore();
      // подпись объёма под штоком
      Draw.text(ctx, 'поршень',  pX + pW + 8, L.mCY + L.mR + 44, { color: '#8ab8d8', font: '700 13px JetBrains Mono, monospace' });

      // ── Манометр ──────────────────────────────────────────────────
      const { mCX, mCY, mR } = L;
      const pMax   = nu * R_GAS * 800 / 0.010;
      const pNormM = U.clamp(p_Pa / pMax, 0, 1);

      ctx.save();
      ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.fillStyle = '#0d1219';
      ctx.beginPath(); ctx.arc(mCX, mCY, mR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#3a4452'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(mCX, mCY, mR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mCX, mCY, mR - 5, 0, Math.PI * 2); ctx.stroke();
      // тики
      const angStart = Math.PI * 0.72, angEnd = Math.PI * 2.28;
      for (let i = 0; i <= 8; i++) {
        const ta = angStart + (angEnd - angStart) * (i / 8);
        ctx.strokeStyle = i % 2 === 0 ? '#5a6577' : '#3a4452';
        ctx.lineWidth   = i % 2 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(mCX + Math.cos(ta) * (mR - 5), mCY + Math.sin(ta) * (mR - 5));
        ctx.lineTo(mCX + Math.cos(ta) * (mR - 9), mCY + Math.sin(ta) * (mR - 9));
        ctx.stroke();
      }
      ctx.restore();

      // стрелка
      const angArr = angStart + (angEnd - angStart) * pNormM;
      ctx.save();
      ctx.strokeStyle = '#ff6e9c'; ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff6e9c'; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mCX - Math.cos(angArr) * 5, mCY - Math.sin(angArr) * 5);
      ctx.lineTo(mCX + Math.cos(angArr) * (mR - 10), mCY + Math.sin(angArr) * (mR - 10));
      ctx.stroke();
      ctx.fillStyle = '#ff6e9c';
      ctx.beginPath(); ctx.arc(mCX, mCY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      Draw.text(ctx, U.fmt(p_Pa / 1000, 1),  mCX, mCY + 4,      { color: '#ff6e9c', font: '700 14px JetBrains Mono', align: 'center' });
      Draw.text(ctx, 'кПа',                   mCX, mCY + 18,     { color: '#8a96a8', font: '9px JetBrains Mono',      align: 'center' });
      Draw.text(ctx, 'давление',              mCX, mCY + mR + 14, { color: '#5a6577', font: '10px JetBrains Mono',     align: 'center' });

      // ── Нижняя строка: уравнение p·V = ν·R·T с живыми числами ───
      const eqY = L.bot + 24;
      if (eqY + 40 > h) return;

      // Ширина строки = ширина цилиндра + поршень + зазор (без манометра — он выше)
      const eqW  = L.vW + L.pistonW + 28;
      const eqX0 = L.vLeft;

      const parts = [
        { sym: 'p',   val: U.fmt(p_Pa / 1000, 1) + ' кПа', color: '#ff6e9c' },
        { sym: '·',   val: '',  color: '#5a6577' },
        { sym: 'V',   val: U.fmt(V * 0.5, 1) + ' л',  color: '#5ac8fa' },
        { sym: '=',   val: '',  color: '#5a6577' },
        { sym: 'ν',   val: U.fmt(nu, 1) + ' моль', color: '#7cf2c8' },
        { sym: '·R·', val: '',  color: '#5a6577' },
        { sym: 'T',   val: U.fmt(T, 0) + ' К', color: '#ffb86b' },
      ];

      // Равномерно распределяем части по ширине eqW
      const slots    = parts.length;
      const slotW    = eqW / slots;
      parts.forEach((pt, i) => {
        const cx = eqX0 + slotW * i + slotW / 2;
        Draw.text(ctx, pt.sym, cx, eqY,      { color: pt.color, font: 'italic 700 16px Fraunces, serif',      align: 'center' });
        if (pt.val)
          Draw.text(ctx, pt.val, cx, eqY + 18, { color: pt.color, font: '10px JetBrains Mono, monospace', align: 'center' });
      });

      // Подсказка
      const hint = T > 500  ? 'Высокая T → быстрые молекулы → высокое давление'
                 : T < 200  ? 'Низкая T → медленные молекулы → низкое давление'
                 : V < 25   ? 'Малый V → молекулы чаще бьют по стенкам → давление растёт'
                 :             'Изменяйте T, V, ν и наблюдайте за уравнением';
      Draw.text(ctx, hint, eqX0 + eqW / 2, eqY + 36,
        { color: '#5a6577', font: '10px JetBrains Mono, monospace', align: 'center' });
    }
  });
})();
