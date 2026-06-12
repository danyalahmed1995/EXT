import React, { useEffect, useRef, useState } from "react";
import "./SettingsModal.css";
import { EXTIcon, GitHubIcon } from '../../icons/icons';
import { AppearanceSettings, LargeFileSettings, LargeFileThresholdPreset } from '../../types';
import { openUrl } from '@tauri-apps/plugin-opener';
import { SIMPLE_LARGE_FILE_THRESHOLD_OPTIONS, normalizeLargeFileSettings } from '../../utils/largeFile';

interface SettingsModalProps {
	appearance: AppearanceSettings;
	onUpdateAppearance: (settings: AppearanceSettings) => void;
	onClose: () => void;
	onRemoveAllWorkspaces: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
	appearance,
	onUpdateAppearance,
	onClose,
	onRemoveAllWorkspaces,
}) => {
	const [newDir, setNewDir] = useState("");
	const [isThresholdMenuOpen, setIsThresholdMenuOpen] = useState(false);
	const thresholdDropdownRef = useRef<HTMLDivElement | null>(null);
	const largeFileMode = normalizeLargeFileSettings(appearance.largeFileMode);

	useEffect(() => {
		if (!isThresholdMenuOpen) return;

		const handlePointerDown = (event: PointerEvent) => {
			if (!thresholdDropdownRef.current?.contains(event.target as Node)) {
				setIsThresholdMenuOpen(false);
			}
		};

		window.addEventListener("pointerdown", handlePointerDown);
		return () => window.removeEventListener("pointerdown", handlePointerDown);
	}, [isThresholdMenuOpen]);

	const handleToggle = (
		key: Exclude<keyof AppearanceSettings, "ignoredDirs" | "largeFileMode">,
	) => {
		onUpdateAppearance({
			...appearance,
			[key]: !appearance[key],
		});
	};

	const updateLargeFileMode = (settings: Partial<LargeFileSettings>) => {
		onUpdateAppearance({
			...appearance,
			largeFileMode: normalizeLargeFileSettings({
				...largeFileMode,
				...settings,
			}),
		});
	};

	const handleAddDir = () => {
		const trimmed = newDir.trim();
		if (!trimmed) return;
		if (appearance.ignoredDirs.includes(trimmed)) return;
		onUpdateAppearance({
			...appearance,
			ignoredDirs: [...appearance.ignoredDirs, trimmed],
		});
		setNewDir("");
	};

	const handleRemoveDir = (dir: string) => {
		onUpdateAppearance({
			...appearance,
			ignoredDirs: appearance.ignoredDirs.filter((d) => d !== dir),
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleAddDir();
		}
	};

	const openLink = async (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
		e.preventDefault();
		try {
			await openUrl(url);
		} catch (err) {
			console.error("Failed to open link:", err);
		}
	};

	const selectedThresholdLabel = SIMPLE_LARGE_FILE_THRESHOLD_OPTIONS.find(
		(option) => option.value === largeFileMode.thresholdPreset,
	)?.label ?? "100 MB";

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div
				className="modal-content settings-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h2>Settings</h2>
					<button
						className="icon-btn close-btn"
						onClick={onClose}
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<div className="modal-body">
					<section className="settings-section">
						<h3>Appearance & Performance</h3>
						<p className="settings-desc">
							Customize EXT's visual effects and animations.
						</p>

						<div className="settings-toggles">
							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.animations}
									onChange={() => handleToggle("animations")}
								/>
								<span className="toggle-label">
									Enable animations
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.premiumEffects}
									onChange={() =>
										handleToggle("premiumEffects")
									}
								/>
								<span className="toggle-label">
									Enable premium visual effects
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.smoothTabs}
									onChange={() => handleToggle("smoothTabs")}
								/>
								<span className="toggle-label">
									Enable smooth tab transitions
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.sidebarHover}
									onChange={() =>
										handleToggle("sidebarHover")
									}
								/>
								<span className="toggle-label">
									Enable sidebar hover effects
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.editorFocus}
									onChange={() => handleToggle("editorFocus")}
								/>
								<span className="toggle-label">
									Enable editor focus effects
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.previewTransitions}
									onChange={() =>
										handleToggle("previewTransitions")
									}
								/>
								<span className="toggle-label">
									Enable preview transition effects
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={appearance.reduceMotion}
									onChange={() =>
										handleToggle("reduceMotion")
									}
								/>
								<span className="toggle-label">
									Reduce motion mode
								</span>
							</label>

							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={!!appearance.previewCentered}
									onChange={() => handleToggle("previewCentered")}
								/>
								<span className="toggle-label">
									Center preview content (reading mode)
								</span>
							</label>

							<label className="settings-toggle settings-toggle-divider">
								<input
									type="checkbox"
									checked={!!appearance.enableProfiler}
									onChange={() => handleToggle("enableProfiler")}
								/>
								<span className="toggle-label">
									Enable Navigation Profiler (Debug)
								</span>
							</label>
						</div>
					</section>

					<section className="settings-section">
						<h3>Large Files</h3>
						<p className="settings-desc">
							Open very large files in safe mode without loading the full document.
						</p>

						<div className="settings-toggles large-file-settings">
							<label className="settings-toggle">
								<input
									type="checkbox"
									checked={largeFileMode.autoEnable}
									onChange={() => updateLargeFileMode({ autoEnable: !largeFileMode.autoEnable })}
								/>
								<span className="toggle-copy">
									<span className="toggle-label">Open very large files in safe mode</span>
									<span className="toggle-desc">Prevents huge files from entering the normal editor, preview, outline, and math renderer.</span>
								</span>
							</label>

							<div className="settings-field-row">
								<label htmlFor="large-file-threshold">Large file threshold</label>
								<div className="settings-field-controls">
									<div
										className="settings-select"
										ref={thresholdDropdownRef}
									>
										<button
											id="large-file-threshold"
											type="button"
											className={`settings-select-trigger ${isThresholdMenuOpen ? "open" : ""}`}
											aria-haspopup="listbox"
											aria-expanded={isThresholdMenuOpen}
											onClick={() => setIsThresholdMenuOpen((open) => !open)}
										>
											<span>{selectedThresholdLabel}</span>
											<span className="settings-select-chevron" aria-hidden="true">⌄</span>
										</button>
										{isThresholdMenuOpen && (
											<div className="settings-select-menu" role="listbox" aria-labelledby="large-file-threshold">
												{SIMPLE_LARGE_FILE_THRESHOLD_OPTIONS.map((option) => (
													<button
														key={option.value}
														type="button"
														role="option"
														aria-selected={option.value === largeFileMode.thresholdPreset}
														className={`settings-select-option ${option.value === largeFileMode.thresholdPreset ? "selected" : ""}`}
														onClick={() => {
															updateLargeFileMode({ thresholdPreset: option.value as LargeFileThresholdPreset });
															setIsThresholdMenuOpen(false);
														}}
													>
														{option.label}
													</button>
												))}
											</div>
										)}
									</div>
								</div>
								<p className="settings-inline-desc">
									Files above this size open in Large File Mode. The default is 100 MB.
								</p>
							</div>
						</div>
					</section>

					<section className="settings-section">
						<h3>Ignored Directories</h3>
						<p className="settings-desc">
							Directories skipped during workspace scanning.
							Add or remove entries below.
						</p>

						<div className="ignored-dirs-input-row">
							<input
								className="ignored-dirs-input"
								type="text"
								value={newDir}
								onChange={(e) => setNewDir(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="e.g. .cache, vendor"
							/>
							<button
								className="btn btn-add-dir"
								onClick={handleAddDir}
								disabled={!newDir.trim()}
							>
								Add
							</button>
						</div>

						<div className="ignored-dirs-list">
							{appearance.ignoredDirs.map((dir) => (
								<span key={dir} className="ignored-dir-badge">
									{dir}
									<button
										className="ignored-dir-remove"
										onClick={() => handleRemoveDir(dir)}
										aria-label={`Remove ${dir}`}
									>
										✕
									</button>
								</span>
							))}
						</div>
					</section>

					<section className="settings-section danger-zone">
						<h3>Danger Zone</h3>
						<div className="danger-action">
							<div>
								<h4>Remove All Workspaces</h4>
								<p className="settings-desc">
									Removes all folders from EXT. Your local
									files will NOT be deleted from disk.
								</p>
							</div>
							<button
								className="btn btn-danger"
								onClick={() => {
									if (
										window.confirm(
											"Are you sure you want to remove all workspaces from EXT?",
										)
									) {
										onRemoveAllWorkspaces();
										onClose();
									}
								}}
							>
								Remove All
							</button>
						</div>
					</section>

					<section className="settings-section about-section">
						<a
							href="https://github.com/danyalahmed1995/EXT"
							onClick={(e) => openLink(e, "https://github.com/danyalahmed1995/EXT")}
							className="about-link"
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								color: "var(--color-text-secondary)",
								textDecoration: "none",
								transition: "color 0.2s",
								cursor: "pointer",
							}}
						>
							<EXTIcon size={20} />
							<span>EXT Repository</span>
						</a>
						<a
							href="https://github.com/danyalahmed1995/"
							onClick={(e) => openLink(e, "https://github.com/danyalahmed1995/")}
							className="about-link"
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								color: "var(--color-text-secondary)",
								textDecoration: "none",
								transition: "color 0.2s",
								cursor: "pointer",
							}}
						>
							<GitHubIcon size={20} />
							<span>Author</span>
						</a>
					</section>
				</div>
			</div>
		</div>
	);
};
