/* =========================================================
   PHYSICA · Стоячие волны (резонанс струны)
   y(x,t) = A·sin(n·π·x/L)·cos(ω·t)
   Струна длиной L колеблется на n-й гармонике.
   Узлы (нулевые точки) и пучности (максимумы амплитуды)
   подсвечиваются. Показываем суперпозицию двух бегущих волн,
   из которых складывается стоячая.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  Laws.register({
    id: 'standing-wave',
    group: 'BETA',
    title: 'Стоячие волны',
    description: 'Стоячая волна возникает при суперпозиции двух бегущих волн одинаковой частоты и амплитуды, движущихся навстречу. В узлах колебания нет, в пучностях — максимальная амплитуда.',
    formula: 'y = A·sin(nπx/L)·cos(ωt)',

    params: [
      { id: 'n',    label: 'Номер гармоники',   latex: 'n',  min: 1,   max: 12,  step: 1,   value: 3,   default: 3,   unit: '',    type: 'range' },
      { id: 'A',    label: 'Амплитуда',          latex: 'A',  min: 5,   max: 80,  step: 1,   value: 40,  default: 40,  unit: 'у.е.', type: 'range' },
      { id: 'f',    label: 'Основная частота',   latex: 'f',  min: 0.2, max: 4,   step: 0.1, value: 1.0, default: 1.0, unit: 'Гц',   type: 'range' },
      { id: 'showTraveling', label: 'Бегущие волны', type: 'toggle', value: 1, default: 1 },
    ],

    readout(s) {
      const { n, f } = s.params;
      const fn = n * f;
      const lambda = 2 / n; // λ в долях длины струны
      return [
        { k: 'fₙ', v: U.fmt(fn, 2) + ' Гц' },
        { k: 'λ',  v: U.fmt(lambda, 3) + ' L' },
        { k: 'узлов', v: n + 1 },
      ];
    },

    init(ctx, state, w, h) { /* ничего не нужно */ },

    update(state, dt) { /* время управляется через t в render */ },

    render(ctx, state, w, h, t) {
      Draw.bgGrid(ctx, w, h, 32);
      const { n, A, f, showTraveling } = state.params;

      const strY  = h * 0.5;         // центральная ось струны
      const strX0 = w * 0.07;        // левый конец
      const strX1 = w * 0.93;        // правый конец
      const strW  = strX1 - strX0;
      const omega = 2 * Math.PI * f * n; // угловая частота n-й гармоники
      const k     = n * Math.PI / strW;  // волновое число

      const POINTS = Math.ceil(strW);

      // ── Бегущие волны (если включены) ─────────────────────────────
      if (showTraveling) {
        // Волна вправо
        ctx.save();
        ctx.strokeStyle = 'rgba(255,107,156,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= POINTS; i++) {
          const x = strX0 + i;
          const y = strY + A * 0.5 * Math.sin(k * i - omega * t);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        // Волна влево
        ctx.save();
        ctx.strokeStyle = 'rgba(90,200,250,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= POINTS; i++) {
          const x = strX0 + i;
          const y = strY + A * 0.5 * Math.sin(k * i + omega * t);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        // Легенда
        ctx.save();
        ctx.fillStyle = 'rgba(255,107,156,0.5)';
        ctx.fillRect(strX0, h - 28, 20, 2);
        Draw.text(ctx, '→ бегущая', strX0 + 24, h - 32, { color: 'rgba(255,107,156,0.7)', font: '9px JetBrains Mono, monospace' });
        ctx.fillStyle = 'rgba(90,200,250,0.5)';
        ctx.fillRect(strX0 + 110, h - 28, 20, 2);
        Draw.text(ctx, '← бегущая', strX0 + 134, h - 32, { color: 'rgba(90,200,250,0.7)', font: '9px JetBrains Mono, monospace' });
        ctx.restore();
      }

      // ── Огибающая (амплитудный профиль) ───────────────────────────
      ctx.save();
      ctx.strokeStyle = 'rgba(124,242,200,0.15)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 4]);
      // Верхняя огибающая
      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const x = strX0 + i;
        const y = strY - A * Math.abs(Math.sin(k * i));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Нижняя огибающая
      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const x = strX0 + i;
        const y = strY + A * Math.abs(Math.sin(k * i));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Крепления струны ──────────────────────────────────────────
      const drawAnchor = (x) => {
        ctx.save();
        ctx.fillStyle   = '#3a4452';
        ctx.strokeStyle = '#5a6577';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(x, strY);
        ctx.lineTo(x - 8, strY + 16);
        ctx.lineTo(x + 8, strY + 16);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // штриховка
        for (let hy = strY + 16; hy <= strY + 26; hy += 5) {
          ctx.beginPath(); ctx.moveTo(x - 10, hy); ctx.lineTo(x + 10, hy); ctx.stroke();
        }
        ctx.restore();
      };
      drawAnchor(strX0);
      drawAnchor(strX1);

      // ── Стоячая волна (главная линия) ─────────────────────────────
      const cosT = Math.cos(omega * t);
      // Цвет зависит от «заряженности» момента времени
      const intensity = Math.abs(cosT);
      const rS = Math.round(124 * intensity + 90 * (1 - intensity));
      const gS = Math.round(242 * intensity + 200 * (1 - intensity));
      const bS = Math.round(200 * intensity + 250 * (1 - intensity));

      ctx.save();
      ctx.shadowBlur  = 14 * intensity;
      ctx.shadowColor = `rgb(${rS},${gS},${bS})`;
      ctx.strokeStyle = `rgb(${rS},${gS},${bS})`;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const x = strX0 + i;
        const y = strY + A * Math.sin(k * i) * cosT;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // ── Узлы и пучности ───────────────────────────────────────────
      for (let m = 0; m <= n; m++) {
        // Узел: x = m·strW/n
        const nodeX = strX0 + m * strW / n;
        ctx.save();
        ctx.fillStyle   = '#ff6e9c';
        ctx.strokeStyle = '#ff6e9c';
        ctx.shadowBlur  = 10; ctx.shadowColor = '#ff6e9c';
        ctx.beginPath(); ctx.arc(nodeX, strY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (m < n) {
          // Пучность: x = (m+0.5)·strW/n
          const antX = strX0 + (m + 0.5) * strW / n;
          const antY = strY + A * Math.sin(k * (antX - strX0)) * cosT;
          ctx.save();
          ctx.fillStyle   = `rgba(${rS},${gS},${bS},0.9)`;
          ctx.shadowBlur  = 10; ctx.shadowColor = `rgb(${rS},${gS},${bS})`;
          ctx.beginPath(); ctx.arc(antX, antY, 5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }

      // ── Подписи узлов/пучностей ───────────────────────────────────
      // Только первый узел и первая пучность, чтобы не захламлять
      if (n <= 8) {
        Draw.text(ctx, 'узел', strX0, strY + 22,
          { color: '#ff6e9c', align: 'center', font: '9px JetBrains Mono, monospace' });
        const ant0X = strX0 + 0.5 * strW / n;
        Draw.text(ctx, 'пучность', ant0X, strY - A - 16,
          { color: `rgb(${rS},${gS},${bS})`, align: 'center', font: '9px JetBrains Mono, monospace' });
      }

      // ── Панель данных ─────────────────────────────────────────────
      const panX = strX0;
      const panY = h * 0.08;
      Draw.text(ctx, `n = ${n}  (${n}-я гармоника)`, panX, panY,
        { color: '#7cf2c8', font: '12px JetBrains Mono, monospace' });
      Draw.text(ctx, `fₙ = ${U.fmt(n * f, 2)} Гц   λ = ${U.fmt(2 / n, 3)}L   узлов: ${n + 1}`,
        panX, panY + 18, { color: '#8a96a8', font: '11px JetBrains Mono, monospace' });

      // ── Вертикальная шкала амплитуды ──────────────────────────────
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(strX0 - 18, strY - A); ctx.lineTo(strX0 + 6, strY - A); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(strX0 - 18, strY + A); ctx.lineTo(strX0 + 6, strY + A); ctx.stroke();
      ctx.setLineDash([]);
      // двусторонняя стрелка
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(strX0 - 10, strY - A); ctx.lineTo(strX0 - 10, strY + A); ctx.stroke();
      ctx.restore();
      Draw.text(ctx, `A=${A}`, strX0 - 14, strY - 6,
        { color: '#5a6577', align: 'right', font: '9px JetBrains Mono, monospace' });
    }
  });
})();
