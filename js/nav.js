function setMapView(tab) {
    const map = tab === "map", wx = tab === "weather", tabv = tab === "tab";
    $("#mapWrap").style.display = map ? "" : "none";
    $("#mapLegend").style.display = map ? "" : "none";
    $("#regTableWrap").style.display = tabv ? "" : "none";
    $("#wxWrap").style.display = wx ? "" : "none";
    $("#mapHint").textContent = map ? "Цвет — освоение лимита, подпись — область и число СХТП. Нажмите область — список контрагентов." :
        tabv ? "Таблица по областям (суммы — млн ₸, объём — тонн). Нажмите строку — список контрагентов." :
        "Погода и влагообеспеченность по профинансированным областям — для весенне-полевых работ.";
    $("#vMap").classList.toggle("act", map);
    $("#vTab").classList.toggle("act", tabv);
    $("#vWx").classList.toggle("act", wx);
    if (tabv) renderRegionTable();
    if (wx) loadWeather();
}

let _fwdSub = "report";

let _ylTimer = null;

function showVzLoader() {
    const ldr  = document.getElementById("vzLoader");
    const body = document.getElementById("vzBody");
    if (ldr)  ldr.style.display  = "flex";
    if (body) body.style.display = "none";
}

function hideVzLoader() {
    const ldr  = document.getElementById("vzLoader");
    const body = document.getElementById("vzBody");
    if (ldr)  ldr.style.display  = "none";
    if (body) body.style.display = "";
}

function showYearLoader(text) {
    const yl = document.getElementById("yearLoader");
    const t  = document.getElementById("ylTitle");
    if (!yl) return;
    if (t) t.textContent = text || "Загрузка данных";
    clearTimeout(_ylTimer);
    yl.classList.add("show");
}

function hideYearLoader() {
    const yl = document.getElementById("yearLoader");
    if (!yl) return;
    // небольшая задержка чтобы контент успел отрисоваться
    _ylTimer = setTimeout(() => yl.classList.remove("show"), 120);
}

function onYearChange(yr) {
    const title = document.getElementById("mainTitle");
    if (title) title.innerHTML = _fwdSub === "vozvrat"
        ? `Возврат зерна&nbsp;— форвардный закуп ${yr}`
        : `Форвардный закуп урожая&nbsp;${yr} года`;
    D  = null;
    DR = null;
    _returnLoaded = false;
    ["vzTabArea","vzCropArea","vzDebtArea"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el._rendered = false;
    });
    // Показываем inline-скелетон в блоках KPI
    const kEl = document.getElementById("kpis");
    if (kEl) kEl.innerHTML = blockLoader("Загрузка финансирования");
    const vkEl = document.getElementById("vzKpis");
    if (vkEl) vkEl.innerHTML = blockLoader("Загрузка возврата");
    showYearLoader("Загрузка ФЗ " + yr);
    loadData(yr);
    if (_fwdSub === "vozvrat") loadReturn(yr);
}

function switchForwardSub(sub) {
    _fwdSub = sub;
    document.getElementById("viewReport").style.display = sub === "report" ? "" : "none";
    const vz = document.getElementById("viewVozvrat");
    if (vz) vz.style.display = sub === "vozvrat" ? "" : "none";
    document.querySelectorAll(".fwd-subtab").forEach(b => b.classList.toggle("act", b.dataset.sub === sub));
    const title = document.getElementById("mainTitle");
    const yr = (document.getElementById("yearSel") || {}).value || "2026";
    if (title) title.innerHTML = sub === "vozvrat"
        ? `Возврат зерна&nbsp;— форвардный закуп ${yr}`
        : `Форвардный закуп урожая&nbsp;${yr} года`;
    if (sub === "vozvrat") {
        if (!DR) {
            const vkEl = document.getElementById("vzKpis");
            if (vkEl) vkEl.innerHTML = "";
            showVzLoader();
        }
        ensureVozvrat();
    }
}

function switchView(v) {
    const isForward = v === "forward";
    const isPriamoy = v === "priamoy";

    const subtabs = document.getElementById("fwdSubtabs");
    if (subtabs) subtabs.style.display = isForward ? "" : "none";

    document.getElementById("viewReport").style.display = (isForward && _fwdSub === "report") ? "" : "none";
    const vz = document.getElementById("viewVozvrat");
    if (vz) vz.style.display = (isForward && _fwdSub === "vozvrat") ? "" : "none";
    const pr = document.getElementById("viewPriamoy");
    if (pr) pr.style.display = isPriamoy ? "" : "none";

    document.querySelectorAll(".navb").forEach(b => b.classList.toggle("act", b.dataset.view === v));

    const title = document.getElementById("mainTitle");
    const yr2 = (document.getElementById("yearSel") || {}).value || "2026";
    if (isPriamoy) title.innerHTML = `Прямой закуп&nbsp;${yr2} года`;
    else if (isForward) {
        title.innerHTML = _fwdSub === "vozvrat"
            ? `Возврат зерна&nbsp;— форвардный закуп ${yr2}`
            : `Форвардный закуп урожая&nbsp;${yr2} года`;
    }
}
