(function connectMtProjects() {
  const client = window.motfSupabase;
  if (!client || typeof window.motfApplyMtProject !== "function") return;

  let currentProject = null;
  let currentUser = null;
  const projectFields = "id, owner_id, title, organization_name, region, starts_on, ends_on, guest_count, status, final_business_id, final_reservation_id, estimated_budget, created_at, updated_at";
  const itemFields = "id, project_id, item_kind, reference_id, title, quantity, amount, status, note, created_at, updated_at";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function requireUser() {
    if (!currentUser) throw new Error("로그인하면 내 MT를 저장하고 여러 기기에서 이어서 준비할 수 있어요.");
    return currentUser;
  }

  async function candidateDetails(projectId) {
    const { data: candidates, error } = await client.from("mt_project_candidates")
      .select("id, project_id, business_id, offering_id, estimated_cost, sort_order")
      .eq("project_id", projectId)
      .order("sort_order");
    if (error) throw error;
    const businessIds = [...new Set((candidates || []).map((item) => item.business_id).filter(Boolean))];
    if (!businessIds.length) return [];
    const { data: businesses, error: businessError } = await client.from("businesses")
      .select("id, business_name, address, cover_image_url, bath_count, station_distance_m")
      .in("id", businessIds);
    if (businessError) throw businessError;
    const byId = new Map((businesses || []).map((business) => [business.id, business]));
    return (candidates || []).map((candidate) => ({ ...candidate, business: byId.get(candidate.business_id) || null }));
  }

  async function projectChildren(projectId) {
    const [itineraryResult, noticeResult, itemResult] = await Promise.all([
      client.from("mt_itinerary_items").select("id, starts_at, title, place, note, sort_order").eq("project_id", projectId).order("starts_at").order("sort_order"),
      client.from("mt_notices").select("id, body, is_pinned, created_at").eq("project_id", projectId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
      client.from("mt_project_items").select(itemFields).eq("project_id", projectId).neq("status", "cancelled").order("created_at"),
    ]);
    if (itineraryResult.error) throw itineraryResult.error;
    if (noticeResult.error) throw noticeResult.error;
    if (itemResult.error) throw itemResult.error;
    return { itinerary: itineraryResult.data || [], notices: noticeResult.data || [], items: itemResult.data || [] };
  }

  async function loadProjects() {
    const { data: sessionData } = await client.auth.getSession();
    currentUser = sessionData.session?.user || null;
    currentProject = null;
    if (!currentUser) {
      window.motfApplyMtProjects?.([]);
      return [];
    }
    const { data: projects, error } = await client.from("mt_projects")
      .select(projectFields)
      .eq("owner_id", currentUser.id)
      .order("starts_on", { ascending: false });
    if (error) throw error;
    const projectIds = (projects || []).map((project) => project.id);
    let items = [];
    if (projectIds.length) {
      const { data, error: itemError } = await client.from("mt_project_items")
        .select(itemFields)
        .in("project_id", projectIds)
        .neq("status", "cancelled");
      if (itemError) throw itemError;
      items = data || [];
    }
    const hydrated = (projects || []).map((project) => ({ ...project, items: items.filter((item) => item.project_id === project.id) }));
    window.motfApplyMtProjects?.(hydrated);
    return hydrated;
  }

  window.motfSelectMtProject = async function selectMtProject(projectId) {
    requireUser();
    const { data: project, error } = await client.from("mt_projects")
      .select(projectFields)
      .eq("id", projectId)
      .eq("owner_id", currentUser.id)
      .single();
    if (error) throw error;
    const [children, candidates] = await Promise.all([projectChildren(project.id), candidateDetails(project.id)]);
    currentProject = { ...project, ...children };
    window.motfApplyMtProject(currentProject, candidates);
    return currentProject;
  };

  window.motfCreateMtProject = async function createMtProject(payload) {
    const user = requireUser();
    const { data, error } = await client.from("mt_projects")
      .insert({ ...payload, owner_id: user.id, status: "planning" })
      .select(projectFields)
      .single();
    if (error) throw error;
    currentProject = { ...data, itinerary: [], notices: [], items: [] };
    await loadProjects();
    currentProject = { ...data, itinerary: [], notices: [], items: [] };
    window.motfApplyMtProject(currentProject, []);
    return currentProject;
  };

  function ensureProject() {
    requireUser();
    if (!currentProject) throw new Error("내 MT에서 여행을 먼저 선택하거나 새로 만들어주세요.");
    return currentProject;
  }

  window.motfSaveMtProject = async function saveMtProject(payload) {
    const project = ensureProject();
    const { data, error } = await client.from("mt_projects")
      .update(payload)
      .eq("id", project.id)
      .eq("owner_id", currentUser.id)
      .select(projectFields)
      .single();
    if (error) throw error;
    currentProject = { ...currentProject, ...data };
    window.motfApplyMtProject(currentProject, null);
    return data;
  };

  window.motfSaveMtCandidate = async function saveMtCandidate(businessId, shouldAdd) {
    const project = ensureProject();
    if (shouldAdd) {
      const estimate = window.motfGetMtCandidateEstimate?.(businessId) || {};
      const { error } = await client.from("mt_project_candidates").upsert({
        project_id: project.id,
        business_id: businessId,
        estimated_cost: estimate,
        sort_order: Date.now() % 1000000,
      }, { onConflict: "project_id,business_id" });
      if (error) throw error;
    } else {
      const { error } = await client.from("mt_project_candidates").delete().eq("project_id", project.id).eq("business_id", businessId);
      if (error) throw error;
    }
  };

  window.motfSetMtStayItem = async function setMtStayItem({ business_id, title, amount }) {
    const project = ensureProject();
    const oldIds = (currentProject.items || []).filter((item) => item.item_kind === "stay").map((item) => item.id).filter((id) => uuidPattern.test(String(id)));
    if (oldIds.length) {
      const { error: deleteError } = await client.from("mt_project_items").delete().in("id", oldIds);
      if (deleteError) throw deleteError;
    }
    const payload = { project_id: project.id, item_kind: "stay", title, quantity: 1, amount, status: "planned" };
    if (uuidPattern.test(String(business_id))) payload.reference_id = business_id;
    const { data, error } = await client.from("mt_project_items").insert(payload).select(itemFields).single();
    if (error) throw error;
    currentProject.items = [...(currentProject.items || []).filter((item) => item.item_kind !== "stay"), data];
    return data;
  };

  window.motfAddMtShoppingItem = async function addMtShoppingItem({ product_id, title, quantity, amount }) {
    const project = ensureProject();
    const existing = (currentProject.items || []).find((item) => item.item_kind === "shopping" && String(item.reference_id) === String(product_id));
    if (existing && uuidPattern.test(String(existing.id))) {
      const { data, error } = await client.from("mt_project_items")
        .update({ quantity: Number(existing.quantity || 1) + Number(quantity || 1), amount })
        .eq("id", existing.id)
        .select(itemFields)
        .single();
      if (error) throw error;
      currentProject.items = currentProject.items.map((item) => item.id === data.id ? data : item);
      return data;
    }
    const payload = { project_id: project.id, item_kind: "shopping", title, quantity, amount, status: "planned" };
    if (uuidPattern.test(String(product_id))) payload.reference_id = product_id;
    const { data, error } = await client.from("mt_project_items").insert(payload).select(itemFields).single();
    if (error) throw error;
    currentProject.items = [...(currentProject.items || []), data];
    return data;
  };

  window.motfRemoveMtItem = async function removeMtItem(itemId) {
    const project = ensureProject();
    if (!uuidPattern.test(String(itemId))) return;
    const { error } = await client.from("mt_project_items").delete().eq("id", itemId).eq("project_id", project.id);
    if (error) throw error;
    currentProject.items = (currentProject.items || []).filter((item) => item.id !== itemId);
  };

  window.motfAddMtItinerary = async function addMtItinerary(payload) {
    const project = ensureProject();
    const { data, error } = await client.from("mt_itinerary_items")
      .insert({ ...payload, project_id: project.id, sort_order: Date.now() % 1000000 })
      .select("id, starts_at, title, place, note, sort_order")
      .single();
    if (error) throw error;
    currentProject.itinerary = [...(currentProject.itinerary || []), data].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    return data;
  };

  window.motfAddMtNotice = async function addMtNotice(payload) {
    const project = ensureProject();
    const { data, error } = await client.from("mt_notices")
      .insert({ ...payload, project_id: project.id, author_id: currentUser.id })
      .select("id, body, is_pinned, created_at")
      .single();
    if (error) throw error;
    currentProject.notices = [data, ...(currentProject.notices || [])];
    return data;
  };

  loadProjects().catch((error) => console.warn("MT 목록을 불러오지 못했습니다.", error));
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id !== currentUser?.id) loadProjects().catch(console.warn);
  });
})();
