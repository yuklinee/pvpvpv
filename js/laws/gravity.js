/* =========================================================
   PHYSICA · Закон всемирного тяготения (орбиты)
   F = G·M·m / r²
   Планета движется по эллиптической орбите вокруг звезды.
   Второй закон Кеплера: площадь, заметаемая радиус-вектором,
   постоянна — визуально показываем «секторы» площади.
   ========================================================= */
(function () {
  const { Laws, U, Draw } = window.Physica;

  const G = 1400; // гравитационная постоянная (условная, для красивых орбит на экране)

  Laws.register({
    id: 'gravity',
    group: 'BETA',
    title: 'Закон всемирного тяготения',
    description: 'Сила тяготения между телами обратно пропорциональна квадрату расстояния. Планета движется по эллипсу; у перигелия — быстрее, у афелия — медленнее (2-й закон Кеплера).',
    formula: 'F = G·M·m / r²',

    params: [
      { id: 'M',  label: 'Масса звезды',      latex: 'M',  min: 50,  max: 400, step: 5,  value: 200, default: 200, unit: 'у.м.', type: 'range' },
      { id: 'v0', label: 'Нач. скорость',      latex: 'v₀', min: 5,   max: 40,  step: 0.5,value: 18,  default: 18,  unit: 'у.е.', type: 'range' },
      { id: 'e',  label: 'Эксцентриситет',     latex: 'e',  min: 0,   max: 0.9, step: 0.01,value: 0.4, default: 0.4, unit: '',     type: 'range' },
      { id: 'trail',label:'Длина следа орбиты',latex:'',    min: 100, max: 1200,step: 50, value: 600, default: 600, unit: '',     type: 'range' },
    ],

    readout(s) {
      if (!s.planet) return [];
      const r   = Math.hypot(s.planet.x, s.planet.y);
      const spd = Math.hypot(s.planet.vx, s.planet.vy);
      return [
        { k: 'r',  v: U.fmt(r,   1) + ' у.е.' },
        { k: '|v|',v: U.fmt(spd, 2) + ' у.е.' },
        { k: 'a',  v: U.fmt(s.orbitA || 0, 1) + ' у.е.' },
        { k: 'e',  v: U.fmt(s.orbitE || 0, 2) },
      ];
    },

    init(ctx, state, w, h) {
      this._spawn(state);
    },

    _spawn(state) {
      const { M, v0, e } = state.params;

      // Правильные кеплеровские начальные условия:
      // Стартуем из афелия (самая дальняя точка — максимально безопасная).
      // Для эллиптической орбиты:
      //   r_a = a*(1+e)  — расстояние в афелии
      //   v_a = sqrt(GM*(1-e) / (a*(1+e)))  — скорость в афелии
      //
      // Выбираем большую полуось a так, чтобы орбита умещалась на экране
      // и не была ни слишком маленькой, ни гиперболической.
      // Из v_circ = sqrt(GM/a) => a = GM / v0^2 (круговая орбита как базис).
      // Масштабируем a под экран: ограничиваем диапазон.

      const a = U.clamp(G * M / (v0 * v0), 30, 260);

      // Скорость в афелии (перпендикулярна радиус-вектору, направлена вверх)
      const r_a  = a * (1 + e);
      const v_a  = Math.sqrt(Math.max(0, G * M * (1 - e) / (a * (1 + e))));

      // Стартуем из афелия: планета слева, скорость направлена вверх
      state.planet      = { x: -r_a, y: 0, vx: 0, vy: v_a };
      state.trail       = [];
      state.sectors     = [];
      state.sectorTimer = 0;
      state.t           = 0;
      // Запоминаем параметры орбиты для отображения
      state.orbitA      = a;
      state.orbitE      = e;
    },

    onParam(id, value, state) {
      this._spawn(state);
    },

    update(state, dt) {
      if (!state.planet) return;
      const { M } = state.params;
      // Верле-интегратор (symplectic) — энергия стабильна
      const steps = 20;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const r2 = state.planet.x ** 2 + state.planet.y ** 2;
        const r  = Math.sqrt(r2);
        // Порог столкновения — пропорционален √M, чтобы при больших звёздах тоже работал
        const collideR = Math.sqrt(state.params.M) * 0.4;
        if (r < collideR) { this._spawn(state); return; }
        const F  = G * M / r2;
        const ax = -F * state.planet.x / r;
        const ay = -F * state.planet.y / r;
        state.planet.vx += ax * h;
        state.planet.vy += ay * h;
        state.planet.x  += state.planet.vx * h;
        state.planet.y  += state.planet.vy * h;
      }
      state.t += dt;

      // Секторы Кеплера — накапливаем раз в 0.4 сек
      state.sectorTimer += dt;
      if (state.sectorTimer > 0.4) {
        state.sectorTimer = 0;
        state.sectors.push({ x: state.planet.x, y: state.planet.y });
        if (state.sectors.length > 12) state.sectors.shift();
      }
    },

    render(ctx, state, w, h) {
      ctx.save();
      ctx.fillStyle = 'rgba(7,10,15,0.25)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      if (!state.planet) return;
      const cx = w / 2, cy = h / 2;
      const scale = Math.min(w, h) * 0.35;

      // Перевод координат планеты → пиксели
      const px = cx + state.planet.x * scale / (scale * 1.2);
      const py = cy - state.planet.y * scale / (scale * 1.2);
      const toScreen = (x, y) => ({
        sx: cx + x * scale / (scale * 1.2),
        sy: cy - y * scale / (scale * 1.2),
      });

      // Трек
      state.trail.push({ x: state.planet.x, y: state.planet.y });
      const trailMax = state.params.trail;
      if (state.trail.length > trailMax) state.trail.shift();

      // Тонкие кольца фона (астрономика)
      ctx.save();
      for (let r = 0.3; r <= 1.4; r += 0.35) {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale / 1.1, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Секторы Кеплера (заштрихованные треугольники от звезды)
      if (state.sectors.length >= 2) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,184,107,0.07)';
        ctx.strokeStyle = 'rgba(255,184,107,0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i < state.sectors.length - 1; i++) {
          const A = toScreen(0, 0);
          const B = toScreen(state.sectors[i].x,     state.sectors[i].y);
          const C = toScreen(state.sectors[i + 1].x, state.sectors[i + 1].y);
          ctx.beginPath();
          ctx.moveTo(A.sx, A.sy); ctx.lineTo(B.sx, B.sy); ctx.lineTo(C.sx, C.sy);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }

      // Трек орбиты
      if (state.trail.length > 1) {
        ctx.save();
        ctx.lineWidth = 1.5;
        for (let i = 1; i < state.trail.length; i++) {
          const a  = (i / state.trail.length) * 0.65;
          const pA = toScreen(state.trail[i - 1].x, state.trail[i - 1].y);
          const pB = toScreen(state.trail[i].x,     state.trail[i].y);
          ctx.strokeStyle = `rgba(90,200,250,${a.toFixed(3)})`;
          ctx.shadowBlur  = a > 0.5 ? 4 : 0;
          ctx.shadowColor = '#5ac8fa';
          ctx.beginPath(); ctx.moveTo(pA.sx, pA.sy); ctx.lineTo(pB.sx, pB.sy); ctx.stroke();
        }
        ctx.restore();
      }

      // Линия радиус-вектора
      ctx.save();
      ctx.strokeStyle = 'rgba(255,107,156,0.3)';
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Звезда
      const starR = Math.max(12, (state.params.M / 400) * 26);
      ctx.save();
      ctx.shadowBlur  = 40; ctx.shadowColor = '#ffb86b';
      const sGrd = ctx.createRadialGradient(cx - starR * 0.25, cy - starR * 0.25, 1, cx, cy, starR);
      sGrd.addColorStop(0, '#fff8e0');
      sGrd.addColorStop(0.5, '#ffcc44');
      sGrd.addColorStop(1,   '#e06010');
      ctx.fillStyle = sGrd;
      ctx.beginPath(); ctx.arc(cx, cy, starR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Планета
      const rPx = Math.hypot(state.planet.x, state.planet.y);
      const spd  = Math.hypot(state.planet.vx, state.planet.vy);
      // Цвет планеты: ближе к звезде — горячее (оранжевый), дальше — холоднее (синий)
      const maxR  = scale / 1.2 * 1.5;
      const heatN = U.clamp(1 - rPx / maxR, 0, 1);
      const pr = Math.round(80 + heatN * 120);
      const pg = Math.round(160 + heatN * 20);
      const pb = Math.round(255 - heatN * 180);
      const planetR = 8;
      ctx.save();
      ctx.shadowBlur  = 16; ctx.shadowColor = `rgb(${pr},${pg},${pb})`;
      const pGrd = ctx.createRadialGradient(px - 3, py - 3, 1, px, py, planetR);
      pGrd.addColorStop(0, `rgb(${Math.min(255,pr+80)},${Math.min(255,pg+80)},255)`);
      pGrd.addColorStop(1, `rgb(${pr},${pg},${pb})`);
      ctx.fillStyle = pGrd;
      ctx.beginPath(); ctx.arc(px, py, planetR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Вектор скорости
      const vScale = 3.5;
      const { sx: vex, sy: vey } = toScreen(state.planet.x + state.planet.vx * vScale / 1.2,
                                             state.planet.y + state.planet.vy * vScale / 1.2);
      ctx.save();
      ctx.strokeStyle = '#7cf2c8'; ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6; ctx.shadowColor = '#7cf2c8';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(vex, vey); ctx.stroke();
      // стрелка
      const vAng = Math.atan2(vey - py, vex - px);
      ctx.fillStyle = '#7cf2c8';
      ctx.beginPath();
      ctx.moveTo(vex, vey);
      ctx.lineTo(vex - 7 * Math.cos(vAng - 0.4), vey - 7 * Math.sin(vAng - 0.4));
      ctx.lineTo(vex - 7 * Math.cos(vAng + 0.4), vey - 7 * Math.sin(vAng + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // Метки
      Draw.text(ctx, 'M = ' + U.fmt(state.params.M, 0) + ' у.м.', cx, cy + starR + 16,
        { color: '#ffb86b', align: 'center', font: '10px JetBrains Mono, monospace' });
      Draw.text(ctx, '→ v', px + 12, py - 8,
        { color: '#7cf2c8', font: '10px JetBrains Mono, monospace' });
      // Пояснение секторов
      Draw.text(ctx, '▲ секторы равновелики (II закон Кеплера)', w / 2, h - 16,
        { color: '#5a6577', align: 'center', font: '10px JetBrains Mono, monospace' });
    }
  });
})();
