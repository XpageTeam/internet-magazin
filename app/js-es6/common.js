$(e => {
	$(".top-banners--slider").each((i, el) => {
		let $this = $(el);

		$this.slick({
			slidesToShow: 3,
			slidesToScroll: 1,
			autoplay: true,
			autoplaySpeed: 3000,
			variableWidth: $this.hasClass("top-banners--variable"),
			slide: ".top-banners__slide",
		})
	});
});