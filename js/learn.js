/* global LESSONS */
// The Learn page: the lessons in two levels, each with the progress saved in this browser.
(function () {
  'use strict';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('lessonProgress')) || {}; } catch (e) { /* storage may be blocked */ }

  const make = (tag, content, parent, className) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  };
  // A lesson is complete once every task in it is done. Opening it counts as started.
  function status(lesson) {
    const entry = saved[lesson.id], tasks = lesson.steps.filter(s => s.task);
    const finished = tasks.filter(s => entry?.done?.[s.task.id]).length;
    if (finished === tasks.length) return { key: 'complete', words: '✓ Complete' };
    if (entry && (finished || entry.step > 0)) return { key: 'started', words: `In progress: ${finished} of ${tasks.length} tasks` };
    return { key: 'new', words: 'Not started' };
  }

  const ABOUT = { Intro: 'Start here. No experience needed.', Intermediate: 'Builds on the Intro lessons.' };
  for (const level of ['Intro', 'Intermediate']) {
    const lessons = LESSONS.filter(l => l.level === level);
    const section = make('section', undefined, document.getElementById('levels'), 'learn-level');
    make('h2', level, section);
    make('p', `${ABOUT[level]} ${lessons.filter(l => status(l).key === 'complete').length} of ${lessons.length} complete.`, section);
    const list = make('ol', undefined, section, 'learn-list');
    lessons.forEach((lesson, i) => {
      const link = make('a', undefined, make('li', undefined, list));
      link.href = `lesson.html?lesson=${lesson.id}`;
      make('span', `${i + 1}`, link, 'learn-number').setAttribute('aria-hidden', 'true');
      const words = make('span', undefined, link, 'learn-words');
      make('strong', lesson.title, words);
      make('span', lesson.summary, words);
      const state = status(lesson);
      make('span', state.words, link, `learn-status ${state.key}`);
    });
  }

  // The main button picks up at the first lesson that isn't complete.
  const button = document.getElementById('continue');
  const next = LESSONS.find(l => status(l).key !== 'complete');
  if (!next) button.textContent = 'All lessons complete. Revisit the first';
  else {
    button.href = `lesson.html?lesson=${next.id}`;
    if (next !== LESSONS[0] || status(next).key === 'started') button.textContent = `Continue: ${next.title}`;
  }
})();
