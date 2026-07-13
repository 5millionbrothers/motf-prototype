(function connectCustomerChat() {
  const client = window.motfSupabase;
  if (!client) return;

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
  let activeConversationId = "";
  let reloadTimer = 0;

  function messageBody(text, attachments) {
    const fileText = attachments.length ? `\n${attachments.map((name) => `[첨부: ${name}]`).join("\n")}` : "";
    return `${text}${fileText}`.trim();
  }

  async function loadChats(preferredId = activeConversationId) {
    const { data: authData } = await client.auth.getSession();
    if (!authData.session?.user) {
      window.motfApplyChats?.([], "");
      return;
    }
    const { data, error } = await client
      .from("conversations")
      .select("id, business_id, customer_name, group_name, last_message_at, businesses(business_name), messages(id, sender_role, body, read_at, created_at)")
      .eq("customer_id", authData.session.user.id)
      .order("last_message_at", { ascending: false });
    if (error) return console.error(error);
    const chats = (data || []).map((conversation) => {
      const messages = [...(conversation.messages || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return {
        id: conversation.id,
        title: conversation.businesses?.business_name || "업장 채팅",
        subtitle: messages.at(-1)?.body || "대화를 시작해보세요.",
        messages: messages.map((message) => ({
          from: message.sender_role === "user" ? "user" : message.sender_role === "partner" ? "owner" : "admin",
          text: message.body,
          read: Boolean(message.read_at) || message.sender_role !== "user",
        })),
      };
    });
    activeConversationId = chats.some((item) => item.id === preferredId) ? preferredId : chats[0]?.id || "";
    window.motfApplyChats?.(chats, activeConversationId);
    if (activeConversationId) {
      const { error: readError } = await client.rpc("mark_conversation_read", {
        target_conversation_id: activeConversationId,
      });
      if (readError) console.error(readError);
    }
  }

  window.motfOpenDatabaseChat = function openDatabaseChat(businessName) {
    const business = window.motfFindBusinessByName?.(businessName);
    if (!business || !isUuid(business.id)) return false;
    void (async () => {
      const { data: authData } = await client.auth.getSession();
      if (!authData.session?.user) {
        alert("채팅을 시작하려면 먼저 로그인해주세요.");
        window.motfNavigate?.("chat");
        return;
      }
      const { data, error } = await client.rpc("start_business_conversation", {
        target_business_id: business.id,
        target_reservation_id: null,
      });
      if (error) {
        console.error(error);
        alert(`채팅을 시작하지 못했습니다.\n${error.message}`);
        return;
      }
      activeConversationId = data;
      await loadChats(data);
      window.motfNavigate?.("chat");
    })();
    return true;
  };

  document.addEventListener("click", (event) => {
    const thread = event.target.closest("[data-chat-id]");
    if (thread && isUuid(thread.dataset.chatId)) activeConversationId = thread.dataset.chatId;
  }, true);

  document.addEventListener("submit", async (event) => {
    if (event.target.id !== "chatForm") return;
    const conversationId = window.motfGetActiveChatId?.();
    if (!isUuid(conversationId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = document.querySelector("#chatText");
    const attachmentInput = document.querySelector("#chatAttachment");
    const attachments = attachmentInput?.files ? [...attachmentInput.files].map((file) => file.name) : [];
    const body = messageBody(input?.value.trim() || "", attachments);
    if (!body) return;
    const button = event.target.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    const { error } = await client.rpc("send_chat_message", {
      target_conversation_id: conversationId,
      message_body: body,
    });
    if (button) button.disabled = false;
    if (error) {
      console.error(error);
      alert(`메시지를 보내지 못했습니다.\n${error.message}`);
      return;
    }
    if (input) input.value = "";
    if (attachmentInput) attachmentInput.value = "";
    activeConversationId = conversationId;
    await loadChats(conversationId);
    const messageArea = document.querySelector("#chatMessages");
    if (messageArea) messageArea.scrollTop = messageArea.scrollHeight;
  }, true);

  function scheduleReload() {
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => loadChats(activeConversationId), 250);
  }

  client.channel("customer-chat-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, scheduleReload)
    .subscribe();

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") window.setTimeout(() => loadChats(), 0);
    if (event === "SIGNED_OUT") window.motfApplyChats?.([], "");
  });
  window.setTimeout(() => loadChats(), 0);
})();
