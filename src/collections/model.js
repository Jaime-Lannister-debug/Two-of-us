// 收藏数据契约、兼容解码与字段校验。
import { clamp, finiteNumber, coordinate } from '../core/numbers.js';
import { MAX_COVER_DATA_LENGTH } from '../core/config.js';
import { qqShareInfo } from './music-link.js';
export const photos = {
  mountain: 'photo-1464822759023-fed622ff2c3b',
  sea: 'photo-1518837695005-2083093ee35b',
  city: 'photo-1519608487953-e999c86e7455',
  forest: 'photo-1441974231531-c6227db76b6e',
  lake: 'photo-1476514525535-07fb3b4ae5f1',
  road: 'photo-1469474968028-56623f02e42e',
  music: 'photo-1516280440614-37939bbacd81',
  night: 'photo-1470225620780-dba8ba36b745',
};
export const img = (k) =>
  'https://images.unsplash.com/' +
  (photos[k] || photos.lake) +
  '?auto=format&fit=crop&w=700&q=85';
export const cats = {
  home: ['⌂', '我们的小宇宙'],
  film: ['▣', '影视时光'],
  music: ['♫', '音乐收藏'],
  game: ['♧', '游戏搭子'],
  travel: ['⌁', '旅行足迹'],
  intimacy: ['♡', '亲密日记'],
};
export const subs = {
  film: ['电影', '电视剧'],
  music: ['专辑', '单曲', '现场'],
  game: ['Steam', 'PS5', 'Switch 1 & 2', '手游'],
  travel: ['国内', '海外'],
  intimacy: ['亲密记录'],
};
export const status = {
  wish: '将要看 / 玩',
  doing: '正在看 / 玩',
  done: '已看 / 玩',
};
export const parseGenres = (value) =>
  [
    ...new Set(
      (Array.isArray(value) ? value : String(value || '').split(/[,，、;；\n]/))
        .map((x) => String(x).trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
export const genreSuggestions = {
  game: [
    '开放世界',
    'RPG',
    '动作冒险',
    '解谜',
    '双人合作',
    '平台跳跃',
    '音乐节奏',
    '竞速',
    '生活模拟',
    '策略',
    '卡牌',
    'Roguelike',
  ],
  film: ['喜剧片', '悬疑片', '爱情片', '科幻片', '剧情片', '动画片', '纪录片'],
  music: ['流行', '摇滚', '爵士', '古典', '电子', '电影原声'],
  travel: ['城市漫游', '自然风光', '海岛', '美食', '徒步'],
  intimacy: ['温柔', '浪漫', '纪念日'],
};
export function hasProgress(r) {
  return r.cat === 'film' && r.sub === '电视剧';
}
export function stateLabels() {
  return status;
}
export function progressValue(r) {
  if (r.state === 'done') return 100;
  if (r.state === 'wish') return 0;
  if (r.cat === 'film' && Number(r.totalEpisodes) > 0)
    return Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (Number(r.watchedEpisodes || 0) / Number(r.totalEpisodes)) * 100,
        ),
      ),
    );
  return Math.min(100, Math.max(0, Number(r.progress) || 0));
}
export function normalizeItem(item) {
  item.score = clamp(item.score, 0, 10);
  item.progress = clamp(item.progress, 0, 100);
  for (const k of ['watchedEpisodes', 'totalEpisodes', 'currentEpisode'])
    item[k] = Math.floor(Math.max(0, finiteNumber(item[k])));
  item.playHours = Math.max(0, finiteNumber(item.playHours));
  if (!hasProgress(item))
    for (const k of [
      'progress',
      'watchedEpisodes',
      'totalEpisodes',
      'currentEpisode',
    ])
      delete item[k];
  if (item.cat !== 'game') delete item.playHours;
  for (const [k, limit] of [
    ['lat', 90],
    ['lng', 180],
  ]) {
    const n = coordinate(item[k], limit);
    delete item[k];
    if (item.cat === 'travel' && n !== undefined) item[k] = n;
  }
  return normalizeExtras(item);
}
export function validCoverSize(item) {
  for (const k of ['image', 'coverImage'])
    if (
      String(item[k] || '').startsWith('data:') &&
      item[k].length > MAX_COVER_DATA_LENGTH
    )
      throw new Error('封面超过 300,000 字符，请使用更小的图片或图片 URL。');
}
export // content 保持 text 类型，使用 JSON 保存原网页的封面、类型、评分和进度等字段。
function decodeRow(row) {
  let value;
  try {
    value = JSON.parse(row.content);
  } catch {
    value = {
      title: row.content,
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    value = {
      title: row.content,
    };
  const cat = Object.hasOwn(subs, value.cat) ? value.cat : 'film';
  const item = {
    id: row.id,
    cat,
    sub: subs[cat].includes(value.sub) ? value.sub : subs[cat][0],
    state: ['wish', 'doing', 'done'].includes(value.state)
      ? value.state
      : 'wish',
  };
  for (const key of [
    'title',
    'desc',
    'image',
    'coverImage',
    'coverSource',
    'coverStatus',
    'platform',
    'note',
    'place',
    'hotel',
    'brand',
    'date',
  ]) {
    item[key] = typeof value[key] === 'string' ? value[key] : '';
  }
  item.title ||= '未命名条目';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) item.date = '';
  for (const key of ['endDate', 'hotels', 'photos', 'musicUrl'])
    item[key] = value[key];
  item.coverWrap = value.coverWrap === true;
  item.genres = parseGenres(value.genres);
  for (const key of [
    'score',
    'progress',
    'watchedEpisodes',
    'totalEpisodes',
    'currentEpisode',
    'playHours',
  ]) {
    item[key] = Math.max(0, finiteNumber(value[key]));
  }
  item.lat = coordinate(value.lat, 90);
  item.lng = coordinate(value.lng, 180);
  // 只允许常见图片协议；文本仍通过原网页 esc() 转义后呈现。
  for (const key of ['image', 'coverImage']) {
    if (
      !/^(https?:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(
        item[key],
      ) ||
      (item[key].startsWith('data:') &&
        item[key].length > MAX_COVER_DATA_LENGTH)
    )
      item[key] = '';
  }
  if (!/^https?:\/\//i.test(item.coverSource)) item.coverSource = '';
  return normalizeItem(item);
}
export function imageAddress(value) {
  return typeof value === 'string' &&
    /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(value) &&
    (!value.startsWith('data:') || value.length <= MAX_COVER_DATA_LENGTH)
    ? value
    : '';
}
export function travelPhotos(item) {
  return [
    ...new Set(
      [item.image, ...(Array.isArray(item.photos) ? item.photos : [])]
        .map(imageAddress)
        .filter(Boolean),
    ),
  ].slice(0, 10);
}
export function isoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : '';
}
export function travelDates(item) {
  return item.endDate && item.endDate !== item.date
    ? `${item.date} — ${item.endDate}`
    : item.date || '尚未填写日期';
}
export function normalizeExtras(item) {
  if (item.cat === 'travel') {
    item.endDate = isoDay(item.endDate) || item.date;
    if (item.date && item.endDate < item.date) item.endDate = item.date;
    item.hotels = (
      Array.isArray(item.hotels)
        ? item.hotels
        : typeof item.hotel === 'string' && item.hotel.trim()
          ? [
              {
                name: item.hotel,
              },
            ]
          : []
    )
      .filter((h) => h && typeof h === 'object')
      .slice(0, 20)
      .map((h) => ({
        name: String(h.name || '')
          .trim()
          .slice(0, 200),
        checkIn: isoDay(h.checkIn),
        checkOut: isoDay(h.checkOut),
        note: String(h.note || '').slice(0, 500),
      }))
      .filter((h) => h.name);
    item.hotel = item.hotels.map((h) => h.name).join('、');
    item.photos = travelPhotos(item)
      .filter((url) => url !== item.image)
      .slice(0, item.image ? 9 : 10);
  } else {
    delete item.endDate;
    delete item.hotels;
    delete item.photos;
  }
  if (item.cat === 'music') {
    try {
      item.musicUrl = item.musicUrl ? qqShareInfo(item.musicUrl).url : '';
    } catch {
      item.musicUrl = '';
    }
  } else delete item.musicUrl;
  return item;
}
