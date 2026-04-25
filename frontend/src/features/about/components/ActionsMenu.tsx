import { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/useToast";
import { rpc } from "../rpc";
import type { ProductInfo } from "../types";

type ActionsMenuProps = {
	product: ProductInfo | undefined;
};

export function ActionsMenu({ product }: ActionsMenuProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onDocClick = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [open]);

	async function copyInfo() {
		await rpc.copyVersionInfo();
		toast.show("Copied", "Version info copied to clipboard.");
		setOpen(false);
	}

	async function openUrl(url: string | undefined) {
		if (!url) {
			return;
		}
		await rpc.openUrl(url);
		setOpen(false);
	}

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-label="More actions"
				onClick={() => setOpen((o) => !o)}
				className="px-2 py-1 rounded"
				style={{
					color: "var(--vscode-descriptionForeground)",
				}}
			>
				⋯
			</button>
			{open && (
				<div
					role="menu"
					className="absolute right-0 mt-1 py-1 rounded shadow-md min-w-48 z-10"
					style={{
						background: "var(--vscode-menu-background)",
						color: "var(--vscode-menu-foreground)",
						border: "1px solid var(--vscode-menu-border)",
					}}
				>
					<MenuItem onClick={copyInfo}>Copy version info</MenuItem>
					<MenuItem onClick={() => openUrl(product?.licenseUrl)}>License</MenuItem>
					<MenuItem onClick={() => openUrl(product?.issuesUrl)}>Report issue</MenuItem>
					<MenuItem onClick={() => openUrl(product?.repo)}>View on GitHub</MenuItem>
				</div>
			)}
		</div>
	);
}

function MenuItem({
	onClick,
	children,
}: {
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80"
			style={{
				background: "transparent",
			}}
		>
			{children}
		</button>
	);
}
