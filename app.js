/* Spendwise — income, expenses, analytics and local backups */
(() => {
  'use strict';

  // Keep this key unchanged to read your existing expenses.
  const STORAGE_KEY = 'daily-expenses-v1';
  const SNAPSHOT_KEY = 'daily-expenses-safety-snapshot-v1';
  const CURRENCY_KEY = 'daily-expenses-currency-v1';
  const $ = id => document.getElementById(id);

  let expenses = [];
  let editingId = null;
  let activeType = 'expense';
  let toastTimer;

  const expenseCategories = ['Food','Travel','Shopping','Bills','Health','Education','Entertainment','Rent','Other'];
  const incomeCategories = ['Salary','Freelance','Business','Investment','Gift','Refund','Other'];
  const icons = {Food:'🍜',Travel:'🚌',Shopping:'🛍️',Bills:'🧾',Health:'💊',Education:'📚',Entertainment:'🎬',Rent:'🏠',Salary:'💼',Freelance:'💻',Business:'🏢',Investment:'📈',Gift:'🎁',Refund:'↩️',Other:'📝'};

  function localDate(date = new Date()) {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0,10);
  }
  function monthNow() { return localDate().slice(0,7); }
  function currency() { return $('currency').value; }
  function money(value) {
    return currency() + Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2});
  }
  function sum(items) { return items.reduce((total,item) => total + Number(item.amount || 0),0); }
  function isIncome(item) { return item.type === 'income'; }
  function monthItems() { return expenses.filter(e => e.date.startsWith(monthNow())); }
  function todayItems() { return expenses.filter(e => e.date === localDate()); }
  function formatDate(date) {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'),2500);
  }

  function validExpense(item) {
    return item && typeof item === 'object' &&
      Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) &&
      item.id !== undefined && item.id !== null;
  }
  function normalizeExpense(item) {
    return {
      id:String(item.id),
      type:item.type === 'income' ? 'income' : 'expense',
      amount:Number(item.amount),
      category:String(item.category || 'Other'),
      note:String(item.note || ''),
      date:String(item.date),
      created:Number(item.created || Date.now())
    };
  }
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Stored data is not an array.');
      return parsed.filter(validExpense).map(normalizeExpense);
    } catch (error) {
      console.error('Could not load stored transactions:',error);
      alert('Your saved transactions could not be read. Do not clear browser storage. Export or inspect your original browser data before continuing.');
      return [];
    }
  }

  function snapshotCurrent() {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current !== null) {
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({savedAt:new Date().toISOString(),data:JSON.parse(current)}));
    }
  }
  function persist() {
    try {
      snapshotCurrent();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(expenses));
      renderAll();
    } catch (error) {
      console.error(error);
      alert('Could not save your data. Export a backup and check browser storage availability.');
    }
  }

  function renderExpenses(targetId,items,emptyText='No transactions yet.') {
    const target = $(targetId);
    if (!items.length) {
      target.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    target.innerHTML = items.map(item => {
      const income = isIncome(item);
      return `<div class="transaction">
        <div class="transaction-icon">${icons[item.category] || '📝'}</div>
        <div class="transaction-details">
          <strong>${escapeHtml(item.note || item.category)}</strong>
          <small>${escapeHtml(item.category)} · ${formatDate(item.date)} · ${income?'Income':'Expense'}</small>
        </div>
        <div class="transaction-right">
          <strong class="${income?'green':'red'}">${income?'+':'−'}${money(item.amount)}</strong>
          <div class="transaction-actions">
            <button class="tiny" data-edit="${escapeHtml(item.id)}">Edit</button>
            <button class="tiny delete" data-delete="${escapeHtml(item.id)}">Delete</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function renderWeeklyChart() {
    const days = [];
    for (let i=6;i>=0;i--) {
      const date = new Date();
      date.setDate(date.getDate()-i);
      const key = localDate(date);
      const total = sum(expenses.filter(e => e.date===key && !isIncome(e)));
      days.push({label:date.toLocaleDateString('en-IN',{weekday:'short'}),total});
    }
    const max = Math.max(...days.map(d=>d.total),1);
    $('weeklyChart').innerHTML = days.map(day => {
      const height = day.total ? Math.max(5,day.total/max*100) : 2;
      return `<div class="bar-col"><div class="bar-value">${day.total?escapeHtml(money(day.total)):''}</div><div class="bar" style="height:${height}%"></div><div class="bar-label">${day.label}</div></div>`;
    }).join('');
  }

  function renderCategoryList(targetId,items) {
    const totals = {};
    items.forEach(item => totals[item.category]=(totals[item.category]||0)+item.amount);
    const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
    const total = sum(items);
    if (!sorted.length) {
      $(targetId).innerHTML = '<div class="empty">No category data available.</div>';
      return;
    }
    $(targetId).innerHTML = sorted.map(([category,amount]) => {
      const percent = total ? amount/total*100 : 0;
      return `<div class="category-row">
        <div class="category-icon">${icons[category]||'📝'}</div>
        <div><div class="category-name">${escapeHtml(category)}</div><div class="track"><div class="fill" style="width:${percent}%"></div></div></div>
        <div class="category-amount">${money(amount)}</div>
      </div>`;
    }).join('');
  }

  function renderDashboard() {
    const items = monthItems();
    const incomes = items.filter(isIncome);
    const outgoings = items.filter(e=>!isIncome(e));
    const income = sum(incomes), expense = sum(outgoings), balance = income-expense;
    $('balanceTotal').textContent = (balance<0?'−':'')+money(Math.abs(balance));
    $('incomeTotal').textContent = money(income);
    $('expenseTotal').textContent = money(expense);
    $('savingsRate').textContent = (income?Math.round(balance/income*100):0)+'%';
    $('incomeNote').textContent = `${incomes.length} income entries`;
    $('expenseNote').textContent = `${outgoings.length} expense entries`;
    const today = todayItems();
    $('todayIncome').textContent = money(sum(today.filter(isIncome)));
    $('todayExpense').textContent = money(sum(today.filter(e=>!isIncome(e))));
    $('sideIncome').textContent = money(income);
    $('sideExpense').textContent = money(expense);
    renderWeeklyChart();
    renderCategoryList('topCategories',outgoings);
    const recent = [...expenses].sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created).slice(0,6);
    renderExpenses('recentList',recent);
  }

  function populateCategoryFilters() {
    const categories = [...new Set([...expenseCategories,...incomeCategories,...expenses.map(e=>e.category)])].sort();
    const selected = $('filterCategory').value;
    $('filterCategory').innerHTML = '<option value="">All categories</option>' + categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (categories.includes(selected)) $('filterCategory').value = selected;
  }

  function renderTransactions() {
    const query = $('search').value.trim().toLowerCase();
    const month = $('filterMonth').value;
    const category = $('filterCategory').value;
    const type = $('filterType').value;
    const sort = $('sortOrder').value;
    const shown = expenses.filter(item => {
      const searchMatch = !query || `${item.note} ${item.category} ${item.type}`.toLowerCase().includes(query);
      return searchMatch && (!month||item.date.startsWith(month)) && (!category||item.category===category) &&
        (!type||(type==='income'?isIncome(item):!isIncome(item)));
    });
    shown.sort((a,b) => sort==='oldest' ? a.date.localeCompare(b.date) : sort==='high' ? b.amount-a.amount : sort==='low' ? a.amount-b.amount : b.date.localeCompare(a.date)||b.created-a.created);
    $('resultCount').textContent = `${shown.length} of ${expenses.length} transactions`;
    renderExpenses('transactionList',shown,'No matching transactions.');
  }

  function renderAnalytics() {
    const month = $('analyticsMonth').value || monthNow();
    const items = expenses.filter(e=>e.date.startsWith(month));
    const income = sum(items.filter(isIncome)), expense = sum(items.filter(e=>!isIncome(e))), net = income-expense;
    $('analyticsIncome').textContent = money(income);
    $('analyticsExpense').textContent = money(expense);
    $('analyticsNet').textContent = (net<0?'−':'')+money(Math.abs(net));
    $('analyticsRate').textContent = (income?Math.round(net/income*100):0)+'%';
    renderCategoryList('analyticsCategories',items.filter(e=>!isIncome(e)));
    const byDay = {};
    items.forEach(item => {
      byDay[item.date] ||= {income:0,expense:0};
      byDay[item.date][isIncome(item)?'income':'expense'] += item.amount;
    });
    const days = Object.entries(byDay).sort((a,b)=>b[0].localeCompare(a[0]));
    $('dailyBreakdown').innerHTML = days.length ? days.map(([date,v]) => {
      const netDay = v.income-v.expense;
      return `<div class="insight"><div><strong>${formatDate(date)}</strong><small><span class="green">+${money(v.income)}</span> · <span class="red">−${money(v.expense)}</span></small></div><strong class="${netDay>=0?'green':'red'}">${netDay>=0?'+':'−'}${money(Math.abs(netDay))}</strong></div>`;
    }).join('') : '<div class="empty">No transactions for this month.</div>';
  }

  function setType(type) {
    activeType = type;
    document.querySelectorAll('.type-option').forEach(button=>button.classList.toggle('active',button.dataset.type===type));
    const categories = type==='income'?incomeCategories:expenseCategories;
    const previous = $('category').value;
    $('category').innerHTML = categories.map(c=>`<option>${c}</option>`).join('');
    if (categories.includes(previous)) $('category').value = previous;
    $('formTitle').textContent = editingId?'Edit transaction':type==='income'?'Add income':'Add expense';
    $('formSubtitle').textContent = type==='income'?'Record money received':'Record money spent';
    $('saveBtn').textContent = type==='income'?'＋ Add income':'− Add expense';
  }
  function resetForm() {
    editingId = null;
    $('transactionForm').reset();
    $('date').value = localDate();
    setType('expense');
    $('cancelBtn').classList.add('hidden');
  }
  function switchView(name) {
    document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id===name));
    document.querySelectorAll('.tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.view===name));
    if (name==='analytics') renderAnalytics();
    if (name==='transactions') renderTransactions();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function editTransaction(id) {
    const item = expenses.find(e=>e.id===id);
    if (!item) return;
    editingId = item.id;
    setType(isIncome(item)?'income':'expense');
    $('amount').value = item.amount;
    $('category').value = item.category;
    $('note').value = item.note;
    $('date').value = item.date;
    $('formTitle').textContent = 'Edit transaction';
    $('saveBtn').textContent = 'Save changes';
    $('cancelBtn').classList.remove('hidden');
    switchView('transactions');
    $('amount').focus();
  }
  function deleteTransaction(id) {
    const item = expenses.find(e=>e.id===id);
    if (!item || !confirm(`Delete ${item.note||item.category} (${money(item.amount)})?`)) return;
    expenses = expenses.filter(e=>e.id!==id);
    if (editingId===id) resetForm();
    persist();
    notify('Transaction deleted.');
  }
  function handleTransactionClick(event) {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) editTransaction(edit.dataset.edit);
    if (del) deleteTransaction(del.dataset.delete);
  }

  function downloadFile(filename,content,type) {
    const blob = new Blob([content],{type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportJSON() {
    const payload = {app:'Spendwise',formatVersion:1,storageKey:STORAGE_KEY,exportedAt:new Date().toISOString(),expenses};
    downloadFile(`spendwise-backup-${localDate()}.json`,JSON.stringify(payload,null,2),'application/json');
    notify('JSON backup downloaded.');
  }
  function csvCell(value) { return '"'+String(value??'').replace(/"/g,'""')+'"'; }
  function exportCSV() {
    const rows = [['id','type','date','amount','currency','category','note','created'],...expenses.map(e=>[e.id,e.type||'expense',e.date,e.amount,currency(),e.category,e.note,e.created])];
    downloadFile(`spendwise-transactions-${localDate()}.csv`,rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    notify('CSV exported.');
  }
  function importJSONFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed)?parsed:parsed.expenses;
        if (!Array.isArray(incoming)) throw new Error('No transaction list found.');
        const valid = incoming.filter(validExpense).map(normalizeExpense);
        if (!valid.length) throw new Error('No valid transactions found.');
        const ids = new Set(expenses.map(e=>e.id));
        const unique = valid.filter(e=>!ids.has(e.id));
        if (!unique.length) { notify('No new records. Existing IDs already match.'); return; }
        if (!confirm(`Found ${unique.length} new records. Merge them with your ${expenses.length} existing transactions?`)) return;
        expenses = [...expenses,...unique];
        persist();
        notify(`${unique.length} transactions imported.`);
      } catch(error) { alert('Import failed: '+error.message); }
      finally { $('importFile').value=''; }
    };
    reader.onerror = () => notify('Could not read the selected file.');
    reader.readAsText(file);
  }
  function restoreSnapshot() {
    let snapshot;
    try { snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null'); } catch { snapshot=null; }
    if (!snapshot || !Array.isArray(snapshot.data)) { notify('No usable snapshot found.'); return; }
    if (!confirm('Restore the previous snapshot? Your current data will first be saved as a safety snapshot.')) return;
    try {
      snapshotCurrent();
      expenses = snapshot.data.filter(validExpense).map(normalizeExpense);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(expenses));
      resetForm();
      renderAll();
      notify('Previous snapshot restored.');
    } catch(error) { alert('Restore failed: '+error.message); }
  }
  function renderBackupStatus() {
    $('backupCount').textContent = `${expenses.length} transactions`;
    let hasSnapshot = false;
    try { hasSnapshot = !!localStorage.getItem(SNAPSHOT_KEY); } catch {}
    $('snapshotState').textContent = hasSnapshot?'Available':'Not created yet';
    $('snapshotStatus').textContent = hasSnapshot?'A previous version of your data is available.':'A snapshot will be created before your next save.';
    $('restoreSnapshot').disabled = !hasSnapshot;
  }
  function renderAll() {
    populateCategoryFilters();
    renderDashboard();
    renderTransactions();
    renderAnalytics();
    renderBackupStatus();
  }

  function init() {
    expenses = loadData();
    try {
      const savedCurrency = localStorage.getItem(CURRENCY_KEY);
      if (['₹','$','€','£'].includes(savedCurrency)) $('currency').value=savedCurrency;
    } catch {}
    $('date').value = localDate();
    $('filterMonth').value = monthNow();
    $('analyticsMonth').value = monthNow();
    setType('expense');
    renderAll();

    $('transactionForm').addEventListener('submit',event=>{
      event.preventDefault();
      const amount = Number($('amount').value), date = $('date').value;
      if (!Number.isFinite(amount)||amount<=0||!date) { notify('Enter a valid amount and date.'); return; }
      const existing = expenses.find(e=>e.id===editingId);
      const item = {id:editingId||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,type:activeType,amount,category:$('category').value,note:$('note').value.trim(),date,created:existing?.created||Date.now()};
      const wasEditing = Boolean(editingId);
      if (editingId) expenses=expenses.map(e=>e.id===editingId?item:e); else expenses.push(item);
      persist(); resetForm();
      notify(wasEditing?'Transaction updated.':`${activeType==='income'?'Income':'Expense'} added.`);
    });
    $('transactionList').addEventListener('click',handleTransactionClick);
    $('recentList').addEventListener('click',handleTransactionClick);
    $('cancelBtn').addEventListener('click',resetForm);
    document.querySelectorAll('.type-option').forEach(button=>button.addEventListener('click',()=>setType(button.dataset.type)));
    document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>switchView(tab.dataset.view)));
    document.querySelectorAll('[data-goto]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.goto)));
    ['search','filterMonth','filterType','filterCategory','sortOrder'].forEach(id=>$ (id).addEventListener(id==='search'?'input':'change',renderTransactions));
    $('analyticsMonth').addEventListener('change',renderAnalytics);
    $('currency').addEventListener('change',()=>{
      try { localStorage.setItem(CURRENCY_KEY,currency()); } catch {}
      renderAll();
    });
    $('quickExport').addEventListener('click',exportJSON);
    $('exportJson').addEventListener('click',exportJSON);
    $('exportCsv').addEventListener('click',exportCSV);
    $('importButton').addEventListener('click',()=>$('importFile').click());
    $('importFile').addEventListener('change',event=>importJSONFile(event.target.files[0]));
    $('restoreSnapshot').addEventListener('click',restoreSnapshot);
  }

  init();
})();
