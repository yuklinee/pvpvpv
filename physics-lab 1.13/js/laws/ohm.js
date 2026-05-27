/* =========================================================
   PHYSICA · Закон Ома
   I = U / R
   Визуализация: замкнутая цепь с батареей, резистором и амперметром.
   Электроны движутся по проводам со скоростью, пропорциональной току.
   Резистор раскаляется при росте мощности.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  Laws.register({
    id: 'ohm',
    title: 'Закон Ома',
    description: 'Сила тока в проводнике прямо пропорциональна напряжению и обратно пропорциональна сопротивлению. Электроны движутся быстрее, если ток выше; резистор нагревается при увеличении мощности.',
    formula: 'I = U / R',

    params: [
      { id: 'U', label: 'Напряжение', latex: 'U', min: 0, max: 24, step: 0.1, value: 12, default: 12, unit: 'В', type: 'range' },
      { id: 'R', label: 'Сопротивление', latex: 'R', min: 1, max: 50, step: 0.5, value: 6, default: 6, unit: 'Ом', type: 'range' }
    ],

    readout(s) {
      const U_ = s.params.U, R_ = s.params.R;
      const I = U_ / R_;
      const P = U_ * I;
      return [
        { k: 'I', v: U.fmt(I, 3) + ' А' },
        { k: 'P', v: U.fmt(P, 2) + ' Вт' }
      ];
    },

    init(ctx, state, w, h) {
      // Электроны располагаются вдоль контура цепи. Параметр s — позиция на пути [0..1).
      state.electrons = [];
      const N = 60;
      for (let i = 0; i < N; i++) state.electrons.push({ s: i / N });
      state.heat = 0; // плавно нарастающая "температура" резистора (для свечения)
    },

    update(state, dt) {
      const { U: V, R } = state.params;
      const I = V / R;
      // Скорость движения частиц — пропорциональна току, ограничена сверху для адекватности картинки
      const speed = U.clamp(I * 0.06, 0, 1.8);
      for (const e of state.electrons) {
        e.s = (e.s + speed * dt) % 1;
        if (e.s < 0) e.s += 1;
      }
      // Сглаженный нагрев. Мощность нормируем по максимально возможной в нашем диапазоне.
      const P = V * I;
      const targetHeat = U.clamp(P / 50, 0, 1);
      state.heat = window.Physica.U.smooth(state.heat, targetHeat, dt, 0.25);
    },

    // Геометрия цепи строится "на лету" под размер canvas. Возвращаем массив сегментов с общей длиной.
    _buildPath(w, h) {
      const m = Math.min(w, h) * 0.08;
      const x1 = m, x2 = w - m, y1 = h * 0.25, y2 = h * 0.75;
      // Прямоугольный контур цепи (по часовой стрелке).
      const path = [
        { ax: x1, ay: y1, bx: x2, by: y1 }, // верх →
        { ax: x2, ay: y1, bx: x2, by: y2 }, // право ↓
        { ax: x2, ay: y2, bx: x1, by: y2 }, // низ ←
        { ax: x1, ay: y2, bx: x1, by: y1 }  // лево ↑
      ];
      let total = 0;
      for (const seg of path) {
        seg.len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
        seg.start = total;
        total += seg.len;
      }
      return { path, total, rect: { x1, y1, x2, y2 } };
    },

    _pointAt(path, total, s) {
      const dist = s * total;
      for (const seg of path) {
        if (dist >= seg.start && dist <= seg.start + seg.len) {
          const t = (dist - seg.start) / seg.len;
          return {
            x: U.lerp(seg.ax, seg.bx, t),
            y: U.lerp(seg.ay, seg.by, t)
          };
        }
      }
      const last = path[path.length - 1];
      return { x: last.bx, y: last.by };
    },

    render(ctx, state, w, h) {
      Draw.bgGrid(ctx, w, h, 32);
      const { path, total, rect } = this._buildPath(w, h);

      // Провода
      ctx.save();
      ctx.strokeStyle = 'rgba(232,237,245,0.55)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const seg of path) { ctx.moveTo(seg.ax, seg.ay); ctx.lineTo(seg.bx, seg.by); }
      ctx.stroke();
      ctx.restore();

      // === Батарея (на левой стороне) ===
      const bx = rect.x1, byMid = (rect.y1 + rect.y2) / 2;
      const bH = Math.min(60, (rect.y2 - rect.y1) * 0.35);
      ctx.save();
      ctx.strokeStyle = '#7cf2c8';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      // длинная черта (+) и короткая (−)
      ctx.beginPath();
      ctx.moveTo(bx - 12, byMid - bH * 0.5); ctx.lineTo(bx + 12, byMid - bH * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - 6,  byMid + bH * 0.2);  ctx.lineTo(bx + 6,  byMid + bH * 0.2);
      ctx.stroke();
      // Разрыв провода в месте батареи — спрячем "проводом-фоном"
      ctx.strokeStyle = '#070a0f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(bx, byMid - bH * 0.5 + 3);
      ctx.lineTo(bx, byMid + bH * 0.2 - 3);
      ctx.stroke();
      ctx.restore();
      Draw.text(ctx, `U = ${U.fmt(state.params.U, 1)} В`, bx + 16, byMid - 6, { color: '#7cf2c8' });

      // === Резистор (на верхней стороне посередине) ===
      const rxC = (rect.x1 + rect.x2) / 2;
      const ry = rect.y1;
      const rW = Math.min(120, (rect.x2 - rect.x1) * 0.28);
      const rH = 18;
      // Прячем провод под резистором
      ctx.save();
      ctx.strokeStyle = '#070a0f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(rxC - rW / 2, ry); ctx.lineTo(rxC + rW / 2, ry);
      ctx.stroke();
      // Корпус резистора — нагревается
      const heat = state.heat;
      const baseFill = '#1a2230';
      const hotFill = `rgba(255, ${Math.round(160 - heat * 60)}, ${Math.round(80 - heat * 60)}, 1)`;
      ctx.fillStyle = heat > 0.02 ? hotFill : baseFill;
      if (heat > 0.05) {
        ctx.shadowBlur = 20 * heat;
        ctx.shadowColor = `rgba(255,140,80,${heat})`;
      }
      ctx.strokeStyle = '#e8edf5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(rxC - rW / 2, ry - rH / 2, rW, rH);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      Draw.text(ctx, `R = ${U.fmt(state.params.R, 1)} Ом`, rxC, ry - rH - 6, {
        color: '#ffb86b', align: 'center'
      });

      // === Амперметр (справа, кружок с "А") ===
      const ax = rect.x2, ayMid = byMid;
      const ar = 22;
      ctx.save();
      // спрятать провод
      ctx.strokeStyle = '#070a0f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ax, ayMid - ar + 2); ctx.lineTo(ax, ayMid + ar - 2);
      ctx.stroke();
      // окружность
      ctx.strokeStyle = '#5ac8fa';
      ctx.fillStyle = '#0f141c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ax, ayMid, ar, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // буква А
      ctx.fillStyle = '#5ac8fa';
      ctx.font = 'italic 600 16px Fraunces, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', ax, ayMid);
      ctx.restore();
      // Подпись с током
      const I = state.params.U / state.params.R;
      Draw.text(ctx, `I = ${U.fmt(I, 2)} А`, ax - ar - 8, ayMid - 7, {
        color: '#5ac8fa', align: 'right'
      });

      // === Электроны ===
      // По часовой стрелке, начиная с правого верхнего угла. Для физкорректности они должны
      // идти от "+" к "−" во внешней цепи — рисуем как декоративный поток.
      for (const e of state.electrons) {
        const p = this._pointAt(path, total, e.s);
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#7cf2c8';
        ctx.fillStyle = '#7cf2c8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Подпись формулы в углу
      Draw.text(ctx, '◯ электрон', 14, h - 22, { color: '#5a6577' });
    }
  });
})();
