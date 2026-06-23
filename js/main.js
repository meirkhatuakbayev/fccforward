// Запуск колосков на экране загрузки
buildWheat();

// Сортировка в таблице контрагентов
document.querySelectorAll("thead th").forEach(th => th.addEventListener("click", () => {
    const k = th.dataset.s; if (!k) return;
    if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = (k === "name" || k === "cult") ? 1 : -1; }
    if (listMode) renderRows();
}));

// Закрытие панели области
$("#rClose").addEventListener("click", () => {
    $("#regionPanel").style.display = "none"; curRegion = null; listMode = null; markStatusChip(null);
    document.querySelectorAll(".bub,.geopath").forEach(b => b.classList.remove("sel"));
});

// Закрытие модалки кликом вне / Escape
$("#ov").addEventListener("click", e => { if (e.target.id === "ov") closeOv(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeOv(); });

// Переключение вкладок навигации (Форвардный / Прямой)
const sidebar = document.getElementById("side");
const toggleBtn = document.getElementById("sidebarToggle");

document.querySelectorAll(".navb").forEach(b => b.addEventListener("click", () => {
    switchView(b.dataset.view);
    if (window.innerWidth <= 760) sidebar.classList.remove("visible");
}));

// Боковая панель — открыть/закрыть кнопкой
toggleBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (window.innerWidth <= 760) { sidebar.classList.toggle("visible"); }
    else { sidebar.style.display = sidebar.style.display === "none" ? "flex" : "none"; }
});

// Закрыть боковую панель кликом вне неё (мобильные)
document.addEventListener("click", e => {
    if (window.innerWidth <= 760 && sidebar.classList.contains("visible") &&
        !sidebar.contains(e.target)) {
        sidebar.classList.remove("visible");
    }
});

// Карта: зум и переключение видов
$("#zIn").addEventListener("click", () => mapZoomBy(1.6));
$("#zOut").addEventListener("click", () => mapZoomBy(0.62));
$("#zReset").addEventListener("click", mapZoomReset);
$("#vMap").addEventListener("click", () => setMapView("map"));
$("#vTab").addEventListener("click", () => setMapView("tab"));
$("#vWx").addEventListener("click", () => setMapView("weather"));
$("#vAi").addEventListener("click", () => setMapView("ai"));

// Обновить данные / Скачать PDF
document.getElementById("btnRefresh").addEventListener("click", loadData);
document.getElementById("btnPrint").addEventListener("click", () => {
    if (_fwdSub === "vozvrat") printReturnSection();
    else printPDF();
});

// Загрузка данных
loadGeoData().then(() => { loadData(); });

// Страховка: если через 15 сек лоадер всё ещё висит — скрываем принудительно
setTimeout(hideLoader, 15000);
