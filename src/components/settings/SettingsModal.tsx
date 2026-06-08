import React, { useState } from "react";
import "./SettingsModal.css";
import { AppearanceSettings } from "../../types";

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

	const handleToggle = (
		key: Exclude<keyof AppearanceSettings, "ignoredDirs">,
	) => {
		onUpdateAppearance({
			...appearance,
			[key]: !appearance[key],
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
				</div>
			</div>
		</div>
	);
};
