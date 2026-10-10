"use strict";

// Retain the existing key and backup format to migrate v7–v9 data.
const STORAGE_KEY = "laundryData";
const $ = id => document.getElementById(id);
const nameKey = name => name.trim().normalize("NFC").toLocaleLowerCase("pt-PT");
function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const displayDate = iso => iso.split("-").reverse().join("-");
const dayNumber = iso => Date.parse(`${iso}T12:00:00Z`) / 86400000;
function validateData(value) {
  if (!value || !Array.isArray(value.items) || !Array.isArray(value.washHistory)) throw new Error("Estrutura dos dados inválida.");
  if (value.items.length > 5000 || value.washHistory.length > 50000) throw new Error("O backup tem demasiados registos.");
  const keys = new Set();
  const items = value.items.map(item => {
    if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 40) throw new Error("Nome de peça inválido (máximo 40 caracteres).");
    const name = item.name.trim();
    if (keys.has(nameKey(name))) throw new Error("Existem peças com nomes duplicados.");
    keys.add(nameKey(name));
    return { name, lastWashed: null };
  });
  const washHistory = value.washHistory.map(event => {
    if (!event || !validDate(event.date) || !Array.isArray(event.items) || !event.items.length || event.items.length > 5000 || event.items.some(name => typeof name !== "string" || !name.trim() || name.trim().length > 40)) throw new Error("Registo de lavagem inválido.");
    return { date: event.date, items: [...new Set(event.items.map(name => name.trim()))] };
  });
  return { items, washHistory };
}
function recalculate(value) {
  const dates = new Map();
  value.washHistory.forEach(event => event.items.forEach(name => {
    if (!dates.has(name) || event.date > dates.get(name)) dates.set(name, event.date);
  }));
  value.items.forEach(item => {
    const latest = dates.get(item.name);
    item.lastWashed = latest ? displayDate(latest) : null;
  });
  return value;
}
let storageHealthy = true;
let data;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  data = saved ? validateData(JSON.parse(saved)) : { items: ["Lençóis", "Toalha de Banho", "Toalha de mesa", "Pijama azul"].map(name => ({ name, lastWashed: null })), washHistory: [] };
} catch (error) {
  storageHealthy = false;
  data = { items: [], washHistory: [] };
  $("storageWarning").hidden = false;
  $("storageWarning").textContent = "Não foi possível ler os dados guardados. Os dados originais foram preservados. Podes exportá-los para recuperação ou importar um backup válido.";
}
recalculate(data);
function notify(message) { $("status").textContent = message; }
function reportSaveError(message) {
  notify(message);
  if ($("washModal").open) $("washError").textContent = message;
  if ($("itemModal").open) $("itemError").textContent = message;
}
// Commit to storage before replacing the displayed state, so failed writes lose no data.
function commit(change, message, recovery = false) {
  if (!storageHealthy && !recovery) { reportSaveError("Importa um backup válido antes de fazer alterações."); return false; }
  const next = JSON.parse(JSON.stringify(data));
  change(next);
  recalculate(next);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch (error) { reportSaveError("Não foi possível guardar. Verifica o espaço disponível ou as permissões do browser. A alteração não foi aplicada."); return false; }
  data = next;
  storageHealthy = true;
  $("storageWarning").hidden = true;
  renderItems();
  if ($("historyModal").open) renderHistory();
  notify(message);
  return true;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(text, handler, className = "") {
  const button = element("button", className, text);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}
function latestDate(item) { return item.lastWashed ? item.lastWashed.split("-").reverse().join("-") : ""; }
function renderItems() {
  const query = nameKey($("searchItems").value);
  const items = data.items.filter(item => nameKey(item.name).includes(query)).sort((a, b) => {
    if ($("sortItems").value === "oldest") {
      const difference = latestDate(a).localeCompare(latestDate(b));
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name, "pt", { sensitivity: "base" });
  });
  $("itemCount").textContent = `${data.items.length} peças`;
  $("newWashBtn").disabled = !data.items.length;
  $("itemList").replaceChildren();
  if (!items.length) $("itemList").append(element("li", "empty", data.items.length ? "Nenhuma peça corresponde à pesquisa." : "Adiciona a tua primeira peça para começar."));
  items.forEach(item => {
    const card = element("li", "card itemCard");
    const info = element("div", "itemInfo");
    info.append(element("p", "itemName", item.name), element("p", "dateInfo", item.lastWashed ? `Última lavagem: ${item.lastWashed}` : "Ainda sem lavagens"));
    if (item.lastWashed) {
      const days = Math.round(dayNumber(todayISO()) - dayNumber(latestDate(item)));
      info.append(element("p", "age", days < 0 ? "Data futura registada" : days === 0 ? "Lavada hoje" : days === 1 ? "Lavada ontem" : `Há ${days} dias`));
    }
    const buttons = element("div", "actions");
    buttons.append(action("Editar", () => openItem(item)), action("Apagar", () => {
      if (confirm(`Apagar “${item.name}”? O histórico de lavagens será mantido.`)) commit(next => { next.items = next.items.filter(piece => piece.name !== item.name); }, "Peça apagada. O histórico foi mantido.");
    }, "danger"));
    buttons.children[0].setAttribute("aria-label", `Editar ${item.name}`);
    buttons.children[1].setAttribute("aria-label", `Apagar ${item.name}`);
    card.append(info, buttons);
    $("itemList").append(card);
  });
}
function nameError(name, oldName) {
  if (!name || name.length > 40) return "Usa um nome entre 1 e 40 caracteres.";
  if (data.items.some(item => item.name !== oldName && nameKey(item.name) === nameKey(name))) return "Já existe uma peça com esse nome.";
  // Avoid assigning historical washes from a deleted piece to a different piece.
  if (name !== oldName && data.washHistory.some(event => event.items.some(item => item !== oldName && nameKey(item) === nameKey(name)))) return "Esse nome já existe no histórico. Escolhe outro nome para manter os registos separados.";
  return "";
}
$("addItemForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("newItemInput").value.trim();
  const error = nameError(name);
  if (error) { notify(error); return; }
  if (commit(next => next.items.push({ name, lastWashed: null }), "Peça adicionada.")) $("newItemInput").value = "";
});
let editingItem = null;
function openItem(item) {
  editingItem = item.name;
  $("editItemName").value = item.name;
  $("itemError").textContent = "";
  $("itemModal").showModal();
  $("editItemName").focus();
}
$("cancelItem").addEventListener("click", () => $("itemModal").close());
$("itemForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("editItemName").value.trim();
  const error = nameError(name, editingItem);
  if (error) { $("itemError").textContent = error; return; }
  if (commit(next => {
    next.items.find(item => item.name === editingItem).name = name;
    next.washHistory.forEach(wash => { wash.items = wash.items.map(piece => piece === editingItem ? name : piece); });
  }, "Nome atualizado, incluindo no histórico.")) $("itemModal").close();
});
let editingWash = null;
let returnToHistory = false;
let selected = new Set();
let washNames = [];
function openWash(wash = null) {
  editingWash = wash;
  returnToHistory = $("historyModal").open;
  if (returnToHistory) $("historyModal").close();
  selected = new Set(wash ? wash.items : []);
  washNames = [...new Set([...data.items.map(item => item.name), ...selected])].sort((a,b) => a.localeCompare(b, "pt"));
  $("washTitle").textContent = wash ? "Editar lavagem" : "Nova lavagem";
  $("washDate").value = wash ? wash.date : todayISO();
  $("washDate").max = todayISO();
  $("washSearch").value = "";
  $("washError").textContent = "";
  renderChecklist();
  $("washModal").showModal();
}
function visibleNames() { return washNames.filter(name => nameKey(name).includes(nameKey($("washSearch").value))); }
function renderChecklist() {
  $("checklist").replaceChildren();
  const visible = visibleNames();
  visible.forEach(name => {
    const label = element("label", "checkRow");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(name);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(name); else selected.delete(name);
      updateSelectionCount();
    });
    label.append(checkbox, element("span", "", name));
    $("checklist").append(label);
  });
  if (!visible.length) $("checklist").append(element("p", "empty", "Nenhuma peça encontrada."));
  updateSelectionCount();
}
function updateSelectionCount() {
  $("selectionCount").textContent = `${selected.size} ${selected.size === 1 ? "selecionada" : "selecionadas"}`;
  const visible = visibleNames();
  $("selectVisible").disabled = !visible.length;
  $("selectVisible").textContent = visible.length && visible.every(name => selected.has(name)) ? "Desmarcar visíveis" : "Selecionar visíveis";
}
$("selectVisible").addEventListener("click", () => {
  const visible = visibleNames();
  const allSelected = visible.every(name => selected.has(name));
  visible.forEach(name => allSelected ? selected.delete(name) : selected.add(name));
  renderChecklist();
});
// One permanent submit listener: cancelling/reopening never accumulates save handlers.
$("washForm").addEventListener("submit", event => {
  event.preventDefault();
  const date = $("washDate").value;
  if (!validDate(date) || date > todayISO() || !selected.size) { $("washError").textContent = "Escolhe uma data até hoje e pelo menos uma peça."; return; }
  const index = data.washHistory.indexOf(editingWash);
  if (commit(next => {
    const wash = { date, items: [...selected] };
    if (index < 0) next.washHistory.push(wash); else next.washHistory[index] = wash;
  }, index < 0 ? "Lavagem registada." : "Lavagem atualizada.")) $("washModal").close();
});
$("cancelWash").addEventListener("click", () => $("washModal").close());
$("washModal").addEventListener("close", () => {
  editingWash = null;
  selected.clear();
  if (returnToHistory) { renderHistory(); $("historyModal").showModal(); }
  returnToHistory = false;
});
function renderHistory() {
  $("historyList").replaceChildren();
  $("historyCount").textContent = `${data.washHistory.length} lavagens registadas`;
  if (!data.washHistory.length) $("historyList").append(element("p", "empty", "Ainda sem lavagens. Regista a primeira!"));
  [...data.washHistory].sort((a,b) => b.date.localeCompare(a.date)).forEach(wash => {
    const card = element("article", "card");
    card.append(element("h3", "", displayDate(wash.date)), element("p", "historyItems", wash.items.join(", ")));
    const buttons = element("div", "actions");
    buttons.append(action("Editar", () => openWash(wash)), action("Apagar", () => {
      if (confirm(`Apagar a lavagem de ${displayDate(wash.date)}?`)) {
        const index = data.washHistory.indexOf(wash);
        commit(next => next.washHistory.splice(index, 1), "Lavagem apagada.");
      }
    }, "danger"));
    card.append(buttons);
    $("historyList").append(card);
  });
}
$("newWashBtn").addEventListener("click", () => openWash());
$("openHistoryBtn").addEventListener("click", () => { renderHistory(); $("historyModal").showModal(); });
$("closeHistory").addEventListener("click", () => $("historyModal").close());
$("searchItems").addEventListener("input", renderItems);
$("sortItems").addEventListener("change", renderItems);
$("washSearch").addEventListener("input", renderChecklist);
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("exportDataBtn").addEventListener("click", () => {
  try {
    if (!storageHealthy) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { notify("Não existem dados acessíveis para exportar."); return; }
      download(raw, `laundry-recovery-${todayISO()}.json`);
    } else download(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2), `laundry-backup-${todayISO()}.json`);
    notify("Backup preparado para guardar. Conserva o ficheiro num local seguro.");
  } catch (error) { notify("Não foi possível exportar os dados neste browser."); }
});
$("importDataBtn").addEventListener("click", () => $("importFileInput").click());
$("importFileInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("O ficheiro deve ter no máximo 10 MB.");
    const payload = JSON.parse(await file.text());
    if (!payload || payload.version !== 1) throw new Error("Formato de backup desconhecido.");
    const restored = validateData(payload.data);
    if (!confirm(`Importar ${restored.items.length} peças e ${restored.washHistory.length} lavagens? Isto substitui os dados atuais. Exporta primeiro um backup se os quiseres conservar.`)) return;
    commit(next => { next.items = restored.items; next.washHistory = restored.washHistory; }, "Backup restaurado com sucesso.", true);
  } catch (error) { notify(`Backup não importado. ${error instanceof SyntaxError ? "O ficheiro não contém JSON válido." : error.message}`); }
});
renderItems();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    notify("A aplicação funciona, mas não foi possível ativar o modo offline.");
  });
}
