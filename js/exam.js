/* global SOUNDINGS, QuizData, QuizChart */
// Test page: one mixed set, one submitted answer each, and no feedback until the end.
// It is a self-check. Everything is marked in the browser, so a determined person could still work
// out the answers: it is not suitable for graded exams.
(function () {
  'use strict';
  const { TOPICS, NAMES, isCorrect, testItems, shuffle } = QuizData;
  const $ = id => document.getElementById(id);
  const svg = $('quizchart');
  const sounding = SOUNDINGS[0];
  const chart = QuizChart.create(svg, sounding);
  // The Test never names the LCL, LFC or EL on the chart: that would give away items asking for them.
  svg.classList.add('unlabelled');
  let items = [], index = -1, answers = [], draft = null;
  // On your own computer only, test.html?debug adds a button that previews the results screen.
  const DEBUG = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('debug');

  const current = () => items[index];
  const running = () => index >= 0 && index < items.length;
  const el = (tag, content, parent) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (parent) parent.appendChild(node);
    return node;
  };

  function show(view) {
    document.querySelector('.quiz').classList.toggle('finished', view !== 'task');
    document.querySelector('.quiz').classList.toggle('results', view === 'results');
    $('figure').replaceChildren();
    $('choices').replaceChildren();
    $('feedback').textContent = '';
    $('feedback').className = '';
    $('start').hidden = view !== 'intro';
    $('skip').hidden = $('submit').hidden = view !== 'task';
    $('again').hidden = view !== 'results';
    $('debug').hidden = !DEBUG || view === 'results';
    chart.clear();
    chart.preview(null);
    svg.classList.remove('clickable', 'plotting', 'all-labels');
  }

  function intro() {
    index = -1;
    show('intro');
    $('qcount').textContent = 'Self-check';
    $('question').textContent = 'Test what you know';
    const count = testItems(sounding).length;
    $('feedback').textContent = `${count} items: questions, identifying chart features and plotting points. You can change an answer until you submit it. You won't see any feedback until the end, when each item is marked correct, wrong or skipped. Right answers aren't shown. If you can't or don't want to answer one, choose Skip; skipped items are not marked wrong. Leaving the page ends the test.`;
  }

  function task() {
    const item = current();
    show('task');
    draft = null;
    $('submit').disabled = true;
    $('submit').textContent = index === items.length - 1 ? 'Submit and finish' : 'Submit answer';
    $('qcount').textContent = `${index + 1} of ${items.length}`;
    $('question').textContent = item.type === 'plot' ? `Plot the ${QuizData.SERIES[item.key].name.toLowerCase()}` : item.q;
    svg.classList.toggle('plotting', item.type === 'plot');
    svg.classList.toggle('clickable', item.type !== 'choice');
    svg.classList.toggle('all-labels', Boolean(item.allLabels));
    if (item.type === 'choice') {
      if (item.wind) QuizChart.windIcon($('figure'), item.wind);
      // Highlighting a level would show where it is, so the Test leaves levels unmarked.
      const shown = item.show && !['lcl', 'lfc', 'el'].includes(item.show[0]) ? item.show : null;
      chart.highlight(shown);
      svg.setAttribute('aria-label', shown ? 'Skew-T diagram with one feature highlighted' : 'Skew-T diagram');
      for (const choice of shuffle(item.choices.slice())) {
        const button = el('button', choice, $('choices'));
        button.type = 'button';
        button.className = 'choice';
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          $('choices').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
          choose(choice);
        });
      }
      return;
    }
    if (item.type === 'plot') $('figure').appendChild(QuizChart.valueCard(item));
    svg.setAttribute('aria-label', item.type === 'plot' ? 'Blank Skew-T diagram. Click to plot the point.' : 'Skew-T diagram. Click the feature asked for.');
    $('feedback').textContent = item.type === 'plot' ? 'Click or tap the chart where this point belongs.' : 'Click or tap it on the chart.';
  }

  // An answer that can still be changed.
  function choose(value) {
    draft = value;
    $('submit').disabled = false;
  }

  // answer is null when the item was skipped.
  function record(answer) {
    answers.push(answer);
    index++;
    if (running()) task();
    else results(markAll());
    window.scrollTo(0, 0);
    $('question').focus({ preventScroll: true });
  }

  function isRight(item, answer) {
    if (item.type === 'choice') return isCorrect(item, answer);
    if (item.type === 'find') return answer.kind === item.kind;
    return QuizChart.plotHint(answer, item) === null;
  }

  // What the learner did, without anything that gives the right answer away.
  function describeAnswer(item, answer) {
    if (answer === null) return '';
    if (item.type === 'choice') return `You answered: ${answer}.`;
    if (item.type === 'find') return `You picked ${NAMES[answer.kind]}.`;
    return 'You placed a point.';
  }

  // The words shown for each result. The symbol and word carry the meaning, not just the color.
  const STATUS = { right: '✓ Correct', wrong: '✗ Wrong', skipped: '– Skipped' };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // A bar split into right, wrong and skipped. It repeats numbers already written beside it.
  function bar(parent, counts) {
    const track = el('div', undefined, parent);
    track.className = 'bar';
    track.setAttribute('aria-hidden', 'true');
    for (const status of Object.keys(STATUS)) {
      if (!counts[status]) continue;
      const part = el('span', undefined, track);
      part.className = status;
      part.style.flexGrow = counts[status];
    }
  }
  const tally = list => {
    const counts = { right: 0, wrong: 0, skipped: 0 };
    for (const m of list) counts[m.status]++;
    return counts;
  };
  const section = (title, className) => {
    const box = el('section', undefined, $('figure'));
    box.className = className;
    el('h3', title, box);
    return box;
  };

  function scoreSummary(marked) {
    const counts = tally(marked), box = el('div', undefined, $('figure'));
    box.className = 'score-summary';
    const tiles = el('ul', undefined, box);
    tiles.className = 'tiles';
    for (const [status, label] of [['right', 'Correct'], ['wrong', 'Wrong'], ['skipped', 'Skipped']]) {
      const tile = el('li', undefined, tiles);
      tile.className = status;
      el('strong', String(counts[status]), tile);
      el('span', label, tile);
    }
    bar(box, counts);
  }

  function topicCards(marked) {
    const grid = el('div', undefined, section('By topic', 'by-topic'));
    grid.className = 'topic-grid';
    for (const [key, topic] of Object.entries(TOPICS)) {
      const counts = tally(marked.filter(m => m.item.topic === key));
      const answered = counts.right + counts.wrong;
      const card = el('article', undefined, grid);
      el('h4', topic.name, card);
      el('p', answered ? `${counts.right} of ${answered} right` : 'Not answered', card).className = 'topic-score';
      bar(card, counts);
      el('p', counts.skipped ? `${plural(counts.skipped, 'item')} skipped` : 'Nothing skipped', card).className = 'topic-note';
      const links = el('p', undefined, card);
      links.className = 'study';
      for (const [label, href] of topic.study) el('a', label, links).href = href;
    }
  }

  // Every item, marked. Right answers and explanations are left out.
  function answerList(marked) {
    const box = section('Your answers', 'answers');
    const filters = el('div', undefined, box);
    filters.className = 'filters';
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Show answers');
    const list = el('ol', undefined, box);
    list.className = 'marked';
    marked.forEach(({ item, answer, status, did = describeAnswer(item, answer) }, i) => {
      const li = el('li', undefined, list);
      li.className = status;
      el('span', String(i + 1), li).className = 'number';
      const words = el('div', undefined, li);
      el('strong', item.q, words);
      if (did) el('div', did, words).className = 'did';
      el('span', STATUS[status], li).className = 'mark';
    });
    const counts = tally(marked);
    for (const [value, label, count] of [['all', 'All', marked.length], ['wrong', 'Wrong', counts.wrong], ['skipped', 'Skipped', counts.skipped], ['right', 'Correct', counts.right]]) {
      const button = el('button', `${label} (${count})`, filters);
      button.type = 'button';
      button.disabled = !count;
      button.setAttribute('aria-pressed', String(value === 'all'));
      button.addEventListener('click', () => {
        filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
        for (const li of list.children) li.hidden = value !== 'all' && !li.classList.contains(value);
      });
    }
  }

  const markAll = () => items.map((item, i) => {
    const answer = answers[i];
    return { item, answer, status: answer === null ? 'skipped' : isRight(item, answer) ? 'right' : 'wrong' };
  });

  // marked: one {item, status, did} for every item. did says what the learner did.
  function results(marked) {
    show('results');
    const counts = tally(marked), answered = counts.right + counts.wrong;
    $('qcount').textContent = 'Test complete';
    $('question').textContent = answered ? `You got ${counts.right} of ${answered} answered items right` : 'You skipped every item';
    $('feedback').textContent = counts.skipped
      ? `${plural(counts.skipped, 'item')} skipped. Skipped items aren't counted as wrong, and they don't show whether you have that skill.`
      : 'You answered every item.';
    scoreSummary(marked);
    topicCards(marked);
    answerList(marked);
    const note = el('p', 'Found a problem or have an idea? ', $('figure'));
    note.className = 'feedback-link';
    const link = el('a', 'Send feedback (opens in a new tab)', note);
    link.href = 'feedback.html';
    link.target = '_blank';
    link.rel = 'noopener';
  }

  function begin() {
    items = testItems(sounding);
    answers = [];
    index = 0;
    task();
    $('question').focus({ preventScroll: true });
  }

  // A made-up mix of right, wrong and skipped, for checking how the results screen looks. It does
  // not use or show any real answer.
  function skipToResults() {
    items = testItems(sounding);
    index = items.length;
    results(items.map((item, i) => {
      const status = i % 7 === 3 ? 'skipped' : i % 3 === 1 ? 'wrong' : 'right';
      return { item, status, did: status === 'skipped' ? '' : 'Sample result, not a real answer.' };
    }));
    window.scrollTo(0, 0);
    $('question').focus({ preventScroll: true });
  }

  svg.addEventListener('pointermove', e => {
    const finding = running() && current().type === 'find' && e.pointerType !== 'touch';
    chart.preview(finding ? chart.lineAt(e, current().kind) : null);
  });
  svg.addEventListener('pointerleave', () => chart.preview(null));
  svg.addEventListener('click', e => {
    if (!running()) return;
    const item = current();
    if (item.type === 'find') {
      const line = chart.lineAt(e, item.kind);
      if (!line) { $('feedback').textContent = 'There is nothing to pick right there. Try a little closer.'; return; }
      chart.showPick(line);
      choose(line);
      $('feedback').textContent = 'Selected. You can pick something else before you submit.';
    } else if (item.type === 'plot') {
      const point = chart.pointAt(e);
      if (!point) return;
      chart.drawPoints({ chosen: point, chosenKey: item.key });
      choose(point);
      $('feedback').textContent = 'Point placed. Click again to move it before you submit.';
    }
  });

  $('start').addEventListener('click', begin);
  $('again').addEventListener('click', begin);
  $('debug').addEventListener('click', skipToResults);
  $('submit').addEventListener('click', () => { if (draft !== null) record(draft); });
  $('skip').addEventListener('click', () => record(null));
  // Warns before an unfinished test is lost.
  window.addEventListener('beforeunload', e => { if (running()) e.preventDefault(); });
  intro();
})();
