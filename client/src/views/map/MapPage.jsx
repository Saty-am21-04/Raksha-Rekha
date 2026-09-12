import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, BellRing, Database, Menu, Radio, ShieldCheck, Users, X } from 'lucide-react';
import HabitationMap from './HabitationMap.jsx';
import ExplainabilityPanel from '../explainability/ExplainabilityPanel.jsx';
import { fetchBacktestData, toggleBacktest } from '../../services/apiClient.js';
import { createRealtimeClient } from '../../services/realtimeService.js';
import { fetchSafeRoute, findNearestSafeSite } from '../../services/routeService.js';

const demoZone = {
  _id: 'punnapuzha', name: 'Punnapuzha Catchment', status: 'RED', riskScore: 92,
  geometry: { type: 'Polygon', coordinates: [[[76.074, 11.48], [76.109, 11.48], [76.109, 11.515], [76.074, 11.515], [76.074, 11.48]]] },
  metrics: { slopeAngle: 38, rainfall72h: 573, soilSaturation: 98 }
};
const demoHabitations = [
  { name: 'Mundakkai', location: { coordinates: [76.099, 11.501] }, population: 1200, evacuationPriority: 94 },
  { name: 'Chooralmala', location: { coordinates: [76.083, 11.488] }, population: 1050, evacuationPriority: 88 },
  { name: 'Punchirimattam', location: { coordinates: [76.091, 11.496] }, population: 900, evacuationPriority: 82 }
];
const demoSafeSites = [
  { name: 'Meppadi Relief Camp', location: { coordinates: [76.13, 11.54] }, totalCapacity: 1200, currentOccupancy: 150 },
  { name: 'Kalpetta Relief Camp', location: { coordinates: [76.08, 11.61] }, totalCapacity: 1000, currentOccupancy: 100 }
];

const formatNumber = (value) => Math.round(value).toLocaleString();

const MapPage = () => {
  const [zones, setZones] = useState([demoZone]);
  const [habitations, setHabitations] = useState(demoHabitations);
  const [safeSites, setSafeSites] = useState(demoSafeSites);
  const [selected, setSelected] = useState(null);
  const [isBacktest, setIsBacktest] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [routeState, setRouteState] = useState({ status: 'idle', feature: null, message: '' });

  const handleSelect = useCallback((selection) => {
    setSelected(selection);
    if (selection?.type !== 'habitation') {
      setRouteState({ status: 'idle', feature: null, message: '' });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const backtestResult = await fetchBacktestData();
        if (!active) return;
        if (Array.isArray(backtestResult.zones)) setZones(backtestResult.zones);
        if (Array.isArray(backtestResult.habitations)) setHabitations(backtestResult.habitations);
        if (Array.isArray(backtestResult.safeSites)) setSafeSites(backtestResult.safeSites);
      } catch {
        // Demo data keeps the operations view useful while the API is offline.
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadDashboard();
    return () => { active = false; };
  }, [isBacktest]);

  useEffect(() => {
    const socket = createRealtimeClient();
    socket.on('connect', () => setConnectionState('live'));
    socket.on('disconnect', () => setConnectionState('offline'));
    socket.on('connect_error', () => setConnectionState('offline'));
    socket.on('sensor:error', (payload) => setConnectionState(payload?.message || 'sensor-error'));
    socket.on('risk:update', (payload) => {
      if (Array.isArray(payload?.zones)) setZones(payload.zones);
      if (Array.isArray(payload?.prioritizedHabitations) && payload.prioritizedHabitations.length) {
        setHabitations((current) => current.map((habitation) => {
          const update = payload.prioritizedHabitations.find((item) => (item._id || item.id || item.name) === (habitation._id || habitation.id || habitation.name));
          return update ? { ...habitation, evacuationPriority: update.evacuationPriority } : habitation;
        }));
      }
    });
    socket.on('priority:update', (payload) => {
      if (!Array.isArray(payload?.priorities)) return;
      setHabitations((current) => current.map((habitation) => {
        const update = payload.priorities.find((item) => (item.id || item.name) === (habitation._id || habitation.id || habitation.name));
        return update ? { ...habitation, evacuationPriority: update.evacuationPriority } : habitation;
      }));
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selected?.type !== 'habitation') {
      return undefined;
    }

    const controller = new AbortController();
    const loadRoute = async () => {
      const safeSite = findNearestSafeSite(selected.data, safeSites);
      if (!safeSite) {
        setRouteState({ status: 'empty', feature: null, message: 'No safe site available for route planning.' });
        return;
      }
      setRouteState({ status: 'loading', feature: null, message: `Routing to ${safeSite.name}` });
      try {
        const feature = await fetchSafeRoute(selected.data, safeSite, zones.filter((zone) => zone.status === 'RED'), controller.signal);
        const unsafe = Boolean(feature.properties?.intersectsRedZone);
        setRouteState({
          status: unsafe ? 'blocked' : 'ready',
          feature,
          message: unsafe ? `Route intersects a RED zone near ${safeSite.name}. Authority review required.` : `Route to ${safeSite.name} eligible for review.`
        });
      } catch (error) {
        if (!controller.signal.aborted) setRouteState({ status: 'error', feature: null, message: error.message });
      }
    };
    loadRoute();
    return () => controller.abort();
  }, [selected, safeSites, zones]);

  const totalEvacuees = useMemo(() => habitations.reduce((total, item) => total + Number(item.population || 0), 0), [habitations]);
  const safeCapacity = useMemo(() => safeSites.reduce((total, item) => total + Math.max(Number(item.totalCapacity || 0) - Number(item.currentOccupancy || 0), 0), 0), [safeSites]);
  const sortedHabitations = useMemo(() => [...habitations].sort((a, b) => Number(b.evacuationPriority || 0) - Number(a.evacuationPriority || 0)), [habitations]);
  const deficit = Math.max(totalEvacuees - safeCapacity, 0);

  const changeMode = async () => {
    const nextMode = !isBacktest;
    setIsBacktest(nextMode);
    try { await toggleBacktest(nextMode); } catch { /* Keep the local switch responsive. */ }
  };

  return (
    <div className="tactical-grid flex h-screen w-screen flex-col overflow-hidden bg-black text-white">
      <header className="z-20 flex min-h-18 shrink-0 items-center gap-4 border-b border-[#1a1a1a] bg-black/95 px-4 backdrop-blur-xl sm:px-6">
        <div className="mr-auto flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded border border-rose-800 bg-rose-900/20 text-rose-600 shadow-[0_0_18px_rgba(225,29,72,0.2)]"><Radio size={18} /></div>
          <div><strong className="block text-sm font-semibold tracking-[0.18em] text-white">RAKSHA-REKHA</strong><span className="hidden font-mono text-[9px] tracking-[0.16em] text-gray-400 sm:block">DISASTER INTELLIGENCE / SIH26191</span></div>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-gray-400 lg:flex"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" /> SYSTEMS NOMINAL <span className="mx-2 h-4 w-px bg-[#1a1a1a]" /> WAYANAD DISTRICT</div>
        <button type="button" className="grid h-9 w-9 place-items-center rounded border border-[#1a1a1a] bg-[#050505] text-gray-400 lg:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle controls">{mobileMenu ? <X size={18} /> : <Menu size={18} />}</button>
        <div className={`${mobileMenu ? 'flex' : 'hidden'} absolute left-0 right-0 top-18 items-center justify-between gap-3 border-b border-[#1a1a1a] bg-black p-4 lg:static lg:flex lg:border-0 lg:bg-transparent lg:p-0`}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700 bg-amber-900/20 px-2.5 py-1.5 font-mono text-[9px] tracking-widest text-amber-400"><Database size={12} /> HISTORICAL MODE</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-400"><span>Wayanad 2024 Backtest</span><input className="peer sr-only" type="checkbox" checked={isBacktest} onChange={changeMode} /><span className="relative h-5 w-9 rounded-full bg-[#1a1a1a] transition peer-checked:bg-rose-600 after:absolute after:left-1 after:top-1 after:h-3 after:w-3 after:rounded-full after:bg-gray-400 after:transition peer-checked:after:translate-x-4 peer-checked:after:bg-white" /></label>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="flex min-h-0 min-w-0 flex-col gap-4 p-4 sm:p-6">
          <div className="flex shrink-0 items-end justify-between gap-4"><div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-600">Operational overview / 01</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Relocation command center</h1></div><div className="font-mono text-[10px] tracking-[0.12em] text-gray-400"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${isLoading ? 'animate-pulse bg-amber-400' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`} />{isLoading ? 'SYNCING' : 'LIVE DATA'}</div></div>
          <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
            <motion.div className="glass-panel rounded-lg border border-rose-800 bg-[#050505] p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><AlertTriangle className="mb-3 text-rose-600" size={17} /><span className="block text-[10px] uppercase tracking-wider text-gray-400">Total at risk</span><strong className="mt-1 block font-mono text-2xl text-rose-600">{habitations.length}</strong><small className="text-[10px] text-gray-400">active red zone</small></motion.div>
            <motion.div className="glass-panel rounded-lg border border-[#1a1a1a] bg-[#050505] p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.06 } }}><Users className="mb-3 text-white" size={17} /><span className="block text-[10px] uppercase tracking-wider text-gray-400">Total evacuees</span><strong className="mt-1 block font-mono text-2xl text-white">{formatNumber(totalEvacuees)}</strong><small className="text-[10px] text-gray-400">residents exposed</small></motion.div>
            <motion.div className="glass-panel rounded-lg border border-amber-700 bg-[#050505] p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}><ShieldCheck className="mb-3 text-emerald-500" size={17} /><span className="block text-[10px] uppercase tracking-wider text-gray-400">Capacity deficit</span><strong className="mt-1 block font-mono text-2xl text-amber-400">{formatNumber(deficit)}</strong><small className="text-[10px] text-gray-400">additional places needed</small></motion.div>
            <motion.div className="glass-panel rounded-lg border border-rose-800 bg-[#050505] p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.18 } }}><BellRing className="mb-3 text-rose-600" size={17} /><span className="block text-[10px] uppercase tracking-wider text-gray-400">Warning level</span><strong className="mt-1 block font-mono text-2xl text-rose-600">RED</strong><small className="text-[10px] text-gray-400">immediate action advised</small></motion.div>
          </div>
          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#1a1a1a] bg-[#050505] p-2 sm:p-3"><div className="flex shrink-0 items-center justify-between border-b border-[#1a1a1a] px-2 pb-3"><div><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white">Live geospatial layer</span><span className="mt-1 block text-[11px] text-gray-400">Risk zones, habitations and designated safe sites</span></div><div className="hidden items-center gap-3 text-[10px] text-gray-400 sm:flex"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-600" />Red</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Priority</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Safe</span></div></div><div className="min-h-0 flex-1"><HabitationMap zones={zones} habitations={habitations} safeSites={safeSites} routeFeature={routeState.feature} onSelect={handleSelect} /></div></div>
        </section>

        <aside className="glass-panel min-h-0 overflow-y-auto rounded-none border-y-0 border-r-0 border-[#1a1a1a] bg-[#050505] p-4 md:border-l md:border-t-0 sm:p-5"><div className="flex items-start justify-between"><div><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-600">Evacuation queue</p><h2 className="text-xl font-semibold text-white">Prioritized habitations</h2></div><span className="font-mono text-xl text-rose-600">{habitations.length.toString().padStart(2, '0')}</span></div><p className="mt-3 border-b border-[#1a1a1a] pb-4 text-xs leading-relaxed text-gray-400">Ranked by vulnerability, population exposure, and access-road risk.</p><div className="border-b border-[#1a1a1a] py-3 text-[11px] text-gray-400"><span className="font-mono uppercase text-white">Socket</span> {connectionState}<br /><span className="font-mono uppercase text-white">Route</span> {routeState.status}{routeState.message ? `: ${routeState.message}` : ''}</div><div className="mt-2">{sortedHabitations.map((habitation, index) => <button type="button" className="group flex w-full items-center gap-3 border-b border-[#1a1a1a] py-4 text-left transition hover:bg-white/3" key={habitation._id || habitation.name} onClick={() => handleSelect({ type: 'habitation', data: habitation })}><span className="font-mono text-[10px] text-gray-400">0{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium text-white group-hover:text-rose-600">{habitation.name}</strong><small className="mt-1 block text-[11px] text-gray-400">{formatNumber(habitation.population)} residents</small></span><span className={`font-mono text-sm ${index === 0 ? 'text-rose-600' : 'text-amber-400'}`}>{habitation.evacuationPriority || 0}</span></button>)}</div><div className="mt-6 flex items-center gap-2 text-[11px] text-gray-400"><Activity className="text-emerald-500" size={15} /> Priority engine updated <strong className="text-white">just now</strong></div></aside>
      </main>
      <ExplainabilityPanel selection={selected} onClose={() => handleSelect(null)} safeCapacity={safeCapacity} requiredEvacuees={selected?.data?.population || totalEvacuees} />
    </div>
  );
};

export default MapPage;
