var chatHistory = [];
//adding event listener to the form submission to append user message to chat area
document.forms[0].onsubmit = function (event) {
  event.preventDefault();
  var promptMessage = document.forms[0].elements["prompt"].value;
  var newChatMessage = ` <div class="message user-message">${promptMessage}</div>`;
  document.getElementById("chat-area").innerHTML += newChatMessage;
  document.forms[0].elements["prompt"].value = "";
  document.getElementById("chat-area").scrollTop =
    document.getElementById("chat-area").scrollHeight;

  //update chat history
  chatHistory.push({ role: "user", content: promptMessage });

  //send prompt to GenAI Model API and get response
  SendToGenModelAPI(promptMessage).then((responseMessage) => {
    var newBotMessage = ` <div class="message bot-message">${responseMessage}</div>`;
    document.getElementById("chat-area").innerHTML += newBotMessage;
    document.getElementById("chat-area").scrollTop =
      document.getElementById("chat-area").scrollHeight;

    //update chat history
    chatHistory.push({ role: "assistant", content: responseMessage });
  });
};

async function SendToGenModelAPI(prompt) {
  //send prompt to GenAI Model API
  const response = await fetch(
    "https://api.fireworks.ai/inference/v1/chat/completions",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer fw_3ZgkT4AicFboZUWvuHa8HHpY",
      },
      body: JSON.stringify({
        model: "accounts/fireworks/models/gpt-oss-20b",
        messages: [...chatHistory],
      }),
    }
  );
  var result = await response.json();
  return result.choices[0].message.content;
}
