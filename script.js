const video = document.getElementById('video');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
const addBtn = document.getElementById('addBtn');
const addCommentForm = document.getElementById('addCommentForm');
const searchInput = document.getElementById('searchInput');
const videoFileInput = document.getElementById('videoFileInput');

// IndexedDB setup to store video file Blob
const DB_NAME = 'videoFileDB';
const STORE_NAME = 'videos';
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function saveVideoFile(blob) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, 'videoFile');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function loadVideoFile() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('videoFile');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Comments key
function commentsKey() {
  return `comments_${video.currentSrc || video.src}`;
}

function loadComments() {
  const stored = localStorage.getItem(commentsKey());
  return stored ? JSON.parse(stored) : [];
}

function saveComments(comments) {
  localStorage.setItem(commentsKey(), JSON.stringify(comments));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function renderComments(filterText = '') {
  const comments = loadComments();
  commentsList.innerHTML = '';

  const filtered = comments.filter(c =>
    c.text.toLowerCase().includes(filterText.toLowerCase())
  );

  filtered.forEach((comment, index) => {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.setAttribute('role', 'listitem');

    const timestampBtn = document.createElement('button');
    timestampBtn.className = 'timestamp';
    timestampBtn.textContent = formatTime(comment.time);
    timestampBtn.setAttribute('aria-label', `Jump to ${formatTime(comment.time)}`);
    timestampBtn.addEventListener('click', () => {
      video.currentTime = comment.time;
      video.focus();
      commentEl.classList.add('highlight');
      setTimeout(() => commentEl.classList.remove('highlight'), 2000);
    });

    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = comment.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete comment');
    deleteBtn.innerHTML = '&times;';
    deleteBtn.addEventListener('click', () => {
      comments.splice(index, 1);
      saveComments(comments);
      renderComments(searchInput.value);
    });

    commentEl.appendChild(timestampBtn);
    commentEl.appendChild(textEl);
    commentEl.appendChild(deleteBtn);

    commentsList.appendChild(commentEl);
  });
}

function updateAddBtnState() {
  addBtn.disabled = commentInput.value.trim() === '' || video.readyState < 2;
}

addCommentForm.addEventListener('submit', e => {
  e.preventDefault();
  const comments = loadComments();
  comments.push({
    time: video.currentTime,
    text: commentInput.value.trim(),
  });
  saveComments(comments);
  commentInput.value = '';
  renderComments(searchInput.value);
  updateAddBtnState();
});

commentInput.addEventListener('input', updateAddBtnState);
video.addEventListener('loadedmetadata', updateAddBtnState);

searchInput.addEventListener('input', () => renderComments(searchInput.value));

videoFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith('video/')) {
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();
    await saveVideoFile(file);
    localStorage.removeItem(commentsKey());
    renderComments('');
  }
});

window.addEventListener('load', async () => {
  try {
    await openDB();
    const blob = await loadVideoFile();
    if (blob) {
      const url = URL.createObjectURL(blob);
      video.src = url;
      video.load();
    }
    renderComments('');
  } catch (err) {
    console.error('DB Error:', err);
  }
});
