// 本功能的静态对话框模板；动态条目仍由对应控制器渲染。
export const template =
  '<dialog id="messageDialog" class="social-dialog" aria-labelledby="messageHeading" aria-modal="true"><div class="social-dialog-head"><h2 id="messageHeading">对方的条目更新</h2><button type="button" class="btn secondary" data-social-close="">关闭</button></div><p class="subtitle">点击消息查看条目；点击「看过这条」只移除当前消息，其他未读消息保持不变。</p><p id="notificationStatus" role="status"></p><div id="notificationList"></div></dialog>';
