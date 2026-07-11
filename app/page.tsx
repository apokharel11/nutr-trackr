"use client";
import { useState, useEffect, useMemo } from 'react';
import './globals.css';

interface MacroItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface DayLog {
  targetPreset?: string;
  items: MacroItem[];
}

type TrackerData = Record<string, DayLog>;

const PRESETS: Record<string, { label: string; cals: number; p: number; c: number; f: number }> = {
  rest: { label: "Rest Day (2050 kcal)", cals: 2050, p: 140, c: 230, f: 70 },
  train: { label: "Train Day (2400 kcal)", cals: 2400, p: 150, c: 280, f: 76 },
  active: { label: "Active Rest (2250 kcal)", cals: 2250, p: 140, c: 255, f: 74 },
};

export default function MacroTracker() {
  const [data, setData] = useState<TrackerData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const [targetCreateDate, setTargetCreateDate] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Decoupled Form State
  const [foodName, setFoodName] = useState("");
  const [cals, setCals] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");

  // Determine if a logging action has begun to trigger input warning highlights
  const entryHasBegun = useMemo(() => {
    return foodName.trim() !== "" || cals !== "" || prot !== "" || carbs !== "" || fats !== "";
  }, [foodName, cals, prot, carbs, fats]);

  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch('/api/sync');
        const parsed = await res.json();
        if (parsed && !parsed.error) {
          setData(parsed);
        } else {
          setAlertMsg(parsed.error || "Could not resolve data schema.");
          setData({});
        }
      } catch (e) {
        setAlertMsg("Cloud fetch failed.");
        setData({});
      } finally {
        setIsSyncing(false);
      }
    };
    loadData();
  }, []);

  const persist = async (newData: TrackerData) => {
    setData(newData);
    setIsSyncing(true);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
    } catch (e) {
      setAlertMsg("Cloud save failed!");
    } finally {
      setIsSyncing(false);
    }
  };

  const getDayTotals = (dateStr: string) => {
    const dayData = data && typeof data === 'object' ? data[dateStr] : null;
    const items = dayData?.items || [];
    return items.reduce(
      (acc, item) => {
        acc.calories += Number(item.calories || 0);
        acc.protein += Number(item.protein || 0);
        acc.carbs += Number(item.carbs || 0);
        acc.fats += Number(item.fats || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  };

  const gridDates = useMemo(() => {
    const dates = new Set<string>();
    const todayStr = new Date().toISOString().split('T')[0];
    dates.add(todayStr);

    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        if (data[key]) dates.add(key);
      });
    }
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const handleCreateExplicitDay = () => {
    if (!targetCreateDate) return;
    const nextData = { ...data };
    if (!nextData[targetCreateDate]) nextData[targetCreateDate] = { items: [] };
    persist(nextData);
    setSelectedDate(targetCreateDate);
    setShowAddModal(false);
    setTargetCreateDate("");
  };

  const handleAddItem = () => {
    if (!selectedDate || !foodName) return;

    const newItem: MacroItem = {
      id: Math.random().toString(36).substring(7),
      name: foodName,
      calories: Number(cals) || 0,
      protein: Number(prot) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
    };

    const nextData = { ...data };
    if (!nextData[selectedDate]) nextData[selectedDate] = { items: [] };
    nextData[selectedDate].items = [...nextData[selectedDate].items, newItem];

    persist(nextData);
    setFoodName(""); setCals(""); setProt(""); setCarbs(""); setFats("");
  };

  const handleRemoveItem = (itemId: string) => {
    if (!selectedDate) return;
    const nextData = { ...data };
    if (nextData[selectedDate]) {
      nextData[selectedDate].items = nextData[selectedDate].items.filter(i => i.id !== itemId);
      persist(nextData);
    }
  };

  const handlePresetChange = (presetKey: string) => {
    if (!selectedDate) return;
    const nextData = { ...data };
    if (!nextData[selectedDate]) nextData[selectedDate] = { items: [] };
    nextData[selectedDate].targetPreset = presetKey;
    persist(nextData);
  };

  const currentPresetKey = selectedDate && data[selectedDate] ? data[selectedDate].targetPreset || "" : "";
  const currentPreset = PRESETS[currentPresetKey];

  return (
    <main className="app-container">
      {alertMsg && <div className="alert-banner">{alertMsg}</div>}
      
      <div className="header-meta">
        <h1 className="main-title">Hypertrophy Engine</h1>
        <div className="sync-indicator">
          <span className={`sync-dot ${isSyncing ? 'pulse' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Connected'}
        </div>
      </div>

      {!selectedDate ? (
        <>
          <h2 className="section-title">Speed Dial Grid</h2>
          <div className="grid-scroll-container">
            <div className="tiles-grid">
              {gridDates.map(date => {
                const totals = getDayTotals(date);
                const todayStr = new Date().toISOString().split('T')[0];
                const isToday = date === todayStr;
                const hasItems = data[date] && data[date].items && data[date].items.length > 0;

                return (
                  <div key={date} className={`tile-card ${hasItems || isToday ? 'active' : 'empty'}`} onClick={() => setSelectedDate(date)}>
                    <div className="tile-date">{isToday ? "Today" : date}</div>
                    <div className="tile-main-cal">{totals.calories} <span style={{fontSize: '0.65rem'}}>kcal</span></div>
                    <div className="tile-macros">
                      <span>P: {totals.protein}g</span>
                      <span>C: {totals.carbs}g</span>
                      <span>F: {totals.fats}g</span>
                    </div>
                  </div>
                );
              })}

              <div className="tile-card add-new-tile" onClick={() => setShowAddModal(true)}>
                <span className="add-plus-icon">+</span>
                <span className="add-plus-text">Add Day</span>
              </div>
            </div>
          </div>

          {showAddModal && (
            <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3 style={{marginTop: 0, marginBottom: '10px'}}>Log Custom Date</h3>
                <input type="date" className="text-input" value={targetCreateDate} onChange={e => setTargetCreateDate(e.target.value)} />
                <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                  <button className="btn-primary" style={{flex: 1}} onClick={handleCreateExplicitDay}>Open Grid Slot</button>
                  <button className="btn-ghost" style={{margin: 0}} onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button className="btn-ghost" onClick={() => setSelectedDate(null)}>← Back to Grid</button>
          <h2 className="main-title">{selectedDate} Dashboard</h2>
          
          <div className="summary-banner">
            <label className="field-label">Select Target Strategy Preset</label>
            <select className="select-input" value={currentPresetKey} onChange={e => handlePresetChange(e.target.value)}>
              <option value="">No Strategy Selected</option>
              <option value="rest">{PRESETS.rest.label}</option>
              <option value="train">{PRESETS.train.label}</option>
              <option value="active">{PRESETS.active.label}</option>
            </select>

            {(() => {
              const totals = getDayTotals(selectedDate);
              return (
                <div className="summary-metrics">
                  <div><strong>{totals.calories}</strong> {currentPreset ? `/ ${currentPreset.cals}` : ''} <small>kcal</small></div>
                  <div>P: <strong>{totals.protein}g</strong> {currentPreset ? `/ ${currentPreset.p}g` : ''}</div>
                  <div>C: <strong>{totals.carbs}g</strong> {currentPreset ? `/ ${currentPreset.c}g` : ''}</div>
                  <div>F: <strong>{totals.fats}g</strong> {currentPreset ? `/ ${currentPreset.f}g` : ''}</div>
                </div>
              );
            })()}
          </div>

          <div className="editor-card">
            <label className="field-label">Log Custom Entry</label>
            <input 
              type="text" 
              placeholder="Food item details" 
              value={foodName} 
              onChange={e => setFoodName(e.target.value)} 
              className={`text-input ${entryHasBegun && !foodName.trim() ? 'highlight-warn' : ''}`} 
            />
            
            <div className="macro-input-row">
              <input 
                type="number" 
                placeholder="Kcal" 
                value={cals} 
                onChange={e => setCals(e.target.value)} 
                className={entryHasBegun && !cals ? 'highlight-warn' : ''}
              />
              <input 
                type="number" 
                placeholder="P (g)" 
                value={prot} 
                onChange={e => setProt(e.target.value)} 
                className={entryHasBegun && !prot ? 'highlight-warn' : ''}
              />
              <input 
                type="number" 
                placeholder="C (g)" 
                value={carbs} 
                onChange={e => setCarbs(e.target.value)} 
                className={entryHasBegun && !carbs ? 'highlight-warn' : ''}
              />
              <input 
                type="number" 
                placeholder="F (g)" 
                value={fats} 
                onChange={e => setFats(e.target.value)} 
                className={entryHasBegun && !fats ? 'highlight-warn' : ''}
              />
            </div>
            
            <button className="btn-primary" style={{ width: '100%', marginTop: '12px' }} onClick={handleAddItem}>Add Entry</button>
          </div>

          <h3 className="section-label">Logged Items</h3>
          {(!data[selectedDate] || !data[selectedDate].items || data[selectedDate].items.length === 0) ? (
            <p className="empty-msg">No structural records found for today.</p>
          ) : (
            data[selectedDate].items.map(item => (
              <div key={item.id} className="user-row-v2">
                <div>
                  <div className="time-main">{item.name}</div>
                  <div className="time-secondary">
                    {item.calories} kcal | P: {item.protein}g | C: {item.carbs}g | F: {item.fats}g
                  </div>
                </div>
                <button className="btn-del" onClick={() => handleRemoveItem(item.id)}>Remove</button>
              </div>
            ))
          )}
        </>
      )}
    </main>
  );
}