/** biome-ignore-all lint/a11y/noStaticElementInteractions: 67 */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: 67 */
import {
	IconAlertCircle as AlertCircle,
	IconCheck as CheckCircle2,
	IconChevronDown as ChevronDown,
	IconChevronUp as ChevronUp,
	IconFile as FileIcon,
	IconFileText as FileText,
	IconImageInPicture as ImageIcon,
	IconLoader as Loader2,
	IconSparkles as Sparkles,
	IconTarget as Target,
	IconUpload as Upload,
	IconX as X,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AtsScoreGauge } from "#/components/AtsScoreGauge";
import {
	type CandidateProfile,
	StructuredProfileView,
} from "#/components/StructuredProfileView";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";

export const Route = createFileRoute("/")({ component: Home });

interface SingleUploadState {
	file: File;
	progress: number;
	status: "uploading" | "completed" | "error";
	errorMessage?: string;
}

interface ATSScoreBreakdown {
	overall_score: number;
	parseability: number;
	keyword_relevance: number;
	formatting_safety: number;
	metric_impact: number;
	role_match_score?: number | null;
	executive_rationale?: string;
	structural_flaws?: string[];
	bullet_metrics_audit?: string[];
	optimized_rewrites?: string[];
	matched_skills: string[];
	missing_skills: string[];
	profile?: CandidateProfile;
}

const ALLOWED_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
];
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type DashboardTab = "scorecard" | "flaws" | "rewrites" | "profile" | "raw";

function Home() {
	const [fileState, setFileState] = useState<SingleUploadState | null>(null);
	const [jobDescription, setJobDescription] = useState("");
	const [showJdInput, setShowJdInput] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [aiOutput, setAiOutput] = useState("");
	const [structuredData, setStructuredData] =
		useState<ATSScoreBreakdown | null>(null);
	const [activeTab, setActiveTab] = useState<DashboardTab>("scorecard");

	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadFile = async (file: File) => {
		if (
			!ALLOWED_TYPES.includes(file.type) &&
			!file.name.toLowerCase().endsWith(".pdf")
		) {
			alert(
				`"${file.name}" is not a supported file type. Use PDF, PNG, JPG, or WEBP.`,
			);
			return;
		}

		if (file.size > MAX_FILE_SIZE_BYTES) {
			alert(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
			return;
		}

		setFileState({
			file,
			progress: 100,
			status: "uploading",
		});
		setAiOutput("");
		setStructuredData(null);
		setActiveTab("scorecard");

		const formData = new FormData();
		formData.append("file", file);
		if (jobDescription.trim()) {
			formData.append("job_description", jobDescription.trim());
		}

		try {
			const response = await fetch("http://localhost:3001/api/v1/files", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errorDetail = await response.text();
				throw new Error(
					`Upload failed (${response.status}): ${errorDetail || response.statusText}`,
				);
			}

			if (!response.body) {
				throw new Error("Empty response body from server.");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let buffer = "";

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const cleanLine = line.endsWith("\r") ? line.slice(0, -1) : line;
					if (cleanLine.startsWith("data: [STRUCTURED_JSON] ")) {
						const jsonStr = cleanLine.slice("data: [STRUCTURED_JSON] ".length);
						try {
							const parsed = JSON.parse(jsonStr) as ATSScoreBreakdown;
							if (parsed && typeof parsed.overall_score === "number") {
								setStructuredData({
									...parsed,
									matched_skills: Array.isArray(parsed.matched_skills)
										? parsed.matched_skills
										: [],
									missing_skills: Array.isArray(parsed.missing_skills)
										? parsed.missing_skills
										: [],
								});
							}
						} catch (e) {
							console.warn("Failed to parse structured JSON:", e);
						}
					} else if (cleanLine.startsWith("data: ")) {
						const token = cleanLine.slice(6).replace(/\\n/g, "\n");
						setAiOutput((prev) => prev + token);
					}
				}
			}

			// Process remaining buffer
			const cleanBuffer = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
			if (cleanBuffer.startsWith("data: [STRUCTURED_JSON] ")) {
				const jsonStr = cleanBuffer.slice("data: [STRUCTURED_JSON] ".length);
				try {
					const parsed = JSON.parse(jsonStr) as ATSScoreBreakdown;
					if (parsed && typeof parsed.overall_score === "number") {
						setStructuredData({
							...parsed,
							matched_skills: Array.isArray(parsed.matched_skills)
								? parsed.matched_skills
								: [],
							missing_skills: Array.isArray(parsed.missing_skills)
								? parsed.missing_skills
								: [],
						});
					}
				} catch (e) {
					console.warn("Failed to parse remaining structured JSON:", e);
				}
			} else if (cleanBuffer.startsWith("data: ")) {
				const token = cleanBuffer.slice(6).replace(/\\n/g, "\n");
				setAiOutput((prev) => prev + token);
			}

			setFileState((prev) =>
				prev ? { ...prev, progress: 100, status: "completed" } : null,
			);
		} catch (error) {
			console.error("Upload error:", error);
			setFileState((prev) =>
				prev
					? {
							...prev,
							status: "error",
							errorMessage:
								error instanceof Error
									? error.message
									: "Failed to process resume.",
						}
					: null,
			);
		}
	};

	const removeFile = () => {
		setFileState(null);
		setAiOutput("");
		setStructuredData(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			uploadFile(e.dataTransfer.files[0]);
		}
	};

	const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			uploadFile(e.target.files[0]);
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
	};

	const getFileIcon = (fileType: string) => {
		if (fileType.startsWith("image/"))
			return <ImageIcon className="w-6 h-6 text-indigo-500" />;
		if (fileType === "application/pdf")
			return <FileText className="w-6 h-6 text-red-500" />;
		return <FileIcon className="w-6 h-6 text-slate-500" />;
	};

	// Helper to extract specific sections from markdown stream
	const getSectionText = (headingKeyword: string) => {
		if (!aiOutput) return "";
		const sections = aiOutput.split(/(?=##\s+\d+\.)/g);
		const found = sections.find((s) =>
			s.toLowerCase().includes(headingKeyword.toLowerCase()),
		);
		return found ? found.trim() : "";
	};

	const flawsSection = getSectionText("Structural & Formatting Flaws");
	const rewritesSection = getSectionText("Optimized Rewrites");
	const scorecardSection = getSectionText("ATS Compliance Rating");

	const effectiveScore = structuredData?.overall_score ?? null;
	const isEvaluating = fileState?.status === "uploading" && !structuredData;

	return (
		<div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 md:p-12 flex justify-center items-start text-slate-900 font-sans">
			<div className="w-full max-w-4xl space-y-6">
				{/* Top Branding Header */}
				<div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<div className="flex items-center space-x-2.5">
								<div className="p-2 bg-indigo-600 rounded-xl text-white shadow-xs">
									<Sparkles className="w-5 h-5" />
								</div>
								<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
									ATS Resume Intelligence
								</h1>
							</div>
							<p className="text-sm text-slate-500 mt-1.5">
								Hybrid document parsing (PyMuPDF + VLM) with real-time ATS
								scoring, skill gap analysis, and Google X-Y-Z rewrites.
							</p>
						</div>
					</div>

					{/* Target Job Description Collapsible */}
					<div className="mt-6 pt-5 border-t border-slate-100">
						<button
							type="button"
							onClick={() => setShowJdInput(!showJdInput)}
							className="flex items-center space-x-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
						>
							<Target className="w-4 h-4" />
							<span>
								{showJdInput
									? "Hide Target Job Description"
									: "+ Add Target Job Description (Optional for Keyword Matching)"}
							</span>
							{showJdInput ? (
								<ChevronUp className="w-3.5 h-3.5" />
							) : (
								<ChevronDown className="w-3.5 h-3.5" />
							)}
						</button>

						{showJdInput && (
							<div className="mt-3 space-y-2">
								<Textarea
									placeholder="Paste the job requirements, qualifications, and role description here to run skill matching and customized bullet rewrites..."
									rows={4}
									value={jobDescription}
									onChange={(e) => setJobDescription(e.target.value)}
									className="text-xs bg-slate-50/80 border-slate-200 placeholder:text-slate-400"
								/>
								<p className="text-[11px] text-slate-400">
									When supplied, the ATS audit will calculate a dedicated Role
									Match Score and identify exact missing keywords.
								</p>
							</div>
						)}
					</div>

					{/* Drop Zone */}
					<div
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						onClick={() => fileInputRef.current?.click()}
						className={`mt-6 relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
							isDragging
								? "border-indigo-500 bg-indigo-50/60 scale-[0.99]"
								: "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
						}`}
					>
						<Input
							ref={fileInputRef}
							type="file"
							accept=".pdf,.png,.jpg,.jpeg,.webp"
							className="hidden"
							onChange={handleInputChange}
						/>
						<div className="flex flex-col items-center justify-center space-y-3">
							<div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
								<Upload className="w-7 h-7" />
							</div>
							<div>
								<p className="text-sm font-semibold text-slate-700">
									<span className="text-indigo-600 hover:underline">
										Click to upload resume
									</span>{" "}
									or drag and drop
								</p>
								<p className="text-xs text-slate-400 mt-1">
									Digital PDF (Fastest), Scanned PDF, PNG, JPG, or WEBP (Max{" "}
									{MAX_FILE_SIZE_MB}MB)
								</p>
							</div>
						</div>
					</div>

					{/* Selected File Details */}
					{fileState && (
						<div className="mt-4 flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
							<div className="flex items-center space-x-3 overflow-hidden mr-4 flex-1">
								<div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs shrink-0">
									{getFileIcon(fileState.file.type)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-slate-800 truncate">
										{fileState.file.name}
									</p>
									<div className="flex items-center space-x-2 text-xs text-slate-400">
										<span>{formatFileSize(fileState.file.size)}</span>
										<span>•</span>
										<span
											className={`font-semibold capitalize ${
												fileState.status === "completed"
													? "text-emerald-600"
													: fileState.status === "error"
														? "text-rose-500"
														: "text-indigo-600"
											}`}
										>
											{fileState.status === "uploading"
												? "Auditing with AI..."
												: fileState.status}
										</span>
									</div>
									{fileState.status === "error" && fileState.errorMessage && (
										<p className="text-xs text-rose-500 mt-1 font-medium">
											{fileState.errorMessage}
										</p>
									)}
								</div>
							</div>

							<div className="flex items-center space-x-2">
								{fileState.status === "uploading" && (
									<Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
								)}
								{fileState.status === "completed" && (
									<CheckCircle2 className="w-5 h-5 text-emerald-500" />
								)}
								{fileState.status === "error" && (
									<AlertCircle className="w-5 h-5 text-rose-500" />
								)}
								<Button
									variant="ghost"
									size="icon"
									onClick={(e) => {
										e.stopPropagation();
										removeFile();
									}}
									className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg"
								>
									<X className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}
				</div>

				{/* Active Live Analysis Spinner */}
				{fileState?.status === "uploading" && (
					<div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center space-x-3 text-indigo-900 text-xs font-semibold animate-pulse">
						<Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
						<span>
							Extracting layout & analyzing with Gemini models... Stream
							updating below.
						</span>
					</div>
				)}

				{/* Results Dashboard */}
				{(aiOutput || structuredData) && (
					<div className="space-y-6">
						{/* Score Gauge Summary */}
						<AtsScoreGauge
							score={effectiveScore}
							isLoading={isEvaluating}
							metrics={{
								parseability: structuredData?.parseability,
								keywordRelevance: structuredData?.keyword_relevance,
								formattingSafety: structuredData?.formatting_safety,
								metricImpact: structuredData?.metric_impact,
								roleMatchScore: structuredData?.role_match_score,
							}}
						/>

						{/* Role Match Skill Gap Banner if available */}
						{structuredData &&
							((structuredData.matched_skills?.length ?? 0) > 0 ||
								(structuredData.missing_skills?.length ?? 0) > 0) && (
								<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
									<div className="flex items-center justify-between">
										<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
											<Target className="w-4 h-4 text-indigo-500" />
											<span>
												Skill Gap & Keyword Alignment
												{structuredData.role_match_score !== undefined &&
												structuredData.role_match_score !== null
													? ` (${structuredData.role_match_score}% Match)`
													: ""}
											</span>
										</h4>
										{!jobDescription.trim() && (
											<span className="text-[11px] text-slate-400 font-normal">
												Universal Recruiter Benchmark (Add a JD for tailored
												matching)
											</span>
										)}
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
										{/* Matched Skills */}
										<div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
											<span className="font-bold text-emerald-800 block mb-2">
												✓ Matched Qualifications (
												{structuredData.matched_skills?.length ?? 0})
											</span>
											<div className="flex flex-wrap gap-1.5">
												{structuredData.matched_skills?.map((skill) => (
													<span
														key={skill}
														className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700 font-medium text-[11px]"
													>
														{skill}
													</span>
												))}
											</div>
										</div>

										{/* Missing Skills */}
										<div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100">
											<span className="font-bold text-rose-800 block mb-2">
												⚠ Missing Target Keywords (
												{structuredData.missing_skills?.length ?? 0})
											</span>
											<div className="flex flex-wrap gap-1.5">
												{structuredData.missing_skills?.map((skill) => (
													<span
														key={skill}
														className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 font-medium text-[11px]"
													>
														{skill}
													</span>
												))}
											</div>
										</div>
									</div>
								</div>
							)}

						{/* Multi-Tab Dashboard Container */}
						<div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
							{/* Tab Bar */}
							<div className="flex border-b border-slate-200 bg-slate-50/60 px-4 pt-3 space-x-2 overflow-x-auto text-xs font-semibold scrollbar-none">
								<button
									type="button"
									onClick={() => setActiveTab("scorecard")}
									className={`px-3.5 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
										activeTab === "scorecard"
											? "bg-white text-indigo-600 border-indigo-600 shadow-2xs font-bold"
											: "text-slate-500 hover:text-slate-800 border-transparent"
									}`}
								>
									Scorecard & Overview
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("flaws")}
									className={`px-3.5 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
										activeTab === "flaws"
											? "bg-white text-indigo-600 border-indigo-600 shadow-2xs font-bold"
											: "text-slate-500 hover:text-slate-800 border-transparent"
									}`}
								>
									Formatting & Flaws
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("rewrites")}
									className={`px-3.5 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
										activeTab === "rewrites"
											? "bg-white text-indigo-600 border-indigo-600 shadow-2xs font-bold"
											: "text-slate-500 hover:text-slate-800 border-transparent"
									}`}
								>
									Google X-Y-Z Rewrites
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("profile")}
									className={`px-3.5 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
										activeTab === "profile"
											? "bg-white text-indigo-600 border-indigo-600 shadow-2xs font-bold"
											: "text-slate-500 hover:text-slate-800 border-transparent"
									}`}
								>
									Structured Profile (JSON)
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("raw")}
									className={`px-3.5 py-2.5 rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
										activeTab === "raw"
											? "bg-white text-indigo-600 border-indigo-600 shadow-2xs font-bold"
											: "text-slate-500 hover:text-slate-800 border-transparent"
									}`}
								>
									Full Audit Output
								</button>
							</div>

							{/* Tab Content Panes */}
							<div className="p-6">
								{activeTab === "scorecard" && (
									<div className="prose prose-slate max-w-none text-sm">
										{scorecardSection ? (
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												components={markdownComponents}
											>
												{scorecardSection}
											</ReactMarkdown>
										) : (
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												components={markdownComponents}
											>
												{aiOutput}
											</ReactMarkdown>
										)}
									</div>
								)}

								{activeTab === "flaws" && (
									<div className="prose prose-slate max-w-none text-sm">
										{flawsSection ? (
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												components={markdownComponents}
											>
												{flawsSection}
											</ReactMarkdown>
										) : (
											<p className="text-slate-400 italic">
												Parsing structural audit...
											</p>
										)}
									</div>
								)}

								{activeTab === "rewrites" && (
									<div className="prose prose-slate max-w-none text-sm">
										{rewritesSection ? (
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												components={markdownComponents}
											>
												{rewritesSection}
											</ReactMarkdown>
										) : (
											<p className="text-slate-400 italic">
												Generating impact rewrites...
											</p>
										)}
									</div>
								)}

								{activeTab === "profile" && (
									<StructuredProfileView
										profile={structuredData?.profile || null}
										rawJson={
											structuredData
												? JSON.stringify(structuredData, null, 2)
												: undefined
										}
									/>
								)}

								{activeTab === "raw" && (
									<div className="prose prose-slate max-w-none text-sm">
										<ReactMarkdown
											remarkPlugins={[remarkGfm]}
											components={markdownComponents}
										>
											{aiOutput}
										</ReactMarkdown>
									</div>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

const markdownComponents = {
	a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a
			{...props}
			target="_blank"
			rel="noopener noreferrer"
			className="text-indigo-600 hover:underline font-medium"
		/>
	),
	code: ({
		className,
		children,
		...props
	}: React.HTMLAttributes<HTMLElement>) => (
		<code
			{...props}
			className={`${className || ""} bg-slate-100 text-rose-600 px-1.5 py-0.5 rounded font-mono text-xs`}
		>
			{children}
		</code>
	),
	table: ({ ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
		<div className="overflow-x-auto my-4 rounded-xl border border-slate-200">
			<table
				{...props}
				className="min-w-full divide-y divide-slate-200 text-xs"
			/>
		</div>
	),
	thead: ({ ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
		<thead {...props} className="bg-slate-50 font-bold text-slate-700" />
	),
	th: ({ ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
		<th
			{...props}
			className="px-3.5 py-2.5 text-left font-semibold text-slate-700 border-b border-slate-200"
		/>
	),
	td: ({ ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
		<td {...props} className="px-3.5 py-2.5 border-b border-slate-100" />
	),
	h2: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h2
			{...props}
			className="text-lg font-bold mt-6 mb-3 text-slate-900 border-b pb-1.5 border-slate-100"
		/>
	),
	h3: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h3
			{...props}
			className="text-base font-semibold mt-4 mb-2 text-slate-800"
		/>
	),
};
