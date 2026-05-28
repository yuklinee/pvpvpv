/* =========================================================
   PHYSICA · Двойной маятник (детерминированный хаос)
   θ̈₁, θ̈₂ — классические уравнения Лагранжа (Meriläinen form)

   Углы отсчитываются от вертикали вниз (θ=0 → маятник висит).
   В canvas: x = sin(θ), y = cos(θ) → y направлен вниз (вправильно).

   Интегратор: RK4 с подшагами — энергия стабильна.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const TRAIL_MAX = 600;

  // ── Точные уравнения движения двойного маятника ──────────────
  // Источник: Meriläinen / Marsden & Ratiu, стандартный вывод через лагранжиан.
  // θ₁, θ₂ — углы от вертикали; ω₁=dθ₁/dt, ω₂=dθ₂/dt
  function deriv(th1, th2, w1, w2, m1, m2, L1, L2, g) {
    const M   = m1 + m2;
    const Δ   = th1 - th2;
    const cos_ = Math.cos(Δ);
    const sin_ = Math.sin(Δ);
    const det  = L1 * L2 * (2 * m1 + m2 - m2 * Math.cos(2 * Δ)); // знаменатель

    const dw1 = (
      -g * (2 * m1 + m2) * Math.sin(th1)
      - m2 * g * Math.sin(th1 - 2 * th2)
      - 2 * sin_ * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * cos_)
    ) / det;

    const dw2 = (
      2 * sin_ * (
        w1 * w1 * L1 * M
        + g * M * Math.cos(th1)
        + w2 * w2 * L2 * m2 * cos_
      )
    ) / det;

    return { dw1, dw2 };
  }

  Laws.register({
    id: 'double-pendulum',
    group: '1.14',
    title: 'Двойной маятник',
    description: 'Классический пример детерминированного хаоса. При малых отклонениях — почти периодическое движение; при больших — абсолютно непредсказуемое. Система чрезвычайно чувствительна к начальным условиям.',
    formula: 'θ̈ = f(θ₁,θ₂,ω₁,ω₂,m,L,g)',

    params: [
      { id: 'L1',  label: 'Длина звена 1', latex: 'L₁', min: 0.3, max: 1.5, step: 0.05, value: 1.0,  default: 1.0,  unit: 'м',   type: 'range' },
      { id: 'L2',  label: 'Длина звена 2', latex: 'L₂', min: 0.3, max: 1.5, step: 0.05, value: 1.0,  default: 1.0,  unit: 'м',   type: 'range' },
      { id: 'm1',  label: 'Масса груза 1', latex: 'm₁', min: 0.2, max: 3.0, step: 0.1,  value: 1.0,  default: 1.0,  unit: 'кг',  type: 'range' },
      { id: 'm2',  label: 'Масса груза 2', latex: 'm₂', min: 0.2, max: 3.0, step: 0.1,  value: 1.0,  default: 1.0,  unit: 'кг',  type: 'range' },
      { id: 'th1', label: 'Нач. угол θ₁', latex: 'θ₁', min: 5,   max: 175, step: 1,    value: 130,  default: 130,  unit: '°',   type: 'range' },
      { id: 'th2', label: 'Нач. угол θ₂', latex: 'θ₂', min: 5,   max: 175, step: 1,    value: 155,  default: 155,  unit: '°',   type: 'range' },
      { id: 'g',   label: 'Ускорение g',  latex: 'g',  min: 1.0, max: 25,  step: 0.1,  value: 9.81, default: 9.81, unit: 'м/с²',type: 'range' },
    ],

    readout(s) {
      return [
        { k: 'E',    v: U.fmt(s._E || 0, 3) + ' Дж' },
        { k: 'θ₁',   v: U.fmt(((s.th1 || 0) * 180 / Math.PI + 360) % 360, 1) + '°' },
        { k: 'θ₂',   v: U.fmt(((s.th2 || 0) * 180 / Math.PI + 360) % 360, 1) + '°' },
        { k: 'хаос', v: (s._chaos || 0) > 0.65 ? '🔴 высокий' : (s._chaos || 0) > 0.25 ? '🟡 средний' : '🟢 низкий' },
      ];
    },

    init(ctx, state, w, h) {
      this._doReset(state);
    },

    _doReset(state) {
      state.th1    = state.params.th1 * Math.PI / 180;
      state.th2    = state.params.th2 * Math.PI / 180;
      state.w1     = 0;
      state.w2     = 0;
      state.trail  = [];
      state._E     = 0;
      state._chaos = 0;
    },

    reset(state) { this._doReset(state); },

    onParam(id, _val, state) {
      // При смене любого параметра — перезапуск с новыми нач. условиями
      // (движок уже записал новое значение в state.params к этому моменту)
      this._doReset(state);
    },

    update(state, dt) {
      const { L1, L2, m1, m2, g } = state.params;

      // RK4: правильная реализация — каждый ki вычисляется из промежуточного состояния
      const steps = 16; // много шагов — хаотические системы чувствительны к точности
      const h = dt / steps;

      for (let s = 0; s < steps; s++) {
        const { th1, th2, w1, w2 } = state;

        // k1 — производные в текущей точке
        const k1 = deriv(th1,               th2,               w1,                w2,                m1, m2, L1, L2, g);
        // k2 — производные в середине шага, используя k1
        const k2 = deriv(th1 + w1*h/2,      th2 + w2*h/2,      w1 + k1.dw1*h/2,  w2 + k1.dw2*h/2,  m1, m2, L1, L2, g);
        // k3 — производные в середине шага, используя k2
        const k3 = deriv(th1 + (w1+k1.dw1*h/2)*h/2, th2 + (w2+k1.dw2*h/2)*h/2,
                         w1 + k2.dw1*h/2,  w2 + k2.dw2*h/2,  m1, m2, L1, L2, g);
        // k4 — производные в конце шага, используя k3
        const k4 = deriv(th1 + (w1+k2.dw1*h/2)*h,   th2 + (w2+k2.dw2*h/2)*h,
                         w1 + k3.dw1*h,    w2 + k3.dw2*h,    m1, m2, L1, L2, g);

        const dw1 = (k1.dw1 + 2*k2.dw1 + 2*k3.dw1 + k4.dw1) / 6;
        const dw2 = (k1.dw2 + 2*k2.dw2 + 2*k3.dw2 + k4.dw2) / 6;
        const dth1 = w1 + (k1.dw1 + k2.dw1) / 2 * h / 2; // средняя скорость за шаг
        const dth2 = w2 + (k1.dw2 + k2.dw2) / 2 * h / 2;

        state.w1  += dw1 * h;
        state.w2  += dw2 * h;
        state.th1 += state.w1 * h; // используем уже обновлённую скорость (symplectic)
        state.th2 += state.w2 * h;
      }

      // Полная механическая энергия
      const { th1, th2, w1, w2 } = state;
      const Ek = 0.5 * m1 * (L1*w1)**2
               + 0.5 * m2 * (
                   (L1*w1*Math.cos(th1) + L2*w2*Math.cos(th2))**2 +
                   (L1*w1*Math.sin(th1) + L2*w2*Math.sin(th2))**2
                 );
      const Ep = -(m1 + m2) * g * L1 * Math.cos(th1) - m2 * g * L2 * Math.cos(th2);
      state._E = Ek + Ep;

      // Индикатор хаоса: |w2| нормированный
      const w2n = Math.min(Math.abs(state.w2) / 10, 1);
      state._chaos = U.smooth(state._chaos || 0, w2n, dt, 0.5);
    },

    render(ctx, state, w, h) {
      // Полупрозрачный фон — даёт красивый «тающий» след
      ctx.save();
      ctx.fillStyle = 'rgba(7,10,15,0.20)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      Draw.bgGrid(ctx, w, h, 44, 'rgba(255,255,255,0.02)');

      const { L1, L2, m1, m2 } = state.params;

      // Масштаб: чтобы оба звена при θ=90° помещались в ~60% высоты
      const maxLen = (L1 + L2);
      const scale  = Math.min(w * 0.30, h * 0.38) / maxLen;

      // Точка подвеса
      const pivX = w * 0.40;
      const pivY = h * 0.22;

      // Координаты шаров (θ от вертикали: x=sin, y=cos в canvas-системе)
      const b1x = pivX + Math.sin(state.th1) * L1 * scale;
      const b1y = pivY + Math.cos(state.th1) * L1 * scale;
      const b2x = b1x  + Math.sin(state.th2) * L2 * scale;
      const b2y = b1y  + Math.cos(state.th2) * L2 * scale;

      // Цвет: от мятного (порядок) к алому (хаос)
      const chaos = state._chaos || 0;
      const cR = Math.round(124 + (255 - 124) * chaos);
      const cG = Math.round(242 + (107 - 242) * chaos);
      const cB = Math.round(200 + ( 60 - 200) * chaos);
      const trailCol = `rgb(${cR},${cG},${cB})`;

      // Трек
      state.trail.push({ x: b2x, y: b2y });
      if (state.trail.length > TRAIL_MAX) state.trail.shift();

      if (state.trail.length > 2) {
        ctx.save();
        ctx.lineWidth = 1.6;
        ctx.lineJoin  = 'round';
        ctx.lineCap   = 'round';
        const n = state.trail.length;
        for (let i = 1; i < n; i++) {
          const a = i / n;
          const r = Math.round(50  + (cR - 50)  * a);
          const g = Math.round(80  + (cG - 80)  * a);
          const b = Math.round(120 + (cB - 120) * a);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(a * 0.75).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(state.trail[i-1].x, state.trail[i-1].y);
          ctx.lineTo(state.trail[i].x,   state.trail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Крепление к стене
      ctx.save();
      ctx.fillStyle   = '#8a96a8';
      ctx.strokeStyle = '#5a6577';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(pivX - 12, pivY - 14);
      ctx.lineTo(pivX + 12, pivY - 14);
      ctx.lineTo(pivX + 12, pivY - 6);
      ctx.lineTo(pivX - 12, pivY - 6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Засечки
      for (let xi = -10; xi <= 10; xi += 5) {
        ctx.beginPath();
        ctx.moveTo(pivX + xi, pivY - 14);
        ctx.lineTo(pivX + xi - 4, pivY - 20);
        ctx.stroke();
      }
      // Штырь
      ctx.fillStyle = '#8a96a8';
      ctx.beginPath(); ctx.arc(pivX, pivY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Звено 1
      ctx.save();
      ctx.strokeStyle = 'rgba(232,237,245,0.85)';
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(b1x, b1y); ctx.stroke();
      ctx.restore();

      // Шар 1
      const r1 = U.clamp(7 + m1 * 3.5, 7, 22);
      ctx.save();
      ctx.shadowBlur  = 12; ctx.shadowColor = '#7cf2c8';
      const gr1 = ctx.createRadialGradient(b1x - r1*0.3, b1y - r1*0.3, 1, b1x, b1y, r1);
      gr1.addColorStop(0, '#d6fff0'); gr1.addColorStop(1, '#2a7a62');
      ctx.fillStyle = gr1; ctx.strokeStyle = '#7cf2c8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b1x, b1y, r1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // Звено 2
      ctx.save();
      ctx.strokeStyle = 'rgba(192,200,216,0.75)';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(b1x, b1y); ctx.lineTo(b2x, b2y); ctx.stroke();
      ctx.restore();

      // Шар 2
      const r2 = U.clamp(7 + m2 * 3.5, 7, 22);
      ctx.save();
      ctx.shadowBlur  = 16; ctx.shadowColor = trailCol;
      const gr2 = ctx.createRadialGradient(b2x - r2*0.3, b2y - r2*0.3, 1, b2x, b2y, r2);
      gr2.addColorStop(0, '#ffffff'); gr2.addColorStop(1, trailCol);
      ctx.fillStyle = gr2; ctx.strokeStyle = trailCol; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b2x, b2y, r2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // ── Правая панель ──────────────────────────────────────────
      const panX = Math.round(w * 0.68);
      const panW = w - panX - 14;
      const panY = 14;
      const panH = h - 28;
      if (panW < 80 || panH < 80) return;

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 8); ctx.fill(); ctx.stroke();
      ctx.restore();

      // Заголовок
      Draw.text(ctx, 'траектория конца', panX + panW/2, panY + 8,
        { color: '#5a6577', align: 'center', font: '9px JetBrains Mono' });

      // Оси
      const axCX = panX + panW/2, axCY = panY + panH/2;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axCX, panY+8); ctx.lineTo(axCX, panY+panH-8);
      ctx.moveTo(panX+8, axCY); ctx.lineTo(panX+panW-8, axCY);
      ctx.stroke();
      ctx.restore();

      // Трек конца маятника в пространстве, нормированный в панель
      const totLen = (L1 + L2) * scale;
      const toPanel = (px, py) => ({
        px: axCX + (px - pivX) / totLen * (panW/2 - 10),
        py: axCY + (py - pivY) / totLen * (panH/2 - 10),
      });

      const n = state.trail.length;
      if (n > 2) {
        ctx.save();
        ctx.lineWidth = 1.2;
        ctx.lineJoin  = 'round';
        const tail = Math.min(n, 300);
        for (let i = n - tail + 1; i < n; i++) {
          const a  = (i - (n - tail)) / tail;
          const rr = Math.round(30  + (cR - 30)  * a);
          const gg = Math.round(40  + (cG - 40)  * a);
          const bb = Math.round(80  + (cB - 80)  * a);
          ctx.strokeStyle = `rgba(${rr},${gg},${bb},${(a * 0.85).toFixed(3)})`;
          const p0 = toPanel(state.trail[i-1].x, state.trail[i-1].y);
          const p1 = toPanel(state.trail[i].x,   state.trail[i].y);
          ctx.beginPath(); ctx.moveTo(p0.px, p0.py); ctx.lineTo(p1.px, p1.py); ctx.stroke();
        }
        // Текущая позиция
        const cur = toPanel(b2x, b2y);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10; ctx.shadowColor = trailCol;
        ctx.beginPath(); ctx.arc(cur.px, cur.py, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // Индикатор хаоса
      const chaosLabel = chaos > 0.65 ? 'ХАОС' : chaos > 0.25 ? 'ПЕРЕХОД' : 'ПОРЯДОК';
      const chaosColor = chaos > 0.65 ? '#ff6e9c' : chaos > 0.25 ? '#ffb86b' : '#7cf2c8';
      Draw.text(ctx, chaosLabel, panX + panW/2, panY + panH - 26,
        { color: chaosColor, align: 'center', font: 'bold 11px JetBrains Mono' });

      // Полоска хаоса
      const bx = panX + 10, by = panY + panH - 12, bw = panW - 20;
      ctx.save();
      ctx.fillStyle = '#111a26';
      ctx.fillRect(bx, by, bw, 5);
      const cg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      cg.addColorStop(0, '#7cf2c8'); cg.addColorStop(0.5, '#ffb86b'); cg.addColorStop(1, '#ff6e9c');
      ctx.fillStyle = cg;
      ctx.fillRect(bx, by, bw * chaos, 5);
      ctx.restore();

      // Нижняя строка
      Draw.text(ctx,
        `E = ${U.fmt(state._E, 2)} Дж  |  ω₁ = ${U.fmt(state.w1, 2)}  ω₂ = ${U.fmt(state.w2, 2)}`,
        pivX, h - 12,
        { color: '#5a6577', align: 'center', font: '10px JetBrains Mono' });
    },
  });
})();
