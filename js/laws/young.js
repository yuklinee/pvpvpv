/* =========================================================
   PHYSICA · Интерференция света (опыт Юнга)
   Δ = d·sin(θ) ≈ d·y/L     (условие максимумов: Δ = m·λ)
   Визуализация: два когерентных источника, концентрические волны,
   экран справа показывает интенсивность I = 4·I₀·cos²(π·d·y / (λ·L)).
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  Laws.register({
    id: 'young',
    title: 'Интерференция Юнга',
    description: 'Свет от двух когерентных щелей образует чередующиеся максимумы и минимумы. Положение полос зависит от длины волны λ, расстояния между щелями d и до экрана L.',
    formula: 'd · sin θ = m · λ',

    params: [
      { id: 'lambda', label: 'Длина волны', latex: 'λ', min: 380, max: 740, step: 1, value: 540, default: 540, unit: 'нм', type: 'range' },
      { id: 'd',      label: 'Расст. между щелями', latex: 'd', min: 5, max: 60, step: 0.5, value: 22, default: 22, unit: 'мкм', type: 'range' },
      { id: 'L',      label: 'До экрана', latex: 'L', min: 200, max: 1200, step: 10, value: 700, default: 700, unit: 'у. е.', type: 'range' },
      { id: 'showWaves', label: 'Показывать волны', type: 'toggle', value: 1, default: 1 }
    ],

    readout(s) {
      // Расчёт расстояния между соседними максимумами на экране:
      // Δy = λ·L / d  (в одинаковых единицах). Берём λ в нм → мкм / 1000.
      const lam_um = s.params.lambda / 1000; // нм → мкм
      const dy = (lam_um * s.params.L) / s.params.d; // мкм
      return [
        { k: 'Δy', v: U.fmt(dy, 1) + ' у. е.' },
        { k: 'λ',  v: s.params.lambda + ' нм' }
      ];
    },

    init(ctx, state, w, h) {
      state.phase = 0; // фаза волны для анимации
    },

    update(state, dt) {
      state.phase += dt * 4; // скорость анимации волны
    },

    // Преобразование длины волны (380–740 нм) в цвет (упрощённая модель видимого спектра)
    _wavelengthToColor(lam) {
      let R = 0, G = 0, B = 0;
      if (lam >= 380 && lam < 440) { R = -(lam - 440) / 60; B = 1; }
      else if (lam < 490)          { G = (lam - 440) / 50; B = 1; }
      else if (lam < 510)          { G = 1; B = -(lam - 510) / 20; }
      else if (lam < 580)          { R = (lam - 510) / 70; G = 1; }
      else if (lam < 645)          { R = 1; G = -(lam - 645) / 65; }
      else if (lam <= 740)         { R = 1; }
      // ослабление на краях спектра
      let f = 1;
      if (lam < 420)      f = 0.3 + 0.7 * (lam - 380) / 40;
      else if (lam > 700) f = 0.3 + 0.7 * (740 - lam) / 40;
      R = Math.max(0, Math.min(1, R)) * f;
      G = Math.max(0, Math.min(1, G)) * f;
      B = Math.max(0, Math.min(1, B)) * f;
      return { r: Math.round(R * 255), g: Math.round(G * 255), b: Math.round(B * 255) };
    },

    render(ctx, state, w, h, t) {
      const { lambda, d, L, showWaves } = state.params;
      const color = this._wavelengthToColor(lambda);
      const colStr = `rgb(${color.r},${color.g},${color.b})`;

      Draw.bgGrid(ctx, w, h, 32);

      // Геометрия сцены:
      //  - левый край: источник (лазер)
      //  - чуть правее: барьер с двумя щелями (вертикальная линия x = bx)
      //  - правее: экран x = ex
      const padding = Math.min(w, h) * 0.06;
      const bx = w * 0.28;             // позиция барьера
      const ex = w - padding - 30;     // позиция экрана
      const cy = h / 2;                // центр по вертикали

      // Реальное расстояние d_px между щелями в пикселях — масштабируем параметр для красоты
      const d_px = U.clamp(d * 2.5, 12, h * 0.4);
      const s1y = cy - d_px / 2;
      const s2y = cy + d_px / 2;
      const L_px = ex - bx; // расстояние барьер→экран в пикселях

      // === Волны от щелей ===
      // Берём "видимую" длину волны в пикселях так, чтобы Δy = (λ·L)/d совпадало с реальной формулой.
      // У нас в формуле λ — в нм, d — в мкм, L — в "у. е.". Введём масштаб K такой,
      // чтобы Δy_px = K·λ·L/d. Для приятной картинки берём K так, что при λ=540, d=22, L=700
      // получим Δy ≈ 35 px.
      const lam_um = lambda / 1000;
      const deltaY_unit = lam_um * L / d; // в "у. е.", напр. 540·700/22000 ≈ 17.2
      const K = 35 / 17.2;                // приведём к ~35 px при типичных значениях
      const fringeSpacing_px = deltaY_unit * K;
      // Расстояние между гребнями волны на изображении (~λ в пикселях)
      const wavePx = U.clamp(lambda * 0.03, 6, 30);

      // --- Лазерный пучок (от левой грани до барьера) ---
      ctx.save();
      const grad = ctx.createLinearGradient(0, cy, bx, cy);
      grad.addColorStop(0,   `rgba(${color.r},${color.g},${color.b},0)`);
      grad.addColorStop(1,   `rgba(${color.r},${color.g},${color.b},0.9)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 18;
      ctx.shadowColor = colStr;
      ctx.beginPath();
      ctx.moveTo(padding * 0.5, cy);
      ctx.lineTo(bx, cy);
      ctx.stroke();
      ctx.restore();

      // --- Концентрические волны от каждой щели ---
      if (showWaves) {
        ctx.save();
        ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},0.35)`;
        ctx.lineWidth = 1;
        const maxR = Math.hypot(ex - bx, Math.max(s1y, h - s1y));
        const phaseOffset = (state.phase * wavePx) % wavePx;
        // Несколько окружностей с шагом wavePx
        for (let r = phaseOffset; r < maxR; r += wavePx) {
          const alpha = 0.45 * (1 - r / maxR);
          if (alpha < 0.03) continue;
          ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
          // источник 1
          ctx.beginPath();
          ctx.arc(bx, s1y, r, -Math.PI / 2.3, Math.PI / 2.3);
          ctx.stroke();
          // источник 2
          ctx.beginPath();
          ctx.arc(bx, s2y, r, -Math.PI / 2.3, Math.PI / 2.3);
          ctx.stroke();
        }
        ctx.restore();
      }

      // --- Барьер со щелями ---
      ctx.save();
      ctx.fillStyle = '#1a2230';
      ctx.strokeStyle = '#3a4452';
      ctx.lineWidth = 1;
      // верх
      ctx.fillRect(bx - 4, 0, 8, s1y - 4);
      ctx.strokeRect(bx - 4, 0, 8, s1y - 4);
      // между щелями
      ctx.fillRect(bx - 4, s1y + 4, 8, (s2y - 4) - (s1y + 4));
      ctx.strokeRect(bx - 4, s1y + 4, 8, (s2y - 4) - (s1y + 4));
      // низ
      ctx.fillRect(bx - 4, s2y + 4, 8, h - (s2y + 4));
      ctx.strokeRect(bx - 4, s2y + 4, 8, h - (s2y + 4));
      ctx.restore();

      // --- Подсветка двух щелей (вторичные источники по принципу Гюйгенса) ---
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = colStr;
      ctx.fillStyle = colStr;
      ctx.beginPath(); ctx.arc(bx, s1y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx, s2y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // === Расчёт интенсивности на экране ===
      // I(y) = 4·I₀·cos²(π · Δy / fringeSpacing).
      // fringeSpacing_px — расстояние между соседними максимумами в пикселях.
      const intensity = (y) => {
        const dy_from_center = y - cy;
        return Math.cos(Math.PI * dy_from_center / fringeSpacing_px) ** 2;
      };

      // --- Экран (вертикальная полоса с подсветкой интерференционной картиной) ---
      const screenW = 28;
      ctx.save();
      // фон экрана
      ctx.fillStyle = '#070a0f';
      ctx.fillRect(ex, 0, screenW, h);
      ctx.strokeStyle = '#3a4452';
      ctx.lineWidth = 1;
      ctx.strokeRect(ex, 0, screenW, h);
      // полосы — отрисовка по строкам
      const step = 2;
      for (let y = 0; y < h; y += step) {
        const I = intensity(y);
        const a = I;
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${a.toFixed(3)})`;
        ctx.fillRect(ex + 1, y, screenW - 2, step);
      }
      ctx.restore();

      // --- График интенсивности справа от экрана ---
      const gx0 = ex + screenW + 14;
      const gxW = Math.max(40, w - gx0 - padding * 0.3);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      // ось
      ctx.beginPath();
      ctx.moveTo(gx0, 0); ctx.lineTo(gx0, h);
      ctx.stroke();
      // кривая
      ctx.strokeStyle = colStr;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = colStr;
      ctx.beginPath();
      for (let y = 0; y < h; y += 1) {
        const I = intensity(y);
        const x = gx0 + I * gxW * 0.85;
        if (y === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      Draw.text(ctx, 'I(y)', gx0 + 4, 8, { color: '#5a6577' });

      // --- Подписи ---
      Draw.text(ctx, 'S₁', bx - 14, s1y - 6, { color: '#8a96a8', font: 'italic 12px Fraunces, serif' });
      Draw.text(ctx, 'S₂', bx - 14, s2y - 6, { color: '#8a96a8', font: 'italic 12px Fraunces, serif' });
      Draw.text(ctx, 'экран', ex + 4, h - 18, { color: '#5a6577', font: '10px JetBrains Mono, monospace' });
      Draw.text(ctx, 'источник', padding * 0.5, cy - 18, { color: '#5a6577', font: '10px JetBrains Mono, monospace' });
    }
  });
})();
