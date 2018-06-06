"use strict";

const $ = require('gulp-load-plugins')(),
		gulp = require("gulp"),
		browserSync = require('browser-sync').create(),
		del = require('del'),
		pngquant = require('imagemin-pngquant'),
		ftp = require("vinyl-ftp"),
		sourcemaps = require("gulp-sourcemaps");

const projectName = "internet-magazine/"

const xpager_path = "/www/html.xpager.ru/"+projectName,
xpager_conn = ftp.create({
	host:      'html.xpager.ru',
	user:      'file',
	password:  'X9y7E5d0',
	parallel: 8,
	log:$.util.log
});

const templatePath = "/htdocs/local/templates/industry/";
const remotePathCss = templatePath+"css",
	remotePathJs = templatePath+"js",
	remotePathImg = templatePath+"img";

const server_conn = ftp.create({
	host:      '',
	user:      '',
	password:  '',
	parallel: 4,
	log: $.util.log
});

var g_if = true;

gulp.task('browser-sync', () =>  {
	browserSync.init({
		server: {
			baseDir: 'app'
		},
		notify: false
	});

	browserSync.watch([
		"app/css/*.css",
		"app/js/*.js",
		"app/*.html",
		]).on("change", browserSync.reload);
});

gulp.task("jade", () => 
	gulp.src("app/jade/*.jade"/*,  {since: gulp.lastRun("jade")}*/)
		.pipe($.jade({pretty: true}))
		.pipe(gulp.dest("app"))
);

gulp.task("postcss", () => 
	gulp.src("app/sass/**/*.sass")
		.pipe($.if(g_if, sourcemaps.init()))
		.pipe($.sass().on("error", $.notify.onError()))
		.pipe($.postcss([
			require("postcss-cssnext")({
				browsers: ['last 2 versions', '> 4%', 'ie 11'],
				warnForDuplicates: false,
			}),
			require("postcss-assets")({
				loadPaths: ["app/img/"]
			}),
			require("postcss-short"),
			require("postcss-px2rem")({remUnit: 16}),
			require("cssnano")
		])).on("error", $.notify.onError())
		.pipe($.if(g_if, sourcemaps.write(".")))
		.pipe(gulp.dest("app/css"))
);

gulp.task("base64", () =>
	gulp.src("app/css/*.css")
		.pipe($.cache($.base64({
			extensions: ['svg', 'png', /\.jpg#datauri$/i],
			exclude:    [/\.server\.(com|net)\/dynamic\//, '--live.jpg'],
			maxImageSize: 8*1024, // bytes,
			deleteAfterEncoding: false,
		})))
		.pipe(gulp.dest("app/css"))
);

gulp.task("base64-post", () => 
	gulp.src("app/css/main.css")
		.pipe(postcss([require('postcss-data-packer')({
				dest: 'app/css/main_data.css'
				})
			])
		)
		.pipe(gulp.dest("app/css"))
);

gulp.task('imagemin', () =>  
	gulp.src('app/img/**/*', {since: gulp.lastRun("imagemin")})
		 // .pipe($.cache($.imagemin({
			// interlaced: true,
			// progressive: true,
			// svgoPlugins: [{removeViewBox: false}],
			// use: [pngquant()]
		// 	$.imagemin.gifsicle({
		// 		interlaced: true,
		// 	}),
		// 	$.imagemin.jpegtran({
		// 		progressive: true,
		// 	}),
		// 	// imageminJpegRecompress({
		// 	// 	loops: 5,
		// 	// 	min: 80,
		// 	// 	max: 90,
		// 	// 	quality: "medium"
		// 	// }),
		// 	$.imagemin.svgo(),
		// 	$.imagemin.optipng({optimizationLevel: 3}),
  //     		pngquant({quality: '65-70', speed: 5})
		// ],{
  //    		verbose: true
    	// })))
		.pipe(gulp.dest('app/img'))
);

gulp.task("babel", () => 
	gulp.src("app/js-es6/**/*", {since: gulp.lastRun("babel")})
		.pipe(sourcemaps.init())
		.pipe($.babel(
			{
				presets: ["env"]
			}
		))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest("app/js"))
);

function pre_build(callback){
	g_if = false;
	callback();
}

gulp.task('remove', (callback) =>  {del.sync('app/css/main_data.css'); callback();});

gulp.task("make:css", gulp.series(pre_build, "remove", gulp.parallel("postcss", "imagemin"), "base64", "base64-post"));

gulp.task('removedist', (callback) =>  {del.sync('dist'); callback();});

gulp.task("build:css", () => 
	gulp.src("app/css/**/*").pipe(gulp.dest('dist/css/'))
);

gulp.task("build:files", (callback) => gulp.src('app/*.ico').pipe(gulp.dest('dist')));

gulp.task("build:fonts", () => gulp.src('app/fonts/**/*').pipe(gulp.dest('dist/fonts')));

gulp.task("build:js", () => gulp.src('app/js/**/*').pipe(gulp.dest('dist/js')));

gulp.task("build:images", () => gulp.src("app/img/**/*").pipe(gulp.dest("dist/img")));

gulp.task("build:html", () => gulp.src('app/*.html').pipe(gulp.dest('dist')));

gulp.task('build', gulp.series(gulp.parallel(pre_build, 'removedist', "imagemin"), "make:css", gulp.parallel('build:css', "build:js", "build:fonts", "build:files", "build:html"), 'build:images'));

gulp.task("deploy:xpager", () => 
	gulp.src("dist/**", {buffer: false})
			.pipe(xpager_conn.dest(xpager_path))
);

gulp.task('deploy',gulp.series("build", "deploy:xpager"));

gulp.task('clearcache', (callback) => { $.cache.clearAll(); callback();});

gulp.task("deploy-zip", () => 
	gulp.src([
			"**/*.*",
			"!node_modules/**",
			"!dist/**",
			"!*.zip",
			"!*.rar",
			"!bower_components/**",
			"!config/**",
			])
		.pipe($.zip("app.zip"))
		.pipe(xpager_conn.dest(xpager_path))
);

gulp.task("deploy:css", () => 
	gulp.src("app/css/*.*", {since: gulp.lastRun("sass")})
		.pipe(server_conn.dest(remotePathCss))
);

gulp.task("deploy:js", () => 
	gulp.src("app/js/*.js", {since: gulp.lastRun("deploy:js")})
		.pipe($.uglify())
		.pipe(server_conn.dest(remotePathJs))
);

gulp.task("deploy:img", () => 
	gulp.src("app/img/**/*")
		.pipe(server_conn.dest(remotePathImg))
);

function local_watch(){
	// gulp.watch('app/sass/**/*.sass', gulp.series("sass"));
	gulp.watch('app/sass/**/*.sass', gulp.series("postcss"));
	gulp.watch('app/jade/**/*', gulp.series("jade"));
	gulp.watch("app/js-es6/**/*", gulp.series("babel"));
}

function watch(){
	gulp.watch('app/sass/**/*.sass', gulp.series("postcss", "deploy:css"));
	gulp.watch('app/js-es6/**/*.js', gulp.series("babel"));
	gulp.watch('app/js/**/*.js', gulp.series("deploy:js"));
	gulp.watch('app/img/*.*', gulp.series("imagemin", "deploy:img"));
}

gulp.task("finish:him", gulp.series(pre_build, "make:css", "babel", gulp.parallel("deploy:css", "deploy:js")));

gulp.task("deploy-to-server", gulp.series("postcss", watch));

gulp.task('default', gulp.series("postcss", gulp.parallel(local_watch, "browser-sync")));