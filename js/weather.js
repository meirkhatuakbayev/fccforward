const REGION_CITY = {
    "Акмолинская":           {c: "Кокшетау",        lat: 53.28, lon: 69.39},
    "Костанайская":          {c: "Костанай",         lat: 53.21, lon: 63.62},
    "Северо-Казахстанская":  {c: "Петропавловск",    lat: 54.87, lon: 69.15},
    "Павлодарская":          {c: "Павлодар",         lat: 52.28, lon: 76.95},
    "Восточно-Казахстанская":{c: "Усть-Каменогорск", lat: 49.97, lon: 82.60},
    "Абайская":              {c: "Семей",            lat: 50.41, lon: 80.25},
    "Карагандинская":        {c: "Караганда",        lat: 49.80, lon: 73.10},
    "Алматинская":           {c: "Талдыкорган",      lat: 45.02, lon: 78.38},
    "Актюбинская":           {c: "Актобе",           lat: 50.28, lon: 57.17},
    "Западно-Казахстанская": {c: "Уральск",          lat: 51.23, lon: 51.37}
};

async function fetchWx(city) {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m&hourly=soil_moisture_0_to_7cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`;
    const r = await fetch(u); if (!r.ok) throw new Error("wx"); return r.json();
}

function assessWx(w) {
    const d = w.daily;
    const cur = (w.current && w.current.temperature_2m != null) ? w.current.temperature_2m : d.temperature_2m_max[0];
    const hum = (w.current && w.current.relative_humidity_2m != null) ? w.current.relative_humidity_2m : null;
    const precip = d.precipitation_sum.slice(0, 7).reduce((a, b) => a + (b || 0), 0);
    let soil = null;
    if (w.hourly && w.hourly.soil_moisture_0_to_7cm) {
        const arr = w.hourly.soil_moisture_0_to_7cm;
        const idx = Math.min(arr.length - 1, (new Date()).getHours());
        soil = arr[idx]; if (soil == null) soil = arr.find(v => v != null);
    }
    const soilPct = soil != null ? Math.round(soil * 100) : null;
    let cls, txt;
    if ((soilPct != null && soilPct < 14) || (precip < 3)) { cls = "dry"; txt = "Сухо · недостаток влаги"; }
    else if ((soilPct != null && soilPct > 42) || precip > 40) { cls = "wet"; txt = "Переувлажнение"; }
    else { cls = "ok"; txt = "Влагообеспеченность в норме"; }
    return {cur: Math.round(cur), hum: hum != null ? Math.round(hum) : null, precip: Math.round(precip), soilPct, cls, txt, daily: d};
}

function fillWxRegionCard(card, name, city, a) {
    const dn = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const daysHTML = a.daily.time.slice(0, 5).map((t, i) => {
        const dt = new Date(t);
        return `<div class="wxday">${dn[dt.getDay()]}<div class="wd-t">${Math.round(a.daily.temperature_2m_max[i])}°</div><div class="wd-p">${(a.daily.precipitation_sum[i] || 0).toFixed(0)} мм</div></div>`;
    }).join("");
    card.innerHTML = `<h4>${name}</h4><div class="wsub">${city.c}</div>
        <div class="wtemp">${a.cur}°<small> сейчас</small></div>
        <span class="wxbadge ${a.cls}">${a.txt}</span>
        <div class="wxmet">
            ${a.soilPct != null ? `<div><span class="wm-l">Влага почвы</span><span class="wm-v">${a.soilPct}%</span></div>` : ""}
            ${a.hum != null ? `<div><span class="wm-l">Влажность воздуха</span><span class="wm-v">${a.hum}%</span></div>` : ""}
            <div><span class="wm-l">Осадки за 7 дней</span><span class="wm-v">${a.precip} мм</span></div>
        </div>
        <div class="wxdays">${daysHTML}</div>`;
}

function loadWeather() {
    const grid = document.getElementById("wxGrid"); if (!grid) return; grid.innerHTML = "";
    const regs = (D ? D.regions.filter(r => r.fin[0] > 0 || r.fin[3] > 0) : []).map(r => r.name).sort((a, b) => a.localeCompare(b, "ru"));
    if (!regs.length) { grid.innerHTML = '<div class="an-note">Нет профинансированных областей.</div>'; return; }
    regs.forEach(name => {
        const city = REGION_CITY[name]; if (!city || !city.lat) return;
        const card = el("div", "wxc"); card.innerHTML = `<h4>${name}</h4><div class="wsub">${city.c} · загрузка…</div>`; grid.appendChild(card);
        fetchWx(city).then(w => fillWxRegionCard(card, name, city, assessWx(w))).catch(() => {
            const s = card.querySelector(".wsub"); if (s) s.textContent = city.c + " · нет данных";
        });
    });
}
