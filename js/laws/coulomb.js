/* =========================================================
   PHYSICA · Закон Кулона
   F = k · q₁ · q₂ / r²
   Два точечных заряда. Фон показывает потенциал поля (тепловая карта).
   Силовые линии рисуются из каждого заряда. Стрелки на зарядах
   показывают силу F. Заряды можно перетаскивать мышью.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const K = 8.99e9; // постоянная Кулона (Н·м²/Кл²) — в реальных единицах
  // Для визуализации используем нормированные единицы: k_vis = 1
  const K_VIS = 1;
  const N_LINES = 12; // силовых линий из каждого заряда

  Laws.register({
    id: 'coulomb',
    group: 'BETA',
    title: 'Закон Кулона',
    description: 'Сила взаимодействия двух точечных зарядов пропорциональна произведению зарядов и обратно пропорциональна квадрату расстояния. Цвет фона показывает потенциал поля. Заряды можно перетаскивать.',
    formula: 'F = k · |q₁ · q₂| / r²',

    params: [
      { id: 'q1', label: 'Заряд q₁', latex: 'q₁', min: -8, max: 8, step: 0.5, value:  3, default:  3, unit: 'нКл', type: 'range' },
      { id: 'q2', label: 'Заряд q₂', latex: 'q₂', min: -8, max: 8, step: 0.5, value: -3, default: -3, unit: 'нКл', type: 'range' },
      { id: 'showField', label: 'Потенциал (фон)',   type: 'toggle', value: 1, default: 1 },
      { id: 'showLines', label: 'Силовые линии',     type: 'toggle', value: 1, default: 1 },
    ],

    readout(s) {
      if (!s.pos) return [];
      const dx = s.pos[1].x - s.pos[0].x;
      const dy = s.pos[1].y - s.pos[0].y;
      const r  = Math.hypot(dx, dy);
      const F  = Math.abs(s.params.q1 * s.params.q2) / (r * r) * 5000;
      const sign = s.params.q1 * s.params.q2 < 0 ? 'притяжение' : 'отталкивание';
      return [
        { k: 'r',  v: U.fmt(r / 80, 2) + ' у.е.' },
        { k: 'F',  v: U.fmt(F, 2) + ' у.е.' },
        { k: '',   v: sign },
      ];
    },

    init(ctx, state, w, h) {
      state.pos = [
        { x: w * 0.35, y: h * 0.5 },
        { x: w * 0.65, y: h * 0.5 },
      ];
      state.drag = null; // индекс перетаскиваемого заряда
      this._bindDrag(ctx.canvas, state);
    },

    _bindDrag(canvas, state) {
      // Удаляем старые слушатели если переинициализировались
      if (state._handlers) {
        canvas.removeEventListener('mousedown', state._handlers.down);
        canvas.removeEventListener('mousemove', state._handlers.move);
        canvas.removeEventListener('mouseup',   state._handlers.up);
        canvas.removeEventListener('touchstart', state._handlers.tdown);
        canvas.removeEventListener('touchmove',  state._handlers.tmove);
        canvas.removeEventListener('touchend',   state._handlers.tup);
      }
      const dpr  = () => window.devicePixelRatio || 1;
      const rect = () => canvas.getBoundingClientRect();
      const toC  = (cx, cy) => {
        const r = rect();
        return { x: (cx - r.left) * (canvas.width  / r.width)  / dpr(),
                 y: (cy - r.top)  * (canvas.height / r.height) / dpr() };
      };
      const hitR = 22;

      const onDown = (cx, cy) => {
        const p = toC(cx, cy);
        for (let i = 0; i < 2; i++) {
          if (Math.hypot(p.x - state.pos[i].x, p.y - state.pos[i].y) < hitR) {
            state.drag = i; return;
          }
        }
      };
      const onMove = (cx, cy) => {
        if (state.drag === null) return;
        const p = toC(cx, cy);
        state.pos[state.drag].x = p.x;
        state.pos[state.drag].y = p.y;
      };
      const onUp = () => { state.drag = null; };

      const md = e => onDown(e.clientX, e.clientY);
      const mm = e => { if (state.drag !== null) { e.preventDefault(); onMove(e.clientX, e.clientY); }};
      const mu = () => onUp();
      const td = e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); };
      const tm = e => { if (state.drag !== null) { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }};
      const tu = () => onUp();

      canvas.addEventListener('mousedown',  md);
      canvas.addEventListener('mousemove',  mm);
      canvas.addEventListener('mouseup',    mu);
      canvas.addEventListener('touchstart', td, { passive: true });
      canvas.addEventListener('touchmove',  tm, { passive: false });
      canvas.addEventListener('touchend',   tu);
      state._handlers = { down: md, move: mm, up: mu, tdown: td, tmove: tm, tup: tu };
    },

    update(state, dt) { /* статика */ },

    render(ctx, state, w, h) {
      if (!state.pos) return;
      const { q1, q2, showField, showLines } = state.params;
      const [p1, p2] = state.pos;

      // ── Потенциал поля (тепловая карта) ───────────────────────
      if (showField) {
        const step = 10;
        for (let px = 0; px <= w; px += step) {
          for (let py = 0; py <= h; py += step) {
            const r1 = Math.max(18, Math.hypot(px - p1.x, py - p1.y));
            const r2 = Math.max(18, Math.hypot(px - p2.x, py - p2.y));
            const V  = q1 / r1 + q2 / r2;
            // Нормируем: V in [-0.15, +0.15] → цвет
            const norm = Math.tanh(V * 60) * 0.5 + 0.5; // 0..1
            const r = Math.round(20  + norm * 160);
            const g = Math.round(10  + norm * 30);
            const b = Math.round(220 - norm * 140);
            ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
            ctx.fillRect(px - step / 2, py - step / 2, step, step);
          }
        }
      } else {
        Draw.bgGrid(ctx, w, h, 36);
      }

      // ── Силовые линии ─────────────────────────────────────────
      if (showLines) {
        this._drawFieldLines(ctx, state, w, h, q1, q2, p1, p2);
      }

      // ── Линия между зарядами ──────────────────────────────────
      const dx  = p2.x - p1.x, dy = p2.y - p1.y;
      const r   = Math.hypot(dx, dy);
      const attract = q1 * q2 < 0;
      ctx.save();
      ctx.strokeStyle = attract ? 'rgba(124,242,200,0.3)' : 'rgba(255,107,156,0.3)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Стрелки силы ─────────────────────────────────────────
      const F = Math.abs(q1 * q2) / Math.max(r * r, 100) * 5000;
      const Flen = U.clamp(F * 0.4, 8, 60);
      const nx = dx / r, ny = dy / r;
      const Fcol = attract ? '#7cf2c8' : '#ff6e9c';

      const drawArrow = (ox, oy, vx, vy, col) => {
        const ex = ox + vx, ey = oy + vy;
        const ang = Math.atan2(vy, vx);
        ctx.save();
        ctx.strokeStyle = col; ctx.fillStyle = col;
        ctx.lineWidth   = 2.5;
        ctx.shadowBlur  = 10; ctx.shadowColor = col;
        ctx.lineCap     = 'round';
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 9 * Math.cos(ang - 0.4), ey - 9 * Math.sin(ang - 0.4));
        ctx.lineTo(ex - 9 * Math.cos(ang + 0.4), ey - 9 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };

      if (attract) {
        // Силы направлены друг к другу
        drawArrow(p1.x, p1.y,  nx * Flen,  ny * Flen, Fcol);
        drawArrow(p2.x, p2.y, -nx * Flen, -ny * Flen, Fcol);
      } else {
        // Силы направлены друг от друга
        drawArrow(p1.x, p1.y, -nx * Flen, -ny * Flen, Fcol);
        drawArrow(p2.x, p2.y,  nx * Flen,  ny * Flen, Fcol);
      }

      // ── Заряды ────────────────────────────────────────────────
      const drawCharge = (pos, q, label) => {
        const rad  = 18 + Math.abs(q) * 1.2;
        const col  = q > 0 ? '#ff6e9c' : q < 0 ? '#5ac8fa' : '#8a96a8';
        const sign = q > 0 ? '+' : q < 0 ? '−' : '0';
        ctx.save();
        ctx.shadowBlur  = 20; ctx.shadowColor = col;
        const grd = ctx.createRadialGradient(pos.x - rad * 0.3, pos.y - rad * 0.3, 1, pos.x, pos.y, rad);
        grd.addColorStop(0, q > 0 ? '#ffaacc' : q < 0 ? '#aaddff' : '#ccc');
        grd.addColorStop(1, col);
        ctx.fillStyle   = grd;
        ctx.strokeStyle = col;
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Знак заряда
        ctx.fillStyle   = '#fff';
        ctx.font        = `bold ${rad * 0.9}px Fraunces, serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur  = 0;
        ctx.fillText(sign, pos.x, pos.y);
        ctx.restore();
        // Числовое значение
        Draw.text(ctx, `${label} = ${U.fmt(q, 1)} нКл`, pos.x, pos.y + rad + 14,
          { color: col, align: 'center', font: '700 11px JetBrains Mono, monospace' });
        // Подсказка о перетаскивании
        if (state.drag === null) {
          Draw.text(ctx, '✥ drag', pos.x, pos.y + rad + 28,
            { color: '#3a4452', align: 'center', font: '9px JetBrains Mono, monospace' });
        }
      };

      drawCharge(p1, q1, 'q₁');
      drawCharge(p2, q2, 'q₂');

      // ── Расстояние между зарядами ─────────────────────────────
      const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2 - 14;
      Draw.text(ctx, `r = ${U.fmt(r / 80, 2)} у.е.`, midX, midY,
        { color: '#8a96a8', align: 'center', font: '10px JetBrains Mono, monospace' });

      // ── F внизу ───────────────────────────────────────────────
      const typeStr = attract ? 'притяжение' : 'отталкивание';
      Draw.text(ctx, `F = ${U.fmt(F, 2)} у.е.  (${typeStr})`, w / 2, h - 16,
        { color: Fcol, align: 'center', font: '11px JetBrains Mono, monospace' });
    },

    // Трассировка силовых линий методом Эйлера от каждого заряда
    _drawFieldLines(ctx, state, w, h, q1, q2, p1, p2) {
      const startCharge = q1 >= 0 ? 0 : 1; // линии начинаем с положительного заряда
      const charges = [
        { x: p1.x, y: p1.y, q: q1 },
        { x: p2.x, y: p2.y, q: q2 },
      ];

      ctx.save();
      ctx.lineWidth = 1;

      for (let ci = 0; ci < 2; ci++) {
        const ch = charges[ci];
        if (ch.q === 0) continue;
        const lineCount = Math.min(N_LINES, Math.round(Math.abs(ch.q) * 2 + 4));

        for (let li = 0; li < lineCount; li++) {
          const angle = (li / lineCount) * Math.PI * 2;
          // Начинаем от поверхности заряда
          const startR = 20;
          let x = ch.x + Math.cos(angle) * startR;
          let y = ch.y + Math.sin(angle) * startR;

          ctx.beginPath();
          ctx.moveTo(x, y);

          const stepSize = 5;
          const maxSteps = 260;
          let prevX = x, prevY = y;

          for (let s = 0; s < maxSteps; s++) {
            // Поле E = сумма вкладов всех зарядов
            let ex = 0, ey = 0;
            for (const c of charges) {
              const ddx = x - c.x, ddy = y - c.y;
              const rr  = Math.max(16, Math.hypot(ddx, ddy));
              const mag = c.q / (rr * rr * rr); // знак сохраняется
              ex += mag * ddx;
              ey += mag * ddy;
            }
            const emag = Math.hypot(ex, ey);
            if (emag < 1e-9) break;
            // Нормируем и делаем шаг в направлении поля (или против — для отрицательного заряда)
            const sign = ch.q > 0 ? 1 : -1;
            const nx = sign * ex / emag;
            const ny = sign * ey / emag;
            x += nx * stepSize;
            y += ny * stepSize;

            // Останавливаемся у другого заряда
            let hitOther = false;
            for (const c of charges) {
              if (c === ch) continue;
              if (Math.hypot(x - c.x, y - c.y) < 18) { hitOther = true; break; }
            }
            if (hitOther) break;
            // Останавливаемся у своего заряда (петля)
            if (s > 10 && Math.hypot(x - ch.x, y - ch.y) < 20) break;
            // Уходим за экран
            if (x < -40 || x > w + 40 || y < -40 || y > h + 40) break;

            ctx.lineTo(x, y);
            prevX = x; prevY = y;
          }

          // Цвет линии: положительный — розовый, отрицательный — синий
          const lineCol = ch.q > 0 ? 'rgba(255,107,156,0.45)' : 'rgba(90,200,250,0.45)';
          ctx.strokeStyle = lineCol;
          ctx.stroke();
          ctx.beginPath(); // начинаем новый путь для следующей линии
        }
      }
      ctx.restore();
    },
  });
})();
