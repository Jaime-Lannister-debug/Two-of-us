// QQ 音乐分享链接的纯解析和域名校验。
export // 仅向 QQ 官方固定 API 发起 JSONP；分享地址需严格校验，不能作为脚本地址使用。
function qqShareInfo(text) {
  const match = String(text).match(/https?:\/\/[^\s<>"'，。)）]+/i);
  if (!match) throw Error('请粘贴 QQ 音乐分享链接或完整分享文字');
  const url = new URL(match[0]);
  if (
    url.protocol !== 'https:' ||
    !(url.hostname === 'y.qq.com' || url.hostname.endsWith('.y.qq.com')) ||
    url.username ||
    url.password
  )
    throw Error('仅支持 QQ 音乐的 https 分享链接');
  const path = url.pathname,
    album =
      /\/album(?:Detail)?\/([A-Za-z0-9]+)/i.exec(path)?.[1] ||
      url.searchParams.get('albummid'),
    mid =
      /\/song(?:Detail)?\/([A-Za-z0-9]+)/i.exec(path)?.[1] ||
      url.searchParams.get('songmid') ||
      url.searchParams.get('mid');
  return {
    url: url.href,
    mid: mid && /^[A-Za-z0-9]+$/.test(mid) ? mid : '',
    album: album && /^[A-Za-z0-9]+$/.test(album) ? album : '',
    songId: /^\d+$/.test(url.searchParams.get('songid') || '')
      ? url.searchParams.get('songid')
      : '',
    title: /《([^》]+)》/.exec(text)?.[1] || '',
    artist: /分享\s*(.*?)\s*的(?:单曲|歌曲|专辑)/.exec(text)?.[1] || '',
  };
}
