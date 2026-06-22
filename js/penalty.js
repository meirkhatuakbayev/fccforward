// Расчёт пени по возврату зерна (ФЗ).
// На сайте пеня берётся ИЗ ДАННЫХ (detail col 57).
// Эта функция — для живого пересчёта на сегодня по договорам с остатком > 0.
//
// Правило: 0,1% в день на ОСТАТОК долга.
// Срок поставки 02.11.2026 → пеня с 03.11.2026.
// При погашении остаток уменьшается, со следующего дня пеня от нового остатка.
//
// debt0     — остаток долга в ₸ на начало просрочки
// startDate — первый день начисления (по умолч. "2026-11-03")
// payments  — [{date:"2026-11-10", amount:5000000}, ...]
// today     — дата расчёта (по умолч. сегодня)
// → { penalty, debtLeft }

function calcPenalty(debt0, startDate, payments, today) {
    const DAY = 86400000, RATE = 0.001;
    let debt = Math.max(0, Number(debt0) || 0);
    if (debt <= 0) return { penalty: 0, debtLeft: 0 };

    const start = new Date(startDate || "2026-11-03");
    start.setHours(0, 0, 0, 0);
    const end = today ? new Date(today) : new Date();
    end.setHours(0, 0, 0, 0);
    if (end < start) return { penalty: 0, debtLeft: Math.round(debt) };

    const pay = {};
    (payments || []).forEach(p => {
        const k = new Date(p.date); k.setHours(0, 0, 0, 0);
        pay[k.getTime()] = (pay[k.getTime()] || 0) + (Number(p.amount) || 0);
    });

    let penalty = 0;
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY)) {
        const key = d.getTime();
        if (pay[key]) debt = Math.max(0, debt - pay[key]);
        if (debt <= 0) break;
        penalty += debt * RATE;
    }
    return { penalty: Math.round(penalty), debtLeft: Math.round(debt) };
}

if (typeof module !== "undefined") module.exports = { calcPenalty };
