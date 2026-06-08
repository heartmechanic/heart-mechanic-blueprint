const STORAGE_KEY = "heart-mechanic-blueprint-v1";

const zones = [
  {
    id: "inner",
    title: "Inner Sanctum",
    group: "Kingdom",
    description: "The closest, safest, most trusted people."
  },
  {
    id: "knights",
    title: "Knights of the Realm",
    group: "Kingdom",
    description: "Active supporters, allies and meaningful relationships."
  },
  {
    id: "noble",
    title: "Noble Rank",
    group: "Kingdom",
    description: "Respected people with significance, history or wisdom, but not daily access."
  },
  {
    id: "fading",
    title: "Nobles Fading",
    group: "Kingdom",
    description: "Relationships that once mattered but are losing alignment or energy."
  },
  {
    id: "hold",
    title: "The Hold",
    group: "Hold",
    description: "Unclear, unresolved or emotionally complicated relationships."
  },
  {
    id: "exile",
    title: "Exile",
    group: "Outside",
    description: "People who require strong distance, no access or deep boundaries."
  }
];

const sampleContacts = [
  {
    name: "Amara Stone",
    relationship: "Friend",
    lastInteraction: "2026-05-30",
    notes: "Always leaves me feeling steadier, clearer and more myself."
  },
  {
    name: "Julian Vale",
    relationship: "Colleague",
    lastInteraction: "2026-05-21",
    notes: "Kind and capable, but access should probably stay work-shaped."
  },
  {
    name: "Maya Chen",
    relationship: "Family",
    lastInteraction: "2026-04-18",
    notes: "There is love here, but also a pattern of walking on eggshells."
  },
  {
    name: "Theo Marlow",
    relationship: "Mentor",
    lastInteraction: "2026-06-02",
    notes: "Rare wisdom, calm presence and no pressure to perform."
  },
  {
    name: "Noah Reed",
    relationship: "Former relationship",
    lastInteraction: "2025-12-12",
    notes: "Still emotionally loud. Distance feels healthy."
  },
  {
    name: "Priya Shah",
    relationship: "Community",
    lastInteraction: "2026-05-10",
    notes: "Warm, sincere and promising, but still new."
  },
  {
    name: "Daniel Cross",
    relationship: "Friend",
    lastInteraction: "2026-03-27",
    notes: "History matters, but the present-day connection feels thin."
  },
  {
    name: "Elena Brooks",
    relationship: "Partner",
    lastInteraction: "2026-06-07",
    notes: "Safe, reciprocal and deeply regulating."
  }
];

const prompts = [
  "How do I feel after interacting with this person?",
  "Do I feel safe, seen and respected?",
  "Is this relationship reciprocal?",
  "Does this person energise me or drain me?",
  "What boundary, if any, is needed here?",
  "Does their current placement reflect reality or history?"
];

let state = loadState();
let activeContactId = null;
let editingContactId = null;
let dragStart = null;
let zoneDrag = null;
let suppressZoneClick = false;
let pendingImport = [];

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll("[data-route]");
const contactForm = document.querySelector("#contact-form");
const swipeCard = document.querySelector("#swipe-card");
const zoneDialog = document.querySelector("#zone-dialog");
const profileDialog = document.querySelector("#profile-dialog");
const importPreviewDialog = document.querySelector("#import-preview-dialog");

function makeId() {
  return `c_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Could not load saved state", error);
    }
  }

  return {
    contacts: [],
    activity: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarMarkup(contact, className = "avatar") {
  if (contact.photo) {
    return `<div class="${className}" style="background-image: url('${escapeAttribute(contact.photo)}'); background-size: cover; background-position: center;" aria-label="${escapeAttribute(contact.name)}"></div>`;
  }
  return `<div class="${className}">${initials(contact.name)}</div>`;
}

function formatDate(value) {
  if (!value) return "No date recorded";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function zoneById(id) {
  return zones.find((zone) => zone.id === id);
}

function contactById(id) {
  return state.contacts.find((contact) => contact.id === id);
}

function normalizeContact(contact) {
  const firstName = (contact.firstName || "").trim();
  const lastName = (contact.lastName || "").trim();
  const fullName = (contact.name || [firstName, lastName].filter(Boolean).join(" ")).trim() || "Unnamed Contact";
  return {
    id: contact.id || makeId(),
    name: fullName,
    firstName,
    lastName,
    phone: (contact.phone || "").trim(),
    email: (contact.email || "").trim(),
    organisation: (contact.organisation || contact.organization || "").trim(),
    photo: contact.photo || "",
    relationship: contact.relationship || "Imported contact",
    lastInteraction: contact.lastInteraction || "",
    notes: contact.notes || "",
    zone: contact.zone || null,
    reviewed: Boolean(contact.reviewed),
    reflections: contact.reflections || {}
  };
}

function contactSignature(contact) {
  const normalized = normalizeContact(contact);
  const email = normalized.email.toLowerCase();
  const phone = normalized.phone.replace(/\D/g, "");
  const name = normalized.name.toLowerCase().replace(/\s+/g, " ").trim();
  return email || phone || name;
}

function uniqueIncomingContacts(contacts) {
  const existing = new Set(state.contacts.map(contactSignature));
  const seen = new Set();
  return contacts.map(normalizeContact).filter((contact) => {
    const signature = contactSignature(contact);
    if (signature && (existing.has(signature) || seen.has(signature))) return false;
    if (signature) seen.add(signature);
    return true;
  });
}

function addActivity(contact, zoneId, verb = "moved to") {
  const zone = zoneById(zoneId);
  state.activity.unshift({
    id: makeId(),
    contactName: contact.name,
    text: `${contact.name} ${verb} ${zone ? zone.title : "Unsorted"}.`,
    timestamp: new Date().toISOString()
  });
  state.activity = state.activity.slice(0, 12);
}

function loadSamples() {
  const incoming = uniqueIncomingContacts(sampleContacts);
  state.contacts.push(...incoming);
  saveAndRender();
  setRoute("sort");
}

function saveAndRender() {
  saveState();
  renderAll();
}

function setRoute(route) {
  views.forEach((view) => view.classList.toggle("active", view.id === route));
  document.querySelectorAll(".nav-pills button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  if (route === "sort") renderSwipeCard();
}

function unsortedContacts() {
  return state.contacts.filter((contact) => !contact.reviewed);
}

function kingdomContacts() {
  return state.contacts.filter((contact) => ["inner", "knights", "noble", "fading"].includes(contact.zone));
}

function holdContacts() {
  return state.contacts.filter((contact) => contact.zone === "hold");
}

function outsideContacts() {
  return state.contacts.filter((contact) => contact.zone === "exile");
}

function renderStats() {
  document.querySelector("#stat-total").textContent = state.contacts.length;
  document.querySelector("#stat-unsorted").textContent = unsortedContacts().length;
  document.querySelector("#inside-count").textContent = kingdomContacts().length;
  document.querySelector("#hold-count").textContent = holdContacts().length;
  document.querySelector("#outside-count").textContent = outsideContacts().length;
}

function renderContactsList() {
  const list = document.querySelector("#contacts-list");
  if (!state.contacts.length) {
    list.innerHTML = `<div class="empty-zone">No contacts yet. Add someone manually or load the demo set.</div>`;
    return;
  }

  list.innerHTML = state.contacts
    .map((contact) => {
      const zone = zoneById(contact.zone);
      return `
        <article class="person-tile">
          ${avatarMarkup(contact)}
          <div class="person-main">
            <strong>${escapeHtml(contact.name)}</strong>
            <span>${escapeHtml(contact.relationship)} · ${zone ? zone.title : "Unsorted"}</span>
          </div>
          <div class="contact-actions">
            <button type="button" data-profile="${contact.id}">View</button>
            <button type="button" data-edit="${contact.id}">Edit</button>
            <button type="button" data-delete="${contact.id}">Del</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSwipeCard() {
  const [contact] = unsortedContacts();
  if (!contact) {
    activeContactId = null;
    swipeCard.className = "swipe-card empty";
    swipeCard.innerHTML = `
      <div>
        <p class="eyebrow">Mapping complete for now</p>
        <h3>No unsorted contacts remain.</h3>
        <p class="card-prompt">Add more people or review your Visual Kingdom Map.</p>
        <button class="primary-action" data-route="map">Open Kingdom Map</button>
      </div>
    `;
    return;
  }

  activeContactId = contact.id;
  swipeCard.className = "swipe-card";
  swipeCard.style.transform = "";
  swipeCard.style.opacity = "";
  swipeCard.innerHTML = `
    ${avatarMarkup(contact, "card-avatar")}
    <p class="eyebrow">Now reviewing</p>
    <h3>${escapeHtml(contact.name)}</h3>
    <div class="card-meta">
      <span>${escapeHtml(contact.relationship)}</span>
      <span>Last interaction: ${formatDate(contact.lastInteraction)}</span>
    </div>
    <div class="card-notes">${escapeHtml(contact.notes || "No notes yet.")}</div>
    <p class="card-prompt">Ask: does this relationship deserve access, distance, or deeper reflection?</p>
  `;
}

function decideContact(decision) {
  const contact = contactById(activeContactId);
  if (!contact) return;

  if (decision === "outside") {
    placeContact(contact.id, "exile", "placed outside in");
    animateDecision("left");
    return;
  }

  if (decision === "hold") {
    placeContact(contact.id, "hold", "placed in");
    animateDecision("up");
    return;
  }

  openZoneDialog(contact.id);
}

function animateDecision(direction) {
  const transforms = {
    left: "translateX(-120%) rotate(-8deg)",
    right: "translateX(120%) rotate(8deg)",
    up: "translateY(-120%) scale(0.94)"
  };
  swipeCard.style.transform = transforms[direction] || transforms.right;
  swipeCard.style.opacity = "0";
  window.setTimeout(renderSwipeCard, 190);
}

function openZoneDialog(contactId) {
  const contact = contactById(contactId);
  if (!contact) return;
  document.querySelector("#zone-dialog-title").textContent = `Where does ${contact.name} belong?`;
  document.querySelector("#zone-options").innerHTML = zones
    .map((zone) => `
      <button class="zone-choice" value="${zone.id}" type="button">
        <strong>${zone.title}</strong>
        <span>${zone.description}</span>
      </button>
    `)
    .join("");
  zoneDialog.dataset.contactId = contactId;
  zoneDialog.showModal();
}

function placeContact(contactId, zoneId, verb = "moved to") {
  const contact = contactById(contactId);
  if (!contact) return;
  if (contact.zone === zoneId && contact.reviewed) return;
  contact.zone = zoneId;
  contact.reviewed = true;
  addActivity(contact, zoneId, verb);
  saveAndRender();
}

function renderZones() {
  const grid = document.querySelector("#zone-grid");
  grid.innerHTML = zones
    .map((zone) => {
      const people = state.contacts.filter((contact) => contact.zone === zone.id);
      return `
        <section class="zone-card" data-zone="${zone.id}">
          <header>
            <div>
              <span class="zone-label">${zone.group}</span>
              <h3>${zone.title}</h3>
              <p>${zone.description}</p>
            </div>
            <span class="zone-count">${people.length}</span>
          </header>
          <div class="zone-people">
            ${
              people.length
                ? people.map((contact) => `
                  <article class="zone-person" data-contact="${contact.id}">
                    ${avatarMarkup(contact)}
                    <div class="person-main">
                      <strong>${escapeHtml(contact.name)}</strong>
                      <span>${escapeHtml(contact.relationship)} · ${formatDate(contact.lastInteraction)}</span>
                    </div>
                  </article>
                `).join("")
                : `<div class="empty-zone">No one placed here yet.</div>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function renderInsights() {
  const reviewed = state.contacts.filter((contact) => contact.reviewed).length;
  const inside = kingdomContacts().length;
  const hold = holdContacts().length;
  const outside = outsideContacts().length;
  const max = Math.max(1, ...zones.map((zone) => state.contacts.filter((contact) => contact.zone === zone.id).length));

  document.querySelector("#metric-reviewed").textContent = reviewed;
  document.querySelector("#metric-inside").textContent = inside;
  document.querySelector("#metric-hold").textContent = hold;
  document.querySelector("#metric-outside").textContent = outside;
  document.querySelector("#summary-statement").textContent =
    reviewed
      ? `You have mapped ${reviewed} relationships. ${inside} currently sit inside your active Kingdom. ${hold} are unresolved. ${outside} now sit outside your current relational architecture.`
      : "Start mapping to see your current architecture.";

  document.querySelector("#distribution").innerHTML = zones
    .map((zone) => {
      const count = state.contacts.filter((contact) => contact.zone === zone.id).length;
      const width = Math.round((count / max) * 100);
      return `
        <div class="bar-row">
          <span>${zone.title}</span>
          <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");

  document.querySelector("#activity-feed").innerHTML = state.activity.length
    ? state.activity
        .map((item) => `
          <div class="activity-item">
            <strong>${escapeHtml(item.contactName)}</strong>
            <span>${escapeHtml(item.text.replace(`${item.contactName} `, ""))}</span>
          </div>
        `)
        .join("")
    : `<div class="empty-zone">No changes yet. Sort a person to begin the record.</div>`;
}

function openProfile(contactId) {
  const contact = contactById(contactId);
  if (!contact) return;
  const zone = zoneById(contact.zone);
  document.querySelector("#profile-title").textContent = contact.name;
  document.querySelector("#profile-content").innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        ${avatarMarkup(contact, "card-avatar")}
        <h3>${escapeHtml(contact.name)}</h3>
        <p>${escapeHtml(contact.relationship)} · ${formatDate(contact.lastInteraction)}</p>
        ${contact.phone ? `<p>Phone: ${escapeHtml(contact.phone)}</p>` : ""}
        ${contact.email ? `<p>Email: ${escapeHtml(contact.email)}</p>` : ""}
        ${contact.organisation ? `<p>Organisation: ${escapeHtml(contact.organisation)}</p>` : ""}
        <p>${escapeHtml(contact.notes || "No notes yet.")}</p>
        <span class="zone-label">${zone ? zone.title : "Unsorted"}</span>
        <div class="profile-actions">
          <button type="button" data-profile-zone="${contact.id}">Move Zone</button>
          <button type="button" data-profile-edit="${contact.id}">Edit Contact</button>
        </div>
      </div>
      <div class="profile-card">
        <div class="panel-title">
          <h3>Reflection questions</h3>
          <p>Answer only what feels useful. This is a private thinking space.</p>
        </div>
        <div class="reflection-list">
          ${prompts
            .map((prompt, index) => `
              <label>
                <span>${prompt}</span>
                <textarea rows="2" data-reflection="${index}" data-contact-ref="${contact.id}">${escapeHtml(contact.reflections?.[index] || "")}</textarea>
              </label>
            `)
            .join("")}
        </div>
      </div>
    </div>
  `;
  profileDialog.showModal();
}

function editContact(contactId) {
  const contact = contactById(contactId);
  if (!contact) return;
  editingContactId = contactId;
  document.querySelector("#name").value = contact.name;
  document.querySelector("#relationship").value = contact.relationship;
  document.querySelector("#lastInteraction").value = contact.lastInteraction || "";
  document.querySelector("#notes").value = contact.notes || "";
  setRoute("intake");
  document.querySelector("#name").focus();
}

function deleteContact(contactId) {
  state.contacts = state.contacts.filter((contact) => contact.id !== contactId);
  if (activeContactId === contactId) activeContactId = null;
  saveAndRender();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = {
    name: document.querySelector("#name").value.trim(),
    relationship: document.querySelector("#relationship").value,
    lastInteraction: document.querySelector("#lastInteraction").value,
    notes: document.querySelector("#notes").value.trim()
  };
  if (!formData.name) return;

  if (editingContactId) {
    const contact = contactById(editingContactId);
    Object.assign(contact, formData);
    editingContactId = null;
  } else {
    state.contacts.push({
      ...formData,
      id: makeId(),
      zone: null,
      reviewed: false,
      reflections: {}
    });
  }

  contactForm.reset();
  saveAndRender();
}

function parseCsv(text) {
  const rows = parseCsvRows(text).filter((row) => row.some(Boolean));

  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    return normalizeContact({
      name: record.name || record.fullname || record["full name"] || "Unnamed Contact",
      firstName: record.firstname || record["first name"] || "",
      lastName: record.lastname || record["last name"] || "",
      phone: record.phone || record.tel || record.mobile || "",
      email: record.email || record["email address"] || "",
      organisation: record.organisation || record.organization || record.company || "",
      photo: record.photo || "",
      relationship: record.relationship || record["relationship type"] || "Imported contact",
      lastInteraction: record.lastinteraction || record["last interaction"] || "",
      notes: record.notes || record.note || ""
    });
  });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  rows.push(row);
  return rows;
}

function parseVcf(text) {
  return text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/BEGIN:VCARD/i)
    .slice(1)
    .map((chunk) => chunk.split(/END:VCARD/i)[0])
    .map(parseVcardBlock)
    .filter(Boolean);
}

function parseVcardBlock(block) {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fullName = vcardValue(lines, "FN");
  const nameParts = parseStructuredName(vcardValue(lines, "N"));
  const photo = parseVcardPhoto(lines);
  const contact = normalizeContact({
    name: fullName || [nameParts.firstName, nameParts.lastName].filter(Boolean).join(" ") || "Unnamed Contact",
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    phone: vcardValue(lines, "TEL"),
    email: vcardValue(lines, "EMAIL"),
    organisation: vcardValue(lines, "ORG").split(";").filter(Boolean).join(", "),
    photo,
    notes: vcardValue(lines, "NOTE"),
    relationship: "Imported contact"
  });
  return contact;
}

function vcardValue(lines, propertyName) {
  const prefix = propertyName.toUpperCase();
  const line = lines.find((item) => item.toUpperCase().startsWith(`${prefix}:`) || item.toUpperCase().startsWith(`${prefix};`));
  if (!line) return "";
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) return "";
  const rawValue = line.slice(separatorIndex + 1);
  const value = /ENCODING=QUOTED-PRINTABLE/i.test(line) ? decodeQuotedPrintable(rawValue) : rawValue;
  return decodeVcardText(value);
}

function parseStructuredName(value) {
  const [lastName = "", firstName = ""] = value.split(";").map(decodeVcardText);
  return { firstName, lastName };
}

function parseVcardPhoto(lines) {
  const line = lines.find((item) => item.toUpperCase().startsWith("PHOTO:") || item.toUpperCase().startsWith("PHOTO;"));
  if (!line) return "";
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) return "";
  const meta = line.slice(0, separatorIndex).toUpperCase();
  const value = line.slice(separatorIndex + 1).trim();
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const match = meta.match(/TYPE=([^;:]+)/);
  const type = match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpeg";
  const mimeType = type.includes("/") ? type : `image/${type}`;
  return `data:${mimeType};base64,${value.replace(/\s/g, "")}`;
}

function decodeVcardText(value = "") {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function decodeQuotedPrintable(value = "") {
  try {
    const bytes = value
      .replace(/=\r?\n/g, "")
      .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return decodeURIComponent(
      bytes
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
  } catch (error) {
    return value.replace(/=\r?\n/g, "");
  }
}

function parseContactFile(fileName, text) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".vcf") || /BEGIN:VCARD/i.test(text)) return parseVcf(text);
  return parseCsv(text);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function renderAll() {
  renderStats();
  renderContactsList();
  renderSwipeCard();
  renderZones();
  renderInsights();
}

function renderImportPreview() {
  const count = pendingImport.length;
  document.querySelector("#import-preview-title").textContent = `${count} contact${count === 1 ? "" : "s"} detected`;
  document.querySelector("#import-preview-subtitle").textContent = count
    ? "Review the names before adding them to your personal Kingdom map."
    : "No new contacts were found. They may already be in your map, or the file may not contain readable contacts.";
  document.querySelector("[data-confirm-import]").disabled = count === 0;
  document.querySelector("#import-preview-list").innerHTML = count
    ? pendingImport
        .map((contact) => `
          <article class="preview-contact">
            ${avatarMarkup(contact)}
            <div class="person-main">
              <strong>${escapeHtml(contact.name || "Unnamed Contact")}</strong>
              <small>${escapeHtml([contact.phone, contact.email, contact.organisation].filter(Boolean).join(" · ") || "Ready to review")}</small>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-zone">No new contacts to import.</div>`;
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setRoute(button.dataset.route));
});

document.querySelectorAll("[data-load-samples]").forEach((button) => {
  button.addEventListener("click", loadSamples);
});

document.querySelector("[data-clear-data]").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = {
    contacts: [],
    activity: []
  };
  editingContactId = null;
  contactForm.reset();
  saveAndRender();
});

contactForm.addEventListener("submit", handleFormSubmit);

document.querySelector("#contact-file-input").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const text = await file.text();
  pendingImport = uniqueIncomingContacts(parseContactFile(file.name, text));
  event.target.value = "";
  renderImportPreview();
  importPreviewDialog.showModal();
});

document.querySelector("[data-confirm-import]").addEventListener("click", () => {
  if (!pendingImport.length) {
    importPreviewDialog.close();
    return;
  }
  state.contacts.push(...pendingImport);
  state.activity.unshift({
    id: makeId(),
    contactName: "Import",
    text: `${pendingImport.length} contacts imported for review.`,
    timestamp: new Date().toISOString()
  });
  state.activity = state.activity.slice(0, 12);
  pendingImport = [];
  importPreviewDialog.close();
  saveAndRender();
  setRoute("sort");
});

document.querySelector("[data-cancel-import]").addEventListener("click", () => {
  pendingImport = [];
  importPreviewDialog.close();
});

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) setRoute(routeButton.dataset.route);

  const decisionButton = event.target.closest("[data-decision]");
  if (decisionButton) decideContact(decisionButton.dataset.decision);

  const zoneChoice = event.target.closest(".zone-choice");
  if (zoneChoice) {
    const contactId = zoneDialog.dataset.contactId;
    const currentCardId = activeContactId;
    placeContact(contactId, zoneChoice.value, "placed in");
    zoneDialog.close();
    if (contactId === currentCardId) animateDecision("right");
  }

  const profileButton = event.target.closest("[data-profile]");
  if (profileButton) openProfile(profileButton.dataset.profile);

  const editButton = event.target.closest("[data-edit]");
  if (editButton) editContact(editButton.dataset.edit);

  const profileEditButton = event.target.closest("[data-profile-edit]");
  if (profileEditButton) {
    profileDialog.close();
    editContact(profileEditButton.dataset.profileEdit);
  }

  const profileZoneButton = event.target.closest("[data-profile-zone]");
  if (profileZoneButton) {
    profileDialog.close();
    openZoneDialog(profileZoneButton.dataset.profileZone);
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) deleteContact(deleteButton.dataset.delete);

  const zonePerson = event.target.closest(".zone-person");
  if (zonePerson && !suppressZoneClick) openProfile(zonePerson.dataset.contact);
  suppressZoneClick = false;
});

document.addEventListener("input", (event) => {
  const reflection = event.target.closest("[data-reflection]");
  if (!reflection) return;
  const contact = contactById(reflection.dataset.contactRef);
  if (!contact) return;
  contact.reflections = contact.reflections || {};
  contact.reflections[reflection.dataset.reflection] = reflection.value;
  saveState();
});

document.addEventListener("keydown", (event) => {
  if (!document.querySelector("#sort").classList.contains("active")) return;
  if (event.key === "ArrowLeft") decideContact("outside");
  if (event.key === "ArrowRight") decideContact("kingdom");
  if (event.key === "ArrowUp") decideContact("hold");
});

swipeCard.addEventListener("pointerdown", (event) => {
  if (!activeContactId) return;
  dragStart = { x: event.clientX, y: event.clientY };
  swipeCard.setPointerCapture(event.pointerId);
});

swipeCard.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  const rotation = Math.max(-10, Math.min(10, dx / 22));
  swipeCard.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
});

swipeCard.addEventListener("pointerup", (event) => {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  dragStart = null;

  if (dy < -110 && Math.abs(dy) > Math.abs(dx)) {
    decideContact("hold");
  } else if (dx > 120) {
    decideContact("kingdom");
  } else if (dx < -120) {
    decideContact("outside");
  } else {
    swipeCard.style.transform = "";
  }
});

document.addEventListener("dragstart", (event) => {
  const person = event.target.closest(".zone-person");
  if (!person) return;
  event.dataTransfer.setData("text/plain", person.dataset.contact);
});

document.addEventListener("dragover", (event) => {
  const zone = event.target.closest(".zone-card");
  if (!zone) return;
  event.preventDefault();
  zone.classList.add("drag-over");
});

document.addEventListener("dragleave", (event) => {
  const zone = event.target.closest(".zone-card");
  if (zone) zone.classList.remove("drag-over");
});

document.addEventListener("drop", (event) => {
  const zone = event.target.closest(".zone-card");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("drag-over");
  const contactId = event.dataTransfer.getData("text/plain");
  placeContact(contactId, zone.dataset.zone);
});

document.addEventListener("pointerdown", (event) => {
  const person = event.target.closest(".zone-person");
  if (!person) return;
  startZoneDrag(person, event.clientX, event.clientY);
  person.setPointerCapture(event.pointerId);
});

document.addEventListener("pointermove", (event) => {
  if (!zoneDrag) return;
  moveZoneDrag(event.clientX, event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (!zoneDrag) return;
  endZoneDrag(event.clientX, event.clientY);
});

document.addEventListener("mousedown", (event) => {
  const person = event.target.closest(".zone-person");
  if (!person || zoneDrag) return;
  startZoneDrag(person, event.clientX, event.clientY);
});

document.addEventListener("mousemove", (event) => {
  if (!zoneDrag) return;
  moveZoneDrag(event.clientX, event.clientY);
});

document.addEventListener("mouseup", (event) => {
  if (!zoneDrag) return;
  endZoneDrag(event.clientX, event.clientY);
});

function startZoneDrag(person, x, y) {
  zoneDrag = {
    contactId: person.dataset.contact,
    source: person,
    startX: x,
    startY: y,
    moved: false
  };
  person.classList.add("is-dragging");
}

function moveZoneDrag(x, y) {
  const dx = x - zoneDrag.startX;
  const dy = y - zoneDrag.startY;
  zoneDrag.moved = zoneDrag.moved || Math.abs(dx) > 8 || Math.abs(dy) > 8;
  zoneDrag.source.style.transform = `translate(${dx}px, ${dy}px) scale(0.98)`;
  document.querySelectorAll(".zone-card.drag-over").forEach((card) => card.classList.remove("drag-over"));
  const target = document.elementFromPoint(x, y)?.closest(".zone-card");
  if (target) target.classList.add("drag-over");
}

function endZoneDrag(x, y) {
  const target = document.elementFromPoint(x, y)?.closest(".zone-card");
  zoneDrag.source.classList.remove("is-dragging");
  zoneDrag.source.style.transform = "";
  document.querySelectorAll(".zone-card.drag-over").forEach((card) => card.classList.remove("drag-over"));
  suppressZoneClick = zoneDrag.moved;
  if (zoneDrag.moved && target) placeContact(zoneDrag.contactId, target.dataset.zone);
  zoneDrag = null;
}

renderAll();
