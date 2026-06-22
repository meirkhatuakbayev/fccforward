// Отрисовка раздела «Возврат зерна» (ФЗ)

let _vzInited = false;

// Ленивая загрузка — вызывается из switchView при первом переходе в раздел
function ensureVozvrat() {
    if (_returnLoaded) { if (DR) renderReturn(); return; }
    _returnLoaded = true;
    const box = document.getElementById("vzErrBox");
    if (box) box.textContent = "";
    loadReturn();
}

// ─── KPI-плашки ───────────────────────────────────────────────────────────────
function renderReturnKpis() {
    const t = DR.total;
    const pct = (t.pct_exec * 100).toFixed(1);
    const items = [
        { lab: "Профинансировано",       big: fmtMlrd(t.sum_fin),     unit: "₸",    sub: fmtT(t.vol_contr) + " тонн законтрактовано" },
        { lab: "Возвращено зерном",      big: fmtT(t.vol_ret),        unit: "тонн", sub: fmtMlrd(t.sum_ret) + " ₸" },
        { lab: "Возвращено, сумма",      big: fmtMlrd(t.sum_ret),     unit: "₸",    sub: "в т.ч. зачтено " + fmtMlrd(t.sum_zachet) + " ₸" },
        { lab: "Исполнение (на сумму)",  big: pct,                    unit: "%",    sub: "от суммы предоплаты", pct: +pct },
        { lab: "Остаток долга",          big: fmtMlrd(t.debt),        unit: "₸",    sub: "по РК", red: t.debt > 0 },
        { lab: "Начислено пени",         big: fmtMlrd(DR.totalPenalty),unit: "₸",   sub: "0,1% / день на остаток", red: DR.totalPenalty > 0 },
    ];
    const box = document.getElementById("vzKpis");
    if (!box) return;
    box.innerHTML = "";
    items.forEach(it => {
        const c = el("div", "kpi");
        c.innerHTML = `<div class="tag" style="background:#9E4A40"></div>
            <div class="lab">${it.lab}</div>
            <div class="big num" style="${it.red ? 'color:#E05A4A' : ''}">${it.big}<small>${it.unit}</small></div>
            <div class="sub">${it.sub}</div>
            ${it.pct != null ? `<div class="bar"><i style="width:${Math.min(100, it.pct)}%"></i></div>` : ""}`;
        box.appendChild(c);
    });
}

// ─── Блок должников ───────────────────────────────────────────────────────────
function renderReturnDebtors() {
    const box = document.getElementById("vzDebtors");
    if (!box) return;
    const list = DR.debtors;
    if (!list.length) {
        box.innerHTML = `<p style="color:var(--muted);font-weight:600;padding:16px 0">Должников нет — все обязательства исполнены.</p>`;
        return;
    }
    const rows = list.map(c => `
        <tr style="cursor:pointer" onclick="openCpReturn(${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <td>${c.name}</td>
            <td>${c.reg}</td>
            <td class="r num" style="color:#E05A4A;font-weight:700">${fmtMlrd(c.debt)} ₸</td>
            <td class="r num" style="color:#E05A4A">${c.penalty > 0 ? fmtMlrd(c.penalty) + " ₸" : "—"}</td>
            <td>${c.dog_num || "—"}</td>
        </tr>`).join("");
    box.innerHTML = `
        <div class="tablescroll">
            <table>
                <thead><tr>
                    <th>Контрагент</th>
                    <th>Область</th>
                    <th class="r">Остаток долга, ₸</th>
                    <th class="r">Пеня, ₸</th>
                    <th>№ договора</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// ─── Таблица по областям ──────────────────────────────────────────────────────
let _vzRegion = null; // выбранная область

function renderReturnRegionTable() {
    const box = document.getElementById("vzRegTable");
    if (!box) return;
    const rows = DR.regions
        .filter(r => r.sum_fin > 0 || r.vol_ret > 0 || r.debt > 0)
        .sort((a, b) => b.sum_fin - a.sum_fin)
        .map(r => `
            <tr style="cursor:pointer" onclick="vzSelectRegion('${r.code}')">
                <td>${r.name}</td>
                <td class="r num">${fmtMlrd(r.sum_fin)}</td>
                <td class="r num">${fmtT(r.vol_ret)}</td>
                <td class="r num">${fmtMlrd(r.sum_ret)}</td>
                <td class="r num">${(r.pct_exec * 100).toFixed(1)}%</td>
                <td class="r num">${r.sum_doplata > 0 ? fmtMlrd(r.sum_doplata) : "—"}</td>
                <td class="r num" style="${r.debt > 0 ? 'color:#E05A4A;font-weight:700' : ''}">${r.debt > 0 ? fmtMlrd(r.debt) : "—"}</td>
            </tr>`).join("");
    box.innerHTML = `
        <div class="tablescroll">
            <table>
                <thead><tr>
                    <th>Область</th>
                    <th class="r">Профинанс. ₸</th>
                    <th class="r">Возвращено т</th>
                    <th class="r">Возвращено ₸</th>
                    <th class="r">% исп.</th>
                    <th class="r">Доплата ₸</th>
                    <th class="r">Остаток долга ₸</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// Клик по области — список договоров
function vzSelectRegion(code) {
    const reg = DR.regions.find(r => r.code === code);
    if (!reg) return;
    _vzRegion = code;
    const cps = DR.cps.filter(c => {
        const r = DR.regions.find(r => r.name === c.reg);
        return r && r.code === code;
    }).sort((a, b) => b.debt - a.debt);

    const panel = document.getElementById("vzRegPanel");
    const pname = document.getElementById("vzRegName");
    if (!panel || !pname) return;
    pname.textContent = reg.name + " область";
    panel.style.display = "";

    const rows = cps.map(c => `
        <tr style="cursor:pointer" onclick="openCpReturn(${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <td>${c.name}</td>
            <td>${c.cult || "—"}</td>
            <td class="r num">${fmtT(c.vol_fin)}</td>
            <td class="r num">${fmtMlrd(c.sum_fin)}</td>
            <td class="r num">${fmtT(c.vol_total)}</td>
            <td class="r num" style="${c.debt > 0 ? 'color:#E05A4A;font-weight:700' : ''}">${c.debt > 0 ? fmtMlrd(c.debt) : "—"}</td>
        </tr>`).join("");

    document.getElementById("vzRegRows").innerHTML = rows;
}

// ─── Главная функция отрисовки раздела ────────────────────────────────────────
function renderReturn() {
    if (!DR) return;
    renderReturnKpis();
    renderReturnDebtors();
    renderReturnRegionTable();
    const asof = document.getElementById("vzAsof");
    if (asof) asof.textContent = DR.date;
}

// ─── Карточка контрагента ─────────────────────────────────────────────────────
function openCpReturn(c) {
    try {
        if (typeof c === "string") c = JSON.parse(c);
        const bin = c.bin || "";
        const crm = CONFIG.CRM_BASE
            ? `${CONFIG.CRM_BASE}/crm/deal/list/?apply_filter=Y&FIND=${encodeURIComponent(bin || c.name)}`
            : "#";
        const ini = (c.name || "?").replace(/^(ТОО|КХ|ФХ|КФХ|ЧК|АО|ИП)\s+/i, "").trim().charAt(0).toUpperCase() || "•";

        // Поставки по классам
        const classes = [
            { label: "Пшеница 5 класс",   d: c.cl5 },
            { label: "Пшеница 4 класс",   d: c.cl4 },
            { label: "Пшеница 3 класс",   d: c.cl3 },
            { label: "Ячмень 2 класс",    d: c.bar },
        ].filter(x => x.d && x.d.vol > 0);

        const clRows = classes.map(x => {
            const price = x.d.vol > 0 ? Math.round(x.d.sum / x.d.vol) : 0;
            return `<div class="ln">
                <span>${x.label}</span>
                <span class="num">${fmtT(x.d.vol)} т</span>
                <span class="num">${fmtMlrd(x.d.sum)} ₸</span>
                <span class="num muted">${price > 0 ? fmtT(price) + " ₸/т" : "—"}</span>
            </div>`;
        }).join("") || `<div class="ln"><span style="color:var(--muted)">Поставок нет</span></div>`;

        // Остаток объёма
        const volLeft = Math.max(0, (c.vol_prog || 0) - (c.vol_total || 0));

        // Блок долга и пени
        const debtColor = c.debt > 0 ? "color:#E05A4A;font-weight:700" : "color:#3C6B4A;font-weight:700";
        const penaltyNote = c.penalty > 0
            ? `<div class="garbox late" style="margin:8px 0">
                <span>Пеня начислена (из данных)</span>
                <span>${fmtMlrd(c.penalty)} ₸</span>
               </div>
               <div style="font-size:11px;color:var(--muted);padding:0 0 4px">
                 Срок поставки: 02.11.2026 · Пеня с 03.11.2026 · 0,1% / день
               </div>`
            : "";

        // Доплата
        const doplataPaid = c.sum_ksn > 0
            ? `<div><div class="l">Доплата по КСН (выплачена)</div><div class="v num" style="color:#3C6B4A">${fmtMlrd(c.sum_ksn)} ₸ · ${fmtDate(c.date_doplata)}</div></div>`
            : (c.sum_doplata_plan > 0
                ? `<div><div class="l">К доплате СХТП</div><div class="v num">${fmtMlrd(c.sum_doplata_plan)} ₸ <span style="color:var(--muted);font-size:11px">(не выплачена)</span></div></div>`
                : "");

        $("#modal").innerHTML = `
            <div class="mhead">
                <button class="x" onclick="closeOv()">✕</button>
                <div class="toprow">
                    <div class="mava" style="background:linear-gradient(135deg,#9E4A40,#C0614F)">${ini}</div>
                    <div>
                        <h3 style="color:#F8F3E6">${c.name}</h3>
                        <div class="msub">${c.form} · ${c.reg} обл. · ${c.rayon} р-н</div>
                    </div>
                </div>
                <span class="badge b-fin stbadge">Возврат зерна</span>
            </div>
            <div class="mbody">
                <div class="kv">
                    <div><div class="l">БИН / ИИН</div><div class="v num">${bin || "—"}</div></div>
                    <div><div class="l">№ договора</div><div class="v">${c.dog_num || "—"}</div></div>
                    <div><div class="l">Дата договора</div><div class="v">${fmtDate(c.dog_date)}</div></div>
                    <div><div class="l">Культура (профинанс.)</div><div class="v">${c.cult || "—"}</div></div>
                </div>

                <div class="mfig" style="grid-template-columns:1fr 1fr 1fr">
                    <div>
                        <div class="l">Сумма предоплаты</div>
                        <div class="n num">${fmtMlrd(c.sum_fin)} ₸</div>
                    </div>
                    <div>
                        <div class="l">Объём по договору</div>
                        <div class="n num">${fmtT(c.vol_fin)} т</div>
                    </div>
                    <div>
                        <div class="l">Цена предоплаты</div>
                        <div class="n num">${c.price_fin > 0 ? fmtT(c.price_fin) + " ₸/т" : "—"}</div>
                    </div>
                </div>

                <div class="seclab">Поставлено зерна (по классам)</div>
                <div class="lines">${clRows}</div>

                <div class="mfig" style="grid-template-columns:1fr 1fr 1fr;margin-top:8px">
                    <div>
                        <div class="l">Всего поставлено</div>
                        <div class="n num">${fmtT(c.vol_total)} т</div>
                    </div>
                    <div>
                        <div class="l">На сумму</div>
                        <div class="n num">${fmtMlrd(c.sum_total)} ₸</div>
                    </div>
                    <div>
                        <div class="l">Средняя цена</div>
                        <div class="n num">${c.price_avg > 0 ? fmtT(c.price_avg) + " ₸/т" : "—"}</div>
                    </div>
                </div>

                <div class="kv" style="margin-top:8px">
                    <div><div class="l">Зачтено в предоплату (т)</div><div class="v num">${fmtT(c.vol_zachet)} т</div></div>
                    <div><div class="l">Остаток объёма</div><div class="v num" style="${volLeft > 0 ? 'color:#E05A4A' : ''}">${fmtT(volLeft)} т</div></div>
                    <div><div class="l">Погашено зерном</div><div class="v num">${fmtMlrd(c.paid_grain)} ₸</div></div>
                    <div><div class="l">Погашено деньгами</div><div class="v num">${fmtMlrd(c.paid_money)} ₸</div></div>
                    ${doplataPaid}
                </div>

                <div class="seclab" style="margin-top:12px">Задолженность</div>
                <div class="mfig" style="grid-template-columns:1fr 1fr">
                    <div>
                        <div class="l">Остаток долга</div>
                        <div class="n num" style="${debtColor}">${fmtMlrd(c.debt)} ₸</div>
                    </div>
                    <div>
                        <div class="l">Остаток погашения</div>
                        <div class="n num">${fmtMlrd(c.debt_left)} ₸</div>
                    </div>
                </div>
                ${penaltyNote}

                <div class="mbtn">
                    <a class="primary" href="${crm}" target="_blank">Открыть сделку в Битрикс24 →</a>
                    <button class="ghost" onclick="closeOv()">Закрыть</button>
                </div>
            </div>`;
        $("#ov").classList.add("show");
    } catch (err) {
        $("#modal").innerHTML = `<div class="mhead"><button class="x" onclick="closeOv()">✕</button>
            <h3>${(c && c.name) || "Контрагент"}</h3></div>
            <div class="mbody"><p style="color:var(--muted)">Не удалось показать карточку.</p>
            <div class="mbtn"><button class="ghost" onclick="closeOv()">Закрыть</button></div></div>`;
        $("#ov").classList.add("show");
    }
}
