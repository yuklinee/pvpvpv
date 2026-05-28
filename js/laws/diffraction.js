/* =========================================================
   PHYSICA · Дифракция Фраунгофера (одиночная щель)
   I(θ) = I₀ · [sin(α)/α]²,  α = π·a·sin(θ)/λ

   Левая часть: плоская волна падает на щель — гюйгенсовские
   вторичные источники в апертуре, волны расходятся веером.
   Правая часть: экран с реальным профилем интенсивности
   и цветовой полосой (длина волны → видимый цвет).
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  // Перевод длины волны в RGB (та же модель, что в young.js)
  function waveToRGB(lam) {
    let R = 0, G = 0, B = 0;
    if      (lam < 440) { R = -(lam-440)/60; B = 1; }
    else if (lam < 490) { G = (lam-440)/50;  B = 1; }
    else if (lam < 510) { G = 1; B = -(lam-510)/20; }
    else if (lam < 580) { R = (lam-510)/70;  G = 1; }
    else if (lam < 645) { R = 1; G = -(lam-645)/65; }
    else                { R = 1; }
    let f = 1;
    if (lam < 420)      f = 0.3 + 0.7*(lam-380)/40;
    else if (lam > 700) f = 0.3 + 0.7*(740-lam)/40;
    return {
      r: Math.round(Math.max(0,Math.min(1,R))*f*255),
      g: Math.round(Math.max(0,Math.min(1,G))*f*255),
      b: Math.round(Math.max(0,Math.min(1,B))*f*255),
    };
  }

  Laws.register({
    id: 'diffraction',
    group: 'BETA',
    title: 'Дифракция на щели',
    description: 'Фраунгоферова дифракция: плоская волна огибает одиночную щель. Интенсивность на экране описывается функцией sinc². Центральный максимум вдвое шире боковых; минимумы там, где a·sinθ = mλ.',
    formula: 'I = I₀·[sin(α)/α]²',

    params: [
      { id: 'lambda', label: 'Длина волны',   latex: 'λ', min: 380, max: 740, step: 5,   value: 540, default: 540, unit: 'нм',  type: 'range' },
      { id: 'a',      label: 'Ширина щели',   latex: 'a', min: 1,   max: 20,  step: 0.5, value: 6,   default: 6,   unit: 'мкм', type: 'range' },
      { id: 'L',      label: 'До экрана',     latex: 'L', min: 100, max: 1000,step: 10,  value: 500, default: 500, unit: 'у.е.',type: 'range' },
      { id: 'showHuygens', label: 'Волны Гюйгенса', type: 'toggle', value: 1, default: 1 },
    ],

    readout(s) {
      // Положение первого минимума: y₁ = λ·L/a  (в тех же усл. единицах)
      const lam_um = s.params.lambda / 1000;
      const y1 = lam_um * s.params.L / s.params.a;
      return [
        { k: 'y₁',   v: U.fmt(y1, 1) + ' у.е.' },
        { k: 'a/λ',  v: U.fmt(s.params.a * 1000 / s.params.lambda, 2) },
      ];
    },

    init(ctx, state, w, h) {
      state.phase = 0;
    },

    update(state, dt) {
      state.phase += dt * 3.5;
    },

    render(ctx, state, w, h, t) {
      Draw.bgGrid(ctx, w, h, 36);

      const { lambda, a, L, showHuygens } = state.params;
      const rgb = waveToRGB(lambda);
      const col = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      const colA = (alpha) => `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;

      // ── Геометрия сцены ────────────────────────────────────────
      const pad    = Math.min(w, h) * 0.06;
      const barrX  = w * 0.30;   // барьер со щелью
      const screenX = w - pad - 24; // экран справа
      const cy     = h / 2;

      // Высота щели в пикселях — масштабируем a [1..20 мкм] → [10..100 px]
      const slitH  = U.clamp(a * 5, 10, Math.min(100, h * 0.25));
      const slitY0 = cy - slitH / 2;
      const slitY1 = cy + slitH / 2;

      // ── Падающая плоская волна (левее барьера) ─────────────────
      ctx.save();
      const waveSep = 28; // пикселей между гребнями
      const phOff   = (state.phase * waveSep) % waveSep;
      for (let x = pad; x < barrX - 6; x += waveSep) {
        const xp = x + phOff;
        if (xp >= barrX - 6) continue;
        const alpha = 0.25 + 0.2 * Math.sin((xp / waveSep) * Math.PI);
        ctx.strokeStyle = colA(alpha);
        ctx.lineWidth   = 1.2;
        ctx.beginPath(); ctx.moveTo(xp, pad * 0.5); ctx.lineTo(xp, h - pad * 0.5); ctx.stroke();
      }
      // Стрелки направления
      for (let y = pad * 1.5; y < h - pad; y += 60) {
        ctx.strokeStyle = colA(0.35);
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(barrX - 20, y); ctx.stroke();
        ctx.fillStyle = colA(0.35);
        ctx.beginPath();
        ctx.moveTo(barrX - 20, y);
        ctx.lineTo(barrX - 27, y - 4);
        ctx.lineTo(barrX - 27, y + 4);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      // ── Барьер со щелью ────────────────────────────────────────
      ctx.save();
      ctx.fillStyle   = '#1a2230';
      ctx.strokeStyle = '#3a4452';
      ctx.lineWidth   = 1;
      // верхняя часть
      ctx.fillRect(barrX - 5, 0, 10, slitY0);
      ctx.strokeRect(barrX - 5, 0, 10, slitY0);
      // нижняя часть
      ctx.fillRect(barrX - 5, slitY1, 10, h - slitY1);
      ctx.strokeRect(barrX - 5, slitY1, 10, h - slitY1);
      // подсветка щели
      ctx.shadowBlur  = 12; ctx.shadowColor = col;
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.moveTo(barrX, slitY0); ctx.lineTo(barrX, slitY1); ctx.stroke();
      ctx.restore();
      Draw.text(ctx, `a = ${U.fmt(a, 1)} мкм`, barrX, slitY0 - 14,
        { color: col, align: 'center', font: '10px JetBrains Mono, monospace' });

      // ── Волны Гюйгенса (за барьером) ──────────────────────────
      if (showHuygens) {
        // Несколько вторичных источников внутри щели
        const nSrc  = 7;
        const waveSpeedPx = 90; // условн. пикс/сек
        ctx.save();
        for (let si = 0; si < nSrc; si++) {
          const sy = slitY0 + (si + 0.5) * slitH / nSrc;
          const maxR = screenX - barrX;
          const phaseOffset = (state.phase * waveSpeedPx / 28) % 1;
          for (let ri = 0; ri < 8; ri++) {
            const r = ((ri + phaseOffset) / 8) * maxR;
            if (r < 2) continue;
            const alpha = 0.22 * (1 - r / maxR);
            if (alpha < 0.01) continue;
            ctx.strokeStyle = colA(alpha);
            ctx.lineWidth   = 0.8;
            ctx.beginPath();
            // Только правая полуокружность
            ctx.arc(barrX, sy, r, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // ── Зона дифракции (тонированный фон между барьером и экраном) ─
      // Рисуем градиент-«клин», показывающий расширение пучка
      {
        const lam_um = lambda / 1000;
        // Угол первого минимума θ₁ = arcsin(λ/a)
        const sinT1 = U.clamp(lam_um / a, 0, 0.99);
        const halfSpread = Math.asin(sinT1);
        const spreadPx = (screenX - barrX) * Math.tan(halfSpread);

        ctx.save();
        const grd = ctx.createLinearGradient(barrX, 0, screenX, 0);
        grd.addColorStop(0, colA(0.18));
        grd.addColorStop(1, colA(0.04));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(barrX, cy - slitH / 2);
        ctx.lineTo(screenX, cy - slitH / 2 - spreadPx * 2.5);
        ctx.lineTo(screenX, cy + slitH / 2 + spreadPx * 2.5);
        ctx.lineTo(barrX, cy + slitH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ── Экран: дифракционная картина ───────────────────────────
      // Интенсивность: I(y) = sinc²(π·a·y / (λ·L)) при малых углах sinθ ≈ y/L
      const lam_um   = lambda / 1000;
      const K_scale  = 40;  // нормировочный коэф. для масштаба y в пикселях
      // fringeUnit: на сколько пикселей приходится один «λL/a»
      const fringeUnit = U.clamp(lam_um * L / a * K_scale, 8, h * 0.4);

      const intensity = (y) => {
        const dy = y - cy;
        if (Math.abs(dy) < 0.5) return 1;
        const alpha = Math.PI * dy / fringeUnit;
        const sinc  = Math.sin(alpha) / alpha;
        return sinc * sinc;
      };

      // Цветовая полоса экрана
      const screenW = 22;
      ctx.save();
      ctx.fillStyle   = '#070a0f';
      ctx.fillRect(screenX, 0, screenW, h);
      ctx.strokeStyle = '#2a3444';
      ctx.lineWidth   = 1;
      ctx.strokeRect(screenX, 0, screenW, h);
      for (let y = 0; y < h; y += 2) {
        const I = intensity(y);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${(I * 0.95).toFixed(3)})`;
        ctx.fillRect(screenX + 1, y, screenW - 2, 2);
      }
      ctx.restore();

      // ── График I(θ) правее экрана ──────────────────────────────
      const gx0  = screenX + screenW + 12;
      const gxW  = Math.max(30, w - gx0 - pad * 0.5);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(gx0, 0); ctx.lineTo(gx0, h); ctx.stroke();
      // Кривая
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 6; ctx.shadowColor = col;
      ctx.beginPath();
      for (let y = 0; y <= h; y++) {
        const xp = gx0 + intensity(y) * gxW * 0.9;
        y === 0 ? ctx.moveTo(xp, y) : ctx.lineTo(xp, y);
      }
      ctx.stroke();
      ctx.restore();
      Draw.text(ctx, 'I(θ)', gx0 + 4, 10, { color: '#5a6577', font: '9px JetBrains Mono' });

      // ── Метки минимумов на графике ────────────────────────────
      for (let m = 1; m <= 4; m++) {
        const yMin = cy + m * fringeUnit;
        const yMinN = cy - m * fringeUnit;
        for (const ym of [yMin, yMinN]) {
          if (ym < 10 || ym > h - 10) continue;
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.setLineDash([2, 5]);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(screenX, ym); ctx.lineTo(gx0 + gxW, ym); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          if (m <= 2) {
            Draw.text(ctx, `m=${m}`, gx0 + gxW - 2, ym - 8,
              { color: '#5a6577', align: 'right', font: '8px JetBrains Mono' });
          }
        }
      }

      // ── Нижняя строка ──────────────────────────────────────────
      Draw.text(ctx, `λ = ${lambda} нм   a = ${U.fmt(a,1)} мкм   y₁ = ${U.fmt(lam_um*L/a*K_scale/h*100,1)} %H`,
        barrX, h - 16, { color: '#5a6577', font: '10px JetBrains Mono' });
      Draw.text(ctx, 'экран', screenX + screenW / 2, h - 16,
        { color: '#3a4452', align: 'center', font: '9px JetBrains Mono' });
    },
  });
})();
