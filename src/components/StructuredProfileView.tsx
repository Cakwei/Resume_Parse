import {
	IconBriefcase as Briefcase,
	IconCheck as Check,
	IconCopy as Copy,
	IconDownload as Download,
	IconSchool as GraduationCap,
	IconMail as Mail,
	IconPhone as Phone,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";

export interface WorkExperienceItem {
	title: string;
	company: string;
	location?: string;
	dates?: string;
	bullets: string[];
}

export interface EducationItem {
	degree: string;
	institution: string;
	dates?: string;
	location?: string;
	gpa?: string;
}

export interface CandidateProfile {
	name?: string;
	email?: string;
	phone?: string;
	summary?: string;
	skills: string[];
	experience: WorkExperienceItem[];
	education: EducationItem[];
}

interface StructuredProfileViewProps {
	profile: CandidateProfile | null;
	rawJson?: string;
}

export function StructuredProfileView({
	profile,
	rawJson,
}: StructuredProfileViewProps) {
	const [copied, setCopied] = useState(false);
	const [showRawJson, setShowRawJson] = useState(false);

	const jsonString = rawJson || JSON.stringify(profile, null, 2);

	const handleCopy = () => {
		navigator.clipboard.writeText(jsonString);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleDownload = () => {
		const blob = new Blob([jsonString], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${(profile?.name || "candidate").toLowerCase().replace(/\s+/g, "_")}_profile.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	if (!profile && !rawJson) {
		return (
			<div className="p-8 text-center text-slate-400 text-sm">
				No structured profile extracted yet.
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Action Toolbar */}
			<div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
				<div>
					<h3 className="text-base font-bold text-slate-800">
						{profile?.name || "Candidate Profile"}
					</h3>
					<p className="text-xs text-slate-400">
						Validated structured extraction
					</p>
				</div>
				<div className="flex items-center space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleCopy}
						className="text-xs h-8 flex items-center space-x-1.5"
					>
						{copied ? (
							<Check className="w-3.5 h-3.5 text-emerald-600" />
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
						<span>{copied ? "Copied!" : "Copy JSON"}</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleDownload}
						className="text-xs h-8 flex items-center space-x-1.5"
					>
						<Download className="w-3.5 h-3.5" />
						<span>Download JSON</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setShowRawJson(!showRawJson)}
						className="text-xs h-8 text-slate-500"
					>
						{showRawJson ? "Visual View" : "View Raw JSON"}
					</Button>
				</div>
			</div>

			{showRawJson ? (
				<pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-x-auto font-mono max-h-[500px]">
					{jsonString}
				</pre>
			) : (
				<div className="space-y-6">
					{/* Contact Details */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
						{profile?.email && (
							<div className="flex items-center space-x-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
								<Mail className="w-4 h-4 text-indigo-500 shrink-0" />
								<span className="truncate">{profile.email}</span>
							</div>
						)}
						{profile?.phone && (
							<div className="flex items-center space-x-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
								<Phone className="w-4 h-4 text-indigo-500 shrink-0" />
								<span>{profile.phone}</span>
							</div>
						)}
					</div>

					{/* Summary */}
					{profile?.summary && (
						<div>
							<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
								Professional Summary
							</h4>
							<p className="text-sm text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
								{profile.summary}
							</p>
						</div>
					)}

					{/* Skills */}
					{profile?.skills && profile.skills.length > 0 && (
						<div>
							<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
								Extracted Skills ({profile.skills.length})
							</h4>
							<div className="flex flex-wrap gap-1.5">
								{profile.skills.map((skill) => (
									<span
										key={skill}
										className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100"
									>
										{skill}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Work Experience */}
					{profile?.experience && profile.experience.length > 0 && (
						<div>
							<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
								<Briefcase className="w-3.5 h-3.5 text-indigo-500" />
								<span>Work Experience</span>
							</h4>
							<div className="space-y-4">
								{profile.experience.map((exp) => (
									<div
										key={`${exp.company}-${exp.title}-${exp.dates || ""}`}
										className="p-3.5 rounded-xl border border-slate-200/70 bg-white shadow-2xs space-y-2"
									>
										<div className="flex flex-wrap items-baseline justify-between gap-1">
											<h5 className="text-sm font-semibold text-slate-800">
												{exp.title}
											</h5>
											<span className="text-xs text-slate-400 font-medium">
												{exp.dates}
											</span>
										</div>
										<div className="text-xs text-indigo-600 font-medium">
											{exp.company}
											{exp.location ? ` • ${exp.location}` : ""}
										</div>
										{exp.bullets && exp.bullets.length > 0 && (
											<ul className="list-disc list-inside space-y-1 text-xs text-slate-600 pt-1">
												{exp.bullets.map((bullet) => (
													<li key={bullet} className="leading-relaxed">
														{bullet}
													</li>
												))}
											</ul>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Education */}
					{profile?.education && profile.education.length > 0 && (
						<div>
							<h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
								<GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
								<span>Education</span>
							</h4>
							<div className="space-y-2.5">
								{profile.education.map((edu) => (
									<div
										key={`${edu.institution}-${edu.degree}`}
										className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
									>
										<div>
											<span className="font-semibold text-slate-800">
												{edu.degree}
											</span>
											<span className="text-slate-500 ml-1.5">
												at {edu.institution}
											</span>
										</div>
										{edu.dates && (
											<span className="text-slate-400 font-medium shrink-0">
												{edu.dates}
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
