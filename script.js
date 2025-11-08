let allChats = {
  chat1: [],
  chat2: [],
  chat3: [],
};
let currentChatId = "chat1";
let chatCounter = 3;

function switchChat(chatId) {
  currentChatId = chatId;

  document.querySelectorAll(".chat-btn").forEach((btn) => {
    btn.classList.remove("active-chat");
  });
  const activeBtn = document.getElementById(chatId);
  if (activeBtn) {
    activeBtn.classList.add("active-chat");
  }

  const chatArea = document.getElementById("chat-area");
  chatArea.innerHTML = "";
  allChats[chatId].forEach((msg) => {
    appendMessageToUI(msg.role, msg.content, msg.type);
  });
  scrollToBottom();
}

function createNewChat() {
  chatCounter++;
  const newChatId = `chat${chatCounter}`;
  const newChatName = `Chat ${chatCounter}`;

  allChats[newChatId] = [];

  const chatList = document.querySelector(".chat-list");
  const newBtn = document.createElement("button");
  newBtn.className = "chat-btn";
  newBtn.id = newChatId;
  newBtn.innerText = newChatName;

  newBtn.onclick = () => switchChat(newChatId);

  chatList.appendChild(newBtn);

  switchChat(newChatId);
}

document.getElementById("chat1").onclick = () => switchChat("chat1");
document.getElementById("chat2").onclick = () => switchChat("chat2");
document.getElementById("chat3").onclick = () => switchChat("chat3");

document.getElementById("new-chat-btn").onclick = createNewChat;

function appendMessageToUI(role, content, type = "text") {
  const chatArea = document.getElementById("chat-area");
  let messageHTML = "";
  if (type === "image") {
    messageHTML = `<div class="message bot-message"><img src="${content}" alt="Generated Image" style="max-width: 100%; border-radius: 8px;"/></div>`;
  } else {
    const messageClass = role === "user" ? "user-message" : "bot-message";
    messageHTML = `<div class="message ${messageClass}">${content}</div>`;
  }
  chatArea.insertAdjacentHTML("beforeend", messageHTML);
  scrollToBottom();
}

function scrollToBottom() {
  const chatArea = document.getElementById("chat-area");
  chatArea.scrollTop = chatArea.scrollHeight;
}

document.forms[0].onsubmit = async function (event) {
  event.preventDefault();
  const promptInput = document.forms[0].elements["prompt"];
  const promptMessage = promptInput.value.trim();
  const selectedModel = document.getElementById("model-select").value;

  if (promptMessage === "") return;

  appendMessageToUI("user", promptMessage, "text");
  allChats[currentChatId].push({
    role: "user",
    content: promptMessage,
    type: "text",
  });
  promptInput.value = "";

  if (selectedModel === "image") {
    try {
      const loadingId = "loading-" + Date.now();
      // Use insertAdjacentHTML for smoother addition without resetting scroll
      document
        .getElementById("chat-area")
        .insertAdjacentHTML(
          "beforeend",
          `<div id="${loadingId}" class="message bot-message">Generating image...</div>`
        );
      scrollToBottom();

      const imageUrl = await SendToImageGenAPI(promptMessage);

      document.getElementById(loadingId).remove();
      appendMessageToUI("assistant", imageUrl, "image");
      allChats[currentChatId].push({
        role: "assistant",
        content: imageUrl,
        type: "image",
      });
    } catch (error) {
      const loadingEl = document.querySelector(
        ".message.bot-message:last-child"
      );
      if (loadingEl && loadingEl.textContent.includes("Generating")) {
        loadingEl.remove();
      }
      appendMessageToUI(
        "assistant",
        "Error generating image. Please check console."
      );
      console.error(error);
    }
  } else {
    const currentHistoryForAPI = allChats[currentChatId]
      .filter((msg) => msg.type === "text")
      .map((msg) => ({ role: msg.role, content: msg.content }));

    SendToGenModelAPI(promptMessage, currentHistoryForAPI).then(
      (responseMessage) => {
        appendMessageToUI("assistant", responseMessage, "text");
        allChats[currentChatId].push({
          role: "assistant",
          content: responseMessage,
          type: "text",
        });
      }
    );
  }
};

async function SendToGenModelAPI(prompt, history) {
  try {
    const response = await fetch(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer fw_3ZgkT4AicFboZUWvuHa8HHpY", // ⚠️ Ensure this key is valid
        },
        body: JSON.stringify({
          model: "accounts/fireworks/models/gpt-oss-20b",
          messages: [...history],
        }),
      }
    );
    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Text API Error:", error);
    return "Sorry, an error occurred.";
  }
}

// === FIXED FUNCTION ===
async function SendToImageGenAPI(prompt) {
  try {
    const response = await fetch(
      "https://api.fireworks.ai/inference/v1/image_generation/accounts/fireworks/models/playground-v2-1024px-aesthetic",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Tell API we prefer JSON, but standard endpoint might ignore this and send binary
          Accept: "application/json, image/jpeg",
          Authorization: "Bearer fw_3ZgkT4AicFboZUWvuHa8HHpY", // ⚠️ Ensure this key is valid
        },
        body: JSON.stringify({
          prompt: prompt,
          height: 1024,
          width: 1024,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");

    // Handle binary image response (standard for some Fireworks endpoints if not explicitly asking for URL)
    if (contentType && contentType.includes("image")) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }

    // Handle JSON response (containing URL or Base64)
    if (contentType && contentType.includes("application/json")) {
      const result = await response.json();
      // Robust parsing for different JSON formats
      if (Array.isArray(result) && result.length > 0) {
        if (result[0].base64)
          return `data:image/jpeg;base64,${result[0].base64}`;
        if (result[0].url) return result[0].url;
      } else if (result.base64) {
        return `data:image/jpeg;base64,${result.base64}`;
      } else if (result.url) {
        return result.url;
      }
    }

    throw new Error("Unexpected response format from API");
  } catch (error) {
    console.error("Image Gen Error Details:", error);
    throw error;
  }
}

switchChat("chat1");
