(function setupMotfAuth() {
  const config = window.MOTF_CONFIG || {};
  const supabaseLibrary = window.supabase;

  if (!supabaseLibrary || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    console.error("moTF 로그인 설정을 불러오지 못했습니다.");
    return;
  }

  const client = supabaseLibrary.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );

  window.motfSupabase = client;

  const protectedRoutes = new Set([
    "mypage",
    "myUsage",
    "myAccount",
    "myGuide",
    "chat",
    "booking",
    "payment",
    "paymentResult",
  ]);
  const protectedFormIds = new Set([
    "bookingForm",
    "orderForm",
    "chatForm",
    "activitySubmitForm",
    "boardWriteForm",
    "activityCommentForm",
    "postCommentForm",
    "reviewForm",
  ]);

  let session = null;
  let profile = null;
  let pendingAction = null;

  function showToast(message) {
    if (typeof window.toast === "function") {
      window.toast(message);
      return;
    }
    console.info(message);
  }

  function createModal() {
    const modal = document.createElement("div");
    modal.className = "auth-modal";
    modal.id = "authModal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="auth-modal-backdrop" data-auth-close></div>
      <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <div class="auth-dialog-head">
          <div>
            <p class="eyebrow">moTF 계정</p>
            <h2 id="authTitle">로그인</h2>
          </div>
          <button class="auth-close" type="button" data-auth-close aria-label="닫기">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="auth-tabs" role="tablist">
          <button class="auth-tab active" type="button" data-auth-tab="login">로그인</button>
          <button class="auth-tab" type="button" data-auth-tab="signup">회원가입</button>
        </div>
        <form class="auth-form" id="customerLoginForm">
          <label>이메일
            <input id="customerLoginEmail" type="email" autocomplete="email" required placeholder="example@email.com" />
          </label>
          <label>비밀번호
            <input id="customerLoginPassword" type="password" autocomplete="current-password" required placeholder="비밀번호를 입력해주세요" />
          </label>
          <button class="primary-btn auth-submit" type="submit">이메일로 로그인</button>
          <div class="auth-divider"><span>또는</span></div>
          <button class="auth-kakao-btn" type="button" data-kakao-login>
            <span class="auth-kakao-symbol">K</span>카카오로 로그인
          </button>
          <button class="auth-link" type="button" data-password-reset>비밀번호를 잊으셨나요?</button>
        </form>
        <form class="auth-form" id="customerSignupForm" hidden>
          <label>이름
            <input id="customerSignupName" autocomplete="name" required maxlength="50" placeholder="이름을 입력해주세요" />
          </label>
          <label>휴대전화번호
            <input id="customerSignupPhone" type="tel" autocomplete="tel" required maxlength="20" placeholder="010-0000-0000" />
          </label>
          <label>이메일
            <input id="customerSignupEmail" type="email" autocomplete="email" required placeholder="example@email.com" />
          </label>
          <label>비밀번호
            <input id="customerSignupPassword" type="password" autocomplete="new-password" required minlength="8" placeholder="8자 이상 입력해주세요" />
          </label>
          <label>비밀번호 확인
            <input id="customerSignupPasswordConfirm" type="password" autocomplete="new-password" required minlength="8" placeholder="비밀번호를 한 번 더 입력해주세요" />
          </label>
          <label class="auth-agreement">
            <input id="customerSignupTerms" type="checkbox" required />
            <span>이용약관과 개인정보 처리방침에 동의합니다.</span>
          </label>
          <button class="primary-btn auth-submit" type="submit">회원가입</button>
          <div class="auth-divider"><span>또는</span></div>
          <button class="auth-kakao-btn" type="button" data-kakao-login>
            <span class="auth-kakao-symbol">K</span>카카오로 시작하기
          </button>
        </form>
        <form class="auth-form" id="customerPasswordForm" hidden>
          <label>새 비밀번호
            <input id="customerNewPassword" type="password" autocomplete="new-password" required minlength="8" placeholder="8자 이상 입력해주세요" />
          </label>
          <label>새 비밀번호 확인
            <input id="customerNewPasswordConfirm" type="password" autocomplete="new-password" required minlength="8" placeholder="한 번 더 입력해주세요" />
          </label>
          <button class="primary-btn auth-submit" type="submit">새 비밀번호 저장</button>
        </form>
        <p class="auth-message" id="authMessage" aria-live="polite"></p>
      </section>
    `;
    document.body.appendChild(modal);
    if (typeof window.refreshIcons === "function") window.refreshIcons();
    return modal;
  }

  const modal = createModal();
  const loginForm = document.querySelector("#customerLoginForm");
  const signupForm = document.querySelector("#customerSignupForm");
  const passwordForm = document.querySelector("#customerPasswordForm");
  const message = document.querySelector("#authMessage");

  function setMessage(text, type = "") {
    message.textContent = text;
    message.className = `auth-message ${type}`.trim();
  }

  function switchTab(tab) {
    const isLogin = tab === "login";
    loginForm.hidden = !isLogin;
    signupForm.hidden = isLogin;
    passwordForm.hidden = true;
    document.querySelector(".auth-tabs").hidden = false;
    document.querySelector("#authTitle").textContent = isLogin ? "로그인" : "회원가입";
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === tab);
    });
    setMessage("");
  }

  function openModal(tab = "login", action = null) {
    pendingAction = action;
    switchTab(tab);
    modal.hidden = false;
    document.body.classList.add("auth-modal-open");
    window.setTimeout(() => {
      document.querySelector(isSignupTab() ? "#customerSignupName" : "#customerLoginEmail")?.focus();
    }, 0);
  }

  function isSignupTab() {
    return !signupForm.hidden;
  }

  function openPasswordChange() {
    pendingAction = null;
    loginForm.hidden = true;
    signupForm.hidden = true;
    passwordForm.hidden = false;
    document.querySelector(".auth-tabs").hidden = true;
    document.querySelector("#authTitle").textContent = "새 비밀번호 설정";
    modal.hidden = false;
    document.body.classList.add("auth-modal-open");
    setMessage("새로 사용할 비밀번호를 입력해주세요.");
    window.setTimeout(() => document.querySelector("#customerNewPassword")?.focus(), 0);
  }

  function closeModal(clearAction = true) {
    modal.hidden = true;
    document.body.classList.remove("auth-modal-open");
    setMessage("");
    if (clearAction) pendingAction = null;
  }

  function requireLogin(action = null) {
    if (session?.user) return true;
    openModal("login", action);
    setMessage("이 기능은 로그인 후 이용할 수 있어요.");
    return false;
  }

  async function loadProfile() {
    profile = null;
    if (!session?.user) return;
    const { data, error } = await client
      .from("profiles")
      .select("email, full_name, phone, organization, role, status")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!error) profile = data;
    window.motfCurrentUserProfile = profile;
  }

  function updateHeader() {
    const accountButton = document.querySelector('.top-nav [data-route="mypage"]');
    if (!accountButton) return;
    accountButton.setAttribute("aria-label", session?.user ? "마이페이지" : "로그인");
    accountButton.setAttribute("title", session?.user ? "마이페이지" : "로그인");
  }

  function updateAccountView() {
    const accountForm = document.querySelector("#myAccount form.tool-panel");
    const inputs = accountForm ? [...accountForm.querySelectorAll("input")] : [];
    if (inputs[0]) {
      inputs[0].value = session?.user?.email || "";
      inputs[0].readOnly = true;
    }
    if (inputs[1]) {
      inputs[1].value = "";
      inputs[1].placeholder = "비밀번호는 보안상 표시하지 않습니다";
      inputs[1].readOnly = true;
    }
    if (inputs[2]) {
      inputs[2].value = profile?.organization || "";
      inputs[2].placeholder = "학교 또는 소속을 입력해주세요";
    }
    if (inputs[3]) inputs[3].value = profile?.phone || "";

    const dangerPanel = document.querySelector("#myAccount .danger-panel");
    if (!dangerPanel) return;
    let note = dangerPanel.querySelector(".auth-session-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "auth-session-note";
      dangerPanel.insertBefore(note, dangerPanel.querySelector("button"));
    }
    note.textContent = session?.user
      ? `${profile?.full_name || "이용자"}님 · ${session.user.email}`
      : "로그인이 필요합니다.";

    let logoutButton = dangerPanel.querySelector("[data-auth-logout]");
    if (!logoutButton) {
      logoutButton = document.createElement("button");
      logoutButton.className = "secondary-btn auth-logout-btn";
      logoutButton.type = "button";
      logoutButton.dataset.authLogout = "";
      logoutButton.innerHTML = '<i data-lucide="log-out"></i>로그아웃';
      dangerPanel.insertBefore(logoutButton, dangerPanel.querySelector("button"));
    }
    logoutButton.hidden = !session?.user;
    if (typeof window.refreshIcons === "function") window.refreshIcons();
  }

  async function refreshAuthUi() {
    await loadProfile();
    updateHeader();
    updateAccountView();
  }

  async function finishLogin() {
    await refreshAuthUi();
    const action = pendingAction;
    closeModal(false);
    pendingAction = null;
    showToast("로그인되었습니다.");
    if (typeof action === "function") action();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "로그인 중...";
    setMessage("");

    const { data, error } = await client.auth.signInWithPassword({
      email: document.querySelector("#customerLoginEmail").value.trim(),
      password: document.querySelector("#customerLoginPassword").value,
    });

    submitButton.disabled = false;
    submitButton.textContent = "이메일로 로그인";
    if (error) {
      setMessage("이메일 또는 비밀번호를 확인해주세요.", "error");
      return;
    }
    session = data.session;
    await finishLogin();
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#customerSignupPassword").value;
    const passwordConfirm = document.querySelector("#customerSignupPasswordConfirm").value;
    if (password !== passwordConfirm) {
      setMessage("두 비밀번호가 서로 다릅니다.", "error");
      return;
    }
    const submitButton = signupForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "가입 처리 중...";
    setMessage("");

    const email = document.querySelector("#customerSignupEmail").value.trim();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        data: {
          account_type: "user",
          full_name: document.querySelector("#customerSignupName").value.trim(),
          phone: document.querySelector("#customerSignupPhone").value.trim(),
        },
      },
    });

    submitButton.disabled = false;
    submitButton.textContent = "회원가입";
    if (error) {
      setMessage(error.message.includes("already")
        ? "이미 가입된 이메일입니다. 로그인해주세요."
        : `회원가입에 실패했습니다: ${error.message}`, "error");
      return;
    }

    signupForm.reset();
    if (data.session) {
      session = data.session;
      await finishLogin();
      return;
    }
    setMessage(`${email}로 인증메일을 보냈어요. 메일의 인증 링크를 누른 뒤 로그인해주세요.`, "success");
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#customerNewPassword").value;
    const confirmPassword = document.querySelector("#customerNewPasswordConfirm").value;
    if (password !== confirmPassword) {
      setMessage("두 비밀번호가 서로 다릅니다.", "error");
      return;
    }
    const submitButton = passwordForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "저장 중...";
    const { error } = await client.auth.updateUser({ password });
    submitButton.disabled = false;
    submitButton.textContent = "새 비밀번호 저장";
    if (error) {
      setMessage(`비밀번호 변경에 실패했습니다: ${error.message}`, "error");
      return;
    }
    passwordForm.reset();
    closeModal();
    showToast("비밀번호가 변경되었습니다.");
  });

  document.addEventListener("click", async (event) => {
    const closeButton = event.target.closest("[data-auth-close]");
    if (closeButton) {
      closeModal();
      return;
    }

    const tabButton = event.target.closest("[data-auth-tab]");
    if (tabButton) {
      switchTab(tabButton.dataset.authTab);
      return;
    }

    if (event.target.closest("[data-kakao-login]")) {
      setMessage("카카오 로그인은 현재 연동 준비 중입니다.");
      return;
    }

    if (event.target.closest("[data-password-reset]")) {
      const email = document.querySelector("#customerLoginEmail").value.trim();
      if (!email) {
        setMessage("비밀번호를 재설정할 이메일을 먼저 입력해주세요.", "error");
        return;
      }
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      });
      setMessage(error ? `재설정 메일 발송에 실패했습니다: ${error.message}` : "비밀번호 재설정 메일을 보냈어요.", error ? "error" : "success");
      return;
    }

    if (event.target.closest("[data-auth-logout]")) {
      await client.auth.signOut();
      session = null;
      profile = null;
      await refreshAuthUi();
      if (typeof window.navigate === "function") window.navigate("home");
      showToast("로그아웃되었습니다.");
      return;
    }

    const accountSaveButton = event.target.closest("[data-account-save]");
    if (accountSaveButton) {
      if (!requireLogin()) return;
      const accountForm = document.querySelector("#accountForm");
      const inputs = [...accountForm.querySelectorAll("input")];
      const organization = inputs[2]?.value.trim() || "";
      const phone = inputs[3]?.value.trim() || "";
      if (phone && phone.replace(/\D/g, "").length < 9) {
        showToast("연락처를 다시 확인해주세요.");
        inputs[3]?.focus();
        return;
      }

      const originalHtml = accountSaveButton.innerHTML;
      accountSaveButton.disabled = true;
      accountSaveButton.textContent = "저장 중...";
      const { data, error } = await client
        .from("profiles")
        .update({
          organization: organization || null,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id)
        .select("email, full_name, phone, organization, role, status")
        .single();
      accountSaveButton.disabled = false;
      accountSaveButton.innerHTML = originalHtml;
      if (typeof window.refreshIcons === "function") window.refreshIcons();

      if (error) {
        showToast("회원정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      profile = data;
      updateAccountView();
      showToast("회원정보가 저장되었습니다.");
    }
  });

  document.addEventListener("click", (event) => {
    if (session?.user) return;

    const routeButton = event.target.closest("[data-route]");
    const route = routeButton?.dataset.route;
    if (route && protectedRoutes.has(route)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      requireLogin(() => window.navigate?.(route));
      return;
    }

    const chatButton = event.target.closest("[data-open-chat]");
    if (chatButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const title = chatButton.dataset.openChat;
      requireLogin(() => window.ensureChat?.(title));
      return;
    }

    const protectedAction = event.target.closest(
      "[data-community-write], [data-open-recreation-form], [data-like-activity], [data-like-post], [data-focus-activity-comment], [data-focus-post-comment]",
    );
    if (protectedAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      requireLogin();
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (session?.user || !protectedFormIds.has(event.target.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    requireLogin();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  client.auth.onAuthStateChange((event, nextSession) => {
    session = nextSession;
    if (event === "SIGNED_OUT") profile = null;
    if (event === "SIGNED_OUT") window.motfCurrentUserProfile = null;
    if (event === "PASSWORD_RECOVERY") {
      window.setTimeout(openPasswordChange, 0);
    }
    window.setTimeout(refreshAuthUi, 0);
  });

  (async function initializeAuth() {
    const { data } = await client.auth.getSession();
    session = data.session;
    await refreshAuthUi();

    const activeRoute = typeof window.currentRoute === "function" ? window.currentRoute() : "home";
    if (!session?.user && protectedRoutes.has(activeRoute)) {
      window.navigate?.("home", { record: false, replace: true });
      openModal("login", () => window.navigate?.(activeRoute));
      setMessage("이 기능은 로그인 후 이용할 수 있어요.");
    }
  })();
})();
