// Данные раздела «Возврат зерна» (ФЗ 2025/2026)
// Глобальный объект DR — аналог D для форварда.

let DR = null;

// ─── Парсер СВОД ──────────────────────────────────────────────────────────────
function parseSvodReturn(rows) {
    let itogoIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][1] || "").includes("Итого по РК")) { itogoIdx = i; break; }
    }
    const upto = itogoIdx < 0 ? rows.length : itogoIdx;

    const regions = [];
    for (let i = 0; i < upto; i++) {
        const nm = fullReg(rows[i][1] || "");
        if (!REGION_GEO[nm] || regions.find(r => r.name === nm)) continue;
        const r = rows[i];
        regions.push({
            code: REGION_GEO[nm].code, name: nm,
            x: REGION_GEO[nm].x, y: REGION_GEO[nm].y,
            vol_contr:   toNum(r[4]  || 0),
            sum_fin:     toNum(r[5]  || 0),
            vol_ret:     toNum(r[9]  || 0),
            sum_ret:     toNum(r[10] || 0),
            sum_zachet:  toNum(r[11] || 0),
            sum_doplata: toNum(r[12] || 0),
            pct_exec:    toNum(r[13] || 0),
            sum_ksn:     toNum(r[17] || 0),
            debt:        toNum(r[20] || 0),
        });
    }
    Object.keys(REGION_GEO).forEach(nm => {
        if (!regions.find(r => r.name === nm))
            regions.push({
                code: REGION_GEO[nm].code, name: nm,
                x: REGION_GEO[nm].x, y: REGION_GEO[nm].y,
                vol_contr: 0, sum_fin: 0, vol_ret: 0, sum_ret: 0,
                sum_zachet: 0, sum_doplata: 0, pct_exec: 0, sum_ksn: 0, debt: 0
            });
    });

    let total = { vol_contr: 0, sum_fin: 0, vol_ret: 0, sum_ret: 0,
                  sum_zachet: 0, sum_doplata: 0, pct_exec: 0, sum_ksn: 0, debt: 0 };
    if (itogoIdx >= 0) {
        const r = rows[itogoIdx];
        total = {
            vol_contr:   toNum(r[4]  || 0),
            sum_fin:     toNum(r[5]  || 0),
            vol_ret:     toNum(r[9]  || 0),
            sum_ret:     toNum(r[10] || 0),
            sum_zachet:  toNum(r[11] || 0),
            sum_doplata: toNum(r[12] || 0),
            pct_exec:    toNum(r[13] || 0),
            sum_ksn:     toNum(r[17] || 0),
            debt:        toNum(r[20] || 0),
        };
    }
    return { regions, total };
}

// ─── Парсер ДЕТАЛЬНАЯ ─────────────────────────────────────────────────────────
function parseDetailReturn(rows) {
    const cps = [];
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[4] || "").trim();
        if (!name) continue;

        const cl5 = { vol: toNum(r[23]||0), sum: toNum(r[24]||0) };
        const cl4 = { vol: toNum(r[25]||0), sum: toNum(r[26]||0) };
        const cl3 = { vol: toNum(r[27]||0), sum: toNum(r[28]||0) };
        const bar = { vol: toNum(r[29]||0), sum: toNum(r[30]||0) };
        const vol_total = toNum(r[52]||0);
        const sum_total = toNum(r[53]||0);
        const vol_prog  = toNum(r[33]||0);

        cps.push({
            reg:         fullReg(r[2] || ""),
            form:        String(r[3] || "").trim(),
            name,
            rayon:       String(r[5] || "").trim(),
            bin:         String(r[6] || "").trim(),
            dog_num:     String(r[9] || "").trim(),
            dog_date:    String(r[10]|| "").trim(),
            cult:        String(r[14]|| "").trim(),
            vol_fin:     toNum(r[17]||0),
            price_fin:   toNum(r[18]||0),
            sum_fin:     toNum(r[19]||0),
            cl5, cl4, cl3, bar,
            sum_zachet:  toNum(r[32]||0),   // зачтено в предоплату ₸
            vol_prog,
            sum_dop_plan:toNum(r[34]||0),
            sum_dop_fact:toNum(r[40]||0),
            sum_ksn:     toNum(r[44]||0),
            date_dop:    String(r[46]|| "").trim(),
            vol_total,
            sum_total,
            debt:        toNum(r[56]||0),
            penalty:     toNum(r[57]||0),
            paid_money:  toNum(r[58]||0),
            paid_grain:  toNum(r[59]||0),
            debt_left:   toNum(r[61]||0),
            vol_left:    Math.max(0, vol_prog - vol_total),
            price_avg:   vol_total > 0 ? Math.round(sum_total / vol_total) : 0,
            payments:    r.payments || [],
        });
    }
    return cps;
}

// ─── Сборка DR ────────────────────────────────────────────────────────────────
function combineReturn(svodRows, detailRows) {
    const svod   = parseSvodReturn(svodRows);
    const cps    = parseDetailReturn(detailRows);
    const debtors = cps.filter(c => c.debt > 0).sort((a, b) => b.debt - a.debt);
    const totalPenalty = cps.reduce((s, c) => s + (c.penalty || 0), 0);

    // Пересчёт из детализации если СВОД даёт нули (старый GAS или незадеплоенная версия)
    const t = svod.total;

    // 1й уровень: суммируем напрямую из cps.sum_zachet
    if (t.sum_zachet === 0 && cps.length > 0) {
        t.sum_zachet = cps.reduce((s, c) => s + (c.sum_zachet || 0), 0);
    }
    // 2й уровень fallback: если cps.sum_zachet тоже нулевые — считаем из суммы зерна
    // (cl5+cl4+cl3+bar) + деньги, ограничиваем финансированием
    if (t.sum_zachet === 0 && cps.length > 0) {
        t.sum_zachet = cps.reduce((s, c) => {
            const grainSum = (c.cl5 ? c.cl5.sum : 0) + (c.cl4 ? c.cl4.sum : 0)
                           + (c.cl3 ? c.cl3.sum : 0) + (c.bar ? c.bar.sum : 0)
                           + (c.paid_money || 0);
            return s + (c.sum_fin > 0 ? Math.min(grainSum, c.sum_fin) : grainSum);
        }, 0);
    }

    if (t.vol_ret === 0 && cps.length > 0) {
        t.vol_ret = cps.reduce((s, c) => s + (c.vol_ret || 0), 0);
    }
    if (t.sum_ret === 0 && cps.length > 0) {
        t.sum_ret = cps.reduce((s, c) => s + (c.sum_ret || 0), 0);
    }
    if (t.debt === 0 && t.sum_fin > 0) {
        t.debt = Math.max(0, t.sum_fin - t.sum_zachet);
    }

    // Уникальные СХТП: считаем по БИН (как в финансировании)
    const _finBins = new Set(cps.filter(c => c.sum_fin > 0).map(c => c.bin || c.name));
    t.schtp = _finBins.size;

    DR = {
        regions: svod.regions,
        total:   t,
        cps, debtors, totalPenalty,
        date: new Date().toLocaleString("ru-RU", {
            day:"2-digit", month:"2-digit", year:"numeric",
            hour:"2-digit", minute:"2-digit"
        })
    };
}

// ─── Загрузка данных ──────────────────────────────────────────────────────────
// Строит DR из объекта D (финансирование) — работает без Apps Script
function buildReturnFromD() {
    if (!D || !D.cps || !D.total) return false;
    const financed = D.cps.filter(c => c.status === 'профин.' && c.sum > 0);
    if (!financed.length) return false;

    // Итоги берём из СВОД — там правильные цифры профин. (сумма и объём)
    // D.total.fin = [schtp, apps, sum_fin, vol_fin]
    const totalFinSum = D.total.fin[2] || 0;
    const totalFinVol = D.total.fin[3] || 0;

    // Строим detail-строки (для карточек контрагентов)
    // Для отдельной строки sum_fin пропорционально из СВОД по области
    const regFinMap = {};
    (D.regions || []).forEach(r => {
        // r.fin = [schtp, apps, sum, vol]
        regFinMap[r.name] = { sum_fin: r.fin[2] || 0, vol_fin: r.fin[3] || 0 };
    });

    const detail = financed.map(c => {
        const row = new Array(65).fill(0);
        row[2]  = c.reg;
        row[3]  = c.form;
        row[4]  = c.name;
        row[5]  = c.rayon;
        row[6]  = c.bin;
        row[9]  = (c.dates && c.dates.dogNum)  || "";
        row[10] = (c.dates && c.dates.dogDate) || "";
        row[14] = (c.cults || []).join(", ");
        row[17] = c.vol  || 0;
        row[19] = c.sum  || 0; // заявленная сумма (ближайший прокси до Apps Script)
        row[56] = c.sum  || 0;
        row[61] = c.sum  || 0;
        row.payments = [];
        return row;
    });

    // СВОД строим из D.regions — там правильные цифры профин. по областям
    const svod = (D.regions || [])
        .filter(r => r.fin && r.fin[2] > 0)
        .map(r => {
            const sr = new Array(25).fill(0);
            sr[1]  = r.name;
            sr[4]  = r.fin[3] || 0; // vol_contr
            sr[5]  = r.fin[2] || 0; // sum_fin
            sr[20] = r.fin[2] || 0; // долг = вся сумма (ещё ничего не вернули)
            return sr;
        });

    // Итоговая строка — из D.total.fin (правильно: 31.17 млрд)
    const tr = new Array(25).fill(0);
    tr[1]  = "Итого по РК:";
    tr[4]  = totalFinVol;
    tr[5]  = totalFinSum;
    tr[20] = totalFinSum;
    svod.push(tr);

    combineReturn(svod, detail);
    return true;
}

async function loadReturn(yearOverride) {
    const year = yearOverride || (document.getElementById("yearSel") || {}).value || "2026";
    try {
        if (year !== "2026") {
            if (typeof hideYearLoader === "function") hideYearLoader();
            return;
        }

        // 2026: сначала пробуем Apps Script
        if (CONFIG.API_URL_RETURN) {
            try {
                const resp = await fetch(
                    CONFIG.API_URL_RETURN + "?action=getReturn&year=2026&_=" + Date.now(),
                    { cache: "no-store" });
                if (resp.ok) {
                    const json = await resp.json();
                    if (json.ok && json.svod && json.detail) {
                        combineReturn(json.svod, json.detail);
                        renderReturn();
                        return;
                    }
                }
            } catch(_) {}
        }

        // Фолбэк: строим из уже загруженных данных финансирования
        if (!D) await new Promise(res => setTimeout(res, 800)); // ждём если D ещё грузится
        if (buildReturnFromD()) { renderReturn(); return; }

        throw new Error("Нет данных о финансировании для построения раздела возврата");
    } catch (e) {
        console.error("loadReturn:", e);
        const box = document.getElementById("vzErrBox");
        if (box) box.textContent = "Не удалось загрузить данные: " + e.message;
        if (typeof hideYearLoader === "function") hideYearLoader();
        if (typeof hideVzLoader   === "function") hideVzLoader();
    }
}
