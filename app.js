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

/* =====================================================
   Rendering
===================================================== */

/**
 * Render the main laundry item list
 */
function renderItems() {
  list.innerHTML = "";

  data.items.forEach((item, index) => {
    const li = document.createElement("li");

    // Item text
    const textSpan = document.createElement("span");
    let text = item.name;

    if (item.lastWashed) {
      text += ` — Lavado a ${item.lastWashed}`;
    } else {
      text += " — Nunca lavado";
    }

    textSpan.textContent = text;
    li.appendChild(textSpan);

    // --- Edit Button ---
    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => {
      const newName = prompt("Inserir novo nome:", item.name);
      if (newName && newName.trim()) {
        data.items[index].name = newName.trim();
        saveData();
        renderItems();
      }
    });

    // --- Delete Button ---
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Apagar";
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

/* =====================================================
   Init
===================================================== */

renderItems();
