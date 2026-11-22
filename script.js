// === State Management ===
const STORAGE_KEYS = {
  CHATS: 'chatgpt_demo_iti_chats_v1',
  ACTIVE_ID: 'chatgpt_demo_iti_active_v1',
  SETTINGS: 'chatgpt_demo_iti_settings_v1',
  THEME: 'chatgpt_demo_iti_theme_v1',
};

const DEFAULT_OPENROUTER_KEY = '';
const DEFAULT_TEXT_MODEL = 'openrouter/free';

let savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
let settings = {
  apiKey:
    savedSettings.apiKey && savedSettings.apiKey.startsWith('sk-or-')
      ? savedSettings.apiKey
      : DEFAULT_OPENROUTER_KEY,
  systemPrompt:
    savedSettings.systemPrompt ||
    'You are ChatGPT Demo (ITI Practice), an expert, concise, and helpful software engineering assistant. Format responses cleanly using Markdown.',
  temperature: savedSettings.temperature !== undefined ? savedSettings.temperature : 0.7,
};

let chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS)) || {};
let currentChatId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || null;
let isGenerating = false;
let pendingImageBase64 = null;

// Configure Marked.js
marked.setOptions({
  breaks: true,
  gfm: true,
});

// === Initialization ===
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSettingsUI();

  if (Object.keys(chats).length === 0) {
    createNewChat(false);
  } else {
    if (!currentChatId || !chats[currentChatId]) {
      currentChatId = Object.keys(chats)[0];
    }
    renderChatList();
    switchChat(currentChatId);
  }

  setupEventListeners();
  updateModeBadge();
  fetchAvailableModels(true);
});

function saveChatsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, currentChatId);
  } catch (e) {
    console.warn('LocalStorage quota exceeded:', e);
    alert(
      '⚠️ مساحة التخزين في المتصفح امتلأت بسبب الصور. يُفضل تحميل الصور وحذف المحادثات القديمة.',
    );
  }
}

// === Image Attachment & Compression for Vision ===
function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1024;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      pendingImageBase64 = canvas.toDataURL('image/jpeg', 0.85);
      showImagePreview(pendingImageBase64);

      const select = document.getElementById('model-select');
      if (select.value.startsWith('image|')) {
        select.value = `text|${DEFAULT_TEXT_MODEL}`;
        updateModeBadge();
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showImagePreview(dataUrl) {
  document.getElementById('preview-thumb-img').src = dataUrl;
  document.getElementById('image-preview-bar').style.display = 'flex';
}

function clearImagePreview() {
  pendingImageBase64 = null;
  document.getElementById('image-upload-input').value = '';
  document.getElementById('preview-thumb-img').src = '';
  document.getElementById('image-preview-bar').style.display = 'none';
}

// === Fetch Live Free Models from OpenRouter ===
async function fetchAvailableModels(silent = false) {
  const refreshIcon = document.querySelector('#refresh-models-btn i');
  if (refreshIcon) refreshIcon.classList.add('spin-anim');

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const freeModels = (data.data || []).filter((m) => m.id.endsWith(':free'));
    const textGroup = document.getElementById('text-models-group');

    let optionsHTML = `
      <option value="text|openrouter/free" selected>Auto Free Router (Best Active)</option>
    `;

    freeModels
      .filter((m) => m.id !== 'openrouter/free')
      .forEach((m) => {
        const cleanName = m.name || m.id;
        optionsHTML += `<option value="text|${m.id}">${escapeHTML(cleanName)}</option>`;
      });

    textGroup.innerHTML = optionsHTML;
    updateModeBadge();

    if (!silent) {
      alert(`✅ تم تحديث القائمة! تم العثور على ${freeModels.length} موديل مجاني شغال حالياً.`);
    }
  } catch (err) {
    console.error('Failed to fetch OpenRouter models:', err);
    if (!silent) {
      alert('⚠️ تعذر تحديث قائمة الموديلات، سيعمل التطبيق بالراوتر المجاني التلقائي.');
    }
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spin-anim');
  }
}

function getSelectedModelInfo() {
  const rawVal = document.getElementById('model-select').value;
  const [mode, modelId] = rawVal.split('|');
  return { mode, modelId };
}

function updateModeBadge() {
  const { mode } = getSelectedModelInfo();
  const badge = document.getElementById('mode-badge');
  const promptInput = document.getElementById('prompt');
  if (mode === 'image') {
    badge.textContent = 'Image Generation Studio';
    promptInput.placeholder = 'Describe the image you want to generate...';
  } else {
    badge.textContent = 'Chat & Vision Mode';
    promptInput.placeholder = 'Message ChatGPT Demo...';
  }
}

// === Theme Handling ===
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  document.documentElement.setAttribute('data-bs-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-bs-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', next);
  localStorage.setItem(STORAGE_KEYS.THEME, next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

// === Chat Management ===
function createNewChat(shouldSwitch = true) {
  const id = 'chat_' + Date.now();
  chats[id] = {
    id,
    title: 'New Chat',
    createdAt: Date.now(),
    messages: [],
  };
  currentChatId = id;
  saveChatsToStorage();
  renderChatList();
  if (shouldSwitch) switchChat(id);
}

function switchChat(chatId) {
  currentChatId = chatId;
  saveChatsToStorage();
  renderChatList(document.getElementById('search-chats').value);

  const chatArea = document.getElementById('chat-area');
  const welcomeScreen = document.getElementById('welcome-screen');
  const messages = chats[chatId]?.messages || [];

  Array.from(chatArea.children).forEach((child) => {
    if (child.id !== 'welcome-screen') child.remove();
  });

  if (messages.length === 0) {
    welcomeScreen.style.display = 'block';
  } else {
    welcomeScreen.style.display = 'none';
    messages.forEach((msg, index) => {
      appendMessageToUI(msg.role, msg.content, msg.type, index, false, msg.attachedImage || null);
    });
  }

  closeMobileSidebar();
  scrollToBottom();
}

function renameChat(chatId, event) {
  event.stopPropagation();
  const currentTitle = chats[chatId].title;
  const newTitle = prompt('Enter new conversation title:', currentTitle);
  if (newTitle && newTitle.trim() !== '') {
    chats[chatId].title = newTitle.trim();
    saveChatsToStorage();
    renderChatList();
  }
}

function deleteChat(chatId, event) {
  event.stopPropagation();
  if (!confirm('Delete this conversation?')) return;

  delete chats[chatId];
  const remainingIds = Object.keys(chats);

  if (remainingIds.length === 0) {
    createNewChat(true);
  } else {
    if (currentChatId === chatId) {
      currentChatId = remainingIds[0];
    }
    saveChatsToStorage();
    renderChatList();
    switchChat(currentChatId);
  }
}

function clearCurrentChat() {
  if (!chats[currentChatId] || chats[currentChatId].messages.length === 0) return;
  if (!confirm('Clear all messages in this chat?')) return;

  chats[currentChatId].messages = [];
  saveChatsToStorage();
  switchChat(currentChatId);
}

function renderChatList(filterQuery = '') {
  const listEl = document.getElementById('chat-list');
  listEl.innerHTML = '';

  const sortedChats = Object.values(chats)
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((c) => c.title.toLowerCase().includes(filterQuery.toLowerCase()));

  sortedChats.forEach((chat) => {
    const item = document.createElement('div');
    item.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
    item.onclick = () => switchChat(chat.id);

    item.innerHTML = `
      <div class="chat-item-title">
        <i class="bi bi-chat-left-text"></i>
        <span>${escapeHTML(chat.title)}</span>
      </div>
      <div class="chat-item-actions">
        <button class="chat-action-btn" title="Rename" onclick="renameChat('${chat.id}', event)">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="chat-action-btn delete" title="Delete" onclick="deleteChat('${chat.id}', event)">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    listEl.appendChild(item);
  });
}

// === UI Rendering ===
function appendMessageToUI(
  role,
  content,
  type = 'text',
  msgIndex = null,
  animate = false,
  attachedImage = null,
) {
  const chatArea = document.getElementById('chat-area');
  document.getElementById('welcome-screen').style.display = 'none';

  const row = document.createElement('div');
  row.className = `message-row ${role === 'user' ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role === 'user' ? 'user' : 'bot'}`;
  avatar.innerHTML =
    role === 'user'
      ? '<i class="bi bi-person-fill"></i>'
      : '<i class="bi bi-chat-square-dots-fill"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (type === 'image') {
    bubble.innerHTML = `
      <div class="generated-img-wrap">
        <img src="${content}" alt="AI Generated Image" loading="lazy" />
      </div>
      <div class="msg-toolbar">
        <a href="${content}" download="ChatGPT-Demo-ITI-${Date.now()}.jpg" class="msg-tool-btn text-decoration-none">
          <i class="bi bi-download"></i> Download Image
        </a>
      </div>
    `;
  } else if (role === 'user') {
    if (attachedImage) {
      const imgEl = document.createElement('img');
      imgEl.src = attachedImage;
      imgEl.className = 'user-attached-img';
      imgEl.alt = 'Uploaded context';
      bubble.appendChild(imgEl);
    }
    if (content) {
      const textSpan = document.createElement('div');
      textSpan.textContent = content;
      bubble.appendChild(textSpan);
    }
  } else {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'markdown-body';
    bubble.appendChild(contentDiv);

    if (animate) {
      streamMarkdown(contentDiv, content, () => addBotToolbar(bubble, content, msgIndex));
    } else {
      renderMarkdownSafe(contentDiv, content);
      addBotToolbar(bubble, content, msgIndex);
    }
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatArea.appendChild(row);
  scrollToBottom();
}

function renderMarkdownSafe(container, rawText) {
  const rawHTML = marked.parse(rawText);
  container.innerHTML = DOMPurify.sanitize(rawHTML);

  container.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
    const pre = block.parentElement;
    if (!pre.querySelector('.copy-code-btn')) {
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copy';
      btn.onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        btn.innerHTML = '<i class="bi bi-check2 me-1"></i>Copied!';
        setTimeout(() => (btn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copy'), 2000);
      };
      pre.appendChild(btn);
    }
  });
}

function streamMarkdown(container, fullText, onComplete) {
  let index = 0;
  const chunkSize = Math.max(3, Math.ceil(fullText.length / 80));

  const interval = setInterval(() => {
    index += chunkSize;
    if (index >= fullText.length) {
      clearInterval(interval);
      renderMarkdownSafe(container, fullText);
      if (onComplete) onComplete();
    } else {
      renderMarkdownSafe(container, fullText.slice(0, index) + ' ▍');
    }
    scrollToBottom();
  }, 18);
}

function addBotToolbar(bubble, rawText, msgIndex) {
  const toolbar = document.createElement('div');
  toolbar.className = 'msg-toolbar';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'msg-tool-btn';
  copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(rawText);
    copyBtn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied';
    setTimeout(() => (copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'), 2000);
  };

  toolbar.appendChild(copyBtn);

  if (msgIndex === chats[currentChatId].messages.length - 1) {
    const regenBtn = document.createElement('button');
    regenBtn.className = 'msg-tool-btn';
    regenBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Regenerate';
    regenBtn.onclick = regenerateLastResponse;
    toolbar.appendChild(regenBtn);
  }

  bubble.appendChild(toolbar);
}

function showTypingIndicator() {
  const chatArea = document.getElementById('chat-area');
  const loaderId = 'typing-indicator';
  const html = `
    <div class="message-row bot" id="${loaderId}">
      <div class="avatar bot"><i class="bi bi-chat-square-dots-fill"></i></div>
      <div class="message-bubble">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  chatArea.insertAdjacentHTML('beforeend', html);
  scrollToBottom();
  return loaderId;
}

// === Form Submission & OpenRouter API Calls ===
async function handleSendMessage(customPrompt = null) {
  if (isGenerating) return;

  if (!settings.apiKey) {
    alert("⚠️ Please add your OpenRouter API Key in 'API & Settings' first!");
    new bootstrap.Modal(document.getElementById('settingsModal')).show();
    return;
  }

  const promptInput = document.getElementById('prompt');
  const rawText = customPrompt !== null ? customPrompt : promptInput.value.trim();
  const attachedImage = pendingImageBase64;
  const { mode, modelId } = getSelectedModelInfo();

  if (!rawText && !attachedImage) return;

  const promptText = rawText || 'What is in this image? Describe and analyze it.';

  if (chats[currentChatId].messages.length === 0) {
    chats[currentChatId].title =
      promptText.length > 32 ? promptText.slice(0, 32) + '...' : promptText;
    renderChatList();
  }

  chats[currentChatId].messages.push({
    role: 'user',
    content: promptText,
    attachedImage: attachedImage,
    type: 'text',
  });
  saveChatsToStorage();
  appendMessageToUI('user', promptText, 'text', null, false, attachedImage);

  if (customPrompt === null) {
    promptInput.value = '';
    promptInput.style.height = 'auto';
  }
  clearImagePreview();

  isGenerating = true;
  document.getElementById('send-btn').disabled = true;
  const loaderId = showTypingIndicator();

  try {
    if (mode === 'image') {
      const imageUrl = await generateViaPollinations(promptText);
      document.getElementById(loaderId)?.remove();

      chats[currentChatId].messages.push({
        role: 'assistant',
        content: imageUrl,
        type: 'image',
      });
      saveChatsToStorage();
      appendMessageToUI('assistant', imageUrl, 'image');
    } else {
      const history = buildVisionCompatibleHistory(chats[currentChatId].messages);
      const reply = await callOpenRouterAPI(history, modelId);
      document.getElementById(loaderId)?.remove();

      const newIndex = chats[currentChatId].messages.length;
      chats[currentChatId].messages.push({
        role: 'assistant',
        content: reply,
        type: 'text',
      });
      saveChatsToStorage();
      appendMessageToUI('assistant', reply, 'text', newIndex, true);
    }
  } catch (err) {
    document.getElementById(loaderId)?.remove();
    const errorMsg = `**Error:** ${err.message || 'Failed to connect to OpenRouter.'}`;
    appendMessageToUI('assistant', errorMsg, 'text');
  } finally {
    isGenerating = false;
    document.getElementById('send-btn').disabled = false;
  }
}

function buildVisionCompatibleHistory(messages) {
  return messages
    .filter((m) => m.type === 'text')
    .map((m) => {
      if (m.role === 'user' && m.attachedImage) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: m.attachedImage } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
}

async function regenerateLastResponse() {
  if (isGenerating) return;
  const msgs = chats[currentChatId].messages;
  if (msgs.length < 2) return;

  if (msgs[msgs.length - 1].role === 'assistant') {
    msgs.pop();
  }
  saveChatsToStorage();
  switchChat(currentChatId);

  const { modelId } = getSelectedModelInfo();
  isGenerating = true;
  document.getElementById('send-btn').disabled = true;
  const loaderId = showTypingIndicator();

  try {
    const history = buildVisionCompatibleHistory(msgs);
    const reply = await callOpenRouterAPI(history, modelId);
    document.getElementById(loaderId)?.remove();

    const newIndex = chats[currentChatId].messages.length;
    chats[currentChatId].messages.push({
      role: 'assistant',
      content: reply,
      type: 'text',
    });
    saveChatsToStorage();
    appendMessageToUI('assistant', reply, 'text', newIndex, true);
  } catch (err) {
    document.getElementById(loaderId)?.remove();
    appendMessageToUI('assistant', `**Error:** ${err.message}`, 'text');
  } finally {
    isGenerating = false;
    document.getElementById('send-btn').disabled = false;
  }
}

async function callOpenRouterAPI(history, modelId = DEFAULT_TEXT_MODEL) {
  const payloadMessages = [{ role: 'system', content: settings.systemPrompt }, ...history];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'HTTP-Referer': window.location.origin || 'http://localhost',
      'X-Title': 'ChatGPT Demo - ITI Practice',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: payloadMessages,
      temperature: parseFloat(settings.temperature),
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateViaPollinations(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 100000);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Image generator failed.');
  const blob = await res.blob();
  return await blobToBase64(blob);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// === Export Chat ===
function exportCurrentChat() {
  const chat = chats[currentChatId];
  if (!chat || chat.messages.length === 0) {
    alert('Nothing to export in this conversation.');
    return;
  }

  let mdContent = `# ${chat.title}\n_Exported from ChatGPT Demo — ITI Practice_\n\n---\n\n`;
  chat.messages.forEach((m) => {
    const sender = m.role === 'user' ? '**You**' : '**ChatGPT Demo**';
    const body = m.type === 'image' ? `![Generated Image](${m.content})` : m.content;
    mdContent += `### ${sender}:\n${body}\n\n`;
  });

  const blob = new Blob([mdContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chat.title.replace(/[^a-z0-9]/gi, '_')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// === Settings Modal ===
function loadSettingsUI() {
  document.getElementById('api-key-input').value = settings.apiKey;
  document.getElementById('system-prompt-input').value = settings.systemPrompt;
  document.getElementById('temp-input').value = settings.temperature;
  document.getElementById('temp-value').textContent = settings.temperature;
}

function saveSettings() {
  settings.apiKey = document.getElementById('api-key-input').value.trim();
  settings.systemPrompt = document.getElementById('system-prompt-input').value.trim();
  settings.temperature = parseFloat(document.getElementById('temp-input').value);

  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
}

// === Helpers & Event Listeners ===
function scrollToBottom() {
  const chatArea = document.getElementById('chat-area');
  chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

function setupEventListeners() {
  document.getElementById('new-chat-btn').onclick = () => createNewChat(true);
  document.getElementById('theme-toggle-btn').onclick = toggleTheme;
  document.getElementById('clear-chat-btn').onclick = clearCurrentChat;
  document.getElementById('export-chat-btn').onclick = exportCurrentChat;
  document.getElementById('save-settings-btn').onclick = saveSettings;
  document.getElementById('refresh-models-btn').onclick = () => fetchAvailableModels(false);

  // Image Upload & Paste Listeners
  document.getElementById('attach-image-btn').onclick = () =>
    document.getElementById('image-upload-input').click();

  document.getElementById('image-upload-input').onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  document.getElementById('remove-image-btn').onclick = clearImagePreview;

  document.getElementById('search-chats').oninput = (e) => {
    renderChatList(e.target.value);
  };

  document.getElementById('temp-input').oninput = (e) => {
    document.getElementById('temp-value').textContent = e.target.value;
  };

  document.getElementById('toggle-key-vis').onclick = () => {
    const input = document.getElementById('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  };

  document.getElementById('model-select').onchange = updateModeBadge;

  // Starter Cards
  document.querySelectorAll('.starter-card').forEach((card) => {
    card.onclick = () => {
      const targetMode = card.getAttribute('data-mode');
      const text = card.getAttribute('data-prompt');
      const select = document.getElementById('model-select');

      const matchingOption = Array.from(select.options).find((opt) =>
        opt.value.startsWith(targetMode + '|'),
      );
      if (matchingOption) {
        select.value = matchingOption.value;
        updateModeBadge();
      }
      handleSendMessage(text);
    };
  });

  // Auto-resize textarea, Paste Image, & Enter to submit
  const promptEl = document.getElementById('prompt');
  promptEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
  });

  promptEl.addEventListener('paste', function (e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        handleImageFile(file);
        break;
      }
    }
  });

  promptEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  document.getElementById('chat-form').onsubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Mobile sidebar toggles
  document.getElementById('open-sidebar-btn').onclick = () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
  };
  document.getElementById('close-sidebar-btn').onclick = closeMobileSidebar;
  document.getElementById('sidebar-overlay').onclick = closeMobileSidebar;
}
