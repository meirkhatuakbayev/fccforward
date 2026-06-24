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

// Обновить данные / Скачать PDF
document.getElementById("btnRefresh").addEventListener("click", () => {
    if (_fwdSub === "vozvrat") {
        DR = null;
        _returnLoaded = false;
        ["vzTabArea","vzCropArea","vzDebtArea"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el._rendered = false;
        });
        if (typeof showVzLoader === "function") showVzLoader();
        loadReturn();
    }
    loadData();
});
document.getElementById("btnPrint").addEventListener("click", () => {
    if (_fwdSub === "vozvrat") printReturnSection();
    else printPDF();
});

// Тултип при наведении на KPI-плашку
(function() {
  const tip = document.getElementById('kpiTooltip');
  if (!tip) return;
  document.addEventListener('mouseover', e => {
    const kpi = e.target.closest('.kpi[title]');
    if (!kpi) { tip.style.opacity = '0'; return; }
    tip.textContent = kpi.title;
    tip.style.opacity = '1';
  });
  document.addEventListener('mousemove', e => {
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 32) + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (!e.target.closest('.kpi[title]')) tip.style.opacity = '0';
  });
})();

// Загрузка данных — финансирование и возврат стартуют параллельно
loadGeoData().then(() => {
    loadData();
    // Возврат грузим в фоне сразу — без лоадера, чтобы при переходе данные были готовы
    _returnLoaded = true;
    loadReturn();
});

// Страховка: если через 15 сек лоадер всё ещё висит — скрываем принудительно
setTimeout(hideLoader, 15000);
