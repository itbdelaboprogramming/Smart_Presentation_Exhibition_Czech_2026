const API_BASE = "./api/annotations";

// Must match AnnotationSync::FIELDS in api/lib/AnnotationSync.php.
export const SYNC_FIELDS = ["order", "group", "title", "meshNames", "anchor", "labelOffset", "camera"];

async function postJSON(endpoint, payload) {
	const res = await fetch(`${API_BASE}/${endpoint}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
	return data;
}

/**
 * Sync the full annotation list into js/recyclingPlantAnnotations.js. Popups are kept server-side.
 * @returns {Promise<{created: string[], updated: string[], removed: string[]}>}
 */
export function saveAnnotations(annotations) {
	const payload = annotations.map((ann) => {
		const item = { id: ann.id };
		SYNC_FIELDS.forEach((field) => {
			item[field] = ann[field] ?? null;
		});
		item.meshNames ??= [];
		if (typeof item.title === "string") item.title = { en: item.title };
		return item;
	});
	return postJSON("save.php", { annotations: payload });
}
