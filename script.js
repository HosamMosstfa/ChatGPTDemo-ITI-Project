//adding event listener to the form submission to append user message to chat area
document.forms[0].onsubmit = function (event) {
  event.preventDefault();
  var promptMessage = document.forms[0].elements["prompt"].value;
  var newChatMessage = ` <div class="message user-message">${promptMessage}</div>`;
  document.getElementById("chat-area").innerHTML += newChatMessage;
  document.forms[0].elements["prompt"].value = "";
  document.getElementById("chat-area").scrollTop =
    document.getElementById("chat-area").scrollHeight;
};
