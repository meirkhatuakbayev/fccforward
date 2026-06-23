// Рендеринг раздела «Возврат зерна» (ФЗ 2025/2026)

let _returnLoaded = false;
let _vzMetric = "pct";   // "pct" | "debt" | "penalty"
let _vzMapZoom = null, _vzMapSvgSel = null, _vzMapFit = null;

// ── Ленивая загрузка ─────────────────────────────────────────────────────────
function ensureVozvrat() {
    if (_returnLoaded) { if (DR) renderReturn(); return; }
    _returnLoaded = true;
    loadReturn();
}

// ── Цветовые функции ─────────────────────────────────────────────────────────
function colorVzExec(pct) {
    // pct 0..1: 1=зелёный (100% исп.), 0=красный (0%)
    const t = Math.max(0, Math.min(1, pct));
    if (t >= 1) return "#3C6B4A";
    if (t <= 0) return "#9E4A40";
    const g = [60, 107, 74], r2 = [158, 74, 64];
    const m = i => Math.round(g[i] + (r2[i] - g[i]) * (1 - t));
    return `rgb(${m(0)},${m(1)},${m(2)})`;
}

function colorVzScale(fraction) {
    // 0=светлый, 1=тёмно-красный
    const t = Math.max(0, Math.min(1, fraction));
    if (t <= 0) return "#D6CFBC";
    const lo = [214, 207, 188], hi = [158, 74, 64];
    const m = i => Math.round(lo[i] + (hi[i] - lo[i]) * t);
    return `rgb(${m(0)},${m(1)},${m(2)})`;
}

// ── Основной рендер ──────────────────────────────────────────────────────────
function renderReturn() {
    if (!DR) return;
    renderVzKpis();
    renderVzFunnel();
    renderVzDebtorsList();
    renderVzMap();
    setVzView("map");       // инициализация табов
    renderVzRanking();
    renderVzPenaltyForecast();
    const asof = document.getElementById("vzAsof");
    if (asof) asof.textContent = DR.date;
}

// ── 1. Авто-сводка ───────────────────────────────────────────────────────────
function renderVzSummary() {
    const t = DR.total;
    const box = document.getElementById("vzSummary");
    const chain = document.getElementById("vzChain");
    if (!box && !chain) return;

    const topDebtor = DR.debtors[0];
    const deadline = new Date(2026, 10, 2); // Nov 2, 2026
    const daysLeft = Math.ceil((deadline - new Date()) / 86400000);
    const pct = (t.pct_exec * 100).toFixed(1);

    if (box) {
        const lines = [];
        if (topDebtor) lines.push(
            `Крупнейший должник — <b>${topDebtor.name}</b>: остаток ${fmtMlrd(topDebtor.debt)} ₸`
            + (topDebtor.penalty > 0 ? `, пеня ${fmtMlrd(topDebtor.penalty)} ₸` : "")
        );
        lines.push(`До срока поставки (02.11.2026) — <b>${daysLeft > 0 ? daysLeft + " дн." : "просрочено " + Math.abs(daysLeft) + " дн."}</b>`);
        if (DR.totalPenalty > 0)
            lines.push(`Начислено пени по всем договорам: <b>${fmtMlrd(DR.totalPenalty)} ₸</b>`);
        else
            lines.push(`Исполнение по РК: <b>${pct}%</b> · Должников: <b>${DR.debtors.length}</b>`);
        box.innerHTML = lines.map(l => `<div class="vz-sum-line">${l}</div>`).join("");
    }

    if (chain) {
        chain.innerHTML =
            `<span>Выдано <b class="num">${fmtMlrd(t.sum_fin)} ₸</b></span>` +
            `<span class="vz-arr">→</span>` +
            `<span>Зачтено зерном <b class="num">${fmtMlrd(t.sum_zachet)} ₸</b></span>` +
            `<span class="vz-arr">→</span>` +
            `<span>Остаток <b class="num" style="color:${t.debt > 0 ? "#E05A4A" : "#3C6B4A"}">${fmtMlrd(t.debt)} ₸</b></span>`;
    }
}

// ── 2. KPI-плашки (5 штук, цвета как в форварде) ────────────────────────────
function renderVzKpis() {
    const t = DR.total;
    const pctNum = t.pct_exec * 100;
    const pct = pctNum.toFixed(1);
    const pctTag = pctNum >= 95 ? "#3C6B4A" : pctNum >= 70 ? "#B97F18" : "#9E4A40";
    const pctBarClr = pctNum >= 95 ? "linear-gradient(90deg,#2F5D40,#3C6B4A)"
                    : pctNum >= 70 ? "linear-gradient(90deg,#C99526,#E8A82E)"
                    : "linear-gradient(90deg,#9E4A40,#C06A5C)";

    const items = [
        {
            lab: "Профинансировано",
            big: fmtMlrd(t.sum_fin), unit: "₸",
            sub: fmtT(DR.cps.length) + " СХТП · " + fmtT(t.vol_contr) + " т",
            tag: "#E8A82E"
        },
        {
            lab: "Поставлено зерна",
            big: fmtT(t.vol_ret), unit: "т",
            sub: fmtMlrd(t.sum_ret) + " ₸ сумма за зерно",
            tag: "#3C6B4A"
        },
        {
            lab: "В т.ч. зачтено в предоплату",
            big: fmtMlrd(t.sum_zachet), unit: "₸",
            sub: "погашение предоплаты зерном",
            tag: "#3C6B4A"
        },
        {
            lab: "В т.ч. доплата СХТП",
            big: fmtMlrd(t.sum_doplata), unit: "₸",
            sub: "начислено сверх предоплаты",
            tag: "#E8A82E"
        },
        {
            lab: "% исполнения",
            big: pct, unit: "%",
            sub: "на сумму финансирования",
            tag: pctTag, pct: pctNum, pctBar: pctBarClr
        },
        {
            lab: "Остаток долга",
            big: fmtMlrd(t.debt), unit: "₸",
            sub: DR.debtors.length + " СХТП-должников",
            tag: t.debt > 0 ? "#9E4A40" : "#3C6B4A",
            red: t.debt > 0
        },
    ];

    const box = document.getElementById("vzKpis");
    if (!box) return;
    box.innerHTML = "";
    items.forEach(it => {
        const c = el("div", "kpi");
        c.innerHTML = `<div class="tag" style="background:${it.tag}"></div>
            <div class="lab">${it.lab}</div>
            <div class="big num" style="${it.red ? "color:#E05A4A" : ""}">${it.big}<small>${it.unit}</small></div>
            <div class="sub">${it.sub}</div>
            ${it.pct != null ? `<div class="bar"><i style="width:${Math.min(100,it.pct)}%;${it.pctBar ? "background:" + it.pctBar : ""}"></i></div>` : ""}`;
        box.appendChild(c);
    });
}

// ── 3. Воронка возврата ───────────────────────────────────────────────────────
function renderVzFunnel() {
    const box = document.getElementById("vzFunnel");
    if (!box) return;
    const t = DR.total;
    const allCps = DR.cps;
    const totalSchtp = allCps.length;
    const retSchtp = allCps.filter(c => c.vol_total > 0).length;
    const debtSchtp = DR.debtors.length;

    const stages = [
        { k: "Выдано (профинансировано)", schtp: totalSchtp, vol: t.vol_contr, sum: t.sum_fin, base: true },
        { k: "Зачтено зерном",            schtp: retSchtp,   vol: t.vol_ret,   sum: t.sum_zachet },
        { k: "Остаток долга",             schtp: debtSchtp,  vol: 0,           sum: t.debt, isDebt: true },
    ];
    const maxVol = Math.max(1, t.vol_contr);
    box.innerHTML = stages.map((s, i) => {
        const w = s.isDebt ? (t.debt / t.sum_fin * 100) : (s.vol / maxVol * 100);
        const sub = s.isDebt ? fmtMlrd(s.sum) + " ₸" : `${fmtT(s.schtp)} СХТП · ${fmtT(s.vol)} т · ${fmtMlrd(s.sum)} ₸`;
        return `<div class="fstage">
            <div class="ft"><span>${s.k}</span></div>
            <div class="ftrack${i === 0 ? " s0" : s.isDebt ? " sdebt" : ""}">
                <i style="width:${Math.max(w, 20).toFixed(1)}%"></i>
                <div class="v">${sub}</div>
            </div></div>`;
    }).join("");
}

// ── 3б. Список должников в правой панели ─────────────────────────────────────
function renderVzDebtorsList() {
    const box = document.getElementById("vzDebtorsList");
    if (!box) return;
    if (!DR.debtors.length) {
        box.innerHTML = `<div style="color:#3C6B4A;font-size:13px;font-weight:700;padding:8px 0">✓ Все обязательства исполнены</div>`;
        return;
    }
    box.innerHTML = DR.debtors.map(c => {
        const regShortName = c.reg
            .replace("Восточно-Казахстанская", "ВКО").replace("Северо-Казахстанская", "СКО")
            .replace("Западно-Казахстанская", "ЗКО").replace("ская", "ск.");
        const safeBin = (c.bin || "").replace(/'/g, "\\'");
        const safeDog = (c.dog_num || "").replace(/'/g, "\\'");
        return `<div class="vz-debtor-row" onclick="openCpReturnByBin('${safeBin}','${safeDog}')">
            <div>
                <div class="vz-debtor-name">${c.name}</div>
                <div class="vz-debtor-sub">${regShortName} · ${c.dog_num}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
                <div class="num" style="color:#E05A4A;font-weight:800;font-size:13px">${fmtMlrd(c.debt)} ₸</div>
                ${c.penalty > 0 ? `<div style="font-size:11px;color:#C07030;font-weight:700;margin-top:2px">пеня ${fmtMlrd(c.penalty)} ₸</div>` : ""}
            </div>
        </div>`;
    }).join("");
}

// ── 3в. Переключатель видов в левой карточке ──────────────────────────────────
function setVzView(v) {
    const areas = { map: "vzMapArea", tab: "vzTabArea", crop: "vzCropArea" };
    Object.entries(areas).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = k === v ? "" : "none";
    });
    const btns = { map: "vzBtnMap", tab: "vzBtnTab", crop: "vzBtnCrop" };
    Object.entries(btns).forEach(([k, id]) => {
        const b = document.getElementById(id);
        if (b) b.classList.toggle("act", k === v);
    });
    const hint = document.getElementById("vzHint");
    if (hint) hint.textContent = v === "map"
        ? "Цвет — исполнение предоплаты. Нажмите область — список договоров."
        : v === "tab" ? "Исполнение по областям (суммы — млрд ₸, объём — тонн). Нажмите строку — договоры."
        : "Поставка по культурам: законтрактовано vs фактически сдано. Замена культуры отмечена отдельно.";
    if (v === "tab") renderVzTabArea();
    if (v === "crop") renderVzCropTable();
}

// ── 3г. Таблица по областям в левой карточке ─────────────────────────────────
function renderVzTabArea() {
    const box = document.getElementById("vzTabArea");
    if (!box || box._rendered) return;
    box._rendered = true;

    const cntByCode = {};
    DR.cps.forEach(c => {
        const rg = DR.regions.find(x => x.name === c.reg);
        if (rg) cntByCode[rg.code] = (cntByCode[rg.code] || 0) + 1;
    });

    const rows = DR.regions
        .filter(r => r.sum_fin > 0)
        .sort((a, b) => b.sum_fin - a.sum_fin)
        .map(r => {
            const cnt = cntByCode[r.code] || 0;
            const p = r.pct_exec * 100;
            const pc = p >= 95 ? "#3C6B4A" : p >= 70 ? "#9A6716" : "#E05A4A";
            return `<tr onclick="vzSelectRegion('${r.code}')">
                <td class="l">${r.name}<br><span style="font-size:10px;font-weight:600;opacity:.6">${cnt} СХТП</span></td>
                <td>${fmtMlrd(r.sum_fin)}</td>
                <td>${fmtT(r.vol_ret)}</td>
                <td>${fmtMlrd(r.sum_ret)}</td>
                <td>${r.sum_doplata > 0 ? fmtMlrd(r.sum_doplata) : "—"}</td>
                <td>${fmtMlrd(r.sum_zachet)}</td>
                <td style="color:${pc};font-weight:800">${p.toFixed(1)}%</td>
            </tr>`;
        }).join("");

    const t = DR.total;
    const totP = (t.pct_exec * 100);
    const totPc = totP >= 95 ? "#3C6B4A" : "#9A6716";
    box.innerHTML = `<div class="tablescroll" style="max-height:390px"><table class="rtab">
        <thead><tr>
            <th class="l">Область</th>
            <th>Профинанс. ₸</th>
            <th>Объём т</th>
            <th>Сумма за зерно ₸</th>
            <th>Доплата ₸</th>
            <th>Зачтено ₸</th>
            <th>% исп.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td class="l">Итого по РК<br><span style="font-size:10px;font-weight:600;opacity:.7">${DR.cps.length} СХТП</span></td>
            <td>${fmtMlrd(t.sum_fin)}</td>
            <td>${fmtT(t.vol_ret)}</td>
            <td>${fmtMlrd(t.sum_ret)}</td>
            <td>${fmtMlrd(t.sum_doplata)}</td>
            <td>${fmtMlrd(t.sum_zachet)}</td>
            <td style="color:${totPc}">${totP.toFixed(1)}%</td>
        </tr></tfoot>
    </table></div>`;
}

// ── 3д. Таблица по культурам (план vs факт, учёт замены культуры) ─────────────
function renderVzCropTable() {
    const box = document.getElementById("vzCropArea");
    if (!box || box._rendered) return;
    box._rendered = true;

    const CROPS = [
        { key: "cl3", label: "Пшеница 3 класс" },
        { key: "cl4", label: "Пшеница 4 класс" },
        { key: "cl5", label: "Пшеница 5 класс" },
        { key: "bar", label: "Ячмень 2 класс"  },
    ];
    const KEYS = CROPS.map(c => c.key);

    const agg = CROPS.map(cr => ({
        label: cr.label, key: cr.key,
        vol_contr: 0, sum_contr: 0,
        vol_fact: 0,  sum_fact: 0,
        vol_subst: 0                // объём, поставленный «не той» культурой
    }));

    DR.cps.forEach(c => {
        const cult = (c.cult || "").toLowerCase();
        // Определяем, под какой культурой законтрактован договор
        let ci = -1;
        if (cult.includes("пшениц") && cult.includes("3"))      ci = 0;
        else if (cult.includes("пшениц") && cult.includes("4")) ci = 1;
        else if (cult.includes("пшениц") && cult.includes("5")) ci = 2;
        else if (cult.includes("ячмень"))                        ci = 3;
        // Прочие культуры (подсолнечник, рапс и т.д.) фиксируем как «замена»
        else ci = -2; // нет в классификаторе

        if (ci >= 0) {
            agg[ci].vol_contr += c.vol_fin || 0;
            agg[ci].sum_contr += c.sum_fin || 0;
        }

        // Фактически поставлено по классам
        const delivs = [c.cl3, c.cl4, c.cl5, c.bar];
        delivs.forEach((d, di) => {
            if (!d || !d.vol) return;
            agg[di].vol_fact += d.vol;
            agg[di].sum_fact += d.sum;
            // Если договор на одну культуру, а сдали другую — фиксируем замену
            if (ci >= 0 && ci !== di) agg[di].vol_subst += d.vol;
        });
    });

    const active = agg.filter(r => r.vol_contr > 0 || r.vol_fact > 0);

    const rows = active.map(r => {
        const pct = r.vol_contr > 0 ? r.vol_fact / r.vol_contr * 100 : 0;
        const pctTxt = r.vol_contr > 0 ? pct.toFixed(1) + "%" : "—";
        const pc = r.vol_contr === 0 ? "" : pct >= 95 ? "#3C6B4A" : pct >= 70 ? "#9A6716" : "#E05A4A";
        const substNote = r.vol_subst > 0
            ? `<br><span style="font-size:9.5px;color:#9A6716;font-weight:600">в т.ч. ${fmtT(r.vol_subst)} т — замена</span>` : "";
        const noContr = r.vol_contr === 0 && r.vol_fact > 0
            ? `<br><span style="font-size:9.5px;color:#9A6716;font-weight:600">вне контракта (замена)</span>` : "";
        return `<tr>
            <td class="l">${r.label}${substNote}${noContr}</td>
            <td>${r.vol_contr > 0 ? fmtT(r.vol_contr) : "—"}</td>
            <td>${r.sum_contr > 0 ? fmtMlrd(r.sum_contr) : "—"}</td>
            <td style="${r.vol_fact === 0 ? "opacity:.5" : ""}">${r.vol_fact > 0 ? fmtT(r.vol_fact) : "0"}</td>
            <td style="${r.sum_fact === 0 ? "opacity:.5" : ""}">${r.sum_fact > 0 ? fmtMlrd(r.sum_fact) : "—"}</td>
            <td style="color:${pc};font-weight:800">${pctTxt}</td>
        </tr>`;
    }).join("");

    const tv = active.reduce((s,r)=>s+r.vol_contr,0);
    const ts = active.reduce((s,r)=>s+r.sum_contr,0);
    const fv = active.reduce((s,r)=>s+r.vol_fact,0);
    const fs = active.reduce((s,r)=>s+r.sum_fact,0);
    const totPct = tv > 0 ? (fv/tv*100).toFixed(1)+"%" : "—";
    const totPc = tv > 0 && fv/tv >= 0.95 ? "#3C6B4A" : "#9A6716";

    box.innerHTML = `<div class="tablescroll" style="max-height:390px">
        <table class="rtab">
        <thead>
            <tr class="grp">
                <th class="l" rowspan="2">Культура</th>
                <th colspan="2">По договору</th>
                <th class="gs" colspan="2">Фактически поставлено</th>
                <th rowspan="2">% выполн.</th>
            </tr>
            <tr>
                <th>Объём, т</th>
                <th>Сумма, ₸</th>
                <th class="gs">Объём, т</th>
                <th>Сумма за зерно ₸</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td class="l">Итого</td>
            <td>${fmtT(tv)}</td>
            <td>${fmtMlrd(ts)}</td>
            <td>${fmtT(fv)}</td>
            <td>${fmtMlrd(fs)}</td>
            <td style="color:${totPc}">${totPct}</td>
        </tr></tfoot>
        </table>
    </div>`;
}

// ── 4. Карта ─────────────────────────────────────────────────────────────────
function renderVzMap() {
    const box = document.getElementById("vzMapWrap");
    if (!box) return;
    if (window.d3 && GEO && GEO.features && GEO.features.length > 0) renderVzMapGeo();
}

function renderVzMapGeo() {
    const svg = document.getElementById("vzMapSvg");
    if (!svg) return;
    svg.innerHTML = "";
    const NS = "http://www.w3.org/2000/svg";

    const byCode = {};
    DR.regions.forEach(r => byCode[r.code] = r);

    // Pre-build penalty sum per region code (avoid O(n²) per feature)
    const penByCode = {};
    DR.regions.forEach(r => penByCode[r.code] = 0);
    DR.cps.forEach(c => {
        const rg = DR.regions.find(x => x.name === c.reg);
        if (rg) penByCode[rg.code] = (penByCode[rg.code] || 0) + (c.penalty || 0);
    });
    const maxDebt    = Math.max(1, ...DR.regions.map(r => r.debt));
    const maxPenalty = Math.max(1, ...Object.values(penByCode));

    const proj = d3.geoMercator().fitExtent([[14,16],[906,464]], GEO);
    const gp = d3.geoPath(proj);
    const G = document.createElementNS(NS, "g"); G.setAttribute("id","vzZoomG"); svg.appendChild(G);

    GEO.features.forEach(f => {
        const code = featCode(f);
        const rg = code ? byCode[code] : null;
        if (!rg) return;

        let col;
        if (_vzMetric === "pct")     col = rg.sum_fin > 0 ? colorVzExec(rg.pct_exec) : "#D6CFBC";
        else if (_vzMetric === "debt")    col = colorVzScale(rg.debt / maxDebt);
        else col = colorVzScale((penByCode[rg.code] || 0) / maxPenalty);

        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", gp(f));
        p.setAttribute("fill", col);
        p.setAttribute("stroke", "#FBFAF5");
        p.setAttribute("stroke-width", "0.8");
        p.setAttribute("class", "geopath");
        if (rg.sum_fin > 0) {
            p.style.cursor = "pointer";
            p.addEventListener("mousemove", e => vzShowTip(e, rg));
            p.addEventListener("mouseleave", () => { const t=document.getElementById("vzTip"); if(t) t.classList.remove("show"); });
            p.addEventListener("click", () => vzSelectRegion(rg.code));
        }
        G.appendChild(p);

        if (rg.sum_fin > 0) {
            const c = gp.centroid(f);
            const lab = document.createElementNS(NS, "g");
            lab.setAttribute("class", "glabg");
            lab.dataset.cx = c[0].toFixed(1); lab.dataset.cy = c[1].toFixed(1);
            lab.setAttribute("transform", `translate(${c[0].toFixed(1)},${c[1].toFixed(1)})`);
            const nm = regShort(rg.name);
            const pctTxt = (rg.pct_exec * 100).toFixed(0) + "%";
            const wMax = Math.max(nm.length * 6.6, pctTxt.length * 5.6) + 14;
            const rect = document.createElementNS(NS, "rect");
            rect.setAttribute("class", "pill");
            rect.setAttribute("x", (-wMax/2).toFixed(1)); rect.setAttribute("y", "-13");
            rect.setAttribute("width", wMax.toFixed(1)); rect.setAttribute("height", "26"); rect.setAttribute("rx", "7");
            const t1 = document.createElementNS(NS, "text"); t1.setAttribute("class","glab name"); t1.setAttribute("y","-4"); t1.textContent = nm;
            const t2 = document.createElementNS(NS, "text"); t2.setAttribute("class","glab cnt2"); t2.setAttribute("y","6"); t2.textContent = pctTxt;
            lab.appendChild(rect); lab.appendChild(t1); lab.appendChild(t2); G.appendChild(lab);
        }
    });

    const zoom = d3.zoom().scaleExtent([1,9]).on("zoom", ev => {
        G.setAttribute("transform", ev.transform);
        const k = ev.transform.k;
        G.querySelectorAll(".glabg").forEach(l => l.setAttribute("transform",
            `translate(${l.dataset.cx},${l.dataset.cy}) scale(${(1/k).toFixed(3)})`));
    });
    _vzMapZoom = zoom; _vzMapSvgSel = d3.select(svg);
    d3.select(svg).call(zoom).on("dblclick.zoom", null);
    _vzMapFit = d3.zoomIdentity;
    d3.select(svg).call(zoom.transform, _vzMapFit);
}

function vzShowTip(e, rg) {
    const tip = document.getElementById("vzTip");
    if (!tip) return;
    const pct = (rg.pct_exec * 100).toFixed(1);
    tip.innerHTML = `<b>${rg.name}</b>
        <div class="l"><span>Предоплата</span><span>${fmtMlrd(rg.sum_fin)} ₸</span></div>
        <div class="l"><span>Зачтено зерном</span><span>${fmtMlrd(rg.sum_zachet)} ₸</span></div>
        <div class="l"><span>Исполнение</span><span>${pct}%</span></div>
        ${rg.debt > 0 ? `<div class="l"><span>Остаток долга</span><span style="color:#E99">${fmtMlrd(rg.debt)} ₸</span></div>` : ""}`;
    tip.classList.add("show");
    const wrap = document.getElementById("vzMapWrap").getBoundingClientRect();
    let x = e.clientX - wrap.left + 14, y = e.clientY - wrap.top + 10;
    if (x > wrap.width - 180) x -= 200;
    tip.style.left = x + "px"; tip.style.top = y + "px";
}

function setVzMetric(m) {
    _vzMetric = m;
    document.querySelectorAll("#viewVozvrat [data-m]").forEach(b => b.classList.toggle("act", b.dataset.m === m));
    renderVzMapGeo();
    renderVzMapLegend();
}

function renderVzMapLegend() {
    const box = document.getElementById("vzMapLegend");
    if (!box) return;
    if (_vzMetric === "pct") {
        box.innerHTML = `<div class="lg-scale"><span>Исполнение:</span>
            <i style="background:#9E4A40"></i><span>0%</span>
            <i style="background:linear-gradient(90deg,#9E4A40,#3C6B4A)"></i>
            <i style="background:#3C6B4A"></i><span>100%</span></div>`;
    } else {
        const label = _vzMetric === "debt" ? "Остаток долга" : "Пеня";
        box.innerHTML = `<div class="lg-scale"><span>${label}:</span>
            <i style="background:#D6CFBC"></i><span>нет</span>
            <i style="background:linear-gradient(90deg,#D6CFBC,#9E4A40)"></i>
            <i style="background:#9E4A40"></i><span>макс.</span></div>`;
    }
}

// ── 5. Таблица по областям ────────────────────────────────────────────────────
function renderVzRegionTable() {
    const box = document.getElementById("vzRegTable");
    if (!box) return;
    const rows = DR.regions
        .filter(r => r.sum_fin > 0)
        .sort((a, b) => b.sum_fin - a.sum_fin)
        .map(r => {
            const pct = (r.pct_exec * 100).toFixed(1);
            const pctKsn = r.sum_doplata > 0 ? (r.sum_ksn / r.sum_doplata * 100).toFixed(0) + "%" : "—";
            const regPenalty = DR.cps
                .filter(c => { const rg = DR.regions.find(x => x.name === c.reg); return rg && rg.code === r.code; })
                .reduce((s, c) => s + c.penalty, 0);
            return `<tr style="cursor:pointer" onclick="vzSelectRegion('${r.code}')">
                <td class="cpname">${r.name}</td>
                <td class="r num">${fmtMlrd(r.sum_fin)}</td>
                <td class="r num">${fmtT(r.vol_ret)}</td>
                <td class="r num">${fmtMlrd(r.sum_zachet)}</td>
                <td class="r num">${pct}%</td>
                <td class="r num">${r.sum_doplata > 0 ? fmtMlrd(r.sum_doplata) : "—"}</td>
                <td class="r num">${pctKsn}</td>
                <td class="r num" style="${r.debt > 0 ? "color:#E05A4A;font-weight:700" : ""}">${r.debt > 0 ? fmtMlrd(r.debt) : "—"}</td>
                <td class="r num" style="${regPenalty > 0 ? "color:#C07030" : ""}">${regPenalty > 0 ? fmtMlrd(regPenalty) : "—"}</td>
            </tr>`;
        }).join("");

    const t = DR.total;
    const totPenalty = DR.totalPenalty;
    box.innerHTML = `<div class="tablescroll"><table>
        <thead><tr>
            <th>Область</th>
            <th class="r">Предоплата ₸</th>
            <th class="r">Возвращено т</th>
            <th class="r">Зачтено ₸</th>
            <th class="r">% исп.</th>
            <th class="r">Доплата нач. ₸</th>
            <th class="r">% исп. (КСН)</th>
            <th class="r">Остаток долга ₸</th>
            <th class="r">Пеня ₸</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td class="r" style="text-align:left;font-weight:800">Итого по РК</td>
            <td class="r num">${fmtMlrd(t.sum_fin)}</td>
            <td class="r num">${fmtT(t.vol_ret)}</td>
            <td class="r num">${fmtMlrd(t.sum_zachet)}</td>
            <td class="r num">${(t.pct_exec*100).toFixed(1)}%</td>
            <td class="r num">${fmtMlrd(t.sum_doplata)}</td>
            <td class="r num">${t.sum_doplata > 0 ? (t.sum_ksn/t.sum_doplata*100).toFixed(0) + "%" : "—"}</td>
            <td class="r num" style="${t.debt>0?"color:#E05A4A;font-weight:800":""}">${fmtMlrd(t.debt)}</td>
            <td class="r num">${totPenalty > 0 ? fmtMlrd(totPenalty) : "—"}</td>
        </tr></tfoot>
    </table></div>`;
}

// ── 6. Клик по области (список договоров) ────────────────────────────────────
function vzSelectRegion(code) {
    const reg = DR.regions.find(r => r.code === code);
    if (!reg) return;
    const panel = document.getElementById("vzRegPanel");
    const pname = document.getElementById("vzRegName");
    if (!panel || !pname) return;
    pname.textContent = reg.name + " область";
    panel.style.display = "";
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const cps = DR.cps
        .filter(c => { const r = DR.regions.find(x => x.name === c.reg); return r && r.code === code; })
        .sort((a, b) => b.debt - a.debt);

    const rows = cps.map(c => `
        <tr style="cursor:pointer" onclick="openCpReturnByBin('${c.bin.replace(/'/g,"\\'")}','${c.dog_num.replace(/'/g,"\\'")}')">
            <td class="cpname">${c.name}<div class="cpsub">${c.form} · ${c.dog_num}</div></td>
            <td>${c.cult||"—"}</td>
            <td class="r num">${fmtT(c.vol_fin)}</td>
            <td class="r num">${fmtMlrd(c.sum_fin)}</td>
            <td class="r num">${fmtT(c.vol_total)}</td>
            <td class="r num" style="${c.debt>0?"color:#E05A4A;font-weight:700":""}">${c.debt>0?fmtMlrd(c.debt):"✓"}</td>
        </tr>`).join("");
    document.getElementById("vzRegRows").innerHTML = rows;
}

// ── 7. Рейтинг + авто-анализ ─────────────────────────────────────────────────
function renderVzRanking() {
    const box = document.getElementById("vzRanking");
    if (!box) return;
    const regs = DR.regions.filter(r => r.sum_fin > 0).sort((a, b) => b.pct_exec - a.pct_exec);
    const best  = regs.filter(r => r.pct_exec >= 1.0);
    const worst = [...regs].sort((a, b) => b.debt - a.debt).filter(r => r.debt > 0).slice(0, 3);

    let html = `<div class="vz-rank-title">Рейтинг исполнения</div>`;
    html += regs.map((r, i) => {
        const pct = (r.pct_exec * 100).toFixed(1);
        const bar = Math.min(100, r.pct_exec * 100);
        const col = colorVzExec(r.pct_exec);
        return `<div class="vz-rank-row">
            <div class="vz-rank-num">${i+1}</div>
            <div class="vz-rank-name">${r.name}</div>
            <div class="vz-rank-bar"><div style="width:${bar}%;background:${col}"></div></div>
            <div class="vz-rank-pct">${pct}%</div>
            ${r.debt > 0 ? `<div class="vz-rank-debt">${fmtMlrd(r.debt)} ₸</div>` : `<div class="vz-rank-debt ok">✓</div>`}
        </div>`;
    }).join("");

    html += `<div class="vz-rank-analysis">`;
    if (best.length) html += `<div class="vz-ana-item ok2">Полностью исполнили: ${best.map(r=>r.name).join(", ")}.</div>`;
    if (worst.length) html += `<div class="vz-ana-item bad">Наибольший долг: ${worst.map(r=>`${r.name} (${fmtMlrd(r.debt)} ₸)`).join("; ")}.</div>`;
    const tempo = regs.filter(r => r.pct_exec > 0 && r.pct_exec < 1.0);
    if (tempo.length) html += `<div class="vz-ana-item warn">В процессе исполнения: ${tempo.map(r=>r.name).join(", ")} — до срока 02.11.2026.</div>`;
    html += `</div>`;

    box.innerHTML = html;
}

// ── 8. Прогноз пени на 30 дней после срока ────────────────────────────────────
function renderVzPenaltyForecast() {
    const box = document.getElementById("vzForecast");
    if (!box) return;
    const horizon = new Date("2026-12-02");
    let totalForecast = 0;
    DR.debtors.forEach(c => {
        const { penalty } = calcPenalty(c.debt, "2026-11-03", c.payments || [], horizon);
        totalForecast += penalty;
    });
    box.innerHTML = `<div class="garbox ${totalForecast > 0 ? "late" : "ok2"}">
        <span>Прогноз пени к 02.12.2026 (30 дн. просрочки)</span>
        <span class="num">${totalForecast > 0 ? fmtMlrd(totalForecast) + " ₸" : "0 ₸ (срок ещё не наступил)"}</span>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">Расчёт: 0,1% в день на текущий остаток · пеня начинается с 03.11.2026</div>`;
}

// ── 9. Карточка контрагента ───────────────────────────────────────────────────
function openCpReturnByBin(bin, dogNum) {
    if (!DR) return;
    const c = DR.cps.find(x => x.bin === bin && x.dog_num === dogNum);
    if (c) openCpReturn(c);
}

function openCpReturn(c) {
    try {
        const bin = c.bin || "";
        const crm = CONFIG.CRM_BASE
            ? `${CONFIG.CRM_BASE}/crm/deal/list/?apply_filter=Y&FIND=${encodeURIComponent(bin || c.name)}`
            : "#";
        const ini = (c.name || "?").replace(/^(ТОО|КХ|ФХ|АО|ИП)\s+/i,"").trim().charAt(0).toUpperCase() || "•";
        const today = new Date(); today.setHours(0,0,0,0);
        const todayFmt = ("0"+today.getDate()).slice(-2)+"."+("0"+(today.getMonth()+1)).slice(-2)+"."+today.getFullYear();
        // Поставки по классам
        const classes = [
            { label: "Пшеница 3 класс", d: c.cl3 },
            { label: "Пшеница 4 класс", d: c.cl4 },
            { label: "Пшеница 5 класс", d: c.cl5 },
            { label: "Ячмень 2 класс",  d: c.bar },
        ].filter(x => x.d && x.d.vol > 0);

        const clHTML = classes.length
            ? classes.map(x => {
                const pr = x.d.vol > 0 ? fmtT(Math.round(x.d.sum / x.d.vol)) : "—";
                return `<div class="ln"><span>${x.label}</span><span class="num">${fmtT(x.d.vol)} т</span><span class="num">${fmtMlrd(x.d.sum)} ₸</span><span class="num" style="color:var(--muted)">${pr} ₸/т</span></div>`;
            }).join("")
            : `<div class="ln"><span style="color:var(--muted)">Поставок нет</span></div>`;

        // История платежей
        let paymentsHTML = "";
        if (c.payments && c.payments.length > 0) {
            paymentsHTML = `<div class="seclab">История погашений</div>
                <div class="lines">${c.payments.map(p => `<div class="ln">
                    <span>${fmtDate(p.date)}</span>
                    <span class="num">${fmtMlrd(p.amount)} ₸</span>
                    <span style="color:var(--muted);font-size:11px">деньгами</span>
                </div>`).join("")}</div>`;
        }

        // Блок пени
        const penHTML = c.penalty > 0
            ? `<div class="garbox late" style="margin:6px 0"><span>Пеня начислена (из данных)</span><span class="num">${fmtMlrd(c.penalty)} ₸</span></div>
               <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Срок поставки: 02.11.2026 · Пеня с 03.11.2026 · 0,1% / день</div>`
            : `<div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:8px">Пеня не начислена (срок поставки 02.11.2026)</div>`;

        const debtColor = c.debt > 0 ? "color:#E05A4A;font-weight:800" : "color:#3C6B4A;font-weight:800";
        const doplataTxt = c.sum_ksn > 0
            ? `<div><div class="l">Доплата по КСН (выплачена)</div><div class="v num" style="color:#3C6B4A">${fmtMlrd(c.sum_ksn)} ₸</div></div>`
            : (c.sum_dop_plan > 0 ? `<div><div class="l">К доплате СХТП</div><div class="v num">${fmtMlrd(c.sum_dop_plan)} ₸ <span style="color:var(--muted);font-size:11px">(не выплачена)</span></div></div>` : "");

        document.getElementById("modal").innerHTML = `
            <div class="mhead">
                <button class="x" onclick="closeOv()">✕</button>
                <div class="toprow">
                    <div class="mava" style="background:linear-gradient(135deg,#9E4A40,#C0614F)">${ini}</div>
                    <div>
                        <h3 style="color:#F8F3E6">${c.name}</h3>
                        <div class="msub">${c.form} · ${c.reg} обл. · ${c.rayon} р-н · по состоянию на ${todayFmt}</div>
                    </div>
                </div>
                <span class="badge b-fin stbadge" style="background:#3c2a07;color:#F2C357">Возврат зерна</span>
            </div>
            <div class="mbody">
                <div class="kv">
                    <div><div class="l">БИН / ИИН</div><div class="v num">${bin||"—"}</div></div>
                    <div><div class="l">№ договора</div><div class="v">${c.dog_num||"—"}</div></div>
                    <div><div class="l">Дата договора</div><div class="v">${fmtDate(c.dog_date)}</div></div>
                    <div><div class="l">Культура</div><div class="v">${c.cult||"—"}</div></div>
                </div>

                <div class="mfig" style="grid-template-columns:1fr 1fr 1fr">
                    <div><div class="l">Предоплата</div><div class="n num">${fmtMlrd(c.sum_fin)} ₸</div></div>
                    <div><div class="l">Объём по договору</div><div class="n num">${fmtT(c.vol_fin)} т</div></div>
                    <div><div class="l">Цена предоплаты</div><div class="n num">${c.price_fin > 0 ? fmtT(c.price_fin) + " ₸/т" : "—"}</div></div>
                </div>

                <div class="seclab">Поставлено зерна (по классам)</div>
                <div class="lines">${clHTML}</div>

                <div class="mfig" style="grid-template-columns:1fr 1fr 1fr;margin-top:4px">
                    <div><div class="l">Всего поставлено</div><div class="n num">${fmtT(c.vol_total)} т</div></div>
                    <div><div class="l">Сумма</div><div class="n num">${fmtMlrd(c.sum_total)} ₸</div></div>
                    <div><div class="l">Средняя цена</div><div class="n num">${c.price_avg > 0 ? fmtT(c.price_avg) + " ₸/т" : "—"}</div></div>
                </div>

                <div class="kv" style="margin-top:4px">
                    <div><div class="l">Зачтено в предоплату</div><div class="v num">${fmtMlrd(c.sum_zachet)} ₸</div></div>
                    <div><div class="l">Остаток объёма</div><div class="v num" style="${c.vol_left>0?"color:#E05A4A":""}">${fmtT(c.vol_left)} т</div></div>
                    <div><div class="l">Погашено зерном</div><div class="v num">${fmtMlrd(c.paid_grain)} ₸</div></div>
                    <div><div class="l">Погашено деньгами</div><div class="v num">${fmtMlrd(c.paid_money)} ₸</div></div>
                    ${doplataTxt}
                </div>

                <div class="mfig" style="grid-template-columns:1fr 1fr;margin-top:8px">
                    <div><div class="l">Остаток долга</div><div class="n num" style="${debtColor}">${fmtMlrd(c.debt)} ₸</div></div>
                    <div><div class="l">Остаток погашения</div><div class="n num">${fmtMlrd(c.debt_left)} ₸</div></div>
                </div>

                ${penHTML}
                ${paymentsHTML}

                <div class="mbtn" style="margin-top:12px">
                    <a class="primary" href="${crm}" target="_blank">Открыть в Битрикс24 →</a>
                    <button class="ghost" onclick="closeOv()">Закрыть</button>
                </div>
            </div>`;
        document.getElementById("ov").classList.add("show");
    } catch(err) {
        document.getElementById("modal").innerHTML = `<div class="mhead"><button class="x" onclick="closeOv()">✕</button><h3>${(c&&c.name)||"Контрагент"}</h3></div>
            <div class="mbody"><p style="color:var(--muted)">Не удалось отобразить карточку.</p>
            <div class="mbtn"><button class="ghost" onclick="closeOv()">Закрыть</button></div></div>`;
        document.getElementById("ov").classList.add("show");
    }
}

// ── 10. Реестр должников (PDF) ───────────────────────────────────────────────
function printDebtors() {
    const prev = document.title;
    document.title = "Реестр должников — Возврат ФЗ";
    document.body.classList.add("print-debtors");
    window.print();
    setTimeout(() => { document.body.classList.remove("print-debtors"); document.title = prev; }, 500);
}
