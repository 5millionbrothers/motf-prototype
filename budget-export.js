(function connectBudgetExport() {
  const state = {
    selectedId: "",
    report: null,
  };

  const money = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;
  const escapeHtml = window.motfEscapeHtml || ((value) => String(value ?? ""));

  function todayText() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function normalizeRows(selectedId = "") {
    const snapshot = window.motfGetUsageSnapshot?.() || { reservations: [], orders: [] };
    const reservations = (snapshot.reservations || []).map((item) => ({
      id: item.id,
      type: "숙소 예약",
      place: item.stayName || "숙소",
      itemName: item.roomName || "예약 상품",
      date: [item.date, item.checkOutDate].filter(Boolean).join(" ~ ") || item.date || "",
      people: item.people || "-",
      status: item.status || "-",
      amount: Number(item.amount || 0),
      refundAmount: Number(item.refundAmount || 0),
      note: item.isPendingVirtualAccount ? "가상계좌 입금 대기" : "예약/결제 증빙",
    }));
    const orders = (snapshot.orders || []).map((item) => ({
      id: item.id,
      type: "공판장 주문",
      place: item.storeName || "공판장",
      itemName: `공판장 주문 ${Array.isArray(item.items) ? item.items.length : 0}개 품목`,
      date: item.pickupTime || "",
      people: "-",
      status: item.status || "-",
      amount: Number(item.amount || 0),
      refundAmount: Number(item.refundAmount || 0),
      note: item.isPendingVirtualAccount ? "가상계좌 입금 대기" : "주문/결제 증빙",
    }));
    const allRows = [...reservations, ...orders];
    if (!selectedId) return allRows;
    const selected = allRows.find((row) => String(row.id) === String(selectedId));
    return selected ? [selected] : allRows;
  }

  function buildReport(selectedId = "") {
    const rows = normalizeRows(selectedId);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const refundTotal = rows.reduce((sum, row) => sum + row.refundAmount, 0);
    const payableTotal = total - refundTotal;
    const first = rows[0] || {};
    return {
      generatedAt: todayText(),
      title: rows.length === 1 ? `${first.place || "MOTF"} 예결산 증빙` : "MOTF 전체 이용 예결산 증빙",
      fileName: `MOTF_예결산_${todayText()}.xlsx`,
      rows,
      total,
      refundTotal,
      payableTotal,
    };
  }

  function renderEmpty(area) {
    area.innerHTML = `
      <div class="empty-state">
        아직 엑셀로 만들 이용 내역이 없습니다. 결제 완료 후 다시 확인해주세요.
      </div>
    `;
  }

  function renderPreview() {
    const area = document.querySelector("#budgetPreviewArea");
    if (!area) return;
    const report = state.report || buildReport(state.selectedId);
    state.report = report;
    if (!report.rows.length) {
      renderEmpty(area);
      return;
    }

    area.innerHTML = `
      <div class="budget-preview-shell">
        <section class="budget-receipt">
          <div class="budget-receipt-head">
            <div>
              <p class="eyebrow">MOTF RECEIPT</p>
              <h2>${escapeHtml(report.title)}</h2>
              <p>발급일 ${escapeHtml(formatDate(report.generatedAt))} · 학생회/동행자 공유용 증빙 파일</p>
            </div>
            <div class="pill success">다운로드 전 미리보기</div>
          </div>
          <div class="budget-summary-grid">
            <div class="budget-summary-card"><span>총 건수</span><strong>${report.rows.length}건</strong></div>
            <div class="budget-summary-card"><span>총 결제금액</span><strong>${money(report.total)}</strong></div>
            <div class="budget-summary-card"><span>환불/차감</span><strong>${money(report.refundTotal)}</strong></div>
            <div class="budget-summary-card"><span>증빙 합계</span><strong>${money(report.payableTotal)}</strong></div>
          </div>
          <div class="budget-table-wrap">
            <table class="budget-table">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>번호</th>
                  <th>업체/장소</th>
                  <th>항목</th>
                  <th>일정</th>
                  <th>인원</th>
                  <th>상태</th>
                  <th>결제금액</th>
                  <th>환불/차감</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                ${report.rows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.type)}</td>
                    <td>${escapeHtml(row.id)}</td>
                    <td>${escapeHtml(row.place)}</td>
                    <td>${escapeHtml(row.itemName)}</td>
                    <td>${escapeHtml(row.date || "-")}</td>
                    <td>${escapeHtml(row.people)}</td>
                    <td>${escapeHtml(row.status)}</td>
                    <td>${money(row.amount)}</td>
                    <td>${money(row.refundAmount)}</td>
                    <td>${escapeHtml(row.note)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="7">합계</td>
                  <td>${money(report.total)}</td>
                  <td>${money(report.refundTotal)}</td>
                  <td>${money(report.payableTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    `;
    window.refreshIcons?.();
  }

  function workbookRows(report) {
    return [
      ["MOTF 예결산 증빙"],
      ["발급일", report.generatedAt],
      ["파일명", report.fileName],
      [],
      ["구분", "번호", "업체/장소", "항목", "일정", "인원", "상태", "결제금액", "환불/차감", "증빙 합계", "비고"],
      ...report.rows.map((row) => [
        row.type,
        row.id,
        row.place,
        row.itemName,
        row.date || "-",
        row.people,
        row.status,
        row.amount,
        row.refundAmount,
        row.amount - row.refundAmount,
        row.note,
      ]),
      [],
      ["합계", "", "", "", "", "", "", report.total, report.refundTotal, report.payableTotal, ""],
    ];
  }

  function downloadCsvFallback(report) {
    const rows = workbookRows(report);
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = report.fileName.replace(/\.xlsx$/i, ".csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function downloadExcel() {
    const report = state.report || buildReport(state.selectedId);
    if (!report.rows.length) {
      window.toast?.("다운로드할 이용 내역이 없습니다.");
      return;
    }
    if (!window.XLSX) {
      downloadCsvFallback(report);
      window.toast?.("엑셀 호환 CSV 파일로 다운로드했습니다.");
      return;
    }
    const worksheet = window.XLSX.utils.aoa_to_sheet(workbookRows(report));
    worksheet["!cols"] = [
      { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 28 }, { wch: 18 },
      { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    ];
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "예결산 증빙");
    window.XLSX.writeFile(workbook, report.fileName);
  }

  window.motfOpenBudgetPreview = function openBudgetPreview(selectedId = "") {
    state.selectedId = selectedId;
    state.report = buildReport(selectedId);
    window.motfNavigate?.("budgetPreview");
  };

  window.motfRenderBudgetPreview = renderPreview;

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-budget-download]")) {
      downloadExcel();
    }
  });
})();
