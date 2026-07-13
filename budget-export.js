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

  function shortReceiptNo(row) {
    const raw = String(row.id || "").replace(/[^a-zA-Z0-9]/g, "");
    const suffix = (raw.slice(-8) || "00000000").toUpperCase();
    return `${row.type === "공판장 주문" ? "주문" : "예약"}-${suffix}`;
  }

  function normalizeRows(selectedId = "") {
    const snapshot = window.motfGetUsageSnapshot?.() || { reservations: [], orders: [] };
    const reservations = (snapshot.reservations || []).map((item) => ({
      id: item.id,
      type: "숙소 예약",
      category: "숙소",
      place: item.stayName || "숙소",
      itemName: item.roomName || "예약 상품",
      date: [item.date, item.checkOutDate].filter(Boolean).join(" ~ ") || item.date || "",
      people: item.people || "-",
      status: item.status || "-",
      amount: Number(item.amount || 0),
      refundAmount: Number(item.refundAmount || 0),
      purchaseMethod: "moTF 예약",
      note: item.isPendingVirtualAccount ? "가상계좌 입금 대기" : "예약/결제 증빙",
    }));
    const orders = (snapshot.orders || []).map((item) => ({
      id: item.id,
      type: "공판장 주문",
      category: "식자재 및 일회용품",
      place: item.storeName || "공판장",
      itemName: `공판장 주문 ${Array.isArray(item.items) ? item.items.length : 0}개 품목`,
      date: item.pickupTime || "",
      people: "-",
      status: item.status || "-",
      amount: Number(item.amount || 0),
      refundAmount: Number(item.refundAmount || 0),
      purchaseMethod: "moTF 공판장 주문",
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
              <p>발급일 ${escapeHtml(formatDate(report.generatedAt))}</p>
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
                  <th>분류</th>
                  <th>#</th>
                  <th>항목</th>
                  <th>단가</th>
                  <th>수량</th>
                  <th>합계</th>
                  <th>구매 방식</th>
                  <th>비고</th>
                  <th>증빙번호</th>
                </tr>
              </thead>
              <tbody>
                ${report.rows.map((row, index) => `
                  <tr>
                    <td>${escapeHtml(row.category)}</td>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(row.itemName)}</td>
                    <td>${money(row.amount)}</td>
                    <td>1</td>
                    <td>${money(row.amount - row.refundAmount)}</td>
                    <td>${escapeHtml(row.purchaseMethod)}</td>
                    <td>${escapeHtml([row.place, row.date, row.status, row.note].filter(Boolean).join(" · "))}</td>
                    <td>${escapeHtml(shortReceiptNo(row))}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5">총합</td>
                  <td>${money(report.payableTotal)}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    `;
    window.refreshIcons?.();
  }

  function budgetSheetRows(report) {
    const rows = [
      [],
      ["", `${new Date().getFullYear()} moTF 예결산안`],
      ["", "", "분류", "#", "항목", "단가", "수량", "합계", "구매 방식", "비고", "증빙번호"],
    ];
    report.rows.forEach((row, index) => {
      const excelRow = index + 4;
      rows.push([
        "",
        index === 0 ? "지출" : "",
        row.category,
        index + 1,
        row.itemName,
        row.amount,
        1,
        { f: `F${excelRow}*G${excelRow}-${row.refundAmount || 0}` },
        row.purchaseMethod,
        [row.place, row.date, row.status, row.note].filter(Boolean).join(" · "),
        shortReceiptNo(row),
      ]);
    });
    const totalRow = rows.length + 1;
    rows.push(["", "", "", "총합", "", "", "", { f: `SUM(H4:H${totalRow - 1})` }, "", `발급일 ${report.generatedAt}`, ""]);
    return rows;
  }

  function checklistRows(report) {
    return [
      ["분류", "#", "항목", "수량", "수령/이용 장소", "결제 확인", "이용 완료", "담당", "비고", "", "증빙번호", "물품"],
      ...report.rows.map((row, index) => [
        row.category,
        index + 1,
        row.itemName,
        1,
        row.place,
        row.status && !String(row.status).includes("입금 전") ? "O" : "",
        String(row.status || "").includes("완료") || String(row.status || "").includes("확정") ? "O" : "",
        "",
        row.note,
        "",
        shortReceiptNo(row),
        row.type === "공판장 주문" ? row.itemName : `${row.place} ${row.itemName}`.trim(),
      ]),
    ];
  }

  function workbookRows(report) {
    return budgetSheetRows(report);
  }

  function downloadCsvFallback(report) {
    const rows = workbookRows(report);
    const csv = rows.map((row) => row.map((cell) => {
      const value = cell && typeof cell === "object" && "f" in cell ? `=${cell.f}` : cell;
      return `"${String(value ?? "").replaceAll('"', '""')}"`;
    }).join(",")).join("\n");
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
    const worksheet = window.XLSX.utils.aoa_to_sheet(budgetSheetRows(report));
    worksheet["!merges"] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 9 } },
      ...(report.rows.length ? [{ s: { r: 3, c: 1 }, e: { r: 2 + report.rows.length, c: 1 } }] : []),
    ];
    worksheet["!cols"] = [
      { wch: 4 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 28 },
      { wch: 13 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 46 }, { wch: 16 },
    ];
    worksheet["!rows"] = [
      { hpt: 8 },
      { hpt: 28 },
      { hpt: 22 },
      ...report.rows.map(() => ({ hpt: 28 })),
      { hpt: 24 },
    ];
    for (let rowIndex = 4; rowIndex <= report.rows.length + 4; rowIndex += 1) {
      ["F", "H"].forEach((col) => {
        const cell = worksheet[`${col}${rowIndex}`];
        if (cell) cell.z = "#,##0";
      });
    }
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "예산안");

    const checklist = window.XLSX.utils.aoa_to_sheet(checklistRows(report));
    checklist["!cols"] = [
      { wch: 16 }, { wch: 8 }, { wch: 28 }, { wch: 8 }, { wch: 22 }, { wch: 10 },
      { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 4 }, { wch: 16 }, { wch: 28 },
    ];
    window.XLSX.utils.book_append_sheet(workbook, checklist, "물품 체크리스트");
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
