// 账本专属表单与只读详情；原收藏编辑器保持独立。
import { $, esc, toast } from "../core/dom.js";
import { parseMoney, decimal, money, equalShares, bookToday } from "./money.js";
const payment = ["", "现金", "微信", "支付宝", "银行卡", "信用卡", "其他"];
const select = (id, label, options) =>
  `<label class="field">${label}<select id="${id}">${options}</select></label>`;
const option = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
export function ledgerEditor(app, state, data, receipts, reload, label) {
  let mounted = false;
  function mount() {
    if (mounted) return;
    mounted = true;
    $("#featureDialogs").insertAdjacentHTML(
      "beforeend",
      `<dialog id="ledgerEditor" class="ledger-dialog" aria-labelledby="ledgerEditorTitle" aria-modal="true"><div class="ledger-dialog-head"><h2 id="ledgerEditorTitle">记一笔账</h2><button type="button" class="btn secondary" id="ledgerEditorClose">关闭</button></div><form id="ledgerForm"><fieldset id="ledgerFields"><div class="formgrid">${select("ledgerKind", "收支类型", option("expense", "支出") + option("income", "收入"))}<label class="field">金额（元，必填）<input id="ledgerAmount" inputmode="decimal" required maxlength="14" placeholder="0.00"></label>${select("ledgerScope", "消费性质（必填）", option("shared", "一起消费") + option("personal", "各自消费"))}${select("ledgerPayer", "付款人 / 收款人", "")}<div id="ledgerOwnerGroup">${select("ledgerOwner", "这笔账属于谁", "")}</div><div id="ledgerSplitGroup">${select("ledgerSplit", "共同金额分配", option("equal", "两人平摊") + option("custom", "自定义金额"))}</div><div class="field full" id="ledgerCustom"></div><p class="field full subtitle" id="ledgerSplitHint"></p>${select("ledgerCategory", "一级分类（必填）", "")}${select("ledgerSubcategory", "二级分类（可选）", "")}<label class="field">自定义一级分类<input id="ledgerNewCategory" maxlength="40" placeholder="输入新分类名称"><button type="button" class="btn secondary" id="ledgerAddCategory">添加一级分类</button></label><label class="field">自定义二级分类<input id="ledgerNewSubcategory" maxlength="40" placeholder="添加到当前一级分类"><button type="button" class="btn secondary" id="ledgerAddSubcategory">添加二级分类</button></label><label class="field">发生日期（必填）<input id="ledgerDate" type="date" min="1900-01-01" required></label>${select("ledgerPayment", "支付方式（可选）", payment.map((v) => option(v, v || "未填写")).join(""))}<label class="field full">说明（必填）<input id="ledgerDescription" required maxlength="120" placeholder="简短描述这笔账"></label><label class="field full">备注（可选）<textarea id="ledgerNotes" maxlength="2000" rows="3"></textarea></label><label class="field full">小票 / 凭证（可选）<input id="ledgerReceiptFile" type="file" accept="image/jpeg,image/png,image/webp"><span class="subtitle" id="ledgerReceiptStatus"></span></label><button type="button" id="ledgerRemoveReceipt" class="btn secondary">移除本笔账的凭证引用</button></div></fieldset><p id="ledgerFormStatus" role="status"></p><button type="submit" id="ledgerSave" class="btn">保存账目</button></form></dialog><dialog id="ledgerDetail" class="ledger-dialog" aria-labelledby="ledgerDetailTitle" aria-modal="true"><div class="ledger-dialog-head"><h2 id="ledgerDetailTitle">账目详情</h2><button type="button" id="ledgerDetailClose" class="btn secondary">关闭</button></div><div id="ledgerDetailContent"></div></dialog>`,
    );
    $("#ledgerForm").onsubmit = save;
    $("#ledgerEditorClose").onclick = close;
    $("#ledgerDetailClose").onclick = () => $("#ledgerDetail").close();
    for (const id of ["ledgerEditor", "ledgerDetail"]) {
      app.events.listen($("#" + id), "cancel", (e) => {
        if (state.busy || state.receiptBusy) e.preventDefault();
      });
      app.events.listen($("#" + id), "click", (e) => {
        if (e.target === $("#" + id) && !state.busy && !state.receiptBusy)
          $("#" + id).close();
      });
      app.events.listen($("#" + id), "close", () => {
        if (state.trigger?.isConnected) state.trigger.focus();
      });
    }
    for (const id of ["ledgerScope", "ledgerSplit", "ledgerAmount"])
      $("#" + id).oninput = splitFields;
    $("#ledgerKind").onchange = () => categories();
    $("#ledgerCategory").onchange = subcategories;
    $("#ledgerAddCategory").onclick = () => addCategory(false);
    $("#ledgerAddSubcategory").onclick = () => addCategory(true);
    $("#ledgerReceiptFile").onchange = upload;
    $("#ledgerRemoveReceipt").onclick = () => {
      if (state.receiptBusy) return;
      state.receiptKey = "";
      receiptStatus();
    };
  }
  function categories(categoryId = "", subcategoryId = "") {
    const kind = $("#ledgerKind").value;
    $("#ledgerCategory").innerHTML =
      option("", "请选择") +
      state.categories
        .filter((c) => c.kind === kind && !c.parent_id)
        .map((c) => option(c.id, c.name))
        .join("");
    $("#ledgerCategory").value = categoryId;
    subcategories();
    $("#ledgerSubcategory").value = subcategoryId;
  }
  function subcategories() {
    const id = $("#ledgerCategory").value;
    $("#ledgerSubcategory").innerHTML =
      option("", "无二级分类") +
      state.categories
        .filter((c) => c.parent_id === id)
        .map((c) => option(c.id, c.name))
        .join("");
  }
  function splitFields() {
    const personal = $("#ledgerScope").value === "personal",
      custom = $("#ledgerSplit").value === "custom";
    $("#ledgerOwnerGroup").hidden = !personal;
    $("#ledgerSplitGroup").hidden = personal;
    $("#ledgerCustom").hidden = personal || !custom;
    let text = "共同金额分配与付款人相互独立。";
    try {
      const amount = parseMoney($("#ledgerAmount").value);
      text = personal
        ? `全部 ${money(amount)} 归属${label($("#ledgerOwner").value)}。`
        : custom
          ? "自定义金额可以为零，两人合计必须等于总金额。"
          : equalShares(amount, state.people)
              .map((a) => `${label(a.user_id)} ${money(a.amount_minor)}`)
              .join(" · ") + "（有余下 1 分时归固定排序的第一位成员）";
    } catch {}
    $("#ledgerSplitHint").textContent = text;
  }
  function receiptStatus() {
    $("#ledgerReceiptStatus").textContent = state.receiptKey
      ? "已附私有凭证，保存账目后可在详情中查看。"
      : "未附凭证。";
    $("#ledgerRemoveReceipt").hidden = !state.receiptKey;
  }
  function open(entry = null) {
    if (!state.member) return;
    if (!state.ready || state.people.length !== 2) {
      toast("账本正在加载，或对方尚未加入共享空间。");
      return;
    }
    if (entry && entry.created_by !== app.state.cloudUser.id) {
      toast("只能编辑自己创建的账目。");
      return;
    }
    mount();
    state.trigger = document.activeElement;
    state.editing = entry
      ? structuredClone(entry)
      : { id: crypto.randomUUID(), version: 0 };
    state.requestId = "";
    state.lastPayload = "";
    $("#ledgerForm").reset();
    $("#ledgerFields").disabled = false;
    $("#ledgerSave").disabled = false;
    $("#ledgerEditorTitle").textContent = entry ? "编辑我的账目" : "记一笔账";
    const people = state.people
      .map((p) => option(p.user_id, label(p.user_id)))
      .join("");
    $("#ledgerPayer").innerHTML = people;
    $("#ledgerOwner").innerHTML = people;
    $("#ledgerPayer").value = entry?.payer_user_id || app.state.cloudUser.id;
    $("#ledgerOwner").value = entry?.owner_user_id || app.state.cloudUser.id;
    $("#ledgerKind").value = entry?.kind || "expense";
    $("#ledgerScope").value = entry?.scope || "shared";
    $("#ledgerSplit").value =
      entry?.split_method === "custom" ? "custom" : "equal";
    $("#ledgerAmount").value = entry ? decimal(entry.amount_minor) : "";
    $("#ledgerDate").value = entry?.occurred_on || bookToday();
    $("#ledgerDate").max = bookToday();
    $("#ledgerDescription").value = entry?.description || "";
    $("#ledgerNotes").value = entry?.notes || "";
    $("#ledgerPayment").value = entry?.payment_method || "";
    categories(entry?.category_id, entry?.subcategory_id || "");
    $("#ledgerCustom").innerHTML = state.people
      .map(
        (p) =>
          `<label class="field">${esc(label(p.user_id))}分配金额（元）<input data-ledger-share="${esc(p.user_id)}" inputmode="decimal" placeholder="0.00" value="${entry?.allocations?.some((a) => a.user_id === p.user_id) ? decimal(entry.allocations.find((a) => a.user_id === p.user_id).amount_minor) : ""}"></label>`,
      )
      .join("");
    $("#ledgerOwner").onchange = splitFields;
    state.receiptKey = entry?.receipt_key || "";
    receiptStatus();
    splitFields();
    $("#ledgerFormStatus").textContent =
      state.people.length === 2 ? "" : "请先邀请对方加入，再开始双人记账。";
    $("#ledgerEditor").showModal();
    $("#ledgerAmount").focus();
  }
  function close() {
    if (state.busy || state.receiptBusy) return;
    $("#ledgerEditor").close();
  }
  async function addCategory(child) {
    if (state.busy || state.receiptBusy) return;
    const node = $(child ? "#ledgerNewSubcategory" : "#ledgerNewCategory"),
      name = node.value.trim();
    if (!name) {
      $("#ledgerFormStatus").textContent = "请先填写分类名称。";
      return;
    }
    const epoch = app.state.cloudEpoch;
    state.busy = true;
    $("#ledgerFields").disabled = true;
    $("#ledgerSave").disabled = true;
    try {
      const parent = child ? $("#ledgerCategory").value : null;
      if (child && !parent) throw Error("请先选择一级分类。");
      const id = await data.category($("#ledgerKind").value, name, parent);
      if (epoch !== app.state.cloudEpoch) return;
      categories(child ? parent : id, child ? id : "");
      node.value = "";
      $("#ledgerFormStatus").textContent = "分类已添加。";
    } catch (e) {
      if (epoch === app.state.cloudEpoch)
        $("#ledgerFormStatus").textContent = e.message;
    } finally {
      if (epoch === app.state.cloudEpoch) {
        state.busy = false;
        $("#ledgerFields").disabled = false;
        $("#ledgerSave").disabled = false;
      }
    }
  }
  async function upload() {
    const file = $("#ledgerReceiptFile").files[0];
    if (!file || state.busy || state.receiptBusy) return;
    const epoch = app.state.cloudEpoch;
    state.receiptBusy = true;
    $("#ledgerSave").disabled = true;
    $("#ledgerReceiptStatus").textContent = "正在压缩并上传私有凭证…";
    try {
      const key = await receipts.upload(state.editing.id, file);
      if (epoch !== app.state.cloudEpoch) return;
      state.receiptKey = key;
      receiptStatus();
    } catch (e) {
      if (epoch === app.state.cloudEpoch)
        $("#ledgerReceiptStatus").textContent =
          "凭证上传失败：" + e.message + " 原凭证保留。";
    } finally {
      if (epoch === app.state.cloudEpoch) {
        state.receiptBusy = false;
        $("#ledgerSave").disabled = false;
        $("#ledgerReceiptFile").value = "";
      }
    }
  }
  async function save(event) {
    event.preventDefault();
    if (state.busy || state.receiptBusy || !state.member) return;
    const epoch = app.state.cloudEpoch;
    try {
      const amount = parseMoney($("#ledgerAmount").value),
        scope = $("#ledgerScope").value,
        split = $("#ledgerSplit").value;
      const payload = {
        kind: $("#ledgerKind").value,
        amount_minor: amount,
        scope,
        owner_user_id: scope === "personal" ? $("#ledgerOwner").value : null,
        payer_user_id: $("#ledgerPayer").value,
        split_method: scope === "personal" ? "none" : split,
        category_id: $("#ledgerCategory").value,
        subcategory_id: $("#ledgerSubcategory").value || null,
        occurred_on: $("#ledgerDate").value,
        description: $("#ledgerDescription").value.trim(),
        notes: $("#ledgerNotes").value.trim(),
        payment_method: $("#ledgerPayment").value,
        receipt_key: state.receiptKey || null,
      };
      if (!payload.category_id || !payload.description)
        throw Error("请选择分类并填写说明。");
      if (!payload.occurred_on || payload.occurred_on > bookToday())
        throw Error("请选择今天或过去的发生日期。");
      if (scope === "shared" && split === "custom") {
        payload.allocations = [
          ...$("#ledgerCustom").querySelectorAll("input"),
        ].map((n) => ({
          user_id: n.dataset.ledgerShare,
          amount_minor: parseMoney(n.value, true),
        }));
        if (
          payload.allocations.reduce(
            (n, a) => n + BigInt(a.amount_minor),
            0n,
          ) !== BigInt(amount)
        )
          throw Error("两人的分摊金额合计必须等于总金额。");
      }
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== state.lastPayload) {
        state.lastPayload = fingerprint;
        state.requestId = crypto.randomUUID();
      }
      state.busy = true;
      $("#ledgerFields").disabled = true;
      $("#ledgerSave").disabled = true;
      $("#ledgerFormStatus").textContent = "正在保存…";
      await data.save(
        state.editing.id,
        state.editing.version,
        state.requestId,
        payload,
      );
      if (epoch !== app.state.cloudEpoch) return;
      state.busy = false;
      $("#ledgerEditor").close();
      toast("账目已保存；补记的旧账可切换发生月份查看。");
      await reload();
    } catch (e) {
      if (epoch === app.state.cloudEpoch)
        $("#ledgerFormStatus").textContent = e.message;
    } finally {
      if (epoch === app.state.cloudEpoch) {
        state.busy = false;
        $("#ledgerFields").disabled = false;
        $("#ledgerSave").disabled = false;
      }
    }
  }
  function detail(entry) {
    mount();
    state.trigger = document.activeElement;
    state.detailId = entry.id;
    const mine = entry.created_by === app.state.cloudUser.id;
    $("#ledgerDetailContent").innerHTML =
      `<h3>${esc(entry.description)}</h3><p class="ledger-detail-amount">${money(entry.amount_minor)} · ${entry.kind === "expense" ? "支出" : "收入"}</p><dl>${[
        ["性质", entry.scope === "shared" ? "一起消费" : "各自消费"],
        ["个人所属", entry.owner_user_id ? label(entry.owner_user_id) : "共同"],
        [
          "分配方式",
          { none: "个人全额", equal: "两人平摊", custom: "自定义" }[
            entry.split_method
          ],
        ],
        [
          "分类",
          entry.category_name +
            (entry.subcategory_name ? " / " + entry.subcategory_name : ""),
        ],
        ["发生日期", entry.occurred_on],
        ["付款 / 收款人", label(entry.payer_user_id)],
        ["支付方式", entry.payment_method || "未填写"],
        ["记账人", label(entry.created_by)],
        ["创建时间", new Date(entry.created_at).toLocaleString("zh-CN")],
        ["最后修改", new Date(entry.updated_at).toLocaleString("zh-CN")],
        ["备注", entry.notes || "无"],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`)
        .join(
          "",
        )}</dl><h3>${entry.kind === "expense" ? "支出承担" : "收入归属"}</h3>${entry.allocations.map((a) => `<p>${esc(label(a.user_id))}：${money(a.amount_minor)}</p>`).join("")}${entry.receipt_key ? '<button class="btn secondary" id="ledgerViewReceipt">查看私有凭证</button><p id="ledgerReceiptViewStatus" role="status"></p><img id="ledgerReceiptImage" alt="本笔账的私有凭证" hidden>' : ""}<p class="subtitle">${mine ? "这笔账由你创建，可编辑或删除。" : "由对方创建，仅可查看。"}</p>${mine ? '<div class="social-actions"><button id="ledgerEditEntry" class="btn">编辑</button><button id="ledgerDeleteEntry" class="btn secondary">删除</button></div>' : ""}`;
    if (!$("#ledgerDetail").open) $("#ledgerDetail").showModal();
    if (mine) {
      $("#ledgerEditEntry").onclick = () => {
        $("#ledgerDetail").close();
        open(entry);
      };
      $("#ledgerDeleteEntry").onclick = async () => {
        if (
          state.busy ||
          !window.confirm("确认删除这笔账？删除后将从明细和报表中移除。")
        )
          return;
        const epoch = app.state.cloudEpoch;
        state.busy = true;
        $("#ledgerDeleteEntry").disabled = true;
        try {
          await data.remove(entry);
          if (epoch !== app.state.cloudEpoch) return;
          $("#ledgerDetail").close();
          toast("账目已删除");
          await reload();
        } catch (e) {
          if (epoch === app.state.cloudEpoch) toast(e.message);
        } finally {
          if (epoch === app.state.cloudEpoch) {
            state.busy = false;
            if ($("#ledgerDeleteEntry"))
              $("#ledgerDeleteEntry").disabled = false;
          }
        }
      };
    }
    if (entry.receipt_key)
      $("#ledgerViewReceipt").onclick = async () => {
        const epoch = app.state.cloudEpoch;
        $("#ledgerReceiptViewStatus").textContent = "正在读取私有凭证…";
        try {
          const url = await receipts.read(entry.id);
          if (
            epoch !== app.state.cloudEpoch ||
            state.detailId !== entry.id ||
            !$("#ledgerDetail").open
          )
            return;
          $("#ledgerReceiptImage").src = url;
          $("#ledgerReceiptImage").hidden = false;
          $("#ledgerReceiptViewStatus").textContent = "";
        } catch (e) {
          if (epoch === app.state.cloudEpoch && $("#ledgerReceiptViewStatus"))
            $("#ledgerReceiptViewStatus").textContent = e.message;
        }
      };
  }
  function refreshDetail() {
    if (!$("#ledgerDetail")?.open) return;
    const current = state.entries.find((e) => e.id === state.detailId);
    if (current) detail(current);
    else {
      $("#ledgerDetail").close();
      toast("账目已更新或删除，请重新查询。");
    }
  }
  function dispose() {
    for (const id of ["ledgerEditor", "ledgerDetail"])
      if ($("#" + id)?.open) $("#" + id).close();
    receipts.dispose();
  }
  return { open, detail, refreshDetail, dispose };
}
