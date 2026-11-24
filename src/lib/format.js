/** @type {[number, string][]} */
const FRACTIONS = [
	[0.25, '¼'],
	[1 / 3, '⅓'],
	[0.5, '½'],
	[2 / 3, '⅔'],
	[0.75, '¾']
];

/**
 * Display a (possibly scaled) amount the way a cook writes it:
 * 1.5 -> "1½", 0.333 -> "⅓", 133.3 -> "133", 2.25 -> "2¼".
 * @param {number} n
 */
export function formatAmount(n) {
	if (n >= 10) return String(Math.round(n));
	const whole = Math.floor(n);
	const frac = n - whole;
	if (frac < 0.04) return String(whole);
	if (frac > 0.96) return String(whole + 1);
	for (const [value, glyph] of FRACTIONS) {
		if (Math.abs(frac - value) < 0.04) return whole ? `${whole}${glyph}` : glyph;
	}
	return n.toLocaleString('de-CH', { maximumFractionDigits: 1 });
}

/** Lowercase, without accents/umlaut dots, for search. @param {string} s */
export function fold(s) {
	return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
