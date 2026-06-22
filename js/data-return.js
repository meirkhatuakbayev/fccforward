// Данные раздела «Возврат зерна» (ФЗ)
// Глобальный объект DR — аналог D для форварда. Не пересекается с форвардными функциями.

let DR = null;
let _returnLoaded = false;

// ─── Парсер СВОД (по областям) ────────────────────────────────────────────────
function parseSvodReturn(rows) {
    // Ищем строку «Итого по РК»
    let itogoIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][1] || "").includes("Итого по РК")) { itogoIdx = i; break; }
    }
    const upto = itogoIdx < 0 ? rows.length : itogoIdx;

    const regions = [];
    for (let i = 0; i < upto; i++) {
        const nm = fullReg(rows[i][1] || "");
        if (!REGION_GEO[nm]) continue;
        if (regions.find(r => r.name === nm)) continue;
        const r = rows[i];
        regions.push({
            code: REGION_GEO[nm].code,
            name: nm,
            x: REGION_GEO[nm].x,
            y: REGION_GEO[nm].y,
            vol_contr:  toNum(r[4]  || 0),   // законтрактовано т
            sum_fin:    toNum(r[5]  || 0),   // сумма предоплаты ₸
            vol_ret:    toNum(r[9]  || 0),   // возвращено зерном т
            sum_ret:    toNum(r[10] || 0),   // возвращено зерном ₸
            sum_zachet: toNum(r[11] || 0),   // зачтено в предоплату ₸
            sum_doplata:toNum(r[12] || 0),   // доплата ₸
            pct_exec:   toNum(r[13] || 0),   // % исполнения (0..1)
            sum_ksn:    toNum(r[17] || 0),   // доплата КСН факт ₸
            debt:       toNum(r[20] || 0),   // остаток долга ₸
        });
    }

    // Заполняем отсутствующие регионы нулями
    Object.keys(REGION_GEO).forEach(nm => {
        if (!regions.find(r => r.name === nm))
            regions.push({
                code: REGION_GEO[nm].code, name: nm,
                x: REGION_GEO[nm].x, y: REGION_GEO[nm].y,
                vol_contr: 0, sum_fin: 0, vol_ret: 0, sum_ret: 0,
                sum_zachet: 0, sum_doplata: 0, pct_exec: 0, sum_ksn: 0, debt: 0
            });
    });

    // Итого по РК
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

// ─── Парсер РАЗВЁРНУТАЯ_ИНФОРМАЦИЯ (по договорам) ─────────────────────────────
function parseDetailReturn(rows) {
    const cps = [];
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[4] || "").trim();
        if (!name) continue;

        // Поставки по классам: [vol, sum] для 5кл / 4кл / 3кл / ячмень 2кл
        const cl5  = { vol: toNum(r[23] || 0), sum: toNum(r[24] || 0) };
        const cl4  = { vol: toNum(r[25] || 0), sum: toNum(r[26] || 0) };
        const cl3  = { vol: toNum(r[27] || 0), sum: toNum(r[28] || 0) };
        const bar  = { vol: toNum(r[29] || 0), sum: toNum(r[30] || 0) };

        const vol_total = toNum(r[52] || 0);
        const sum_total = toNum(r[53] || 0);
        const vol_prog  = toNum(r[33] || 0);

        cps.push({
            reg:        fullReg(r[2] || ""),
            form:       String(r[3] || "").trim(),
            name,
            rayon:      String(r[5] || "").trim(),
            bin:        String(r[6] || "").trim(),
            dog_num:    String(r[9] || "").trim(),
            dog_date:   String(r[10] || "").trim(),
            cult:       String(r[14] || "").trim(),
            vol_fin:    toNum(r[17] || 0),    // объём профинанс. т
            price_fin:  toNum(r[18] || 0),    // цена предоплаты ₸/т
            sum_fin:    toNum(r[19] || 0),    // сумма предоплаты ₸
            // поставки по классам
            cl5, cl4, cl3, bar,
            vol_zachet: toNum(r[32] || 0),    // зачтено в предоплату т
            vol_prog,                          // прогнозный объём т
            sum_doplata_plan: toNum(r[34] || 0), // сумма на доплату ₸
            sum_doplata_fact: toNum(r[40] || 0), // доплата факт ₸
            sum_ksn:    toNum(r[44] || 0),    // доплата КСН факт ₸
            date_doplata: String(r[46] || "").trim(),
            vol_total,                         // всего поставлено т (col52)
            sum_total,                         // всего поставлено ₸ (col53)
            debt:       toNum(r[56] || 0),    // остаток долга ₸
            penalty:    toNum(r[57] || 0),    // пеня ₸
            paid_money: toNum(r[58] || 0),    // погашено деньгами ₸
            paid_grain: toNum(r[59] || 0),    // погашено зерном ₸
            debt_left:  toNum(r[61] || 0),    // остаток погашения ₸
            // средняя цена поставки
            price_avg:  vol_total > 0 ? Math.round(sum_total / vol_total) : 0,
            // остаток объёма
            vol_left:   Math.max(0, vol_prog - vol_total),
        });
    }
    return cps;
}

// ─── Сборка итогового объекта DR ──────────────────────────────────────────────
function combineReturn(svodRows, detailRows) {
    const svod   = parseSvodReturn(svodRows);
    const cps    = parseDetailReturn(detailRows);
    const debtors = cps.filter(c => c.debt > 0).sort((a, b) => b.debt - a.debt);
    // Суммарная пеня из данных
    const totalPenalty = cps.reduce((s, c) => s + (c.penalty || 0), 0);

    DR = {
        regions:      svod.regions,
        total:        svod.total,
        cps,
        debtors,
        totalPenalty,
        date: new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    };
}

// ─── Загрузка данных ──────────────────────────────────────────────────────────
async function loadReturn() {
    try {
        const url = CONFIG.API_URL_RETURN;
        if (!url) throw new Error("API_URL_RETURN не задан");

        // Пробуем Apps Script (JSON с {svod, detail})
        const resp = await fetch(url + (url.includes("?") ? "&" : "?") + "action=getReturn&_=" + Date.now(), { cache: "no-store" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const json = await resp.json();
        if (json && json.svod && json.detail) {
            combineReturn(json.svod, json.detail);
            renderReturn();
            return;
        }
        throw new Error("Неверный формат ответа API");
    } catch (e) {
        console.warn("loadReturn: фолбэк на CSV", e);
        // Фолбэк: gviz CSV листов (если прописаны в CONFIG)
        try {
            if (!CONFIG.RETURN_SVOD_CSV || !CONFIG.RETURN_DETAIL_CSV) throw new Error("CSV URL не заданы");
            const [svodRows, detailRows] = await Promise.all([
                fetchCSV(CONFIG.RETURN_SVOD_CSV),
                fetchCSV(CONFIG.RETURN_DETAIL_CSV)
            ]);
            combineReturn(svodRows, detailRows);
            renderReturn();
        } catch (e2) {
            console.error("loadReturn: полный сбой", e2);
            const box = document.getElementById("vzErrBox");
            if (box) box.textContent = "Не удалось загрузить данные: " + e2.message;
        }
    }
}
