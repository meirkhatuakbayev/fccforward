function render() {
    if (!D) return;
    $("#asof").textContent = D.date;
    renderKpis(); renderMap(); renderFunnel(); renderStatuses(); renderCrops();
    $("#footnote").innerHTML = "Источник: Департамент закупа СХП · " + D.cps.length + " контрагентов · " +
        D.regions.filter(r => r.rec[1] > 0).length + " активных областей. Обновите таблицу — дашборд подтянет изменения по кнопке «Обновить» или автоматически.";
    if (curRegion) { const rg = D.regions.find(r => r.code === curRegion.code); if (rg) curRegion = rg; }
    if (listMode) renderRows();
    if ($("#regTableWrap") && $("#regTableWrap").style.display !== "none") renderRegionTable();
}

function renderKpis() {
    const t = D.total, finPct = t.limit ? t.fin[2] / t.limit * 100 : 0;
    const nm = v => (v / 1e9).toLocaleString("ru-RU", {maximumFractionDigits: 2});
    const covHa = t.fin[3] > 0 ? (t.fin[3] * 1.5 / 1000).toLocaleString("ru-RU", {maximumFractionDigits: 1}) : "0";
    const items = [
        {lab: "Лимит по РК",              big: nm(t.limit),    unit: "млрд ₸", sub: t.limit.toLocaleString("ru-RU") + " ₸"},
        {lab: "Профинансировано",          big: nm(t.fin[2]),   unit: "млрд ₸", sub: finPct.toFixed(1) + "% от лимита", pct: finPct},
        {lab: "Законтрактованный объём",   big: fmtT(t.fin[3]),      unit: "тонн", sub: "заявлено " + fmtT(t.rec[3]) + " тонн"},
        {lab: "Охват посевных площадей",   big: covHa,               unit: "тыс. га", sub: "ориент. по законтрактованному объёму"},
        {lab: "Контрагенты · заявки",      big: t.fin[0],            unit: "СХТП", sub: t.fin[1] + " профинанс. заявок"},
    ];
    $("#kpis").innerHTML = "";
    items.forEach(it => {
        const c = el("div", "kpi");
        c.innerHTML = `<div class="tag" style="background:var(--wheat)"></div><div class="lab">${it.lab}</div>
            <div class="big num">${it.big}<small>${it.unit}</small></div><div class="sub">${it.sub}</div>
            ${it.pct != null ? `<div class="bar"><i style="width:${Math.min(100, it.pct)}%"></i></div>` : ""}`;
        $("#kpis").appendChild(c);
    });
}

function renderFunnel() {
    const f = D.funnel, max = Math.max(1, ...f.map(s => s.vol)), box = $("#funnel"); box.innerHTML = "";
    f.forEach((s, i) => {
        const w = s.vol / max * 100, conv = f[0].vol ? s.vol / f[0].vol * 100 : 0;
        const d = el("div", "fstage");
        d.innerHTML = `<div class="ft"><span>${s.k}</span><span class="muted">${conv.toFixed(1)}% от поступивших</span></div>
            <div class="ftrack ${i === 0 ? 's0' : ''}"><i style="width:${Math.max(w, 34)}%"></i>
                <div class="v">${fmtT(s.schtp)} СХТП · ${fmtT(s.vol)} тонн · ${fmtMlrd(s.sum)} ₸</div></div>`;
        box.appendChild(d);
    });
}

function renderStatuses() {
    const box = $("#statuses"); box.innerHTML = "";
    D.statuses.forEach(([name, n, cls]) => {
        const c = el("div", "chip " + cls); c.dataset.st = name;
        c.innerHTML = `<i></i>${name}<b>${n}</b>`;
        c.addEventListener("click", () => openStatus(name));
        box.appendChild(c);
    });
}

function renderCrops() {
    const box = $("#crops"); box.innerHTML = "";
    const crops = D.crops.slice();
    const soft = crops.find(c => c.n === "Пшеница"), hard = crops.find(c => c.n === "Пшеница твердая");
    const display = [];
    crops.forEach(c => {
        if (c.n === "Пшеница твердая") return;
        if (c.n === "Пшеница" && hard) {
            const lim = soft.lim || hard.lim || 0;
            display.push({n: "Пшеница (пш 3 кл и пш тв)", lim, rv: (soft.rv || 0) + (hard.rv || 0), fv: (soft.fv || 0) + (hard.fv || 0)});
        } else display.push(c);
    });
    display.forEach(c => {
        const lim = c.lim || c.rv || 1; const rPct = c.rv / lim * 100, fPct = c.fv / lim * 100;
        const overGreen = Math.min(100, fPct) >= 93;
        const pctStyle = overGreen ? "color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35)" : "color:#33402F";
        const d = el("div", "crow");
        d.innerHTML = `<div class="cname">${c.n}<div class="cpsub">лимит ${c.lim ? fmtT(c.lim) + " т" : "—"}</div></div>
            <div class="cbar"><i style="width:${Math.min(100, rPct)}%"></i><i class="fin" style="width:${Math.min(100, fPct)}%"></i>
                <div class="pct" style="${pctStyle}">${rPct.toFixed(0)}% заявл.</div></div>
            <div class="cval">${fmtT(c.fv)} тонн<small>профин.</small></div>`;
        box.appendChild(d);
    });
}
