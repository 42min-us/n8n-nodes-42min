const { src, dest } = require('gulp');

/** Copy node icons into dist, which tsc does not do for non-TS assets. */
function buildIcons() {
	return src('nodes/**/*.{png,svg}', { encoding: false }).pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
