// 游戏小时数与电视剧集数的展示及编辑。
import { hasProgress, progressValue, stateLabels } from './model.js';
import { esc, $, field } from '../core/dom.js';
import { finiteNumber } from '../core/numbers.js';
export function createCollectionsProgress(app) {
  const store = app.state;
  function progressCard(r) {
    if (r.cat === 'game') return gameTimeCard(r);
    if (!hasProgress(r)) return '';
    const n = progressValue(r);
    return `<div class="progress-caption"><span>${stateLabels(r.cat, r.sub)[r.state]}</span><span>${r.cat === 'film' && Number(r.totalEpisodes) > 0 ? `${Number(r.watchedEpisodes) || 0} / ${Number(r.totalEpisodes)} 集 · ` : ''}${n}%</span></div><div class="progress" role="progressbar" aria-label="${esc(r.title)}进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${n}"><span style="width:${n}%"></span></div>`;
  }
  function setupProgressEditor(r) {
    const cat = $('[name=cat]'),
      sub = $('[name=sub]'),
      state = $('[name=state]'),
      host = $('#progressEditor');
    let draft = {
      progress: progressValue(r),
      watchedEpisodes: Number(r.watchedEpisodes) || 0,
      totalEpisodes: Number(r.totalEpisodes) || 0,
      currentEpisode: Number(r.currentEpisode) || 0,
      playHours: Number(r.playHours) || 0,
    };
    function draw() {
      const c = cat.value,
        isTV = c === 'film' && sub.value === '电视剧',
        supported = c === 'game' || isTV;
      const current = state.value;
      state.innerHTML = Object.entries(stateLabels(c, sub.value))
        .map(
          ([k, v]) =>
            `<option value="${k}" ${k === current ? 'selected' : ''}>${v}</option>`,
        )
        .join('');
      if (!supported) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML = isTV
        ? `<div class="formgrid">${field('watchedEpisodes', '已看集数', 'number', draft.watchedEpisodes)}${field('totalEpisodes', '总集数（未知可填 0）', 'number', draft.totalEpisodes)}${field('currentEpisode', '正在看第几集（0 表示未开始）', 'number', draft.currentEpisode)}</div>`
        : `<label class="field">累计游玩时长 <output id="hoursOutput">${draft.playHours} 小时</output><input name="playHoursSlider" type="range" min="0" max="${hoursScale(draft.playHours)}" step="0.5" value="${draft.playHours}"></label>${field('playHours', '累计游戏时间（小时）', 'number', draft.playHours)}`;
      host.insertAdjacentHTML(
        'beforeend',
        `<small class="progress-hint">${isTV ? '调整集数会同步清单状态。' : '时间条表示累计小时数，标尺随时长增长；完成状态请手动选择。'}</small>`,
      );
      host.querySelectorAll('input[type=number]').forEach((i) => {
        i.min = '0';
        i.step = i.name === 'playHours' ? '0.1' : '1';
      });
      host.oninput = (e) => {
        const i = e.target;
        if (!isTV) {
          draft.playHours = Math.max(0, Number(i.value) || 0);
          const slider = $('[name=playHoursSlider]');
          slider.max = hoursScale(draft.playHours);
          slider.value = draft.playHours;
          $('[name=playHours]').value = draft.playHours;
          $('#hoursOutput').textContent = draft.playHours + ' 小时';
          return;
        }
        draft[i.name] = Number(i.value) || 0;
        if (isTV) {
          const current = $('[name=currentEpisode]');
          current.setCustomValidity(
            draft.totalEpisodes > 0 &&
              draft.currentEpisode > draft.totalEpisodes
              ? '当前集数不能超过总集数'
              : '',
          );
          if (i.name === 'currentEpisode') {
            state.value = draft.currentEpisode > 0 ? 'doing' : 'wish';
            return;
          }
          const w = $('[name=watchedEpisodes]'),
            t = $('[name=totalEpisodes]');
          w.setCustomValidity(
            Number(t.value) > 0 && Number(w.value) > Number(t.value)
              ? '已看集数不能超过总集数'
              : '',
          );
          state.value =
            draft.totalEpisodes > 0 &&
            draft.watchedEpisodes === draft.totalEpisodes
              ? 'done'
              : draft.watchedEpisodes > 0
                ? 'doing'
                : 'wish';
        } else {
          $('#progressOutput').textContent = draft.progress + '%';
          state.value =
            draft.progress === 100
              ? 'done'
              : draft.progress > 0
                ? 'doing'
                : 'wish';
        }
      };
    }
    state.onchange = () => {
      if (state.value === 'wish') {
        draft.progress = 0;
        draft.watchedEpisodes = 0;
        draft.currentEpisode = 0;
      }
      if (state.value === 'done') {
        draft.progress = 100;
        if (draft.totalEpisodes > 0)
          draft.watchedEpisodes = draft.totalEpisodes;
      }
      draw();
    };
    app.events.listen(cat, 'change', draw);
    app.events.listen(sub, 'change', draw);
    draw();
  }
  // 仅这两个 R2 相关地址出现在前端；R2 密钥只配置在 Worker。
  function hoursScale(hours) {
    return Math.max(100, Math.ceil(Math.max(0, finiteNumber(hours)) / 50) * 50);
  }
  function gameTimeCard(item) {
    const hours = Math.max(0, finiteNumber(item.playHours)),
      max = hoursScale(hours);
    return `<div class="progress-caption"><span>累计游玩 ${hours} 小时</span><span>标尺 ${max} 小时</span></div><div class="progress" role="meter" aria-label="累计游玩小时数" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hours}"><span style="width:${(hours / max) * 100}%"></span></div>`;
  }
  return {
    progressCard,
    setupProgressEditor,
    hoursScale,
    gameTimeCard,
  };
}
