// Canvas PDF viewer (pdf.js). Replaces the browser's built-in viewer so zoom can be clamped:
// the smallest zoom is "fit to width" (the page at its full size), zooming in goes up to MAX_ZOOM.
// Zoom: Ctrl/⌘ + wheel, Ctrl/⌘ + plus/minus/0, trackpad pinch, touch pinch. Drag with the mouse to pan while zoomed.

const MAX_ZOOM = 4;
const PAGE_GAP = 12; // px between pages and around them
const MAX_CANVAS_PIXELS = 16e6; // per page; keeps memory sane at high zoom on HiDPI screens
const RENDER_DELAY_MS = 150; // re-render sharply once zooming pauses
const WHEEL_ZOOM_SPEED = 0.002;
const KEY_ZOOM_STEP = 1.25; // Ctrl/⌘ + plus / minus

export function createPdfViewer(container, loadPdfjs) {
	const inner = document.createElement("div");
	inner.className = "media-pdf-pages";
	container.appendChild(inner);

	let pdf = null;
	let pages = []; // { page, width, height, wrap, canvas, task, renderedScale }
	let zoom = 1;
	let fitScale = 1;
	let token = 0;
	let renderTimer = null;

	// ------------------------------------------- layout + render -------------------------------------------

	function computeFitScale() {
		const widest = Math.max(...pages.map((p) => p.width));
		return Math.max(container.clientWidth - PAGE_GAP * 2, 1) / widest;
	}

	function layout() {
		const scale = fitScale * zoom;
		pages.forEach((p) => {
			p.wrap.style.width = `${p.width * scale}px`;
			p.wrap.style.height = `${p.height * scale}px`;
		});
		container.classList.toggle("is-zoomed", zoom > 1);
	}

	function renderPage(p) {
		const dpr = window.devicePixelRatio || 1;
		const wanted = fitScale * zoom * dpr;
		const capped = Math.sqrt(MAX_CANVAS_PIXELS / (p.width * p.height));
		const scale = Math.min(wanted, capped);
		if (Math.abs(scale - p.renderedScale) < 0.01) return;

		p.task?.cancel();
		const viewport = p.page.getViewport({ scale });
		const canvas = document.createElement("canvas");
		canvas.width = Math.floor(viewport.width);
		canvas.height = Math.floor(viewport.height);
		p.task = p.page.render({ canvasContext: canvas.getContext("2d"), viewport });
		p.task.promise
			.then(() => {
				p.canvas.replaceWith(canvas); // swap only when done, so the old (blurrier) image stays visible meanwhile
				p.canvas = canvas;
				p.renderedScale = scale;
			})
			.catch(() => {}); // cancelled by a newer render
	}

	function renderAll() {
		clearTimeout(renderTimer);
		pages.forEach(renderPage);
	}

	function scheduleRender() {
		clearTimeout(renderTimer);
		renderTimer = setTimeout(renderAll, RENDER_DELAY_MS);
	}

	// ------------------------------------------- zoom -------------------------------------------

	/** Zooms around a screen point so the spot under the cursor / fingers stays put. */
	function setZoom(next, clientX, clientY) {
		next = Math.min(Math.max(next, 1), MAX_ZOOM);
		if (!pages.length || Math.abs(next - zoom) < 1e-3) return;

		const rect = container.getBoundingClientRect();
		const x = (clientX ?? rect.left + rect.width / 2) - rect.left;
		const y = (clientY ?? rect.top + rect.height / 2) - rect.top;
		const ratio = next / zoom;
		const scrollLeft = (container.scrollLeft + x) * ratio - x;
		const scrollTop = (container.scrollTop + y) * ratio - y;

		zoom = next;
		layout();
		container.scrollLeft = scrollLeft;
		container.scrollTop = scrollTop;
		scheduleRender();
	}

	function isActive() {
		return pages.length > 0 && container.offsetParent !== null;
	}

	// While a PDF is open, every zoom gesture goes to the PDF (and is clamped) instead of zooming the
	// whole web page — also when the cursor is outside the PDF area or the keyboard is used.
	window.addEventListener(
		"wheel",
		(event) => {
			if (!isActive() || (!event.ctrlKey && !event.metaKey)) return; // plain wheel scrolls as usual
			event.preventDefault();
			const inside = container.contains(event.target);
			setZoom(
				zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED),
				inside ? event.clientX : undefined,
				inside ? event.clientY : undefined
			);
		},
		{ passive: false }
	);

	window.addEventListener("keydown", (event) => {
		if (!isActive() || (!event.ctrlKey && !event.metaKey)) return;
		const step = { "+": KEY_ZOOM_STEP, "=": KEY_ZOOM_STEP, "-": 1 / KEY_ZOOM_STEP, "0": 0 }[event.key];
		if (step === undefined) return;
		event.preventDefault();
		setZoom(step === 0 ? 1 : zoom * step);
	});

	// Touch pinch (two pointers) and mouse drag-to-pan. One-finger touch scrolling stays native.
	const pointers = new Map();
	let pinch = null;
	let drag = null;

	container.addEventListener("pointerdown", (event) => {
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
			drag = null;
		} else if (event.pointerType === "mouse" && event.button === 0 && zoom > 1) {
			drag = { x: event.clientX, y: event.clientY };
			container.setPointerCapture(event.pointerId);
			container.classList.add("is-dragging");
		}
	});

	container.addEventListener("pointermove", (event) => {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pinch && pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			const distance = Math.hypot(a.x - b.x, a.y - b.y);
			setZoom(pinch.zoom * (distance / pinch.distance), (a.x + b.x) / 2, (a.y + b.y) / 2);
		} else if (drag) {
			container.scrollLeft -= event.clientX - drag.x;
			container.scrollTop -= event.clientY - drag.y;
			drag = { x: event.clientX, y: event.clientY };
		}
	});

	const endPointer = (event) => {
		pointers.delete(event.pointerId);
		if (pointers.size < 2) pinch = null;
		if (drag) {
			drag = null;
			container.classList.remove("is-dragging");
		}
	};
	container.addEventListener("pointerup", endPointer);
	container.addEventListener("pointercancel", endPointer);

	new ResizeObserver(() => {
		if (!pages.length) return;
		fitScale = computeFitScale();
		layout();
		scheduleRender();
	}).observe(container);

	// ------------------------------------------- open / close -------------------------------------------

	async function open(src) {
		close();
		const current = ++token;
		const { getDocument } = await loadPdfjs();
		const doc = await getDocument(src).promise;
		if (current !== token) return doc.destroy();
		pdf = doc;

		const loaded = await Promise.all(
			Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1))
		);
		if (current !== token) return;

		pages = loaded.map((page) => {
			const { width, height } = page.getViewport({ scale: 1 });
			const wrap = document.createElement("div");
			wrap.className = "media-pdf-page";
			const canvas = document.createElement("canvas");
			wrap.appendChild(canvas);
			inner.appendChild(wrap);
			return { page, width, height, wrap, canvas, task: null, renderedScale: 0 };
		});
		zoom = 1;
		fitScale = computeFitScale();
		layout();
		renderAll();
	}

	function close() {
		token++;
		clearTimeout(renderTimer);
		pages.forEach((p) => p.task?.cancel());
		pages = [];
		inner.replaceChildren();
		pdf?.destroy();
		pdf = null;
		zoom = 1;
		pointers.clear();
		pinch = drag = null;
		container.classList.remove("is-zoomed", "is-dragging");
		container.scrollTop = container.scrollLeft = 0;
	}

	return { open, close };
}
