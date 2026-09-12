import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, CircleAlert, X } from 'lucide-react';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const ExplainabilityPanel = ({ selection, onClose, safeCapacity = 0, requiredEvacuees = 0 }) => {
	const item = selection?.data;
	const metrics = item?.metrics || {};
	const isHabitation = selection?.type === 'habitation';
	const isZone = selection?.type === 'zone';
	const rainfall = number(metrics.rainfall72h);
	const rainfallThreshold = 300;
	const priority = number(item?.evacuationPriority);
	const chartData = [
		{ name: 'Rainfall', value: rainfall, threshold: rainfallThreshold },
		{ name: 'Capacity', value: number(safeCapacity), threshold: number(requiredEvacuees) }
	];

	return (
		<AnimatePresence>
			{item && (
				<motion.aside
					className="explainability-panel"
					initial={{ x: '105%', opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					exit={{ x: '105%', opacity: 0 }}
					transition={{ type: 'spring', stiffness: 300, damping: 30 }}
					aria-label="Explainability panel"
				>
					<div className="panel-heading">
						<div>
							<p className="eyebrow">Explainability layer</p>
							<h2>{item.name || 'Selected location'}</h2>
							<span className={`status-pill ${item.status === 'RED' ? 'danger' : 'warning'}`}>
								<CircleAlert size={12} /> {item.status || (isHabitation ? 'PRIORITY' : 'SAFE SITE')}
							</span>
						</div>
						<button className="icon-button" onClick={onClose} aria-label="Close explainability panel"><X size={18} /></button>
					</div>

					<div className="metric-grid compact-grid">
						<div className="mini-metric"><span>72h Rainfall</span><strong>{rainfall} <small>mm</small></strong></div>
						<div className="mini-metric"><span>Slope Angle</span><strong>{number(metrics.slopeAngle)} <small>deg</small></strong></div>
						<div className="mini-metric"><span>Soil Saturation</span><strong>{number(metrics.soilSaturation)}<small>%</small></strong></div>
						<div className="mini-metric"><span>Evacuation Priority</span><strong>{priority}<small>/100</small></strong></div>
					</div>

					<section className="insight-block">
						<div className="section-label"><span>Risk signals</span><ArrowUpRight size={15} /></div>
						<p>{isZone ? 'This zone is classified from rainfall intensity, terrain steepness, and soil saturation.' : 'This habitation is prioritized using population exposure and vulnerability factors.'}</p>
						<div className="chart-wrap">
							<ResponsiveContainer width="100%" height={170}>
								<BarChart data={chartData} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
									<CartesianGrid stroke="#273244" vertical={false} />
									<XAxis dataKey="name" tick={{ fill: '#8793a6', fontSize: 11 }} axisLine={false} tickLine={false} />
									<YAxis tick={{ fill: '#8793a6', fontSize: 10 }} axisLine={false} tickLine={false} />
									<Tooltip contentStyle={{ background: '#151d2b', border: '1px solid #374151', borderRadius: 8, color: '#f8fafc' }} />
									<Bar dataKey="value" name="Observed / available" fill="#ef4444" radius={[4, 4, 0, 0]} />
									<Bar dataKey="threshold" name="Threshold / required" fill="#f59e0b" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</section>

					<section className="capacity-callout">
						<div><span>Safe capacity</span><strong>{number(safeCapacity).toLocaleString()}</strong></div>
						<div><span>Required evacuees</span><strong>{number(requiredEvacuees).toLocaleString()}</strong></div>
						<div className={number(requiredEvacuees) > number(safeCapacity) ? 'deficit' : 'available'}>
							<span>{number(requiredEvacuees) > number(safeCapacity) ? 'Capacity deficit' : 'Available balance'}</span>
							<strong>{Math.abs(number(safeCapacity) - number(requiredEvacuees)).toLocaleString()}</strong>
						</div>
					</section>
				</motion.aside>
			)}
		</AnimatePresence>
	);
};

export default ExplainabilityPanel;
