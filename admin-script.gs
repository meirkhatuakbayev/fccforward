// ═══════════════════════════════════════════════════════════════════════════
// ПКК Форвард 2026 — Бэкенд Админ-панели  [OPTIMIZED v2]
// ═══════════════════════════════════════════════════════════════════════════

const SS_ID       = '1C86Fh9p3EW4LwYWi4u2hUnRC1TxfjzN75WQ0iDNZX0Q';
const SH_DETAIL   = 'РАЗВЕРНУТАЯ_ИНФОРМАЦИЯ';
const SH_RETURN   = 'ВОЗВРАТ';
const SH_ADMINS   = 'ADMINS';
const SH_SESSIONS = 'СЕССИИ';
const SH_LOG      = 'ЖУРНАЛ';
const SESSION_H   = 8;
const CACHE_TTL   = 300;  // секунд (5 минут)

// ── Мемоизация SpreadsheetApp внутри одного запроса ─────────────────────────
let _ss = null;
function getSS() {
  if (!_ss) _ss = SpreadsheetApp.openById(SS_ID);
  return _ss;
}

// ── Измерение времени выполнения ─────────────────────────────────────────────
function _t(label, fn) {
  const t0 = Date.now();
  const r = fn();
  Logger.log('[PERF] ' + label + ': ' + (Date.now() - t0) + ' ms');
  return r;
}

// ── CacheService: обычные операции ───────────────────────────────────────────
const _cache = CacheService.getScriptCache();

function cacheGet(key) {
  try {
    // Сначала пробуем чанкованный формат
    const n = _cache.get(key + '__n');
    if (n !== null) return _cacheGetChunked(key, parseInt(n));
    // Затем — обычный (для мелких данных)
    const v = _cache.get(key);
    return v ? JSON.parse(v) : null;
  } catch(_) { return null; }
}

function cacheSet(key, data) {
  try {
    const s = JSON.stringify(data);
    if (s.length <= 90000) {
      // Помещается в один ключ
      _cache.put(key, s, CACHE_TTL);
    } else {
      // Данные большие — разбиваем на чанки по 90 КБ
      _cacheSetChunked(key, s);
    }
  } catch(_) {}
}

// Чанкованное кеширование: один putAll вместо N put ──────────────────────────
function _cacheSetChunked(key, str) {
  const SZ = 90000;
  const chunks = Math.ceil(str.length / SZ);
  const entries = {};
  entries[key + '__n'] = String(chunks);
  for (let i = 0; i < chunks; i++) {
    entries[key + '__' + i] = str.slice(i * SZ, (i + 1) * SZ);
  }
  _cache.putAll(entries, CACHE_TTL);   // один сетевой вызов вместо N
}

function _cacheGetChunked(key, n) {
  const keys = Array.from({ length: n }, (_, i) => key + '__' + i);
  const vals  = _cache.getAll(keys);  // один сетевой вызов вместо N get
  const parts = keys.map(k => vals[k]);
  if (parts.some(p => !p)) return null;
  try { return JSON.parse(parts.join('')); } catch(_) { return null; }
}

// Инвалидирует все ключи одним removeAll ──────────────────────────────────────
function cacheDel() {
  try {
    _cache.removeAll([
      'ctrs', 'ret_list', 'fin_2026', 'fin_2025',
      'ret_dash_2026', 'ret_dash_2025', 'apps_list'
    ]);
  } catch(_) {}
}

// ── Сессионный мини-кеш (избегаем чтения листа СЕССИИ на каждый запрос) ─────
// TTL 120 с — короткий, чтобы logout/истечение работали корректно.
const _SESS_PFX = 'sx_';
const _SESS_TTL = 120;

function _sessCacheKey(token) { return _SESS_PFX + token.slice(0, 50); }

function _sessCacheGet(token) {
  try {
    const v = _cache.get(_sessCacheKey(token));
    return v ? JSON.parse(v) : null;
  } catch(_) { return null; }
}

function _sessCacheSet(token, user) {
  try { _cache.put(_sessCacheKey(token), JSON.stringify(user), _SESS_TTL); } catch(_) {}
}

function _sessCacheDel(token) {
  try { _cache.remove(_sessCacheKey(token)); } catch(_) {}
}

// ── Точка входа ──────────────────────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  const year   = (e && e.parameter && e.parameter.year)   || '2026';
  if (action === 'getReturn')    return ok(_t('getReturn',    () => getReturnForYear(year)));
  if (action === 'getFinancing') return ok(_t('getFinancing', () => getFinancingForYear(year)));
  return ok({ status: 'ПКК Admin API работает' });
}

function getFinancingForYear(year) {
  const ckey = 'fin_' + year;
  const hit  = cacheGet(ckey);
  if (hit) return hit;

  try {
    const ss       = getSS();
    const svodName = year === '2026' ? 'СВОД'    : 'СВОД_'        + year;
    const detName  = year === '2026' ? SH_DETAIL : 'РАЗВЕРНУТАЯ_' + year;
    const svodSh   = ss.getSheetByName(svodName);
    const detSh    = ss.getSheetByName(detName);
    if (!svodSh) return { ok: false, error: 'Лист "' + svodName + '" не найден' };
    if (!detSh)  return { ok: false, error: 'Лист "' + detName  + '" не найден' };

    // Два getDataRange().getValues() — единственный способ читать листы целиком.
    // Оба вызова параллельны на уровне I/O (GAS не поддерживает async, но quota
    // не тратится дважды на открытие SS, т.к. _ss уже в кеше).
    const svod   = svodSh.getDataRange().getValues();
    const detail = detSh.getDataRange().getValues();

    const result = { ok: true, svod, detail };
    cacheSet(ckey, result);
    return result;
  } catch(err) { return { ok: false, error: err.message }; }
}

function getReturnForYear(year) {
  if (year === '2026') return getReturnForDashboard();
  const ckey = 'ret_dash_' + year;
  const hit  = cacheGet(ckey);
  if (hit) return hit;

  try {
    const ss     = getSS();
    const svodSh = ss.getSheetByName('ВОЗВРАТ_' + year);
    const detSh  = ss.getSheetByName('ВОЗВРАТ_РАЗВЕРНУТАЯ_' + year);
    if (!svodSh) return { ok: false, error: 'Лист "ВОЗВРАТ_' + year + '" не найден' };
    if (!detSh)  return { ok: false, error: 'Лист "ВОЗВРАТ_РАЗВЕРНУТАЯ_' + year + '" не найден' };
    const result = { ok: true,
      svod:   svodSh.getDataRange().getValues(),
      detail: detSh.getDataRange().getValues() };
    cacheSet(ckey, result);
    return result;
  } catch(err) { return { ok: false, error: err.message }; }
}

// ── Публичная отдача данных возврата для дашборда ────────────────────────────

function getReturnForDashboard() {
  const ckey = 'ret_dash_2026';
  const hit  = cacheGet(ckey);
  if (hit) return hit;

  try {
    const ss = getSS();

    const detSheet = ss.getSheetByName(SH_DETAIL);
    if (!detSheet) return { ok: false, error: 'Лист финансирования не найден' };

    // Один getDataRange().getValues() читает весь лист за один I/O-вызов
    const detData = detSheet.getDataRange().getValues();

    const financed = {};
    for (let i = DATA_ROW; i < detData.length; i++) {
      const row    = detData[i];
      const name   = String(row[C.name] || '').trim();
      const bin    = String(row[C.bin]  || '').trim();
      if (!name || name.includes('Итого') || name === 'Наименование поставщика') continue;
      const status = String(row[C.status] || '').trim().toLowerCase();
      if (!status.startsWith('профин')) continue;
      const finSum = Number(row[C.fin_sum]) || Number(row[C.dog_sum]) || 0;
      if (finSum <= 0) continue;
      const cult   = String(row[C.cult]    || '').trim();
      const dogNum = String(row[C.dog_num] || '').trim();
      const key    = (bin || name) + '|' + dogNum + '|' + cult;
      if (financed[key]) {
        financed[key].sum_fin += finSum;
        financed[key].vol_fin += Number(row[C.fin_vol]) || Number(row[C.dog_vol]) || 0;
        continue;
      }
      financed[key] = {
        reg:       String(row[C.reg]      || '').trim(),
        form:      String(row[C.form]     || '').trim(),
        name, bin,
        rayon:     String(row[C.rayon]    || '').trim(),
        dog_num:   dogNum,
        dog_date:  String(row[C.dog_date] || '').trim(),
        cult,
        vol_fin:   Number(row[C.fin_vol]) || Number(row[C.dog_vol]) || 0,
        price_fin: Number(row[C.fin_price]) || Number(row[C.app_price]) || 0,
        sum_fin:   finSum,
      };
    }

    const retSheet = ss.getSheetByName(SH_RETURN);
    const retMap   = {};
    var retHIdx    = {};
    if (retSheet && retSheet.getLastRow() > 1) {
      // Один вызов getDataRange().getValues() — весь лист за один I/O
      const retData      = retSheet.getDataRange().getValues();
      const retHeaderRow = retData[0] || [];
      retHeaderRow.forEach(function(h, i) { retHIdx[String(h).trim()] = i; });
      if (Object.keys(retHIdx).length < 5) {
        RET_HEADERS.forEach(function(h, i) { retHIdx[h] = i; });
      }
      var riName = retHIdx['Наименование поставщика'] !== undefined ? retHIdx['Наименование поставщика'] : 2;
      var riBin  = retHIdx['БИН/ИИН']                !== undefined ? retHIdx['БИН/ИИН']                : 4;
      for (let i = 1; i < retData.length; i++) {
        const row  = retData[i];
        const name = String(row[riName] || '').trim();
        const bin  = String(row[riBin]  || '').trim();
        if (!name) continue;
        retMap[bin || name] = row;
      }
    } else {
      RET_HEADERS.forEach(function(h, i) { retHIdx[h] = i; });
    }

    const detail = [];
    const regAgg = {};

    Object.values(financed).forEach(function(f) {
      const ret = retMap[f.bin || f.name] || retMap[f.name] || null;
      const nh  = function(name) {
        const idx = retHIdx[name];
        return (ret && idx !== undefined) ? (Number(ret[idx]) || 0) : 0;
      };

      const row = new Array(65).fill(0);
      row[2]  = f.reg;
      row[3]  = f.form;
      row[4]  = f.name;
      row[5]  = f.rayon;
      row[6]  = f.bin;
      var riDogNum  = retHIdx['№ договора']   !== undefined ? retHIdx['№ договора']   : 5;
      var riDogDate = retHIdx['Дата договора'] !== undefined ? retHIdx['Дата договора'] : 6;
      var riCult    = retHIdx['Культура']      !== undefined ? retHIdx['Культура']      : 7;
      row[9]  = ret ? String(ret[riDogNum]  || f.dog_num)  : f.dog_num;
      row[10] = ret ? String(ret[riDogDate] || f.dog_date) : f.dog_date;
      row[14] = ret ? String(ret[riCult]    || f.cult)     : f.cult;
      row[17] = f.vol_fin;
      row[18] = f.price_fin;
      row[19] = f.sum_fin;

      row[27] = nh('Пш 3кл объём, т');     row[28] = nh('Пш 3кл сумма, ₸');
      row[25] = nh('Пш 4кл объём, т');     row[26] = nh('Пш 4кл сумма, ₸');
      row[23] = nh('Пш 5кл объём, т');     row[24] = nh('Пш 5кл сумма, ₸');
      row[29] = nh('Ячмень 2кл объём, т'); row[30] = nh('Ячмень 2кл сумма, ₸');

      row[52] = nh('Всего поставлено, т');
      row[53] = nh('Всего сумма за зерно, ₸');

      var grainSumRet  = nh('Всего сумма за зерно, ₸');
      var paidMoneyRet = nh('Погашено деньгами, ₸');
      var zachetRet    = ret ? Math.min(grainSumRet + paidMoneyRet, f.sum_fin) : 0;
      var debtRet      = Math.max(0, f.sum_fin - zachetRet);
      var excessRet    = Math.max(0, grainSumRet - f.sum_fin);
      var doplatRet    = (f.sum_fin > 0 && excessRet >= 200000) ? excessRet : 0;

      row[32] = zachetRet;
      row[56] = debtRet;
      row[57] = nh('Пеня, ₸');
      row[58] = paidMoneyRet;
      row[59] = nh('Погашено зерном, ₸');
      row[34] = doplatRet > 0 ? doplatRet : nh('Доплата план, ₸');
      row[40] = nh('Доплата факт, ₸');
      row[44] = nh('КСН, ₸');
      row[61] = debtRet;

      var riJson = retHIdx['Поставлено JSON'] !== undefined ? retHIdx['Поставлено JSON'] : 29;
      try { row.payments = ret ? JSON.parse(ret[riJson] || '[]') : []; }
      catch(_) { row.payments = []; }

      detail.push(row);

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

    const svod   = [];
    const totals = { vol_contr:0, sum_fin:0, vol_ret:0, sum_ret:0,
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

    const tr = new Array(25).fill(0);
    tr[1]  = 'Итого по РК:'; tr[4] = totals.vol_contr; tr[5] = totals.sum_fin;
    tr[9]  = totals.vol_ret; tr[10] = totals.sum_ret;   tr[11] = totals.sum_zachet;
    tr[12] = totals.sum_doplata;
    tr[13] = totals.sum_fin > 0 ? totals.sum_zachet / totals.sum_fin : 0;
    tr[17] = totals.sum_ksn; tr[20] = totals.debt;
    svod.push(tr);

    const result = { ok: true, svod, detail };
    cacheSet(ckey, result);
    return result;
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

// ── POST-обработчик ───────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'login')  return ok(_t('login',  () => login(body)));
    if (action === 'logout') return ok(_t('logout', () => logout(body)));

    const user = _t('checkToken', () => checkToken(body.token));
    if (!user) return ok({ ok: false, error: 'Сессия истекла. Войдите снова.' });

    switch (action) {
      case 'listContractors':  return ok(_t('listContractors',  () => listContractors()));
      case 'getContractor':    return ok(_t('getContractor',    () => getContractor(body)));
      case 'saveFinancing':    return ok(_t('saveFinancing',    () => saveFinancing(body, user)));
      case 'addContractor':    return ok(_t('addContractor',    () => addContractor(body, user)));
      case 'listReturn':       return ok(_t('listReturn',       () => listReturn()));
      case 'saveReturn':       return ok(_t('saveReturn',       () => saveReturn(body, user)));
      case 'deleteReturn':     return ok(_t('deleteReturn',     () => deleteReturn(body, user)));
      case 'listApplications': return ok(_t('listApplications', () => listApplications()));
      case 'saveAppStatus':    return ok(_t('saveAppStatus',    () => saveAppStatus(body, user)));
      case 'saveAppCard':      return ok(_t('saveAppCard',      () => saveAppCard(body, user)));
      case 'listUsers':        checkAdmin(user); return ok(_t('listUsers', () => listUsers()));
      case 'saveUser':         checkAdmin(user); return ok(_t('saveUser',  () => saveUser(body)));
      case 'changePassword':   return ok(_t('changePassword',  () => changePassword(body, user)));
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

  const ss    = getSS();
  const sheet = ss.getSheetByName(SH_ADMINS);
  if (!sheet) return { ok: false, error: 'Таблица пользователей не найдена. Запустите setupAdminUsers()' };

  // Один getDataRange().getValues() — читаем весь лист за один I/O
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lgn && rows[i][5] === true) {
      const hash = sha256(rows[i][1] + password);
      if (hash === rows[i][2]) {
        const token  = Utilities.getUuid();
        const expiry = new Date(Date.now() + SESSION_H * 3600000);
        ensureSheet(ss, SH_SESSIONS, ['token','login','expiry','role','name'])
          .appendRow([token, lgn, expiry, rows[i][3], rows[i][4]]);
        const user = { login: lgn, role: rows[i][3], name: rows[i][4],
                       expiry: expiry.toISOString() };
        _sessCacheSet(token, user);  // кешируем сессию сразу
        return { ok: true, token, role: rows[i][3], name: rows[i][4] };
      }
    }
  }
  return { ok: false, error: 'Неверный логин или пароль' };
}

function logout(body) {
  if (!body.token) return { ok: true };
  _sessCacheDel(body.token);  // удаляем из кеша немедленно
  const ss    = getSS();
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

  // ── Сессионный кеш: избегаем чтения листа СЕССИИ на каждый запрос ──────────
  const cached = _sessCacheGet(token);
  if (cached) {
    if (new Date(cached.expiry) > new Date()) return cached;
    _sessCacheDel(token);
    // Кеш протух — идём в таблицу
  }

  // ── Fallback: читаем лист ────────────────────────────────────────────────────
  const ss    = getSS();
  const sheet = ss.getSheetByName(SH_SESSIONS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();  // один getValues на весь лист
  const now  = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== token) continue;
    if (new Date(data[i][2]) > now) {
      const newExpiry = new Date(Date.now() + SESSION_H * 3600000);
      // Обновляем expiry в таблице — один setValue допустим (единичная запись)
      sheet.getRange(i + 1, 3).setValue(newExpiry);
      const user = { login: data[i][1], role: data[i][3], name: data[i][4],
                     expiry: newExpiry.toISOString() };
      _sessCacheSet(token, user);  // прогреваем кеш
      return user;
    }
    sheet.deleteRow(i + 1);
    return null;
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
  app_sum: 17, app_price: 18, app_vol: 19, app_hpp: 20, app_gar: 21,
  dog_num: 49, dog_date: 50, dog_sum: 53, dog_vol: 55,
  fin_cult: 62, fin_date: 63, fin_sum: 66, fin_price: 67, fin_vol: 68,
};
const DATA_ROW = 4;

function listContractors() {
  const ckey = 'ctrs';
  const hit  = cacheGet(ckey);
  if (hit) return hit;

  const sheet = getSS().getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист "' + SH_DETAIL + '" не найден' };

  // Один getDataRange().getValues() — весь лист за один I/O
  const data = sheet.getDataRange().getValues();
  const list = [];

  for (var i = DATA_ROW; i < data.length; i++) {
    var row  = data[i];
    var name = String(row[C.name] || '').trim();
    var bin  = String(row[C.bin]  || '').trim();
    var reg  = String(row[C.reg]  || '').trim();
    if (!name || !reg || name.includes('Итого') || name === 'Наименование поставщика') continue;

    var finSum = Number(row[C.fin_sum]) || Number(row[C.dog_sum]) || 0;
    var finVol = Number(row[C.fin_vol]) || Number(row[C.dog_vol]) || 0;
    if (finSum <= 0 && finVol <= 0) continue;

    list.push({
      rowIdx:   i + 1,
      bin, name, reg,
      form:     String(row[C.form]     || '').trim(),
      rayon:    String(row[C.rayon]    || '').trim(),
      cult:     String(row[C.cult]     || '').trim(),
      hpp:      String(row[C.app_hpp]  || '').trim(),
      status:   String(row[C.status]   || '').trim(),
      fin_sum:  finSum,
      fin_vol:  finVol,
      fin_date: String(row[C.fin_date] || '').trim(),
      dog_num:  String(row[C.dog_num]  || '').trim(),
    });
  }

  list.sort(function(a, b) {
    var rv = a.reg.localeCompare(b.reg, 'ru');
    if (rv !== 0) return rv;
    var nv = a.name.localeCompare(b.name, 'ru');
    if (nv !== 0) return nv;
    return a.cult.localeCompare(b.cult, 'ru');
  });

  var result = { ok: true, data: list };
  cacheSet(ckey, result);
  return result;
}

// ── Поступившие заявки ────────────────────────────────────────────────────────

function listApplications() {
  const ckey = 'apps_list';
  const hit  = cacheGet(ckey);
  if (hit) return hit;

  const sheet = getSS().getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист "' + SH_DETAIL + '" не найден' };

  // Один getDataRange().getValues() — читаем лист целиком
  const data = sheet.getDataRange().getValues();
  if (data.length <= DATA_ROW) return { ok: true, data: [], dopfin: [] };

  // Передаём уже прочитанные данные в detectDynamicCols — избегаем повторного чтения
  var dyn = _detectDynamicColsFromData(data);
  var { ks_sum: ksSum, ks_vol: ksVol, ks_sent: ksSent, ks_date: ksDate,
        kusp_sum: kuspSum, kusp_vol: kuspVol, kusp_date: kuspDate,
        pravl_sum: pravlSum, pravl_date: pravlDate } = dyn;

  const g = function(row, idx) { return idx >= 0 ? row[idx] : ''; };
  const n = function(row, idx) { return idx >= 0 ? (Number(row[idx]) || 0) : 0; };

  var list   = [];
  var dopfin = [];

  var finSet = {};
  for (var i = DATA_ROW; i < data.length; i++) {
    var row = data[i];
    if ((Number(row[C.fin_sum]) || 0) > 0) {
      var key = String(row[C.bin] || row[C.name] || '').trim();
      if (!finSet[key]) finSet[key] = [];
      finSet[key].push(String(row[C.dog_num] || '').trim());
    }
  }

  for (var i = DATA_ROW; i < data.length; i++) {
    var row  = data[i];
    var name = String(row[C.name] || '').trim();
    var reg  = String(row[C.reg]  || '').trim();
    if (!name || !reg || name.includes('Итого') || name === 'Наименование поставщика') continue;

    var appSum = Number(row[C.app_sum]) || 0;
    var appVol = Number(row[C.app_vol]) || 0;
    if (appSum <= 0 && appVol <= 0) continue;

    var bin      = String(row[C.bin]      || '').trim();
    var dogNum   = String(row[C.dog_num]  || '').trim();
    var status   = String(row[C.status]   || '').trim();
    var finSum   = Number(row[C.fin_sum]) || 0;
    var dogSum   = Number(row[C.dog_sum]) || 0;
    var statusLo = status.toLowerCase();

    if (statusLo.includes('отозван')) continue;

    var reestNo    = String(row[1] || '').toLowerCase();
    var isDop      = reestNo.includes('доп') || statusLo.includes('доп');
    var isFinanced = finSum > 0 || statusLo.startsWith('профин');

    var obj = {
      rowIdx:     i + 1,
      name, bin, reg,
      form:       String(row[C.form]     || '').trim(),
      rayon:      String(row[C.rayon]    || '').trim(),
      cult:       String(row[C.cult]     || '').trim(),
      status,
      is_dop:     isDop,
      reg_date:   String(row[C.date_reg] || '').trim(),
      app_sum:    appSum,
      app_vol:    appVol,
      ks_sent:    String(g(row, ksSent)  || '').trim(),
      ks_date:    String(g(row, ksDate)  || '').trim(),
      ks_sum:     n(row, ksSum),
      ks_vol:     n(row, ksVol),
      kusp_sum:   n(row, kuspSum),
      kusp_vol:   n(row, kuspVol),
      kusp_date:  String(g(row, kuspDate) || '').trim(),
      pravl_date: String(g(row, pravlDate) || '').trim(),
      pravl_sum:  n(row, pravlSum),
      dog_num:    dogNum,
      dog_date:   String(row[C.dog_date] || '').trim(),
      dog_sum:    dogSum,
      dog_vol:    Number(row[C.dog_vol]) || 0,
      fin_date:   String(row[C.fin_date] || '').trim(),
      fin_sum:    finSum,
      fin_vol:    Number(row[C.fin_vol]) || 0,
    };

    if (isDop && isFinanced) dopfin.push(obj);
    else                     list.push(obj);
  }

  var cmp = function(a, b) {
    return a.reg.localeCompare(b.reg,'ru') || a.name.localeCompare(b.name,'ru') || a.cult.localeCompare(b.cult,'ru');
  };
  list.sort(cmp);
  dopfin.sort(cmp);

  var result = { ok: true, data: list, dopfin: dopfin };
  cacheSet(ckey, result);
  return result;
}

function saveAppStatus(body, user) {
  var { rowIdx, status } = body;
  if (!rowIdx || status == null) return { ok: false, error: 'Нет данных' };
  const ss    = getSS();
  const sheet = ss.getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };
  // Единичная запись одной ячейки — setValue допустим
  sheet.getRange(rowIdx, C.status + 1).setValue(status);
  cacheDel();
  addLog(ss, user.name, 'Статус заявки', rowIdx, { status });
  return { ok: true };
}

// Находит индексы колонок КС/КУСП/Правление по уже прочитанным данным ────────
// Принимает весь массив data (чтобы не делать повторный getValues).
function _detectDynamicColsFromData(data) {
  var hdrRow = data.slice(0, Math.min(4, data.length));
  var hdr    = [];
  for (var hi = 0; hi < hdrRow.length; hi++) {
    if (String(hdrRow[hi][C.name] || '').includes('Наименование')) { hdr = hdrRow[hi]; break; }
  }
  if (!hdr.length) hdr = hdrRow[0] || [];
  hdr = hdr.map(function(h) { return String(h || '').trim().toLowerCase(); });

  var cols = { ks_sum: -1, ks_vol: -1, ks_sent: 30, ks_date: 36,
               kusp_sum: -1, kusp_vol: -1, kusp_date: -1,
               pravl_sum: -1, pravl_date: 43 };
  hdr.forEach(function(h, i) {
    if ((h.includes('кс') || h.includes('коорд')) && !h.includes('кусп')) {
      if ((h.includes('сумм') || h.includes('одобр')) && cols.ks_sum  < 0) cols.ks_sum  = i;
      if  (h.includes('объ')                          && cols.ks_vol  < 0) cols.ks_vol  = i;
      if  (h.includes('направл') || h.includes('отпр')) cols.ks_sent = i;
      if  (h.includes('дат') && !h.includes('направл')) cols.ks_date = i;
    }
    if (h.includes('кусп')) {
      if ((h.includes('сумм') || h.includes('одобр')) && cols.kusp_sum  < 0) cols.kusp_sum  = i;
      if  (h.includes('объ')                          && cols.kusp_vol  < 0) cols.kusp_vol  = i;
      if  (h.includes('дат')                          && cols.kusp_date < 0) cols.kusp_date = i;
    }
    if (h.includes('правл')) {
      if (h.includes('сумм') && cols.pravl_sum  < 0) cols.pravl_sum  = i;
      if (h.includes('дат')  && cols.pravl_date < 0) cols.pravl_date = i;
    }
  });
  return cols;
}

// Публичная обёртка: делает один getValues если данные не переданы ─────────────
function detectDynamicCols(sheet) {
  const data = sheet.getRange(1, 1, Math.min(4, sheet.getLastRow()), sheet.getLastColumn()).getValues();
  return _detectDynamicColsFromData(data);
}

// Сохраняет карточку заявки одним batch-write ─────────────────────────────────
// БЫЛО: N вызовов setValue() в forEach → N сетевых запросов к Sheets API
// СТАЛО: getValues()[0] → patch в памяти → один setValues() = 1 запрос
function saveAppCard(body, user) {
  var rowIdx = body.rowIdx;
  if (!rowIdx) return { ok: false, error: 'Нет rowIdx' };

  const ss    = getSS();
  const sheet = ss.getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  // Читаем заголовки и строку одновременно через один большой диапазон
  const lastCol = sheet.getLastColumn();
  // Читаем строку один раз
  const rowRange  = sheet.getRange(rowIdx, 1, 1, lastCol);
  const rowValues = rowRange.getValues()[0];

  // Определяем динамические колонки по заголовку (один getRange на 4 строки)
  var dyn = detectDynamicCols(sheet);

  var map = {
    status:     C.status,
    app_sum:    C.app_sum,
    app_vol:    C.app_vol,
    reg_date:   C.date_reg,
    ks_sent:    dyn.ks_sent,
    ks_date:    dyn.ks_date,
    ks_sum:     dyn.ks_sum,
    ks_vol:     dyn.ks_vol,
    kusp_date:  dyn.kusp_date,
    kusp_sum:   dyn.kusp_sum,
    kusp_vol:   dyn.kusp_vol,
    pravl_date: dyn.pravl_date,
    pravl_sum:  dyn.pravl_sum,
    dog_num:    C.dog_num,
    dog_date:   C.dog_date,
    dog_sum:    C.dog_sum,
    dog_vol:    C.dog_vol,
    fin_date:   C.fin_date,
    fin_sum:    C.fin_sum,
    fin_vol:    C.fin_vol,
  };

  // Патчим значения в памяти (никаких I/O внутри цикла)
  Object.keys(map).forEach(function(key) {
    var col = map[key];
    if (col < 0 || body[key] === undefined) return;
    rowValues[col] = body[key];
  });

  // Один setValues() вместо N setValue() — главная оптимизация
  rowRange.setValues([rowValues]);

  // Пересчитать СВОД (СХТП/заявки/суммы по регионам) если изменился fin_sum или статус
  if (body.fin_sum !== undefined || body.status !== undefined) {
    _recalcSvodProfin(ss);
  }

  cacheDel();
  addLog(ss, user.name, 'Карточка заявки', rowIdx, { status: body.status });
  return { ok: true };
}

// ── Пересчёт СВОД: колонки "Профинансировано" (СХТП, заявки, сумма, объём) ──
function _recalcSvodProfin(ss) {
  const svodSh = ss.getSheetByName('СВОД');
  const detSh  = ss.getSheetByName(SH_DETAIL);
  if (!svodSh || !detSh) return;

  // 1. Читаем РАЗВЕРНУТАЯ — агрегируем профинансированных по регионам
  const detData = detSh.getDataRange().getValues();
  const regMap  = {}; // нормализованное имя региона → {bins: Set, apps, sum, vol}

  for (var i = DATA_ROW; i < detData.length; i++) {
    var row  = detData[i];
    var name = String(row[C.name] || '').trim();
    if (!name || name.includes('Итого') || name === 'Наименование поставщика') continue;
    var finSum = Number(row[C.fin_sum]) || 0;
    if (finSum <= 0) continue;
    var reg = String(row[C.reg] || '').trim();
    if (!reg) continue;
    var normReg = reg.toLowerCase().replace('область', '').trim();
    if (!regMap[normReg]) regMap[normReg] = { label: reg, bins: {}, apps: 0, sum: 0, vol: 0 };
    var bin = String(row[C.bin] || '').trim() || name; // ключ СХТП — БИН или имя
    regMap[normReg].bins[bin] = 1;
    regMap[normReg].apps += 1;
    regMap[normReg].sum  += finSum;
    regMap[normReg].vol  += Number(row[C.fin_vol]) || Number(row[C.dog_vol]) || 0;
  }

  // 2. Читаем СВОД — находим строки регионов
  var svodData = svodSh.getDataRange().getValues();
  var itogoRow = -1;
  var totSchtp = 0, totApps = 0, totSum = 0, totVol = 0;

  for (var j = 0; j < svodData.length; j++) {
    var nm = String(svodData[j][1] || '').trim();
    if (!nm) continue;
    if (nm.includes('Итого по РК')) { itogoRow = j + 1; continue; }
    var normNm = nm.toLowerCase().replace('область', '').trim();
    var rd = regMap[normNm];
    if (!rd) continue;
    var schtp = Object.keys(rd.bins).length;
    // Колонка 20 (1-indexed) = индекс 19 = СХТП профинансировано
    svodSh.getRange(j + 1, 20, 1, 4).setValues([[schtp, rd.apps, rd.sum, rd.vol]]);
    totSchtp += schtp; totApps += rd.apps; totSum += rd.sum; totVol += rd.vol;
  }

  // 3. Обновляем строку "Итого по РК"
  if (itogoRow > 0) {
    svodSh.getRange(itogoRow, 20, 1, 4).setValues([[totSchtp, totApps, totSum, totVol]]);
  }
}

function getContractor(body) {
  const sheet = getSS().getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  const data = sheet.getDataRange().getValues();  // один getValues
  const rows = [];

  for (let i = DATA_ROW; i < data.length; i++) {
    const row   = data[i];
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

  const ss    = getSS();
  const sheet = ss.getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  // Batch write: читаем минимальный диапазон, патчим, пишем обратно одним вызовом
  const entries = Object.entries(fields).map(([ci, val]) => ({ col: parseInt(ci), val }));
  if (entries.length > 0) {
    const cols   = entries.map(e => e.col);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const width  = maxCol - minCol + 1;
    const range  = sheet.getRange(rowIdx, minCol + 1, 1, width);
    const row    = range.getValues()[0];
    entries.forEach(e => { row[e.col - minCol] = e.val; });
    range.setValues([row]);  // один setValues вместо N setValue
  }

  cacheDel();
  addLog(ss, user.name, 'Финансирование', rowIdx, fields);
  return { ok: true };
}

function addContractor(body, user) {
  const { fields } = body;
  if (!fields) return { ok: false, error: 'Нет данных' };

  const ss    = getSS();
  const sheet = ss.getSheetByName(SH_DETAIL);
  if (!sheet) return { ok: false, error: 'Лист не найден' };

  const lastRow = sheet.getLastRow();
  const newRow  = new Array(70).fill('');
  Object.entries(fields).forEach(([colIdx, val]) => { newRow[parseInt(colIdx)] = val; });
  sheet.appendRow(newRow);  // appendRow для одной строки — оптимально

  cacheDel();
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
  'Поставлено JSON',
  '% исполнения',
  'Обновлено','Кем обновлено'
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
  const ckey = 'ret_list';
  const hit  = cacheGet(ckey);
  if (hit) return hit;

  const ss   = getSS();
  const sh   = ensureReturnSheet(ss);
  const data = sh.getDataRange().getValues();  // один getValues
  if (data.length <= 1) return { ok: true, data: [] };

  const rows = data.slice(1).map((row, i) => {
    const obj = { rowIdx: i + 2 };
    RET_HEADERS.forEach(function(h, j) { obj[h] = row[j]; });
    return obj;
  });

  const result = { ok: true, data: rows };
  cacheSet(ckey, result);
  return result;
}

function saveReturn(body, user) {
  const { rowIdx, data: rd } = body;
  if (!rd) return { ok: false, error: 'Нет данных' };

  const ss = getSS();
  const sh = ensureReturnSheet(ss);

  rd['Обновлено']     = new Date().toLocaleString('ru-RU');
  rd['Кем обновлено'] = user.name;

  const vals = RET_HEADERS.map(h => (rd[h] !== undefined ? rd[h] : ''));

  if (rowIdx) {
    // Один setValues — запись строки целиком за один I/O
    sh.getRange(rowIdx, 1, 1, vals.length).setValues([vals]);
  } else {
    sh.appendRow(vals);
  }

  cacheDel();
  addLog(ss, user.name, 'Возврат', rowIdx || 'новая', rd);
  return { ok: true };
}

function deleteReturn(body, user) {
  const { rowIdx } = body;
  if (!rowIdx) return { ok: false, error: 'Не указан rowIdx' };
  const ss = getSS();
  const sh = ensureReturnSheet(ss);
  sh.deleteRow(rowIdx);
  cacheDel();
  addLog(ss, user.name, 'Возврат', rowIdx, { действие: 'УДАЛЕНИЕ' });
  return { ok: true };
}

// ── Пользователи ──────────────────────────────────────────────────────────────

function listUsers() {
  const ss   = getSS();
  const sh   = ss.getSheetByName(SH_ADMINS);
  if (!sh) return { ok: true, data: [] };
  const data = sh.getDataRange().getValues();  // один getValues
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

  const ss   = getSS();
  const sh   = ensureSheet(ss, SH_ADMINS, ['login','salt','hash','role','name','active']);
  const data = sh.getDataRange().getValues();  // один getValues

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
    // БЫЛО: до 5 отдельных setValue() → 5 сетевых вызовов
    // СТАЛО: читаем строку, патчим, один setValues() → 1 вызов
    const userRange  = sh.getRange(rowIdx, 1, 1, 6);
    const userValues = userRange.getValues()[0];
    if (role   !== undefined) userValues[3] = role;
    if (name   !== undefined) userValues[4] = name;
    if (active !== undefined) userValues[5] = active;
    if (password) { userValues[1] = salt; userValues[2] = hash; }
    userRange.setValues([userValues]);
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

  const ss   = getSS();
  const sh   = ss.getSheetByName(SH_ADMINS);
  if (!sh) return { ok: false, error: 'Таблица пользователей не найдена' };
  const data = sh.getDataRange().getValues();  // один getValues

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.login) {
      if (sha256(data[i][1] + oldPassword) !== data[i][2]) {
        return { ok: false, error: 'Неверный текущий пароль' };
      }
      const newSalt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
      const newHash = sha256(newSalt + newPassword);
      // БЫЛО: два отдельных setValue() → 2 сетевых вызова
      // СТАЛО: один setValues([[salt, hash]]) → 1 вызов
      sh.getRange(i + 1, 2, 1, 2).setValues([[newSalt, newHash]]);
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

function clearAllCache() {
  cacheDel();
  Logger.log('✅ Кеш очищен');
}
