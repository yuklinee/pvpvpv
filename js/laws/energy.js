/* =========================================================
   PHYSICA · Закон сохранения энергии
   E = Eₖ + Eₚ = const   (для замкнутой системы без трения)
   Визуализация: математический маятник + горизонтальный
   «стек-бар» энергий (фиксированной высоты) + график E(t).

   Исправления v2:
   - Числа вынесены в фиксированные позиции (не двигаются)
   - Emax вычисляется как реальный максимум за всё время
     симуляции (не по phi0), поэтому шкала не уезжает
   - График E(t) наглядно показывает антифазность Eк и Eп
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  // Форматирование энергии: всегда 2 знака после запятой, без экспоненты
  const fmtE = (v) => (Math.abs(v) < 1e-9 ? '0.00' : Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2));


  Laws.register({
    id: 'energy',
    title: 'Закон сохранения энергии',
    description: 'Полная механическая энергия замкнутой системы постоянна. Маятник: Eₖ максимальна внизу, Eₚ — в крайних точках. Они меняются в противофазе, сумма остаётся постоянной.',
    formula: 'Eₖ + Eₚ = E = const',

    params: [
      { id: 'L',    label: 'Длина маятника',   latex: 'L',  min: 0.5, max: 2.5, step: 0.05, value: 1.4,  default: 1.4,  unit: 'м',    type: 'range' },
      { id: 'm',    label: 'Масса груза',       latex: 'm',  min: 0.1, max: 5,   step: 0.1,  value: 1.0,  default: 1.0,  unit: 'кг',   type: 'range' },
      { id: 'phi0', label: 'Нач. отклонение',   latex: 'ϕ₀', min: 5,  max: 80,  step: 1,    value: 45,   default: 45,   unit: '°',    type: 'range' },
      { id: 'g',    label: 'Грав. ускорение',   latex: 'g',  min: 1.6, max: 24,  step: 0.1,  value: 9.81, default: 9.81, unit: 'м/с²', type: 'range' },
      { id: 'damp', label: 'Трение',            latex: 'μ',  min: 0,   max: 0.5, step: 0.01, value: 0,    default: 0,    unit: '',     type: 'range' }
    ],

    readout(s) {
      const { m, L, g } = s.params;
      const Ek = 0.5 * m * (s.omega || 0) ** 2 * L * L;
      const Ep = m * g * L * (1 - Math.cos(s.phi || 0));
      return [
        { k: 'Eₖ', v: fmtE(Ek) + ' Дж' },
        { k: 'Eₚ', v: fmtE(Ep) + ' Дж' },
        { k: 'E',  v: fmtE(Ek + Ep) + ' Дж' }
      ];
    },

    init(ctx, state, w, h) {
      this.reset(state);
    },

    onParam(id, value, state) {
      // При изменении начального угла перезапускаем маятник из новой позиции
      if (id === 'phi0') {
        state.phi   = value * Math.PI / 180;
        state.omega = 0;
        state.trail    = [];
        state.history  = [];
        state.Emax_obs = 0;
      }
    },

    reset(state) {
      state.phi      = (state.params.phi0 || 45) * Math.PI / 180;
      state.omega    = 0;
      state.trail    = [];   // шлейф груза
      state.history  = [];   // история [Ek, Ep] для графика E(t)
      state.Emax_obs = 0;    // наблюдаемый максимум полной энергии
    },

    update(state, dt) {
      const { L, g, damp } = state.params;
      // Численное интегрирование методом Эйлера–Крамера (симплектический)
      // Более точный, чем обычный Эйлер — энергия не уплывает со временем.
      const steps = 8;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const alpha = -(g / L) * Math.sin(state.phi) - damp * state.omega;
        state.omega += alpha * h;   // сначала обновляем скорость
        state.phi   += state.omega * h; // потом координату (symplectic Euler)
      }
    },

    render(ctx, state, w, h) {
      const { L, m, g } = state.params;
      Draw.bgGrid(ctx, w, h, 32);

      // ------------------------------------------------------------------
      // Физика: вычисляем энергии
      // ------------------------------------------------------------------
      const Ek = 0.5 * m * state.omega ** 2 * L * L;
      const Ep = m * g * L * (1 - Math.cos(state.phi));
      const E  = Ek + Ep;

      // Обновляем наблюдаемый максимум (растёт, но не падает — шкала стабильна)
      if (E > state.Emax_obs) state.Emax_obs = E;
      const Emax = Math.max(state.Emax_obs, 1e-6);

      // Накапливаем историю для графика (не чаще ~30 точек/сек)
      state.history.push({ Ek, Ep });
      if (state.history.length > 220) state.history.shift();

      // ------------------------------------------------------------------
      // Раскладка: маятник слева, правая панель — энергии
      // ------------------------------------------------------------------
      const pad = 20;
      const rightPanelW = Math.min(220, w * 0.32);
      const splitX      = w - rightPanelW - pad;

      // ===== МАЯТНИК =====
      const pivotX  = splitX * 0.5;
      const pivotY  = h * 0.17;
      const maxLpx  = h * 0.60;
      const Lpx     = U.clamp(L / 2.5 * maxLpx, 60, maxLpx);
      const bobX    = pivotX + Math.sin(state.phi) * Lpx;
      const bobY    = pivotY + Math.cos(state.phi) * Lpx;
      const bobR    = U.clamp(8 + m * 3, 8, 22);

      // Шлейф
      state.trail.push({ x: bobX, y: bobY });
      if (state.trail.length > 90) state.trail.shift();

      // Дуга амплитуды
      ctx.save();
      ctx.strokeStyle = 'rgba(124,242,200,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      const phi0rad = state.params.phi0 * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, Lpx, Math.PI / 2 - phi0rad, Math.PI / 2 + phi0rad);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Вертикаль равновесия
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pivotX, pivotY + Lpx + 28);
      ctx.stroke();
      ctx.restore();

      // Уровень нулевой потенциальной энергии
      ctx.save();
      ctx.strokeStyle = 'rgba(255,184,107,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(pad * 0.5, pivotY + Lpx);
      ctx.lineTo(splitX - pad, pivotY + Lpx);
      ctx.stroke();
      ctx.setLineDash([]);
      Draw.text(ctx, 'Eₚ = 0', pad * 0.8, pivotY + Lpx + 5, { color: 'rgba(255,184,107,0.5)', font: '10px JetBrains Mono, monospace' });
      ctx.restore();

      // Треугольник подвеса
      ctx.save();
      ctx.fillStyle = '#8a96a8';
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY - 4);
      ctx.lineTo(pivotX - 10, pivotY - 16);
      ctx.lineTo(pivotX + 10, pivotY - 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Рисуем шлейф
      ctx.save();
      for (let i = 0; i < state.trail.length; i++) {
        const p = state.trail[i];
        const a = (i / state.trail.length) * 0.38;
        ctx.fillStyle = `rgba(124,242,200,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Стержень
      ctx.save();
      ctx.strokeStyle = 'rgba(232,237,245,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();
      ctx.restore();

      // Груз
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#7cf2c8';
      const grd = ctx.createRadialGradient(bobX - bobR * 0.3, bobY - bobR * 0.3, 1, bobX, bobY, bobR);
      grd.addColorStop(0, '#d6fff0');
      grd.addColorStop(1, '#3a8a72');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7cf2c8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Вектор скорости (пропорционален omega)
      const vScale = Lpx * 0.35;
      const vx = Math.cos(state.phi) * state.omega * vScale;
      const vy = -Math.sin(state.phi) * state.omega * vScale;
      if (Math.abs(state.omega) > 0.05) {
        ctx.save();
        ctx.strokeStyle = '#5ac8fa';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#5ac8fa';
        ctx.beginPath();
        ctx.moveTo(bobX, bobY);
        ctx.lineTo(bobX + vx, bobY + vy);
        ctx.stroke();
        // стрелка
        const ang = Math.atan2(vy, vx);
        ctx.beginPath();
        ctx.moveTo(bobX + vx, bobY + vy);
        ctx.lineTo(bobX + vx - 8 * Math.cos(ang - 0.4), bobY + vy - 8 * Math.sin(ang - 0.4));
        ctx.lineTo(bobX + vx - 8 * Math.cos(ang + 0.4), bobY + vy - 8 * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fillStyle = '#5ac8fa';
        ctx.fill();
        ctx.restore();
      }

      // ------------------------------------------------------------------
      // ПРАВАЯ ПАНЕЛЬ: стек-бар + числа + график
      // ------------------------------------------------------------------
      const rx   = splitX + pad;
      const rw   = rightPanelW - pad;
      const ry   = pad;
      const rh   = h - 2 * pad;

      // Фон панели
      ctx.save();
      ctx.fillStyle   = 'rgba(255,255,255,0.02)';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(rx - 8, ry, rw + 16, rh, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // --- Секция 1: горизонтальный стек-бар ---
      const barTop = ry + 36;
      const barH   = 28;
      const barW   = rw - 16;
      const bx     = rx;

      Draw.text(ctx, 'распределение энергии', bx, ry + 12, { color: '#5a6577', font: '10px JetBrains Mono, monospace' });

      const EkRatio = U.clamp(Ek / Emax, 0, 1);
      const EpRatio = U.clamp(Ep / Emax, 0, 1);
      const EkW     = barW * EkRatio;
      const EpW     = barW * EpRatio;

      // Фон-рельсы
      ctx.save();
      ctx.fillStyle = '#11161e';
      ctx.beginPath();
      ctx.roundRect(bx, barTop, barW, barH, 6);
      ctx.fill();
      ctx.restore();

      // Eₖ (кинетическая) — синяя, слева
      if (EkW > 1) {
        ctx.save();
        ctx.fillStyle   = '#5ac8fa';
        ctx.shadowBlur  = 10;
        ctx.shadowColor = '#5ac8fa';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(bx, barTop, EkW, barH, [6, EkW > barW - 2 ? 6 : 0, EkW > barW - 2 ? 6 : 0, 6]);
        ctx.fill();
        ctx.restore();
      }

      // Eₚ (потенциальная) — оранжевая, справа
      const EpX = bx + barW - EpW;
      if (EpW > 1) {
        ctx.save();
        ctx.fillStyle   = '#ffb86b';
        ctx.shadowBlur  = 10;
        ctx.shadowColor = '#ffb86b';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(EpX, barTop, EpW, barH, [EpX <= bx + 2 ? 6 : 0, 6, 6, EpX <= bx + 2 ? 6 : 0]);
        ctx.fill();
        ctx.restore();
      }

      // Метка в центре «пустоты» (если трение ненулевое, стек не 100%)
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, barTop, barW, barH, 6);
      ctx.stroke();
      ctx.restore();

      // --- Секция 2: ФИКСИРОВАННЫЕ числа под баром ---
      const lblY1 = barTop + barH + 14;
      const lblY2 = lblY1 + 18;
      const lblY3 = lblY2 + 18;
      const colMid = bx + barW / 2;

      // Eₖ — левая колонка (фиксированная)
      const col1x = bx + 2;
      Draw.text(ctx, 'Eₖ  кинетич.', col1x, lblY1, { color: '#5ac8fa', font: '10px JetBrains Mono, monospace' });
      Draw.text(ctx, fmtE(Ek) + ' Дж', col1x, lblY2, { color: '#e8edf5', font: '11px JetBrains Mono, monospace' });

      // Eₚ — правая колонка (фиксированная)
      const col2x = bx + barW;
      Draw.text(ctx, 'Eₚ  потенц.', col2x, lblY1, { color: '#ffb86b', font: '10px JetBrains Mono, monospace', align: 'right' });
      Draw.text(ctx, fmtE(Ep) + ' Дж', col2x, lblY2, { color: '#e8edf5', font: '11px JetBrains Mono, monospace', align: 'right' });

      // E итого
      Draw.text(ctx, 'E = ' + fmtE(E) + ' Дж', colMid, lblY3, { color: '#7cf2c8', font: '11px JetBrains Mono, monospace', align: 'center' });

      // --- Секция 3: График E(t) ---
      const chartTop  = lblY3 + 22;
      const chartH    = rh - (chartTop - ry) - 8;
      const chartW    = rw - 16;
      const chartX    = bx;

      if (chartH < 40) {
        // На маленьких экранах граф не влезает — пропускаем
        return;
      }

      // Рамка
      ctx.save();
      ctx.fillStyle   = 'rgba(0,0,0,0.25)';
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(chartX, chartTop, chartW, chartH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      Draw.text(ctx, 'E(t)', chartX + 4, chartTop + 5, { color: '#5a6577', font: '9px JetBrains Mono, monospace' });

      const n = state.history.length;
      if (n < 2) return;

      // Линия Eₖ
      const drawHistLine = (colorStr, key) => {
        ctx.save();
        ctx.strokeStyle = colorStr;
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = colorStr;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const xp = chartX + (i / (n - 1)) * chartW;
          const yp = chartTop + chartH - (U.clamp(state.history[i][key] / Emax, 0, 1)) * (chartH - 4) - 2;
          i === 0 ? ctx.moveTo(xp, yp) : ctx.lineTo(xp, yp);
        }
        ctx.stroke();
        ctx.restore();
      };

      drawHistLine('#5ac8fa', 'Ek');
      drawHistLine('#ffb86b', 'Ep');

      // Легенда
      const legY = chartTop + chartH - 12;
      ctx.save();
      ctx.fillStyle = '#5ac8fa';
      ctx.fillRect(chartX + 4, legY, 16, 2);
      Draw.text(ctx, 'Eₖ', chartX + 22, legY - 4, { color: '#5ac8fa', font: '9px JetBrains Mono, monospace' });
      ctx.fillStyle = '#ffb86b';
      ctx.fillRect(chartX + 50, legY, 16, 2);
      ctx.restore();
      Draw.text(ctx, 'Eₚ', chartX + 68, legY - 4, { color: '#ffb86b', font: '9px JetBrains Mono, monospace' });
    }
  });
})();