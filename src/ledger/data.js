// 只调用已鉴权的账本 RPC；金额 JSON 必须保留字符串。
import { monthRange } from "./money.js";
export function ledgerData(app, state) {
  async function rpc(name, args) {
    const epoch = app.state.cloudEpoch;
    const { data, error } = await app.state.cloud.rpc(name, {
      p_space: app.config.SHARED_ID,
      ...args,
    });
    if (epoch !== app.state.cloudEpoch) throw Error("登录状态已变化。");
    if (error) {
      if (
        /PGRST202|PGRST205|schema cache|does not exist/.test(
          String(error.code) + " " + error.message,
        )
      )
        throw Error(
          "账本尚未启用，请在 Supabase SQL Editor 执行 07-ledger.sql。",
        );
      throw error;
    }
    return data;
  }
  async function bootstrap() {
    const data = await rpc("ledger_bootstrap", {});
    state.purposeEnabled = data.purpose_enabled === true;
    state.people = data.people;
    state.categories = data.categories;
    state.ready = true;
  }
  function filterArgs() {
    const { month, ...filters } = state.filters;
    return { ...filters, ...(month ? monthRange(month) : {}) };
  }
  async function list() {
    if (state.filters.purpose && !state.purposeEnabled)
      throw Error("用途筛选需要执行 08-ledger-purpose.sql 后刷新账本。");
    return rpc("ledger_list", {
      p_filters: filterArgs(),
      p_offset: state.offset,
      p_limit: 50,
    });
  }
  async function report() {
    const [y, m] = state.month.split("-");
    return rpc("ledger_report", {
      p_year: Number(state.view === "year" ? state.year : y),
      p_month: state.view === "year" ? null : Number(m),
    });
  }
  async function save(id, version, requestId, payload) {
    if (!state.purposeEnabled)
      throw Error(
        "消费用途尚未启用，请在 Supabase SQL Editor 执行 08-ledger-purpose.sql 后刷新账本。",
      );
    return rpc("ledger_save", {
      p_id: id,
      p_expected_version: version,
      p_request_id: requestId,
      p_data: payload,
    });
  }
  async function remove(entry) {
    return rpc("ledger_delete", {
      p_id: entry.id,
      p_expected_version: entry.version,
    });
  }
  async function category(kind, name, parent = null) {
    const id = await rpc("ledger_add_category", {
      p_kind: kind,
      p_name: name,
      p_parent: parent,
    });
    await bootstrap();
    return id;
  }
  return { rpc, bootstrap, list, report, save, remove, category };
}
