(() => {
  const STORAGE_KEY = "hp-memo-notes-v1";

  const state = {
    notes: [],
    activeId: null,
    filter: "all", // 'all' | 'pinned'
    search: "",
  };

  // DOM取得
  const noteListEl = document.getElementById("note-list");
  const newNoteBtn = document.getElementById("new-note-btn");
  const searchInput = document.getElementById("search-input");
  const filterButtons = document.querySelectorAll(".filter-btn");

  const noteTitleInput = document.getElementById("note-title");
  const noteContentTextarea = document.getElementById("note-content");
  const tagInput = document.getElementById("tag-input");
  const tagListEl = document.getElementById("tag-list");

  const pinToggleBtn = document.getElementById("pin-toggle");
  const deleteNoteBtn = document.getElementById("delete-note");

  const metaCreatedEl = document.getElementById("meta-created");
  const metaUpdatedEl = document.getElementById("meta-updated");
  const autosaveStatusEl = document.getElementById("autosave-status");

  let saveTimer = null;

  // ユーティリティ
  function createNote() {
    const now = new Date().toISOString();
    return {
      id: "note-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      title: "新しいメモ",
      content: "",
      tags: [],
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((n) => ({
        ...n,
        tags: Array.isArray(n.tags) ? n.tags : [],
        pinned: Boolean(n.pinned),
      }));
    } catch {
      return [];
    }
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
      autosaveStatusEl.textContent = "保存済み";
      autosaveStatusEl.classList.remove("saving");
    } catch (err) {
      console.error("保存失敗:", err);
      autosaveStatusEl.textContent = "保存エラー";
    }
  }

  function scheduleSave() {
    autosaveStatusEl.textContent = "保存中…";
    autosaveStatusEl.classList.add("saving");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  function getActiveNote() {
    return state.notes.find((n) => n.id === state.activeId) || null;
  }

  function touchNote(note) {
    note.updatedAt = new Date().toISOString();
  }

  // フィルタ＆ソート
  function getVisibleNotes() {
    const term = state.search.trim().toLowerCase();
    return state.notes
      .filter((n) => (state.filter === "pinned" ? n.pinned : true))
      .filter((n) => {
        if (!term) return true;
        const inTitle = n.title.toLowerCase().includes(term);
        const inContent = n.content.toLowerCase().includes(term);
        const inTags = (n.tags || []).some((t) =>
          t.toLowerCase().includes(term)
        );
        return inTitle || inContent || inTags;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1; // pinnedが上
        }
        return b.updatedAt.localeCompare(a.updatedAt); // 新しい順
      });
  }

  // レンダリング

  function renderNoteList() {
    const notes = getVisibleNotes();
    noteListEl.innerHTML = "";

    if (notes.length === 0) {
      const li = document.createElement("li");
      li.textContent = "メモがありません";
      li.className = "note-item";
      noteListEl.appendChild(li);
      return;
    }

    for (const note of notes) {
      const li = document.createElement("li");
      li.className = "note-item";
      li.dataset.id = note.id;
      if (note.id === state.activeId) {
        li.classList.add("active");
      }

      const titleRow = document.createElement("div");
      titleRow.className = "note-title-row";

      const titleSpan = document.createElement("span");
      titleSpan.className = "note-item-title";
      titleSpan.textContent = note.title || "（無題）";

      titleRow.appendChild(titleSpan);

      if (note.pinned) {
        const pinSpan = document.createElement("span");
        pinSpan.className = "note-pin";
        pinSpan.textContent = "📌";
        titleRow.appendChild(pinSpan);
      }

      const snippet = document.createElement("div");
      snippet.className = "note-snippet";
      snippet.textContent = (note.content || "").split("\n")[0] || "…";

      const meta = document.createElement("div");
      meta.className = "note-meta";
      meta.textContent = `更新: ${formatDate(note.updatedAt)}`;

      li.appendChild(titleRow);
      li.appendChild(snippet);
      li.appendChild(meta);

      noteListEl.appendChild(li);
    }
  }

  function renderTags(note) {
    tagListEl.innerHTML = "";
    if (!note || !Array.isArray(note.tags)) return;
    for (const tag of note.tags) {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.dataset.tag = tag;

      const label = document.createElement("span");
      label.textContent = tag;

      const btn = document.createElement("button");
      btn.className = "tag-remove";
      btn.type = "button";
      btn.textContent = "×";
      btn.dataset.tag = tag;

      chip.appendChild(label);
      chip.appendChild(btn);
      tagListEl.appendChild(chip);
    }
  }

  function renderEditor() {
    const note = getActiveNote();
    if (!note) {
      noteTitleInput.value = "";
      noteContentTextarea.value = "";
      metaCreatedEl.textContent = "";
      metaUpdatedEl.textContent = "";
      renderTags({ tags: [] });
      return;
    }

    noteTitleInput.value = note.title;
    noteContentTextarea.value = note.content;
    metaCreatedEl.textContent = `作成: ${formatDate(note.createdAt)}`;
    metaUpdatedEl.textContent = `更新: ${formatDate(note.updatedAt)}`;
    pinToggleBtn.textContent = note.pinned ? "📌 ピン解除" : "📌 ピン留め";

    renderTags(note);
  }

  // イベント

  function handleNewNote() {
    const note = createNote();
    state.notes.unshift(note);
    state.activeId = note.id;
    renderNoteList();
    renderEditor();
    scheduleSave();
    noteTitleInput.focus();
  }

  function handleSelectNote(id) {
    if (!id || id === state.activeId) return;
    state.activeId = id;
    renderNoteList();
    renderEditor();
  }

  function handleTitleInput() {
    const note = getActiveNote();
    if (!note) return;
    note.title = noteTitleInput.value;
    touchNote(note);
    renderNoteList(); // タイトル・更新日時を反映
    scheduleSave();
  }

  function handleContentInput() {
    const note = getActiveNote();
    if (!note) return;
    note.content = noteContentTextarea.value;
    touchNote(note);
    // 毎回リストを描き直すと重いので、ここでは保存だけ
    scheduleSave();
    metaUpdatedEl.textContent = `更新: ${formatDate(note.updatedAt)}`;
  }

  function handleTagKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = tagInput.value.trim();
    if (!value) return;

    const note = getActiveNote();
    if (!note) return;

    if (!note.tags.includes(value)) {
      note.tags.push(value);
      touchNote(note);
      renderTags(note);
      scheduleSave();
    }
    tagInput.value = "";
  }

  function handleTagClick(e) {
    const btn = e.target.closest(".tag-remove");
    if (!btn) return;
    const tag = btn.dataset.tag;
    const note = getActiveNote();
    if (!note) return;
    note.tags = note.tags.filter((t) => t !== tag);
    touchNote(note);
    renderTags(note);
    scheduleSave();
  }

  function handlePinToggle() {
    const note = getActiveNote();
    if (!note) return;
    note.pinned = !note.pinned;
    touchNote(note);
    renderNoteList();
    renderEditor();
    scheduleSave();
  }

  function handleDeleteNote() {
    const note = getActiveNote();
    if (!note) return;
    if (!window.confirm("このメモを削除しますか？")) return;

    const idx = state.notes.findIndex((n) => n.id === note.id);
    if (idx === -1) return;
    state.notes.splice(idx, 1);

    if (state.notes.length === 0) {
      const newNote = createNote();
      state.notes.push(newNote);
      state.activeId = newNote.id;
    } else {
      const next = state.notes[Math.max(0, idx - 1)];
      state.activeId = next.id;
    }

    renderNoteList();
    renderEditor();
    scheduleSave();
  }

  function handleSearchInput() {
    state.search = searchInput.value;
    renderNoteList();
  }

  function handleFilterClick(e) {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    const filter = btn.dataset.filter;
    if (!filter || filter === state.filter) return;
    state.filter = filter;

    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    renderNoteList();
  }

  function handleNoteListClick(e) {
    const item = e.target.closest(".note-item");
    if (!item || !item.dataset.id) return;
    handleSelectNote(item.dataset.id);
  }

  function handleKeyDown(e) {
    if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;

    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      handleNewNote();
    } else if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      saveNow();
    }
  }

  // 初期化

  function init() {
    state.notes = loadNotes();
    if (state.notes.length === 0) {
      const first = createNote();
      state.notes.push(first);
      state.activeId = first.id;
      saveNow();
    } else {
      // 一番最近更新されたメモを開く
      state.notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      state.activeId = state.notes[0].id;
    }

    renderNoteList();
    renderEditor();
    autosaveStatusEl.textContent = "保存済み";
  }

  // イベント登録
  newNoteBtn.addEventListener("click", handleNewNote);
  noteListEl.addEventListener("click", handleNoteListClick);
  searchInput.addEventListener("input", handleSearchInput);
  filterButtons.forEach((btn) =>
    btn.addEventListener("click", handleFilterClick)
  );

  noteTitleInput.addEventListener("input", handleTitleInput);
  noteContentTextarea.addEventListener("input", handleContentInput);

  tagInput.addEventListener("keydown", handleTagKeyDown);
  tagListEl.addEventListener("click", handleTagClick);

  pinToggleBtn.addEventListener("click", handlePinToggle);
  deleteNoteBtn.addEventListener("click", handleDeleteNote);

  document.addEventListener("keydown", handleKeyDown);

  // 実行
  init();
})();

