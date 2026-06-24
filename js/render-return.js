// Рендеринг раздела «Возврат зерна» (ФЗ 2025/2026)

// Формат денег в тысячах тенге (везде кроме KPI-плашек)
const fmtTys = v => Math.round((v || 0) / 1000).toLocaleString("ru-RU");

let _returnLoaded = false;
let _vzMapZoom = null, _vzMapSvgSel = null, _vzMapFit = null;

// ── Ленивая загрузка ─────────────────────────────────────────────────────────
function ensureVozvrat() {
    if (_returnLoaded) { if (DR) renderReturn(); return; }
    _returnLoaded = true;
    loadReturn();
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
    const asof = document.getElementById("vzAsof");
    if (asof) asof.textContent = DR.date;
    if (typeof hideYearLoader === "function") hideYearLoader();
    if (typeof hideVzLoader   === "function") hideVzLoader();
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
    const pct = (t.sum_fin > 0 ? t.sum_zachet / t.sum_fin * 100 : 0).toFixed(1);

    if (box) {
        const lines = [];
        if (topDebtor) lines.push(
            `Крупнейший должник — <b>${topDebtor.name}</b>: остаток ${fmtTys(topDebtor.debt)} тыс. ₸`
            + (topDebtor.penalty > 0 ? `, пеня ${fmtTys(topDebtor.penalty)} тыс. ₸` : "")
        );
        lines.push(`До срока поставки (02.11.2026) — <b>${daysLeft > 0 ? daysLeft + " дн." : "просрочено " + Math.abs(daysLeft) + " дн."}</b>`);
        if (DR.totalPenalty > 0)
            lines.push(`Начислено пени по всем договорам: <b>${fmtTys(DR.totalPenalty)} тыс. ₸</b>`);
        else
            lines.push(`Исполнение по РК: <b>${pct}%</b> · Должников: <b>${DR.debtors.length}</b>`);
        box.innerHTML = lines.map(l => `<div class="vz-sum-line">${l}</div>`).join("");
    }

    if (chain) {
        chain.innerHTML =
            `<span>Выдано <b class="num">${fmtTys(t.sum_fin)} тыс. ₸</b></span>` +
            `<span class="vz-arr">→</span>` +
            `<span>Зачтено зерном <b class="num">${fmtTys(t.sum_zachet)} тыс. ₸</b></span>` +
            `<span class="vz-arr">→</span>` +
            `<span>Остаток <b class="num">${fmtTys(t.debt)} тыс. ₸</b></span>`;
    }
}

// ── 2. KPI-плашки (5 штук, цвета как в форварде) ────────────────────────────
function renderVzKpis() {
    const t = DR.total;
    const pctNum = t.sum_fin > 0 ? t.sum_zachet / t.sum_fin * 100 : 0;
    const pct = pctNum.toFixed(1);
    const pctTag = pctNum >= 95 ? "#3C6B4A" : pctNum >= 70 ? "#B97F18" : "#9E4A40";
    const pctBarClr = pctNum >= 95 ? "linear-gradient(90deg,#2F5D40,#3C6B4A)"
                    : pctNum >= 70 ? "linear-gradient(90deg,#C99526,#E8A82E)"
                    : "linear-gradient(90deg,#9E4A40,#C06A5C)";
    const n = v => (v / 1e9).toLocaleString("ru-RU", {maximumFractionDigits: 2});
    const tip = v => (v || 0).toLocaleString("ru-RU") + " ₸";

    const items = [
        {
            lab: "Профинансировано",
            big: n(t.sum_fin), unit: "млрд ₸",
            sub: fmtT(DR.cps.length) + " СХТП · " + fmtT(t.vol_contr) + " т",
            tag: "#E8A82E", tip: tip(t.sum_fin)
        },
        {
            lab: "Поставлено зерна",
            big: fmtT(t.vol_ret), unit: "т",
            sub: fmtMlrd(t.sum_ret) + " ₸ сумма за зерно",
            tag: "#3C6B4A", tip: tip(t.sum_ret)
        },
        {
            lab: "В т.ч. зачтено в предоплату",
            big: n(t.sum_zachet), unit: "млрд ₸",
            sub: "погашение предоплаты зерном",
            tag: "#3C6B4A", tip: tip(t.sum_zachet)
        },
        {
            lab: "В т.ч. доплата СХТП",
            big: n(t.sum_doplata), unit: "млрд ₸",
            sub: "начислено сверх предоплаты",
            tag: "#E8A82E", tip: tip(t.sum_doplata)
        },
        {
            lab: "% исполнения",
            big: pct, unit: "%",
            sub: "на сумму финансирования",
            tag: pctTag, pct: pctNum, pctBar: pctBarClr
        },
        {
            lab: "Остаток долга",
            big: n(t.debt), unit: "млрд ₸",
            sub: DR.debtors.length + " СХТП-должников",
            tag: t.debt > 0 ? "#9E4A40" : "#3C6B4A",
            red: t.debt > 0, tip: tip(t.debt)
        },
    ];

    const box = document.getElementById("vzKpis");
    if (!box) return;
    box.innerHTML = "";
    items.forEach(it => {
        const c = el("div", "kpi");
        if (it.tip) c.title = it.tip;
        c.innerHTML = `<div class="tag" style="background:${it.tag}"></div>
            <div class="lab">${it.lab}</div>
            <div class="big num" style="${it.red ? "color:#E05A4A" : ""}">${it.big}<small>${it.unit}</small></div>
            <div class="sub">${it.sub}</div>
            ${it.pct != null ? `<div class="bar"><i style="width:${Math.min(100,it.pct)}%;${it.pctBar ? "background:" + it.pctBar : ""}"></i></div>` : ""}`;
        box.appendChild(c);
    });
}

// ── 2б. Справка (авто-анализ исполнения) ─────────────────────────────────────
function renderVzSpravka() {
    const box = document.getElementById("vzSpravka");
    if (!box) return;
    const regs = DR.regions.filter(r => r.sum_fin > 0);
    const done    = regs.filter(r => r.pct_exec >= 1.0);
    const inProg  = regs.filter(r => r.pct_exec > 0 && r.pct_exec < 1.0).sort((a,b) => b.debt - a.debt);
    const debtReg = regs.filter(r => r.debt > 0).sort((a,b) => b.debt - a.debt);

    const linkReg = (r) =>
        `<button class="vz-sp-link" onclick="vzSelectRegion('${r.code}')">${r.name}</button>`;

    let rows = "";

    if (done.length) {
        rows += `<div class="vz-sp-row ok2">
            <div class="vz-sp-ico">✓</div>
            <div><b>Полностью исполнили:</b> ${done.map(linkReg).join(", ")}.</div>
        </div>`;
    }

    if (debtReg.length) {
        rows += `<div class="vz-sp-row bad">
            <div class="vz-sp-ico">!</div>
            <div><b>Наибольший долг:</b> ${debtReg.map(r =>
                `<button class="vz-sp-link bad-lnk" onclick="vzSelectRegion('${r.code}')">${r.name}</button> (${fmtTys(r.debt)} тыс. ₸)`
            ).join("; ")}.</div>
        </div>`;
    }

    if (inProg.length) {
        rows += `<div class="vz-sp-row warn">
            <div class="vz-sp-ico">→</div>
            <div><b>В процессе исполнения:</b> ${inProg.map(r =>
                `<button class="vz-sp-link warn-lnk" onclick="vzSelectRegion('${r.code}')">${r.name}</button> — ${(r.pct_exec*100).toFixed(0)}%`
            ).join("; ")} — до срока 02.11.2026.</div>
        </div>`;
    }

    box.innerHTML = rows || `<div class="vz-sp-row ok2"><div class="vz-sp-ico">✓</div><div>Все обязательства исполнены.</div></div>`;
}

// ── 3. Воронка возврата ───────────────────────────────────────────────────────
function renderVzFunnel() {
    const box = document.getElementById("vzFunnel");
    if (!box) return;
    const t = DR.total;
    const totalSchtp = DR.cps.length;
    const retSchtp   = DR.cps.filter(c => c.vol_total > 0).length;
    const debtSchtp  = DR.debtors.length;
    const maxSum = Math.max(1, t.sum_fin);

    const stages = [
        {
            k: "Выдано (профинансировано)",
            pct: "100%",
            schtp: totalSchtp, vol: t.vol_contr, sum: t.sum_fin,
            cls: "s0"
        },
        {
            k: "Зачтено зерном",
            pct: t.sum_fin > 0 ? (t.sum_zachet / t.sum_fin * 100).toFixed(1) + "% от выдано" : "—",
            schtp: retSchtp, vol: t.vol_ret, sum: t.sum_zachet,
            cls: "szachet"
        },
        {
            k: "Остаток долга",
            pct: t.sum_fin > 0 ? (t.debt / t.sum_fin * 100).toFixed(1) + "% от выдано" : "—",
            schtp: debtSchtp, vol: null, sum: t.debt,
            cls: "sdebt"
        },
    ];

    box.innerHTML = stages.map(s => {
        const w = s.sum > 0 ? Math.max(s.sum / maxSum * 100, 34) : 0;
        const vText = s.vol !== null
            ? `${fmtT(s.schtp)} СХТП · ${fmtT(s.vol)} тонн · ${fmtTys(s.sum)} тыс. ₸`
            : s.sum > 0 ? `${fmtT(s.schtp)} СХТП · ${fmtTys(s.sum)} тыс. ₸`
            : "нет долга";
        return `<div class="fstage">
            <div class="ft"><span>${s.k}</span><span class="muted">${s.pct}</span></div>
            <div class="ftrack ${s.cls}"><i style="width:${w.toFixed(1)}%"></i>
                <div class="v">${vText}</div></div>
        </div>`;
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
            <div style="min-width:0;flex:1">
                <div class="vz-debtor-name">${c.name}</div>
                <div class="vz-debtor-sub">${regShortName} · ${c.dog_num}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;padding-left:8px">
                <div class="num" style="font-weight:800;font-size:13px">${fmtTys(c.debt)} тыс. ₸</div>
                ${c.penalty > 0 ? `<div style="font-size:11px;color:#C07030;font-weight:700;margin-top:2px">пеня ${fmtTys(c.penalty)} тыс. ₸</div>` : ""}
            </div>
        </div>`;
    }).join("");
}

// ── 3в. Переключатель видов в левой карточке ──────────────────────────────────
function setVzView(v) {
    const areas = { map: "vzMapArea", tab: "vzTabArea", crop: "vzCropArea", debt: "vzDebtArea" };
    Object.entries(areas).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = k === v ? "" : "none";
    });
    const btns = { map: "vzBtnMap", tab: "vzBtnTab", crop: "vzBtnCrop", debt: "vzBtnDebt" };
    Object.entries(btns).forEach(([k, id]) => {
        const b = document.getElementById(id);
        if (b) b.classList.toggle("act", k === v);
    });
    const hint = document.getElementById("vzHint");
    if (hint) hint.textContent = v === "map"
        ? "Цвет — исполнение предоплаты. Нажмите область — список договоров."
        : v === "tab"  ? "Исполнение по областям (суммы — тыс. ₸, объём — тонн). Нажмите строку — договоры."
        : v === "crop" ? "Поставка по культурам: законтрактовано vs фактически сдано."
        : "Список контрагентов с непогашенной задолженностью по предоплате.";
    // Воронка скрывается когда открыт раздел должников
    const fc = document.getElementById("vzFunnelCard");
    if (fc) fc.style.display = v === "debt" ? "none" : "";

    if (v === "tab")  renderVzTabArea();
    if (v === "crop") renderVzCropTable();
    if (v === "debt") renderVzDebtTable();
}

let _debtRegFilter = "";

let _debtSearchQ = "";
let _debtSearchDebounce;
function _onDebtSearch(inp) {
    _debtSearchQ = inp.value;
    clearTimeout(_debtSearchDebounce);
    _debtSearchDebounce = setTimeout(renderVzDebtTable, 200);
}

function renderVzDebtTable(regFilter, searchQ) {
    if (regFilter !== undefined) _debtRegFilter = regFilter;
    if (searchQ  !== undefined) _debtSearchQ   = searchQ;
    const box = document.getElementById("vzDebtArea");
    if (!box) return;

    if (!DR.debtors.length) {
        box.innerHTML = `<div style="color:#3C6B4A;font-size:14px;font-weight:700;padding:24px;text-align:center">✓ Все обязательства исполнены</div>`;
        return;
    }

    const regs = [...new Set(DR.debtors.map(c => c.reg).filter(Boolean))].sort((a,b) => a.localeCompare(b,"ru"));
    let list = _debtRegFilter ? DR.debtors.filter(c => c.reg === _debtRegFilter) : DR.debtors;
    if (_debtSearchQ) {
        const q = _debtSearchQ.toLowerCase();
        list = list.filter(c => ((c.name||"")+" "+(c.bin||"")).toLowerCase().includes(q));
    }
    const sorted = [...list].sort((a, b) => (b.sum_zachet||0) - (a.sum_zachet||0));
    const f = v => v > 0 ? fmtTys(v) : "—";

    let num = 0;
    const rows = sorted.map(c => {
        num++;
        const safeBin = (c.bin||"").replace(/'/g,"\\'");
        const safeDog = (c.dog_num||"").replace(/'/g,"\\'");
        const pctStr  = c.sum_fin > 0 ? ((c.sum_zachet||0) / c.sum_fin * 100).toFixed(1)+"%" : "—";
        return `<tr onclick="openCpReturnByBin('${safeBin}','${safeDog}')" style="cursor:pointer">
            <td class="c" style="color:var(--muted);font-size:11px">${num}</td>
            <td class="l"><b>${c.name}</b></td>
            <td class="l" style="font-size:11px;color:var(--muted)">${c.cult||"—"}</td>
            <td class="r">${c.vol_fin > 0 ? c.vol_fin.toLocaleString("ru-RU",{maximumFractionDigits:1}) : "—"}</td>
            <td class="r">${f(c.sum_fin)}</td>
            <td class="r">${c.vol_total > 0 ? c.vol_total.toLocaleString("ru-RU",{maximumFractionDigits:1}) : "—"}</td>
            <td class="r">${f(c.sum_total)}</td>
            <td class="r">${f(c.sum_zachet)}</td>
            <td class="r">${(c.sum_dop_fact||0) > 0 ? f(c.sum_dop_fact) : "—"}</td>
            <td class="r" style="font-weight:700">${pctStr}</td>
            <td class="r" style="font-weight:700">${f(c.debt)}</td>
        </tr>`;
    }).join("");

    const tFin   = list.reduce((s,c) => s+(c.sum_fin||0),     0);
    const tZach  = list.reduce((s,c) => s+(c.sum_zachet||0),  0);
    const tTotal = list.reduce((s,c) => s+(c.sum_total||0),   0);
    const tVol   = list.reduce((s,c) => s+(c.vol_total||0),   0);
    const tDop   = list.reduce((s,c) => s+(c.sum_dop_fact||0),0);
    const tDebt  = list.reduce((s,c) => s+(c.debt||0),        0);
    const tVolFin= list.reduce((s,c) => s+(c.vol_fin||0),     0);
    const tPct   = tFin > 0 ? (tZach/tFin*100).toFixed(1)+"%" : "—";

    // Фильтр-бар с поиском и выбором области
    const selOpts = `<option value="">Все области (${DR.debtors.length})</option>`
        + regs.map(r => `<option value="${r}"${_debtRegFilter===r?" selected":""}>${r} (${DR.debtors.filter(c=>c.reg===r).length})</option>`).join("");
    const filterBar = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div style="position:relative;flex:1;min-width:200px;max-width:300px">
            <input id="debtSearchInp" type="text" value="${(_debtSearchQ||"").replace(/"/g,"&quot;")}"
                placeholder="Поиск по названию / БИН…"
                oninput="_onDebtSearch(this)"
                style="width:100%;padding:8px 36px 8px 14px;border:1.5px solid var(--line);border-radius:10px;
                       font-size:13px;font-weight:600;color:var(--ink);background:var(--card);outline:none;
                       transition:border-color .2s"
                onfocus="this.style.borderColor='#3C6B4A'"
                onblur="this.style.borderColor=''">
            <span style="position:absolute;right:11px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--muted);pointer-events:none">🔍</span>
        </div>
        <div style="position:relative;flex:0 0 auto">
            <select onchange="renderVzDebtTable(this.value)"
                style="appearance:none;-webkit-appearance:none;background:var(--card);border:1.5px solid var(--line);
                       border-radius:10px;padding:8px 32px 8px 12px;font-size:13px;font-weight:600;
                       color:var(--ink);cursor:pointer;min-width:200px;outline:none">
                ${selOpts}
            </select>
            <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:12px;color:var(--muted)">▾</span>
        </div>
        <span style="font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap">${list.length} должников · остаток <b>${fmtTys(tDebt)} тыс. ₸</b></span>
    </div>`;

    const _prevDebtActive = document.activeElement?.id;
    const _prevDebtCursor = document.activeElement?.selectionStart ?? null;

    box.innerHTML = filterBar + `<div style="overflow-x:auto"><table class="rtab debt-rtab" style="min-width:820px;width:100%">
        <thead>
            <tr>
                <th rowspan="2" style="width:28px">#</th>
                <th rowspan="2" class="l" style="min-width:150px">Наименование должника</th>
                <th rowspan="2" class="l" style="min-width:90px">Культура</th>
                <th rowspan="2" class="r" style="min-width:70px">Объём законтр., т</th>
                <th rowspan="2" class="r" style="min-width:80px">Сумма финансирования, тыс. ₸</th>
                <th colspan="4" style="border-bottom:1px solid var(--line)">Погашение</th>
                <th rowspan="2" class="r" style="min-width:72px">% исп.</th>
                <th rowspan="2" class="r" style="min-width:80px">Остаток долга, тыс. ₸</th>
            </tr>
            <tr>
                <th class="r" style="min-width:60px;font-weight:600">Объём, т</th>
                <th class="r" style="min-width:72px;font-weight:600">Сумма за зерно, тыс. ₸</th>
                <th class="r" style="min-width:72px;font-weight:600">В т.ч. предоплата, тыс. ₸</th>
                <th class="r" style="min-width:60px;font-weight:600">В т.ч. доплата, тыс. ₸</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td colspan="2" class="l" style="font-weight:700">Итого: ${list.length} должников</td>
            <td></td>
            <td class="r" style="font-weight:700">${tVolFin > 0 ? tVolFin.toLocaleString("ru-RU",{maximumFractionDigits:1}) : "—"}</td>
            <td class="r" style="font-weight:700">${fmtTys(tFin)}</td>
            <td class="r" style="font-weight:700">${tVol > 0 ? tVol.toLocaleString("ru-RU",{maximumFractionDigits:1}) : "—"}</td>
            <td class="r" style="font-weight:700">${fmtTys(tTotal)}</td>
            <td class="r" style="font-weight:700">${fmtTys(tZach)}</td>
            <td class="r" style="font-weight:700">${tDop > 0 ? fmtTys(tDop) : "—"}</td>
            <td class="r" style="font-weight:700">${tPct}</td>
            <td class="r" style="font-weight:700">${fmtTys(tDebt)}</td>
        </tr></tfoot>
    </table></div>`;

    if (_prevDebtActive === 'debtSearchInp') {
        const inp = document.getElementById('debtSearchInp');
        if (inp) { inp.focus(); try { inp.setSelectionRange(_prevDebtCursor, _prevDebtCursor); } catch(_){} }
    }
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
                <td>${fmtTys(r.sum_fin)}</td>
                <td>${fmtT(r.vol_ret)}</td>
                <td>${fmtTys(r.sum_ret)}</td>
                <td>${r.sum_doplata > 0 ? fmtTys(r.sum_doplata) : "—"}</td>
                <td>${fmtTys(r.sum_zachet)}</td>
                <td style="color:${pc};font-weight:800">${p.toFixed(1)}%</td>
            </tr>`;
        }).join("");

    const t = DR.total;
    const totP = (t.pct_exec * 100);
    const totPc = totP >= 95 ? "#3C6B4A" : "#9A6716";
    box.innerHTML = `<div class="tablescroll" style="max-height:390px"><table class="rtab">
        <thead><tr>
            <th class="l">Область</th>
            <th>Профинанс., тыс. ₸</th>
            <th>Объём т</th>
            <th>Сумма за зерно, тыс. ₸</th>
            <th>Доплата, тыс. ₸</th>
            <th>Зачтено, тыс. ₸</th>
            <th>% исп.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td class="l">Итого по РК<br><span style="font-size:10px;font-weight:600;opacity:.7">${DR.cps.length} СХТП</span></td>
            <td>${fmtTys(t.sum_fin)}</td>
            <td>${fmtT(t.vol_ret)}</td>
            <td>${fmtTys(t.sum_ret)}</td>
            <td>${fmtTys(t.sum_doplata)}</td>
            <td>${fmtTys(t.sum_zachet)}</td>
            <td style="color:${totPc}">${totP.toFixed(1)}%</td>
        </tr></tfoot>
    </table></div>`;
}

// ── 3д. Таблица по культурам (план vs факт + законтрактовано из СВОД) ─────────
// Хранит список замен по культуре для показа в модалке
let _cropSubstMap = {};

function renderVzCropTable() {
    const box = document.getElementById("vzCropArea");
    if (!box || box._rendered) return;
    box._rendered = true;

    const CROPS = [
        { key: "cl3", label: "Пшеница 3 класс", family: "wheat" },
        { key: "cl4", label: "Пшеница 4 класс", family: "wheat" },
        { key: "cl5", label: "Пшеница 5 класс", family: "wheat" },
        { key: "bar", label: "Ячмень 2 класс",  family: "barley" },
    ];
    const FAMILIES = ["wheat", "wheat", "wheat", "barley"]; // индекс → семейство

    const agg = CROPS.map(cr => ({
        label: cr.label, key: cr.key, family: cr.family,
        vol_contr: 0, sum_contr: 0,
        vol_fact: 0,  sum_fact: 0,
        vol_subst_class: 0,  // замена внутри семейства (пш 3→пш 4)
        vol_subst_type:  0,  // замена между семействами (вне контракта)
        subst_cps: []        // контрагенты-заменители для этой культуры
    }));
    _cropSubstMap = {};

    DR.cps.forEach(c => {
        const cult = (c.cult || "").toLowerCase();
        let ci = -1;
        if      (cult.includes("пшениц") && cult.includes("3")) ci = 0;
        else if (cult.includes("пшениц") && cult.includes("4")) ci = 1;
        else if (cult.includes("пшениц") && cult.includes("5")) ci = 2;
        else if (cult.includes("ячмень"))                        ci = 3;

        if (ci >= 0) {
            agg[ci].vol_contr += c.vol_fin || 0;
            agg[ci].sum_contr += c.sum_fin || 0;
        }

        const delivs = [c.cl3, c.cl4, c.cl5, c.bar];
        delivs.forEach((d, di) => {
            if (!d || !d.vol) return;
            agg[di].vol_fact += d.vol;
            agg[di].sum_fact += d.sum;
            if (ci >= 0 && ci !== di) {
                // Одно семейство (пш→пш) → замена класса, не "вне контракта"
                if (FAMILIES[ci] === FAMILIES[di]) {
                    agg[di].vol_subst_class += d.vol;
                } else {
                    // Разные семейства (пш→ячмень или наоборот) → вне контракта
                    agg[di].vol_subst_type += d.vol;
                    agg[di].subst_cps.push(c);
                }
            }
        });
    });

    // Сохраняем для модалок
    CROPS.forEach((cr, i) => { _cropSubstMap[cr.key] = agg[i].subst_cps; });

    const active = agg.filter(r => r.vol_contr > 0 || r.vol_fact > 0);

    const rows = active.map(r => {
        const pct    = r.vol_contr > 0 ? r.vol_fact / r.vol_contr * 100 : 0;
        const pctTxt = r.vol_contr > 0 ? pct.toFixed(1) + "%" : "—";
        const pc     = r.vol_contr === 0 ? "var(--muted)" : pct >= 95 ? "#3C6B4A" : pct >= 70 ? "#9A6716" : "#5A7A65";

        // Замена класса внутри семейства — просто пометка, не "вне контракта"
        const classNote = r.vol_subst_class > 0
            ? `<br><span style="font-size:9.5px;color:#9A6716;font-weight:600">в т.ч. замена класса: ${fmtT(r.vol_subst_class)} т</span>` : "";
        // Замена типа культуры — "вне контракта", кликабельно
        const typeNote = r.vol_subst_type > 0
            ? `<br><span class="crop-out-link" onclick="openCropSubstList('${r.key}')" style="font-size:9.5px;color:#C05A20;font-weight:700;text-decoration:underline;cursor:pointer">вне контракта: ${fmtT(r.vol_subst_type)} т ↗</span>` : "";
        // Если вся строка — вне контракта (нет своих договоров)
        const noContr = r.vol_contr === 0 && r.vol_fact > 0 && r.vol_subst_type > 0
            ? `<br><span class="crop-out-link" onclick="openCropSubstList('${r.key}')" style="font-size:9.5px;color:#C05A20;font-weight:700;text-decoration:underline;cursor:pointer">вне контракта — замена типа культуры ↗</span>` : "";

        return `<tr>
            <td class="l">${r.label}${classNote}${typeNote}${noContr}</td>
            <td>${r.vol_contr > 0 ? fmtT(r.vol_contr) : "—"}</td>
            <td>${r.sum_contr > 0 ? fmtTys(r.sum_contr) : "—"}</td>
            <td style="${r.vol_fact === 0 ? "opacity:.5" : ""}">${r.vol_fact > 0 ? fmtT(r.vol_fact) : "0"}</td>
            <td style="${r.sum_fact === 0 ? "opacity:.5" : ""}">${r.sum_fact > 0 ? fmtTys(r.sum_fact) : "—"}</td>
            <td style="color:${pc};font-weight:800">${pctTxt}</td>
        </tr>`;
    }).join("");

    const tv = active.reduce((s,r)=>s+r.vol_contr,0);
    const ts = active.reduce((s,r)=>s+r.sum_contr,0);
    const fv = active.reduce((s,r)=>s+r.vol_fact, 0);
    const fs = active.reduce((s,r)=>s+r.sum_fact, 0);
    const totPct = tv > 0 ? (fv/tv*100).toFixed(1)+"%" : "—";
    const totPc  = tv > 0 && fv/tv >= 0.95 ? "#3C6B4A" : "#9A6716";

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
                <th>Сумма, тыс. ₸</th>
                <th class="gs">Объём, т</th>
                <th>Сумма за зерно, тыс. ₸</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td class="l">Итого</td>
            <td>${fmtT(tv)}</td>
            <td>${fmtTys(ts)}</td>
            <td>${fmtT(fv)}</td>
            <td>${fmtTys(fs)}</td>
            <td style="color:${totPc}">${totPct}</td>
        </tr></tfoot>
        </table>
    </div>`;
}

function openCropSubstList(cropKey) {
    const cps   = _cropSubstMap[cropKey] || [];
    const LABEL = { cl3:"Пшеница 3 кл", cl4:"Пшеница 4 кл", cl5:"Пшеница 5 кл", bar:"Ячмень 2 кл" };
    if (!cps.length) return;

    const rows = cps.map(c => {
        const d    = c[cropKey] || {};
        const safe = (c.bin||"").replace(/'/g,"\\'");
        const dog  = (c.dog_num||"").replace(/'/g,"\\'");
        return `<div onclick="openCpReturnByBin('${safe}','${dog}')"
            style="display:flex;align-items:center;justify-content:space-between;
                   padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer;
                   background:var(--card);transition:background .1s"
            onmouseover="this.style.background='#F5F0E8'" onmouseout="this.style.background='var(--card)'">
            <div>
                <div style="font-weight:800;font-size:13px">${c.name}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.reg||""} · договор: ${c.cult||"—"}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;padding-left:12px">
                <div style="font-weight:700;font-size:13px">${fmtT(d.vol||0)} т</div>
                <div style="font-size:11px;color:var(--muted)">${fmtTys(d.sum||0)} тыс. ₸</div>
            </div>
        </div>`;
    }).join("");

    document.getElementById("modal").innerHTML = `
        <div class="mhead">
            <button class="x" onclick="closeOv()">✕</button>
            <div style="padding:4px 0 2px">
                <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Вне контракта — замена типа культуры</div>
                <h3 style="color:#F8F3E6;margin:0">${LABEL[cropKey]||cropKey}</h3>
                <div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:4px">${cps.length} контрагентов — нажмите для просмотра истории погашения</div>
            </div>
        </div>
        <div style="overflow-y:auto;max-height:360px">${rows}</div>`;
    document.getElementById("ov").style.display = "flex";
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

    // Pre-build СХТП count per region name
    const schtpByName = {};
    DR.cps.forEach(c => { schtpByName[c.reg] = (schtpByName[c.reg] || 0) + 1; });

    const proj = d3.geoMercator().fitExtent([[14,16],[906,464]], GEO);
    const gp = d3.geoPath(proj);
    const G = document.createElementNS(NS, "g"); G.setAttribute("id","vzZoomG"); svg.appendChild(G);

    GEO.features.forEach(f => {
        const code = featCode(f);
        const rg = code ? byCode[code] : null;

        // Рисуем ВСЕ регионы (как в форварде) — без программы = светло-серый
        const col = (rg && rg.sum_fin > 0) ? colorFor(rg.pct_exec) : "#ECE6D5";

        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", gp(f));
        p.setAttribute("fill", col);
        p.setAttribute("stroke", "#FBFAF5");
        p.setAttribute("stroke-width", "0.8");
        p.setAttribute("class", "geopath");
        if (rg && rg.sum_fin > 0) {
            p.style.cursor = "pointer";
            p.addEventListener("mousemove", e => vzShowTip(e, rg));
            p.addEventListener("mouseleave", () => { const t=document.getElementById("vzTip"); if(t) t.classList.remove("show"); });
            p.addEventListener("click", () => vzSelectRegion(rg.code));
        }
        G.appendChild(p);

        if (rg && rg.sum_fin > 0) {
            const c = gp.centroid(f);
            const lab = document.createElementNS(NS, "g");
            lab.setAttribute("class", "glabg");
            lab.dataset.cx = c[0].toFixed(1); lab.dataset.cy = c[1].toFixed(1);
            lab.setAttribute("transform", `translate(${c[0].toFixed(1)},${c[1].toFixed(1)})`);
            const nm = regShort(rg.name);
            const schtpCnt = schtpByName[rg.name] || 0;
            const cntTxt = "СХТП " + schtpCnt + " · " + (rg.pct_exec * 100).toFixed(0) + "%";
            const wMax = Math.max(nm.length * 6.6, cntTxt.length * 5.2) + 14;
            const rect = document.createElementNS(NS, "rect");
            rect.setAttribute("class", "pill");
            rect.setAttribute("x", (-wMax/2).toFixed(1)); rect.setAttribute("y", "-13");
            rect.setAttribute("width", wMax.toFixed(1)); rect.setAttribute("height", "26"); rect.setAttribute("rx", "7");
            const t1 = document.createElementNS(NS, "text"); t1.setAttribute("class","glab name"); t1.setAttribute("y","-4"); t1.textContent = nm;
            const t2 = document.createElementNS(NS, "text"); t2.setAttribute("class","glab cnt2"); t2.setAttribute("y","6"); t2.textContent = cntTxt;
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
    const schtpCnt = DR.cps.reduce((s, c) => s + (c.reg === rg.name ? 1 : 0), 0);
    tip.innerHTML = `<b>${rg.name}</b>
        <div class="l"><span>СХТП</span><span>${schtpCnt}</span></div>
        <div class="l"><span>Предоплата</span><span>${fmtTys(rg.sum_fin)} тыс. ₸</span></div>
        <div class="l"><span>Поставлено</span><span>${fmtT(rg.vol_ret)} т</span></div>
        <div class="l"><span>Исполнение</span><span>${pct}%</span></div>
        ${rg.debt > 0 ? `<div class="l"><span>Остаток долга</span><span style="color:#E99">${fmtTys(rg.debt)} тыс. ₸</span></div>` : ""}
        ${rg.sum_doplata > 0 ? `<div class="l"><span>Доплата</span><span style="color:#C9A030">${fmtTys(rg.sum_doplata)} тыс. ₸</span></div>` : ""}`;
    tip.classList.add("show");
    const wrap = document.getElementById("vzMapWrap").getBoundingClientRect();
    let x = e.clientX - wrap.left + 14, y = e.clientY - wrap.top + 10;
    if (x > wrap.width - 180) x -= 200;
    tip.style.left = x + "px"; tip.style.top = y + "px";
}

function vzMapZoomBy(f) {
    if (_vzMapZoom && _vzMapSvgSel) _vzMapSvgSel.transition().duration(250).call(_vzMapZoom.scaleBy, f);
}
function vzMapZoomReset() {
    if (_vzMapZoom && _vzMapSvgSel && _vzMapFit) _vzMapSvgSel.transition().duration(300).call(_vzMapZoom.transform, _vzMapFit);
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
                <td class="r num">${fmtTys(r.sum_fin)}</td>
                <td class="r num">${fmtT(r.vol_ret)}</td>
                <td class="r num">${fmtTys(r.sum_zachet)}</td>
                <td class="r num">${pct}%</td>
                <td class="r num">${r.sum_doplata > 0 ? fmtTys(r.sum_doplata) : "—"}</td>
                <td class="r num">${pctKsn}</td>
                <td class="r num" style="${r.debt > 0 ? "font-weight:700" : ""}">${r.debt > 0 ? fmtTys(r.debt) : "—"}</td>
                <td class="r num">${regPenalty > 0 ? fmtTys(regPenalty) : "—"}</td>
            </tr>`;
        }).join("");

    const t = DR.total;
    const totPenalty = DR.totalPenalty;
    box.innerHTML = `<div class="tablescroll"><table>
        <thead><tr>
            <th>Область</th>
            <th class="r">Предоплата, тыс. ₸</th>
            <th class="r">Возвращено, т</th>
            <th class="r">Зачтено, тыс. ₸</th>
            <th class="r">% исп.</th>
            <th class="r">Доплата нач., тыс. ₸</th>
            <th class="r">% исп. (КСН)</th>
            <th class="r">Остаток долга, тыс. ₸</th>
            <th class="r">Пеня, тыс. ₸</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td class="r" style="text-align:left;font-weight:800">Итого по РК</td>
            <td class="r num">${fmtTys(t.sum_fin)}</td>
            <td class="r num">${fmtT(t.vol_ret)}</td>
            <td class="r num">${fmtTys(t.sum_zachet)}</td>
            <td class="r num">${(t.pct_exec*100).toFixed(1)}%</td>
            <td class="r num">${fmtTys(t.sum_doplata)}</td>
            <td class="r num">${t.sum_doplata > 0 ? (t.sum_ksn/t.sum_doplata*100).toFixed(0) + "%" : "—"}</td>
            <td class="r num" style="${t.debt>0?"font-weight:800":""}">${fmtTys(t.debt)}</td>
            <td class="r num">${totPenalty > 0 ? fmtTys(totPenalty) : "—"}</td>
        </tr></tfoot>
    </table></div>
    <div style="padding:10px 0 4px">
        <button class="segb" style="font-size:12px" onclick="vzSelectRegion('all')">📋 Все договоры по областям</button>
    </div>`;
}

// ── 6. Список договоров (по клику на область или показ всех) ─────────────────
function vzSelectRegion(code) {
    const panel = document.getElementById("vzRegPanel");
    const pname = document.getElementById("vzRegName");
    if (!panel || !pname) return;

    let cps;
    if (code === "all") {
        pname.textContent = "Исполнение по договорам — все области";
        // Сортируем: область А→Я, внутри — контрагент А→Я
        cps = [...DR.cps].sort((a, b) =>
            (a.reg||"").localeCompare(b.reg||"", "ru") ||
            (a.name||"").localeCompare(b.name||"", "ru")
        );
    } else {
        const reg = DR.regions.find(r => r.code === code);
        if (!reg) return;
        pname.textContent = reg.name + " область";
        cps = DR.cps
            .filter(c => { const r = DR.regions.find(x => x.name === c.reg); return r && r.code === code; })
            .sort((a, b) => (a.name||"").localeCompare(b.name||"", "ru"));
    }

    // Строим строки с группировкой по области если показываем все
    let rows = "";
    let lastReg = null;
    cps.forEach(c => {
        const safeBin = c.bin.replace(/'/g,"\\'");
        const safeDog = c.dog_num.replace(/'/g,"\\'");
        if (code === "all" && c.reg !== lastReg) {
            lastReg = c.reg;
            rows += `<tr class="rtab-reg-hdr">
                <td class="l" colspan="7"><b>${c.reg}</b></td>
            </tr>`;
        }
        rows += `<tr style="cursor:pointer" onclick="openCpReturnByBin('${safeBin}','${safeDog}')">
            <td class="l">${code === "all" ? "" : c.reg}</td>
            <td class="l">${c.name}<div class="cpsub">${c.form||""} · ${c.dog_num||""}</div></td>
            <td>${c.cult||"—"}</td>
            <td>${fmtT(c.vol_fin)}</td>
            <td>${fmtTys(c.sum_fin)}</td>
            <td>${fmtT(c.vol_total)}</td>
            <td style="${c.debt>0?"font-weight:700":""}">${c.debt>0?fmtTys(c.debt)+" тыс. ₸":"✓"}</td>
        </tr>`;
    });

    document.getElementById("vzRegRows").innerHTML = rows;
    panel.style.display = "";
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── 7. Рейтинг + авто-анализ ─────────────────────────────────────────────────
function renderVzRanking() {
    const box = document.getElementById("vzRanking");
    if (!box) return;
    const regs = DR.regions.filter(r => r.sum_fin > 0).sort((a, b) => b.pct_exec - a.pct_exec);
    const best  = regs.filter(r => r.pct_exec >= 1.0);
    const worst = [...regs].sort((a, b) => b.debt - a.debt).filter(r => r.debt > 0).slice(0, 3);

    let html = `<div class="vz-rank-title">Рейтинг исполнения по областям</div>`;
    html += `<div class="vz-rank-list">`;
    html += regs.map((r, i) => {
        const pct = (r.pct_exec * 100).toFixed(1);
        const bar = Math.min(100, r.pct_exec * 100);
        const col = colorFor(r.pct_exec);
        const debtTxt = r.debt > 0
            ? `<div class="vz-rank-debt">${fmtTys(r.debt)}<span class="vz-rank-unit"> тыс. ₸</span></div>`
            : `<div class="vz-rank-debt ok">✓</div>`;
        return `<div class="vz-rank-row">
            <div class="vz-rank-num">${i+1}</div>
            <div class="vz-rank-name">${r.name}</div>
            <div class="vz-rank-bar"><div style="width:${bar}%;background:${col}"></div></div>
            <div class="vz-rank-pct">${pct}%</div>
            ${debtTxt}
        </div>`;
    }).join("");
    html += `</div>`;

    html += `<div class="vz-rank-analysis">`;
    if (best.length) html += `<div class="vz-ana-item ok2">Полностью исполнили: ${best.map(r=>r.name).join(", ")}.</div>`;
    if (worst.length) html += `<div class="vz-ana-item bad">Наибольший долг: ${worst.map(r=>`${r.name} (${fmtTys(r.debt)} тыс. ₸)`).join("; ")}.</div>`;
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
        <span class="num">${totalForecast > 0 ? fmtTys(totalForecast) + " тыс. ₸" : "0 ₸ (срок ещё не наступил)"}</span>
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
                return `<div class="ln"><span>${x.label}</span><span class="num">${fmtT(x.d.vol)} т</span><span class="num">${fmtTys(x.d.sum)} тыс. ₸</span><span class="num" style="color:var(--muted)">${pr} тыс. ₸/т</span></div>`;
            }).join("")
            : `<div class="ln"><span style="color:var(--muted)">Поставок нет</span></div>`;

        // История платежей — расширенный формат событий
        const fmtSum = v => {
            if (!v) return "0 тыс. ₸";
            return Math.round(v / 1000).toLocaleString("ru-RU") + " тыс. ₸";
        };
        let paymentsHTML = "";
        if (c.payments && c.payments.length > 0) {
            const evRows = c.payments.map(p => {
                const type = p.type || "money";
                if (type === "grain") {
                    return `<div class="cp-ev cp-ev--grain">
                        <div class="cp-ev-date">${fmtDate(p.date)}</div>
                        <div class="cp-ev-body">
                            <div class="cp-ev-label">Поставлено зерно${p.label ? " — " + p.label : ""}</div>
                            <div class="cp-ev-meta">${fmtT(p.vol)} т · ${fmtSum(p.sum)} · зачтено в предоплату</div>
                            <div class="cp-ev-balance">Остаток долга: <b>${fmtSum(p.balance)}</b></div>
                        </div>
                    </div>`;
                }
                if (type === "penalty") {
                    const d1 = fmtDate(p.date_from), d2 = fmtDate(p.date_to);
                    return `<div class="cp-ev cp-ev--penalty">
                        <div class="cp-ev-date">${d1}<br>–<br>${d2}</div>
                        <div class="cp-ev-body">
                            <div class="cp-ev-label">Начислена пеня — просрочка ${p.days} дн.</div>
                            <div class="cp-ev-meta">База: ${fmtSum(p.base)} × 0,1% × ${p.days} дн.</div>
                            <div class="cp-ev-balance" style="color:#E05A4A">Пеня: <b>${fmtSum(p.amount)}</b></div>
                        </div>
                    </div>`;
                }
                // type === "money"
                return `<div class="cp-ev cp-ev--money">
                    <div class="cp-ev-date">${fmtDate(p.date)}</div>
                    <div class="cp-ev-body">
                        <div class="cp-ev-label">Погашено деньгами</div>
                        <div class="cp-ev-meta">${fmtSum(p.amount)}</div>
                        ${p.balance != null ? `<div class="cp-ev-balance">Остаток долга: <b>${fmtSum(p.balance)}</b></div>` : ""}
                    </div>
                </div>`;
            }).join("");
            paymentsHTML = `<div class="cp-sec">
                <div class="cp-sec-title">История погашений</div>
                <div class="cp-timeline">${evRows}</div>
            </div>`;
        }

        // Срок поставки зависит от культуры: масличные — 16.11, зерновые — 02.11
        const cultNorm = normCult(c.cult || "");
        const isOilCrop = OIL.includes(cultNorm);
        const deadlineTxt = isOilCrop ? "16.11.2026" : "02.11.2026";
        const penaltyStart = isOilCrop ? "17.11.2026" : "03.11.2026";

        // Блок пени
        const penHTML = c.penalty > 0
            ? `<div class="garbox late" style="margin:6px 0"><span>Пеня начислена (из данных)</span><span class="num">${fmtTys(c.penalty)} тыс. ₸</span></div>
               <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Срок поставки: ${deadlineTxt} · Пеня с ${penaltyStart} · 0,1% / день</div>`
            : `<div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:8px">Пеня не начислена (срок поставки ${deadlineTxt})</div>`;

        const debtColor = "font-weight:800";
        const doplataTxt = c.sum_ksn > 0
            ? `<div><div class="l">Доплата по КСН (выплачена)</div><div class="v num" style="color:#3C6B4A">${fmtTys(c.sum_ksn)} тыс. ₸</div></div>`
            : (c.sum_dop_plan > 0 ? `<div><div class="l">К доплате СХТП</div><div class="v num">${fmtTys(c.sum_dop_plan)} тыс. ₸ <span style="color:var(--muted);font-size:11px">(не выплачена)</span></div></div>` : "");

        // Прогресс исполнения
        const execPct = c.sum_fin > 0 ? Math.min(100, c.sum_zachet / c.sum_fin * 100) : 0;
        const execColor = execPct >= 100 ? "#3C6B4A" : execPct >= 70 ? "#B97F18" : "#E05A4A";

        document.getElementById("modal").innerHTML = `
            <div class="mhead">
                <button class="x" onclick="closeOv()">✕</button>
                <div class="toprow">
                    <div class="mava" style="background:linear-gradient(135deg,#9E4A40,#C0614F)">${ini}</div>
                    <div>
                        <h3 style="color:#F8F3E6">${c.name}</h3>
                        <div class="msub">${c.form} · ${c.reg} обл. · ${c.rayon} р-н · ${todayFmt}</div>
                    </div>
                </div>
                <span class="badge b-fin stbadge" style="background:#3c2a07;color:#F2C357">Возврат зерна</span>
            </div>
            <div class="mbody">

                <div class="cp-sec">
                    <div class="cp-sec-title">Договор</div>
                    <div class="cp-meta">
                        <span><span class="cp-ml">БИН</span> ${bin||"—"}</span>
                        <span><span class="cp-ml">№</span> ${c.dog_num||"—"}</span>
                        <span><span class="cp-ml">Дата</span> ${fmtDate(c.dog_date)}</span>
                        <span><span class="cp-ml">Культура</span> ${c.cult||"—"}</span>
                    </div>
                </div>

                <div class="cp-sec cp-sec--amber">
                    <div class="cp-sec-title">Предоплата</div>
                    <div class="cp-3col">
                        <div class="cp-fig">
                            <div class="cp-fig-val num">${fmtTys(c.sum_fin)}<small> тыс. ₸</small></div>
                            <div class="cp-fig-lab">выдано</div>
                        </div>
                        <div class="cp-fig">
                            <div class="cp-fig-val num">${fmtT(c.vol_fin)}<small> т</small></div>
                            <div class="cp-fig-lab">объём по договору</div>
                        </div>
                        <div class="cp-fig">
                            <div class="cp-fig-val num">${c.price_fin > 0 ? fmtT(c.price_fin) : "—"}<small>${c.price_fin > 0 ? " ₸/т" : ""}</small></div>
                            <div class="cp-fig-lab">цена</div>
                        </div>
                    </div>
                </div>

                <div class="cp-sec cp-sec--green">
                    <div class="cp-sec-title">Поставлено зерна</div>
                    ${classes.length ? `<div class="cp-classes">${classes.map(x => {
                        const pr = x.d.vol > 0 ? fmtT(Math.round(x.d.sum / x.d.vol)) : "—";
                        return `<div class="cp-cls-row">
                            <span class="cp-cls-name">${x.label}</span>
                            <span class="num">${fmtT(x.d.vol)} т</span>
                            <span class="num">${fmtTys(x.d.sum)} тыс. ₸</span>
                            <span class="cp-ml">${pr} ₸/т</span>
                        </div>`;
                    }).join("")}</div>` : `<div class="cp-empty">Поставок нет</div>`}
                    ${c.vol_total > 0 ? `<div class="cp-cls-total">
                        <span>Итого</span>
                        <span class="num">${fmtT(c.vol_total)} т</span>
                        <span class="num">${fmtTys(c.sum_total)} тыс. ₸</span>
                        <span class="cp-ml">${c.price_avg > 0 ? fmtT(c.price_avg) + " ₸/т" : "—"}</span>
                    </div>` : ""}
                </div>

                <div class="cp-sec">
                    <div class="cp-sec-title">Взаиморасчёты</div>
                    <div class="cp-pairs">
                        <div class="cp-pair"><span class="cp-ml">Зачтено в предоплату</span><span class="num">${fmtTys(c.sum_zachet)} тыс. ₸</span></div>
                        <div class="cp-pair"><span class="cp-ml">Погашено зерном</span><span class="num">${fmtTys(c.paid_grain)} тыс. ₸</span></div>
                        <div class="cp-pair"><span class="cp-ml">Погашено деньгами</span><span class="num">${fmtTys(c.paid_money)} тыс. ₸</span></div>
                        ${c.vol_left > 0 ? `<div class="cp-pair"><span class="cp-ml">Остаток объёма</span><span class="num">${fmtT(c.vol_left)} т</span></div>` : ""}
                        ${c.sum_ksn > 0 ? `<div class="cp-pair"><span class="cp-ml">Доплата по КСН</span><span class="num" style="color:#3C6B4A">${fmtTys(c.sum_ksn)} тыс. ₸ <span style="font-size:11px;font-weight:600;color:var(--muted)">(выплачена)</span></span></div>` : ""}
                        ${c.sum_dop_plan > 0 && !c.sum_ksn ? `<div class="cp-pair"><span class="cp-ml">К доплате СХТП</span><span class="num">${fmtTys(c.sum_dop_plan)} тыс. ₸ <span style="font-size:11px;color:var(--muted)">(не выплачена)</span></span></div>` : ""}
                    </div>
                </div>

                <div class="cp-sec">
                    <div class="cp-sec-title">Исполнение предоплаты — ${execPct.toFixed(1)}%</div>
                    <div class="cp-exec-bar"><div style="width:${execPct.toFixed(1)}%;background:${execColor};height:100%;border-radius:5px;transition:width .5s"></div></div>
                </div>

                <div class="cp-sec" style="border-left-color:#3C6B4A">
                    <div class="cp-sec-title">Итог</div>
                    <div class="cp-2col">
                        <div class="cp-fig">
                            <div class="cp-fig-val num">${fmtTys(c.debt)}<small> тыс. ₸</small></div>
                            <div class="cp-fig-lab">остаток долга</div>
                        </div>
                        <div class="cp-fig">
                            <div class="cp-fig-val num" style="color:var(--muted)">${c.penalty > 0 ? fmtTys(c.penalty) : "0"}<small> тыс. ₸</small></div>
                            <div class="cp-fig-lab">пеня</div>
                        </div>
                    </div>
                    <div class="cp-note">${c.penalty > 0 ? `Пеня начислена с ${penaltyStart} · 0,1% в день` : `Срок поставки: ${deadlineTxt} — пеня не начислена`}</div>
                </div>

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

// ── 10. Печать раздела возврата (кнопка «PDF» в шапке) ───────────────────────
function printReturnSection() {
    if (!DR) { alert("Данные ещё загружаются."); return; }
    const t = DR.total;
    const today = new Date().toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit", year:"numeric" });
    const f  = n => Math.round(n).toLocaleString("ru-RU");
    const fm = n => (n / 1e9).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " млрд";

    // Таблица по областям
    const regs = DR.regions.filter(r => r.sum_fin > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    let regRows = "";
    let num = 1;
    regs.forEach(r => {
        const pct = r.sum_fin > 0 ? (r.sum_zachet / r.sum_fin * 100).toFixed(1) + "%" : "—";
        const debtCol = r.debt > 0 ? `<td class="err">${f(r.debt)}</td>` : `<td class="ok">✓</td>`;
        regRows += `<tr>
            <td class="c">${num++}</td>
            <td class="l">${r.name}</td>
            <td>${f(r.vol_contr)}</td>
            <td>${f(r.sum_fin)}</td>
            <td>${f(r.vol_ret)}</td>
            <td>${f(r.sum_zachet)}</td>
            <td>${pct}</td>
            ${debtCol}
        </tr>`;
    });
    regRows += `<tr class="tot">
        <td colspan="2">ИТОГО ПО РК: ${regs.length} областей</td>
        <td>${f(t.vol_contr)}</td>
        <td>${f(t.sum_fin)}</td>
        <td>${f(t.vol_ret)}</td>
        <td>${f(t.sum_zachet)}</td>
        <td>${t.sum_fin > 0 ? (t.sum_zachet / t.sum_fin * 100).toFixed(1) + "%" : "—"}</td>
        <td class="${t.debt > 0 ? "terr" : "tok"}">${t.debt > 0 ? f(t.debt) : "✓"}</td>
    </tr>`;

    // Таблица по культурам
    const CROPS = [
        { key: "cl3", label: "Пшеница 3 класс" },
        { key: "cl4", label: "Пшеница 4 класс" },
        { key: "cl5", label: "Пшеница 5 класс" },
        { key: "bar", label: "Ячмень 2 класс"  },
    ];
    const agg = CROPS.map(cr => ({ label: cr.label, key: cr.key, vol_contr: 0, sum_contr: 0, vol_fact: 0, sum_fact: 0 }));
    DR.cps.forEach(c => {
        const cult = (c.cult || "").toLowerCase();
        let ci = -1;
        if      (cult.includes("пшениц") && cult.includes("3")) ci = 0;
        else if (cult.includes("пшениц") && cult.includes("4")) ci = 1;
        else if (cult.includes("пшениц") && cult.includes("5")) ci = 2;
        else if (cult.includes("ячмень"))                        ci = 3;
        if (ci >= 0) { agg[ci].vol_contr += c.vol_fin || 0; agg[ci].sum_contr += c.sum_fin || 0; }
        [c.cl3, c.cl4, c.cl5, c.bar].forEach((d, di) => {
            if (!d || !d.vol) return;
            agg[di].vol_fact += d.vol; agg[di].sum_fact += d.sum;
        });
    });
    const active = agg.filter(r => r.vol_contr > 0 || r.vol_fact > 0);
    let cropRows = active.map(r => {
        const pct = r.vol_contr > 0 ? (r.vol_fact / r.vol_contr * 100).toFixed(1) + "%" : "—";
        return `<tr>
            <td class="l">${r.label}</td>
            <td>${r.vol_contr > 0 ? f(r.vol_contr) : "—"}</td>
            <td>${r.sum_contr > 0 ? f(r.sum_contr) : "—"}</td>
            <td>${f(r.vol_fact)}</td>
            <td>${r.sum_fact > 0 ? f(r.sum_fact) : "—"}</td>
            <td>${pct}</td>
        </tr>`;
    }).join("");
    const ctv = active.reduce((s,r)=>s+r.vol_contr,0);
    const cts = active.reduce((s,r)=>s+r.sum_contr,0);
    const cfv = active.reduce((s,r)=>s+r.vol_fact,0);
    const cfs = active.reduce((s,r)=>s+r.sum_fact,0);
    cropRows += `<tr class="tot"><td>Итого</td><td>${f(ctv)}</td><td>${f(cts)}</td><td>${f(cfv)}</td><td>${f(cfs)}</td>
        <td>${ctv > 0 ? (cfv/ctv*100).toFixed(1)+"%" : "—"}</td></tr>`;

    const debtorCount = DR.debtors ? DR.debtors.length : 0;

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Отчёт — Возврат зерна ФЗ</title>
<style>
@page { size: A4 landscape; margin: 12mm 10mm; }
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
body{font-size:11px;color:#1a1a1a}
h2{font-size:12px;font-weight:800;margin:10px 0 5px;color:#22402E}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
th{background:#22402E;color:#F4ECD8;font-size:10px;font-weight:700;padding:6px;text-align:center;border:1px solid #1a3020}
td{padding:5px 6px;border:1px solid #ddd;vertical-align:middle;text-align:center;font-variant-numeric:tabular-nums}
.l{text-align:left}.c{text-align:center}
.err{color:#B03020;font-weight:700}.ok{color:#2F5D40;font-weight:700}
tr.tot td{background:#22402E;color:#F4ECD8;font-weight:800;text-align:center}
tr.tot td:first-child,.tot .l{text-align:left}
.terr{color:#FFBBAA}.tok{color:#AAFFCC}
tr:nth-child(even):not(.tot) td{background:#FAFAF8}
.doc-header{background:linear-gradient(135deg,#1a3020,#2F5D40);color:#F4ECD8;padding:12px 18px;
  margin-bottom:10px;border-radius:6px;display:flex;align-items:center;gap:16px}
.seal{width:48px;height:48px;border-radius:11px;flex-shrink:0;background:linear-gradient(150deg,#F6C45E,#D69A1E);
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#3a2a06;
  box-shadow:inset 0 0 0 2px #ffffff44}
.info h1{font-size:13px;font-weight:800;color:#fff;margin:0 0 3px}
.org{font-size:9.5px;color:#B8D4C0;font-weight:600;margin-bottom:5px}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{background:#ffffff18;border:1px solid #ffffff30;border-radius:4px;padding:2px 7px;font-size:9px;font-weight:700;color:#F4ECD8}
.badge.warn{background:#9E4A4044;border-color:#C06A5C66;color:#FFCCC0}
.dt{font-size:9px;color:#8EB89E;margin-left:auto;text-align:right;align-self:flex-end}
.kpi-row{display:flex;gap:8px;margin-bottom:10px}
.kpi-box{flex:1;border:1px solid #DDD5C0;border-radius:6px;padding:8px 10px;background:#FFFEF9}
.kpi-lab{font-size:8.5px;color:#8A8070;font-weight:700;text-transform:uppercase;letter-spacing:.2px}
.kpi-val{font-size:15px;font-weight:800;color:#22402E;margin-top:2px}
.kpi-sub{font-size:9px;color:#8A8070;margin-top:1px}
</style></head><body>
<div class="doc-header">
  <div class="seal">ПКК</div>
  <div class="info">
    <h1>Отчёт по возврату зерна — Форвардный закуп</h1>
    <div class="org">АО «НК «Продкорпорация» · Департамент закупа СХП</div>
    <div class="badges">
      <span class="badge">ФЗ 2026</span>
      <span class="badge">${DR.cps.length} контрагентов</span>
      ${debtorCount > 0 ? `<span class="badge warn">${debtorCount} должников</span>` : '<span class="badge">Долгов нет</span>'}
    </div>
  </div>
  <div class="dt">Сформировано:<br><b>${today}</b></div>
</div>

<div class="kpi-row">
  <div class="kpi-box"><div class="kpi-lab">Профинансировано</div><div class="kpi-val">${fm(t.sum_fin)}</div><div class="kpi-sub">${f(t.vol_contr)} т</div></div>
  <div class="kpi-box"><div class="kpi-lab">Поставлено (зачтено)</div><div class="kpi-val">${fm(t.sum_zachet)}</div><div class="kpi-sub">${f(t.vol_ret)} т</div></div>
  <div class="kpi-box"><div class="kpi-lab">Остаток долга</div><div class="kpi-val" style="color:${t.debt>0?'#B03020':'#2F5D40'}">${fm(t.debt)}</div><div class="kpi-sub">${t.sum_fin>0?(t.sum_zachet/t.sum_fin*100).toFixed(1)+"% исп.":"—"}</div></div>
  <div class="kpi-box"><div class="kpi-lab">Контрагенты</div><div class="kpi-val">${DR.cps.length}</div><div class="kpi-sub">из них должников: ${debtorCount}</div></div>
</div>

<h2>Исполнение по областям</h2>
<table><thead><tr>
  <th style="width:22px">№</th><th style="width:140px">Область</th>
  <th>Объём дог., т</th><th>Профинансировано, ₸</th>
  <th>Поставлено, т</th><th>Зачтено, ₸</th>
  <th>% исп.</th><th>Остаток долга, ₸</th>
</tr></thead><tbody>${regRows}</tbody></table>

<h2>Исполнение по культурам</h2>
<table><thead><tr>
  <th style="width:130px">Культура</th>
  <th>Объём по дог., т</th><th>Сумма по дог., ₸</th>
  <th>Поставлено, т</th><th>Сумма за зерно, ₸</th><th>% исп.</th>
</tr></thead><tbody>${cropRows}</tbody></table>

</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Разрешите всплывающие окна для этой страницы"); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
}

// ── 11. Реестр должников (PDF) ───────────────────────────────────────────────
function printDebtors() {
    const list = DR.cps.filter(c => c.penalty > 0)
        .sort((a, b) => a.reg.localeCompare(b.reg, "ru") || b.debt - a.debt);

    if (!list.length) { alert("СХТП с начисленной пеней нет"); return; }

    const f  = n => Math.round(n).toLocaleString("ru-RU");
    const fm = n => Math.round(n).toLocaleString("ru-RU");

    // Группировка по области
    const byReg = {};
    list.forEach(c => { (byReg[c.reg] = byReg[c.reg] || []).push(c); });

    const today = new Date().toLocaleDateString("ru-RU",
        { day: "2-digit", month: "2-digit", year: "numeric" });

    let num = 1;
    let rows = "";

    const sum6 = arr => arr.reduce((s, c) => s + c, 0);

    Object.entries(byReg).forEach(([reg, cps]) => {
        rows += `<tr class="rh"><td colspan="10">${reg} область — ${cps.length} СХТП</td></tr>`;

        let tSF = 0, tVT = 0, tST = 0, tSZ = 0, tDP = 0, tDB = 0, tPN = 0;
        cps.forEach(c => {
            tSF += c.sum_fin; tVT += c.vol_total; tST += c.sum_total;
            tSZ += c.sum_zachet; tDP += (c.sum_dop_fact||0); tDB += c.debt; tPN += c.penalty;
            const pct = c.sum_fin > 0 ? (c.sum_zachet / c.sum_fin * 100).toFixed(1) + "%" : "—";
            rows += `<tr>
                <td class="c">${num++}</td>
                <td class="l">${c.name}<div class="s">${c.form} · ${c.dog_num} · ${c.cult || ""}</div></td>
                <td>${f(c.sum_fin)}</td>
                <td>${f(c.vol_total)}</td>
                <td>${f(c.sum_total)}</td>
                <td>${f(c.sum_zachet)}</td>
                <td>${f(c.sum_dop_fact||0)}</td>
                <td>${pct}</td>
                <td class="err">${f(c.debt)}</td>
                <td class="err">${f(c.penalty)}</td>
            </tr>`;
        });
        rows += `<tr class="sub">
            <td colspan="2">Итого: ${cps.length} СХТП</td>
            <td>${fm(tSF)}</td>
            <td>${f(tVT)}</td>
            <td>${fm(tST)}</td>
            <td>${fm(tSZ)}</td>
            <td>${fm(tDP)}</td>
            <td>${tSF > 0 ? (tSZ / tSF * 100).toFixed(1) + "%" : "—"}</td>
            <td class="err">${fm(tDB)}</td>
            <td class="err">${fm(tPN)}</td>
        </tr>`;
    });

    const gt = { sf:0, vt:0, st:0, sz:0, dp:0, db:0, pn:0 };
    list.forEach(c => { gt.sf+=c.sum_fin; gt.vt+=c.vol_total; gt.st+=c.sum_total;
                        gt.sz+=c.sum_zachet; gt.dp+=(c.sum_dop_fact||0); gt.db+=c.debt; gt.pn+=c.penalty; });
    rows += `<tr class="tot">
        <td colspan="2">ИТОГО ПО РК: ${list.length} СХТП</td>
        <td>${fm(gt.sf)}</td>
        <td>${f(gt.vt)}</td>
        <td>${fm(gt.st)}</td>
        <td>${fm(gt.sz)}</td>
        <td>${fm(gt.dp)}</td>
        <td>${gt.sf > 0 ? (gt.sz / gt.sf * 100).toFixed(1) + "%" : "—"}</td>
        <td class="terr">${fm(gt.db)}</td>
        <td class="terr">${fm(gt.pn)}</td>
    </tr>`;

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Реестр должников — Возврат ФЗ</title>
<style>
@page { size: A4 landscape; margin: 12mm 10mm; }
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
body{font-size:11px;color:#1a1a1a}
h1{font-size:14px;font-weight:700;margin-bottom:3px}
.meta{font-size:10px;color:#666;margin-bottom:9px}
table{width:100%;border-collapse:collapse}
th{background:#22402E;color:#F4ECD8;font-size:10px;font-weight:700;
   padding:6px 6px;text-align:center;border:1px solid #1a3020}
td{padding:5px 6px;border:1px solid #ddd;vertical-align:middle;text-align:center;font-variant-numeric:tabular-nums}
.s{font-size:9px;color:#666;margin-top:2px}
.l{text-align:left}
.err{color:#B03020;font-weight:700}
tr.rh td{background:#FDF3DE;font-weight:800;font-size:11px;
         padding:6px 6px;border-top:2px solid #E8A82E;border-bottom:1px solid #E8A82E;color:#3a2a06;text-align:left}
tr.sub td{background:#F5F0E6;font-weight:700;border-top:1px solid #bbb;border-bottom:2px solid #aaa;font-size:10.5px}
tr.sub td:first-child{text-align:left}
tr.tot td{background:#22402E;color:#F4ECD8;font-weight:800;font-size:11px}
tr.tot td:first-child{text-align:left}
tr.tot .terr{color:#FFBBAA}
tr:nth-child(even):not(.rh):not(.sub):not(.tot) td{background:#FAFAF8}
.doc-header{background:linear-gradient(135deg,#1a3020 0%,#22402E 60%,#2F5D40 100%);
  color:#F4ECD8;padding:14px 20px;margin-bottom:10px;border-radius:6px;
  display:flex;align-items:center;gap:18px}
.doc-header .seal{width:52px;height:52px;border-radius:12px;flex-shrink:0;
  background:linear-gradient(150deg,#F6C45E,#D69A1E);
  display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:16px;color:#3a2a06;letter-spacing:.5px;
  box-shadow:inset 0 0 0 2px #ffffff44}
.doc-header .info{flex:1}
.doc-header h1{font-size:14px;font-weight:800;color:#fff;margin:0 0 4px;line-height:1.3}
.doc-header .org{font-size:10px;color:#B8D4C0;font-weight:600;margin-bottom:6px}
.doc-header .badges{display:flex;gap:8px;flex-wrap:wrap}
.badge{background:#ffffff18;border:1px solid #ffffff30;border-radius:4px;
  padding:2px 8px;font-size:9px;font-weight:700;color:#F4ECD8}
.badge.warn{background:#9E4A4044;border-color:#C06A5C66;color:#FFCCC0}
.doc-header .dt{font-size:9px;color:#8EB89E;margin-left:auto;text-align:right;flex-shrink:0;align-self:flex-end}
</style></head><body>
<div class="doc-header">
  <div class="seal">ПКК</div>
  <div class="info">
    <h1>Реестр СХТП с начисленной пеней — Возврат зерна (ФЗ 2025/2026)</h1>
    <div class="org">АО «НК «Продкорпорация» · Департамент закупа СХП</div>
    <div class="badges">
      <span class="badge">Форвардный закуп 2025/2026</span>
      <span class="badge warn">Просрочка · Пеня начислена</span>
      <span class="badge">${list.length} СХТП-должников</span>
      <span class="badge">${Object.keys(byReg).length} областей</span>
    </div>
  </div>
  <div class="dt">Сформировано:<br><b>${today}</b></div>
</div>
<table>
<thead><tr>
  <th style="width:22px">№</th>
  <th style="width:185px">Наименование СХТП</th>
  <th style="width:85px">Профинансировано, ₸</th>
  <th style="width:58px">Поставлено, т</th>
  <th style="width:85px">Сумма за объём, ₸</th>
  <th style="width:85px">В т.ч. на сумму финансирования, ₸</th>
  <th style="width:75px">В т.ч. доплата, ₸</th>
  <th style="width:58px">% исп. на сумму финансирования</th>
  <th style="width:85px">Остаток долга, ₸</th>
  <th style="width:75px">Пеня, ₸</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Разрешите всплывающие окна для этой страницы"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
}
