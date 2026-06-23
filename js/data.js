let D = null;
let GEO = null;

async function fetchCSV(url) {
    const r = await fetch(url, {cache: "no-store"});
    if (!r.ok) throw new Error("HTTP " + r.status);
    return parseCSV(await r.text());
}

async function loadGeoData() {
    if (GEO) return;
    if (window.am5geodata_kazakhstanLow) { GEO = window.am5geodata_kazakhstanLow; return; }
    for (const u of [CONFIG.GEO_URL, CONFIG.GEO_URL_FALLBACK]) {
        try { const r = await fetch(u, {cache: "force-cache"}); if (r.ok) { GEO = await r.json(); return; } } catch (e) {}
    }
    GEO = {type: "FeatureCollection", features: []};
}

function parseSvod(rows) {
    let itogo = -1;
    for (let i = 0; i < rows.length; i++) { if (String(rows[i][1] || "").includes("Итого по РК")) { itogo = i; break; } }
    const upto = itogo < 0 ? rows.length : itogo;
    const regions = [];
    for (let i = 0; i < upto; i++) {
        const nm = fullReg(rows[i][1] || "");
        if (REGION_GEO[nm] && !regions.find(r => r.name === nm)) {
            const r = rows[i];
            regions.push({code: REGION_GEO[nm].code, name: nm, x: REGION_GEO[nm].x, y: REGION_GEO[nm].y,
                limit: toNum(r[2] || 0),
                rec: [toNum(r[3] || 0), toNum(r[4] || 0), toNum(r[5] || 0), toNum(r[6] || 0)],
                contr: [toNum(r[15] || 0), toNum(r[16] || 0), toNum(r[17] || 0), toNum(r[18] || 0)],
                fin: [toNum(r[19] || 0), toNum(r[20] || 0), toNum(r[21] || 0), toNum(r[22] || 0)]});
        }
    }
    Object.keys(REGION_GEO).forEach(nm => {
        if (!regions.find(r => r.name === nm))
            regions.push({code: REGION_GEO[nm].code, name: nm, x: REGION_GEO[nm].x, y: REGION_GEO[nm].y,
                limit: 0, rec: [0, 0, 0, 0], contr: [0, 0, 0, 0], fin: [0, 0, 0, 0]});
    });
    let funnel = [], total = {limit: 0, rec: [0, 0, 0, 0], contr: [0, 0, 0, 0], fin: [0, 0, 0, 0]};
    if (itogo >= 0) {
        const r = rows[itogo];
        const stages = [["Поступило заявок", 3, 4, 5, 6], ["Утверждено Координационным Советом", 11, 12, 13, 14],
            ["С учётом отказов и уменьшений", 7, 8, 9, 10], ["Заключено договоров", 15, 16, 17, 18], ["Профинансировано", 19, 20, 21, 22]];
        funnel = stages.map(([k, sc, a, s, v]) => ({k, schtp: toNum(r[sc] || 0), apps: toNum(r[a] || 0), sum: toNum(r[s] || 0), vol: toNum(r[v] || 0)}));
        total = {limit: toNum(r[2] || 0),
            rec: [toNum(r[3] || 0), toNum(r[4] || 0), toNum(r[5] || 0), toNum(r[6] || 0)],
            contr: [toNum(r[15] || 0), toNum(r[16] || 0), toNum(r[17] || 0), toNum(r[18] || 0)],
            fin: [toNum(r[19] || 0), toNum(r[20] || 0), toNum(r[21] || 0), toNum(r[22] || 0)]};
    }
    const crops = []; let started = false;
    for (let i = (itogo < 0 ? 0 : itogo + 1); i < rows.length; i++) {
        const nm = String(rows[i][1] || "").trim();
        if (CROP_ORDER.includes(nm)) {
            const r = rows[i];
            crops.push({n: nm, lim: toNum(r[2] || 0),
                rec: [toNum(r[3] || 0), toNum(r[4] || 0), toNum(r[5] || 0), toNum(r[6] || 0)],
                contr: [toNum(r[15] || 0), toNum(r[16] || 0), toNum(r[17] || 0), toNum(r[18] || 0)],
                fin: [toNum(r[19] || 0), toNum(r[20] || 0), toNum(r[21] || 0), toNum(r[22] || 0)],
                rs: toNum(r[5] || 0), rv: toNum(r[6] || 0), fs: toNum(r[21] || 0), fv: toNum(r[22] || 0)});
            started = true;
        } else if (started && nm.includes("Итого")) break;
    }
    crops.sort((a, b) => CROP_ORDER.indexOf(a.n) - CROP_ORDER.indexOf(b.n));
    return {regions, funnel, total, crops};
}

function parseDetail(rows) {
    const gmap = {}, smap = {};
    const setIf = (g, f, idx, r) => { const v = String(r[idx] || "").trim(); if (!g[f] && v) g[f] = v; };
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const regRaw = String(r[2] || "").trim();
        const name = String(r[4] || "").trim();
        const reg = DETAIL_TO_FULL[regRaw];
        if (!reg || !name || name.includes("Итого") || name === "Наименование поставщика") continue;
        const status = String(r[24] || "").trim(), cult = String(r[14] || "").trim();
        const sum = toNum(r[17] || 0), vol = toNum(r[19] || 0), bin = String(r[11] || "").trim();
        const k = reg + "|" + (bin || name);
        if (!gmap[k]) gmap[k] = {reg, name, bin, form: String(r[3] || "").trim(), rayon: String(r[10] || "").trim(),
            nds: String(r[12] || "").trim(), garant: String(r[21] || "").trim(), cults: [],
            apps: 0, sum: 0, vol: 0, statuses: [], lines: [],
            regDate: "", ksSent: "", ksDate: "", pravlDate: "", dogNum: "", dogDate: "", garDate: "", finDate: ""};
        const g = gmap[k];
        g.apps++; g.sum += sum; g.vol += vol;
        if (cult && !g.cults.includes(cult)) g.cults.push(cult);
        if (status) { g.statuses.push(status); smap[status] = (smap[status] || 0) + 1; }
        if (!g.garant && String(r[21] || "").trim()) g.garant = String(r[21] || "").trim();
        setIf(g, "regDate", 13, r); setIf(g, "ksSent", 30, r); setIf(g, "ksDate", 36, r);
        setIf(g, "pravlDate", 43, r); setIf(g, "dogNum", 49, r); setIf(g, "dogDate", 50, r);
        setIf(g, "garDate", 56, r); setIf(g, "finDate", 63, r);
        if (cult || vol || sum) g.lines.push({cult, vol, sum, status});
    }
    const pick = sts => {
        for (const p of ["профин.", "гарантия", "на кс", "сп", "расторжение кусп", "отозван", "отказ кусп"]) {
            const f = sts.find(s => s.trim().toLowerCase() === p); if (f) return f;
        }
        return sts[0] || "—";
    };
    const cps = Object.values(gmap).map(g => ({reg: g.reg, name: g.name, bin: g.bin, form: g.form, rayon: g.rayon,
        nds: g.nds, garant: g.garant, cults: g.cults, apps: g.apps,
        sum: Math.round(g.sum), vol: Math.round(g.vol * 10) / 10,
        status: pick(g.statuses),
        sts: [...new Set(g.statuses.map(s => s.trim()).filter(Boolean))],
        lines: g.lines,
        dates: {reg: g.regDate, ksSent: g.ksSent, ks: g.ksDate, pravl: g.pravlDate, dogNum: g.dogNum, dogDate: g.dogDate, gar: g.garDate, fin: g.finDate}
    })).sort((a, b) => b.sum - a.sum);
    const stMap = {};
    cps.forEach(c => { const set = c.sts.length ? c.sts : [c.status]; set.forEach(s => { if (s && s !== "—") stMap[s] = (stMap[s] || 0) + 1; }); });
    const statuses = Object.entries(stMap).sort((a, b) => b[1] - a[1]).map(([n, c]) => [n, c, statCls(n)]);
    return {cps, statuses};
}

function combine(svod, detail) {
    const now = new Date();
    return {date: now.toLocaleDateString("ru-RU") + " " + now.toLocaleTimeString("ru-RU", {hour: '2-digit', minute: '2-digit'}),
        regions: svod.regions, funnel: svod.funnel, total: svod.total, crops: svod.crops,
        cps: detail.cps, statuses: detail.statuses};
}

async function loadData(yearOverride) {
    const year = yearOverride || (document.getElementById("yearSel") || {}).value || "2026";
    const dot  = document.getElementById("dot"), live = document.getElementById("liveTxt");
    try {
        await loadGeoData();
        live.textContent = "Загрузка отчёта…"; dot.classList.remove("err");
        let svodRows, detRows;

        if (year !== "2026" && CONFIG.API_URL_RETURN) {
            // Исторические данные через admin-script
            const url = CONFIG.API_URL_RETURN + "?action=getFinancing&year=" + year + "&_=" + Date.now();
            const r = await fetch(url, {cache: "no-store"});
            if (!r.ok) throw new Error("HTTP " + r.status);
            const j = await r.json();
            if (!j.ok) throw new Error(j.error || "Ошибка API");
            svodRows = j.svod; detRows = j.detail;
        } else if (CONFIG.API_URL) {
            const r = await fetch(CONFIG.API_URL, {cache: "no-store"});
            if (!r.ok) throw new Error("API " + r.status);
            const j = await r.json(); svodRows = j.svod; detRows = j.detail;
            if (!svodRows || !detRows) throw new Error("API вернул не {svod, detail}");
        } else {
            const uSvod = CONFIG.SVOD_CSV || gvizURL(CONFIG.SVOD_SHEET),
                  uDet  = CONFIG.DETAIL_CSV || gvizURL(CONFIG.DETAIL_SHEET);
            [svodRows, detRows] = await Promise.all([fetchCSV(uSvod), fetchCSV(uDet)]);
        }
        D = combine(parseSvod(svodRows), parseDetail(detRows));
        try { render(); } catch (err) { console.error("render:", err); }
        hideLoader();
        live.textContent = "Департамент закупа СХП";
        document.getElementById("banner").classList.remove("show");
    } catch (e) {
        if (year === "2026" && CONFIG.API_URL && !CONFIG._csvTried) {
            CONFIG._csvTried = true; CONFIG.API_URL = ""; return loadData(yearOverride);
        }
        dot.classList.add("err"); live.textContent = "Ошибка загрузки"; hideLoader();
        showBanner("Не удалось загрузить данные (" + e.message + "). Проверьте доступ к таблице/скрипту.");
    }
}

function showBanner(msg) {
    const b = document.getElementById("banner");
    b.innerHTML = msg || "Укажите API_URL или CSV-ссылки в начале скрипта.";
    b.classList.add("show");
}
