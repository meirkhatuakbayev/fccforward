function renderRegionTable() {
    const wrap = $("#regTableWrap"); if (!wrap || !D) return;
    const tn = n => Math.round(n).toLocaleString("ru-RU"), mln = n => Math.round(n / 1e6).toLocaleString("ru-RU");
    const regs = D.regions.filter(r => r.rec[0] > 0 || r.rec[1] > 0).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const rows = regs.map(r => `<tr data-code="${r.code}">
        <td class="l">${r.name}</td>
        <td class="gs">${tn(r.rec[0])}</td><td>${tn(r.rec[3])}</td><td>${mln(r.rec[2])}</td>
        <td class="gs">${tn(r.contr[0])}</td><td>${tn(r.contr[3])}</td><td>${mln(r.contr[2])}</td>
        <td class="gs">${tn(r.fin[0])}</td><td>${tn(r.fin[3])}</td><td>${mln(r.fin[2])}</td>
    </tr>`).join("");
    const t = D.total;
    wrap.innerHTML = `<table class="rtab">
        <thead>
            <tr class="grp"><th class="l" rowspan="2">Область</th><th colspan="3">Поступило заявок</th><th colspan="3">Заключено договоров</th><th colspan="3">Профинансировано</th></tr>
            <tr><th class="gs">СХТП</th><th>Объём, т</th><th>Сумма, млн ₸</th><th class="gs">СХТП</th><th>Объём, т</th><th>Сумма, млн ₸</th><th class="gs">СХТП</th><th>Объём, т</th><th>Сумма, млн ₸</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td class="l">Итого по РК</td>
            <td class="gs">${tn(t.rec[0])}</td><td>${tn(t.rec[3])}</td><td>${mln(t.rec[2])}</td>
            <td class="gs">${tn(t.contr[0])}</td><td>${tn(t.contr[3])}</td><td>${mln(t.contr[2])}</td>
            <td class="gs">${tn(t.fin[0])}</td><td>${tn(t.fin[3])}</td><td>${mln(t.fin[2])}</td>
        </tr></tfoot>
    </table>`;
    wrap.querySelectorAll("tbody tr").forEach(tr => tr.addEventListener("click", () => openRegion(tr.dataset.code)));
    renderCropTable(wrap);
}

function renderCropTable(wrap) {
    if (!D || !D.crops || !D.crops.length) return;
    const tn = n => Math.round(n).toLocaleString("ru-RU"), mln = n => Math.round(n / 1e6).toLocaleString("ru-RU");
    const crops = D.crops.filter(c => (c.rec && (c.rec[3] > 0 || c.rec[0] > 0)) || c.rv > 0);
    const rows = crops.map(c => {
        const rec = c.rec || [0, 0, c.rs, c.rv], contr = c.contr || [0, 0, 0, 0], fin = c.fin || [0, 0, c.fs, c.fv];
        return `<tr data-cult="${c.n}">
            <td class="l">${c.n}</td>
            <td class="gs">${tn(rec[0])}</td><td>${tn(rec[3])}</td><td>${mln(rec[2])}</td>
            <td class="gs">${tn(contr[0])}</td><td>${tn(contr[3])}</td><td>${mln(contr[2])}</td>
            <td class="gs">${tn(fin[0])}</td><td>${tn(fin[3])}</td><td>${mln(fin[2])}</td>
        </tr>`;
    }).join("");
    const sum = (f) => crops.reduce((a, c) => a + ((c[f.a] || [0, 0, 0, 0])[f.i] || 0), 0);
    const tot = `<tfoot><tr><td class="l">Итого по культурам</td>
        <td class="gs">${tn(sum({a: 'rec', i: 0}))}</td><td>${tn(sum({a: 'rec', i: 3}))}</td><td>${mln(sum({a: 'rec', i: 2}))}</td>
        <td class="gs">${tn(sum({a: 'contr', i: 0}))}</td><td>${tn(sum({a: 'contr', i: 3}))}</td><td>${mln(sum({a: 'contr', i: 2}))}</td>
        <td class="gs">${tn(sum({a: 'fin', i: 0}))}</td><td>${tn(sum({a: 'fin', i: 3}))}</td><td>${mln(sum({a: 'fin', i: 2}))}</td>
    </tr></tfoot>`;
    const html = `<div class="ctabttl">В том числе по культурам</div>
        <table class="rtab">
            <thead>
                <tr class="grp"><th class="l" rowspan="2">Культура</th><th colspan="3">Поступило заявок</th><th colspan="3">Заключено договоров</th><th colspan="3">Профинансировано</th></tr>
                <tr><th class="gs">СХТП</th><th>Объём, т</th><th>Сумма, млн ₸</th><th class="gs">СХТП</th><th>Объём, т</th><th>Сумма, млн ₸</th><th class="gs">СХТП</th><th>Объём, т</th><th>Сумма, млн ₸</th></tr>
            </thead>
            <tbody>${rows}</tbody>
            ${tot}</table>`;
    wrap.insertAdjacentHTML("beforeend", html);
    wrap.querySelectorAll("tbody tr[data-cult]").forEach(tr => tr.addEventListener("click", () => openCulture(tr.dataset.cult)));
}
