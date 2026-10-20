// 添加心情与纸飞机阅读分开，避免打开瓶子就清除所有未读。
export const template = `
<dialog id="moodDialog" class="social-dialog mood-composer" aria-labelledby="moodTitle" aria-modal="true">
 <div class="social-dialog-head"><h2 id="moodTitle">放入心情</h2><button type="button" class="btn secondary" data-social-close>关闭</button></div>
 <p id="moodCount" class="subtitle"></p><p id="moodFull" class="subtitle"></p>
 <form id="moodForm"><label class="field">想分享的心情<textarea id="moodText" required maxlength="1000" placeholder="写下今天的小确幸，或暂时放下的不开心…"></textarea></label><div class="social-actions"><button class="btn" id="moodSubmit" type="submit">折成星星，放进瓶子</button><span id="moodMessage" role="status"></span></div></form>
</dialog>
<dialog id="moodLetterDialog" class="mood-letter-dialog" aria-labelledby="moodLetterTitle" aria-modal="true">
 <button type="button" id="closeMoodLetter" class="btn secondary letter-close" aria-label="关闭心情信件">关闭</button>
 <div class="airmail-stage"><div class="paper-plane" aria-hidden="true"><svg viewBox="0 0 120 90"><path d="M4 37 L116 5 L78 84 L53 52 Z" fill="#f9e8ed"/><path d="M4 37 L53 52 L116 5" fill="#fff9fc"/><path d="M53 52 L58 77 L72 62" fill="#cba8b8"/><path d="M53 52 L116 5 L66 59" fill="#edd0dc"/></svg></div>
 <article class="mood-letter" id="moodLetter" hidden><span class="eyebrow">A LITTLE NOTE FOR YOU</span><h2 id="moodLetterTitle">一份心情，飞到你身边</h2><p id="moodLetterMeta" class="subtitle"></p><p id="moodLetterContent" class="letter-content"></p><p id="moodLetterStatus" role="status" class="subtitle"></p></article></div>
</dialog>`;
