function printPDF() {
    if (!D) { alert("Данные ещё загружаются."); return; }
    const wrap = $("#regTableWrap");
    renderRegionTable();
    wrap.style.removeProperty("display");
    window.print();
    setTimeout(() => { wrap.style.display = "none"; }, 300);
}
