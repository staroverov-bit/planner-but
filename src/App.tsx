// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, PiggyBank, Calendar, ChevronLeft, ChevronRight, Check, X, ChevronDown, LayoutDashboard, Settings, Trash2, Edit2, History, Save, RotateCcw, Download, Eye, EyeOff, Share2, Wallet } from 'lucide-react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Месяцы
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const shortMonthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const quarterNames = ['1 Квартал', '2 Квартал', '3 Квартал', '4 Квартал'];

// Сырые стартовые данные
const rawBudgetItems = [
  { id: 101, type: 'income', group: 'Основные поступления', name: 'Остаток с предыдущего периода', planYear: 1000000, fact: [1000000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 102, type: 'income', group: 'Основные поступления', name: 'Продажи с сайта', planYear: 5000000, fact: [250000, 300000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 103, type: 'income', group: 'Маркетинговые услуги', name: 'РЭС Инжиниринг', planYear: 2000000, fact: [150000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 1, type: 'expense', group: 'ФОТ + налоги на ФОТ', name: 'Заработная плата', planYear: 12000000, fact: [1000000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 6, type: 'expense', group: 'Общие', name: 'Закупка материалов', planYear: 3750000, fact: [300000, 150000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 10, type: 'expense', group: 'Общие', name: 'Реклама', planYear: 1800000, fact: [100000, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
];

const initialBudgetItems = rawBudgetItems.map(item => {
  let plan26 = Array(12).fill(0);
  if (item.name === 'Остаток с предыдущего периода') {
    plan26[0] = item.planYear;
  } else {
    const monthly = Math.round(item.planYear / 12);
    plan26 = Array(12).fill(monthly);
    plan26[11] = item.planYear - (monthly * 11);
  }
  const transactions = [];
  const fact26 = item.fact || Array(12).fill(0);
  fact26.forEach((val, idx) => {
    if (val !== 0) {
      transactions.push({
        id: Math.random().toString(),
        year: 2026, month: idx, amount: val, comment: 'Начальный факт', date: ''
      });
    }
  });
  return {
    id: item.id, type: item.type, group: item.group, name: item.name,
    plan: { 2025: Array(12).fill(0), 2026: plan26, 2027: Array(12).fill(0) },
    fact: { 2025: Array(12).fill(0), 2026: fact26, 2027: Array(12).fill(0) },
    transactions
  };
});

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const getValueForPeriod = (yearlyData, year, period, monthIdx, quarterIdx) => {
  const arr = yearlyData[year] || Array(12).fill(0);
  if (period === 'month') return arr[monthIdx] || 0;
  if (period === 'quarter') {
    const start = quarterIdx * 3;
    return (arr[start] || 0) + (arr[start + 1] || 0) + (arr[start + 2] || 0);
  }
  return arr.reduce((sum, val) => sum + (val || 0), 0);
};

// --- ОСНОВНОЕ ПРИЛОЖЕНИЕ ---
function App({ isSystemGuest }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [isGuestMode, setIsGuestMode] = useState(isSystemGuest || false);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState(2026);
  const [period, setPeriod] = useState('month'); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); 
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3)); 
  
  const [expenseInputs, setExpenseInputs] = useState({});
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxData, setEditTxData] = useState({ date: '', comment: '' });
  const [newItemType, setNewItemType] = useState('expense');
  const [newItemName, setNewItemName] = useState('');
  const [newItemGroup, setNewItemGroup] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [sensitiveGroups, setSensitiveGroups] = useState(['ФОТ + налоги на ФОТ']);
  const [sensitiveItems, setSensitiveItems] = useState(['Аутсорс бухгалтерия']);
  const [isGuestSettingsOpen, setIsGuestSettingsOpen] = useState(false);

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  const [backups, setBackups] = useState([]);
  const [backupComment, setBackupComment] = useState('');
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);
  const [confirmDeleteBackupId, setConfirmDeleteBackupId] = useState(null);

  // --- ЗАГРУЗКА ИЗ FIREBASE ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'budgetItems'), (snapshot) => {
      if (snapshot.empty) {
        if (!isSystemGuest) {
          const batch = writeBatch(db);
          initialBudgetItems.forEach(item => {
            const docRef = doc(db, 'budgetItems', item.id.toString());
            batch.set(docRef, item);
          });
          batch.commit();
        }
      } else {
        const dbItems = snapshot.docs.map(d => d.data());
        dbItems.sort((a, b) => a.id - b.id);
        setItems(dbItems);
        setIsDbLoaded(true);
      }
    });

    getDoc(doc(db, 'system', 'backups')).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setBackups(data.list || []);
        if (data.sensitiveGroups) setSensitiveGroups(data.sensitiveGroups);
        if (data.sensitiveItems) setSensitiveItems(data.sensitiveItems);
      }
    });

    return () => unsub();
  }, [isSystemGuest]);

  // --- ЕДИНАЯ ФУНКЦИЯ СОХРАНЕНИЯ ---
  const updateData = async (newItems, newBackups = backups, newSensGroups = sensitiveGroups, newSensItems = sensitiveItems) => {
    if (isSystemGuest) return; 
    
    setItems(newItems);
    setBackups(newBackups);
    setSensitiveGroups(newSensGroups);
    setSensitiveItems(newSensItems);
    
    try {
      const batch = writeBatch(db);
      newItems.forEach(item => {
        const docRef = doc(db, 'budgetItems', item.id.toString());
        batch.set(docRef, item);
      });
      
      const systemRef = doc(db, 'system', 'backups');
      batch.set(systemRef, { 
        list: newBackups,
        sensitiveGroups: newSensGroups,
        sensitiveItems: newSensItems
      }, { merge: true });
      
      await batch.commit();
    } catch (error) {
      console.error("Ошибка сохранения в базу:", error);
    }
  };

  const toggleGuestMode = () => {
    if (isSystemGuest) return;
    const nextMode = !isGuestMode;
    setIsGuestMode(nextMode);
    if (nextMode) setActiveTab('dashboard');
  };

  const toggleGroup = (groupName) => setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  const toggleItem = (itemId) => setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));

  const handlePeriodChange = (newPeriod) => {
    if (period === 'month' && newPeriod === 'quarter') setSelectedQuarter(Math.floor(selectedMonth / 3));
    else if (period === 'quarter' && newPeriod === 'month') setSelectedMonth(selectedQuarter * 3);
    setPeriod(newPeriod);
  };

  const handlePrevSubPeriod = () => {
    if (period === 'month') setSelectedMonth(prev => (prev > 0 ? prev - 1 : 11));
    if (period === 'quarter') setSelectedQuarter(prev => (prev > 0 ? prev - 1 : 3));
  };

  const handleNextSubPeriod = () => {
    if (period === 'month') setSelectedMonth(prev => (prev < 11 ? prev + 1 : 0));
    if (period === 'quarter') setSelectedQuarter(prev => (prev < 3 ? prev + 1 : 0));
  };

  const displayItems = useMemo(() => {
    if (!isGuestMode) return items;
    return items.filter(item => !sensitiveGroups.includes(item.group) && !sensitiveItems.includes(item.name));
  }, [items, isGuestMode, sensitiveGroups, sensitiveItems]);

  const { incomePlan, incomeFact, expensePlan, expenseFact } = useMemo(() => {
    if (!displayItems.length) return { incomePlan: 0, incomeFact: 0, expensePlan: 0, expenseFact: 0 };
    return displayItems.reduce((acc, item) => {
      const currentPlan = getValueForPeriod(item.plan, selectedYear, period, selectedMonth, selectedQuarter);
      const currentFact = getValueForPeriod(item.fact, selectedYear, period, selectedMonth, selectedQuarter);
      if (item.type === 'income') {
        acc.incomePlan += currentPlan;
        acc.incomeFact += currentFact;
      } else {
        acc.expensePlan += currentPlan;
        acc.expenseFact += currentFact;
      }
      return acc;
    }, { incomePlan: 0, incomeFact: 0, expensePlan: 0, expenseFact: 0 });
  }, [displayItems, selectedYear, period, selectedMonth, selectedQuarter]);

  const balancePlan = incomePlan - expensePlan;
  const balanceFact = incomeFact - expenseFact;

  // Накопленный общий остаток
  const { cumulativePlan, cumulativeFact } = useMemo(() => {
    let cPlan = 0;
    let cFact = 0;

    let targetMonthIndex = 11;
    if (period === 'month') targetMonthIndex = selectedMonth;
    else if (period === 'quarter') targetMonthIndex = selectedQuarter * 3 + 2;

    displayItems.forEach(item => {
      Object.keys(item.plan).forEach(yearStr => {
        const y = parseInt(yearStr, 10);
        if (y < selectedYear) {
          for (let m = 0; m < 12; m++) {
            if (item.type === 'income') {
              cPlan += item.plan[y][m] || 0;
              cFact += item.fact[y][m] || 0;
            } else {
              cPlan -= item.plan[y][m] || 0;
              cFact -= item.fact[y][m] || 0;
            }
          }
        } else if (y === selectedYear) {
          for (let m = 0; m <= targetMonthIndex; m++) {
            if (item.type === 'income') {
              cPlan += item.plan[y][m] || 0;
              cFact += item.fact[y][m] || 0;
            } else {
              cPlan -= item.plan[y][m] || 0;
              cFact -= item.fact[y][m] || 0;
            }
          }
        }
      });
    });

    return { cumulativePlan: cPlan, cumulativeFact: cFact };
  }, [displayItems, selectedYear, period, selectedMonth, selectedQuarter]);

  const groupItemsByType = (type) => {
    const filtered = displayItems.filter(i => i.type === type);
    const groupsMap = {};
    filtered.forEach(item => {
      const gName = item.group || 'Без группы';
      if (!groupsMap[gName]) groupsMap[gName] = { name: gName, items: [], plan: {}, fact: {} };
      groupsMap[gName].items.push(item);
      Object.keys(item.plan).forEach(y => {
        if (!groupsMap[gName].plan[y]) groupsMap[gName].plan[y] = Array(12).fill(0);
        item.plan[y].forEach((v, idx) => { groupsMap[gName].plan[y][idx] += v; });
      });
      Object.keys(item.fact).forEach(y => {
        if (!groupsMap[gName].fact[y]) groupsMap[gName].fact[y] = Array(12).fill(0);
        item.fact[y].forEach((v, idx) => { groupsMap[gName].fact[y][idx] += v; });
      });
    });
    return Object.values(groupsMap).sort((a, b) => a.name.localeCompare(b.name));
  };

  const groupedIncomes = useMemo(() => groupItemsByType('income'), [displayItems]);
  const groupedExpenses = useMemo(() => groupItemsByType('expense'), [displayItems]);

  const handleExpenseInputChange = (id, field, value) => {
    if (isGuestMode) return;
    setExpenseInputs(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleAddFact = (id) => {
    if (isGuestMode) return;
    const inputData = expenseInputs[id] || {};
    const amountToAdd = parseFloat(inputData.amount);
    if (isNaN(amountToAdd) || amountToAdd === 0) return;

    let targetMonthIndex = period === 'month' ? selectedMonth : period === 'quarter' ? (inputData.month !== undefined ? parseInt(inputData.month) : selectedQuarter * 3) : (inputData.month !== undefined ? parseInt(inputData.month) : 0);

    const newTx = {
      id: Date.now().toString(), year: selectedYear, month: targetMonthIndex, amount: amountToAdd,
      comment: inputData.comment || '', date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    };

    const newItems = items.map(item => {
      if (item.id === id) {
        const newFactYearly = { ...item.fact };
        if (!newFactYearly[selectedYear]) newFactYearly[selectedYear] = Array(12).fill(0);
        const newFactArr = [...newFactYearly[selectedYear]];
        newFactArr[targetMonthIndex] += amountToAdd;
        newFactYearly[selectedYear] = newFactArr;
        return { ...item, fact: newFactYearly, transactions: [...item.transactions, newTx] };
      }
      return item;
    });
    
    updateData(newItems);
    setExpenseInputs(prev => ({ ...prev, [id]: { ...prev[id], amount: '', comment: '' } }));
    setExpandedItems(prev => ({ ...prev, [id]: true }));
  };

  const handleDeleteTransaction = (itemId, txId) => {
    if (isGuestMode) return;
    const newItems = items.map(item => {
      if (item.id === itemId) {
        const tx = item.transactions.find(t => t.id === txId);
        if (!tx) return item;
        const newFactYearly = { ...item.fact };
        const newFactArr = [...newFactYearly[tx.year]];
        newFactArr[tx.month] -= tx.amount;
        newFactYearly[tx.year] = newFactArr;
        return { ...item, fact: newFactYearly, transactions: item.transactions.filter(t => t.id !== txId) };
      }
      return item;
    });
    updateData(newItems);
  };

  const startEditingTx = (tx) => {
    if (isGuestMode) return;
    setEditingTxId(tx.id);
    setEditTxData({ date: tx.date || shortMonthNames[tx.month], comment: tx.comment || '' });
  };

  const saveEditingTx = (itemId, txId) => {
    const newItems = items.map(item => {
      if (item.id === itemId) {
        const updatedTxs = item.transactions.map(t =>
          t.id === txId ? { ...t, date: editTxData.date, comment: editTxData.comment } : t
        );
        return { ...item, transactions: updatedTxs };
      }
      return item;
    });
    updateData(newItems);
    setEditingTxId(null);
  };

  const cancelEditingTx = () => setEditingTxId(null);

  const handleDirectFactUpdate = (id, value) => {
    if (isGuestMode) return;
    const numValue = parseFloat(value) || 0;
    const newItems = items.map(item => {
      if (item.id === id) {
        const newFactYearly = { ...item.fact };
        if (!newFactYearly[selectedYear]) newFactYearly[selectedYear] = Array(12).fill(0);
        const newFactArr = [...newFactYearly[selectedYear]];
        newFactArr[selectedMonth] = numValue;
        newFactYearly[selectedYear] = newFactArr;
        return { ...item, fact: newFactYearly };
      }
      return item;
    });
    updateData(newItems);
  };

  const handleFactBlur = (id, value) => {
    if (isGuestMode) return;
    const numValue = parseFloat(value) || 0;
    let isChanged = false;
    const newItems = items.map(item => {
      if (item.id === id) {
         const sumOfTxs = item.transactions.filter(t => t.year === selectedYear && t.month === selectedMonth).reduce((acc, t) => acc + t.amount, 0);
         const diff = numValue - sumOfTxs;
         if (diff !== 0) {
             isChanged = true;
             const newTx = {
                 id: Date.now().toString() + Math.random(),
                 year: selectedYear, month: selectedMonth, amount: diff,
                 comment: 'Ручная корректировка', date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
             };
             return { ...item, transactions: [...item.transactions, newTx] };
         }
      }
      return item;
    });
    if (isChanged) updateData(newItems);
  };

  const handleAdminAddItem = (e) => {
    e.preventDefault();
    if (!newItemName || !newItemGroup) return;
    const newItem = {
      id: Date.now(), type: newItemType, group: newItemGroup.trim(), name: newItemName.trim(),
      plan: { 2025: Array(12).fill(0), 2026: Array(12).fill(0), 2027: Array(12).fill(0) },
      fact: { 2025: Array(12).fill(0), 2026: Array(12).fill(0), 2027: Array(12).fill(0) },
      transactions: []
    };
    updateData([...items, newItem]);
    setNewItemName('');
  };

  const handleAdminUpdate = (id, field, value) => updateData(items.map(item => item.id === id ? { ...item, [field]: value } : item));

  const handleAdminPlanUpdate = (id, monthIndex, value) => {
    const numValue = parseFloat(value) || 0;
    const newItems = items.map(item => {
      if (item.id === id) {
        const newPlanYearly = { ...item.plan };
        if (!newPlanYearly[selectedYear]) newPlanYearly[selectedYear] = Array(12).fill(0);
        const newPlanArr = [...newPlanYearly[selectedYear]];
        newPlanArr[monthIndex] = numValue;
        newPlanYearly[selectedYear] = newPlanArr;
        return { ...item, plan: newPlanYearly };
      }
      return item;
    });
    updateData(newItems);
  };

  const executeDelete = async (id) => {
    updateData(items.filter(item => item.id !== id));
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, 'budgetItems', id.toString()));
    } catch (error) {
      console.error("Ошибка удаления:", error);
    }
  };

  const createBackup = (e) => {
    e?.preventDefault();
    const newBackup = {
      id: Date.now().toString(),
      date: new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      comment: backupComment.trim() || 'Ручное сохранение',
      data: JSON.parse(JSON.stringify(items))
    };
    updateData(items, [newBackup, ...backups]);
    setBackupComment('');
  };

  const restoreBackup = (id) => {
    const backup = backups.find(b => b.id === id);
    if (backup) {
      updateData(JSON.parse(JSON.stringify(backup.data)), backups);
      setConfirmRestoreId(null);
      setActiveTab('dashboard'); 
    }
  };

  const deleteBackup = (id) => {
    updateData(items, backups.filter(b => b.id !== id));
    setConfirmDeleteBackupId(null);
  };

  const toggleSensitiveGroup = (groupName) => {
    const newGroups = sensitiveGroups.includes(groupName) ? sensitiveGroups.filter(g => g !== groupName) : [...sensitiveGroups, groupName];
    updateData(items, backups, newGroups, sensitiveItems);
  };

  const toggleSensitiveItem = (itemName) => {
    const newItemsList = sensitiveItems.includes(itemName) ? sensitiveItems.filter(i => i !== itemName) : [...sensitiveItems, itemName];
    updateData(items, backups, sensitiveGroups, newItemsList);
  };

  const allGroupedItemsForAdmin = useMemo(() => {
    const groupsMap = {};
    items.forEach(item => {
      const gName = item.group || 'Без группы';
      if (!groupsMap[gName]) groupsMap[gName] = { name: gName, items: new Set() };
      groupsMap[gName].items.add(item.name);
    });
    return Object.values(groupsMap).map(g => ({ ...g, items: Array.from(g.items) })).sort((a,b) => a.name.localeCompare(b.name));
  }, [items]);

  if (!isDbLoaded) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans text-gray-500 text-sm">Подключение к базе данных...</div>;
  }

  let subPeriodLabel = '';
  if (period === 'month') subPeriodLabel = monthNames[selectedMonth];
  if (period === 'quarter') {
    const startM = shortMonthNames[selectedQuarter * 3];
    const endM = shortMonthNames[selectedQuarter * 3 + 2];
    subPeriodLabel = `${quarterNames[selectedQuarter]} (${startM}-${endM})`;
  }

  const renderDashboardTable = (title, groupedData, isIncome) => {
    const headerColor = isIncome ? 'bg-emerald-50/60' : 'bg-rose-50/60';
    const titleColor = isIncome ? 'text-emerald-900' : 'text-rose-900';
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 print:mb-4 print:border-gray-300 print:shadow-none">
        <div className={`py-3 px-4 border-b border-gray-100 ${headerColor} print:bg-gray-100 print:border-gray-300`}>
          <h2 className={`text-base font-bold ${titleColor} print:text-black`}>{title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200 text-sm text-gray-600 print:bg-white print:border-gray-300 print:text-black">
                <th className="py-2 px-4 font-semibold">Статья {isIncome ? 'поступлений' : 'расходов'}</th>
                <th className="py-2 px-4 font-semibold w-32">План</th>
                <th className="py-2 px-4 font-semibold w-32">Факт</th>
                <th className="py-2 px-4 font-semibold w-32">Остаток</th>
                {!isGuestMode && <th className="py-2 px-4 font-semibold text-right min-w-[360px] print:hidden">Внесение факта</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm print:divide-gray-300">
              {groupedData.map((group) => {
                const isCollapsed = collapsedGroups[group.name];
                const groupPlan = getValueForPeriod(group.plan, selectedYear, period, selectedMonth, selectedQuarter);
                const groupFact = getValueForPeriod(group.fact, selectedYear, period, selectedMonth, selectedQuarter);
                const groupRemaining = groupPlan - groupFact;
                const groupPercentSpent = groupPlan > 0 ? (groupFact / groupPlan) * 100 : 0;
                return (
                  <React.Fragment key={group.name}>
                    <tr className="bg-gray-50/80 hover:bg-gray-100 cursor-pointer transition-colors border-t border-gray-200" onClick={() => toggleGroup(group.name)}>
                      <td className="py-2 px-4 flex items-center gap-2">
                        <button className="text-gray-500 hover:text-gray-900 transition-transform"><ChevronDown size={18} className={`transform transition-transform ${isCollapsed ? '-rotate-90' : ''}`} /></button>
                        <span className="font-bold text-gray-900">{group.name}</span>
                      </td>
                      <td className="py-2 px-4 font-bold text-gray-800">{formatCurrency(groupPlan)}</td>
                      <td className="py-2 px-4">
                        <span className="font-bold text-gray-800">{formatCurrency(groupFact)}</span>
                        <div className="w-20 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden print:hidden">
                          <div className={`h-full rounded-full ${groupPercentSpent > 100 ? (isIncome ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-gray-400'}`} style={{ width: `${Math.min(groupPercentSpent, 100)}%` }} />
                        </div>
                      </td>
                      <td className="py-2 px-4 font-bold">
                        <span className={`${groupRemaining < 0 ? (isIncome ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-600'} print:text-black`}>{formatCurrency(Math.abs(groupRemaining))} {groupRemaining < 0 && (isIncome ? '(перевып.)' : '(перерасх.)')}</span>
                      </td>
                      {!isGuestMode && <td className="py-2 px-4 text-right text-xs text-gray-400 print:hidden">Итого по группе</td>}
                    </tr>
                    {!isCollapsed && group.items.map((item) => {
                      const currentPlan = getValueForPeriod(item.plan, selectedYear, period, selectedMonth, selectedQuarter);
                      const currentFact = getValueForPeriod(item.fact, selectedYear, period, selectedMonth, selectedQuarter);
                      const remaining = currentPlan - currentFact;
                      const percentSpent = currentPlan > 0 ? (currentFact / currentPlan) * 100 : 0;
                      const inputData = expenseInputs[item.id] || {};
                      const defaultTargetMonth = period === 'quarter' ? selectedQuarter * 3 : 0;
                      const isItemExpanded = expandedItems[item.id];
                      const filteredTransactions = item.transactions.filter(tx => {
                         if (tx.year !== selectedYear) return false;
                         if (period === 'month' && tx.month !== selectedMonth) return false;
                         if (period === 'quarter') {
                            const qStart = selectedQuarter * 3;
                            if (tx.month < qStart || tx.month >= qStart + 3) return false;
                         }
                         return true;
                      });

                      return (
                        <React.Fragment key={item.id}>
                          <tr className="hover:bg-blue-50/20 transition-colors group">
                            <td className="py-1.5 px-4 pl-8 flex items-center gap-2">
                              <button onClick={() => toggleItem(item.id)} className="text-gray-400 hover:text-blue-600 transition-colors print:hidden"><ChevronRight size={16} className={`transform transition-transform ${isItemExpanded ? 'rotate-90 text-blue-500' : ''}`} /></button>
                              <span className="font-medium text-gray-800">{item.name}</span>
                            </td>
                            <td className="py-1.5 px-4 text-gray-600 print:text-black">{formatCurrency(currentPlan)}</td>
                            <td className="py-1.5 px-4">
                              {period === 'month' && !isGuestMode ? (
                                <>
                                  <input type="number" className={`w-24 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-0.5 outline-none transition-all hide-arrows font-medium ${isIncome ? 'text-emerald-700' : 'text-rose-600'} print:hidden`} value={currentFact === 0 ? '' : currentFact} placeholder="0" onChange={(e) => handleDirectFactUpdate(item.id, e.target.value)} onBlur={(e) => handleFactBlur(item.id, e.target.value)} />
                                  <span className="hidden print:inline font-medium text-black">{formatCurrency(currentFact)}</span>
                                </>
                              ) : (
                                <span className={isIncome ? 'text-emerald-700 font-medium px-1 print:text-black' : 'text-rose-600 font-medium px-1 print:text-black'}>{formatCurrency(currentFact)}</span>
                              )}
                              <div className="w-20 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden ml-1 print:hidden">
                                <div className={`h-full rounded-full ${percentSpent > 100 ? (isIncome ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-blue-400'}`} style={{ width: `${Math.min(percentSpent, 100)}%` }} />
                              </div>
                            </td>
                            <td className="py-1.5 px-4">
                              <span className={`${remaining < 0 ? (isIncome ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-600'} print:text-black`}>{formatCurrency(Math.abs(remaining))}</span>
                            </td>
                            {!isGuestMode && (
                              <td className="py-1.5 px-4 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1.5">
                                  {period !== 'month' && (
                                    <select className="px-1.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={inputData.month ?? defaultTargetMonth} onChange={(e) => handleExpenseInputChange(item.id, 'month', e.target.value)}>
                                      {period === 'quarter' ? [0, 1, 2].map(offset => { const mIdx = selectedQuarter * 3 + offset; return <option key={mIdx} value={mIdx}>{shortMonthNames[mIdx]}</option> }) : monthNames.map((mName, idx) => <option key={idx} value={idx}>{shortMonthNames[idx]}</option>)}
                                    </select>
                                  )}
                                  <input type="number" placeholder="Сумма" className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={inputData.amount || ''} onChange={(e) => handleExpenseInputChange(item.id, 'amount', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFact(item.id)} />
                                  <input type="text" placeholder="Комментарий..." className="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={inputData.comment || ''} onChange={(e) => handleExpenseInputChange(item.id, 'comment', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFact(item.id)} />
                                  <button onClick={() => handleAddFact(item.id)} className={`p-1 rounded-lg transition-colors ${isIncome ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}><Plus size={16} /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                          {isItemExpanded && filteredTransactions.map((tx) => (
                            <React.Fragment key={tx.id}>
                              {editingTxId === tx.id && !isGuestMode ? (
                                <tr className="bg-blue-50/40 transition-colors">
                                  <td className="py-1 px-4 pl-14 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300 print:bg-gray-500"></div>
                                    <input type="text" className="w-14 px-1 py-0.5 text-[11px] border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" value={editTxData.date} onChange={(e) => setEditTxData({...editTxData, date: e.target.value})} placeholder="ДД.ММ" />
                                    <input type="text" className="w-full max-w-[200px] px-1 py-0.5 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" value={editTxData.comment} onChange={(e) => setEditTxData({...editTxData, comment: e.target.value})} placeholder="Комментарий" />
                                  </td>
                                  <td className="py-1 px-4 text-gray-400 text-xs print:text-black">—</td>
                                  <td className="py-1 px-4 pl-5"><span className={`text-xs font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-500'} print:text-black`}>{formatCurrency(tx.amount)}</span></td>
                                  <td className="py-1 px-4 text-gray-400 text-xs print:text-black">—</td>
                                  <td className="py-1 px-4 text-right print:hidden">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => saveEditingTx(item.id, tx.id)} className="text-emerald-600 hover:bg-emerald-100 p-1 rounded transition-colors"><Check size={13} /></button>
                                      <button onClick={cancelEditingTx} className="text-rose-500 hover:bg-rose-100 p-1 rounded transition-colors"><X size={13} /></button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr className="bg-gray-50/60 hover:bg-gray-100 transition-colors">
                                  <td className="py-1 px-4 pl-14 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 print:bg-gray-500"></div>
                                    <span className="text-[11px] font-medium text-gray-400 w-12 print:text-gray-600">{tx.date || shortMonthNames[tx.month]}</span>
                                    <span className="text-xs text-gray-600 print:text-black">{tx.comment || 'Без комментария'}</span>
                                  </td>
                                  <td className="py-1 px-4 text-gray-400 text-xs print:text-black">—</td>
                                  <td className="py-1 px-4 pl-5"><span className={`text-xs font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-500'} print:text-black`}>{formatCurrency(tx.amount)}</span></td>
                                  <td className="py-1 px-4 text-gray-400 text-xs print:text-black">—</td>
                                  {!isGuestMode && (
                                    <td className="py-1 px-4 text-right print:hidden">
                                      <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => startEditingTx(tx)} className="text-gray-400 hover:text-blue-500 p-1 rounded transition-colors"><Edit2 size={13} /></button>
                                        <button onClick={() => handleDeleteTransaction(item.id, tx.id)} className="text-gray-400 hover:text-rose-500 p-1 rounded transition-colors"><Trash2 size={13} /></button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                          {isItemExpanded && filteredTransactions.length === 0 && (
                            <tr className="bg-gray-50/60"><td colSpan={isGuestMode ? "4" : "5"} className="py-2 px-4 pl-14 text-xs text-gray-400 italic">Нет детализированных записей за выбранный период</td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAdminTable = (title, data, isIncome) => {
    const headerColor = isIncome ? 'bg-emerald-50/60' : 'bg-rose-50/60';
    const titleColor = isIncome ? 'text-emerald-900' : 'text-rose-900';
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className={`py-3 px-4 border-b border-gray-100 ${headerColor}`}>
          <h2 className={`text-base font-bold ${titleColor}`}>{title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200 text-gray-600">
                <th className="py-2 px-3 font-semibold min-w-[120px]">Группа</th>
                <th className="py-2 px-3 font-semibold min-w-[160px]">Статья</th>
                {shortMonthNames.map(m => <th key={m} className="py-2 px-1 font-semibold text-center w-[64px]">{m}</th>)}
                <th className="py-2 px-3 font-semibold text-right w-[90px]">Итого Год</th>
                <th className="py-2 px-2 font-semibold text-center w-[60px]">Удал.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(item => {
                const currentYearPlan = item.plan[selectedYear] || Array(12).fill(0);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-1.5 px-3"><input type="text" value={item.group} onChange={(e) => handleAdminUpdate(item.id, 'group', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-1 outline-none transition-all" /></td>
                    <td className="py-1.5 px-3"><input type="text" value={item.name} onChange={(e) => handleAdminUpdate(item.id, 'name', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-1 outline-none font-medium transition-all" /></td>
                    {currentYearPlan.map((val, idx) => (
                      <td key={idx} className="py-1.5 px-1 text-center"><input type="number" value={val === 0 ? '' : val} placeholder="0" onChange={(e) => handleAdminPlanUpdate(item.id, idx, e.target.value)} className="w-16 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-1 outline-none text-right transition-all hide-arrows" /></td>
                    ))}
                    <td className="py-1.5 px-3 text-right font-bold text-gray-700">{formatCurrency(currentYearPlan.reduce((a, b) => a + b, 0))}</td>
                    <td className="py-1.5 px-2 text-center">
                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => executeDelete(item.id)} className="text-rose-600 hover:bg-rose-100 p-1 rounded transition-colors"><Check size={14}/></button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded transition-colors"><X size={14}/></button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(item.id)} className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors"><Trash2 size={16} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800 print:p-0 print:bg-white">
      <style>{`
        .hide-arrows::-webkit-inner-spin-button, .hide-arrows::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-arrows { -moz-appearance: textfield; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .hide-scrollbars { overflow: visible !important; }
        }
      `}</style>
      
      <div className="max-w-[1400px] mx-auto space-y-6 print:max-w-none print:space-y-4">
        
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wide border-b-2 border-black pb-2">Отчет о движении денежных средств</h1>
          <div className="flex justify-between mt-2 text-sm font-medium text-black">
            <span>Период: {subPeriodLabel}</span>
            <span>Сформировано: {new Date().toLocaleDateString('ru-RU')}</span>
          </div>
        </div>

        <header className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Управление бюджетом</h1>
              <p className="text-[11px] md:text-xs text-gray-500 mt-0.5">Cash Flow: контроль поступлений и выплат</p>
            </div>
            <div className="hidden md:flex items-center space-x-1 bg-gray-50 px-1.5 py-1 rounded-lg border border-gray-100">
              <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-500 transition-all"><ChevronLeft size={16} /></button>
              <span className="font-bold text-gray-700 w-12 text-center select-none text-sm">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-500 transition-all"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <div className="flex md:hidden items-center space-x-1 bg-gray-50 px-1.5 py-1 rounded-lg border border-gray-100">
              <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-500"><ChevronLeft size={14} /></button>
              <span className="font-bold text-gray-700 w-10 text-center select-none text-sm">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-500"><ChevronRight size={14} /></button>
            </div>

            {!isSystemGuest && (
              <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto hide-scrollbars">
                <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><LayoutDashboard size={14} /> <span className="hidden sm:inline">Дашборд</span></button>
                <button onClick={() => setActiveTab('admin')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><Settings size={14} /> <span className="hidden sm:inline">Админ-панель</span></button>
                <button onClick={() => setActiveTab('backups')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'backups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><History size={14} /> <span className="hidden sm:inline">Бекапы</span>{backups.length > 0 && <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 rounded-full">{backups.length}</span>}</button>
              </div>
            )}

            {!isSystemGuest && (
              <button
                onClick={toggleGuestMode}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${isGuestMode ? 'bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-200' : 'bg-white text-gray-700 shadow-sm border border-gray-200'}`}
                title="Для демонстрации: переключает приложение в гостевой режим чтения"
              >
                {isGuestMode ? <EyeOff size={14} /> : <Share2 size={14} />}
                <span className="hidden sm:inline">{isGuestMode ? 'Выйти из гостевого' : 'Гостевой вид'}</span>
              </button>
            )}
          </div>
        </header>

        {isGuestMode && (
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-4 py-3 rounded-xl text-sm flex items-center gap-3 print:hidden">
            <Eye size={18} className="text-indigo-500" />
            <div>
              <p className="font-semibold">Активен гостевой вид {isSystemGuest ? '(Вход по ссылке)' : '(Предпросмотр)'}</p>
              <p className="text-indigo-600/80 mt-0.5">Некоторые статьи скрыты. Редактирование, история изменений и добавление факта недоступны.</p>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-4 mb-6 print:gap-2 print:mb-0">
            <div className="flex flex-col lg:flex-row gap-4 print:block">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 print:gap-2 print:mb-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between print:border-gray-400 print:shadow-none print:p-3">
                  <div><p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1 print:text-black">Поступления {period !== 'year' && `(${subPeriodLabel})`}</p><h2 className="text-xl font-bold text-gray-900 leading-none print:text-black">{formatCurrency(incomeFact)}</h2><p className="text-[10px] text-gray-400 mt-1 print:text-black">План: {formatCurrency(incomePlan)}</p></div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg print:hidden"><TrendingUp size={20} /></div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between print:border-gray-400 print:shadow-none print:p-3">
                  <div><p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1 print:text-black">Выплаты {period !== 'year' && `(${subPeriodLabel})`}</p><h2 className="text-xl font-bold text-gray-900 leading-none print:text-black">{formatCurrency(expenseFact)}</h2><p className="text-[10px] text-gray-400 mt-1 print:text-black">План: {formatCurrency(expensePlan)}</p></div>
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg print:hidden"><TrendingDown size={20} /></div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between print:border-gray-400 print:shadow-none print:p-3">
                  <div><p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1 print:text-black">Сальдо за период</p><h2 className={`text-xl font-bold leading-none ${balanceFact < 0 ? 'text-rose-600' : 'text-blue-600'} print:text-black`}>{formatCurrency(balanceFact)}</h2><p className="text-[10px] text-gray-400 mt-1 print:text-black">План: {formatCurrency(balancePlan)}</p></div>
                  <div className={`p-2.5 rounded-lg ${balanceFact >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'} print:hidden`}><PiggyBank size={20} /></div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between print:border-gray-400 print:shadow-none print:p-3">
                  <div><p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1 print:text-black" title="Накопленный итог с учетом всех предыдущих периодов">Общий остаток</p><h2 className={`text-xl font-bold leading-none ${cumulativeFact < 0 ? 'text-rose-600' : 'text-indigo-600'} print:text-black`}>{formatCurrency(cumulativeFact)}</h2><p className="text-[10px] text-gray-400 mt-1 print:text-black">План: {formatCurrency(cumulativePlan)}</p></div>
                  <div className={`p-2.5 rounded-lg ${cumulativeFact >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'} print:hidden`}><Wallet size={20} /></div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-center min-w-[240px] print:hidden">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 justify-between">
                  {['month', 'quarter', 'year'].map((p) => (<button key={p} onClick={() => handlePeriodChange(p)} className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${period === p ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}>{p === 'month' ? 'Месяц' : p === 'quarter' ? 'Квартал' : 'Год'}</button>))}
                </div>
                {period !== 'year' && (
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded-xl shadow-sm border border-gray-100">
                    <button onClick={handlePrevSubPeriod} className="p-1 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><ChevronLeft size={16} /></button>
                    <span className="font-semibold text-gray-800 text-sm select-none">{subPeriodLabel}</span>
                    <button onClick={handleNextSubPeriod} className="p-1 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><ChevronRight size={16} /></button>
                  </div>
                )}
                <button onClick={() => window.print()} className="mt-auto flex items-center justify-center gap-2 w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm">
                  <Download size={16} /> Выгрузить в PDF
                </button>
              </div>
            </div>
            {renderDashboardTable('ПОСТУПЛЕНИЯ', groupedIncomes, true)}
            {renderDashboardTable('РАСХОДЫ', groupedExpenses, false)}
          </div>
        )}

        {activeTab === 'admin' && !isSystemGuest && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить новую статью</h3>
              <form onSubmit={handleAdminAddItem} className="flex flex-col lg:flex-row gap-4">
                <select className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newItemType} onChange={(e) => setNewItemType(e.target.value)}><option value="expense">Расход (Выплата)</option><option value="income">Поступление (Доход)</option></select>
                <input type="text" placeholder="Группа (например: Административные)" required className="w-full lg:w-72 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" value={newItemGroup} onChange={(e) => setNewItemGroup(e.target.value)} list={`${newItemType}-admin-groups`} />
                <datalist id="expense-admin-groups">{Array.from(new Set(items.filter(i=>i.type==='expense').map(i=>i.group))).map(g => <option key={g} value={g} />)}</datalist>
                <datalist id="income-admin-groups">{Array.from(new Set(items.filter(i=>i.type==='income').map(i=>i.group))).map(g => <option key={g} value={g} />)}</datalist>
                <input type="text" placeholder="Название статьи" required className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 shadow-sm"><Plus size={18} /> <span>Добавить</span></button>
              </form>
            </div>
            {renderAdminTable(`ПЛАН ПОСТУПЛЕНИЙ (${selectedYear} год)`, items.filter(i => i.type === 'income'), true)}
            {renderAdminTable(`ПЛАН РАСХОДОВ (${selectedYear} год)`, items.filter(i => i.type === 'expense'), false)}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 flex items-center justify-between cursor-pointer bg-gray-50/50 hover:bg-gray-100 transition-colors" onClick={() => setIsGuestSettingsOpen(!isGuestSettingsOpen)}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><EyeOff size={20} /></div>
                  <div><h3 className="text-lg font-semibold text-gray-900">Настройки гостевого доступа</h3><p className="text-sm text-gray-500 hidden sm:block">Выберите группы и отдельные статьи, которые будут скрыты от гостей.</p></div>
                </div>
                <button className="text-gray-400 hover:text-gray-900 transition-transform"><ChevronDown size={20} className={`transform transition-transform ${isGuestSettingsOpen ? '-rotate-180' : ''}`} /></button>
              </div>
              {isGuestSettingsOpen && (
                <div className="p-6 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allGroupedItemsForAdmin.map(group => (
                      <div key={group.name} className="border border-gray-100 bg-gray-50/50 rounded-xl p-4">
                        <label className="flex items-start gap-3 font-bold text-gray-800 mb-3 cursor-pointer group">
                          <input type="checkbox" checked={sensitiveGroups.includes(group.name)} onChange={() => toggleSensitiveGroup(group.name)} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 w-4 h-4 cursor-pointer" />
                          <span className="group-hover:text-indigo-600 transition-colors">Скрыть всю группу:<br/> {group.name}</span>
                        </label>
                        <div className="pl-7 space-y-2">
                          {group.items.map(itemName => {
                            const isGroupHidden = sensitiveGroups.includes(group.name);
                            return (
                              <label key={itemName} className={`flex items-center gap-2 text-sm cursor-pointer ${isGroupHidden ? 'opacity-50' : 'text-gray-700 hover:text-indigo-600 transition-colors'}`}>
                                <input type="checkbox" checked={isGroupHidden || sensitiveItems.includes(itemName)} onChange={() => toggleSensitiveItem(itemName)} disabled={isGroupHidden} className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer disabled:cursor-not-allowed" />
                                {itemName}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'backups' && !isSystemGuest && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div><h3 className="text-lg font-semibold text-gray-900">Создать резервную копию</h3><p className="text-sm text-gray-500 mt-1">Сохраните текущее состояние бюджета перед внесением больших изменений.</p></div>
              <form onSubmit={createBackup} className="flex w-full md:w-auto gap-2">
                <input type="text" placeholder="Комментарий..." className="flex-1 md:w-64 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" value={backupComment} onChange={(e) => setBackupComment(e.target.value)} />
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"><Save size={16} /> Сохранить</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50"><h2 className="text-base font-bold text-gray-900">История резервных копий</h2></div>
              {backups.length === 0 ? (
                <div className="p-8 text-center text-gray-400 flex flex-col items-center"><History size={48} className="mb-3 opacity-20" /><p>У вас пока нет резервных копий.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead><tr className="border-b border-gray-100 text-gray-500"><th className="py-3 px-6 font-medium">Дата и время</th><th className="py-3 px-6 font-medium">Комментарий</th><th className="py-3 px-6 font-medium text-right">Действия</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {backups.map(backup => (
                        <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-6 whitespace-nowrap text-gray-900 font-medium">{backup.date}</td>
                          <td className="py-3 px-6 text-gray-600 w-full">{backup.comment}</td>
                          <td className="py-3 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {confirmRestoreId === backup.id ? (
                                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100"><span className="text-[10px] text-amber-700 font-medium mr-1 uppercase">Откатиться?</span><button onClick={() => restoreBackup(backup.id)} className="text-emerald-600 hover:bg-emerald-100 p-1 rounded transition-colors"><Check size={14}/></button><button onClick={() => setConfirmRestoreId(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded transition-colors"><X size={14}/></button></div>
                              ) : (
                                <button onClick={() => setConfirmRestoreId(backup.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-xs font-medium"><RotateCcw size={14} /> Откат</button>
                              )}
                              {confirmDeleteBackupId === backup.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100"><button onClick={() => deleteBackup(backup.id)} className="text-rose-600 hover:bg-rose-100 p-1 rounded transition-colors"><Check size={14}/></button><button onClick={() => setConfirmDeleteBackupId(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded transition-colors"><X size={14}/></button></div>
                              ) : (
                                <button onClick={() => setConfirmDeleteBackupId(backup.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- ЭКРАН БЛОКИРОВКИ (FIREBASE AUTH) ---
export default function ProtectedApp() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  
  const [isGuestLink, setIsGuestLink] = useState(window.location.hash === '#guest');

  useEffect(() => {
    const handleHashChange = () => setIsGuestLink(window.location.hash === '#guest');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const loginEmail = isGuestLink ? 'guest@res-kt.ru' : email;
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (err) {
      setError('Неверный пароль. Попробуйте снова.');
    }
  };

  if (checking) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans text-gray-500">Загрузка защищенного соединения...</div>;

  if (user) {
    const isSystemGuest = user.email === 'guest@res-kt.ru';
    
    return (
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-12">
        <div className="bg-gray-900 text-white px-6 py-2 flex justify-between items-center text-xs font-sans print:hidden">
          <span className="opacity-70">
            {isSystemGuest ? 'Гостевой просмотр' : `Защищенная сессия: ${user.email}`}
          </span>
          <button onClick={() => signOut(auth)} className="hover:text-rose-400 transition-colors">
            Выйти из системы
          </button>
        </div>
        <div className="p-4 md:p-8 print:p-0">
          <App isSystemGuest={isSystemGuest} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            {isGuestLink ? <Eye size={24} /> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>}
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isGuestLink ? 'Гостевой доступ' : 'Бюджет РЭС КТ'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isGuestLink ? 'Введите гостевой пароль для просмотра' : 'Авторизуйтесь для полного доступа'}
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          {!isGuestLink && (
            <div>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 outline-none transition-colors" required />
            </div>
          )}
          <div>
            <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 outline-none transition-colors" required />
            {error && <p className="text-xs text-rose-500 mt-1.5 text-center">{error}</p>}
          </div>
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            Войти
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsGuestLink(!isGuestLink)} 
            className="text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
          >
            {isGuestLink ? 'Перейти к панели администратора' : 'Войти по гостевому паролю'}
          </button>
        </div>
      </div>
    </div>
  );
}
