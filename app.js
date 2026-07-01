// ====== توابع کمکی مودال ======
function closeAllModals() {
  document.getElementById('confirmModal').style.display = 'none';
  document.getElementById('cardStyleModal').style.display = 'none';
}

// ====== تنظیمات Supabase ======
const SUPABASE_URL = 'https://uihlljbwgddjoqcdtsjs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpaGxsamJ3Z2Rkam9xY2R0c2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTk3MzksImV4cCI6MjA5NzA5NTczOX0.-V6QBkAIKDewUSewtaUJA52ws3UNZ0BORlNGmkKuzVg';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ====== وضعیت ======
let db = [];
let selected = [];
let editingId = null;
let pendingDeleteId = null;
let busy = false;
let selectedCardStyle = 'glass';

const cats = ["دینام", "تایم", "کولر", "پروانه", "هیدرولیک"];
// لیست مدل‌ها (شیاری = تسمه شیاری، بقیه فقط عدد)
const models = ["A", "AX", "B", "BX", "AA", "2RA", "2RAX", "9.5", "شیاری"];

// ====== ثبت Service Worker ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('✅ Service Worker ثبت شد:', reg))
      .catch(err => console.error('❌ خطا در ثبت Service Worker:', err));
  });
}

// ====== راه‌اندازی ======
window.onload = async () => {
  try {
    await checkMagicLink();
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
      showApp();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error(err);
    toast("خطا در اتصال", "error");
    showLogin();
  }
};

// ====== توابع عمومی ======
function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  showPage('home');
  initAddForm([]);
  loadData();
}

function setLoading(state, text = "در حال پردازش...") {
  busy = state;
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  if (loaderText) loaderText.innerText = text;
  if (loader) loader.classList.toggle('show', state);
  ['loginBtn', 'saveBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = state;
  });
}

function toast(message, type = "info") {
  const box = document.getElementById('toast');
  if (!box) return;
  box.className = `toast-box toast-${type}`;
  box.innerText = message;
  box.style.display = 'block';
  clearTimeout(box._timer);
  box._timer = setTimeout(() => { box.style.display = 'none'; }, 3000);
}

// ====== احراز هویت ======
async function handleLogin() {
  if (busy) return;
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  if (!email || !password) {
    toast("ایمیل و رمز عبور را وارد کنید", "warning");
    return;
  }
  try {
    setLoading(true, "در حال ورود...");
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast("خطا: " + error.message, "error");
      return;
    }
    toast("ورود موفق", "success");
    showApp();
  } catch (err) {
    toast("خطای غیرمنتظره", "error");
  } finally {
    setLoading(false);
  }
}

async function logout() {
  try {
    setLoading(true, "در حال خروج...");
    await _supabase.auth.signOut();
  } catch (err) { console.error(err); }
  finally { setLoading(false); }
  location.reload();
}

// ====== ورود با لینک (حذف شد) ======
async function checkMagicLink() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    try {
      setLoading(true, "در حال ورود با لینک...");
      const { data, error } = await _supabase.auth.getSession();
      if (error) {
        toast("لینک نامعتبر یا منقضی شده", "error");
        return;
      }
      if (data.session) {
        toast("✅ ورود موفق", "success");
        showApp();
        window.location.hash = '';
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (err) {
      console.error(err);
      toast("خطا در ورود با لینک", "error");
    } finally {
      setLoading(false);
    }
  }
}

// ====== بارگذاری داده ======
async function loadData() {
  try {
    setLoading(true, "دریافت اطلاعات...");
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { toast("کاربر شناسایی نشد", "error"); return; }

    const { data, error } = await _supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) { toast("خطا در دریافت", "error"); console.error(error); return; }

    db = (data || []).map(v => ({
      id: v.id,
      name: v.car_name || '',
      belts: Array.isArray(v.belt_data) ? v.belt_data : [],
      created_at: v.created_at || ''
    }));

    updateStats();
    const searchPage = document.getElementById('page-search');
    if (searchPage && searchPage.style.display !== 'none') renderSearch();
  } catch (err) {
    console.error(err);
    toast("خطا در بارگذاری", "error");
  } finally {
    setLoading(false);
  }
}

// ====== صفحه‌ها ======
function showPage(p) {
  // لغو انتخاب‌ها هنگام تغییر صفحه
  if (p !== 'search' && selected.length > 0) {
    selected = [];
    updateBatchMenu();
  }
  document.querySelectorAll('.content-page').forEach(el => el.style.display = 'none');
  const page = document.getElementById('page-' + p);
  if (page) page.style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const navBtn = document.getElementById('n-' + p);
  if (navBtn) navBtn.classList.add('active');
  if (p === 'home') updateStats();
  if (p === 'add' && !document.getElementById('belts-list-container')?.innerHTML.trim()) initAddForm([]);
  if (p === 'search') renderSearch();
}

// ====== فرم تسمه ======
function getModelDisplay(model) {
  if (!model) return '';
  return model;
}

function beltRowTemplate(modelValue = '', sizeValue = '') {
  const isNumeric = modelValue && modelValue !== 'شیاری';
  return `
    <div class="belt-row-editor">
      <div class="row g-2 align-items-center">
        <div class="col-5">
          <select class="form-select m-v" onchange="toggleSizeInput(this)">
            <option value="">مدل</option>
            ${models.map(m => `<option value="${m}" ${m === modelValue ? 'selected' : ''}>${getModelDisplay(m)}</option>`).join('')}
          </select>
        </div>
        <div class="col-5">
          <input type="${isNumeric ? 'number' : 'text'}" class="form-control s-v" placeholder="سایز" value="${escapeAttr(sizeValue)}" step="0.1">
        </div>
        <div class="col-2">
          <button type="button" class="btn btn-outline-danger w-100" onclick="removeBeltRow(this)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function toggleSizeInput(select) {
  const row = select.closest('.belt-row-editor');
  const sizeInput = row.querySelector('.s-v');
  const selectedValue = select.value;
  
  if (selectedValue === 'شیاری' || selectedValue === '') {
    sizeInput.type = 'text';
    sizeInput.placeholder = selectedValue === 'شیاری' ? 'سایز (عدد یا حروف)' : 'سایز';
    sizeInput.step = '';
    sizeInput.pattern = '';
  } else {
    sizeInput.type = 'number';
    sizeInput.placeholder = 'سایز (فقط عدد)';
    sizeInput.step = '0.1';
  }
  sizeInput.value = '';
}

function initAddForm(prefillBelts = []) {
  const container = document.getElementById('belts-list-container');
  if (!container) return;
  container.innerHTML = cats.map(cat => {
    const items = prefillBelts.filter(b => normalizeText(b.cat || '') === normalizeText(cat));
    return `
      <div class="belt-input-item" data-cat="${escapeHtml(cat)}">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold">${cat}</div>
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="addBeltRow('${cat}')">
            <i class="fa-solid fa-plus"></i> افزودن
          </button>
        </div>
        <div class="belt-rows">
          ${items.length ? items.map(item => beltRowTemplate(item.model || '', item.size || '')).join('') : beltRowTemplate('', '')}
        </div>
      </div>
    `;
  }).join('');
}

function addBeltRow(cat) {
  const section = [...document.querySelectorAll('.belt-input-item')].find(el => el.dataset.cat === cat);
  if (!section) return;
  const rows = section.querySelector('.belt-rows');
  if (!rows) return;
  rows.insertAdjacentHTML('beforeend', beltRowTemplate('', ''));
  // تنظیم input برای مدل جدید
  const newRow = rows.lastElementChild;
  const select = newRow.querySelector('.m-v');
  const sizeInput = newRow.querySelector('.s-v');
  if (select && sizeInput) {
    sizeInput.type = 'text';
    sizeInput.placeholder = 'سایز (عدد یا حروف)';
  }
}

function removeBeltRow(btn) {
  const section = btn.closest('.belt-input-item');
  const row = btn.closest('.belt-row-editor');
  if (!section || !row) return;
  const rows = section.querySelectorAll('.belt-row-editor');
  if (rows.length <= 1) {
    row.querySelector('.s-v').value = '';
    row.querySelector('.m-v').value = '';
    return;
  }
  row.remove();
}

function getFormBelts() {
  let belts = [];
  document.querySelectorAll('.belt-input-item').forEach(section => {
    const cat = section.dataset.cat || '';
    section.querySelectorAll('.belt-row-editor').forEach(row => {
      const size = row.querySelector('.s-v')?.value.trim() || '';
      const model = row.querySelector('.m-v')?.value.trim() || '';
      if (size) belts.push({ cat, model: convertModelToUpper(model), size });
    });
  });
  return belts;
}

function isDuplicateVehicle(name, belts, ignoreId = null) {
  const targetName = normalizeText(name);
  const targetBelts = JSON.stringify(
    belts.map(b => ({
      cat: normalizeText(b.cat || ''),
      model: normalizeText(convertModelToUpper(b.model || '')),
      size: normalizeText(b.size || '')
    })).sort((a, b) => (a.cat + a.model + a.size).localeCompare(b.cat + b.model + b.size))
  );
  return db.some(item => {
    if (ignoreId && String(item.id) === String(ignoreId)) return false;
    const itemBelts = JSON.stringify(
      (Array.isArray(item.belts) ? item.belts : []).map(b => ({
        cat: normalizeText(b.cat || ''),
        model: normalizeText(convertModelToUpper(b.model || '')),
        size: normalizeText(b.size || '')
      })).sort((a, b) => (a.cat + a.model + a.size).localeCompare(b.cat + b.model + b.size))
    );
    return normalizeText(item.name || '') === targetName && itemBelts === targetBelts;
  });
}

// ====== ذخیره ======
async function saveData() {
  if (busy) return;
  const name = document.getElementById('vName')?.value.trim() || '';
  if (!name) { toast("نام خودرو را وارد کنید", "warning"); return; }
  const belts = getFormBelts();
  if (belts.length === 0) { toast("حداقل یک تسمه وارد کنید", "warning"); return; }
  if (isDuplicateVehicle(name, belts, editingId)) {
    toast("این خودرو با همین اطلاعات قبلاً ثبت شده", "warning");
    return;
  }
  try {
    setLoading(true, editingId ? "در حال ویرایش..." : "در حال ذخیره...");
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { toast("کاربر شناسایی نشد", "error"); return; }
    let error = null;
    if (editingId) {
      const result = await _supabase
        .from('vehicles')
        .update({ car_name: name, belt_data: belts })
        .eq('id', editingId)
        .eq('user_id', user.id);
      error = result.error;
    } else {
      const result = await _supabase
        .from('vehicles')
        .insert([{ user_id: user.id, car_name: name, belt_data: belts }]);
      error = result.error;
    }
    if (error) { toast("خطا: " + error.message, "error"); console.error(error); return; }
    toast(editingId ? "ویرایش شد" : "ذخیره شد", "success");
    
    // ریست فرم و ماندن در صفحه افزودن
    cancelEdit(true);
    document.getElementById('vName').value = '';
    initAddForm([]);
    await loadData();
    
    // باقی ماندن در صفحه افزودن
    showPage('add');
  } catch (err) {
    console.error(err);
    toast("خطای غیرمنتظره", "error");
  } finally {
    setLoading(false);
  }
}

// ====== ویرایش و حذف ======
function startEdit(id) {
  const item = db.find(v => String(v.id) === String(id));
  if (!item) { toast("رکورد پیدا نشد", "error"); return; }
  editingId = item.id;
  document.getElementById('vName').value = item.name || '';
  initAddForm(Array.isArray(item.belts) ? item.belts.map(b => ({ ...b, model: convertModelToUpper(b.model || '') })) : []);
  document.getElementById('editBadge').style.display = 'block';
  document.getElementById('cancelEditBtn').style.display = 'block';
  document.getElementById('saveBtn').innerText = 'ذخیره ویرایش';
  showPage('add');
}

function cancelEdit(silent = false) {
  editingId = null;
  document.getElementById('vName').value = '';
  initAddForm([]);
  document.getElementById('editBadge').style.display = 'none';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('saveBtn').innerText = 'ذخیره اطلاعات';
  if (!silent) toast("ویرایش لغو شد", "info");
}

function askDelete(id) {
  const item = db.find(v => String(v.id) === String(id));
  if (!item) { toast("رکورد پیدا نشد", "error"); return; }
  closeAllModals();
  pendingDeleteId = id;
  document.getElementById('confirmText').innerText = `آیا از حذف "${item.name}" مطمئن هستید؟`;
  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() {
  pendingDeleteId = null;
  document.getElementById('confirmModal').style.display = 'none';
}

document.getElementById('confirmYesBtn').onclick = async function () {
  if (!pendingDeleteId) return;
  if (pendingDeleteId === '__batch__') {
    closeConfirm();
    await executeBatchDelete();
  } else {
    await deleteVehicle(pendingDeleteId);
    closeConfirm();
  }
};

async function deleteVehicle(id) {
  if (busy) return;
  try {
    setLoading(true, "در حال حذف...");
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { toast("کاربر شناسایی نشد", "error"); return; }
    const { error } = await _supabase
      .from('vehicles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast("خطا: " + error.message, "error"); console.error(error); return; }
    if (String(editingId) === String(id)) cancelEdit(true);
    selected = selected.filter(x => String(x) !== String(id));
    await loadData();
    renderSearch();
    toast("حذف شد", "success");
  } catch (err) {
    console.error(err);
    toast("خطای غیرمنتظره", "error");
  } finally {
    setLoading(false);
  }
}

// ====== جستجو ======
function renderSearch() {
  const q = normalizeText(document.getElementById('q')?.value || '');
  const container = document.getElementById('search-results');
  if (!container) return;
  let results = db.filter(v => {
    if (!q) return true;
    const vehicleName = normalizeText(v.name || '');
    const beltsText = (Array.isArray(v.belts) ? v.belts : [])
      .map(b => `${b.cat || ''} ${convertModelToUpper(b.model || '')} ${b.size || ''}`)
      .map(normalizeText).join(' ');
    return vehicleName.includes(q) || beltsText.includes(q);
  });
  results = getSortedResults(results);
  if (results.length === 0) {
    container.innerHTML = `<div class="col-12"><div class="alert alert-light text-center rounded-4 shadow-sm">موردی پیدا نشد</div></div>`;
    return;
  }
  container.innerHTML = results.map(v => `
    <div class="col-12">
      <div class="selectable-card ${selected.includes(String(v.id)) ? 'selected' : ''}">
        <div class="card-header-blue" onclick="this.parentElement.classList.toggle('expanded')">
          <span>${escapeHtml(v.name)}</span>
          <div class="action-btns">
            <button class="small-btn btn-select" onclick="toggleS('${v.id}', event)">انتخاب</button>
            <button class="small-btn btn-edit" onclick="editFromSearch('${v.id}', event)">ویرایش</button>
            <button class="small-btn btn-delete" onclick="deleteFromSearch('${v.id}', event)">حذف</button>
          </div>
        </div>
        <div class="card-body-custom">
          ${(Array.isArray(v.belts) ? v.belts : []).length ? (Array.isArray(v.belts) ? v.belts : []).map(b => `
            <div class="belt-row">
              <span>${escapeHtml(b.cat || '')}</span>
              <span>${escapeHtml(convertModelToUpper(b.model || '-') || '-')}</span>
              <span class="text-primary fw-bold">${escapeHtml(b.size || '')}</span>
            </div>
          `).join('') : `<div class="muted">تسمه‌ای ثبت نشده</div>`}
        </div>
      </div>
    </div>
  `).join('');
}

function getSortedResults(list) {
  const sortType = document.getElementById('sortType')?.value || 'newest';
  const arr = [...list];
  if (sortType === 'oldest') arr.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  else if (sortType === 'name_asc') arr.sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));
  else if (sortType === 'name_desc') arr.sort((a, b) => normalizeText(b.name).localeCompare(normalizeText(a.name)));
  else arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  return arr;
}

function editFromSearch(id, e) { e?.stopPropagation(); startEdit(id); }
function deleteFromSearch(id, e) { e?.stopPropagation(); askDelete(id); }

// ====== انتخاب گروهی ======
function toggleS(id, e) {
  e?.stopPropagation();
  id = String(id);
  selected = selected.map(x => String(x));
  if (selected.includes(id)) selected = selected.filter(i => i !== id);
  else selected.push(id);
  updateBatchMenu();
  renderSearch();
}

function selectAll() {
  const visibleIds = db.map(v => String(v.id));
  if (selected.length === visibleIds.length) {
    selected = [];
  } else {
    selected = visibleIds;
  }
  updateBatchMenu();
  renderSearch();
}

function cancelSelect() {
  selected = [];
  updateBatchMenu();
  renderSearch();
  toast("حالت انتخاب لغو شد", "info");
}

function updateBatchMenu() {
  const batchMenu = document.getElementById('batchMenu');
  const countEl = document.getElementById('count');
  if (batchMenu) batchMenu.classList.toggle('show', selected.length > 0);
  if (countEl) countEl.innerText = selected.length + " مورد";
}

function deleteSelected() {
  if (selected.length === 0) { toast("موردی انتخاب نشده", "warning"); return; }
  closeAllModals();
  pendingDeleteId = '__batch__';
  document.getElementById('confirmText').innerText = `آیا از حذف ${selected.length} مورد انتخاب‌شده مطمئن هستید؟`;
  document.getElementById('confirmModal').style.display = 'flex';
}

async function executeBatchDelete() {
  const ids = [...selected];
  for (const id of ids) {
    await deleteVehicle(id);
  }
  selected = [];
  updateBatchMenu();
  renderSearch();
  toast("حذف گروهی انجام شد", "success");
}

// ====== خروجی Excel ======
function exportExcel() {
  if (db.length === 0) { toast("هیچ داده‌ای برای خروجی وجود ندارد", "warning"); return; }
  const data = [];
  db.forEach(v => {
    const belts = Array.isArray(v.belts) ? v.belts : [];
    if (belts.length === 0) {
      data.push({ خودرو: v.name, دسته: '-', مدل: '-', سایز: '-' });
    } else {
      belts.forEach(b => {
        data.push({
          خودرو: v.name,
          دسته: b.cat || '-',
          مدل: convertModelToUpper(b.model || '-'),
          سایز: b.size || '-'
        });
      });
    }
  });
  const summary = [
    { خودرو: '--- خلاصه آماری ---', دسته: '', مدل: '', سایز: '' },
    { خودرو: `تعداد خودروها: ${db.length}`, دسته: '', مدل: '', سایز: '' },
    { خودرو: `تعداد تسمه‌ها: ${data.filter(d => d.سایز !== '-').length}`, دسته: '', مدل: '', سایز: '' }
  ];
  const finalData = [...summary, ...data];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(finalData);
  XLSX.utils.book_append_sheet(wb, ws, "تسمه‌ها");
  XLSX.writeFile(wb, `tsameh-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast("خروجی Excel دانلود شد", "success");
}

// ====== بکاپ و بازیابی ======
function backupData() {
  if (db.length === 0) { toast("هیچ داده‌ای برای بکاپ وجود ندارد", "warning"); return; }
  const backup = {
    version: '2.0',
    date: new Date().toISOString(),
    count: db.length,
    data: db
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tsameh-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast("بکاپ با موفقیت دانلود شد", "success");
}

async function restoreData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setLoading(true, "در حال بازیابی...");
    const text = await file.text();
    const backup = JSON.parse(text);
    if (!backup.data || !Array.isArray(backup.data)) {
      toast("فایل بکاپ معتبر نیست", "error");
      return;
    }
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) { toast("کاربر شناسایی نشد", "error"); return; }
    const { error: delError } = await _supabase
      .from('vehicles')
      .delete()
      .eq('user_id', user.id);
    if (delError) { toast("خطا در پاکسازی داده‌ها", "error"); console.error(delError); return; }
    for (const item of backup.data) {
      const { error: insError } = await _supabase
        .from('vehicles')
        .insert([{
          user_id: user.id,
          car_name: item.name || '',
          belt_data: Array.isArray(item.belts) ? item.belts : []
        }]);
      if (insError) { console.error(insError); }
    }
    await loadData();
    toast(`بازیابی ${backup.data.length} رکورد با موفقیت انجام شد`, "success");
  } catch (err) {
    console.error(err);
    toast("خطا در بازیابی فایل", "error");
  } finally {
    setLoading(false);
    event.target.value = '';
  }
}

// ====== اشتراک‌گذاری تصویری ======
function openCardStyleModal() {
  if (selected.length === 0) { toast("موردی انتخاب نشده", "warning"); return; }
  closeAllModals();
  document.getElementById('cardStyleModal').style.display = 'flex';
}

function closeCardStyleModal() {
  document.getElementById('cardStyleModal').style.display = 'none';
}

function selectCardStyle(style) {
  selectedCardStyle = style;
  closeCardStyleModal();
  shareCardImage();
}

async function createCardElement(selectedItems) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: -9999px;
    left: 0;
    width: 600px;
    padding: 20px;
    background: #fff;
    z-index: 9999;
    font-family: 'Vazirmatn', sans-serif;
    direction: rtl;
  `;
  
  let cardClass = 'card-style-glass';
  if (selectedCardStyle === 'classic') cardClass = 'card-style-classic';
  else if (selectedCardStyle === 'dark') cardClass = 'card-style-dark';
  else if (selectedCardStyle === 'colorful') cardClass = 'card-style-colorful';
  
  let html = `<div class="${cardClass}" style="padding:20px;">`;
  html += `<h4 style="margin-bottom:12px;">🚗 تسمه یاب - BeltFind</h4>`;
  html += `<div style="font-size:13px;color:#64748b;margin-bottom:16px;">${new Date().toLocaleDateString('fa-IR')}</div>`;
  
  selectedItems.forEach((v, idx) => {
    html += `<div style="border-bottom:1px dashed #e2e8f0;padding:10px 0;">`;
    html += `<div style="font-weight:700;font-size:16px;margin-bottom:6px;">${idx+1}. ${escapeHtml(v.name)}</div>`;
    const belts = Array.isArray(v.belts) ? v.belts : [];
    if (belts.length === 0) {
      html += `<div style="color:#94a3b8;">بدون تسمه</div>`;
    } else {
      belts.forEach(b => {
        html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;">`;
        html += `<span>${escapeHtml(b.cat || '-')}</span>`;
        html += `<span><strong>مدل:</strong> ${escapeHtml(convertModelToUpper(b.model || '-'))} | <strong>شماره:</strong> ${escapeHtml(b.size || '-')}</span>`;
        html += `</div>`;
      });
    }
    html += `</div>`;
  });
  
  html += `<div style="margin-top:16px;font-size:12px;color:#94a3b8;text-align:center;">تولید شده با تسمه یاب - BeltFind</div>`;
  html += `</div>`;
  
  container.innerHTML = html;
  return container;
}

async function shareCardImage() {
  const selectedItems = db.filter(v => selected.includes(String(v.id)));
  if (selectedItems.length === 0) {
    toast("موردی انتخاب نشده", "warning");
    return;
  }

  setLoading(true, "در حال آماده‌سازی تصویر...");
  
  try {
    const cardContainer = await createCardElement(selectedItems);
    document.body.appendChild(cardContainer);
    
    const canvas = await html2canvas(cardContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 600,
      height: cardContainer.scrollHeight
    });
    
    document.body.removeChild(cardContainer);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], `tsameh-${Date.now()}.png`, { type: 'image/png' });
      try {
        await navigator.share({
          title: 'تسمه یاب - BeltFind',
          text: 'اطلاعات تسمه‌های انتخاب شده',
          files: [file]
        });
        toast("اشتراک‌گذاری انجام شد", "success");
        cancelSelect();
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          downloadImage(canvas);
        }
      }
    } else {
      downloadImage(canvas);
    }
  } catch (err) {
    console.error(err);
    toast("خطا در ساخت تصویر", "error");
  } finally {
    setLoading(false);
  }
}

function downloadImage(canvas) {
  const link = document.createElement('a');
  link.download = `tsameh-share-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast("تصویر دانلود شد", "info");
}

// ====== اشتراک متنی ======
function shareAsText() {
  const msg = buildExportText();
  if (!msg) { toast("موردی انتخاب نشده", "warning"); return; }
  if (navigator.share) {
    navigator.share({ text: msg }).then(() => { toast("اشتراک شد", "success"); cancelSelect(); }).catch(console.error);
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(msg).then(() => { toast("کپی شد", "success"); cancelSelect(); }).catch(() => alert(msg));
  } else {
    alert(msg);
  }
}

function buildExportText() {
  selected = selected.map(x => String(x));
  const selectedItems = db.filter(v => selected.includes(String(v.id)));
  if (selectedItems.length === 0) return '';
  return selectedItems.map((v, index) => {
    const lines = [`🚗 خودرو ${index+1}: ${v.name}`, '────────────────────'];
    const belts = Array.isArray(v.belts) ? v.belts : [];
    if (!belts.length) lines.push('بدون اطلاعات تسمه');
    else belts.forEach((b, i) => lines.push(`${i+1}) ${b.cat || '-'} | مدل: ${convertModelToUpper(b.model || '-')} | سایز: ${b.size || '-'}`));
    return lines.join('\n');
  }).join('\n\n');
}

// ====== آمار ======
function updateStats() {
  document.getElementById('total-v-count').innerText = db.length;
  document.getElementById('total-b-count').innerText = db.reduce((sum, item) => sum + (Array.isArray(item.belts) ? item.belts.length : 0), 0);
}

// ====== توابع کمکی ======
function convertModelToUpper(model) {
  if (!model) return '';
  const m = String(model).trim();
  if (m === 'PK-1380') return 'شیاری';
  if (m === 'شیاری') return 'شیاری';
  return m.toUpperCase();
}

function normalizeText(text) {
  return String(text || '').trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ');
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeAttr(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

console.log("🚀 تسمه یاب - BeltFind بارگذاری شد");