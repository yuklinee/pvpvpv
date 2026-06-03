/* =========================================================
   PHYSICA · Закон Ома  I = U / R
   v2-mobile: все позиции от w/h, подписи не пересекаются
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  Laws.register({
    id: 'ohm',
    group: '1.14',
    title: 'Закон Ома',
    description: 'Сила тока пропорциональна напряжению и обратно пропорциональна сопротивлению. Электроны движутся быстрее при росте тока; резистор нагревается.',
    formula: 'I = U / R',

    params: [
      { id: 'U', label: 'Напряжение',    latex: 'U', min: 0,  max: 24, step: 0.1, value: 12, default: 12, unit: 'В',  type: 'range' },
      { id: 'R', label: 'Сопротивление', latex: 'R', min: 1,  max: 50, step: 0.5, value: 6,  default: 6,  unit: 'Ом', type: 'range' }
    ],

    readout(s) {
      const I = s.params.U / s.params.R;
      return [
        { k: 'I', v: U.fmt(I, 3) + ' А' },
        { k: 'P', v: U.fmt(s.params.U * I, 2) + ' Вт' }
      ];
    },

    init(ctx, state, w, h) {
      state.electrons = [];
      const N = 50;
      for (let i = 0; i < N; i++) state.electrons.push({ s: i / N });
      state.heat = 0;
    },

    update(state, dt) {
      const { U: V, R } = state.params;
      const I = V / R;
      const speed = U.clamp(I * 0.06, 0, 1.8);
      for (const e of state.electrons) e.s = (e.s + speed * dt) % 1;
      state.heat = window.Physica.U.smooth(state.heat, U.clamp(V * I / 50, 0, 1), dt, 0.25);
    },

    _buildPath(w, h) {
      const m = Math.min(w, h) * 0.10;
      // На мобильном делаем прямоугольник более квадратным
      const x1 = m, x2 = w - m;
      const y1 = h * 0.22, y2 = h * 0.78;
      const path = [
        { ax: x1, ay: y1, bx: x2, by: y1 },
        { ax: x2, ay: y1, bx: x2, by: y2 },
        { ax: x2, ay: y2, bx: x1, by: y2 },
        { ax: x1, ay: y2, bx: x1, by: y1 }
      ];
      let total = 0;
      for (const seg of path) {
        seg.len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
        seg.start = total; total += seg.len;
      }
      return { path, total, rect: { x1, y1, x2, y2 } };
    },

    _pointAt(path, total, s) {
      const dist = s * total;
      for (const seg of path) {
        if (dist >= seg.start && dist <= seg.start + seg.len) {
          const t = (dist - seg.start) / seg.len;
          return { x: U.lerp(seg.ax, seg.bx, t), y: U.lerp(seg.ay, seg.by, t) };
        }
      }
      const last = path[path.length - 1];
      return { x: last.bx, y: last.by };
    },

    render(ctx, state, w, h) {
      Draw.bgGrid(ctx, w, h, 32);
      const { path, total, rect } = this._buildPath(w, h);
      const { x1, y1, x2, y2 } = rect;
      const mobile = w < 480;

      // Провода
      ctx.save();
      ctx.strokeStyle = 'rgba(232,237,245,0.55)';
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const seg of path) { ctx.moveTo(seg.ax, seg.ay); ctx.lineTo(seg.bx, seg.by); }
      ctx.stroke();
      ctx.restore();

      // === Батарея (левая сторона) ===
      const byMid = (y1 + y2) / 2;
      const bH = Math.min(50, (y2 - y1) * 0.30);
      ctx.save();
      ctx.strokeStyle = '#7cf2c8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1 - 10, byMid - bH * 0.5); ctx.lineTo(x1 + 10, byMid - bH * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 5, byMid + bH * 0.2);  ctx.lineTo(x1 + 5, byMid + bH * 0.2);  ctx.stroke();
      ctx.strokeStyle = '#070a0f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x1, byMid - bH * 0.5 + 3); ctx.lineTo(x1, byMid + bH * 0.2 - 3); ctx.stroke();
      ctx.restore();
      // Подпись батареи — над серединой левого провода, не перекрывает ничего
      const uLabel = `U=${U.fmt(state.params.U, 1)} В`;
      Draw.text(ctx, uLabel, x1, y1 - 10, { color: '#7cf2c8', align: 'center', font: (mobile ? '10px' : '11px') + ' JetBrains Mono,monospace' });

      // === Резистор (верхний провод, посередине) ===
      const rxC = (x1 + x2) / 2, ry = y1;
      const rW = Math.min(mobile ? 70 : 110, (x2 - x1) * 0.25);
      const rH = mobile ? 14 : 18;
      ctx.save();
      ctx.strokeStyle = '#070a0f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(rxC - rW / 2, ry); ctx.lineTo(rxC + rW / 2, ry); ctx.stroke();
      const heat = state.heat;
      ctx.fillStyle = heat > 0.02
        ? `rgba(255,${Math.round(160 - heat * 60)},${Math.round(80 - heat * 60)},1)`
        : '#1a2230';
      if (heat > 0.05) { ctx.shadowBlur = 20 * heat; ctx.shadowColor = `rgba(255,140,80,${heat})`; }
      ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = 1.5;
      ctx.fillRect(rxC - rW / 2, ry - rH / 2, rW, rH);
      ctx.strokeRect(rxC - rW / 2, ry - rH / 2, rW, rH);
      ctx.restore();
      // Подпись резистора — над ним, всегда по центру
      Draw.text(ctx, `R=${U.fmt(state.params.R, 1)} Ом`, rxC, ry - rH / 2 - (mobile ? 6 : 8),
        { color: '#ffb86b', align: 'center', font: (mobile ? '10px' : '11px') + ' JetBrains Mono,monospace' });

      // === Амперметр (правая сторона) ===
      const ar = Math.min(22, (y2 - y1) * 0.12);
      const axX = x2, ayM = byMid;
      ctx.save();
      ctx.strokeStyle = '#070a0f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(axX, ayM - ar + 1); ctx.lineTo(axX, ayM + ar - 1); ctx.stroke();
      ctx.strokeStyle = '#5ac8fa'; ctx.fillStyle = '#0f141c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(axX, ayM, ar, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5ac8fa';
      ctx.font = `italic 600 ${Math.round(ar * 0.75)}px Fraunces,serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('A', axX, ayM);
      ctx.restore();
      // Подпись тока — под амперметром, всегда помещается
      const I = state.params.U / state.params.R;
      Draw.text(ctx, `I=${U.fmt(I, 2)} А`, axX, ayM + ar + (mobile ? 8 : 10),
        { color: '#5ac8fa', align: 'center', font: (mobile ? '10px' : '11px') + ' JetBrains Mono,monospace' });

      // === Электроны ===
      for (const e of state.electrons) {
        const p = this._pointAt(path, total, e.s);
        ctx.save();
        ctx.shadowBlur = 8; ctx.shadowColor = '#7cf2c8'; ctx.fillStyle = '#7cf2c8';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Легенда только если есть место
      if (h > 180) {
        Draw.text(ctx, '◯ электрон', x1 + 4, y2 + (mobile ? 8 : 10),
          { color: '#5a6577', font: '10px JetBrains Mono,monospace' });
      }
    }
  });
})();
