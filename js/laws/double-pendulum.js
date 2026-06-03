/* =========================================================
   PHYSICA · Двойной маятник (детерминированный хаос)
   Уравнения из Lagrangian mechanics — стандартный вывод.
   Интегратор: чистый RK4 (без смешения со symplectic).
   θ = 0 → маятник висит вертикально вниз.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;
  const TRAIL_MAX = 500;

  // Производные по Лагранжу (стандартная форма)
  function deriv(th1, th2, w1, w2, p) {
    const { m1, m2, L1, L2, g } = p;
    const M  = m1 + m2;
    const d  = th1 - th2;
    const cd = Math.cos(d), sd = Math.sin(d);
    const denom = 2*m1 + m2 - m2*Math.cos(2*d);

    const a1 = (
      -g*(2*m1+m2)*Math.sin(th1)
      - m2*g*Math.sin(th1-2*th2)
      - 2*sd*m2*(w2*w2*L2 + w1*w1*L1*cd)
    ) / (L1 * denom);

    const a2 = (
      2*sd*(
        w1*w1*L1*M
        + g*M*Math.cos(th1)
        + w2*w2*L2*m2*cd
      )
    ) / (L2 * denom);

    return { a1, a2 };
  }

  // Чистый RK4 для системы [th1, th2, w1, w2]
  function rk4Step(th1, th2, w1, w2, p, h) {
    const f = (t1,t2,v1,v2) => {
      const d = deriv(t1,t2,v1,v2,p);
      return { dt1: v1, dt2: v2, dv1: d.a1, dv2: d.a2 };
    };

    const k1 = f(th1,              th2,              w1,              w2);
    const k2 = f(th1+h*k1.dt1/2,  th2+h*k1.dt2/2,  w1+h*k1.dv1/2,  w2+h*k1.dv2/2);
    const k3 = f(th1+h*k2.dt1/2,  th2+h*k2.dt2/2,  w1+h*k2.dv1/2,  w2+h*k2.dv2/2);
    const k4 = f(th1+h*k3.dt1,    th2+h*k3.dt2,    w1+h*k3.dv1,    w2+h*k3.dv2);

    return {
      th1: th1 + h*(k1.dt1 + 2*k2.dt1 + 2*k3.dt1 + k4.dt1)/6,
      th2: th2 + h*(k1.dt2 + 2*k2.dt2 + 2*k3.dt2 + k4.dt2)/6,
      w1:  w1  + h*(k1.dv1 + 2*k2.dv1 + 2*k3.dv1 + k4.dv1)/6,
      w2:  w2  + h*(k1.dv2 + 2*k2.dv2 + 2*k3.dv2 + k4.dv2)/6,
    };
  }

  Laws.register({
    id: 'double-pendulum',
    group: '1.14',
    title: 'Двойной маятник',
    description: 'Классический пример детерминированного хаоса. При малых отклонениях движение почти периодично; при больших — абсолютно непредсказуемо.',
    formula: 'θ̈ = f(θ₁,θ₂,ω₁,ω₂)',

    params: [
      { id: 'L1',  label: 'Длина звена 1', latex: 'L₁', min: 0.3, max: 1.5, step: 0.05, value: 1.0,  default: 1.0,  unit: 'м',   type: 'range' },
      { id: 'L2',  label: 'Длина звена 2', latex: 'L₂', min: 0.3, max: 1.5, step: 0.05, value: 1.0,  default: 1.0,  unit: 'м',   type: 'range' },
      { id: 'm1',  label: 'Масса груза 1', latex: 'm₁', min: 0.2, max: 3.0, step: 0.1,  value: 1.0,  default: 1.0,  unit: 'кг',  type: 'range' },
      { id: 'm2',  label: 'Масса груза 2', latex: 'm₂', min: 0.2, max: 3.0, step: 0.1,  value: 1.0,  default: 1.0,  unit: 'кг',  type: 'range' },
      { id: 'th1', label: 'Нач. угол θ₁', latex: 'θ₁', min: 5,   max: 175, step: 1,    value: 120,  default: 120,  unit: '°',   type: 'range' },
      { id: 'th2', label: 'Нач. угол θ₂', latex: 'θ₂', min: 5,   max: 175, step: 1,    value: 150,  default: 150,  unit: '°',   type: 'range' },
      { id: 'g',   label: 'Скорость симуляции', latex: '',  min: 1.0, max: 25, step: 0.1, value: 10,   default: 10,   unit: '',    type: 'range' },
    ],

    readout(s) {
      return [
        { k: 'E',    v: U.fmt(s._E || 0, 2) + ' Дж' },
        { k: 'θ₁',   v: U.fmt(((s.th1||0)*180/Math.PI%360+360)%360, 1) + '°' },
        { k: 'θ₂',   v: U.fmt(((s.th2||0)*180/Math.PI%360+360)%360, 1) + '°' },
        { k: 'хаос', v: (s._chaos||0) > 0.65 ? '🔴 высокий' : (s._chaos||0) > 0.25 ? '🟡 средний' : '🟢 низкий' },
      ];
    },

    init(ctx, state, w, h) { this._doReset(state); },
    reset(state)            { this._doReset(state); },
    onParam(id, _v, state)  { this._doReset(state); },

    _doReset(state) {
      state.th1    = state.params.th1 * Math.PI / 180;
      state.th2    = state.params.th2 * Math.PI / 180;
      state.w1     = 0;
      state.w2     = 0;
      state.trail  = [];
      state._E     = 0;
      state._chaos = 0;
    },

    update(state, dt) {
      const p = state.params;
      // Адаптивное число шагов: больше при высоких скоростях
      const maxW  = Math.max(Math.abs(state.w1), Math.abs(state.w2), 1);
      const steps = Math.min(32, Math.max(8, Math.ceil(maxW * 4)));
      const h     = dt / steps;

      for (let i = 0; i < steps; i++) {
        const next = rk4Step(state.th1, state.th2, state.w1, state.w2, p, h);
        state.th1 = next.th1;
        state.th2 = next.th2;
        state.w1  = next.w1;
        state.w2  = next.w2;
      }

      // Полная механическая энергия (для проверки)
      const { m1, m2, L1, L2, g } = p;
      const { th1, th2, w1, w2 } = state;
      const vx1 =  L1 * w1 * Math.cos(th1);
      const vy1 =  L1 * w1 * Math.sin(th1);
      const vx2 =  vx1 + L2 * w2 * Math.cos(th2);
      const vy2 =  vy1 + L2 * w2 * Math.sin(th2);
      const Ek  =  0.5*m1*(vx1*vx1+vy1*vy1) + 0.5*m2*(vx2*vx2+vy2*vy2);
      const Ep  = -m1*g*L1*Math.cos(th1) - m2*g*(L1*Math.cos(th1)+L2*Math.cos(th2));
      state._E  =  Ek + Ep;

      const w2n = Math.min(Math.abs(state.w2)/8, 1);
      state._chaos = U.smooth(state._chaos||0, w2n, dt, 0.5);
    },

    render(ctx, state, w, h) {
      const mobile = w < 480;

      ctx.save();
      ctx.fillStyle = 'rgba(7,10,15,0.22)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      Draw.bgGrid(ctx, w, h, 44, 'rgba(255,255,255,0.02)');

      const { L1, L2, m1, m2 } = state.params;
      const maxLen = L1 + L2;
      const scale  = Math.min(w * (mobile ? 0.44 : 0.30), h * (mobile ? 0.44 : 0.38)) / maxLen;

      const pivX = mobile ? w * 0.50 : w * 0.40;
      const pivY = h * (mobile ? 0.20 : 0.22);

      // Координаты (θ=0 → вниз; sin → X, cos → Y вниз в canvas)
      const b1x = pivX + Math.sin(state.th1) * L1 * scale;
      const b1y = pivY + Math.cos(state.th1) * L1 * scale;
      const b2x = b1x  + Math.sin(state.th2) * L2 * scale;
      const b2y = b1y  + Math.cos(state.th2) * L2 * scale;

      const chaos = state._chaos || 0;
      const cR = Math.round(124 + (255-124)*chaos);
      const cG = Math.round(242 + (107-242)*chaos);
      const cB = Math.round(200 + ( 60-200)*chaos);
      const trailCol = `rgb(${cR},${cG},${cB})`;

      // Трек в физических координатах — не зависит от размера canvas
      state.trail.push({ th1: state.th1, th2: state.th2 });
      if (state.trail.length > TRAIL_MAX) state.trail.shift();

      // Перевод физических координат трека в пиксельные
      const trailToPx = (pt) => ({
        x: pivX + Math.sin(pt.th1)*L1*scale + Math.sin(pt.th2)*L2*scale,
        y: pivY + Math.cos(pt.th1)*L1*scale + Math.cos(pt.th2)*L2*scale,
      });

      if (state.trail.length > 2) {
        ctx.save();
        ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const n = state.trail.length;
        for (let i = 1; i < n; i++) {
          const a = i / n;
          const r = Math.round(50 + (cR-50)*a);
          const g = Math.round(80 + (cG-80)*a);
          const b = Math.round(120+(cB-120)*a);
          ctx.strokeStyle = `rgba(${r},${g},${b},${(a*0.75).toFixed(3)})`;
          const p0 = trailToPx(state.trail[i-1]);
          const p1 = trailToPx(state.trail[i]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Крепление
      ctx.save();
      ctx.fillStyle = '#8a96a8';
      ctx.beginPath();
      ctx.moveTo(pivX-12, pivY-6); ctx.lineTo(pivX+12, pivY-6);
      ctx.lineTo(pivX+12, pivY-14); ctx.lineTo(pivX-12, pivY-14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a96a8';
      ctx.beginPath(); ctx.arc(pivX, pivY, 4, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // Звено 1
      ctx.save();
      ctx.strokeStyle = 'rgba(232,237,245,0.85)';
      ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(b1x, b1y); ctx.stroke();
      ctx.restore();

      // Шар 1
      const r1 = U.clamp(7 + m1*3.5, 7, 22);
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = '#7cf2c8';
      const g1 = ctx.createRadialGradient(b1x-r1*0.3, b1y-r1*0.3, 1, b1x, b1y, r1);
      g1.addColorStop(0, '#d6fff0'); g1.addColorStop(1, '#2a7a62');
      ctx.fillStyle = g1; ctx.strokeStyle = '#7cf2c8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b1x, b1y, r1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // Звено 2
      ctx.save();
      ctx.strokeStyle = 'rgba(192,200,216,0.75)';
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b1x, b1y); ctx.lineTo(b2x, b2y); ctx.stroke();
      ctx.restore();

      // Шар 2
      const r2 = U.clamp(7 + m2*3.5, 7, 22);
      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = trailCol;
      const g2 = ctx.createRadialGradient(b2x-r2*0.3, b2y-r2*0.3, 1, b2x, b2y, r2);
      g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, trailCol);
      ctx.fillStyle = g2; ctx.strokeStyle = trailCol; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b2x, b2y, r2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // ── Панель: только на десктопе ────────────────────────────
      if (mobile) {
        Draw.text(ctx,
          `E=${U.fmt(state._E,2)} Дж  ω₁=${U.fmt(state.w1,1)}  ω₂=${U.fmt(state.w2,1)}`,
          w/2, h-10, { color: '#5a6577', align: 'center', font: '10px JetBrains Mono' });
        return;
      }

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

      Draw.text(ctx, 'траектория конца', panX+panW/2, panY+8,
        { color: '#5a6577', align: 'center', font: '9px JetBrains Mono' });

      const axCX = panX+panW/2, axCY = panY+panH/2;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axCX, panY+8); ctx.lineTo(axCX, panY+panH-8);
      ctx.moveTo(panX+8, axCY); ctx.lineTo(panX+panW-8, axCY);
      ctx.stroke();
      ctx.restore();

      const totLen = (L1+L2)*scale;
      const toPanel = (px, py) => ({
        px: axCX + (px-pivX)/totLen*(panW/2-10),
        py: axCY + (py-pivY)/totLen*(panH/2-10),
      });

      const n = state.trail.length;
      if (n > 2) {
        ctx.save();
        ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
        const tail = Math.min(n, 300);
        for (let i = n-tail+1; i < n; i++) {
          const a = (i-(n-tail))/tail;
          const rr = Math.round(30+(cR-30)*a);
          const gg = Math.round(40+(cG-40)*a);
          const bb = Math.round(80+(cB-80)*a);
          ctx.strokeStyle = `rgba(${rr},${gg},${bb},${(a*0.85).toFixed(3)})`;
          const px0 = trailToPx(state.trail[i-1]);
          const px1 = trailToPx(state.trail[i]);
          const p0 = toPanel(px0.x, px0.y);
          const p1 = toPanel(px1.x, px1.y);
          ctx.beginPath(); ctx.moveTo(p0.px, p0.py); ctx.lineTo(p1.px, p1.py); ctx.stroke();
        }
        const cur = toPanel(b2x, b2y);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10; ctx.shadowColor = trailCol;
        ctx.beginPath(); ctx.arc(cur.px, cur.py, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }

      const chaosLabel = chaos > 0.65 ? 'ХАОС' : chaos > 0.25 ? 'ПЕРЕХОД' : 'ПОРЯДОК';
      const chaosColor = chaos > 0.65 ? '#ff6e9c' : chaos > 0.25 ? '#ffb86b' : '#7cf2c8';
      Draw.text(ctx, chaosLabel, panX+panW/2, panY+panH-26,
        { color: chaosColor, align: 'center', font: 'bold 11px JetBrains Mono' });

      const bx2 = panX+10, by2 = panY+panH-12, bw2 = panW-20;
      ctx.save();
      ctx.fillStyle = '#111a26'; ctx.fillRect(bx2, by2, bw2, 5);
      const cg = ctx.createLinearGradient(bx2, 0, bx2+bw2, 0);
      cg.addColorStop(0, '#7cf2c8'); cg.addColorStop(0.5, '#ffb86b'); cg.addColorStop(1, '#ff6e9c');
      ctx.fillStyle = cg; ctx.fillRect(bx2, by2, bw2*chaos, 5);
      ctx.restore();

      Draw.text(ctx,
        `E=${U.fmt(state._E,2)} Дж  ω₁=${U.fmt(state.w1,2)}  ω₂=${U.fmt(state.w2,2)}`,
        w*0.40, h-12, { color: '#5a6577', align: 'center', font: '10px JetBrains Mono' });
    },
  });
})();
