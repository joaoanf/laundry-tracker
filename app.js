/* =====================================================
   Service Worker (Offline Support)
===================================================== */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(reg => {
    if (reg.installing) {
      console.log("Installing service worker...");
    } else if (reg.active) {
      console.log("App ready for offline use");
    }
  });
}

/* =====================================================
   Constants & Utilities
===================================================== */

const STORAGE_KEY = "laundryData";

/**
 * Format ISO date (YYYY-MM-DD) into display format (DD-MM-YYYY)
 */
function formatDateDisplay(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

/* =====================================================
   Storage Handling
===================================================== */

/**
 * Load app data from localStorage or return defaults
 */
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  return {
    items: [
      { name: "Lençóis", lastWashed: null },
      { name: "Toalha de Banho", lastWashed: null },
      { name: "Toalha de mesa", lastWashed: null },
      { name: "Pijama azul", lastWashed: null }
    ],
    washHistory: []
  };
}

/**
 * Persist app data to localStorage
 */
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// App state
let data = loadData();

// to export backup file
function exportBackup() {
  const backupData = JSON.stringify(data, null, 2);
  const backupPayload = {version: 1, exportedAt: new Date().toISOString(),data};

  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split("T")[0];
  const filename = `laundry-backup-${date}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

// to import backup file
function importBackup(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);

      // Validate backup structure
      if (
        !payload ||
        payload.version !== 1 ||
        !payload.data ||
        !Array.isArray(payload.data.items) ||
        !Array.isArray(payload.data.washHistory)
      ) {
        alert("Ficheiro inválido. Estrutura de backup incorreta.");
        return;
      }

      if (!confirm("Isto vai substituir todos os dados atuais. Continuar?")) {
        return;
      }

      // Restore data
      data = payload.data;

      updateItemsLastWashed();
      saveData();
      renderItems();

      alert("Backup restaurado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao ler o ficheiro de backup.");
    }
  };

  reader.readAsText(file);
}


/* =====================================================
   DOM Elements
===================================================== */

const list = document.getElementById("itemList");
const newWashBtn = document.getElementById("newWashBtn");
const modal = document.getElementById("washModal");
const checklist = document.getElementById("checklist");
const cancelBtn = document.getElementById("cancelWash");
const saveBtn = document.getElementById("saveWash");
const washDateInput = document.getElementById("washDate");

const addInput = document.getElementById("newItemInput");
const addBtn = document.getElementById("addItemBtn");

const openHistoryBtn = document.getElementById("openHistoryBtn");
const historyModal = document.getElementById("historyModal");
const historyList = document.getElementById("historyList");
const closeHistoryBtn = document.getElementById("closeHistory");

const exportDataBtn = document.getElementById("exportDataBtn");
const importDataBtn = document.getElementById("importDataBtn");
const importFileInput = document.getElementById("importFileInput");


/* =====================================================
   Rendering
===================================================== */

/**
 * Render the main laundry item list
 */
function renderItems() {
  list.innerHTML = "";

  const sortedItems = [...data.items].sort((a, b) =>
    a.name.localeCompare(b.name, "pt", { sensitivity: "base" })
  );

  sortedItems.forEach(item => {
    const index = data.items.indexOf(item);
    const li = document.createElement("li");

    // Item text
    const textSpan = document.createElement("span");
    textSpan.textContent = item.name;
    li.appendChild(textSpan);

    // Wash date info (below, grey)
    const dateSpan = document.createElement("div");
    dateSpan.style.fontSize = "0.9em";
    dateSpan.style.color = "#999";
    if (item.lastWashed) {
      dateSpan.textContent = `Lavado a ${item.lastWashed}`;
    } else {
      dateSpan.textContent = "Nunca lavado";
    }
    li.appendChild(dateSpan);

    // --- Edit Button ---
    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.classList.add("editBtn");
    editBtn.addEventListener("click", () => {
      const oldName = item.name;
      const newName = prompt("Inserir novo nome:", oldName);
      if (newName && newName.trim()) {
        const trimmed = newName.trim();

        if (trimmed.length > 40) {
          alert("Nome demasiado longo. Máximo 40 caracteres.");
          return;
        }

        // Prevent duplicate names (case-insensitive) except for the current item
        const duplicate = data.items.some((it, i) => i !== index && it.name.toLowerCase() === trimmed.toLowerCase());
        if (duplicate) {
          alert("Já existe um item com esse nome.");
          return;
        }

        // Update item name
        data.items[index].name = trimmed;

        // Update wash history entries that referenced the old name
        data.washHistory.forEach(ev => {
          ev.items = ev.items.map(n => (n === oldName ? trimmed : n));
        });

        updateItemsLastWashed();
        saveData();
        renderItems();
      }
    });

    // --- Delete Button ---
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Apagar";
    deleteBtn.classList.add("deleteBtn");
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Apagar "${item.name}"?`)) {
        data.items.splice(index, 1);
        saveData();
        renderItems();
      }
    });

    // Button wrapper
    const buttonWrapper = document.createElement("div");
    buttonWrapper.style.display = "flex";
    buttonWrapper.style.gap = "5px";

    buttonWrapper.appendChild(editBtn);
    buttonWrapper.appendChild(deleteBtn);
    li.appendChild(buttonWrapper);

    list.appendChild(li);
  });
}

/* =====================================================
   History Modal
===================================================== */

/**
 * Open and render wash history modal
 */
openHistoryBtn.addEventListener("click", () => {
  historyList.innerHTML = "";

  if (data.washHistory.length === 0) {
    historyList.textContent = "Ainda sem lavagens.";
  } else {
    [...data.washHistory]
      .sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
      .forEach(event => {
        const card = document.createElement("div");
        card.classList.add("historyCard");

        // Date
        const dateHeading = document.createElement("h4");
        dateHeading.textContent = formatDateDisplay(event.date);
        card.appendChild(dateHeading);

        // Items
        const itemsPara = document.createElement("p");
        itemsPara.textContent = event.items.join(", ");
        card.appendChild(itemsPara);

        // --- Edit Button ---
        const editEventBtn = document.createElement("button");
        editEventBtn.textContent = "Editar";
        editEventBtn.addEventListener("click", () => {
          openEditWashModal(event);
        });

        // --- Delete Button ---
        const deleteEventBtn = document.createElement("button");
        deleteEventBtn.textContent = "Apagar";
        deleteEventBtn.classList.add("deleteEventBtn");
        deleteEventBtn.addEventListener("click", () => {
          if (confirm(`Apagar a lavagem de ${event.date}?`)) {
            const index = data.washHistory.indexOf(event);
            if (index > -1) data.washHistory.splice(index, 1);

            updateItemsLastWashed();
            saveData();
            renderItems();
            openHistoryBtn.click();
          }
        });

        // Button wrapper
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.display = "flex";
        buttonWrapper.style.gap = "5px";
        buttonWrapper.style.marginTop = "10px";

        buttonWrapper.appendChild(editEventBtn);
        buttonWrapper.appendChild(deleteEventBtn);
        card.appendChild(buttonWrapper);

        historyList.appendChild(card);
      });
  }

  historyModal.classList.remove("hidden");
});

// Close history modal
closeHistoryBtn.addEventListener("click", () => {
  historyModal.classList.add("hidden");
});

/* =====================================================
   Data Logic
===================================================== */

/**
 * Recalculate last washed date for all items
 * Uses true chronological order (not array order)
 */
function updateItemsLastWashed() {
  // Reset
  data.items.forEach(item => {
    item.lastWashed = null;
  });

  // Oldest → Newest so newest wins
  const sortedEvents = [...data.washHistory].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  sortedEvents.forEach(event => {
    event.items.forEach(itemName => {
      const item = data.items.find(i => i.name === itemName);
      if (item) {
        item.lastWashed = formatDateDisplay(event.date);
      }
    });
  });
}

/* =====================================================
   Wash Modal
===================================================== */

/**
 * Open modal for creating a new wash
 */
function openNewWashModal() {
  checklist.innerHTML = "";

  // Default date = today
  washDateInput.value = new Date().toISOString().split("T")[0];

  // Alphabetical item list
  const sortedItems = [...data.items].sort((a, b) =>
    a.name.localeCompare(b.name, "pt", { sensitivity: "base" })
  );

  sortedItems.forEach(item => {
    const row = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.name = item.name;

    const label = document.createElement("label");
    label.textContent = " " + item.name;

    row.appendChild(checkbox);
    row.appendChild(label);
    checklist.appendChild(row);
  });

  modal.classList.remove("hidden");

  const saveHandler = () => {
    const selectedDate = washDateInput.value;
    const washedItems = [];

    checklist.querySelectorAll("input").forEach(box => {
      if (box.checked) washedItems.push(box.dataset.name);
    });

    if (washedItems.length && selectedDate) {
      data.washHistory.push({
        date: selectedDate,
        items: washedItems
      });

      updateItemsLastWashed();
      saveData();
      renderItems();
    }

    saveBtn.removeEventListener("click", saveHandler);
    closeModal();
  };

  saveBtn.addEventListener("click", saveHandler);
}

/**
 * Open modal for editing an existing wash
 */
function openEditWashModal(eventToEdit) {
  checklist.innerHTML = "";
  washDateInput.value = eventToEdit.date;

  const sortedItems = [...data.items].sort((a, b) =>
    a.name.localeCompare(b.name, "pt", { sensitivity: "base" })
  );

  sortedItems.forEach(item => {
    const row = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.name = item.name;
    checkbox.checked = eventToEdit.items.includes(item.name);

    const label = document.createElement("label");
    label.textContent = " " + item.name;

    row.appendChild(checkbox);
    row.appendChild(label);
    checklist.appendChild(row);
  });

  modal.classList.remove("hidden");

  const saveHandler = () => {
    const checkedItems = [];

    checklist.querySelectorAll("input").forEach(box => {
      if (box.checked) checkedItems.push(box.dataset.name);
    });

    eventToEdit.date = washDateInput.value;
    eventToEdit.items = checkedItems;

    updateItemsLastWashed();
    saveData();
    renderItems();
    openHistoryBtn.click();

    saveBtn.removeEventListener("click", saveHandler);
    closeModal();
  };

  saveBtn.addEventListener("click", saveHandler);
}

/**
 * Close wash modal
 */
function closeModal() {
  modal.classList.add("hidden");
}

/* =====================================================
   Add Item
===================================================== */

addBtn.addEventListener("click", () => {
  const name = addInput.value.trim();
  if (!name) return;

  if (name.length > 40) {
    alert("Nome demasiado longo. Máximo 40 caracteres.");
    return;
  }

  if (data.items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
    alert("Esse item já existe.");
    return;
  }

  data.items.push({ name, lastWashed: null });
  saveData();
  renderItems();
  addInput.value = "";
});

// Enter key support
addInput.addEventListener("keypress", e => {
  if (e.key === "Enter") addBtn.click();
});

/* =====================================================
   Event Bindings
===================================================== */

newWashBtn.addEventListener("click", openNewWashModal);
cancelBtn.addEventListener("click", closeModal);

exportDataBtn.addEventListener("click", exportBackup);

importDataBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) importBackup(file);
  importFileInput.value = ""; // Allow re-importing same file
});


/* =====================================================
   Init
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  renderItems();
  updateItemsLastWashed();
});
