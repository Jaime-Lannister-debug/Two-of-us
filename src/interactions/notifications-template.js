// 本功能的静态对话框模板；动态条目仍由对应控制器渲染。
export const template =
  '<dialog id="messageDialog" class="social-dialog" aria-labelledby="messageHeading" aria-modal="true"><div class="social-dialog-head"><h2 id="messageHeading">对方的条目更新</h2><button type="button" class="btn secondary" data-social-close="">关闭</button></div><p class="subtitle">打开后，当前显示的消息会标为已读；点击消息可查看条目。删除的条目会保留消息。</p><button class="btn secondary" id="readAllNotifications" type="button">全部标为已读</button><p id="notificationStatus" role="status"></p><div id="notificationList"></div></dialog>';
