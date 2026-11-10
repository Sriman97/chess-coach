import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { UNITS, findLesson, type Lesson, type Unit } from './lessons';
import { LessonPlayer } from './player';
import { recordStars, resetProgress, starsFor, totalStars } from './progress';

const app = document.getElementById('app')!;
let player: LessonPlayer | undefined;

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>';

function starRow(n: number, max = 3): string {
  let s = '';
  for (let i = 0; i < max; i++) s += `<span class="star ${i < n ? 'on' : ''}">${STAR}</span>`;
  return `<span class="stars" aria-label="${n} of ${max} stars">${s}</span>`;
}

function isUnlocked(unit: Unit, index: number): boolean {
  return index === 0 || starsFor(unit.lessons[index - 1].id) > 0;
}

function nextLesson(): string | undefined {
  for (const u of UNITS) for (const [i, l] of u.lessons.entries()) if (starsFor(l.id) === 0 && isUnlocked(u, i)) return l.id;
  return undefined;
}

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function showHome() {
  player?.destroy();
  player = undefined;
  const max = UNITS.reduce((a, u) => a + u.lessons.length * 3, 0);
  const upNext = nextLesson();
  app.innerHTML = '';
  const home = el(`
    <main class="home">
      <header class="home-head">
        <div class="brand">
          <img src="./icon.svg" alt="" width="44" height="44" />
          <div>
            <h1>Chess Coach</h1>
            <p>Learn chess one move at a time.</p>
          </div>
        </div>
        <div class="total">${starRow(1, 1)}<span>${totalStars()} / ${max}</span></div>
      </header>
    </main>`);
  UNITS.forEach((u, ui) => {
    const done = u.lessons.filter((l) => starsFor(l.id) > 0).length;
    const section = el(`
      <section class="unit">
        <div class="unit-head">
          <h2><span class="unit-num">${ui + 1}</span>${u.title}</h2>
          <span class="unit-count">${done} of ${u.lessons.length}</span>
        </div>
        <p class="unit-blurb">${u.blurb}</p>
        <ol class="path"></ol>
      </section>`);
    const ol = section.querySelector('ol')!;
    u.lessons.forEach((l, i) => {
      const open = isUnlocked(u, i);
      const stars = starsFor(l.id);
      const li = el(`
        <li class="node ${stars ? 'done' : ''} ${open ? '' : 'locked'} ${l.id === upNext ? 'up-next' : ''}">
          <button type="button" ${open ? '' : 'disabled'}>
            <span class="pip">${stars ? '✓' : i + 1}</span>
            <span class="node-text">
              <span class="node-title">${l.title}</span>
              <span class="node-sub">${open ? (l.id === upNext ? 'Up next' : `${l.steps.length} ${l.steps.length === 1 ? 'task' : 'tasks'}`) : 'Finish the lesson before'}</span>
            </span>
            ${starRow(stars)}
          </button>
        </li>`);
      li.querySelector('button')!.addEventListener('click', () => go(`#/lesson/${l.id}`));
      ol.appendChild(li);
    });
    home.appendChild(section);
  });
  const foot = el(`<footer class="home-foot"><button type="button" class="link">Reset progress</button></footer>`);
  foot.querySelector('button')!.addEventListener('click', () => {
    if (confirm('Erase all your stars and start over?')) {
      resetProgress();
      showHome();
    }
  });
  home.appendChild(foot);
  app.appendChild(home);
  home.querySelector('.up-next')?.scrollIntoView({ block: 'center' });
}

function pickPromotion(): Promise<string> {
  return new Promise((resolve) => {
    const roles: [string, string][] = [['q', 'queen'], ['r', 'rook'], ['b', 'bishop'], ['n', 'knight']];
    const dlg = el(`
      <div class="sheet-backdrop">
        <div class="sheet" role="dialog" aria-label="Choose a piece">
          <h3>Promote to</h3>
          <div class="promo cg-wrap">
            ${roles.map(([k, r]) => `<button type="button" data-role="${k}" aria-label="${r}"><piece class="${r} white"></piece></button>`).join('')}
          </div>
        </div>
      </div>`);
    dlg.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        dlg.remove();
        resolve(b.dataset.role!);
      }),
    );
    document.body.appendChild(dlg);
  });
}

function showLesson(lesson: Lesson, unit: Unit, index: number) {
  player?.destroy();
  app.innerHTML = '';
  const view = el(`
    <main class="lesson">
      <header class="bar">
        <button type="button" class="back" aria-label="Back to lessons">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <div class="bar-title">
          <span class="bar-unit">${unit.title}</span>
          <h1>${lesson.title}</h1>
        </div>
        <div class="dots"></div>
        <button type="button" class="info" aria-label="Read the lesson again">?</button>
      </header>
      <div class="lesson-body">
        <div class="side">
          <p class="intro">${lesson.intro}</p>
          <p class="prompt"></p>
        </div>
        <div class="board-col">
          <div class="board-frame"><div class="board cg-wrap"></div></div>
          <div class="under">
            <span class="counter"></span>
          </div>
          <p class="feedback" aria-live="polite"></p>
          <div class="actions">
            <button type="button" class="btn ghost hint">Hint</button>
            <button type="button" class="btn ghost undo">Take back</button>
            <button type="button" class="btn primary next" hidden>Next</button>
          </div>
        </div>
      </div>
    </main>`);
  app.appendChild(view);
  view.querySelector('.back')!.addEventListener('click', () => go('#/'));
  const showIntro = () => {
    const sheet = el(`
      <div class="sheet-backdrop">
        <div class="sheet intro-sheet" role="dialog" aria-label="${lesson.title}">
          <span class="bar-unit">${unit.title}</span>
          <h3>${lesson.title}</h3>
          <p>${lesson.intro}</p>
          <button type="button" class="btn primary">Start</button>
        </div>
      </div>`);
    sheet.querySelector('button')!.addEventListener('click', () => sheet.remove());
    document.body.appendChild(sheet);
  };
  view.querySelector('.info')!.addEventListener('click', showIntro);
  if (!matchMedia('(min-width: 900px)').matches) showIntro();
  const q = <T extends HTMLElement>(s: string) => view.querySelector(s) as T;
  player = new LessonPlayer(lesson, {
    board: q('.board'),
    prompt: q('.prompt'),
    feedback: q('.feedback'),
    counter: q('.counter'),
    dots: q('.dots'),
    hintBtn: q('.hint'),
    undoBtn: q('.undo'),
    nextBtn: q('.next'),
    pickPromotion,
    onFinish: (stars) => {
      recordStars(lesson.id, stars);
      showResult(lesson, unit, index, stars);
    },
  });
}

function showResult(lesson: Lesson, unit: Unit, index: number, stars: number) {
  const next = unit.lessons[index + 1] ?? UNITS[UNITS.indexOf(unit) + 1]?.lessons[0];
  const words = stars === 3 ? 'Flawless.' : stars === 2 ? 'Nicely done.' : 'Lesson complete.';
  const tip = stars === 3 ? '' : 'Replay it without hints or mistakes to earn all three stars.';
  const dlg = el(`
    <div class="sheet-backdrop">
      <div class="sheet result" role="dialog" aria-label="Lesson complete">
        <div class="big-stars">${starRow(stars)}</div>
        <h3>${words}</h3>
        <p>${lesson.title}${tip ? `<br><span class="muted">${tip}</span>` : ''}</p>
        <div class="actions">
          <button type="button" class="btn ghost again">Replay</button>
          ${next ? '<button type="button" class="btn primary go-next">Next lesson</button>' : '<button type="button" class="btn primary home">All lessons</button>'}
        </div>
        ${next ? '<button type="button" class="link home">All lessons</button>' : ''}
      </div>
    </div>`);
  dlg.querySelector('.again')!.addEventListener('click', () => {
    dlg.remove();
    showLesson(lesson, unit, index);
  });
  dlg.querySelectorAll('.home').forEach((b) =>
    b.addEventListener('click', () => {
      dlg.remove();
      go('#/');
    }),
  );
  dlg.querySelector('.go-next')?.addEventListener('click', () => {
    dlg.remove();
    go(`#/lesson/${next!.id}`);
  });
  document.body.appendChild(dlg);
}

function go(hash: string) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  document.querySelectorAll('.sheet-backdrop').forEach((d) => d.remove());
  const m = location.hash.match(/^#\/lesson\/([\w-]+)/);
  const found = m ? findLesson(m[1]) : undefined;
  window.scrollTo(0, 0);
  if (found) showLesson(found.lesson, found.unit, found.index);
  else showHome();
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* offline mode unavailable here */
  });
}
