import mediaItems from "./mediaItems.js";
import { t, localize, onLangChange } from "./i18n.js";
import { createPdfViewer } from "./pdfViewer.js";

const PDFJS_URL = new URL("../vendor/pdfjs/pdf.min.mjs", import.meta.url).href;
const PDFJS_WORKER_URL = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
const THUMB_WIDTH = 480;

const root = document.getElementById("media-library");
const el = {
	title: document.getElementById("media-title"),
	counter: document.getElementById("media-counter"),
	back: document.getElementById("media-back"),
	close: document.getElementById("media-close"),
	fullscreen: document.getElementById("media-fullscreen"),
	fullscreenExit: document.getElementById("media-fullscreen-exit"),
	grid: document.getElementById("media-grid"),
	stage: document.getElementById("media-stage"),
	prev: document.getElementById("media-prev"),
	next: document.getElementById("media-next"),
	pdf: document.getElementById("media-pdf"),
	video: document.getElementById("video"),
};

const pdfThumbs = new Map();
let pdfjs = null;
const pdfViewer = createPdfViewer(el.pdf, loadPdfjs);

let type = null;
let items = [];
let index = -1;
let direct = false;
let gridKey = null;
let loadedSrc = null;

function isOpen() {
	return root.classList.contains("active");
}

function typeOf(src) {
	return /\.pdf$/i.test(src) ? "pdf" : "video";
}

function formatDuration(seconds) {
	const s = Math.round(seconds);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ------------------------------------------- thumbnails -------------------------------------------

function loadPdfjs() {
	pdfjs ??= import(PDFJS_URL).then((lib) => {
		lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
		return lib;
	});
	return pdfjs;
}

async function renderPdfThumb(src) {
	const { getDocument } = await loadPdfjs();
	const pdf = await getDocument(src).promise;
	try {
		const page = await pdf.getPage(1);
		const viewport = page.getViewport({ scale: THUMB_WIDTH / page.getViewport({ scale: 1 }).width });
		const canvas = document.createElement("canvas");
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
		return canvas.toDataURL("image/jpeg", 0.85);
	} finally {
		pdf.destroy();
	}
}

function fillPdfThumb(thumb, src) {
	if (!pdfThumbs.has(src)) pdfThumbs.set(src, renderPdfThumb(src));
	pdfThumbs
		.get(src)
		.then((url) => {
			const image = new Image();
			image.src = url;
			image.alt = "";
			thumb.appendChild(image);
		})
		.catch(() => thumb.classList.add("is-fallback"));
}

function fillVideoThumb(thumb, src) {
	const video = document.createElement("video");
	video.muted = true;
	video.preload = "metadata";
	video.src = `${src}#t=1`;

	const duration = document.createElement("span");
	duration.className = "media-duration";
	video.addEventListener("loadedmetadata", () => (duration.textContent = formatDuration(video.duration)), { once: true });

	thumb.append(video, duration);
}

// ------------------------------------------- render -------------------------------------------

function createCard(item, i) {
	const src = localize(item.src);
	const card = document.createElement("button");
	card.type = "button";
	card.className = "media-card";
	card.innerHTML = `
		<div class="media-thumb media-thumb-${type}"></div>
		<div class="media-card-title"></div>
	`;
	card.querySelector(".media-card-title").textContent = localize(item.title);

	const thumb = card.querySelector(".media-thumb");
	if (type === "pdf") fillPdfThumb(thumb, src);
	else fillVideoThumb(thumb, src);

	card.addEventListener("click", () => show(i));
	return card;
}

function renderGrid() {
	const key = `${type}:${document.documentElement.lang}`;
	if (gridKey === key) return;
	gridKey = key;
	el.grid.replaceChildren(...items.map(createCard));
}

function renderHeader() {
	const inViewer = index >= 0;
	el.title.textContent = inViewer ? localize(items[index].title) : t(`media.${type}`);
	el.counter.textContent = inViewer && !direct ? `${index + 1} / ${items.length}` : "";
	el.prev.disabled = index <= 0;
	el.next.disabled = index >= items.length - 1;
}

function render() {
	root.dataset.type = type;
	root.dataset.view = index >= 0 ? "viewer" : "grid";
	root.classList.toggle("is-direct", direct);
	if (index < 0) renderGrid();
	renderHeader();
}

// ------------------------------------------- media element -------------------------------------------

// The video's own fullscreen only shows the bare <video>, so nothing (like our X) can sit on top of it.
// Instead the stage goes fullscreen: the video plus an always-visible X button.
function isFullscreen() {
	return document.fullscreenElement === el.stage;
}

function toggleFullscreen() {
	if (isFullscreen()) document.exitFullscreen();
	else el.stage.requestFullscreen().catch(() => {});
}

function exitFullscreen() {
	if (isFullscreen()) document.exitFullscreen();
}

function unloadMedia() {
	exitFullscreen();
	loadedSrc = null;
	el.video.pause();
	el.video.removeAttribute("src");
	el.video.load();
	pdfViewer.close();
}

function loadMedia(src) {
	if (src === loadedSrc) return;
	unloadMedia();
	loadedSrc = src;
	if (type === "pdf") {
		pdfViewer.open(src).catch((error) => console.error("[mediaLibrary] PDF failed to load", error));
	} else {
		el.video.src = src;
		el.video.play().catch(() => {});
	}
}

// ------------------------------------------- navigation -------------------------------------------

function show(i) {
	if (i < 0 || i >= items.length) return;
	index = i;
	loadMedia(localize(items[i].src));
	gsap.fromTo(el.stage, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.out" });
	render();
}

function step(delta) {
	if (index >= 0) show(index + delta);
}

function backToGrid() {
	index = -1;
	unloadMedia();
	render();
}

function open(nextType, nextItems, nextIndex, isDirect) {
	if (type !== nextType) gridKey = null;
	type = nextType;
	items = nextItems;
	direct = isDirect;
	index = -1;
	root.classList.add("active");
	if (nextIndex >= 0) show(nextIndex);
	else render();
}

export function openLibrary(libraryType) {
	open(libraryType, mediaItems[libraryType], -1, false);
}

export function openMedia(src, title) {
	open(typeOf(src), [{ src, title }], 0, true);
}

export function closeMedia() {
	if (!isOpen()) return;
	root.classList.remove("active");
	unloadMedia();
	document.dispatchEvent(new CustomEvent("mediaclose"));
}

// ------------------------------------------- events -------------------------------------------

el.back.addEventListener("click", backToGrid);
el.close.addEventListener("click", closeMedia);
el.prev.addEventListener("click", () => step(-1));
el.next.addEventListener("click", () => step(1));
el.fullscreen.addEventListener("click", toggleFullscreen);
el.fullscreenExit.addEventListener("click", exitFullscreen);

// Double-click would open the browser's bare-video fullscreen; route it to ours. No right-click "Save video as".
el.video.addEventListener("dblclick", (event) => {
	event.preventDefault();
	toggleFullscreen();
});
el.video.addEventListener("contextmenu", (event) => event.preventDefault());

root.addEventListener("click", (event) => {
	if (event.target === root) closeMedia();
});

document.addEventListener("keydown", (event) => {
	if (!isOpen()) return;
	if (event.key === "Escape") {
		if (!document.fullscreenElement) closeMedia(); // in fullscreen, Esc only leaves fullscreen
	}
	else if (event.target === el.video) return;
	else if (event.key === "ArrowLeft") step(-1);
	else if (event.key === "ArrowRight") step(1);
});

onLangChange(() => {
	if (!isOpen()) return;
	if (index >= 0) loadMedia(localize(items[index].src));
	render();
});
