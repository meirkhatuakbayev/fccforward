const $ = s => document.querySelector(s);
const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
const fmtT = n => Math.round(n).toLocaleString("ru-RU");
const fmtMlrd = n => (n / 1e9).toLocaleString("ru-RU", {maximumFractionDigits: 2}) + " млрд";

function blockLoader(text) {
    return `<div class="block-loader">
        <div class="bl-seal">ПКК</div>
        <div class="bl-text">${text || "Загрузка"}</div>
        <div class="bl-bar"><i></i></div>
    </div>`;
}

function fullReg(n) {
    n = String(n).trim();
    return SVOD_TO_FULL[n] || DETAIL_TO_FULL[n] || n;
}

function normCult(s) {
    s = String(s || "").toLowerCase();
    if (s.includes("пшен") || s.startsWith("пш"))
        return (s.includes("тверд") || s.includes("дурум") || s.includes("тв")) ? "Пшеница твёрдая" : "Пшеница";
    if (s.includes("ячмен")) return "Ячмень";
    if (s.includes("кукуруз")) return "Кукуруза";
    if (s.includes("подсолн")) return "Подсолнечник";
    if (s.includes("рапс")) return "Рапс";
    if (s.includes("лен") || s.includes("лён") || s.includes("льн")) return "Лён";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Уникальный ключ контрагента: БИН (если есть) или нормализованное имя.
// Кавычки «», "", '' считаются одинаковыми — убираются при сравнении.
function cpKey(c) {
    const bin = String(c.bin || "").trim().replace(/\s+/g, "");
    if (bin) return "bin:" + bin;
    const name = String(c.name || "").trim()
        .replace(/[«»"'`]/g, "")   // убираем любые кавычки
        .replace(/\s+/g, " ")       // нормализуем пробелы
        .toLowerCase();
    return "nm:" + name;
}

// Количество уникальных СХТП в массиве (по БИН / нормализованному имени)
function uniqSchtp(arr) { return new Set(arr.map(cpKey)).size; }

function isProfin(s) { return String(s).trim().toLowerCase().startsWith("профин"); }

function statCls(s) {
    s = String(s).trim().toLowerCase();
    if (s.startsWith("профин")) return "ok";
    if (s.includes("отказ") || s.includes("отозв") || s.includes("растор")) return "bad";
    return "warn";
}

function toNum(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[^0-9.,-]/g, "").replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function parseCSV(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) {
            if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
            else cur += ch;
        } else {
            if (ch === '"') q = true;
            else if (ch === ',') { row.push(cur); cur = ""; }
            else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ""; }
            else if (ch === '\r') {}
            else cur += ch;
        }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}
