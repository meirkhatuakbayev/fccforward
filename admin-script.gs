// ═══════════════════════════════════════════════════════════════════════════
// ПКК Форвард 2026 — Бэкенд Админ-панели
// ═══════════════════════════════════════════════════════════════════════════
// ИНСТРУКЦИЯ:
//   1. Откройте script.google.com → Новый проект
//   2. Вставьте весь этот код (замените function myFunction(){})
//   3. Укажите правильный SS_ID (ID вашей таблицы)
//   4. Нажмите «Выполнить» → setupAdminUsers() один раз
//   5. Деплой → «Как веб-приложение»:
//        Исполняет: Я (your email)
//        Кто имеет доступ: Все
//   6. Скопируйте URL деплоя в admin.html (константа ADMIN_API)
// ═══════════════════════════════════════════════════════════════════════════

const SS_ID        = '1C86Fh9p3EW4LwYWi4u2hUnRC1TxfjzN75WQ0iDNZX0Q';
const SH_DETAIL    = 'РАЗВЕРНУТАЯ_ИНФОРМАЦИЯ';
const SH_RETURN    = 'ВОЗВРАТ';
const SH_ADMINS    = 'ADMINS';
const SH_SESSIONS  = 'СЕССИИ';
const SH_LOG       = 'ЖУРНАЛ';
const SESSION_H    = 8; // часов

// ── Точка входа ──────────────────────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  const year   = (e && e.parameter && e.parameter.year)   || '2026';
  if (action === 'getReturn')    return ok(getReturnForYear(year));
  if (action === 'getFinancing') return ok(getFinancingForYear(year));
  return ok({ status: 'ПКК Admin API работает' });
}

function getFinancingForYear(year) {
  try {
    const ss       = SpreadsheetApp.openById(SS_ID);
    const svodName = year === '2026' ? 'СВОД'              : 'СВОД_'           + year;
    const detName  = year === '2026' ? SH_DETAIL           : 'РАЗВЕРНУТАЯ_'    + year;
    const svodSh   = ss.getSheetByName(svodName);
    const detSh    = ss.getSheetByName(detName);
    if (!svodSh) return { ok: false, error: 'Лист "' + svodName + '" не найден' };
    if (!detSh)  return { ok: false, error: 'Лист "' + detName  + '" не найден' };
    return { ok: true, svod: svodSh.getDataRange().getValues(), detail: detSh.getDataRange().getValues() };
  } catch(err) { return { ok: false, error: err.message }; }
}

function getReturnForYear(year) {
  if (year === '2026') return getReturnForDashboard();
  try {
    const ss      = SpreadsheetApp.openById(SS_ID);
    const svodSh  = ss.getSheetByName('ВОЗВРАТ_' + year);
    const detSh   = ss.getSheetByName('ВОЗВРАТ_РАЗВЕРНУТАЯ_' + year);
    if (!svodSh) return { ok: false, error: 'Лист "ВОЗВРАТ_' + year + '" не найден' };
    if (!detSh)  return { ok: false, error: 'Лист "ВОЗВРАТ_РАЗВЕРНУТАЯ_' + year + '" не найден' };
    return { ok: true, svod: svodSh.getDataRange().getValues(), detail: detSh.getDataRange().getValues() };
  } catch(err) { return { ok: false, error: err.message }; }
}

// ── Публичная отдача данных возврата для дашборда (без авторизации) ──────────

function getReturnForDashboard() {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);

    // 1. Читаем профинансированных контрагентов
    const detSheet = ss.getSheetByName(SH_DETAIL);
    if (!detSheet) return { ok: false, error: 'Лист финансирования не найден' };
    const detData = detSheet.getDataRange().getValues();

    const financed = {}; // key = bin || name
    for (let i = DATA_ROW; i < detData.length; i++) {
      const row  = detData[i];
      const name = String(row[C.name] || '').trim();
      const bin  = String(row[C.bin]  || '').trim();
      if (!name || name.includes('Итого') || name === 'Наименование поставщика') continue;
      const finSum = Number(row[C.fin_sum]) || 0;
      if (finSum <= 0) continue;
      const key = bin || name;
      if (financed[key]) continue;
      financed[key] = {
        reg:       String(row[C.reg]    || '').trim(),
        form:      String(row[C.form]   || '').trim(),
        name, bin,
        rayon:     String(row[C.rayon]  || '').trim(),
        dog_num:   String(row[C.dog_num] || '').trim(),
        dog_date:  String(row[C.dog_date] || '').trim(),
        cult:      String(row[C.cult]   || '').trim(),
        vol_fin:   Number(row[C.fin_vol])  || 0,
        price_fin: Number(row[C.fin_price] || row[C.app_price] || 0),
        sum_fin:   finSum,
      };
    }

    // 2. Читаем лист ВОЗВРАТ
    const retSheet = ss.getSheetByName(SH_RETURN);
    const retMap   = {};
    if (retSheet && retSheet.getLastRow() > 1) {
      const retData = retSheet.getDataRange().getValues();
      for (let i = 1; i < retData.length; i++) {
        const row  = retData[i];
        const name = String(row[2] || '').trim();
        const bin  = String(row[4] || '').trim();
        if (!name) continue;
        retMap[bin || name] = row;
      }
    }

    // 3. Строим detail-строки (формат для parseDetailReturn)
    const detail = [];
    const regAgg  = {};

    Object.values(financed).forEach(function(f) {
      const ret = retMap[f.bin || f.name] || null;
      const n   = function(idx) { return ret ? (Number(ret[idx]) || 0) : 0; };

      const row = new Array(65).fill(0);
      row[2]  = f.reg;
      row[3]  = f.form;
      row[4]  = f.name;
      row[5]  = f.rayon;
      row[6]  = f.bin;
      row[9]  = ret ? String(ret[5] || f.dog_num)  : f.dog_num;
      row[10] = ret ? String(ret[6] || f.dog_date) : f.dog_date;
      row[14] = ret ? String(ret[7] || f.cult)     : f.cult;
      row[17] = ret ? n(8)  || f.vol_fin   : f.vol_fin;
      row[18] = ret ? n(9)  || f.price_fin : f.price_fin;
      row[19] = ret ? n(10) || f.sum_fin   : f.sum_fin;

      // Классы зерна: Пш5кл=col23/24, Пш4кл=col25/26, Пш3кл=col27/28, Ячмень=col29/30
      row[27] = n(11); row[28] = n(12); // Пш 3 класс
      row[25] = n(13); row[26] = n(14); // Пш 4 класс
      row[23] = n(15); row[24] = n(16); // Пш 5 класс
      row[29] = n(17); row[30] = n(18); // Ячмень

      row[52] = n(19); // vol_total
      row[53] = n(20); // sum_total
      row[32] = n(21); // sum_zachet
      row[56] = ret ? n(22) : Math.max(0, f.sum_fin); // debt
      row[57] = n(23); // penalty
      row[58] = n(24); // paid_money
      row[59] = n(25); // paid_grain
      row[34] = n(26); // dop_plan
      row[40] = n(27); // dop_fact
      row[44] = n(28); // ksn
      row[61] = n(22); // debt_left = debt

      try { row.payments = ret ? JSON.parse(ret[29] || '[]') : []; }
      catch(_) { row.payments = []; }

      detail.push(row);

      // Агрегация по области
      const reg = f.reg || 'Прочие';
      if (!regAgg[reg]) regAgg[reg] = { name: reg, vol_contr:0, sum_fin:0, vol_ret:0,
        sum_ret:0, sum_zachet:0, sum_doplata:0, sum_ksn:0, debt:0 };
      const g = regAgg[reg];
      g.vol_contr   += Number(row[17]) || 0;
      g.sum_fin     += Number(row[19]) || 0;
      g.vol_ret     += Number(row[52]) || 0;
      g.sum_ret     += Number(row[53]) || 0;
      g.sum_zachet  += Number(row[32]) || 0;
      g.sum_doplata += (Number(row[34]) || 0) + (Number(row[44]) || 0);
      g.sum_ksn     += Number(row[44]) || 0;
      g.debt        += Number(row[56]) || 0;
    });

    // 4. Строим svod-строки (формат для parseSvodReturn)
    const svod = [];
    var totals = { vol_contr:0, sum_fin:0, vol_ret:0, sum_ret:0,
                   sum_zachet:0, sum_doplata:0, sum_ksn:0, debt:0 };

    Object.values(regAgg).forEach(function(r) {
      const pct = r.sum_fin > 0 ? r.sum_zachet / r.sum_fin : 0;
      const sr  = new Array(25).fill(0);
      sr[1] = r.name; sr[4] = r.vol_contr; sr[5] = r.sum_fin;
      sr[9] = r.vol_ret; sr[10] = r.sum_ret; sr[11] = r.sum_zachet;
      sr[12] = r.sum_doplata; sr[13] = pct; sr[17] = r.sum_ksn; sr[20] = r.debt;
      svod.push(sr);
      Object.keys(totals).forEach(function(k) { totals[k] += r[k] || 0; });
    });

    // Итого по РК
    const tr = new Array(25).fill(0);
    tr[1]  = 'Итого по РК:'; tr[4] = totals.vol_contr; tr[5] = totals.sum_fin;
    tr[9]  = totals.vol_ret; tr[10] = totals.sum_ret;   tr[11] = totals.sum_zachet;
    tr[12] = totals.sum_doplata;
    tr[13] = totals.sum_fin > 0 ? totals.sum_zachet / totals.sum_fin : 0;
    tr[17] = totals.sum_ksn; tr[20] = totals.debt;
    svod.push(tr);

    return { ok: true, svod: svod, detail: detail };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'login')  return ok(login(body));
    if (action === 'logout') return ok(logout(body));

    const user = checkToken(body.token);
    if (!user) return ok({ ok: false, error: 'Сессия истекла. Войдите снова.' });

    switch (action) {
      case 'listContractors':  return ok(listContractors());
      case 'getContractor':    return ok(getContractor(body));
      case 'saveFinancing':    return ok(saveFinancing(body, user));
      case 'addContractor':    return ok(addContractor(body, user));
      case 'listReturn':       return ok(listReturn());
      case 'saveReturn':       return ok(saveReturn(body, user));
      case 'listUsers':        checkAdmin(user); return ok(listUsers());
      case 'saveUser':         checkAdmin(user); return ok(saveUser(body));
      case 'changePassword':   return ok(changePassword(body, user));
      default: return ok({ ok: false, error: 'Неизвестное действие: ' + action });
    }
  } catch (err) {
    return ok({ ok: false, error: err.message || String(err) });
  }
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Авторизация ───────────────────────────────────────────────────────────────

function sha256(str) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function login(body) {
  const { login: lgn, password } = body;
  if (!lgn || !password) return { ok: false, error: 'Введите логин и пароль' };

  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SH_ADMINS);
  if (!sheet) return { ok: false, error: 'Таблица пользователей не найдена. Запустите setupAdminUsers()' };

  const rows = sheet.getDataRange().getValues();
  // col: 0=login 1=salt 2=hash 3=role 4=name 5=active
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lgn && rows[i][5] === true) {
      const hash = sha256(rows[i][1] + password);
      if (hash === rows[i][2]) {
        const token  = Utilities.getUuid();
        const expiry = new Date(Date.now() + SESSION_H * 3600000);
        ensureSheet(ss, SH_SESSIONS, ['token','login','expiry','role','name'])
          .appendRow([token, lgn, expiry, rows[i][3], rows[i][4]]);
        return { ok: true, token, role: rows[i][3], name: rows[i][4] };
      }
    }
  }
  return { ok: false, error: 'Неверный логин или пароль' };
}

function logout(body) {
  if (!body.token) return { ok: true };
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SH_SESSIONS);
  if (!sheet) return { ok: true };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.token) { sheet.deleteRow(i + 1); break; }
  }
  return { ok: true };
}

function checkToken(token) {
  if (!token) return null;
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SH_SESSIONS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const now  = new Date();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      if (new Date(data[i][2]) > now) {
        sheet.getRange(i + 1, 3).setValue(new Date(Date.now() + SESSION_H * 3600000));
        return { login: data[i][1], role: data[i][3], name: data[i][4] };
      }
      sheet.deleteRow(i + 1);
      return null;
    }
  }
  return null;
}

function checkAdmin(user) {
  if (user.role !== 'admin') throw new Error('Недостаточно прав');
}

// ── Индексы колонок в РАЗВЕРНУТАЯ_ИНФОРМАЦИЯ (0-based) ───────────────────────

const C = {
  reg: 2, form: 3, name: 4, rayon: 10, bin: 11,
  nds: 12, date_reg: 13, cult: 14, status: 24,
  // Заявка
  app_sum: 17, app_price: 18, app_vol: 19, app_hpp: 20, app_gar: 21,
  // Договор
  dog_num: 49, dog_date: 50, dog_sum: 53, dog_vol: 55,
  // Профинансировано
  fin_cult: 62, fin_date: 63, fin_sum: 66, fin_price: 67, fin_vol: 68,
};
const DATA_ROW = 4; // данные начинаются с 5-й строки (индекс 4)

function listContractors() {
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист "' + SH_DETAIL + '" не найден' };

  const data  = sheet.getDataRange().getValues();
  const seen  = {};
  const list  = [];

  for (let i = DATA_ROW; i < data.length; i++) {
    const row  = data[i];
    const name = String(row[C.name] || '').trim();
    const bin  = String(row[C.bin]  || '').trim();
    if (!name || name.includes('Итого') || name === 'Наименование поставщика') continue;
    const key = bin || name;
    if (seen[key]) continue;
    seen[key] = true;
    list.push({
      rowIdx:   i + 1,
      bin, name,
      reg:      String(row[C.reg]    || '').trim(),
      form:     String(row[C.form]   || '').trim(),
      rayon:    String(row[C.rayon]  || '').trim(),
      cult:     String(row[C.cult]   || '').trim(),
      status:   String(row[C.status] || '').trim(),
      fin_sum:  Number(row[C.fin_sum])  || 0,
      fin_vol:  Number(row[C.fin_vol])  || 0,
      fin_date: String(row[C.fin_date] || '').trim(),
      dog_num:  String(row[C.dog_num]  || '').trim(),
    });
  }

  return { ok: true, data: list };
}

function getContractor(body) {
  const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = DATA_ROW; i < data.length; i++) {
    const row  = data[i];
    const rBin  = String(row[C.bin]  || '').trim();
    const rName = String(row[C.name] || '').trim();
    if (!rName || rName.includes('Итого')) continue;
    if ((body.bin && rBin === body.bin) || (!body.bin && rName === body.name)) {
      const obj = { rowIdx: i + 1 };
      Object.entries(C).forEach(([k, ci]) => { obj[k] = row[ci]; });
      rows.push(obj);
    }
  }

  return { ok: true, data: rows };
}

function saveFinancing(body, user) {
  const { rowIdx, fields } = body;
  if (!rowIdx || !fields) return { ok: false, error: 'Нет данных для сохранения' };

  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  Object.entries(fields).forEach(([colIdx, val]) => {
    sheet.getRange(rowIdx, parseInt(colIdx) + 1).setValue(val);
  });

  addLog(ss, user.name, 'Финансирование', rowIdx, fields);
  return { ok: true };
}

function addContractor(body, user) {
  const { fields } = body;
  if (!fields) return { ok: false, error: 'Нет данных' };

  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  // Найти первую пустую строку после данных
  const lastRow = sheet.getLastRow();
  const newRow  = new Array(70).fill('');
  Object.entries(fields).forEach(([colIdx, val]) => { newRow[parseInt(colIdx)] = val; });
  sheet.appendRow(newRow);

  addLog(ss, user.name, 'Новый контрагент', lastRow + 1, fields);
  return { ok: true, rowIdx: lastRow + 1 };
}

// ── Возврат зерна ─────────────────────────────────────────────────────────────

const RET_HEADERS = [
  'Область','Форма','Наименование поставщика','Район','БИН/ИИН',
  '№ договора','Дата договора','Культура',
  'Объём по договору, т','Цена предоплаты, ₸/т','Сумма финансирования, ₸',
  'Пш 3кл объём, т','Пш 3кл сумма, ₸',
  'Пш 4кл объём, т','Пш 4кл сумма, ₸',
  'Пш 5кл объём, т','Пш 5кл сумма, ₸',
  'Ячмень 2кл объём, т','Ячмень 2кл сумма, ₸',
  'Всего поставлено, т','Всего сумма за зерно, ₸',
  'Зачтено в предоплату, ₸','Остаток долга, ₸',
  'Пеня, ₸','Погашено деньгами, ₸','Погашено зерном, ₸',
  'Доплата план, ₸','Доплата факт, ₸','КСН, ₸',
  'История платежей (JSON)','Обновлено','Кем обновлено'
];

function ensureReturnSheet(ss) {
  let sh = ss.getSheetByName(SH_RETURN);
  if (!sh) {
    sh = ss.insertSheet(SH_RETURN);
    sh.appendRow(RET_HEADERS);
    sh.getRange(1, 1, 1, RET_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#3C6B4A')
      .setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function listReturn() {
  const ss   = SpreadsheetApp.openById(SS_ID);
  const sh   = ensureReturnSheet(ss);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, data: [] };

  const hdrs = data[0];
  const rows = data.slice(1).map((row, i) => {
    const obj = { rowIdx: i + 2 };
    hdrs.forEach((h, j) => { obj[h] = row[j]; });
    return obj;
  });
  return { ok: true, data: rows };
}

function saveReturn(body, user) {
  const { rowIdx, data: rd } = body;
  if (!rd) return { ok: false, error: 'Нет данных' };

  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ensureReturnSheet(ss);

  rd['Обновлено']      = new Date().toLocaleString('ru-RU');
  rd['Кем обновлено']  = user.name;

  const vals = RET_HEADERS.map(h => (rd[h] !== undefined ? rd[h] : ''));

  if (rowIdx) {
    sh.getRange(rowIdx, 1, 1, vals.length).setValues([vals]);
  } else {
    sh.appendRow(vals);
  }

  addLog(ss, user.name, 'Возврат', rowIdx || 'новая', rd);
  return { ok: true };
}

// ── Пользователи ──────────────────────────────────────────────────────────────

function listUsers() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SH_ADMINS);
  if (!sh) return { ok: true, data: [] };
  const data = sh.getDataRange().getValues();
  return {
    ok: true,
    data: data.slice(1).map(r => ({
      login: r[0], role: r[3], name: r[4], active: r[5]
    }))
  };
}

function saveUser(body) {
  const { login: lgn, password, role, name, active } = body;
  if (!lgn) return { ok: false, error: 'Укажите логин' };

  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ensureSheet(ss, SH_ADMINS, ['login','salt','hash','role','name','active']);
  const data = sh.getDataRange().getValues();

  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === lgn) { rowIdx = i + 1; break; }
  }

  let salt = '', hash = '';
  if (password) {
    salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    hash = sha256(salt + password);
  }

  if (rowIdx > 0) {
    if (role   !== undefined) sh.getRange(rowIdx, 4).setValue(role);
    if (name   !== undefined) sh.getRange(rowIdx, 5).setValue(name);
    if (active !== undefined) sh.getRange(rowIdx, 6).setValue(active);
    if (password) {
      sh.getRange(rowIdx, 2).setValue(salt);
      sh.getRange(rowIdx, 3).setValue(hash);
    }
  } else {
    if (!password) return { ok: false, error: 'Для нового пользователя нужен пароль' };
    sh.appendRow([lgn, salt, hash, role || 'editor', name || lgn, active !== false]);
  }
  return { ok: true };
}

function changePassword(body, user) {
  const { oldPassword, newPassword } = body;
  if (!oldPassword || !newPassword) return { ok: false, error: 'Заполните оба поля' };
  if (newPassword.length < 6) return { ok: false, error: 'Пароль слишком короткий (мин. 6 символов)' };

  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SH_ADMINS);
  if (!sh) return { ok: false, error: 'Таблица пользователей не найдена' };
  const data = sh.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.login) {
      if (sha256(data[i][1] + oldPassword) !== data[i][2]) {
        return { ok: false, error: 'Неверный текущий пароль' };
      }
      const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
      const hash = sha256(salt + newPassword);
      sh.getRange(i + 1, 2).setValue(salt);
      sh.getRange(i + 1, 3).setValue(hash);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Пользователь не найден' };
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function addLog(ss, userName, section, rowId, fields) {
  try {
    const sh = ensureSheet(ss, SH_LOG, ['Дата','Пользователь','Раздел','Строка','Изменения']);
    sh.appendRow([
      new Date().toLocaleString('ru-RU'),
      userName, section, rowId,
      JSON.stringify(fields).slice(0, 500)
    ]);
  } catch(_) {}
}

// ── Первоначальная настройка пользователей ────────────────────────────────────
// Запустить ОДИН РАЗ из редактора Apps Script: Выполнить → setupAdminUsers

function setupAdminUsers() {
  const users = [
    { login: 'admin',       password: 'Admin2026!',  role: 'admin',  name: 'Администратор' },
    { login: 'sotrudnik1',  password: 'PKK_2026_01', role: 'editor', name: 'Сотрудник 1'  },
    { login: 'sotrudnik2',  password: 'PKK_2026_02', role: 'editor', name: 'Сотрудник 2'  },
    { login: 'sotrudnik3',  password: 'PKK_2026_03', role: 'editor', name: 'Сотрудник 3'  },
    { login: 'sotrudnik4',  password: 'PKK_2026_04', role: 'editor', name: 'Сотрудник 4'  },
    { login: 'sotrudnik5',  password: 'PKK_2026_05', role: 'editor', name: 'Сотрудник 5'  },
    { login: 'sotrudnik6',  password: 'PKK_2026_06', role: 'editor', name: 'Сотрудник 6'  },
    { login: 'sotrudnik7',  password: 'PKK_2026_07', role: 'editor', name: 'Сотрудник 7'  },
    { login: 'sotrudnik8',  password: 'PKK_2026_08', role: 'editor', name: 'Сотрудник 8'  },
    { login: 'sotrudnik9',  password: 'PKK_2026_09', role: 'editor', name: 'Сотрудник 9'  },
    { login: 'sotrudnik10', password: 'PKK_2026_10', role: 'editor', name: 'Сотрудник 10' },
  ];
  users.forEach(u => saveUser(u));
  Logger.log('✅ Пользователи созданы: ' + users.length);
  Logger.log('Логин admin, пароль: Admin2026!');
}
