/** biome-ignore-all lint/a11y/noStaticElementInteractions: 67 */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: 67 */
import {
	IconAlertCircle as AlertCircle,
	IconCheck as CheckCircle2,
	IconFile as FileIcon,
	IconFileText as FileText,
	IconImageInPicture as ImageIcon,
	IconUpload as Upload,
	IconX as X,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { axios } from "#/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

interface SingleUploadState {
	file: File;
	progress: number;
	status: "uploading" | "completed" | "error";
	errorMessage?: string;
	prompt?: string; // 1. Added prompt to state interface
}

const ALLOWED_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function Home() {
	const [fileState, setFileState] = useState<SingleUploadState | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadFile = async (file: File) => {
		// 1. Validation
		if (!ALLOWED_TYPES.includes(file.type)) {
			alert(
				`"${file.name}" is not a supported file type. (PDF, PNG, JPG, WEBP only)`,
			);
			return;
		}

		if (file.size > MAX_FILE_SIZE_BYTES) {
			alert(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
			return;
		}

		// 2. Set initial state
		setFileState({
			file,
			progress: 0,
			status: "uploading",
		});

		const formData = new FormData();
		formData.append("file", file);

		// 3. Perform network upload with Axios progress tracking
		try {
			const response = await axios.post("/api/v1/files", formData, {
				headers: {
					"Content-Type": "multipart/form-data",
				},
				onUploadProgress: (progressEvent) => {
					if (progressEvent.total) {
						const progress = Math.round(
							(progressEvent.loaded * 100) / progressEvent.total,
						);
						setFileState((prev) => (prev ? { ...prev, progress } : null));
					}
				},
			});

			console.log("Upload successful:", response.data?.data[0]);

			// 2. Extract and store response.data.prompt in state
			setFileState((prev) =>
				prev
					? {
							...prev,
							progress: 100,
							status: "completed",
							prompt: response.data?.data[0],
						}
					: null,
			);
		} catch (error) {
			console.error("Upload error:", error);
			setFileState((prev) =>
				prev
					? {
							...prev,
							status: "error",
							errorMessage: "Failed to upload file. Please try again.",
						}
					: null,
			);
		}
	};

	const removeFile = () => {
		setFileState(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	// Drag and Drop Event Handlers
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

	return (
		<div className="min-h-screen bg-slate-50 p-6 md:p-12 flex justify-center items-start">
			<div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
				{/* Header */}
				<div className="mb-6">
					<h1 className="text-2xl font-bold text-slate-800">Upload File</h1>
					<p className="text-sm text-slate-500 mt-1">
						Upload your document or image to get started.
					</p>
				</div>

				{/* Drop Zone */}
				<div
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					onClick={() => fileInputRef.current?.click()}
					className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ease-in-out ${
						isDragging
							? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
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
						<div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
							<Upload className="w-8 h-8" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-700">
								<span className="text-indigo-600 hover:underline">
									Click to upload
								</span>{" "}
								or drag and drop
							</p>
							<p className="text-xs text-slate-400 mt-1">
								PDF, PNG, JPG or WEBP (Max {MAX_FILE_SIZE_MB}MB)
							</p>
						</div>
					</div>
				</div>

				{/* Selected File Details */}
				{fileState && (
					<div className="mt-6">
						<h2 className="text-sm font-semibold text-slate-600 mb-3">
							Uploaded File
						</h2>
						<div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-xl transition-all">
							<div className="flex items-center space-x-3 overflow-hidden mr-4 flex-1">
								<div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm shrink-0">
									{getFileIcon(fileState.file.type)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-slate-800 truncate">
										{fileState.file.name}
									</p>
									<div className="flex items-center space-x-2 mt-0.5">
										<span className="text-xs text-slate-400">
											{formatFileSize(fileState.file.size)}
										</span>
										<span className="text-slate-300">•</span>
										<span className="text-xs font-medium text-slate-500 capitalize">
											{fileState.status === "uploading"
												? `${fileState.progress}%`
												: fileState.status}
										</span>
									</div>

									{/* Progress Bar */}
									{fileState.status === "uploading" && (
										<div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
											<div
												className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
												style={{ width: `${fileState.progress}%` }}
											/>
										</div>
									)}

									{/* Error Message */}
									{fileState.status === "error" && fileState.errorMessage && (
										<p className="text-xs text-rose-500 mt-1">
											{fileState.errorMessage}
										</p>
									)}
								</div>
							</div>

							{/* Status Icons & Delete Action */}
							<div className="flex items-center space-x-3">
								{fileState.status === "completed" && (
									<CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
								)}
								{fileState.status === "error" && (
									<AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
								)}
								<Button
									variant="ghost"
									size="icon"
									onClick={(e) => {
										e.stopPropagation();
										removeFile();
									}}
									className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
								>
									<X className="w-5 h-5" />
								</Button>
							</div>
						</div>

						{/* 3. Prompt Response UI Card */}
						{
							<div className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
								<h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-900 mb-1">
									Generated Prompt
								</h3>
								<p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
									{fileState.prompt || ""}
								</p>
							</div>
						}
					</div>
				)}
			</div>
		</div>
	);
}
