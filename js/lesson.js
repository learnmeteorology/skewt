/* global Thermo, SkewChart, SkewParams, LESSONS */
// Plays one lesson from js/lessons.js: its words, chart, animation and task. Nothing is graded.
(function (root) {
  'use strict';
  const { el, text, pathD, range, barb } = SkewChart;
  const $ = id => document.getElementById(id);

  // How near a tap or click must be, in screen pixels. A marked point must also be within the
  // task's own limits in mb and °C, so a small chart doesn't accept a spot far from the right one.
  const REACH_MOUSE = 16, REACH_TOUCH = 24;
  // Lines are long and easy to tell apart, so picking one allows a little more room.
  const LINE_REACH_MOUSE = 22, LINE_REACH_TOUCH = 30;
  const KEY = 'lessonProgress';

  const asked = new URLSearchParams(location.search).get('lesson');
  const lesson = LESSONS.find(l => l.id === asked) || LESSONS[0];
  const STEPS = [...lesson.steps, { stage: 'Done', title: 'Lesson complete', recap: true, words: [], chart: lesson.recapChart || lesson.steps[0].chart, scene: lesson.recapScene }];

  // ---- Progress, saved in this browser ----
  const readAll = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  };
  const HOWS = ['first', 'retry', 'shown'];
  let step = 0, done = {};
  const saved = readAll()[lesson.id];
  if (saved && Number.isInteger(saved.step) && saved.step >= 0 && saved.step < STEPS.length) step = saved.step;
  for (const s of STEPS) if (s.task && HOWS.includes(saved?.done?.[s.task.id])) done[s.task.id] = saved.done[s.task.id];
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [lesson.id]: { step, done } })); } catch (e) { /* not remembered */ }
  };

  // What has been tried on this step: wrong answers stay marked so they aren't tried again.
  let tries = 0, tried = new Set(), typedValue = '', svg = null;

  const make = (tag, content, parent, className) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  };
  function feedback(message, kind = '') {
    $('lessonfeedback').textContent = message;
    $('lessonfeedback').className = kind;
  }
  const solvedStep = s => Boolean(s.task && done[s.task.id]);

  // ---- The animation ----
  // A scene moves from the pressure `from` to the pressure `to`. Each track is a line traced
  // between its own two pressures: at(p) is its temperature, route adds the highlight and dot names
  // the marker riding its leading end. areas are shaded as the parcel passes. read(p) is the
  // sentence under the chart.
  let scene = null, progress = 0, frame = 0, layers = null;
  const still = root.matchMedia('(prefers-reduced-motion: reduce)');
  const between = (a, b, n = 60) => range(0, n, 1).map(i => a * Math.pow(b / a, i / n));

  function showAt(u) {
    progress = Math.max(0, Math.min(1, u));
    const p = scene.from * Math.pow(scene.to / scene.from, progress), up = scene.to < scene.from;
    const passed = q => (up ? p <= q + 1e-6 : p >= q - 1e-6); // has the climb (or descent) reached q?
    for (const t of scene.tracks) {
      const part = layers.get(t), started = passed(t.from);
      const end = up ? Math.max(p, t.to) : Math.min(p, t.to);
      const d = started && Math.abs(end - t.from) > 1e-6 ? pathD(between(t.from, end).map(q => svg.toView([t.at(q), q]))) : '';
      part.line.setAttribute('d', d);
      if (part.route) part.route.setAttribute('d', d);
      // The dot rides the end of its track. Where the whole movement stops, it stays.
      const riding = t.dot && started && (!passed(t.to) || Math.abs(p - t.to) < 0.05 && (progress === 1 && Math.abs(t.to - scene.to) < 0.05));
      if (part.dot) {
        part.dot.style.display = riding ? '' : 'none';
        if (riding) {
          const [x, y] = svg.toView([t.at(end), end]);
          part.dot.setAttribute('cx', x);
          part.dot.setAttribute('cy', y);
        }
      }
    }
    for (const area of scene.areas || []) {
      const top = Math.max(p, area.to);
      let d = '';
      if (up && p < area.from) {
        const ps = between(area.from, top, 80);
        d = pathD(ps.map(q => svg.toView([area.left(q), q])).concat(ps.slice().reverse().map(q => svg.toView([area.right(q), q])))) + 'Z';
      }
      layers.get(area).path.setAttribute('d', d);
    }
    // The answer is named once the movement gets there.
    const reached = scene.answerAt === undefined || passed(scene.answerAt);
    svg.querySelectorAll('.param-ring, .param-answer').forEach(n => { n.style.display = reached ? '' : 'none'; });
    $('reading').textContent = scene.read(p);
  }

  // The one button under the chart skips to the end while the parcel is moving, then replays it.
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    $('replay').textContent = progress >= 1 ? 'Replay' : 'Play';
    // Screen readers hear where the movement ended, not every step of it.
    $('announce').textContent = scene && progress >= 1 ? $('reading').textContent : '';
  }
  function play() {
    stop();
    if (progress >= 1) showAt(0);
    const from = progress, began = performance.now(), length = (scene.seconds || 5) * 700;
    const tick = now => {
      showAt(from + (now - began) / length);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else stop();
    };
    $('replay').textContent = 'Skip';
    frame = requestAnimationFrame(tick);
  }
  function skip() {
    showAt(1);
    stop();
  }

  // Adds the moving pieces to a freshly drawn chart. People who ask for less motion see the
  // finished picture, and can still press Replay.
  function startScene(next) {
    scene = next || null;
    $('replay').hidden = !scene;
    document.querySelector('.lesson-caption').classList.toggle('empty', !scene);
    $('reading').textContent = '';
    $('announce').textContent = '';
    if (!scene) return;
    layers = new Map();
    const plot = svg.querySelector('g[clip-path]');
    for (const area of scene.areas || []) layers.set(area, { path: el('path', { class: area.cls }, plot) });
    // Traced lines stop at the edges of the plot, like the printed ones.
    const traced = el('g', { 'clip-path': plot.getAttribute('clip-path') }, svg);
    for (const t of scene.tracks) layers.set(t, { route: t.route ? el('path', { class: 'param-route' }, traced) : null });
    for (const t of scene.tracks) layers.get(t).line = el('path', { class: t.cls }, traced);
    svg.querySelectorAll('.param-point').forEach(n => svg.appendChild(n)); // the fixed dots stay on top
    for (const t of scene.tracks) if (t.dot) layers.get(t).dot = el('circle', { r: 8, class: `lesson-parcel ${t.dot}` }, svg);
    progress = 0;
    if (still.matches) skip(); else { showAt(0); play(); }
  }

  // ---- The chart for the current step ----
  // What the step shows. An answered task adds its answer, or whatever its `after` says.
  function view(s) {
    const task = s.task, solved = solvedStep(s);
    const chart = { ...s.chart };
    chart.lines = [...(chart.lines || [])];
    chart.routes = [...(chart.routes || [])];
    chart.marks = [...(chart.marks || [])];
    chart.dots = [...(chart.dots || [])];
    let moving = s.scene;
    if (task?.type === 'pick') {
      for (const [letter, line] of Object.entries(task.lines)) {
        if (solved && letter !== task.right) continue;
        chart.lines.push({ cls: line.cls, pts: line.pts });
        if (!solved) chart.marks.push({ n: letter, at: line.at || line.pts[Math.round((line.pts.length - 1) * (line.tag ?? 0.75))] });
        else if (!s.after?.scene) chart.routes.push(line.pts);
      }
    }
    if (task?.type === 'point' && solved) {
      chart.dots.push({ at: task.goal });
      if (task.mark) chart.answer = { at: task.goal, words: task.mark, dx: 14, dy: -10, ...task.markAt };
    }
    if (solved && s.after) {
      if (s.after.chart) Object.assign(chart, s.after.chart);
      if (s.after.scene) { moving = s.after.scene; if (s.after.keep !== true) chart.routes = s.after.chart?.routes || []; }
    }
    return { chart, scene: moving };
  }

  // The plot height, in the chart's own units, that makes the chart fill its space. Beside the
  // answers that space is the figure; on a small screen it is most of the screen's height.
  const CHART_WIDTH = 520, AROUND_PLOT = 68;
  function chartShape() {
    const box = $('figure'), style = getComputedStyle(box);
    const width = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const narrow = root.matchMedia('(max-width: 760px)').matches;
    // On a small screen it leaves room for the question above and the answer buttons below.
    const height = narrow ? root.innerHeight * 0.45 : box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    return width > 0 && height > 0 ? Math.round(CHART_WIDTH * height / width - AROUND_PLOT) : undefined;
  }
  let shape;

  function drawChart() {
    cancelAnimationFrame(frame);
    frame = 0;
    const s = STEPS[step], { chart: c, scene: moving } = view(s);
    // The caption under the chart changes how much room there is, so it is settled first.
    document.querySelector('.lesson-caption').classList.toggle('empty', !moving);
    shape = chartShape();
    // The line being traced is added by the animation, so it isn't drawn in advance.
    svg = SkewParams.chart({
      label: `${c.label || 'Skew-T diagram'}. ${s.title}.`, top: c.top, bottom: c.bottom, shape, fit: c.fit,
      lines: c.lines, path: c.routes, steps: c.marks, answer: c.answer, notes: c.notes, shade: c.shade, printed: true,
    });
    // Letters are drawn without the little dot a numbered step would have.
    for (const { at } of c.dots) {
      const [x, y] = svg.toView(at);
      el('circle', { cx: x, cy: y, r: 5, class: 'param-point' }, svg);
    }
    for (const point of c.points || []) {
      const [x, y] = svg.toView(point.at);
      el('circle', { cx: x, cy: y, r: 6, class: `placed ${point.cls}` }, svg);
    }
    // Wind barbs sit just inside the right edge, one for each reading that is in view.
    if (c.barbs) {
      for (const level of c.barbs) {
        const [, y] = svg.toView([0, level.p]);
        if (y < svg.plotBox.top + 8 || y > svg.plotBox.bottom - 4) continue;
        barb(svg, svg.plotBox.right - 52, y, level.wdir, level.wspd);
      }
    }
    const clickable = !solvedStep(s) && ['pick', 'point'].includes(s.task?.type);
    svg.classList.toggle('lesson-clickable', clickable);
    if (clickable) {
      svg.addEventListener('click', onChartClick);
      svg.addEventListener('pointermove', onChartHover);
      svg.addEventListener('pointerleave', () => overlay('hover'));
    } else svg.addEventListener('click', () => { if (frame) skip(); });
    $('figure').replaceChildren(svg);
    startScene(moving);
  }

  // Marks drawn over the chart without redrawing it: 'hover', 'wrong' or 'miss'. With no
  // element, the mark is removed.
  function overlay(kind, name, attrs) {
    svg.querySelector(`[data-mark="${kind}"]`)?.remove();
    if (name) el(name, { ...attrs, 'data-mark': kind, 'pointer-events': 'none' }, svg);
  }

  // ---- Answering ----
  function solve(message, shown) {
    done[STEPS[step].task.id] = shown ? 'shown' : tries ? 'retry' : 'first';
    save();
    render(false);
    feedback(message, 'right');
    $('next').focus({ preventScroll: true });
  }
  function tryAgain(message) {
    tries++;
    feedback(`Not yet. ${message}`, 'wrong');
  }
  const correct = task => `Correct. ${task.done}`;
  // A number with its unit, if it has one: "35 knots", "48%", "-9.5".
  const amount = (value, unit) => `${value}${unit ? `${unit === '%' ? '' : ' '}${unit}` : ''}`;
  // Greys out a wrong answer's button where it is, so nothing moves.
  function ruleOut(answer) {
    tried.add(answer);
    const button = [...$('answers').querySelectorAll('button[data-answer]')].find(b => b.dataset.answer === answer);
    if (button) {
      button.classList.add('is-wrong');
      button.setAttribute('aria-disabled', 'true');
    }
  }

  function answerLine(letter) {
    const task = STEPS[step].task;
    if (letter === task.right) return solve(correct(task));
    ruleOut(letter);
    overlay('wrong', 'path', { d: pathD(task.lines[letter].pts.map(svg.toView)), class: 'lesson-wrong', 'clip-path': svg.querySelector('g[clip-path]').getAttribute('clip-path') });
    return tryAgain(task.lines[letter].why);
  }

  // The distance in screen pixels from a click to a point in the chart's own units.
  function screenDistance(e, [x, y]) {
    const at = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return Math.hypot(e.clientX - at.x, e.clientY - at.y);
  }
  // Where a pointer is in the chart's own units, or null outside the plot.
  function plotPoint(e) {
    const here = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const box = svg.plotBox;
    return here.x < box.left || here.x > box.right || here.y < box.top || here.y > box.bottom ? null : here;
  }
  // The lettered line closest to the pointer, if it is near enough to pick.
  function nearestLine(e, here) {
    const task = STEPS[step].task, box = svg.plotBox;
    let best = null, nearest = e.pointerType === 'mouse' ? LINE_REACH_MOUSE : LINE_REACH_TOUCH;
    for (const [letter, line] of Object.entries(task.lines)) {
      if (tried.has(letter)) continue;
      const pts = line.pts.map(svg.toView);
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
        const u = Math.max(0, Math.min(1, ((here.x - ax) * dx + (here.y - ay) * dy) / (dx * dx + dy * dy || 1)));
        const qx = ax + u * dx, qy = ay + u * dy;
        if (qx < box.left || qx > box.right || qy < box.top || qy > box.bottom) continue;
        const d = screenDistance(e, [qx, qy]);
        if (d < nearest) { nearest = d; best = letter; }
      }
    }
    return best;
  }

  // With a mouse, the line about to be picked lights up, and a ring shows where a point would go.
  function onChartHover(e) {
    if (e.pointerType === 'touch') return;
    const here = plotPoint(e), task = STEPS[step].task;
    if (!here) return overlay('hover');
    if (task.type === 'point') return overlay('hover', 'circle', { cx: here.x, cy: here.y, r: 7, class: 'lesson-aim' });
    const letter = nearestLine(e, here);
    svg.classList.toggle('lesson-onLine', Boolean(letter));
    return letter
      ? overlay('hover', 'path', { d: pathD(task.lines[letter].pts.map(svg.toView)), class: 'lesson-hover', 'clip-path': svg.querySelector('g[clip-path]').getAttribute('clip-path') })
      : overlay('hover');
  }

  function onChartClick(e) {
    const task = STEPS[step].task, here = plotPoint(e);
    if (!here) return null;
    if (task.type === 'point') {
      const reach = e.pointerType === 'mouse' ? REACH_MOUSE : REACH_TOUCH;
      const [t, p] = svg.toData(here.x, here.y), [goalT, goalP] = task.goal, goal = svg.toView(task.goal);
      const tLimit = task.tLimit ?? 2, pLimit = task.pLimit ?? 25;
      if (screenDistance(e, goal) <= reach && Math.abs(p - goalP) <= pLimit && Math.abs(t - goalT) <= tLimit) return solve(correct(task));
      const { x, y } = here;
      overlay('miss', 'path', { d: `M${x - 8} ${y - 8}L${x + 8} ${y + 8}M${x - 8} ${y + 8}L${x + 8} ${y - 8}`, class: 'lesson-miss' });
      if (Math.abs(here.y - goal[1]) > 9) return tryAgain(`Your point is too ${p < goalP ? 'high' : 'low'}. Move ${p < goalP ? 'down' : 'up'}. ${task.hint || ''}`);
      return tryAgain(`Your height is about right. Move ${here.x < goal[0] ? 'right' : 'left'}. ${task.hint || ''}`);
    }
    const letter = nearestLine(e, here);
    if (!letter) return feedback('That is not one of the choices. Click one of the thicker, lettered lines, or use the letter buttons.');
    return answerLine(letter);
  }

  function showMe() {
    const task = STEPS[step].task;
    const lead = { pick: `Here is the line: ${task.right}. `, point: 'The spot is now marked. ', number: task.type === 'number' ? `The answer is ${task.margin ? 'about ' : ''}${amount(task.value, task.unit)}. ` : '', choice: `The answer is “${task.right}”. ` }[task.type];
    solve(lead + task.done, true);
  }

  function typedForm(area, labelText, solved, check) {
    const form = make('form', undefined, area, 'lesson-typed');
    form.noValidate = true;
    const label = make('label', `${labelText} `, form);
    const input = make('input', undefined, label);
    Object.assign(input, { type: 'number', step: 'any', inputMode: 'text', value: typedValue, disabled: solved }); // some number pads have no minus sign
    const button = make('button', solved ? '✓' : 'Check', form);
    Object.assign(button, { type: 'submit', disabled: solved });
    form.addEventListener('submit', e => {
      e.preventDefault();
      typedValue = input.value;
      if (!Number.isFinite(input.valueAsNumber)) return feedback('Type a number, then choose Check.');
      return check(input.valueAsNumber);
    });
  }

  // The answer controls stay on screen once a task is done, with the right one marked.
  function drawAnswers() {
    const s = STEPS[step], task = s.task, area = $('answers');
    area.replaceChildren();
    area.classList.remove('short');
    if (!task) return;
    const solved = Boolean(done[task.id]);
    const option = (answer, label, className, choose) => {
      const button = make('button', label, area, className);
      button.type = 'button';
      button.dataset.answer = answer;
      if (solved) {
        button.classList.toggle('is-right', answer === task.right);
        button.disabled = true;
      } else button.addEventListener('click', () => { if (!tried.has(answer)) choose(); });
      return button;
    };
    if (task.type === 'pick') {
      for (const [letter, line] of Object.entries(task.lines)) {
        const button = option(letter, `Line ${letter}`, 'lesson-letter', () => answerLine(letter));
        // Screen reader users hear what the chart shows about each line.
        if (line.describe) button.setAttribute('aria-label', `Line ${letter}, ${line.describe}`);
        // Pointing at a button lights up its line.
        if (!solved) {
          button.addEventListener('pointerenter', () => overlay('hover', 'path', { d: pathD(line.pts.map(svg.toView)), class: 'lesson-hover', 'clip-path': svg.querySelector('g[clip-path]').getAttribute('clip-path') }));
          button.addEventListener('pointerleave', () => overlay('hover'));
        }
      }
    } else if (task.type === 'choice') {
      area.classList.toggle('short', task.choices.every(c => c.length <= 18));
      for (const choice of task.choices) {
        option(choice, choice, 'lesson-choice', () => {
          if (choice === task.right) return solve(correct(task));
          ruleOut(choice);
          return tryAgain(task.why[choice]);
        });
      }
    } else if (task.type === 'number') {
      typedForm(area, task.label, solved, value => {
        if (Math.abs(value - task.value) <= task.margin + 1e-9) return solve(task.margin ? `${correct(task)} Answers within ${amount(task.margin, task.unit)} of it count.` : correct(task));
        return tryAgain(`That is too ${value > task.value ? 'high' : 'low'}. ${task.hint || ''}`);
      });
    } else if (task.typed) {
      const typed = task.typed;
      typedForm(area, typed.label, solved, value => {
        if (Math.abs(value - typed.value) <= typed.margin) return solve(`${correct(task)} A typed reading within ${typed.margin} mb counts.`);
        return tryAgain(value > typed.value ? 'That is lower on the chart than the spot, so try a smaller pressure.' : 'That is higher on the chart than the spot, so try a larger pressure.');
      });
    }
  }

  // Equations are typeset by KaTeX. Without it (no internet connection) plain words are shown.
  function equations(list, parent) {
    for (const { latex, plain } of list || []) {
      const box = make('div', undefined, parent, 'lesson-equation');
      if (root.katex) root.katex.render(latex, box, { displayMode: true, throwOnError: false });
      else box.textContent = plain;
    }
  }

  const following = LESSONS[LESSONS.indexOf(lesson) + 1];
  function recap() {
    const words = $('words');
    make('p', 'What you learned:', words);
    const list = make('ul', undefined, words);
    for (const line of lesson.learned) make('li', line, list);
    const tasks = STEPS.filter(s => s.task);
    const count = how => tasks.filter(s => done[s.task.id] === how).length;
    const left = tasks.filter(s => !done[s.task.id]).length;
    make('p', `Tasks: ${count('first')} on the first try, ${count('retry')} after another try, ${count('shown')} with Show me${left ? `, ${left} not done yet` : ''}.`, words);
    if (left) {
      const first = STEPS.findIndex(s => s.task && !done[s.task.id]);
      const button = make('button', 'Go to the first task left', words);
      button.type = 'button';
      button.addEventListener('click', () => go(first));
    }
    const more = make('p', undefined, words, 'lesson-more');
    if (following) {
      const link = make('a', `Next lesson: ${following.title}`, more, 'cta');
      link.href = `lesson.html?lesson=${following.id}`;
    }
    const all = make('a', 'All lessons', make('p', undefined, words));
    all.href = 'learn.html';
  }

  // focus: move to the step's heading, so keyboard and screen reader users start from the top.
  function render(focus = true) {
    const s = STEPS[step];
    $('stage').textContent = `${s.stage} · step ${step + 1} of ${STEPS.length}`;
    $('title').textContent = s.title;
    $('words').replaceChildren(...(s.words || []).map(w => make('p', w)));
    equations(s.equations, $('words'));
    if (solvedStep(s)) equations(s.after?.equations, $('words'));
    if (s.barb) {
      const icon = el('svg', { viewBox: '-38 -38 76 76', class: 'lesson-barb', role: 'img', 'aria-label': 'A wind barb to read' });
      barb(icon, 0, 0, s.barb[0], s.barb[1]);
      $('words').appendChild(icon);
    }
    if (s.recap) recap();
    feedback('');
    drawAnswers();
    drawChart();
    $('back').disabled = step === 0;
    $('showme').hidden = !s.task || solvedStep(s);
    $('next').hidden = step === STEPS.length - 1;
    $('next').disabled = Boolean(s.task) && !solvedStep(s);
    if (solvedStep(s)) feedback(`✓ ${s.task.done}`, 'right');
    document.querySelector('.lesson-actions').scrollTop = 0;
    [...$('dots').children].forEach((dot, i) => {
      dot.classList.toggle('done', STEPS[i].task ? solvedStep(STEPS[i]) : i < step);
      if (i === step) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
    if (focus) $('title').focus({ preventScroll: true });
  }

  function go(to) {
    step = Math.max(0, Math.min(STEPS.length - 1, to));
    tries = 0;
    tried = new Set();
    typedValue = '';
    save();
    render();
    showStep();
  }
  // Each new step starts at the top. On a phone the header scrolls away, to leave room for the task.
  function showStep() {
    if (root.matchMedia('(max-width: 760px)').matches) $('dots').scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }

  document.title = `${lesson.title} · Skew-T Guide`;
  $('lessontitle').textContent = lesson.title;
  $('lessonlevel').textContent = `${lesson.level} · lesson ${LESSONS.filter(l => l.level === lesson.level).indexOf(lesson) + 1} of ${LESSONS.filter(l => l.level === lesson.level).length}`;
  $('lessonsource').textContent = lesson.source;
  STEPS.forEach((s, i) => {
    const dot = make('button', undefined, $('dots'), 'step-dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Step ${i + 1}: ${s.title}`);
    dot.title = s.title;
    dot.addEventListener('click', () => go(i));
  });
  $('back').addEventListener('click', () => go(step - 1));
  $('next').addEventListener('click', () => go(step + 1));
  $('showme').addEventListener('click', showMe);
  $('restart').addEventListener('click', () => { done = {}; go(0); });
  $('replay').addEventListener('click', () => {
    if (frame) return skip();
    if (progress >= 1) showAt(0);
    return play();
  });
  // A new window size gives the chart a new shape.
  let resized = 0;
  root.addEventListener('resize', () => {
    clearTimeout(resized);
    resized = setTimeout(() => {
      const now = chartShape();
      if (now === undefined || Math.abs(now - shape) < 25) return;
      const finished = scene && !frame && progress >= 1;
      drawChart();
      if (finished) skip();
    }, 200);
  });

  // The arrow keys also move between steps.
  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.matches('input')) return;
    if (e.key === 'ArrowRight' && !$('next').disabled && !$('next').hidden) go(step + 1);
    else if (e.key === 'ArrowLeft' && !$('back').disabled) go(step - 1);
  });
  render(false);
})(this);
