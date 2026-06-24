let sortKey = "sum", sortDir = -1, curRegion = null, listMode = null;

function markStatusChip(name) {
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("act", c.dataset.st === name));
}

function openRegion(code) {
    const rg = D.regions.find(r => r.code === code); if (!rg) return;
    curRegion = rg; listMode = {type: "region", key: rg.name}; markStatusChip(null);
    document.querySelectorAll(".bub,.geopath").forEach(b => b.classList.toggle("sel", b.dataset.code === code));
    const p = $("#regionPanel"); p.style.display = ""; $("#rName").textContent = rg.name + " область";
    const pct = rg.limit ? rg.fin[2] / rg.limit * 100 : 0; $("#rPill").textContent = "освоение " + pct.toFixed(0) + "%";
    const k = [["Лимит", fmtMlrd(rg.limit) + " ₸"], ["Профинансировано", fmtMlrd(rg.fin[2]) + " ₸"],
        ["Законтр. объём, тонн", fmtT(rg.fin[3])], ["Заявок / СХТП", rg.rec[1] + " / " + rg.rec[0]]];
    $("#rKpis").innerHTML = k.map(x => `<div><div class="l">${x[0]}</div><div class="n num">${x[1]}</div></div>`).join("");
    renderRows(); p.scrollIntoView({behavior: "smooth", block: "start"});
}

function openCulture(name) {
    curRegion = null; listMode = {type: "culture", key: name}; markStatusChip(null);
    document.querySelectorAll(".bub,.geopath").forEach(b => b.classList.remove("sel"));
    const list = D.cps.filter(c => (c.cults || []).map(normCult).includes(name));
    let tv = 0, ts = 0;
    list.forEach(c => (c.lines || []).forEach(l => { if (normCult(l.cult) === name) { tv += l.vol || 0; ts += l.sum || 0; } }));
    const schtp = uniqSchtp(list);
    const dogs = list.length;
    const p = $("#regionPanel"); p.style.display = ""; $("#rName").textContent = "Культура: " + name; $("#rPill").textContent = schtp + " СХТП · " + dogs + " договоров";
    const k = [["СХТП", schtp], ["Договоров", dogs], ["Объём по культуре, тонн", fmtT(tv)],
        ["Сумма по культуре, ₸", fmtMlrd(ts) + " ₸"]];
    $("#rKpis").innerHTML = k.map(x => `<div><div class="l">${x[0]}</div><div class="n num">${x[1]}</div></div>`).join("");
    renderRows(); p.scrollIntoView({behavior: "smooth", block: "start"});
}

function openStatus(name) {
    curRegion = null; listMode = {type: "status", key: name}; markStatusChip(name);
    document.querySelectorAll(".bub,.geopath").forEach(b => b.classList.remove("sel"));
    const norm = s => (s || "").toLowerCase().replace(/\s+/g, " ");
    const list = D.cps.filter(c => norm(c.status) === norm(name) || (c.sts && c.sts.some(s => norm(s) === norm(name))));
    const tv = list.reduce((a, c) => a + c.vol, 0), ts = list.reduce((a, c) => a + c.sum, 0), ta = list.reduce((a, c) => a + c.apps, 0);
    // Для "Профинансировано" — авторитетные данные из СВОД (сумма по регионам)
    const schtp = isProfin(name) ? D.total.fin[0] : uniqSchtp(list);
    const dogs  = isProfin(name) ? D.total.fin[1] : list.length;
    const p = $("#regionPanel"); p.style.display = ""; $("#rName").textContent = "Статус: " + name; $("#rPill").textContent = schtp + " СХТП · " + dogs + " договоров";
    const k = [["СХТП", schtp], ["Договоров", dogs], ["Объём, тонн", fmtT(tv)], ["Сумма, ₸", fmtMlrd(ts) + " ₸"]];
    $("#rKpis").innerHTML = k.map(x => `<div><div class="l">${x[0]}</div><div class="n num">${x[1]}</div></div>`).join("");
    renderRows(); p.scrollIntoView({behavior: "smooth", block: "start"});
}

function renderRows() {
    if (!listMode) return;
    const _norm = s => (s || "").toLowerCase().replace(/\s+/g, " ");
    let list = listMode.type === "region" ? D.cps.filter(c => c.reg === listMode.key) :
               listMode.type === "culture" ? D.cps.filter(c => (c.cults || []).map(normCult).includes(listMode.key)) :
               D.cps.filter(c => _norm(c.status) === _norm(listMode.key) || (c.sts && c.sts.some(s => _norm(s) === _norm(listMode.key))));
    list = list.slice().sort((a, b) => {
        let va = a[sortKey], vb = b[sortKey];
        if (sortKey === "cult") { va = a.cults.join(); vb = b.cults.join(); }
        if (typeof va === "string") return sortDir * va.localeCompare(vb, "ru");
        return sortDir * (va - vb);
    });
    const tb = $("#rRows"); tb.innerHTML = "";
    list.forEach(c => {
        const tr = el("tr");
        const haGa = c.vol > 0 ? Math.round(c.vol * 1.5).toLocaleString("ru-RU") : "—";
        tr.innerHTML = `<td><div class="cpname">${c.name}</div><div class="cpsub">${c.form} · ${c.rayon} · БИН ${c.bin}</div></td>
            <td>${c.cults.map(x => `<span class="cult" style="font-size:10px;padding:2px 6px">${x}</span>`).join(" ")}</td>
            <td class="r num">${fmtT(c.vol)}</td><td class="r num">${haGa}</td>
            <td class="r num">${fmtMlrd(c.sum)}</td>
            <td><span class="badge ${statCls(c.status)}">${c.status}</span></td>`;
        tr.addEventListener("click", () => openCp(c));
        tb.appendChild(tr);
    });
    const tv = list.reduce((a, c) => a + c.vol, 0), ts = list.reduce((a, c) => a + c.sum, 0);
    const totHa = tv > 0 ? Math.round(tv * 1.5).toLocaleString("ru-RU") : "—";
    const totSchtp = uniqSchtp(list);
    $("#rFoot").innerHTML = `<tr><td>Итого: ${totSchtp} СХТП · ${list.length} договоров</td><td></td>
        <td class="r num">${fmtT(tv)} тонн</td><td class="r num">${totHa}</td>
        <td class="r num">${fmtMlrd(ts)} ₸</td><td></td></tr>`;
}
