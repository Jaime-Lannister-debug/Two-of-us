// QQ 官方音乐元数据读取与表单填充。
import { qqShareInfo } from './music-link.js';
import { $ } from '../core/dom.js';
import { friendlyError } from '../core/errors.js';
export function createCollectionsMusic(app) {
  const store = app.state;
  function qqJSONP(path, params, callbackParam = 'callback') {
    return new Promise((resolve, reject) => {
      const callback = '__twoUsQQ_' + crypto.randomUUID().replaceAll('-', ''),
        url = new URL(path, 'https://c.y.qq.com');
      if (url.origin !== 'https://c.y.qq.com') {
        reject(Error('音乐接口地址不合法'));
        return;
      }
      Object.entries({
        ...params,
        format: 'jsonp',
        [callbackParam]: callback,
      }).forEach(([key, value]) => url.searchParams.set(key, value));
      const script = document.createElement('script');
      let timer;
      const clean = () => {
        app.timers.clearTimeout(timer);
        delete window[callback];
        script.remove();
      };
      window[callback] = (data) => {
        clean();
        resolve(data);
      };
      script.onerror = () => {
        clean();
        reject(Error('QQ 音乐接口无法访问，请检查网络或手动填写'));
      };
      timer = app.timers.setTimeout(() => {
        clean();
        reject(Error('QQ 音乐读取超时，可手动填写音乐条目'));
      }, 12000);
      script.src = url.href;
      document.head.append(script);
    });
  }
  async function readQQMusic(text) {
    const info = qqShareInfo(text);
    if (info.album) {
      const response = await qqJSONP(
          '/v8/fcg-bin/fcg_v8_album_info_cp.fcg',
          {
            albummid: info.album,
          },
          'jsonpCallback',
        ),
        data = response.data;
      if (response.code !== 0 || !data) throw Error('未能读取专辑，请手动填写');
      return {
        title: data.name || data.albumname || info.title,
        desc: data.singername || '',
        image: `https://y.gtimg.cn/music/photo_new/T002R500x500M000${info.album}.jpg`,
        musicUrl: info.url,
        sub: '专辑',
      };
    }
    if (!info.mid && !info.songId && info.title) {
      const result = await qqJSONP(
        '/soso/fcgi-bin/client_search_cp',
        {
          p: 1,
          n: 5,
          w: info.title + ' ' + info.artist,
        },
        'jsonpCallback',
      );
      const found = result.data?.song?.list?.find(
        (s) =>
          s.songname === info.title &&
          (!info.artist || s.singer?.some((a) => a.name === info.artist)),
      );
      info.mid = found?.songmid || '';
      if (!info.mid)
        return {
          title: info.title,
          desc: info.artist,
          image: '',
          musicUrl: info.url,
          sub: '单曲',
          partial: true,
        };
    }
    if (!info.mid && !info.songId)
      throw Error(
        '短链接无法直接识别，请复制包含歌名的完整分享文字，或打开后复制歌曲／专辑详情链接',
      );
    const result = await qqJSONP(
        '/v8/fcg-bin/fcg_play_single_song.fcg',
        info.mid
          ? {
              songmid: info.mid,
              tpl: 'yqq_song_detail',
            }
          : {
              songid: info.songId,
              tpl: 'yqq_song_detail',
            },
      ),
      song = result.data?.[0];
    if (result.code !== 0 || !song)
      throw Error('未能读取歌曲，请检查链接或手动填写');
    return {
      title: song.name || song.title || info.title,
      desc:
        (song.singer || []).map((s) => s.name).join(' / ') +
        (song.album?.name ? ' · ' + song.album.name : ''),
      image: song.album?.mid
        ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${song.album.mid}.jpg`
        : '',
      musicUrl: info.url,
      sub: '单曲',
    };
  }
  function setupMusicImport() {
    const button = $('#readQQMusic');
    button.onclick = async () => {
      const epoch = store.cloudEpoch;
      button.disabled = true;
      $('#qqMessage').textContent = '正在读取 QQ 音乐…';
      try {
        const item = await readQQMusic(
          $('#qqShareInput').value || $('[name=musicUrl]').value,
        );
        if (epoch !== store.cloudEpoch || !button.isConnected) return;
        for (const key of ['title', 'desc', 'musicUrl', 'sub'])
          $('[name=' + key + ']').value = item[key] || '';
        if (item.image) {
          $('[name=image]').value = item.image;
          $('[name=image]').dispatchEvent(new Event('input'));
        }
        $('#qqMessage').textContent = item.partial
          ? '已读取分享文字，封面请手动补充；确认后保存。'
          : '已读取音乐信息，确认后点击保存记录。';
      } catch (error) {
        if (button.isConnected)
          $('#qqMessage').textContent = friendlyError(error);
      } finally {
        button.disabled = false;
      }
    };
  }

  // 纪念日、心情瓶子和消息仅对成员开放；真正授权仍由新表 RLS 与 RPC 执行。
  return {
    qqJSONP,
    readQQMusic,
    setupMusicImport,
  };
}
