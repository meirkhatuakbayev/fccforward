function parseRuDate(s) {
    s = String(s || "").trim(); if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/(\d{1,2})([\/.])(\d{1,2})\2(\d{2,4})/);
    if (m) { let y = +m[4]; if (y < 100) y += 2000; if (m[2] === "/") return new Date(y, (+m[1]) - 1, +m[3]); return new Date(y, (+m[3]) - 1, +m[1]); }
    const d = new Date(s); return isNaN(d) ? null : d;
}

function fmtDate(s) {
    const d = parseRuDate(s); if (!d) return s ? String(s) : "—";
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
}

function fmtDateObj(d) {
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
}

function addBusinessDays(d, n) {
    const r = new Date(d); let a = 0;
    while (a < n) { r.setDate(r.getDate() + 1); const w = r.getDay(); if (w !== 0 && w !== 6) a++; }
    return r;
}

function guaranteeDue(dogDateStr) {
    const dog = parseRuDate(dogDateStr); return dog ? addBusinessDays(dog, 20) : null;
}

function openCp(c) {
    try {
        const bin = c.bin || "";
        const crm = CONFIG.CRM_BASE ? `${CONFIG.CRM_BASE}/crm/deal/list/?apply_filter=Y&FIND=${encodeURIComponent(bin || c.name)}` : "#";
        const d = c.dates || {};
        const ini = (c.name || "?").replace(/^(ТОО|КХ|ФХ|КФХ|ЧК|АО|ИП)\s+/i, "").trim().charAt(0).toUpperCase() || "•";
        const fin = isProfin(c.status);
        const volLabel = fin ? "Законтрактованный объём, тонн" : "Заявленный объём, тонн";
        const cmap = {}; (c.lines || []).forEach(l => { if (!l.cult && !l.vol) return; const k = normCult(l.cult); cmap[k] = (cmap[k] || 0) + (l.vol || 0); });
        const cultRows = Object.entries(cmap).sort((a, b) => b[1] - a[1]);
        const cultHTML = cultRows.length ? `<div class="seclab">Культуры (общий объём)</div><div class="lines">` +
            cultRows.map(([n, v]) => `<div class="ln"><span>${n}</span><span class="num">${fmtT(v)} тонн</span><span></span></div>`).join("") + `</div>` : "";

        let dlHTML = "";
        if (fin) {
            const today = new Date(), msDay = 86400000;
            const cultN = cultRows.map(x => x[0]);
            const grain = cultN.filter(c => !OIL.includes(c)), oil = cultN.filter(c => OIL.includes(c));
            const groups = [];
            if (grain.length) groups.push({label: grain.join(", "), d: new Date(2026, 10, 1), txt: "1 ноября 2026"});
            if (oil.length)   groups.push({label: oil.join(", "),   d: new Date(2026, 10, 15), txt: "15 ноября 2026"});
            if (!groups.length) groups.push({label: "Все культуры", d: new Date(2026, 10, 1), txt: "1 ноября 2026"});
            const startReal = parseRuDate(d.dogDate) || parseRuDate(d.fin);
            const start = startReal || new Date(2026, 1, 1);
            const blocks = groups.map(g => {
                const left = Math.ceil((g.d - today) / msDay);
                const total = Math.max(1, (g.d - start) / msDay), pass = Math.min(total, Math.max(0, (today - start) / msDay));
                const pct = Math.min(100, Math.max(0, pass / total * 100)); const over = left < 0;
                return `<div class="dl ${over ? 'over' : ''}">
                    <div class="dlrow"><span>${g.label}</span><span>${over ? 'просрочено ' + Math.abs(left) + ' дн.' : 'осталось ' + left + ' дн.'}</span></div>
                    <div class="dlsub">с ${fmtDateObj(start)}${startReal ? ' (договор)' : ' (ориентир)'} · прошло ${Math.round(pass)} из ${Math.round(total)} дн. · до ${g.txt}</div>
                    <div class="dlbar"><i style="width:${pct.toFixed(1)}%"></i></div>
                    ${over ? '<div class="dlnote">Начисляется ежедневная пеня на остаток суммы</div>' : ''}</div>`;
            }).join("");
            dlHTML = `<div class="seclab">Срок исполнения обязательств</div>${blocks}`;
        }

        let garHTML = "";
        {
            const garProvided = d.gar ? fmtDate(d.gar) : null; const due = guaranteeDue(d.dogDate);
            if (garProvided) {
                garHTML = `<div class="garbox ok2"><span>Гарантия предоставлена</span><span>${garProvided}</span></div>`;
            } else if (due) {
                const left = Math.ceil((due - new Date()) / 86400000);
                const cls = left < 0 ? "late" : left <= 5 ? "soon" : "";
                garHTML = `<div class="garbox ${cls}"><span>Срок предоставления гарантии</span><span>до ${fmtDateObj(due)} · ${left < 0 ? 'просрочено ' + Math.abs(left) + ' дн.' : 'осталось ' + left + ' дн.'}</span></div>`;
            }
        }

        $("#modal").innerHTML = `<div class="mhead"><button class="x" onclick="closeOv()">✕</button>
            <div class="toprow"><div class="mava">${ini}</div><div><h3 style="color:#F8F3E6">${c.name}</h3><div class="msub">${c.form} · ${c.reg} обл. · ${c.rayon} р-н</div></div></div>
            <span class="badge ${statCls(c.status)} stbadge">${c.status}</span></div>
            <div class="mbody">
                <div class="kv">
                    <div><div class="l">БИН / ИИН</div><div class="v num">${bin || "—"}</div></div>
                    <div><div class="l">Дата подачи заявки</div><div class="v">${fmtDate(d.reg)}</div></div>
                    <div><div class="l">Плательщик НДС</div><div class="v">${c.nds || "—"}</div></div>
                    <div><div class="l">Гарант</div><div class="v" style="font-size:12px">${c.garant || "—"}</div></div>
                </div>
                <div class="mfig" style="grid-template-columns:1fr 1fr">
                    <div><div class="l">${volLabel}</div><div class="n num">${fmtT(c.vol)}</div></div>
                    <div><div class="l">Сумма финансирования, ₸</div><div class="n num">${fmtMlrd(c.sum)}</div></div>
                </div>
                ${garHTML}${dlHTML}${cultHTML}
                <div class="mbtn"><a class="primary" href="${crm}" target="_blank">Открыть сделку в Битрикс24 →</a><button class="ghost" onclick="closeOv()">Закрыть</button></div>
            </div>`;
        $("#ov").classList.add("show");
    } catch (err) {
        $("#modal").innerHTML = `<div class="mhead"><button class="x" onclick="closeOv()">✕</button><h3>${(c && c.name) || "Контрагент"}</h3></div>
            <div class="mbody"><p style="color:var(--muted)">Не удалось показать детали карточки.</p>
            <div class="mbtn"><button class="ghost" onclick="closeOv()">Закрыть</button></div></div>`;
        $("#ov").classList.add("show");
    }
}

function closeOv() { $("#ov").classList.remove("show"); }
