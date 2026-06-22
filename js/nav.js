function setMapView(tab) {
    const map = tab === "map", wx = tab === "weather", tabv = tab === "tab", ai = tab === "ai";
    $("#mapWrap").style.display = map ? "" : "none";
    $("#mapLegend").style.display = map ? "" : "none";
    $("#regTableWrap").style.display = tabv ? "" : "none";
    $("#wxWrap").style.display = wx ? "" : "none";
    $("#aiWrap").style.display = ai ? "" : "none";
    $("#mapHint").textContent = map ? "Цвет — освоение лимита, подпись — область и число СХТП. Нажмите область — список контрагентов." :
        tabv ? "Таблица по областям (суммы — млн ₸, объём — тонн). Нажмите строку — список контрагентов." :
        wx ? "Погода и влагообеспеченность по профинансированным областям — для весенне-полевых работ." : "AI-ассистент";
    $("#vMap").classList.toggle("act", map);
    $("#vTab").classList.toggle("act", tabv);
    $("#vWx").classList.toggle("act", wx);
    $("#vAi").classList.toggle("act", ai);
    if (tabv) renderRegionTable();
    if (wx) loadWeather();
}

function switchView(v) {
    document.getElementById("viewReport").style.display = v === "report" ? "" : "none";
    const pr = document.getElementById("viewPriamoy"); if (pr) pr.style.display = v === "priamoy" ? "" : "none";
    document.querySelectorAll(".navb").forEach(b => b.classList.toggle("act", b.dataset.view === v));
    const title = document.getElementById("mainTitle");
    if (v === "priamoy") title.innerHTML = "Прямой закуп&nbsp;2026 года";
    else title.innerHTML = "Форвардный закуп урожая&nbsp;2026 года";
}
