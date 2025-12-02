(() => {
  const STORAGE_KEY = "hp-memo-notes-v1";
  const THEME_KEY = "hp-memo-theme";

  const state = {
    notes: [],
    activeId: null,
    filter: "all", // 'all' | 'pinned'
    search: "",
    mode: "edit", // 'edit' | 'preview'
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
  const textStatsEl = document.getElementById("text-stats");

  const saveButton = document.getElementById("save-button");
  const exportButton = document.getElementById("export-button");
  const importInput = document.getElementById("import-input");

  const themeToggleBtn = document.getElementById("theme-toggle");
  const modeTabs = document.querySelectorAll(".mode-tab");
  const previewPane = document.getElementById("preview-pane");

  let saveTimer = null;

  // --- テーマ関連 ---

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = next === "dark" ? "🌙" : "☀️";
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const initial = saved || "dark";
    applyTheme(initial);
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
      });
    }
  }

  // --- ユーティリティ ---

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
        id:
          typeof n.id === "string"
            ? n.id
            : "note-" + Date.now() + "-" + Math.random().toString(16).slice(2),
        title: typeof n.title === "string" ? n.title : "（無題）",
        content: typeof n.content === "string" ? n.content : "",
        tags: Array.isArray(n.tags) ? n.tags : [],
        pinned: Boolean(n.pinned),
        createdAt: n.createdAt || new Date().toISOString(),
        updatedAt: n.updatedAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
      if (autosaveStatusEl) {
        autosaveStatusEl.textContent = "保存済み";
        autosaveStatusEl.classList.remove("saving");
      }
    } catch (err) {
      console.error("保存失敗:", err);
      if (autosaveStatusEl) {
        autosaveStatusEl.textContent = "保存エラー";
      }
    }
  }

  function scheduleSave() {
    if (!autosaveStatusEl) return;
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

  function updateTextStats(text) {
    if (!textStatsEl) return;
    const chars = text.length;
    const lines = text ? text.split(/\r?\n/).length : 0;
    textStatsEl.textContent = `文字数: ${chars} / 行数: ${lines}`;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderPreviewHtml(text) {
    const escaped = escapeHtml(text);
    const lines = escaped.split(/\r?\n/);
    return lines
      .map((line) => {
        if (line.startsWith("# ")) {
          return `<p class="preview-heading">${line.slice(2)}</p>`;
        }
        if (line.startsWith("- ")) {
          return `<p class="preview-list">• ${line.slice(2)}</p>`;
        }
        if (!line) {
          return "<p><br></p>";
        }
        return `<p>${line}</p>`;
      })
      .join("");
  }

  // --- フィルタ＆ソート ---

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

  // --- レンダリング ---

  function renderNoteList() {
    if (!noteListEl) return;
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
    if (!tagListEl) return;
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
    if (!noteTitleInput || !noteContentTextarea) return;

    if (!note) {
      noteTitleInput.value = "";
      noteContentTextarea.value = "";
      if (metaCreatedEl) metaCreatedEl.textContent = "";
      if (metaUpdatedEl) metaUpdatedEl.textContent = "";
      renderTags({ tags: [] });
      updateTextStats("");
      if (previewPane) previewPane.innerHTML = "";
      return;
    }

    noteTitleInput.value = note.title;
    noteContentTextarea.value = note.content;
    if (metaCreatedEl) {
      metaCreatedEl.textContent = `作成: ${formatDate(note.createdAt)}`;
    }
    if (metaUpdatedEl) {
      metaUpdatedEl.textContent = `更新: ${formatDate(note.updatedAt)}`;
    }
    if (pinToggleBtn) {
      pinToggleBtn.textContent = note.pinned ? "📌 ピン解除" : "📌 ピン留め";
    }

    renderTags(note);
    updateTextStats(note.content);

    if (previewPane && state.mode === "preview") {
      previewPane.innerHTML = renderPreviewHtml(note.content);
      noteContentTextarea.style.display = "none";
      previewPane.hidden = false;
    } else if (previewPane) {
      noteContentTextarea.style.display = "block";
      previewPane.hidden = true;
    }
  }

  function setMode(mode) {
    state.mode = mode === "preview" ? "preview" : "edit";
    if (!modeTabs || !noteContentTextarea || !previewPane) return;

    modeTabs.forEach((tab) => {
      const tMode = tab.dataset.mode;
      tab.classList.toggle("active", tMode === state.mode);
    });

    const note = getActiveNote();
    const text = note ? note.content : noteContentTextarea.value;

    if (state.mode === "preview") {
      previewPane.innerHTML = renderPreviewHtml(text);
      previewPane.hidden = false;
      noteContentTextarea.style.display = "none";
    } else {
      previewPane.hidden = true;
      noteContentTextarea.style.display = "block";
    }
  }

  // --- イベントハンドラ ---

  function handleNewNote() {
    const note = createNote();
    state.notes.unshift(note);
    state.activeId = note.id;
    renderNoteList();
    renderEditor();
    scheduleSave();
    if (noteTitleInput) noteTitleInput.focus();
  }

  function handleSelectNote(id) {
    if (!id || id === state.activeId) return;
    state.activeId = id;
    renderNoteList();
    renderEditor();
  }

  function handleTitleInput() {
    const note = getActiveNote();
    if (!note || !noteTitleInput) return;
    note.title = noteTitleInput.value;
    touchNote(note);
    renderNoteList();
    scheduleSave();
  }

  function handleContentInput() {
    const note = getActiveNote();
    if (!note || !noteContentTextarea) return;
    note.content = noteContentTextarea.value;
    touchNote(note);
    scheduleSave();
    if (metaUpdatedEl) {
      metaUpdatedEl.textContent = `更新: ${formatDate(note.updatedAt)}`;
    }
    updateTextStats(note.content);
    if (previewPane && state.mode === "preview") {
      previewPane.innerHTML = renderPreviewHtml(note.content);
    }
  }

  function handleTagKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!tagInput) return;
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
    if (!searchInput) return;
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
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleNewNote();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (autosaveStatusEl) {
          autosaveStatusEl.textContent = "保存中…";
          autosaveStatusEl.classList.add("saving");
        }
        saveNow();
      } else if (e.key === "f" || e.key === "F") {
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    }
  }

  // --- 手動保存 / エクスポート / インポート ---

  function handleExport() {
    const data = JSON.stringify(state.notes, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    a.href = url;
    a.download = `memo-backup-${y}${m}${d}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error("invalid format");
        }

        const ok = window.confirm(
          "現在のメモを、バックアップファイルの内容で置き換えますか？"
        );
        if (!ok) return;

        state.notes = parsed.map((n) => ({
          id:
            typeof n.id === "string"
              ? n.id
              : "note-" + Date.now() + "-" + Math.random().toString(16).slice(2),
          title: typeof n.title === "string" ? n.title : "（無題）",
          content: typeof n.content === "string" ? n.content : "",
          tags: Array.isArray(n.tags) ? n.tags : [],
          pinned: Boolean(n.pinned),
          createdAt: n.createdAt || new Date().toISOString(),
          updatedAt: n.updatedAt || new Date().toISOString(),
        }));

        if (state.notes.length === 0) {
          const first = createNote();
          state.notes.push(first);
          state.activeId = first.id;
        } else {
          state.notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          state.activeId = state.notes[0].id;
        }

        saveNow();
        renderNoteList();
        renderEditor();
      } catch (err) {
        console.error(err);
        window.alert(
          "バックアップの読み込みに失敗しました。ファイル形式を確認してください。"
        );
      } finally {
        if (importInput) importInput.value = "";
      }
    };

    reader.readAsText(file, "utf-8");
  }

  // --- 初期化 ---

  function init() {
    initTheme();

    state.notes = loadNotes();
    if (state.notes.length === 0) {
      const first = createNote();
      state.notes.push(first);
      state.activeId = first.id;
      saveNow();
    } else {
      state.notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      state.activeId = state.notes[0].id;
    }

    renderNoteList();
    renderEditor();
    if (autosaveStatusEl) autosaveStatusEl.textContent = "保存済み";

    if (modeTabs) {
      modeTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const m = tab.dataset.mode;
          setMode(m);
        });
      });
    }
  }

  // イベント登録（存在チェックしながら）

  if (newNoteBtn) newNoteBtn.addEventListener("click", handleNewNote);
  if (noteListEl) noteListEl.addEventListener("click", handleNoteListClick);
  if (searchInput) searchInput.addEventListener("input", handleSearchInput);
  filterButtons.forEach((btn) =>
    btn.addEventListener("click", handleFilterClick)
  );

  if (noteTitleInput) noteTitleInput.addEventListener("input", handleTitleInput);
  if (noteContentTextarea)
    noteContentTextarea.addEventListener("input", handleContentInput);

  if (tagInput) tagInput.addEventListener("keydown", handleTagKeyDown);
  if (tagListEl) tagListEl.addEventListener("click", handleTagClick);

  if (pinToggleBtn) pinToggleBtn.addEventListener("click", handlePinToggle);
  if (deleteNoteBtn) deleteNoteBtn.addEventListener("click", handleDeleteNote);

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      if (autosaveStatusEl) {
        autosaveStatusEl.textContent = "保存中…";
        autosaveStatusEl.classList.add("saving");
      }
      saveNow();
    });
  }

  if (exportButton) {
    exportButton.addEventListener("click", handleExport);
  }

  if (importInput) {
    importInput.addEventListener("change", handleImport);
  }

  document.addEventListener("keydown", handleKeyDown);

  // 実行
  if (noteListEl || noteTitleInput || noteContentTextarea) {
    init();
  }
})();
