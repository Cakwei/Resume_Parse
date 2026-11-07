export interface AtsMetrics {
	parseability?: number;
	keywordRelevance?: number;
	formattingSafety?: number;
	metricImpact?: number;
	roleMatchScore?: number | null;
}

interface AtsScoreGaugeProps {
	score?: number | null;
	metrics?: AtsMetrics;
	size?: number;
	isLoading?: boolean;
}

export function AtsScoreGauge({
	score,
	metrics,
	size = 140,
	isLoading = false,
}: AtsScoreGaugeProps) {
	if (isLoading || score === null || score === undefined) {
		return (
			<div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-center gap-6 animate-pulse">
				<div className="flex flex-col items-center shrink-0">
					<div
						className="relative flex items-center justify-center rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin"
						style={{ width: size, height: size }}
					/>
					<span className="mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
						Evaluating...
					</span>
				</div>
				<div className="flex-1 w-full space-y-3">
					<div className="h-4 w-32 bg-slate-200 rounded" />
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
							>
								<div className="h-3 w-20 bg-slate-200 rounded" />
								<div className="w-full bg-slate-200 rounded-full h-1.5" />
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
	const strokeWidth = 10;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

	const getColorClasses = (val: number) => {
		if (val >= 80)
			return {
				stroke: "stroke-emerald-500",
				text: "text-emerald-600",
				bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
				bar: "bg-emerald-500",
				label: "Excellent",
			};
		if (val >= 60)
			return {
				stroke: "stroke-amber-500",
				text: "text-amber-600",
				bg: "bg-amber-50 border-amber-200 text-amber-700",
				bar: "bg-amber-500",
				label: "Average",
			};
		return {
			stroke: "stroke-rose-500",
			text: "text-rose-600",
			bg: "bg-rose-50 border-rose-200 text-rose-700",
			bar: "bg-rose-500",
			label: "Needs Improvement",
		};
	};

	const rating = getColorClasses(clampedScore);

	const subMetricList: Array<{ name: string; value: number }> = [];

	if (
		metrics?.roleMatchScore !== undefined &&
		metrics?.roleMatchScore !== null
	) {
		subMetricList.push({
			name: "Target Role Match",
			value: metrics.roleMatchScore,
		});
	}

	if (metrics?.parseability !== undefined) {
		subMetricList.push({ name: "Parseability", value: metrics.parseability });
	}
	if (metrics?.formattingSafety !== undefined) {
		subMetricList.push({
			name: "Formatting Safety",
			value: metrics.formattingSafety,
		});
	}
	if (metrics?.metricImpact !== undefined) {
		subMetricList.push({ name: "Metric Impact", value: metrics.metricImpact });
	}
	if (metrics?.keywordRelevance !== undefined) {
		subMetricList.push({
			name: "Keyword Relevance",
			value: metrics.keywordRelevance,
		});
	}

	return (
		<div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-center gap-6">
			{/* Circular Gauge */}
			<div className="flex flex-col items-center shrink-0">
				<div
					className="relative flex items-center justify-center"
					style={{ width: size, height: size }}
				>
					<svg
						className="transform -rotate-90"
						width={size}
						height={size}
						aria-label="ATS Score circular gauge"
					>
						<circle
							cx={size / 2}
							cy={size / 2}
							r={radius}
							stroke="currentColor"
							strokeWidth={strokeWidth}
							className="text-slate-100 fill-transparent"
						/>
						<circle
							cx={size / 2}
							cy={size / 2}
							r={radius}
							stroke="currentColor"
							strokeWidth={strokeWidth}
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							strokeLinecap="round"
							className={`${rating.stroke} fill-transparent transition-all duration-1000 ease-out`}
						/>
					</svg>
					<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
						<span className={`text-4xl font-extrabold ${rating.text}`}>
							{clampedScore}
						</span>
						<span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
							ATS Score
						</span>
					</div>
				</div>
				<span
					className={`mt-3 px-3 py-1 rounded-full text-xs font-semibold border ${rating.bg}`}
				>
					{rating.label}
				</span>
			</div>

			{/* Sub-Metrics Bars */}
			<div className="flex-1 w-full space-y-3">
				<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
					Key ATS Evaluators
				</h4>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{subMetricList.map((item) => {
						const subColor = getColorClasses(item.value);
						return (
							<div
								key={item.name}
								className="p-2.5 rounded-xl bg-slate-50 border border-slate-100"
							>
								<div className="flex justify-between items-center text-xs mb-1.5">
									<span className="font-medium text-slate-700">
										{item.name}
									</span>
									<span className={`font-bold ${subColor.text}`}>
										{item.value}%
									</span>
								</div>
								<div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
									<div
										className={`${subColor.bar} h-1.5 rounded-full transition-all duration-700`}
										style={{ width: `${Math.min(100, item.value)}%` }}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
