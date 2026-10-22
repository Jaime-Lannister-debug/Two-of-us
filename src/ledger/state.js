// 账本实例独立状态，不复用收藏筛选或互动草稿。
import { bookToday } from "./money.js";
export function ledgerState() {
  const today = bookToday();
  return {
    active: false,
    ready: false,
    loading: false,
    error: "",
    view: "entries",
    people: [],
    categories: [],
    entries: [],
    summary: null,
    report: null,
    filters: {
      month: today.slice(0, 7),
      kind: "",
      scope: "",
      category_id: "",
      payer_user_id: "",
      query: "",
    },
    month: today.slice(0, 7),
    year: today.slice(0, 4),
    offset: 0,
    total: 0,
    channel: null,
    reloadTimer: null,
    searchTimer: null,
    version: 0,
    editing: null,
    receiptKey: "",
    busy: false,
    receiptBusy: false,
    requestId: "",
    lastPayload: "",
    trigger: null,
  };
}
