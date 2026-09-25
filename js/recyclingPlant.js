import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { scene, camera, orbitControls, frameCallbacks } from "../script.js";
import { annotations as annotationsData, DEFAULT_VIEW } from "./recyclingPlantAnnotationsStore.js";
import { initOutline, setOutline, clearOutline } from "./recyclingPlantOutline.js";
import { setVoiceOverContext } from "./voiceOver.js";
import { renderPopupBody } from "./recyclingPlantPopup.js";
import { closeMedia } from "./mediaLibrary.js";
import { t, localize, onLangChange } from "./i18n.js";

const explodeButton = document.getElementById("explode-button");
const listPopup = document.getElementById("rp-list-popup");
const leaderLineSvg = document.getElementById("rp-leader-line-svg");
const infoPopup = document.getElementById("rp-info-popup");
const infoPopupClose = document.getElementById("rp-info-popup-close");
const infoPopupBadge = document.getElementById("rp-info-popup-badge");
const infoPopupTitle = document.getElementById("rp-info-popup-title");
const infoPopupBody = document.getElementById("rp-info-popup-body");
const infoPopupFooter = document.getElementById("rp-info-popup-footer");
const ENABLE_OCCLUSION = true;
const ENABLE_DECLUTTER = false;
const OCCLUSION_INTERVAL_MS = 250;
const DECLUTTER_INTERVAL_MS = 120;
const LABEL_GAP_PX = 4;
const VISIBLE_LABEL_BONUS = 1.5;
const OCCLUDED_LABEL_PENALTY = 1000;
const GHOST_COLOR = 0xe6eef0;
const GHOST_OPACITY = 1; // 0.3 for see-through, 1 for solid
const FRAMED_EPSILON = 0.05;

let activated = false;
let focusedId = null;
let popupAnn = null;
let flight = null;
let activation = null;
let meshByName = null;
let ghostMaterial = null;
const ghostedMeshes = [];

const occlusionRaycaster = new THREE.Raycaster();
let lastOcclusionCheck = 0;
let lastDeclutter = 0;
let hoveredId = null;

// id -> { listItem, dot?, dotEl?, label?, labelEl?, line?, anchor?, labelOffset? }
const markerEntries = new Map();

if (infoPopupClose) {
	infoPopupClose.addEventListener("click", closeInfoPopup);
}

onLangChange(() => {
	markerEntries.forEach(renderTitles);
	if (popupAnn) renderInfoPopup(popupAnn);
});

// ------------------------------------------- helpers -------------------------------------------

function getFile3D() {
	return scene.getObjectByName("file3D");
}

function waitForModel() {
	return new Promise((resolve) => {
		const check = () => {
			const file3D = getFile3D();
			if (file3D) resolve(file3D);
			else setTimeout(check, 200);
		};
		check();
	});
}

function buildMeshMap() {
	if (meshByName) return meshByName;
	const file3D = getFile3D();
	if (!file3D) return new Map();
	meshByName = new Map();
	const counts = new Map(); 
	file3D.traverse((child) => {
		if (!child.isMesh) return;
		const base = child.name && child.name.length ? child.name : "mesh";
		let name = base;
		if (meshByName.has(name)) {
			let n = (counts.get(base) || 1) + 1;
			name = `${base}__${n}`;
			while (meshByName.has(name)) name = `${base}__${++n}`;
			counts.set(base, n);
		} else {
			counts.set(base, 1);
		}
		child.name = name; 
		meshByName.set(name, child);
	});
	return meshByName;
}

export function getMeshMap() {
	return buildMeshMap();
}

function toVector3(point) {
	return new THREE.Vector3(point.x, point.y, point.z);
}

function isTaggable(ann) {
	return !ann.standalone && ann.anchor && ann.labelOffset;
}

function isFlyable(ann) {
	return !ann.standalone && ann.camera && ann.anchor;
}

// -------------------------------- leader-line screen-space projection --------------------------------
function worldToScreen(vector3) {
	const canvas = document.getElementById("myCanvas");
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const projected = vector3.clone().project(camera);
	return {
		x: (projected.x * 0.5 + 0.5) * width,
		y: (-projected.y * 0.5 + 0.5) * height,
	};
}

function updateLeaderLines() {
	const file3D = getFile3D();
	if (!file3D) return;

	markerEntries.forEach((entry) => {
		if (!entry.line) return;
		const a = worldToScreen(file3D.localToWorld(entry.anchor.clone()));
		const b = worldToScreen(file3D.localToWorld(entry.labelOffset.clone()));
		entry.line.setAttribute("x1", a.x);
		entry.line.setAttribute("y1", a.y);
		entry.line.setAttribute("x2", b.x);
		entry.line.setAttribute("y2", b.y);
	});
}

function updateOcclusion(now) {
	if (now - lastOcclusionCheck < OCCLUSION_INTERVAL_MS) return;
	lastOcclusionCheck = now;

	const file3D = getFile3D();
	if (!file3D) return;

	markerEntries.forEach((entry) => {
		if (!entry.anchor || !entry.dotEl) return;

		const worldAnchor = file3D.localToWorld(entry.anchor.clone());
		const ndc = worldAnchor.clone().project(camera);
		const onScreen =
			ndc.z < 1 && ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1;
		if (!onScreen) {
			entry.dotEl.classList.remove("rp-occluded");
			if (entry.labelEl) entry.labelEl.classList.remove("rp-occluded");
			return;
		}

		const dir = worldAnchor.clone().sub(camera.position);
		const dist = dir.length();
		dir.normalize();
		occlusionRaycaster.set(camera.position, dir);
		const hits = occlusionRaycaster.intersectObject(file3D, true);
		const occluded = hits.length > 0 && hits[0].distance < dist - 0.4;

		entry.dotEl.classList.toggle("rp-occluded", occluded);
		if (entry.labelEl) entry.labelEl.classList.toggle("rp-occluded", occluded);
	});
}

function labelRank(id, entry, file3D) {
	if (id === focusedId) return -Infinity;
	if (id === hoveredId) return -Number.MAX_VALUE;
	const distance = camera.position.distanceTo(file3D.localToWorld(entry.anchor.clone()));
	const occluded = entry.labelEl.classList.contains("rp-occluded") ? OCCLUDED_LABEL_PENALTY : 0;
	const visible = entry.labelEl.classList.contains("rp-collapsed") ? 0 : VISIBLE_LABEL_BONUS;
	return distance + occluded - visible;
}

function overlaps(a, b) {
	return (
		a.left < b.right + LABEL_GAP_PX &&
		b.left < a.right + LABEL_GAP_PX &&
		a.top < b.bottom + LABEL_GAP_PX &&
		b.top < a.bottom + LABEL_GAP_PX
	);
}

function setLabelCollapsed(entry, collapsed) {
	entry.labelEl.classList.toggle("rp-collapsed", collapsed);
	entry.line.classList.toggle("rp-collapsed", collapsed);
}

function declutterLabels(now) {
	if (now - lastDeclutter < DECLUTTER_INTERVAL_MS) return;
	lastDeclutter = now;

	const file3D = getFile3D();
	if (!file3D) return;

	const placed = [];
	[...markerEntries]
		.filter(([, entry]) => entry.labelEl)
		.map(([id, entry]) => ({ entry, rank: labelRank(id, entry, file3D) }))
		.sort((a, b) => a.rank - b.rank)
		.forEach(({ entry }) => {
			const rect = entry.labelEl.getBoundingClientRect();
			const collapsed = rect.width > 0 && placed.some((other) => overlaps(other, rect));
			setLabelCollapsed(entry, collapsed);
			if (!collapsed) placed.push(rect);
		});
}

function setHovered(id) {
	hoveredId = id;
	lastDeclutter = 0;
}

frameCallbacks.push(() => {
	if (!activated) return;
	const now = performance.now();
	updateLeaderLines();
	if (ENABLE_OCCLUSION) updateOcclusion(now);
	if (ENABLE_DECLUTTER) declutterLabels(now);
});

// ------------------------------------- markers + list creation -------------------------------------

function createMarkersAndList() {
	const file3D = getFile3D();
	const sorted = [...annotationsData].sort((a, b) => a.order - b.order);

	const header = document.createElement("div");
	header.className = "rp-list-header";
	header.dataset.i18n = "annotations.header";
	header.textContent = t("annotations.header");
	listPopup.appendChild(header);

	let currentGroup = null;
	sorted.forEach((ann) => {
		if (ann.group && ann.group !== currentGroup) {
			currentGroup = ann.group;
			const groupHeader = document.createElement("div");
			groupHeader.className = "rp-list-group";
			groupHeader.textContent = ann.group;
			listPopup.appendChild(groupHeader);
		}

		const item = document.createElement("div");
		item.className = "rp-list-item";
		item.dataset.id = ann.id;
		item.style.opacity = "0";
		item.innerHTML = `
			<span class="rp-list-item-badge">${ann.order}</span>
			<span class="rp-list-item-text">
				<span class="rp-list-item-title"></span>
			</span>
		`;
		item.addEventListener("click", () => onAnnotationPicked(ann.id));
		listPopup.appendChild(item);

		const entry = { ann, listItem: item, titleEls: [item.querySelector(".rp-list-item-title")] };

		if (isTaggable(ann)) {
			const anchorVec = toVector3(ann.anchor);
			const labelVec = toVector3(ann.labelOffset);

			const dotDiv = document.createElement("div");
			dotDiv.className = "rp-annotation-dot";
			dotDiv.style.opacity = "0";
			dotDiv.addEventListener("click", (event) => {
				event.stopPropagation();
				onAnnotationPicked(ann.id);
			});
			dotDiv.addEventListener("pointerenter", () => setHovered(ann.id));
			dotDiv.addEventListener("pointerleave", () => setHovered(null));
			const dotObj = new CSS2DObject(dotDiv);
			dotObj.position.copy(anchorVec);
			dotObj.name = `rp-dot-${ann.id}`;
			file3D.add(dotObj);

			const labelDiv = document.createElement("div");
			labelDiv.className = "rp-annotation-label";
			labelDiv.style.opacity = "0";
			labelDiv.innerHTML = `
				<span class="rp-annotation-badge">${ann.order}</span>
				<span class="rp-annotation-name"></span>
			`;
			labelDiv.addEventListener("click", (event) => {
				event.stopPropagation();
				onAnnotationPicked(ann.id);
			});
			const labelObj = new CSS2DObject(labelDiv);
			labelObj.position.copy(labelVec);
			labelObj.center.set(0.5, 1.0);
			labelObj.name = `rp-label-${ann.id}`;
			file3D.add(labelObj);

			const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			leaderLineSvg.appendChild(line);

			entry.dot = dotObj;
			entry.dotEl = dotDiv;
			entry.label = labelObj;
			entry.labelEl = labelDiv;
			entry.line = line;
			entry.anchor = anchorVec;
			entry.labelOffset = labelVec;
			entry.titleEls.push(labelDiv.querySelector(".rp-annotation-name"));
		}

		renderTitles(entry);
		markerEntries.set(ann.id, entry);
	});
}

function renderTitles(entry) {
	const title = localize(entry.ann.title);
	entry.titleEls.forEach((el) => (el.textContent = title));
	if (entry.dotEl) entry.dotEl.title = title;
}

function removeAllMarkers() {
	const file3D = getFile3D();
	markerEntries.forEach((entry) => {
		if (entry.dot) file3D.remove(entry.dot);
		if (entry.label) file3D.remove(entry.label);
		if (entry.line) leaderLineSvg.removeChild(entry.line);
	});
	markerEntries.clear();
	listPopup.innerHTML = "";
}

function staggerReveal() {
	const tl = gsap.timeline();
	Array.from(markerEntries.values()).forEach((entry, i) => {
		const delay = i * 0.06;
		if (entry.dotEl) tl.to(entry.dotEl, { opacity: 1, duration: 0.3 }, delay);
		if (entry.labelEl) tl.to(entry.labelEl, { opacity: 1, duration: 0.3 }, delay);
		tl.to(entry.listItem, { opacity: 1, duration: 0.3 }, delay);
	});
	return tl;
}

function staggerHide(onComplete) {
	const tl = gsap.timeline({ onComplete });
	Array.from(markerEntries.values()).forEach((entry, i) => {
		const delay = i * 0.03;
		if (entry.dotEl) tl.to(entry.dotEl, { opacity: 0, duration: 0.2 }, delay);
		if (entry.labelEl) tl.to(entry.labelEl, { opacity: 0, duration: 0.2 }, delay);
		tl.to(entry.listItem, { opacity: 0, duration: 0.2 }, delay);
	});
	return tl;
}

// ------------------------------------------- selection visuals -------------------------------------------

function setActiveStates(id) {
	markerEntries.forEach((entry, key) => {
		const isActive = key === id;
		entry.listItem.classList.toggle("active", isActive);
		if (entry.dotEl) entry.dotEl.classList.toggle("active", isActive);
		if (entry.labelEl) entry.labelEl.classList.toggle("active", isActive);
		if (entry.line) entry.line.classList.toggle("active", isActive);
	});
}

function dimOthers(id) {
	markerEntries.forEach((entry, key) => {
		const dim = id !== null && key !== id;
		entry.listItem.classList.toggle("rp-dim", dim);
		if (entry.dotEl) entry.dotEl.classList.toggle("rp-dim", dim);
		if (entry.labelEl) entry.labelEl.classList.toggle("rp-dim", dim);
		if (entry.line) entry.line.classList.toggle("rp-dim", dim);
	});
}

// ------------------------------------------- mesh highlight -------------------------------------------

function getGhostMaterial() {
	if (!ghostMaterial) {
		ghostMaterial = new THREE.MeshStandardMaterial({
			color: GHOST_COLOR,
			roughness: 1,
			metalness: 0,
			transparent: GHOST_OPACITY < 1,
			opacity: GHOST_OPACITY,
			depthWrite: true,
		});
	}
	return ghostMaterial;
}

function applyGhost(keep) {
	restoreGhost(); 
	const ghost = getGhostMaterial();
	buildMeshMap().forEach((mesh) => {
		if (keep.has(mesh)) return;
		if (mesh.userData.rpOrigMat === undefined) mesh.userData.rpOrigMat = mesh.material;
		mesh.material = ghost;
		ghostedMeshes.push(mesh);
	});
}

function restoreGhost() {
	ghostedMeshes.forEach((mesh) => {
		if (mesh.userData.rpOrigMat !== undefined) {
			mesh.material = mesh.userData.rpOrigMat;
			delete mesh.userData.rpOrigMat;
		}
	});
	ghostedMeshes.length = 0;
}

function applyMeshHighlight(meshNames) {
	if (!meshNames || meshNames.length === 0) return; 
	const map = buildMeshMap();
	const meshes = [];
	meshNames.forEach((name) => {
		const mesh = map.get(name);
		if (mesh) meshes.push(mesh);
	});
	if (!meshes.length) return;

	applyGhost(new Set(meshes));
	setOutline("highlight", meshes);
}

function restoreMeshHighlight() {
	restoreGhost();
	clearOutline("highlight");
}

// ------------------------------------------- info popup -------------------------------------------

function renderInfoPopup(ann) {
	if (infoPopupBadge) infoPopupBadge.textContent = ann.order;
	infoPopupTitle.textContent = localize(ann.title);
	renderPopupBody(infoPopupBody, infoPopupFooter, localize(ann.popup));
}

function openInfoPopup(ann) {
	popupAnn = ann;
	renderInfoPopup(ann);
	infoPopup.classList.add("active");
}

function closeInfoPopup() {
	popupAnn = null;
	infoPopup.classList.remove("active");
	closeMedia();
}

// ------------------------------------------- camera flight -------------------------------------------

function flyCamera(position, target, duration, onComplete) {
	flight?.kill();
	flight = gsap.timeline({
		onComplete: () => {
			flight = null;
			onComplete?.();
		},
	});
	flight.to(
		camera.position,
		{ x: position.x, y: position.y, z: position.z, duration, ease: "power2.inOut" },
		0
	);
	flight.to(
		orbitControls.target,
		{ x: target.x, y: target.y, z: target.z, duration, ease: "power2.inOut" },
		0
	);
	return flight;
}

function isAlreadyFramed(cam) {
	return (
		camera.position.distanceTo(toVector3(cam.position)) < FRAMED_EPSILON &&
		orbitControls.target.distanceTo(toVector3(cam.target)) < FRAMED_EPSILON
	);
}

function unlockControls() {
	orbitControls.enabled = true;
	explodeButton.disabled = false;
}

function clearFocus() {
	if (!focusedId) return;
	focusedId = null;
	setActiveStates(null);
	dimOthers(null);
	setVoiceOverContext(null);
	restoreMeshHighlight();
	closeInfoPopup();
}

function focusAnnotation(id) {
	const ann = annotationsData.find((a) => a.id === id);
	if (!ann) return Promise.resolve();

	if (focusedId && focusedId !== id) {
		restoreMeshHighlight();
		closeInfoPopup();
	}

	focusedId = id;
	lastDeclutter = 0;
	setActiveStates(id);
	dimOthers(id);
	setVoiceOverContext(id);

	return new Promise((resolve) => {
		const settle = () => {
			if (focusedId !== id) return;
			unlockControls();
			applyMeshHighlight(ann.meshNames);
			openInfoPopup(ann);
			resolve();
		};

		if (isAlreadyFramed(ann.camera)) {
			settle();
			return;
		}

		orbitControls.enabled = false;
		explodeButton.disabled = true;
		flyCamera(ann.camera.position, ann.camera.target, ann.camera.duration || 1.8, settle);
	});
}

function onAnnotationPicked(id) {
	if (!activated) return;
	const ann = annotationsData.find((a) => a.id === id);
	if (!ann) return;

	if (ann.standalone) {
		setActiveStates(id);
		openInfoPopup(ann);
		return;
	}

	if (!isFlyable(ann)) {
		console.warn(
			`[recyclingPlant] "${ann.id}" is not tagged yet (missing camera/anchor). Open the site with ?tag=1 to tag it.`
		);
		return;
	}

	focusAnnotation(id);
}

// ------------------------------------------- activate / deactivate -------------------------------------------

export function activateRecyclingPlant() {
	activation ??= (async () => {
		await waitForModel();
		buildMeshMap();
		initOutline();

		removeAllMarkers();
		createMarkersAndList();

		activated = true;
		listPopup.classList.add("active");
		staggerReveal();
	})();
	return activation;
}

export function deactivateRecyclingPlant() {
	if (!activated) return;
	activated = false;
	activation = null;
	clearFocus();

	staggerHide(() => {
		listPopup.classList.remove("active");
		removeAllMarkers();
	});

	flyCamera(DEFAULT_VIEW.position, DEFAULT_VIEW.target, 1.5);
}

// ------------------------------------------- tour api -------------------------------------------

export function getTourStops() {
	return annotationsData.filter(isFlyable).sort((a, b) => a.order - b.order);
}

export function getFocusedId() {
	return focusedId;
}

export function visitAnnotation(id) {
	return activated ? focusAnnotation(id) : Promise.resolve();
}

export function haltCamera() {
	if (!flight) return;
	flight.kill();
	flight = null;
	unlockControls();
	if (!popupAnn) clearFocus();
}

export function resetView(duration = 1.8) {
	unlockControls();
	clearFocus();
	return new Promise((resolve) => flyCamera(DEFAULT_VIEW.position, DEFAULT_VIEW.target, duration, resolve));
}
