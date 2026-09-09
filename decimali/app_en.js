const CONST_COLORS = { pi: "#7c9eff", sqrt2: "#ffb86b", phi: "#6bffb8" };
function colorFor(id) { return CONST_COLORS[id] || "#c792ea"; }

const state = {
  constants: [], // [{id,label,symbol,total_digits}]
  mode: "single", // "single" | "joint"
  currentConstant: null,
  byConstant: {}, // id -> { manifest, loadedChunks: Map }
};

const els = {
  headerSymbol: document.getElementById("header-symbol"),
  constantTabs: document.getElementById("constant-tabs"),
  viewToggleBtn: document.getElementById("view-toggle-btn"),
  sidebarSingle: document.getElementById("sidebar-single"),
  singleViewPanel: document.getElementById("single-view-panel"),
  jointViewPanel: document.getElementById("joint-view-panel"),
  jointColumns: document.getElementById("joint-columns"),
  totalDigits: document.getElementById("stat-total"),
  totalChunks: document.getElementById("stat-chunks"),
  generatedAt: document.getElementById("stat-generated"),
  chunkList: document.getElementById("chunk-list"),
  loadAllBtn: document.getElementById("load-all-btn"),
  clearAllBtn: document.getElementById("clear-all-btn"),
  digitDisplay: document.getElementById("digit-display"),
  viewerLabel: document.getElementById("viewer-label"),
  searchTitle: document.getElementById("search-title"),
  searchHint: document.getElementById("search-hint"),
  searchInput: document.getElementById("search-input"),
  searchBtn: document.getElementById("search-btn"),
  searchStatus: document.getElementById("search-status"),
  results: document.getElementById("results"),
};

function formatGroups(digits, groupSize = 10, lineSize = 100) {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && i % lineSize === 0) out += "\n";
    else if (i > 0 && i % groupSize === 0) out += " ";
    out += digits[i];
  }
  return out;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function getOrCreateConstState(id) {
  if (!state.byConstant[id]) state.byConstant[id] = { manifest: null, loadedChunks: new Map() };
  return state.byConstant[id];
}

async function ensureManifest(id) {
  const cs = getOrCreateConstState(id);
  if (cs.manifest) return cs.manifest;
  const res = await fetch(`data/${id}/manifest.json`);
  const m = await res.json();
  cs.manifest = m;
  return m;
}

async function ensureChunk(id, n) {
  const cs = getOrCreateConstState(id);
  if (cs.loadedChunks.has(n)) return cs.loadedChunks.get(n);
  const res = await fetch(`data/${id}/chunk_${pad4(n)}.txt`);
  const digits = (await res.text()).trim();
  cs.loadedChunks.set(n, digits);
  return digits;
}

// ---------- ricerca lato client (sostituisce search.php) ----------
// Stessa logica del backend PHP: scorre i blocchi in ordine, tiene un
// overlap tra un blocco e il successivo per non perdere match "a cavallo".

async function staticSearch(id, pattern, limit = 50) {
  const manifest = await ensureManifest(id);
  const patLen = pattern.length;
  const positions = [];
  let truncated = false;
  let overlap = "";
  let digitsRead = 0;

  for (let n = 1; n <= manifest.n_chunks; n++) {
    const chunkStr = await ensureChunk(id, n);
    const searchSpace = overlap + chunkStr;
    const baseOffset = digitsRead - overlap.length;

    let start = 0, idx;
    while ((idx = searchSpace.indexOf(pattern, start)) !== -1) {
      positions.push(baseOffset + idx);
      start = idx + 1;
      if (positions.length >= limit) { truncated = true; break; }
    }
    if (truncated) break;

    overlap = patLen > 1 ? chunkStr.slice(-(patLen - 1)) : "";
    digitsRead += chunkStr.length;
  }

  return {
    pattern,
    count_returned: positions.length,
    truncated,
    results: positions.map((p) => ({ position: p })),
  };
}

// ---------- costanti / tab ----------

async function loadConstants() {
  const res = await fetch("data/constants.json");
  const data = await res.json();
  state.constants = data.constants || [];

  if (state.constants.length === 0) {
    els.digitDisplay.innerHTML = '<span class="loading">No constants found.</span>';
    return;
  }

  els.constantTabs.innerHTML = "";
  state.constants.forEach((c) => {
    state.byConstant[c.id] = { manifest: null, loadedChunks: new Map() };
    const btn = document.createElement("button");
    btn.className = "constant-tab";
    btn.textContent = `${c.symbol} ${c.label}`;
    btn.dataset.constant = c.id;
    btn.addEventListener("click", () => switchConstant(c.id));
    els.constantTabs.appendChild(btn);
  });

  await switchConstant(state.constants[0].id);
}

function updateActiveTab() {
  els.constantTabs.querySelectorAll(".constant-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.constant === state.currentConstant && state.mode === "single");
  });
}

async function switchConstant(id) {
  state.currentConstant = id;
  state.mode = "single";

  const m = await ensureManifest(id);
  els.totalDigits.textContent = m.total_digits.toLocaleString("en-US");
  els.totalChunks.textContent = m.n_chunks;
  els.generatedAt.textContent = new Date(m.generated_at).toLocaleString("en-US");

  const info = state.constants.find((c) => c.id === id);
  if (info) {
    els.headerSymbol.textContent = info.symbol;
    const badge = document.querySelector("#single-view-panel .badge");
    if (badge) badge.textContent = info.symbol + " (solo decimali)";
  }

  const cs = getOrCreateConstState(id);
  if (cs.loadedChunks.size === 0) await ensureChunk(id, 1);

  buildChunkList(id, m);
  updateModeUI();
  updateActiveTab();
  renderSingle();
}

// ---------- vista singola: lista blocchi ----------

function buildChunkList(id, manifest) {
  const cs = getOrCreateConstState(id);
  els.chunkList.innerHTML = "";
  for (let i = 1; i <= manifest.n_chunks; i++) {
    const startM = ((i - 1) * manifest.chunk_size) / 1_000_000;
    const endM = (i * manifest.chunk_size) / 1_000_000;

    const label = document.createElement("label");
    label.className = "chunk-item";
    label.dataset.chunk = i;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.chunk = i;
    checkbox.checked = cs.loadedChunks.has(i);
    checkbox.addEventListener("change", () => toggleChunkSingle(i, checkbox.checked));

    const text = document.createElement("span");
    text.textContent = `Block ${i} (${startM.toFixed(0)}\u2013${endM.toFixed(0)}M)`;

    const status = document.createElement("span");
    status.className = "chunk-status";
    status.dataset.statusFor = i;

    label.appendChild(checkbox);
    label.appendChild(text);
    label.appendChild(status);
    els.chunkList.appendChild(label);
  }
}

function setChunkChecked(n, checked) {
  const cb = els.chunkList.querySelector(`input[data-chunk="${n}"]`);
  if (cb) cb.checked = checked;
}

async function toggleChunkSingle(n, checked) {
  const cs = getOrCreateConstState(state.currentConstant);
  if (checked) await ensureChunk(state.currentConstant, n);
  else cs.loadedChunks.delete(n);
  renderSingle();
}

async function loadAllChunksSingle() {
  const id = state.currentConstant;
  const cs = getOrCreateConstState(id);
  for (let i = 1; i <= cs.manifest.n_chunks; i++) {
    setChunkChecked(i, true);
    await ensureChunk(id, i);
  }
  renderSingle();
}

function clearAllChunksSingle() {
  const id = state.currentConstant;
  const cs = getOrCreateConstState(id);
  cs.loadedChunks.clear();
  for (let i = 1; i <= cs.manifest.n_chunks; i++) setChunkChecked(i, false);
  renderSingle();
}

// ---------- vista singola: rendering ----------

function renderSingle(highlight = null) {
  const cs = getOrCreateConstState(state.currentConstant);
  const loadedNums = Array.from(cs.loadedChunks.keys()).sort((a, b) => a - b);

  if (loadedNums.length === 0) {
    els.digitDisplay.innerHTML = '<span class="loading">Select one or more blocks from the list on the left to see their digits.</span>';
    els.viewerLabel.textContent = "No block selected";
    return;
  }

  els.viewerLabel.textContent = `${loadedNums.length} block(s) loaded: ${loadedNums.join(", ")}`;

  let html = "";
  for (const n of loadedNums) {
    const digits = cs.loadedChunks.get(n);
    html += `<div class="chunk-block" data-chunk-block="${n}">`;
    html += `<div class="chunk-block-header">Block ${n}</div>`;

    if (highlight && highlight.chunk === n) {
      const before = digits.slice(0, highlight.localPos);
      const match = digits.slice(highlight.localPos, highlight.localPos + highlight.len);
      const after = digits.slice(highlight.localPos + highlight.len);
      html += escapeHtml(formatGroups(before)) +
        "<mark>" + escapeHtml(match) + "</mark>" +
        escapeHtml(formatGroups(after));
    } else {
      html += escapeHtml(formatGroups(digits));
    }
    html += `</div>`;
  }

  els.digitDisplay.innerHTML = html;

  if (highlight) {
    requestAnimationFrame(() => {
      const markEl = els.digitDisplay.querySelector("mark");
      if (markEl) markEl.scrollIntoView({ block: "center" });
    });
  }
}

async function jumpToPositionSingle(globalPos, patLen) {
  const id = state.currentConstant;
  const cs = getOrCreateConstState(id);
  const chunkSize = cs.manifest.chunk_size;
  const chunkNum = Math.floor(globalPos / chunkSize) + 1;
  const localPos = globalPos - (chunkNum - 1) * chunkSize;

  setChunkChecked(chunkNum, true);
  await ensureChunk(id, chunkNum);
  renderSingle({ chunk: chunkNum, localPos, len: patLen });
}

// ---------- vista congiunta ----------

function toggleMode() {
  state.mode = state.mode === "single" ? "joint" : "single";
  updateModeUI();
  updateActiveTab();
}

function updateModeUI() {
  const isJoint = state.mode === "joint";
  els.sidebarSingle.style.display = isJoint ? "none" : "block";
  els.singleViewPanel.style.display = isJoint ? "none" : "block";
  els.jointViewPanel.style.display = isJoint ? "block" : "none";
  els.viewToggleBtn.textContent = isJoint ? "Single view" : "Joint view";
  els.viewToggleBtn.classList.toggle("active", isJoint);
  els.searchTitle.textContent = isJoint ? "Search across all constants" : "Search for a pattern";
  els.searchHint.textContent = isJoint
    ? "Search the same pattern across every constant at once: results are color-coded by constant."
    : "Searches ALL precomputed digits, even the ones not currently loaded on screen.";
  els.results.innerHTML = "";
  els.searchStatus.textContent = "";

  if (isJoint) buildJointColumns();
}

async function buildJointColumns() {
  els.jointColumns.innerHTML = "";

  for (const c of state.constants) {
    const col = document.createElement("div");
    col.className = "joint-column";
    col.style.setProperty("--col-color", colorFor(c.id));
    col.dataset.constant = c.id;

    const header = document.createElement("div");
    header.className = "joint-column-header";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `${c.symbol} ${c.label}`;
    header.appendChild(label);

    const select = document.createElement("select");
    select.dataset.constant = c.id;
    header.appendChild(select);

    col.appendChild(header);

    const display = document.createElement("div");
    display.className = "joint-digit-display";
    display.dataset.constant = c.id;
    display.innerHTML = '<span class="loading">Loading\u2026</span>';
    col.appendChild(display);

    els.jointColumns.appendChild(col);

    const m = await ensureManifest(c.id);
    for (let i = 1; i <= m.n_chunks; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      const startM = ((i - 1) * m.chunk_size) / 1_000_000;
      const endM = (i * m.chunk_size) / 1_000_000;
      opt.textContent = `Block ${i} (${startM.toFixed(0)}\u2013${endM.toFixed(0)}M)`;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => loadJointColumnChunk(c.id, parseInt(select.value, 10)));

    const cs = getOrCreateConstState(c.id);
    const firstLoaded = cs.loadedChunks.size > 0 ? Math.min(...cs.loadedChunks.keys()) : 1;
    select.value = firstLoaded;
    await loadJointColumnChunk(c.id, firstLoaded);
  }
}

async function loadJointColumnChunk(constantId, n, highlightLocalPos = null, patLen = 0) {
  const digits = await ensureChunk(constantId, n);
  const display = els.jointColumns.querySelector(`.joint-digit-display[data-constant="${constantId}"]`);
  if (!display) return;

  if (highlightLocalPos !== null) {
    const before = digits.slice(0, highlightLocalPos);
    const match = digits.slice(highlightLocalPos, highlightLocalPos + patLen);
    const after = digits.slice(highlightLocalPos + patLen);
    display.innerHTML = escapeHtml(formatGroups(before)) +
      "<mark>" + escapeHtml(match) + "</mark>" +
      escapeHtml(formatGroups(after));
    requestAnimationFrame(() => {
      const markEl = display.querySelector("mark");
      if (markEl) markEl.scrollIntoView({ block: "center" });
    });
  } else {
    display.textContent = formatGroups(digits);
  }
}

async function jumpToPositionJoint(constantId, globalPos, patLen) {
  const cs = getOrCreateConstState(constantId);
  const chunkSize = cs.manifest.chunk_size;
  const chunkNum = Math.floor(globalPos / chunkSize) + 1;
  const localPos = globalPos - (chunkNum - 1) * chunkSize;

  const select = els.jointColumns.querySelector(`select[data-constant="${constantId}"]`);
  if (select) select.value = chunkNum;
  await loadJointColumnChunk(constantId, chunkNum, localPos, patLen);
}

// ---------- ricerca ----------

async function runSearch() {
  const pattern = els.searchInput.value.trim();
  if (!/^\d+$/.test(pattern)) {
    els.searchStatus.textContent = "Enter digits only (0-9).";
    return;
  }
  els.searchStatus.textContent = "Searching\u2026";
  els.results.innerHTML = "";

  if (state.mode === "single") await runSearchSingle(pattern);
  else await runSearchJoint(pattern);
}

async function runSearchSingle(pattern) {
  const id = state.currentConstant;
  const data = await staticSearch(id, pattern, 50);

  const cs = getOrCreateConstState(id);
  if (data.count_returned === 0) {
    els.searchStatus.textContent = `No occurrence of "${pattern}" found among the ${cs.manifest.total_digits.toLocaleString("en-US")} precomputed decimal digits.`;
    return;
  }

  els.searchStatus.textContent =
    `${data.count_returned} occurrence(s) shown` +
    (data.truncated ? " (there are more, refine your search)" : "") + ":";

  els.results.innerHTML = "";
  data.results.forEach((r) => {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `position <b>${r.position.toLocaleString("en-US")}</b> (after the decimal point)`;
    div.addEventListener("click", () => jumpToPositionSingle(r.position, pattern.length));
    els.results.appendChild(div);
  });
}

async function runSearchJoint(pattern) {
  const outcomes = await Promise.all(state.constants.map(async (c) => {
    const data = await staticSearch(c.id, pattern, 20);
    return { constant: c, data };
  }));

  els.results.innerHTML = "";
  let totalFound = 0;
  const summaryParts = [];

  outcomes.forEach(({ constant, data }) => {
    const color = colorFor(constant.id);

    totalFound += data.count_returned;
    const countLabel = data.count_returned + (data.truncated ? "+" : "");
    summaryParts.push(`<span style="color:${color}">${constant.symbol} ${countLabel}</span>`);

    const groupHeader = document.createElement("div");
    groupHeader.className = "result-group-header";
    groupHeader.style.setProperty("--col-color", color);
    groupHeader.innerHTML = `<span class="const-tag" style="color:${color}">${constant.symbol} ${constant.label}</span> \u2014 ${data.count_returned} occurrence(s)` +
      (data.truncated ? " (there are more)" : "");
    els.results.appendChild(groupHeader);

    if (data.count_returned === 0) {
      const div = document.createElement("div");
      div.className = "result-item joint";
      div.style.setProperty("--col-color", color);
      div.textContent = "no occurrences";
      els.results.appendChild(div);
      return;
    }

    data.results.forEach((r) => {
      const div = document.createElement("div");
      div.className = "result-item joint";
      div.style.setProperty("--col-color", color);
      div.innerHTML = `position <b>${r.position.toLocaleString("en-US")}</b>`;
      div.addEventListener("click", () => jumpToPositionJoint(constant.id, r.position, pattern.length));
      els.results.appendChild(div);
    });
  });

  els.searchStatus.innerHTML = totalFound > 0
    ? `Found per constant: ${summaryParts.join(" &middot; ")}. Click a result to see it in the corresponding column.`
    : `No occurrence of "${pattern}" found in any constant (${summaryParts.join(" &middot; ")}).`;
}

els.viewToggleBtn.addEventListener("click", toggleMode);
els.loadAllBtn.addEventListener("click", loadAllChunksSingle);
els.clearAllBtn.addEventListener("click", clearAllChunksSingle);
els.searchBtn.addEventListener("click", runSearch);
els.searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });

loadConstants();
