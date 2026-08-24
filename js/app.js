const STORE = "courtlab-builds-v1";
const UNITS_KEY = "courtlab-units";
const LEVELS = ["未解锁", "铜", "银", "金", "名人堂"];
const E = window.Engine;

const state = {
  game: null,
  tab: "body",
  lang: "zh",
  units: localStorage.getItem(UNITS_KEY) || "metric",
  pos: "PG",
  size: { height: 75, weight: 190, wingspan: 78 },
  values: {},
  caps: {},
  name: "未命名",
  jersey: 0,
  hand: "R",
  body: "Balanced",
  takeover: "Sharpshooter",
  editing: null,
};

function t(en, zh) {
  return state.lang === "zh" ? zh || en : en;
}

function $(sel, root = document) {
  return root.querySelector(sel);
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => {
    el.style.display = "none";
  }, 1600);
}

function refreshCaps() {
  const g = state.game;
  state.caps = E.allCaps(g, state.size);
  state.values = E.clampAllToCaps(state.values, state.caps);
}

function setAttr(id, raw) {
  const cap = state.caps[id] ?? 99;
  const next = { ...state.values, [id]: E.clamp(raw, 25, cap) };
  state.values = E.applyConstraints(state.game, next, state.caps, state.size.height, id);
  state.values = E.clampAllToCaps(state.values, state.caps);
}

function ovr() {
  return E.overall(state.game, state.values, state.pos);
}

function snapshot() {
  return {
    name: state.name,
    jersey: state.jersey,
    hand: state.hand,
    pos: state.pos,
    body: state.body,
    takeover: state.takeover,
    size: { ...state.size },
    values: { ...state.values },
    savedAt: Date.now(),
    ovr: ovr(),
  };
}

function applySnap(s) {
  state.name = s.name || "未命名";
  state.jersey = s.jersey ?? 0;
  state.hand = s.hand || "R";
  state.pos = s.pos || "PG";
  const bodies = (state.game.bodyShapes || []).map((b) => b.id);
  state.body = bodies.includes(s.body) ? s.body : "Balanced";
  state.takeover = s.takeover || "Sharpshooter";
  state.size = { ...s.size };
  state.values = { ...s.values };
  refreshCaps();
}

function loadList() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "[]");
  } catch {
    return [];
  }
}

function saveList(list) {
  localStorage.setItem(STORE, JSON.stringify(list));
}

function txt(obj) {
  if (!obj) return "";
  return t(obj.en, obj.zh);
}

function renderShell() {
  const tabs = [
    ["body", "体型", "Body"],
    ["attrs", "属性", "Attrs"],
    ["badges", "徽章", "Badges"],
    ["take", "主宰", "Takeover"],
    ["saves", "存档", "Saves"],
  ];
  $("#tabs").innerHTML = tabs
    .map(([id, zh, en]) => `<button data-tab="${id}" class="${state.tab === id ? "on" : ""}">${t(en, zh)}</button>`)
    .join("");
}

function renderCard() {
  const g = state.game;
  const p = g.positions[state.pos];
  const cats = E.categoryAverages(g, state.values);
  const name = state.name || t("UNNAMED", "未命名");
  const u = state.units;
  const ht = E.fmtHeight(state.size.height, u);
  const wt = E.fmtWeight(state.size.weight, u);
  $("#player-card").innerHTML = `
    <div class="ovr-wrap">
      <div class="ovr-num">${ovr()}</div>
      <div class="ovr-label">OVR</div>
    </div>
    <div class="identity">
      <h2>${escapeHtml(name)} <span style="color:var(--mute)">#${state.jersey}</span></h2>
      <p>${state.pos} · ${ht} · ${t(state.hand === "R" ? "Right" : "Left", state.hand === "R" ? "右手" : "左手")}</p>
    </div>
    <div class="meta-grid">
      <div><span>${t("Weight", "体重")}</span><b>${wt}</b></div>
      <div><span>${t("Wingspan", "臂展")}</span><b>${E.fmtHeight(state.size.wingspan, u)}</b></div>
      <div><span>${t("Height range", "身高区间")}</span><b>${E.fmtHeightRange(p.minHeight, p.maxHeight, u)}</b></div>
      <div><span>${t("Body", "体型")}</span><b>${escapeHtml(bodyName())}</b></div>
    </div>
    <div class="radar">
      ${g.categories.map((c) => radarRow(c, cats[c.id] || 25)).join("")}
    </div>
  `;
}

function bodyName() {
  const b = state.game.bodyShapes.find((x) => x.id === state.body);
  return b ? txt(b) : state.body;
}

function radarRow(c, v) {
  return `<div class="radar-row"><span>${txt(c)}</span><div class="bar"><i style="width:${v}%"></i></div><span>${v}</span></div>`;
}

function renderBody() {
  const g = state.game;
  const p = g.positions[state.pos];
  const wr = E.wingspanRange(state.size.height);
  const posBtns = Object.keys(g.positions)
    .map((id) => `<button class="chip ${state.pos === id ? "on" : ""}" data-pos="${id}">${id}</button>`)
    .join("");
  const bodies = g.bodyShapes
    .map((b) => `<button class="${state.body === b.id ? "on" : ""}" data-body="${b.id}">${txt(b)}</button>`)
    .join("");
  $("#panel").innerHTML = `
    <h3>${t("Frame", "体型台")}</h3>
    <p class="hint">${t("Position and size set the attribute caps.", "位置和体型会改写每项属性上限。")}</p>
    <div class="pos-row">${posBtns}</div>
    <div class="field-grid">
      <label class="field">${t("First / last name", "名字")}<input id="name" type="text" value="${escapeHtml(state.name)}" maxlength="24"></label>
      <label class="field">${t("Jersey", "球衣号码")}<input id="jersey" type="number" min="0" max="99" value="${state.jersey}"></label>
      <label class="field">${t("Height", "身高")} ${E.fmtHeight(state.size.height, state.units)}
        <input id="height" type="range" min="${p.minHeight}" max="${p.maxHeight}" value="${state.size.height}">
      </label>
      <label class="field">${t("Weight", "体重")} ${E.fmtWeight(state.size.weight, state.units)}
        <input id="weight" type="range" min="${p.minWeight}" max="${p.maxWeight}" value="${state.size.weight}">
      </label>
      <label class="field">${t("Wingspan", "臂展")} ${E.fmtHeight(state.size.wingspan, state.units)}
        <input id="wingspan" type="range" min="${wr.min}" max="${wr.max}" value="${E.clamp(state.size.wingspan, wr.min, wr.max)}">
      </label>
      <label class="field">${t("Hand", "惯用手")}
        <div class="chip-row" style="margin-top:6px">
          <button class="chip ${state.hand === "R" ? "on" : ""}" data-hand="R">${t("Right", "右手")}</button>
          <button class="chip ${state.hand === "L" ? "on" : ""}" data-hand="L">${t("Left", "左手")}</button>
        </div>
      </label>
    </div>
    <h3>${t("Body type", "体型")}</h3>
    <p class="hint">${t("Sherpa only ships 11 builder presets in BodyTypeAtlas. The extra names were localization labels, not options.", "游戏建模台图集只有 11 种可选体型。之前那一长串是文案词表，不是都能选。")}</p>
    <div class="body-grid">${bodies}</div>
  `;
}

function renderAttrs() {
  const g = state.game;
  let html = `<h3>${t("Attributes", "属性")}</h3><p class="hint">${t("Caps follow height / weight / wingspan. Related stats stay within max delta.", "上限跟身高体重臂展走。关联属性会被互锁。")}</p>`;
  for (const cat of g.categories) {
    const rows = g.attributes.filter((a) => a.cat === cat.id);
    html += `<div class="cat-block"><div class="cat-head"><span>${txt(cat)}</span></div>`;
    for (const a of rows) {
      const v = state.values[a.id];
      const cap = state.caps[a.id];
      const pct = ((cap - 25) / 74) * 100;
      html += `<div class="attr-row">
        <b>${txt(a)}</b>
        <div class="slider-wrap">
          <div class="cap-mark" style="left:${pct}%"></div>
          <input type="range" min="25" max="${cap}" value="${v}" data-attr="${a.id}">
        </div>
        <div class="attr-vals">${v} <em>/ ${cap}</em></div>
      </div>`;
    }
    html += `</div>`;
  }
  $("#panel").innerHTML = html;
}

function renderBadges() {
  const g = state.game;
  const cards = g.badges.map((b) => {
    const lv = E.badgeLevel(state.values, b.attrs);
    const desc = t(b.short_en || b.desc_en, b.short_zh || b.desc_zh);
    return `<article class="badge lv${lv}">
      <header>
        <h4>${t(b.en, b.zh)}</h4>
        <span class="lvl">${LEVELS[lv]}</span>
      </header>
      <p>${escapeHtml(desc)}</p>
    </article>`;
  }).join("");
  $("#panel").innerHTML = `<h3>${t("Badges", "徽章")}</h3>
    <p class="hint">${t("Levels are estimated from related attributes (60/75/85/92). Native min-attr tables are still in GameLib.", "等级按关联属性估算（60/75/85/92），精确门槛还在 GameLib 原生库里。")}</p>
    <div class="badge-grid">${cards}</div>`;
}

function renderTake() {
  const cards = state.game.takeovers.map((tk) => {
    const on = state.takeover === tk.id ? "on" : "";
    return `<article class="take ${on}" data-take="${tk.id}">
      <header><h4>${t(tk.en, tk.zh)}</h4></header>
      <p>${escapeHtml(t(tk.desc_en, tk.desc_zh))}</p>
    </article>`;
  }).join("");
  $("#panel").innerHTML = `<h3>${t("Takeover", "主宰")}</h3>
    <p class="hint">${t("Pick a Level 5 ability. Requirements are shown as flavor, not hard-locked.", "选一个 5 级主宰能力。")}</p>
    <div class="take-grid">${cards}</div>`;
}

function renderSaves() {
  const list = loadList();
  const rows = list.map((s, i) => `<div class="save-row">
    <div><b>${escapeHtml(s.name)}</b><div class="hint" style="margin:0">${s.pos} · OVR ${s.ovr} · ${new Date(s.savedAt).toLocaleString()}</div></div>
    <button class="ghost" data-load="${i}">${t("Load", "读取")}</button>
    <button class="ghost" data-dl="${i}">JSON</button>
    <button class="ghost" data-del="${i}">${t("Delete", "删除")}</button>
  </div>`).join("") || `<p class="hint">${t("No local builds yet.", "还没有本地存档。")}</p>`;
  $("#panel").innerHTML = `<h3>${t("Local locker", "本地存档")}</h3>
    <p class="hint">${t("No login. Builds stay in this browser.", "不用登录，模板只存在这台浏览器。")}</p>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="solid" id="save-now">${t("Save current", "保存当前")}</button>
      <button class="ghost" id="export-now">${t("Export JSON", "导出 JSON")}</button>
      <button class="ghost" id="import-now">${t("Import JSON", "导入 JSON")}</button>
      <input id="import-file" type="file" accept="application/json" hidden>
    </div>
    <div class="saves">${rows}</div>`;
}

function renderPanel() {
  if (state.tab === "body") renderBody();
  else if (state.tab === "attrs") renderAttrs();
  else if (state.tab === "badges") renderBadges();
  else if (state.tab === "take") renderTake();
  else renderSaves();
}

function syncChrome() {
  const langBtn = $("#lang");
  const unitBtn = $("#units");
  if (langBtn) langBtn.textContent = state.lang === "zh" ? "EN" : "中文";
  if (unitBtn) unitBtn.textContent = state.units === "metric" ? "英制 ft/lb" : "公制 cm/kg";
}

function render() {
  syncChrome();
  renderShell();
  renderCard();
  renderPanel();
}

function onPos(pos) {
  const g = state.game;
  state.pos = pos;
  const p = g.positions[pos];
  state.size.height = E.clamp(state.size.height, p.minHeight, p.maxHeight);
  state.size.weight = E.clamp(state.size.weight, p.minWeight, p.maxWeight);
  const wr = E.wingspanRange(state.size.height);
  state.size.wingspan = E.clamp(state.size.wingspan, wr.min, wr.max);
  refreshCaps();
  render();
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function bind() {
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("input", onInput);
  document.body.addEventListener("change", onChange);
}

function onClick(ev) {
  const tab = ev.target.closest("[data-tab]");
  if (tab) {
    state.tab = tab.dataset.tab;
    render();
    return;
  }
  const pos = ev.target.closest("[data-pos]");
  if (pos) return onPos(pos.dataset.pos);
  const hand = ev.target.closest("[data-hand]");
  if (hand) {
    state.hand = hand.dataset.hand;
    render();
    return;
  }
  const body = ev.target.closest("[data-body]");
  if (body) {
    state.body = body.dataset.body;
    render();
    return;
  }
  const take = ev.target.closest("[data-take]");
  if (take) {
    state.takeover = take.dataset.take;
    render();
    return;
  }
  if (ev.target.id === "lang") {
    state.lang = state.lang === "zh" ? "en" : "zh";
    render();
    return;
  }
  if (ev.target.id === "units") {
    state.units = state.units === "metric" ? "imperial" : "metric";
    localStorage.setItem(UNITS_KEY, state.units);
    render();
    return;
  }
  if (ev.target.id === "save-now") return saveCurrent();
  if (ev.target.id === "export-now") {
    downloadJson(snapshot(), `${state.name || "build"}.json`);
    return;
  }
  if (ev.target.id === "import-now") {
    $("#import-file").click();
    return;
  }
  const load = ev.target.closest("[data-load]");
  if (load) {
    applySnap(loadList()[Number(load.dataset.load)]);
    state.tab = "attrs";
    render();
    toast(t("Loaded", "已读取"));
    return;
  }
  const del = ev.target.closest("[data-del]");
  if (del) {
    const list = loadList();
    list.splice(Number(del.dataset.del), 1);
    saveList(list);
    render();
    return;
  }
  const dl = ev.target.closest("[data-dl]");
  if (dl) {
    const s = loadList()[Number(dl.dataset.dl)];
    downloadJson(s, `${s.name || "build"}.json`);
  }
}

function onInput(ev) {
  const attr = ev.target.dataset.attr;
  if (attr) {
    setAttr(attr, Number(ev.target.value));
    renderCard();
    document.querySelectorAll("[data-attr]").forEach((inp) => {
      const id = inp.dataset.attr;
      inp.max = state.caps[id];
      inp.value = state.values[id];
      const row = inp.closest(".attr-row");
      if (row) {
        row.querySelector(".attr-vals").innerHTML =
          `${state.values[id]} <em>/ ${state.caps[id]}</em>`;
      }
    });
    return;
  }
  if (ev.target.id === "height") {
    const p = state.game.positions[state.pos];
    state.size.height = E.clamp(Number(ev.target.value), p.minHeight, p.maxHeight);
    const wr = E.wingspanRange(state.size.height);
    state.size.wingspan = E.clamp(state.size.wingspan, wr.min, wr.max);
    refreshCaps();
    renderCard();
    const lab = ev.target.closest("label");
    if (lab) lab.childNodes[0].textContent = `${t("Height", "身高")} ${E.fmtHeight(state.size.height, state.units)}`;
    return;
  }
  if (ev.target.id === "weight") {
    const p = state.game.positions[state.pos];
    state.size.weight = E.clamp(Number(ev.target.value), p.minWeight, p.maxWeight);
    refreshCaps();
    renderCard();
    const lab = ev.target.closest("label");
    if (lab) lab.childNodes[0].textContent = `${t("Weight", "体重")} ${E.fmtWeight(state.size.weight, state.units)}`;
    return;
  }
  if (ev.target.id === "wingspan") {
    const wr = E.wingspanRange(state.size.height);
    state.size.wingspan = E.clamp(Number(ev.target.value), wr.min, wr.max);
    refreshCaps();
    renderCard();
    const lab = ev.target.closest("label");
    if (lab) lab.childNodes[0].textContent = `${t("Wingspan", "臂展")} ${E.fmtHeight(state.size.wingspan, state.units)}`;
  }
}

function onChange(ev) {
  if (ev.target.id === "name") {
    state.name = ev.target.value.slice(0, 24);
    renderCard();
  }
  if (ev.target.id === "jersey") {
    state.jersey = E.clamp(Number(ev.target.value) || 0, 0, 99);
    renderCard();
  }
  if (ev.target.id === "import-file" && ev.target.files[0]) {
    const file = ev.target.files[0];
    file.text().then((txt) => {
      applySnap(JSON.parse(txt));
      render();
      toast(t("Imported", "已导入"));
    });
  }
}

function saveCurrent() {
  const list = loadList();
  const snap = snapshot();
  const idx = list.findIndex((s) => s.name === snap.name && s.pos === snap.pos);
  if (idx >= 0) list[idx] = snap;
  else list.unshift(snap);
  saveList(list);
  toast(t("Saved locally", "已保存到本地"));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function boot(game) {
  state.game = game;
  const params = new URLSearchParams(location.search);
  if (params.get("units") === "imperial" || params.get("units") === "metric") {
    state.units = params.get("units");
  }
  const hash = location.hash.replace("#", "");
  if (["body", "attrs", "badges", "take", "saves"].includes(hash)) state.tab = hash;
  state.size = E.defaultSize(game, state.pos);
  state.caps = E.allCaps(game, state.size);
  state.values = E.defaultValues(game, state.caps);
  bind();
  render();
}

fetch("data/game.json")
  .then((r) => r.json())
  .then(boot)
  .catch((err) => {
    document.body.innerHTML = `<p style="padding:24px">Failed to load data: ${err}</p>`;
  });
