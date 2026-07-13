(function connectCustomerSupport() {
  const client = window.motfSupabase;
  if (!client) return;

  const statusText = {
    received: "접수",
    processing: "처리 중",
    resolved: "완료",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadSupportCases() {
    const history = document.getElementById("supportCaseHistory");
    if (!history) return;
    const { data: authData } = await client.auth.getSession();
    if (!authData.session?.user) {
      history.innerHTML = "";
      return;
    }
    const { data, error } = await client.from("support_cases")
      .select("id, case_type, title, body, status, created_at")
      .eq("reporter_id", authData.session.user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return console.error(error);
    history.innerHTML = (data || []).length
      ? `<h3>최근 문의</h3>${data.map((item) => `
          <article class="support-case-item">
            <div><strong>${escapeHtml(item.title)}</strong><span class="pill">${statusText[item.status] || escapeHtml(item.status)}</span></div>
            <p>${escapeHtml(item.body)}</p>
          </article>
        `).join("")}`
      : "";
    window.refreshIcons?.();
  }

  document.getElementById("supportCaseForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { data: authData } = await client.auth.getSession();
    if (!authData.session?.user) return;
    const typeSelect = document.getElementById("supportCaseType");
    const bodyInput = document.getElementById("supportCaseBody");
    const body = bodyInput.value.trim();
    if (!body) return;
    const typeLabel = typeSelect.value;
    const caseType = typeLabel.includes("분쟁") ? "dispute" : "inquiry";
    const button = event.target.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "접수 중...";
    const { error } = await client.from("support_cases").insert({
      reporter_id: authData.session.user.id,
      case_type: caseType,
      title: typeLabel,
      body,
    });
    button.disabled = false;
    button.innerHTML = '<i data-lucide="send"></i>문의 접수';
    window.refreshIcons?.();
    if (error) {
      console.error(error);
      alert(`문의를 접수하지 못했습니다.\n${error.message}`);
      return;
    }
    bodyInput.value = "";
    await loadSupportCases();
    alert("문의가 접수되었습니다.");
  });

  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") window.setTimeout(loadSupportCases, 0);
    if (event === "SIGNED_OUT") {
      const history = document.getElementById("supportCaseHistory");
      if (history) history.innerHTML = "";
    }
  });
  window.setTimeout(loadSupportCases, 0);
})();
