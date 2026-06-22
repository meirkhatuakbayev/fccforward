const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbzQBBoAcrJeWlBXCZeQronaxHkpJ_6Xr_y935FkqIUR2Bq6buQPHilAfjnF_kxEEW8/exec",
    SHEET_ID: "1C86Fh9p3EW4LwYWi4u2hUnRC1TxfjzN75WQ0iDNZX0Q",
    SVOD_SHEET: "СВОД",
    DETAIL_SHEET: "РАЗВЕРНУТАЯ_ИНФОРМАЦИЯ",
    SVOD_CSV: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4HRkzvFG_Oxyv9KuAxT_BFyr7o8f6Yz139OzElMShmFL0m9BL-fC1pr0OcBcJbclzhsv66B3I91Wj/pub?gid=519350981&single=true&output=csv",
    DETAIL_CSV: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4HRkzvFG_Oxyv9KuAxT_BFyr7o8f6Yz139OzElMShmFL0m9BL-fC1pr0OcBcJbclzhsv66B3I91Wj/pub?gid=103443627&single=true&output=csv",
    GEO_URL: "geo/kaz-adm1-simple.geojson",
    GEO_URL_FALLBACK: "https://raw.githubusercontent.com/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/KAZ/ADM1/geoBoundaries-KAZ-ADM1_simplified.geojson",
    AUTO_REFRESH_MIN: 5,
    CRM_BASE: "https://crm.fcc.kz"
};

const gvizURL = sheet => `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheet)}`;

const REGION_GEO = {
    "Акмолинская":          {code: "AKM", x: 500, y: 185},
    "Абайская":             {code: "ABA", x: 742, y: 258},
    "Алматинская":          {code: "ALM", x: 650, y: 408},
    "Актюбинская":          {code: "AKT", x: 220, y: 250},
    "Восточно-Казахстанская":{code: "VKO", x: 808, y: 210},
    "Западно-Казахстанская": {code: "ZKO", x: 120, y: 172},
    "Карагандинская":       {code: "KAR", x: 520, y: 288},
    "Костанайская":         {code: "KOS", x: 350, y: 135},
    "Павлодарская":         {code: "PAV", x: 662, y: 120},
    "Северо-Казахстанская": {code: "SKO", x: 500, y: 88}
};

const SVOD_TO_FULL = {
    "ВКО": "Восточно-Казахстанская",
    "ЗКО": "Западно-Казахстанская",
    "СКО": "Северо-Казахстанская"
};

const DETAIL_TO_FULL = {
    "Акмола":  "Акмолинская",
    "Алматы":  "Алматинская",
    "ВКО":     "Восточно-Казахстанская",
    "Костанай":"Костанайская",
    "Павлодар":"Павлодарская",
    "СКО":     "Северо-Казахстанская"
};

const CROP_ORDER = ["Пшеница", "Пшеница твердая", "Ячмень", "Кукуруза", "Подсолнечник", "Семена льна", "Рапс"];
const OIL = ["Подсолнечник", "Лён", "Рапс"];
