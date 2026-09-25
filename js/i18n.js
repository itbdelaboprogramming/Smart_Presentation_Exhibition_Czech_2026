import messages from "./i18nMessages.js";

export const LANGS = ["en", "ja"];
const FALLBACK = "en";
const STORAGE_KEY = "lang";

const switcher = document.getElementById("lang-switch");
let current = readStoredLang();

function readStoredLang() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (LANGS.includes(stored)) return stored;
	} catch (e) {}
	return FALLBACK;
}

export function getLang() {
	return current;
}

export function t(key) {
	return messages[current][key] ?? messages[FALLBACK][key] ?? key;
}

export function localize(value) {
	if (!value || typeof value !== "object" || !(FALLBACK in value)) return value;
	return value[current] || value[FALLBACK];
}

export function applyTranslations(root = document) {
	root.querySelectorAll("[data-i18n]").forEach((el) => {
		el.textContent = t(el.dataset.i18n);
	});
}

export function onLangChange(callback) {
	document.addEventListener("langchange", () => callback(current));
}

export function setLang(lang) {
	if (!LANGS.includes(lang) || lang === current) return;
	current = lang;
	try {
		localStorage.setItem(STORAGE_KEY, lang);
	} catch (e) {}
	render();
	document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
}

function render() {
	document.documentElement.lang = current;
	applyTranslations();
	switcher?.querySelectorAll("[data-lang]").forEach((button) => {
		button.classList.toggle("active", button.dataset.lang === current);
	});
}

switcher?.addEventListener("click", (event) => {
	const button = event.target.closest("[data-lang]");
	if (button) setLang(button.dataset.lang);
});

render();
