// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, PiggyBank, Calendar, ChevronLeft, ChevronRight, Check, X, ChevronDown, LayoutDashboard, Settings, Trash2, Edit2 } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

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
  { id: 104, type: 'income', group: 'Маркетинговые услуги', name: 'Атомные тигры', planYear: 1500000, fact: [100000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 105, type: 'income', group: 'Маркетинговые услуги', name: 'РЭС Спэйс', planYear: 1000000, fact: [80000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 106, type: 'income', group: 'Маркетинговые услуги', name: 'РЭС Проджект', planYear: 500000, fact: [40000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 107, type: 'income', group: 'Основные поступления', name: 'Прочие поступления', planYear: 200000, fact: [10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 1, type: 'expense', group: 'ФОТ + налоги на ФОТ', name: 'Заработная плата', planYear: 12000000, fact: [1000000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 2, type: 'expense', group: 'ФОТ + налоги на ФОТ', name: 'Налоги на ФОТ', planYear: 3600000, fact: [300000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 3, type: 'expense', group: 'ФОТ + налоги на ФОТ', name: 'Премии сотрудникам', planYear: 500000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 4, type: 'expense', group: 'ФОТ + налоги на ФОТ', name: 'Аутсорс бухгалтерия', planYear: 240000, fact: [20000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 5, type: 'expense', group: 'Общие', name: 'Приобретение ОС', planYear: 100000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 6, type: 'expense', group: 'Общие', name: 'Закупка материалов', planYear: 3750000, fact: [300000, 150000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 7, type: 'expense', group: 'Общие', name: 'ПО', planYear: 150000, fact: [10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 8, type: 'expense', group: 'Общие', name: 'Сайт', planYear: 600000, fact: [50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 9, type: 'expense', group: 'Общие', name: 'Съемки', planYear: 400000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 10, type: 'expense', group: 'Общие', name: 'Реклама', planYear: 1800000, fact: [100000, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 11, type: 'expense', group: 'Командировочные', name: 'Суточные', planYear: 150000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 12, type: 'expense', group: 'Командировочные', name: 'Билеты', planYear: 300000, fact: [45000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 13, type: 'expense', group: 'Командировочные', name: 'Проживание', planYear: 250000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 14, type: 'expense', group: 'Командировочные', name: 'Прочие в командировках', planYear: 50000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 15, type: 'expense', group: 'Персонал', name: 'Обучение персонала', planYear: 100000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 16, type: 'expense', group: 'Персонал', name: 'ДМС', planYear: 232428, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 17, type: 'expense', group: 'Административные', name: 'Аренда офис', planYear: 408000, fact: [34000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 18, type: 'expense', group: 'Административные', name: 'Лицензии, сертификаты, подписки', planYear: 50000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 19, type: 'expense', group: 'Административные', name: 'Доставка и курьерские услуги', planYear: 60000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 20, type: 'expense', group: 'Административные', name: 'РКО и касса', planYear: 25000, fact: [2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 21, type: 'expense', group: 'Административные', name: 'УСН', planYear: 1000000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 22, type: 'expense', group: 'Административные', name: 'Прочее', planYear: 100000, fact: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
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
        year: 2026,
        month: idx,
        amount: val,
        comment: 'Начальный факт',
        date: ''
      });
    }
  });
  
  return {
    id: item.id,
    type: item.type,
    group: item.group,
    name: item.name,
    plan: { 2025: Array(12).fill(0), 2026: plan26, 2027: Array(12).fill(0) },
    fact: { 2025: Array(12).fill(0), 2026: fact26, 2027: Array(12).fill(0) },
    transactions
  };
});

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [selectedYear, setSelectedYear] = useState(2026);
  const [period, setPeriod] = useState('month'); 
  const [selectedMonth, setSelectedMonth] = useState(0); 
  const [selectedQuarter, setSelectedQuarter] = useState(0); 
  
  const [expenseInputs, setExpenseInputs] = useState({});
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxData, setEditTxData] = useState({ date: '', comment: '' });
  
  const [newItemType, setNewItemType] = useState('expense');
  const [newItemName, setNewItemName] = useState('');
  const [newItemGroup, setNewItemGroup] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  // ПОДКЛЮЧЕНИЕ К FIREBASE
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'budgetItems'), (snapshot) => {
      if (snapshot.empty) {
        // Если база пустая, один раз загружаем стартовые данные
        const batch = writeBatch(db);
        initialBudgetItems.forEach(item => {
          const docRef = doc(db, 'budgetItems', item.id.toString());
          batch.set(docRef, item);
        });
        batch.commit();
      } else {
        const dbItems = snapshot.docs.map(d => d.data());
        dbItems.sort((a, b) => a.id - b.id);
        setItems(dbItems);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

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

  const { incomePlan, incomeFact, expensePlan, expenseFact } = useMemo(() => {
    return items.reduce((acc, item) => {
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
  }, [items, selectedYear, period, selectedMonth, selectedQuarter]);

  const balancePlan = incomePlan - expensePlan;
  const balanceFact = incomeFact - expenseFact;

  const groupItemsByType = (type) => {
    const filtered = items.filter(i => i.type === type);
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

  const groupedIncomes = useMemo(() => groupItemsByType('income'), [items]);
  const groupedExpenses = useMemo(() => groupItemsByType('expense'), [items]);

  const handleExpenseInputChange = (id, field, value) => {
    setExpenseInputs(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleAddFact = async (id) => {
    const inputData = expenseInputs[id] || {};
    const amountToAdd = parseFloat(inputData.amount);
    if (isNaN(amountToAdd) || amountToAdd === 0) return;

    let targetMonthIndex;
    if (period === 'month') targetMonthIndex = selectedMonth;
    else if (period === 'quarter') targetMonthIndex = inputData.month !== undefined ? parseInt(inputData.month) : selectedQuarter * 3;
    else targetMonthIndex = inputData.month !== undefined ? parseInt(inputData.month) : 0;

    const newTx = {
      id: Date.now().toString(),
      year: selectedYear,
      month: targetMonthIndex,
      amount: amountToAdd,
      comment: inputData.comment || '',
      date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    };

    const item = items.find(i => i.id === id);
    if (!item) return;

    const newFactYearly = { ...item.fact };
    if (!newFactYearly[selectedYear]) newFactYearly[selectedYear] = Array(12).fill(0);
    const newFactArr = [...newFactYearly[selectedYear]];
    newFactArr[targetMonthIndex] += amountToAdd;
    newFactYearly[selectedYear] = newFactArr;
    
    const updatedItem = { ...item, fact: newFactYearly, transactions: [...item.transactions, newTx] };
    
    // Сохраняем в Firebase
    await setDoc(doc(db, 'budgetItems', id.toString()), updatedItem);

    setExpenseInputs(prev => ({ ...prev, [id]: { ...prev[id], amount: '', comment: '' } }));
    setExpandedItems(prev => ({ ...prev, [id]: true }));
  };

  const handleDeleteTransaction = async (itemId, txId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const tx = item.transactions.find(t => t.id === txId);
    if (!tx) return;

    const newFactYearly = { ...item.fact };
    const newFactArr = [...newFactYearly[tx.year]];
    newFactArr[tx.month] -= tx.amount;
    newFactYearly[tx.year] = newFactArr;

    const updatedItem = {
      ...item,
      fact: newFactYearly,
      transactions: item.transactions.filter(t => t.id !== txId)
    };
    await setDoc(doc(db, 'budgetItems', itemId.toString()), updatedItem);
  };

  const startEditingTx = (tx) => {
    setEditingTxId(tx.id);
    setEditTxData({ date: tx.date || shortMonthNames[tx.month], comment: tx.comment || '' });
  };

  const saveEditingTx = async (itemId, txId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const updatedTxs = item.transactions.map(t =>
      t.id === txId ? { ...t, date: editTxData.date, comment: editTxData.comment } : t
    );
    await setDoc(doc(db, 'budgetItems', itemId.toString()), { ...item, transactions: updatedTxs });
    setEditingTxId(null);
  };

  const cancelEditingTx = () => setEditingTxId(null);

  const handleDirectFactUpdate = async (id, value) => {
    const numValue = parseFloat(value) || 0;
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const newFactYearly = { ...item.fact };
    if (!newFactYearly[selectedYear]) newFactYearly[selectedYear] = Array(12).fill(0);
    const newFactArr = [...newFactYearly[selectedYear]];
    newFactArr[selectedMonth] = numValue;
    newFactYearly[selectedYear] = newFactArr;
    
    await setDoc(doc(db, 'budgetItems', id.toString()), { ...item, fact: newFactYearly });
  };

  const handleFactBlur = async (id, value) => {
    const numValue = parseFloat(value) || 0;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const sumOfTxs = item.transactions
      .filter(t => t.year === selectedYear && t.month === selectedMonth)
      .reduce((acc, t) => acc + t.amount, 0);
    
    const diff = numValue - sumOfTxs;
    if (diff !== 0) {
      const newTx = {
        id: Date.now().toString() + Math.random(),
        year: selectedYear,
        month: selectedMonth,
        amount: diff,
        comment: 'Ручная корректировка',
        date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      };
      await setDoc(doc(db, 'budgetItems', id.toString()), { ...item, transactions: [...item.transactions, newTx] });
    }
  };

  const handleAdminAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemGroup) return;
    const newItem = {
      id: Date.now(),
      type: newItemType,
      group: newItemGroup.trim(),
      name: newItemName.trim(),
      plan: { 2025: Array(12).fill(0), 2026: Array(12).fill(0), 2027: Array(12).fill(0) },
      fact: { 2025: Array(12).fill(0), 2026: Array(12).fill(0), 2027: Array(12).fill(0) },
      transactions: []
    };
    await setDoc(doc(db, 'budgetItems', newItem.id.toString()), newItem);
    setNewItemName('');
  };

  const handleAdminUpdate = async (id, field, value) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    await setDoc(doc(db, 'budgetItems', id.toString()), { ...item, [field]: value });
  };

  const handleAdminPlanUpdate = async (id, monthIndex, value) => {
    const numValue = parseFloat(value) || 0;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newPlanYearly = { ...item.plan };
    if (!newPlanYearly[selectedYear]) newPlanYearly[selectedYear] = Array(12).fill(0);
    const newPlanArr = [...newPlanYearly[selectedYear]];
    newPlanArr[monthIndex] = numValue;
    newPlanYearly[selectedYear] = newPlanArr;
    
    await setDoc(doc(db, 'budgetItems', id.toString()), { ...item, plan: newPlanYearly });
  };

  const executeDelete = async (id) => {
    await deleteDoc(doc(db, 'budgetItems', id.toString()));
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans text-gray-500">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <PiggyBank className="text-blue-500" size={24} />
          </div>
          <p>Подключение к базе данных...</p>
        </div>
      </div>
    );
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className={`py-3 px-4 border-b border-gray-100 ${headerColor}`}>
          <h2 className={`text-base font-bold ${titleColor}`}>{title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200 text-sm text-gray-600">
                <th className="py-2 px-4 font-semibold">Статья {isIncome ? 'поступлений' : 'расходов'}</th>
                <th className="py-2 px-4 font-semibold w-32">План</th>
                <th className="py-2 px-4 font-semibold w-32">Факт</th>
                <th className="py-2 px-4 font-semibold w-32">Остаток</th>
                <th className="py-2 px-4 font-semibold text-right min-w-[360px]">Внесение факта</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {groupedData.map((group) => {
                const isCollapsed = collapsedGroups[group.name];
                const groupPlan = getValueForPeriod(group.plan, selectedYear, period, selectedMonth, selectedQuarter);
                const groupFact = getValueForPeriod(group.fact, selectedYear, period, selectedMonth, selectedQuarter);
                const groupRemaining = groupPlan - groupFact;
                const groupPercentSpent = groupPlan > 0 ? (groupFact / groupPlan) * 100 : 0;

                return (
                  <React.Fragment key={group.name}>
                    <tr 
                      className="bg-gray-50/80 hover:bg-gray-100 cursor-pointer transition-colors border-t border-gray-200"
                      onClick={() => toggleGroup(group.name)}
                    >
                      <td className="py-2 px-4 flex items-center gap-2">
                        <button className="text-gray-500 hover:text-gray-900 transition-transform">
                          <ChevronDown size={18} className={`transform transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        <span className="font-bold text-gray-900">{group.name}</span>
                      </td>
                      <td className="py-2 px-4 font-bold text-gray-800">{formatCurrency(groupPlan)}</td>
                      <td className="py-2 px-4">
                        <span className="font-bold text-gray-800">{formatCurrency(groupFact)}</span>
                        <div className="w-20 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${groupPercentSpent > 100 ? (isIncome ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-gray-400'}`} style={{ width: `${Math.min(groupPercentSpent, 100)}%` }} />
                        </div>
                      </td>
                      <td className="py-2 px-4 font-bold">
                        <span className={`${groupRemaining < 0 ? (isIncome ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-600'}`}>
                          {formatCurrency(Math.abs(groupRemaining))} {groupRemaining < 0 && (isIncome ? '(перевып.)' : '(перерасх.)')}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right text-xs text-gray-400">Итого по группе</td>
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
                              <button onClick={() => toggleItem(item.id)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Показать детализацию">
                                <ChevronRight size={16} className={`transform transition-transform ${isItemExpanded ? 'rotate-90 text-blue-500' : ''}`} />
                              </button>
                              <span className="font-medium text-gray-800">{item.name}</span>
                            </td>
                            <td className="py-1.5 px-4 text-gray-600">{formatCurrency(currentPlan)}</td>
                            <td className="py-1.5 px-4">
                              {period === 'month' ? (
                                <input
                                  type="number"
                                  className={`w-24 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-0.5 outline-none transition-all hide-arrows font-medium ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}
                                  value={currentFact === 0 ? '' : currentFact}
                                  placeholder="0"
                                  onChange={(e) => handleDirectFactUpdate(item.id, e.target.value)}
                                  onBlur={(e) => handleFactBlur(item.id, e.target.value)}
                                  title="Редактировать факт напрямую"
                                />
                              ) : (
                                <span className={isIncome ? 'text-emerald-700 font-medium px-1' : 'text-rose-600 font-medium px-1'}>
                                  {formatCurrency(currentFact)}
                                </span>
                              )}
                              <div className="w-20 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden ml-1">
                                <div className={`h-full rounded-full ${percentSpent > 100 ? (isIncome ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-blue-400'}`} style={{ width: `${Math.min(percentSpent, 100)}%` }} />
                              </div>
                            </td>
                            <td className="py-1.5 px-4">
                              <span className={`${remaining < 0 ? (isIncome ? 'text-emerald-600' : 'text-rose-600') : 'text-gray-600'}`}>
                                {formatCurrency(Math.abs(remaining))}
                              </span>
                            </td>
                            <td className="py-1.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {period !== 'month' && (
                                  <select
                                    className="px-1.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={inputData.month ?? defaultTargetMonth}
                                    onChange={(e) => handleExpenseInputChange(item.id, 'month', e.target.value)}
                                  >
                                    {period === 'quarter' ? 
                                      [0, 1, 2].map(offset => { const mIdx = selectedQuarter * 3 + offset; return <option key={mIdx} value={mIdx}>{shortMonthNames[mIdx]}</option> }) : 
                                      monthNames.map((mName, idx) => <option key={idx} value={idx}>{shortMonthNames[idx]}</option>)
                                    }
                                  </select>
                                )}
                                <input
                                  type="number"
                                  placeholder="Сумма"
                                  className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  value={inputData.amount || ''}
                                  onChange={(e) => handleExpenseInputChange(item.id, 'amount', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddFact(item.id)}
                                />
                                <input
                                  type="text"
                                  placeholder="Комментарий..."
                                  className="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  value={inputData.comment || ''}
                                  onChange={(e) => handleExpenseInputChange(item.id, 'comment', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddFact(item.id)}
                                />
                                <button
                                  onClick={() => handleAddFact(item.id)}
                                  className={`p-1 rounded-lg transition-colors ${isIncome ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                  title="Добавить к факту"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isItemExpanded && filteredTransactions.map((tx) => (
                            <React.Fragment key={tx.id}>
                              {editingTxId === tx.id ? (
                                <tr className="bg-blue-50/40 transition-colors">
                                  <td className="py-1 px-4 pl-14 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                                    <input
                                      type="text"
                                      className="w-14 px-1 py-0.5 text-[11px] border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                      value={editTxData.date}
                                      onChange={(e) => setEditTxData({...editTxData, date: e.target.value})}
                                      placeholder="ДД.ММ"
                                    />
                                    <input
                                      type="text"
                                      className="w-full max-w-[200px] px-1 py-0.5 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                      value={editTxData.comment}
                                      onChange={(e) => setEditTxData({...editTxData, comment: e.target.value})}
                                      placeholder="Комментарий"
                                    />
                                  </td>
                                  <td className="py-1 px-4 text-gray-400 text-xs">—</td>
                                  <td className="py-1 px-4 pl-5">
                                    <span className={`text-xs font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {formatCurrency(tx.amount)}
                                    </span>
                                  </td>
                                  <td className="py-1 px-4 text-gray-400 text-xs">—</td>
                                  <td className="py-1 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => saveEditingTx(item.id, tx.id)} className="text-emerald-600 hover:bg-emerald-100 p-1 rounded transition-colors" title="Сохранить">
                                        <Check size={13} />
                                      </button>
                                      <button onClick={cancelEditingTx} className="text-rose-500 hover:bg-rose-100 p-1 rounded transition-colors" title="Отмена">
                                        <X size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <tr className="bg-gray-50/60 hover:bg-gray-100 transition-colors">
                                  <td className="py-1 px-4 pl-14 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                    <span className="text-[11px] font-medium text-gray-400 w-12">{tx.date || shortMonthNames[tx.month]}</span>
                                    <span className="text-xs text-gray-600">{tx.comment || 'Без комментария'}</span>
                                  </td>
                                  <td className="py-1 px-4 text-gray-400 text-xs">—</td>
                                  <td className="py-1 px-4 pl-5">
                                    <span className={`text-xs font-semibold ${isIncome ? 'text-emerald-600' : 'text-rose-500'}`}>
                                      {formatCurrency(tx.amount)}
                                    </span>
                                  </td>
                                  <td className="py-1 px-4 text-gray-400 text-xs">—</td>
                                  <td className="py-1 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => startEditingTx(tx)} className="text-gray-400 hover:text-blue-500 p-1 rounded transition-colors" title="Редактировать запись">
                                        <Edit2 size={13} />
                                      </button>
                                      <button onClick={() => handleDeleteTransaction(item.id, tx.id)} className="text-gray-400 hover:text-rose-500 p-1 rounded transition-colors" title="Удалить запись">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                          {isItemExpanded && filteredTransactions.length === 0 && (
                            <tr className="bg-gray-50/60">
                              <td colSpan="5" className="py-2 px-4 pl-14 text-xs text-gray-400 italic">
                                Нет детализированных записей за выбранный период
                              </td>
                            </tr>
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
                    <td className="py-1.5 px-3">
                      <input 
                        type="text" value={item.group} onChange={(e) => handleAdminUpdate(item.id, 'group', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-1 outline-none transition-all"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input 
                        type="text" value={item.name} onChange={(e) => handleAdminUpdate(item.id, 'name', e.target.value)}
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-1 outline-none font-medium transition-all"
                      />
                    </td>
                    {currentYearPlan.map((val, idx) => (
                      <td key={idx} className="py-1.5 px-1 text-center">
                        <input 
                          type="number" value={val === 0 ? '' : val} placeholder="0" onChange={(e) => handleAdminPlanUpdate(item.id, idx, e.target.value)}
                          className="w-16 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:bg-white rounded px-1 py-1 outline-none text-right transition-all hide-arrows"
                        />
                      </td>
                    ))}
                    <td className="py-1.5 px-3 text-right font-bold text-gray-700">
                      {formatCurrency(currentYearPlan.reduce((a, b) => a + b, 0))}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => executeDelete(item.id)} className="text-rose-600 hover:bg-rose-100 p-1 rounded transition-colors" title="Удалить навсегда"><Check size={14}/></button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded transition-colors" title="Отмена"><X size={14}/></button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(item.id)} className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors" title="Удалить статью">
                          <Trash2 size={16} />
                        </button>
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <style>{`
        .hide-arrows::-webkit-inner-spin-button, 
        .hide-arrows::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        .hide-arrows {
          -moz-appearance: textfield;
        }
      `}</style>
      
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <header className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-6">
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

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex md:hidden items-center space-x-1 bg-gray-50 px-1.5 py-1 rounded-lg border border-gray-100">
              <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-500"><ChevronLeft size={14} /></button>
              <span className="font-bold text-gray-700 w-10 text-center select-none text-sm">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-white rounded shadow-sm text-gray-500"><ChevronRight size={14} /></button>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <LayoutDashboard size={14} /> <span className="hidden sm:inline">Дашборд</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <Settings size={14} /> <span className="hidden sm:inline">Админ-панель</span>
              </button>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-4 mb-6">
            
            <div className="flex flex-col lg:flex-row gap-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Поступления {period !== 'year' && `(${subPeriodLabel})`}</p>
                    <h2 className="text-xl font-bold text-gray-900 leading-none">{formatCurrency(incomeFact)}</h2>
                    <p className="text-[10px] text-gray-400 mt-1">План: {formatCurrency(incomePlan)}</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Выплаты {period !== 'year' && `(${subPeriodLabel})`}</p>
                    <h2 className="text-xl font-bold text-gray-900 leading-none">{formatCurrency(expenseFact)}</h2>
                    <p className="text-[10px] text-gray-400 mt-1">План: {formatCurrency(expensePlan)}</p>
                  </div>
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={20} /></div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">Сальдо (Остаток)</p>
                    <h2 className={`text-xl font-bold leading-none ${balanceFact < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                      {formatCurrency(balanceFact)}
                    </h2>
                    <p className="text-[10px] text-gray-400 mt-1">План: {formatCurrency(balancePlan)}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${balanceFact >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                    <PiggyBank size={20} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-center min-w-[240px]">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 justify-between">
                  {['month', 'quarter', 'year'].map((p) => (
                    <button 
                      key={p} onClick={() => handlePeriodChange(p)}
                      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${period === p ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      {p === 'month' ? 'Месяц' : p === 'quarter' ? 'Квартал' : 'Год'}
                    </button>
                  ))}
                </div>

                {period !== 'year' && (
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded-xl shadow-sm border border-gray-100">
                    <button onClick={handlePrevSubPeriod} className="p-1 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><ChevronLeft size={16} /></button>
                    <span className="font-semibold text-gray-800 text-sm select-none">{subPeriodLabel}</span>
                    <button onClick={handleNextSubPeriod} className="p-1 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><ChevronRight size={16} /></button>
                  </div>
                )}
              </div>
            </div>

            {renderDashboardTable('ПОСТУПЛЕНИЯ', groupedIncomes, true)}
            {renderDashboardTable('РАСХОДЫ', groupedExpenses, false)}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Добавить новую статью</h3>
              <form onSubmit={handleAdminAddItem} className="flex flex-col lg:flex-row gap-4">
                <select
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={newItemType} onChange={(e) => setNewItemType(e.target.value)}
                >
                  <option value="expense">Расход (Выплата)</option>
                  <option value="income">Поступление (Доход)</option>
                </select>

                <input
                  type="text" placeholder="Группа (например: Административные)" required
                  className="w-full lg:w-72 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newItemGroup} onChange={(e) => setNewItemGroup(e.target.value)}
                  list={`${newItemType}-admin-groups`}
                />
                <datalist id="expense-admin-groups">
                  {Array.from(new Set(items.filter(i=>i.type==='expense').map(i=>i.group))).map(g => <option key={g} value={g} />)}
                </datalist>
                <datalist id="income-admin-groups">
                  {Array.from(new Set(items.filter(i=>i.type==='income').map(i=>i.group))).map(g => <option key={g} value={g} />)}
                </datalist>

                <input
                  type="text" placeholder="Название статьи" required
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                />
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 shadow-sm">
                  <Plus size={18} /> <span>Добавить</span>
                </button>
              </form>
            </div>

            {renderAdminTable(`ПЛАН ПОСТУПЛЕНИЙ (${selectedYear} год)`, items.filter(i => i.type === 'income'), true)}
            {renderAdminTable(`ПЛАН РАСХОДОВ (${selectedYear} год)`, items.filter(i => i.type === 'expense'), false)}

          </div>
        )}

      </div>
    </div>
  );
}


export default function ProtectedApp() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  // Проверяем, авторизован ли пользователь
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
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Неверный email или пароль. Попробуйте снова.');
    }
  };

  const handleLogout = () => signOut(auth);

  if (checking) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans text-gray-500">Загрузка защищенного соединения...</div>;

  // Если токен есть - пускаем внутрь
  if (user) {
    return (
      <div>
        <div className="bg-gray-900 text-white px-6 py-2 flex justify-between items-center text-xs font-sans">
          <span className="opacity-70">Защищенная сессия: {user.email}</span>
          <button onClick={handleLogout} className="hover:text-rose-400 transition-colors">Выйти из системы</button>
        </div>
        <App />
      </div>
    );
  }

  // Если токена нет - показываем окно входа
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Бюджет РЭС КТ</h2>
          <p className="text-sm text-gray-500 mt-1">Авторизуйтесь для доступа к данным</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 outline-none transition-colors" required
            />
          </div>
          <div>
            <input
              type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 outline-none transition-colors" required
            />
            {error && <p className="text-xs text-rose-500 mt-1.5 text-center">{error}</p>}
          </div>
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
