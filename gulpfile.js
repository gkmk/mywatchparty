const { series, src, dest, watch } = require('gulp');
const HTMLHint = require('htmlhint').HTMLHint;
const each = require('gulp-each');
const fs = require('fs');
const gutil = require('gulp-util');
const eslint = require('gulp-eslint');
const sass = require('gulp-sass')(require('sass'));
const browserSync = require('browser-sync').create();
var concat = require('gulp-concat');
var wrap = require('gulp-wrap');
const cachebust = require('gulp-cache-bust');
const imagemin = require('gulp-imagemin');
const pngcrush = require('imagemin-pngcrush');

const paths = {
	html: ['src/index.html'],
	scripts: ['src/scripts/**/!(index)*.js', 'src/scripts/index.js'],
	styles: ['src/styles/**/*.scss', 'src/styles/external/**/*.css'],
	images: ['src/images/**/*']
	// fonts: ['assets/fonts/**/*']
};

const lintHTML = (done) => {
	const errors = [];

	const stream = src(paths.html)
		.pipe(each((content, file, callback) => {
			const config = JSON.parse(fs.readFileSync('linters/.htmlhintrc.json', { encoding: 'utf8' }));

			// if (file.path.search('app.js') !== -1) {
			// 	config['doctype-first'] = true;
			// }

			const messages = HTMLHint.verify(content, config);

			if (messages.length > 0) {
				gutil.log('HTMLHint had issues with', file.path);
			}

			for (const index in messages) {
				const message = messages[index];

				switch (message.type) {
					case 'error':
						gutil.log(gutil.colors.red('Error'), message.message);
						gutil.log('Line:', message.line);
						gutil.log('Column:', message.col);
						gutil.log();

						errors.push(message);

						break;
				}
			}

			callback(null, content);
		}));

	stream.end = () => {
		if (errors.length > 0) {
			done(new gutil.PluginError('lint:html', new Error('HTMLHint error. See error log above.')));

			return;
		}

		done();
	};

	return stream;
};

const lintJS = (done) => {
	return src(paths.scripts)
		.pipe(eslint({
			configFile: 'linters/.eslintrc.json'
		}))
		// Format all results at once, at the end
		.pipe(eslint.format())
		// failAfterError will emit an error (fail) just before the stream finishes if any file has an error
		.pipe(eslint.failAfterError());
};

const buildStyles = (done) => {
	return src(paths.styles)
		.pipe(sass.sync().on('error', sass.logError))
		.pipe(dest('dist/styles'))
		.on('end', done);
};

const buildScripts = (done) => {
	src(paths.scripts)
		.pipe(concat('app.js'))
		.pipe(wrap('(function() {\n\'use strict\';\n\nlet helpers;\n\n<%= contents %>\n\n})();'))
		.pipe(dest('./dist/scripts'))
		/* .pipe(uglify({
			compress: {
				pure_funcs: ['console.log']
			}
		}))
		.pipe(rename({ extname: '.min.js' }))
		.pipe(dest('./dist/scripts')) */
		.on('end', done);
}

const buildTemplates = (done) => {
	src(paths.html)
		.pipe(cachebust({
			type: 'timestamp'
		}))
		.pipe(dest('dist'))
		.on('end', done);
}

const processImages = (done) => {
	return src(paths.images)
		.pipe(imagemin({
			optimizationLevel: 5,
			progressive: true,
			svgoPlugins: [
				{ removeViewBox: false },
				{ cleanupIDs: false }
			],
			use: [pngcrush()]
		}))
		.pipe(dest('dist/images'))
		.on('end', done);
};

const moveManifest = (done) => {
	return src(['src/**/*.webmanifest'])
		.pipe(dest('dist/'))
		.on('end', done);
};

const serve = () => {
	browserSync.init({
		notify: false,
		server: {
			baseDir: 'dist',
			routes: {
				'/test': 'test',
			}
		},
		files: [
			'dist/**/*.html',
			'dist/**/*.css',
			// 'dist/images/**/*',
			// 'build/fonts/**/*'
		],
		reloadDebounce: 500
	});

	watch(paths.styles, buildStyles);
	watch(paths.scripts, buildScripts);
	watch(paths.html, buildTemplates);
};


exports.lint = series(lintHTML, lintJS);
exports.default = series(lintHTML, buildTemplates,  buildScripts, buildStyles/*, processImages*/, moveManifest);
exports.serve = series(exports.default, serve);