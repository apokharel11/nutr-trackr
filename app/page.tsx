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
  isApproximate?: boolean;
}

interface DayLog {
  targetPreset?: string;
  customCalorieTarget?: number;
  items: MacroItem[];
}

type TrackerData = Record<string, DayLog>;

const PRESETS: Record<string, { label: string; cals: number; p: number; c: number; f: number }> = {
  rest: { label: "Rest Day (2050 kcal)", cals: 2050, p: 140, c: 230, f: 70 },
  train: { label: "Train Day (2400 kcal)", cals: 2400, p: 150, c: 280, f: 76 },
  active: { label: "Active Rest (2250 kcal)", cals: 2250, p: 140, c: 255, f: 74 },
};

const REF_CAL = 2300;
const REF_P = 156;
const REF_C = 284;
const REF_F = 60;

export default function MacroTracker() {
  const [data, setData] = useState<TrackerData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const [targetCreateDate, setTargetCreateDate] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [foodName, setFoodName] = useState("");
  const [cals, setCals] = useState("");
  const [prot, setProt] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [isApprox, setIsApprox] = useState(false);

  const systemTodayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-CA');
  }, []);

  const entryHasBegun = useMemo(() => {
    return foodName.trim() !== "" || cals !== "" || prot !== "" || carbs !== "" || fats !== "" || isApprox;
  }, [foodName, cals, prot, carbs, fats, isApprox]);

  const isFormValid = useMemo(() => {
    return foodName.trim() !== "" && cals !== "" && prot !== "";
  }, [foodName, cals, prot]);

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
    
    let hasSkippedMacros = false;
    
    const totals = items.reduce(
      (acc, item) => {
        acc.calories += Number(item.calories || 0);
        acc.protein += Number(item.protein || 0);
        acc.carbs += Number(item.carbs || 0);
        acc.fats += Number(item.fats || 0);
        
        if (Number(item.carbs || 0) === 0 || Number(item.fats || 0) === 0) {
          hasSkippedMacros = true;
        }
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    return { ...totals, hasSkippedMacros };
  };

  const getDayTargets = (dateStr: string) => {
    const dayData = data[dateStr];
    const presetKey = dayData?.targetPreset || "";
    const activePreset = PRESETS[presetKey];
    
    let baseCals = activePreset ? activePreset.cals : REF_CAL;
    
    if (dayData?.customCalorieTarget) {
      baseCals = dayData.customCalorieTarget;
    } else if (!activePreset) {
      return null;
    }

    const scaleFactor = baseCals / REF_CAL;
    return {
      calories: Math.round(baseCals),
      protein: Math.round(activePreset ? activePreset.p * (baseCals / activePreset.cals) : REF_P * scaleFactor),
      carbs: Math.round(activePreset ? activePreset.c * (baseCals / activePreset.cals) : REF_C * scaleFactor),
      fats: Math.round(activePreset ? activePreset.f * (baseCals / activePreset.cals) : REF_F * scaleFactor),
    };
  };

  const gridDates = useMemo(() => {
    const dates = new Set<string>();
    dates.add(systemTodayStr);

    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        if (data[key]) dates.add(key);
      });
    }
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [data, systemTodayStr]);

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
    if (!selectedDate || !isFormValid) return;

    const newItem: MacroItem = {
      id: Math.random().toString(36).substring(7),
      name: foodName,
      calories: Number(cals) || 0,
      protein: Number(prot) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
      isApproximate: isApprox
    };

    const nextData = { ...data };
    if (!nextData[selectedDate]) nextData[selectedDate] = { items: [] };
    nextData[selectedDate].items = [...nextData[selectedDate].items, newItem];

    persist(nextData);
    setFoodName(""); setCals(""); setProt(""); setCarbs(""); setFats(""); setIsApprox(false);
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
    delete nextData[selectedDate].customCalorieTarget;
    persist(nextData);
  };

  const handleCustomCalorieChange = (val: string) => {
    if (!selectedDate) return;
    const nextData = { ...data };
    if (!nextData[selectedDate]) nextData[selectedDate] = { items: [] };
    
    if (val === "") {
      delete nextData[selectedDate].customCalorieTarget;
    } else {
      nextData[selectedDate].customCalorieTarget = Number(val);
    }
    persist(nextData);
  };

  const currentPresetKey = selectedDate && data[selectedDate] ? data[selectedDate].targetPreset || "" : "";
  const activeTargets = selectedDate ? getDayTargets(selectedDate) : null;
  const currentDayConfig = selectedDate ? data[selectedDate] : null;

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
                const targets = getDayTargets(date);
                const isToday = date === systemTodayStr;
                const hasItems = data[date] && data[date].items && data[date].items.length > 0;

                return (
                  <div 
                    key={date} 
                    className={`tile-card ${hasItems || isToday ? 'active' : 'empty'} ${totals.hasSkippedMacros ? 'highlight-warn' : ''}`} 
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className="tile-date">{isToday ? "Today" : date}</div>
                    <div className="tile-main-cal">
                      {totals.calories}
                      {targets && (
                        <span className="tile-denominator">
                          / {targets.calories}
                        </span>
                      )}
                      <span className="tile-unit">kcal</span>
                    </div>
                    <div className="tile-macros">
                      <span>P: {totals.protein}g{targets ? `/${targets.protein}g` : ''}</span>
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
                <h3 className="section-title">Log Custom Date</h3>
                <input type="date" className="text-input" value={targetCreateDate} onChange={e => setTargetCreateDate(e.target.value)} />
                <div className="macro-input-row">
                  <button className="btn-primary" onClick={handleCreateExplicitDay}>Open Grid Slot</button>
                  <button className="btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button className="btn-ghost" onClick={() => setSelectedDate(null)}>← Back to Grid</button>
          <h2 className="main-title">{selectedDate === systemTodayStr ? "Today" : selectedDate} Dashboard</h2>
          
          <div className="summary-banner">
            <div>
              <label className="field-label">Select Target Strategy Preset</label>
              <select className="select-input" value={currentPresetKey} onChange={e => handlePresetChange(e.target.value)}>
                <option value="">No Strategy Selected (Custom Engine)</option>
                <option value="rest">{PRESETS.rest.label}</option>
                <option value="train">{PRESETS.train.label}</option>
                <option value="active">{PRESETS.active.label}</option>
              </select>
            </div>

            <div>
              <label className="field-label">Adjust Target Calories Dynamically</label>
              <input 
                type="number" 
                className="text-input" 
                placeholder={activeTargets ? `${activeTargets.calories} (Scaled Matrix)` : "Enter custom reference kcal target"}
                value={currentDayConfig?.customCalorieTarget ?? ""}
                onChange={e => handleCustomCalorieChange(e.target.value)}
              />
            </div>

            {(() => {
              const totals = getDayTotals(selectedDate);
              return (
                <div className={`summary-metrics summary-metrics-wrapper ${totals.hasSkippedMacros ? 'highlight-warn' : ''}`}>
                  <div>
                    <span className="metric-label">Calories</span>
                    <strong className="metric-value-large">{totals.calories}</strong> {activeTargets ? `/ ${activeTargets.calories}` : ''} <small>kcal</small>
                  </div>
                  <div>
                    <span className="metric-label">Protein</span>
                    P: <strong>{totals.protein}g</strong> {activeTargets ? `/ ${activeTargets.protein}g` : ''}
                  </div>
                  <div>
                    <span className="metric-label">Carbs</span>
                    C: <strong>{totals.carbs}g</strong> {activeTargets ? `/ ${activeTargets.carbs}g` : ''}
                  </div>
                  <div>
                    <span className="metric-label">Fats</span>
                    F: <strong>{totals.fats}g</strong> {activeTargets ? `/ ${activeTargets.fats}g` : ''}
                  </div>
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
                placeholder="Kcal *" 
                value={cals} 
                onChange={e => setCals(e.target.value)} 
                className={entryHasBegun && !cals ? 'highlight-warn' : ''}
              />
              <input 
                type="number" 
                placeholder="P (g) *" 
                value={prot} 
                onChange={e => setProt(e.target.value)} 
                className={entryHasBegun && !prot ? 'highlight-warn' : ''}
              />
              <input 
                type="number" 
                placeholder="C (g)" 
                value={carbs} 
                onChange={e => setCarbs(e.target.value)} 
              />
              <input 
                type="number" 
                placeholder="F (g)" 
                value={fats} 
                onChange={e => setFats(e.target.value)} 
              />
            </div>

            <div className="approx-checkbox-container">
              <input 
                type="checkbox" 
                id="approx-checkbox" 
                checked={isApprox} 
                onChange={e => setIsApprox(e.target.checked)} 
                className="approx-checkbox-input"
              />
              <label htmlFor="approx-checkbox" className="approx-checkbox-label">
                Mark entry calculation as approximate
              </label>
            </div>
            
            <button 
              className={`btn-primary ${!isFormValid ? 'disabled-btn' : ''}`} 
              disabled={!isFormValid}
              onClick={handleAddItem}
            >
              Add Entry
            </button>
          </div>

          <h3 className="section-title">Logged Items</h3>
          {(!data[selectedDate] || !data[selectedDate].items || data[selectedDate].items.length === 0) ? (
            <p className="empty-msg">No structural records found for today.</p>
          ) : (
            data[selectedDate].items.map(item => (
              <div 
                key={item.id} 
                className={`user-row-v2 ${item.isApproximate ? 'approx-ring' : ''}`}
              >
                <div>
                  <div className="time-main">
                    {item.name} {item.isApproximate && <span className="approx-badge">(Approx)</span>}
                  </div>
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