// Данные раздела «Возврат зерна» (ФЗ 2025/2026)
// Глобальный объект DR — аналог D для форварда.

let DR = null;
let _returnLoaded = false;

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

    DR = {
        regions: svod.regions,
        total:   svod.total,
        cps, debtors, totalPenalty,
        date: new Date().toLocaleString("ru-RU", {
            day:"2-digit", month:"2-digit", year:"numeric",
            hour:"2-digit", minute:"2-digit"
        })
    };
}

// ─── Загрузка данных ──────────────────────────────────────────────────────────
async function loadReturn() {
    try {
        // Мок: если URL пуст — используем MOCK_RETURN
        if (!CONFIG.API_URL_RETURN) {
            if (typeof MOCK_RETURN !== "undefined") {
                combineReturn(MOCK_RETURN.svod, MOCK_RETURN.detail);
                renderReturn();
            } else {
                throw new Error("MOCK_RETURN не определён");
            }
            return;
        }

        const url = CONFIG.API_URL_RETURN;
        const resp = await fetch(url + (url.includes("?") ? "&" : "?") + "action=getReturn&_=" + Date.now(),
            { cache: "no-store" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const json = await resp.json();

        if (json && json.svod && json.detail) {
            combineReturn(json.svod, json.detail);
            renderReturn();
            return;
        }
        // Фолбэк на CSV
        if (CONFIG.RETURN_SVOD_CSV && CONFIG.RETURN_DETAIL_CSV) {
            const [sv, dt] = await Promise.all([
                fetchCSV(CONFIG.RETURN_SVOD_CSV),
                fetchCSV(CONFIG.RETURN_DETAIL_CSV)
            ]);
            combineReturn(sv, dt);
            renderReturn();
            return;
        }
        throw new Error("Неверный формат API и нет CSV фолбэка");
    } catch (e) {
        console.error("loadReturn:", e);
        const box = document.getElementById("vzErrBox");
        if (box) box.textContent = "Не удалось загрузить данные: " + e.message;
    }
}
