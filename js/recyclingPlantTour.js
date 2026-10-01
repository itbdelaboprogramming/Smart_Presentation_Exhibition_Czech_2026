import {
	activateRecyclingPlant,
	getTourStops,
	getFocusedId,
	visitAnnotation,
	haltCamera,
	resetView,
} from "./recyclingPlant.js";

const DWELL_SECONDS = 6;
const INTERRUPT_TARGETS = [
	"#myCanvas",
	".rp-annotation-dot",
	".rp-annotation-label",
	"#rp-list-popup",
	"#rp-info-popup",
	".pdf_container",
].join(",");

const explodeButton = document.getElementById("explode-button");
const controls = document.getElementById("tour-controls");
const playButton = document.getElementById("tour-play");
const prevButton = document.getElementById("tour-prev");
const nextButton = document.getElementById("tour-next");
const stopButton = document.getElementById("tour-stop");

let stops = [];
let index = -1;
let playing = false;
let run = 0;
let dwell = null;

function setPlaying(value) {
	playing = value;
	controls.classList.toggle("is-playing", value);
}

function cancelPending() {
	run++;
	dwell?.kill();
	dwell = null;
}

async function ensureActive() {
	if (!explodeButton.classList.contains("active")) explodeButton.click();
	await activateRecyclingPlant();
	stops = getTourStops();
}

function currentIndex() {
	const focused = stops.findIndex((stop) => stop.id === getFocusedId());
	return focused >= 0 ? focused : index;
}

async function visit(i) {
	cancelPending();
	const token = run;
	index = i;
	await visitAnnotation(stops[i].id);
	if (!playing || token !== run) return;
	dwell = gsap.delayedCall(stops[i].dwell ?? DWELL_SECONDS, advance);
}

async function finish() {
	cancelPending();
	const token = run;
	index = -1;
	await resetView();
	if (token === run) setPlaying(false);
}

function advance() {
	if (index + 1 < stops.length) visit(index + 1);
	else finish();
}

async function play() {
	setPlaying(true);
	await ensureActive();
	if (!playing) return;
	if (!stops.length) {
		setPlaying(false);
		return;
	}
	visit(Math.max(currentIndex(), 0));
}

function stop() {
	cancelPending();
	setPlaying(false);
}

function goHome() {
	stop();
	index = -1;
	resetView();
}

async function step(delta) {
	await ensureActive();
	if (!stops.length) return;
	const target = currentIndex() + delta;
	if (target >= stops.length) finish();
	else visit(Math.max(target, 0));
}

function interrupt(event) {
	if (!playing || !event.target.closest?.(INTERRUPT_TARGETS)) return;
	stop();
	haltCamera();
}

playButton.addEventListener("click", () => (playing ? stop() : play()));
prevButton.addEventListener("click", () => step(-1));
nextButton.addEventListener("click", () => step(1));
stopButton.addEventListener("click", goHome);

// A new parts filter changes the stop list, so the next play/step starts from its first part.
document.addEventListener("groupchange", () => (index = -1));

document.addEventListener("pointerdown", interrupt, true);
document.addEventListener("wheel", interrupt, { capture: true, passive: true });

explodeButton.addEventListener("click", (event) => {
	if (!event.isTrusted) return;
	stop();
	index = -1;
});
