/* =========================================================
   PHYSICA · Броуновское движение
   〈x²〉 = 2D·t,  D = kT / (6πηr)   (формула Эйнштейна)
   Крупная частица беспорядочно блуждает под ударами
   молекул тепловой среды. Рисуем след (трек) и среднеквадратичное
   смещение, которое растёт как √t.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const N_SMALL  = 120; // молекулы среды
  const TRAIL_MAX = 500;

  Laws.register({
    id: 'brownian',
    group: 'BETA',
    title: 'Броуновское движение',
    description: 'Крупная частица, взвешенная в жидкости, беспорядочно блуждает из-за непрерывных хаотичных ударов молекул среды. Смещение растёт как √(2Dt). При более высокой температуре — движение интенсивнее.',
    formula: '〈x²〉 = 2D·t',

    params: [
      { id: 'T',    label: 'Температура',       latex: 'T',  min: 100, max: 800, step: 10, value: 300, default: 300, unit: 'К',   type: 'range' },
      { id: 'R',    label: 'Радиус частицы',     latex: 'R',  min: 4,   max: 28,  step: 1,  value: 14,  default: 14,  unit: 'у.е.', type: 'range' },
      { id: 'eta',  label: 'Вязкость среды',     latex: 'η',  min: 1,   max: 20,  step: 1,  value: 5,   default: 5,   unit: 'у.е.', type: 'range' },
      { id: 'trail',label: 'Длина следа',        latex: '',   min: 50,  max: 500, step: 10, value: 300, default: 300, unit: '',      type: 'range' },
    ],

    readout(s) {
      if (!s.track || s.track.length < 2) return [];
      const first = s.track[0], last = s.track[s.track.length - 1];
      const dx = last.x - first.x, dy = last.y - first.y;
      const disp = Math.sqrt(dx * dx + dy * dy);
      return [
        { k: 'D',   v: U.fmt(s.D || 0, 2) + ' у.е.' },
        { k: '|r|', v: U.fmt(disp, 1) + ' у.е.' },
        { k: 't',   v: U.fmt(s.simTime || 0, 1) + ' с' },
      ];
    },

    init(ctx, state, w, h) {
      this.reset(state);
      state.molecules = this._spawnMolecules(w, h, state.params.T);
    },

    reset(state) {
      state.bx       = 0; // сброс — будет инициализирован в render
      state.by       = 0;
      state.needCenterReset = true;
      state.track    = [];
      state.simTime  = 0;
      state.D        = 0;
    },

    _spawnMolecules(w, h, T) {
      const mols = [];
      const vBase = Math.sqrt(T) * 1.2;
      for (let i = 0; i < N_SMALL; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp  = vBase * (0.6 + Math.random() * 0.8);
        mols.push({
          x:  Math.random() * w,
          y:  Math.random() * h,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          r:  2 + Math.random(),
        });
      }
      return mols;
    },

    update(state, dt) {
      const { T, eta } = state.params;
      // Диффузионный коэффициент (условный): D ~ kT / (6πηR)
      const R_  = state.params.R;
      state.D = (1.38e-2 * T) / (6 * Math.PI * eta * R_);

      // Обновляем скорости молекул к новой T
      const vTarget = Math.sqrt(T) * 1.2;
      for (const m of (state.molecules || [])) {
        const sp = Math.hypot(m.vx, m.vy) || 1;
        const k  = window.Physica.U.smooth(sp, vTarget, dt, 0.3) / sp;
        m.vx *= k; m.vy *= k;
      }

      state.simTime = (state.simTime || 0) + dt;
    },

    render(ctx, state, w, h) {
      // Очищаем с небольшим затуханием для красивых следов
      ctx.save();
      ctx.fillStyle = 'rgba(7,10,15,0.18)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      Draw.bgGrid(ctx, w, h, 48, 'rgba(255,255,255,0.025)');

      const { R, T, eta } = state.params;
      const trailMax = state.params.trail;

      // Центрируем частицу при первом рендере
      if (state.needCenterReset) {
        state.bx = w / 2; state.by = h / 2;
        state.needCenterReset = false;
      }

      const dtSub = 1 / 60;

      // Движение молекул + обнаружение столкновений с большой частицей
      const hits = [];
      if (!state.molecules) state.molecules = this._spawnMolecules(w, h, T);
      for (const m of state.molecules) {
        m.x += m.vx * dtSub;
        m.y += m.vy * dtSub;
        // Отскок от стен
        if (m.x < m.r)     { m.x = m.r;     m.vx =  Math.abs(m.vx); }
        if (m.x > w - m.r) { m.x = w - m.r; m.vx = -Math.abs(m.vx); }
        if (m.y < m.r)     { m.y = m.r;     m.vy =  Math.abs(m.vy); }
        if (m.y > h - m.r) { m.y = h - m.r; m.vy = -Math.abs(m.vy); }
        // Столкновение с большой частицей
        const dx = m.x - state.bx, dy = m.y - state.by;
        const dist = Math.hypot(dx, dy);
        const minD = R + m.r;
        if (dist < minD && dist > 0.1) {
          // Отталкиваем молекулу наружу
          const nx = dx / dist, ny = dy / dist;
          m.x = state.bx + nx * (minD + 1);
          m.y = state.by + ny * (minD + 1);
          const dot = m.vx * nx + m.vy * ny;
          m.vx -= 2 * dot * nx; m.vy -= 2 * dot * ny;
          hits.push({ nx, ny, imp: Math.abs(dot) });
        }
      }

      // Суммарный импульс от ударов → случайная прогулка большой частицы
      let fx = 0, fy = 0;
      for (const hh of hits) {
        fx += hh.nx * hh.imp;
        fy += hh.ny * hh.imp;
      }
      // Добавляем тепловой шум (стохастическая составляющая)
      const sigma = Math.sqrt(2 * state.D * dtSub) * 60;
      fx += (Math.random() - 0.5) * sigma;
      fy += (Math.random() - 0.5) * sigma;
      // Вязкое торможение: F_drag ~ -eta * v
      const massRatio = 1 / (1 + eta * R * 0.1);
      state.bx += fx * massRatio;
      state.by += fy * massRatio;
      // Не выходим за экран
      state.bx = U.clamp(state.bx, R + 4, w - R - 4);
      state.by = U.clamp(state.by, R + 4, h - R - 4);

      // Трек
      state.track.push({ x: state.bx, y: state.by });
      if (state.track.length > trailMax) state.track.shift();

      // Рисуем молекулы среды
      ctx.save();
      const vT = Math.sqrt(T) * 1.2;
      for (const m of state.molecules) {
        const heatN = U.clamp(Math.hypot(m.vx, m.vy) / (vT * 1.5), 0, 1);
        const rr = Math.round(80  + heatN * 100);
        const gg = Math.round(180 + heatN * 40);
        const bb = Math.round(255);
        ctx.fillStyle = `rgba(${rr},${gg},${bb},0.6)`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Рисуем трек (градиент от старого к новому)
      if (state.track.length > 1) {
        ctx.save();
        for (let i = 1; i < state.track.length; i++) {
          const a = (i / state.track.length) * 0.7;
          ctx.strokeStyle = `rgba(255,184,107,${a.toFixed(3)})`;
          ctx.lineWidth   = 1.5;
          ctx.beginPath();
          ctx.moveTo(state.track[i - 1].x, state.track[i - 1].y);
          ctx.lineTo(state.track[i].x,     state.track[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Большая частица
      ctx.save();
      ctx.shadowBlur  = 22;
      ctx.shadowColor = '#ffb86b';
      const grd = ctx.createRadialGradient(state.bx - R * 0.3, state.by - R * 0.3, 1, state.bx, state.by, R);
      grd.addColorStop(0, '#fff3d0');
      grd.addColorStop(1, '#c47a1a');
      ctx.fillStyle   = grd;
      ctx.strokeStyle = '#ffb86b';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.arc(state.bx, state.by, R, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      // Векторы ударных сил на большой частице (последние удары)
      if (hits.length) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,107,156,0.5)';
        ctx.lineWidth   = 1.5;
        for (const hh of hits.slice(-4)) {
          const ax = state.bx + hh.nx * R;
          const ay = state.by + hh.ny * R;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + hh.nx * 14, ay + hh.ny * 14); ctx.stroke();
        }
        ctx.restore();
      }

      // Панель √2Dt
      const D_ = state.D;
      const t_  = state.simTime || 0;
      const rms = Math.sqrt(2 * D_ * t_) * 60;
      Draw.text(ctx, `D = ${U.fmt(D_, 3)}`, 12, h - 36,
        { color: '#ffb86b', font: '11px JetBrains Mono, monospace' });
      Draw.text(ctx, `√(2Dt) = ${U.fmt(rms, 1)} у.е.`, 12, h - 20,
        { color: '#5a6577', font: '10px JetBrains Mono, monospace' });
      Draw.text(ctx, `● частица    ··· след    · молекулы`, w / 2, h - 20,
        { color: '#3a4452', align: 'center', font: '10px JetBrains Mono, monospace' });
    }
  });
})();
