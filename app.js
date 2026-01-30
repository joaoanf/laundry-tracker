if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(reg => {
    if (reg.installing) {
      console.log("Installing service worker...");
    } else if (reg.active) {
      console.log("App ready for offline use");
    }
  });
}

const STORAGE_KEY = "laundryData";

// Load saved data or create default
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

// Save data
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

// Elements
const list = document.getElementById("itemList");
const button = document.getElementById("newWashBtn");
const modal = document.getElementById("washModal");
const checklist = document.getElementById("checklist");
const cancelBtn = document.getElementById("cancelWash");
const saveBtn = document.getElementById("saveWash");
const addInput = document.getElementById("newItemInput");
const addBtn = document.getElementById("addItemBtn");
const openHistoryBtn = document.getElementById("openHistoryBtn");
const historyModal = document.getElementById("historyModal");
const historyList = document.getElementById("historyList");
const closeHistoryBtn = document.getElementById("closeHistory");

// Open history modal
openHistoryBtn.addEventListener("click", () => {
  historyList.innerHTML = "";

  if (data.washHistory.length === 0) {
    historyList.textContent = "No wash events yet.";
  } else {
    // Show events in reverse chronological order
    data.washHistory.slice().reverse().forEach((event, reverseIndex) => {
        const card = document.createElement("div");
        card.classList.add("historyCard");

        // Show date/time
        const dateHeading = document.createElement("h4");
        dateHeading.textContent = event.date;
        card.appendChild(dateHeading);

        // Show items
        const itemsPara = document.createElement("p");
        itemsPara.textContent = event.items.join(", ");
        card.appendChild(itemsPara);

        // --- Edit Button ---
        const editEventBtn = document.createElement("button");
        editEventBtn.textContent = "Editar";
        editEventBtn.addEventListener("click", () => {
            openEditWashModal(event, reverseIndex);
        });

        // --- Delete Button for History Event ---
        const deleteEventBtn = document.createElement("button");
        deleteEventBtn.textContent = "Apagar";
        deleteEventBtn.classList.add("deleteEventBtn");
        deleteEventBtn.addEventListener("click", () => {
            if (confirm(`Apagar a lavagem de ${event.date}?`)) {
                const originalIndex = data.washHistory.indexOf(event);
                if (originalIndex > -1) data.washHistory.splice(originalIndex, 1);

                // Recompute lastWashed for items
                updateItemsLastWashed();

                saveData();
                renderItems();
                openHistoryBtn.click(); // refresh history modal
            }
        });

        // --- Create a wrapper for the buttons ---
        const buttonWrapper = document.createElement("div");
        buttonWrapper.style.display = "flex";    // Align horizontally
        buttonWrapper.style.gap = "5px";         // Small gap between buttons
        buttonWrapper.style.marginTop = "10px";  // Space from text

        // Append buttons into wrapper
        buttonWrapper.appendChild(editEventBtn);
        buttonWrapper.appendChild(deleteEventBtn);

        // Append wrapper to card
        card.appendChild(buttonWrapper);

        historyList.appendChild(card);
    });
  }

  historyModal.classList.remove("hidden");
});


// Close history
closeHistoryBtn.addEventListener("click", () => {
  historyModal.classList.add("hidden");
});


// Add new laundry item
addBtn.addEventListener("click", () => {
  const name = addInput.value.trim();
  if (name === "") return;

  // Add to data
  data.items.push({ name, lastWashed: null });

  saveData();
  renderItems();

  addInput.value = "";
});

// Also add the item if enter is pressed
addInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addBtn.click();
});

// Render main list
function renderItems() {
  list.innerHTML = "";

  data.items.forEach((item, index) => {
    const li = document.createElement("li");
    
    const textSpan = document.createElement("span");
    let text = item.name;
    if (item.lastWashed) {
      text += ` — Lavado a ${item.lastWashed}`;
    } else {
      text += " — Nunca lavado";
    }
    textSpan.textContent = text;
    li.appendChild(textSpan);

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.style.marginLeft = "10px";
    editBtn.addEventListener("click", () => {
      const newName = prompt("Inserir novo nome:", item.name);
      if (newName && newName.trim() !== "") {
        data.items[index].name = newName.trim();
        saveData();
        renderItems();
      }
    });

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Apagar";
    deleteBtn.style.marginLeft = "5px";
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Apagar "${item.name}"?`)) {
        data.items.splice(index, 1);
        saveData();
        renderItems();
      }
    });

    // Create a button wrapper
    const buttonWrapper = document.createElement("div");
    buttonWrapper.style.display = "flex";  // Align buttons horizontally
    buttonWrapper.style.gap = "5px";       // Small gap between Edit/Delete

    buttonWrapper.appendChild(editBtn);
    buttonWrapper.appendChild(deleteBtn);

    li.appendChild(buttonWrapper); // Append wrapper to li

    list.appendChild(li);
  });
}


// Build checklist
function openModal() {
  checklist.innerHTML = "";

  data.items.forEach((item, index) => {
    const row = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `item-${index}`;

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = " " + item.name;

    row.appendChild(checkbox);
    row.appendChild(label);
    checklist.appendChild(row);
  });

  modal.classList.remove("hidden");
}

// Close modal
function closeModal() {
  modal.classList.add("hidden");
}

// Events
button.addEventListener("click", openNewWashModal);
cancelBtn.addEventListener("click", closeModal);

function updateItemsLastWashed() {
  // Reset all lastWashed
  data.items.forEach(item => {
    item.lastWashed = null;
  });

  // Go through all events in chronological order
  data.washHistory.forEach(event => {
    event.items.forEach(itemName => {
      const item = data.items.find(i => i.name === itemName);
      if (item) {
        // Update lastWashed to the latest event date
        item.lastWashed = event.date;
      }
    });
  });
}


function openNewWashModal() {
  // Build checklist as usual
  checklist.innerHTML = "";

  data.items.forEach((item, index) => {
    const row = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `item-${index}`;

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = " " + item.name;

    row.appendChild(checkbox);
    row.appendChild(label);
    checklist.appendChild(row);
  });

  modal.classList.remove("hidden");

  // --- Attach a temporary save handler for new washes ---
  const saveHandler = () => {
    //const today = new Date().toLocaleString(); //with hours
    const today = new Date().toLocaleDateString(); //with hours
    const washedItems = [];
    const checkboxes = checklist.querySelectorAll("input");

    checkboxes.forEach((box, index) => {
      if (box.checked) {
        data.items[index].lastWashed = today;
        washedItems.push(data.items[index].name);
      }
    });

    if (washedItems.length > 0) {
      data.washHistory.push({
        date: today,
        items: washedItems
      });

      saveData();
      renderItems();
    }

    // Remove this listener so it doesn’t fire next time
    saveBtn.removeEventListener("click", saveHandler);
    closeModal();
  };

  saveBtn.addEventListener("click", saveHandler);
}


function openEditWashModal(eventToEdit, reverseIndex) {
  checklist.innerHTML = "";

  // Build checkboxes for all items
  data.items.forEach((item, index) => {
    const row = document.createElement("div");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `item-edit-${index}`;

    // Pre-check if this item was part of the event
    if (eventToEdit.items.includes(item.name)) {
      checkbox.checked = true;
    }

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = " " + item.name;

    row.appendChild(checkbox);
    row.appendChild(label);
    checklist.appendChild(row);
  });

  // Show modal
  modal.classList.remove("hidden");

  // Temporary save handler
    const saveHandler = () => {
        const checkedItems = [];
        const checkboxes = checklist.querySelectorAll("input");

        checkboxes.forEach((box, index) => {
            if (box.checked) {
            checkedItems.push(data.items[index].name);
            }
        });

        // Update only the event items
        eventToEdit.items = checkedItems;

        // --- Recompute lastWashed for all items ---
        updateItemsLastWashed();

        saveData();
        renderItems();
        openHistoryBtn.click(); // refresh history modal

        // Cleanup
        saveBtn.removeEventListener("click", saveHandler);
        closeModal();
    };


  saveBtn.addEventListener("click", saveHandler);
}



// Initial render
renderItems();
