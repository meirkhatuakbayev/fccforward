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

function onYearChange(yr) {
    const title = document.getElementById("mainTitle");
    if (!title) return;
    title.innerHTML = _fwdSub === "vozvrat"
        ? `Возврат зерна&nbsp;— форвардный закуп ${yr}`
        : `Форвардный закуп урожая&nbsp;${yr} года`;
    // TODO: подгружать данные за выбранный год (когда будут файлы FZ24/FZ25)
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
    if (sub === "vozvrat") ensureVozvrat();
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
