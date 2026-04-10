// components.js
// Injects shared navbar and footer into every page.
// To update nav/footer across the whole site — edit THIS file only, then push.
//
// Each page needs:
//   <div id="site-nav"></div>    at the top of <body>
//   <div id="site-footer"></div> just before </body>
//   <script src="../assets/js/components.js"></script>

(function () {

  // ── Detect path depth so assets resolve correctly ──
  // Pages in /pages/ need "../assets/..."
  // Root index.html needs "./assets/..."
  const isRoot = !window.location.pathname.includes('/pages/');
  const base   = isRoot ? '.' : '..';

  // ── NAV ──
  const nav = `
  <nav class="navbar navbar-expand-lg position-absolute top-0 z-index-3 w-100 shadow-none my-3 navbar-transparent">
    <div class="container">
      <a class="navbar-brand text-white font-weight-bolder" href="${base}/index.html">
        SJFCROSS - Coding
      </a>
      <button class="navbar-toggler shadow-none ms-2" type="button" data-bs-toggle="collapse"
        data-bs-target="#navigation" aria-controls="navigation" aria-expanded="false"
        aria-label="Toggle navigation">
        <span class="navbar-toggler-icon mt-2">
          <span class="navbar-toggler-bar bar1"></span>
          <span class="navbar-toggler-bar bar2"></span>
          <span class="navbar-toggler-bar bar3"></span>
        </span>
      </button>
      <div class="collapse navbar-collapse w-100 pt-3 pb-2 py-lg-0" id="navigation">
        <ul class="navbar-nav navbar-nav-hover ms-auto">

          <li class="nav-item dropdown dropdown-hover mx-2">
            <a class="nav-link ps-2 d-flex cursor-pointer align-items-center"
              data-bs-toggle="dropdown" aria-expanded="false">
              <i class="material-icons opacity-6 me-2 text-md">grid_view</i>
              Divisions
              <img src="${base}/assets/img/down-arrow-white.svg" alt="down-arrow" class="arrow ms-2 d-lg-block d-none">
              <img src="${base}/assets/img/down-arrow-dark.svg" alt="down-arrow" class="arrow ms-2 d-lg-none d-block">
            </a>
            <div class="dropdown-menu dropdown-menu-animation ms-n3 dropdown-md p-3 border-radius-xl mt-0 mt-lg-3">
              <a href="${base}/pages/mdn1.html" class="dropdown-item border-radius-md">
                <i class="material-icons opacity-6 me-2 text-sm">menu_book</i>
                <span>Division I &mdash; MDN</span>
              </a>
              <a href="${base}/pages/csb1.html" class="dropdown-item border-radius-md">
                <i class="material-icons opacity-6 me-2 text-sm">code</i>
                <span>Division II &mdash; Colt Steele</span>
              </a>
              <a href="${base}/pages/youtube1.html" class="dropdown-item border-radius-md">
                <i class="fab fa-youtube opacity-6 me-2 text-sm"></i>
                <span>Division III &mdash; YouTube</span>
              </a>
              <a href="${base}/pages/test1.html" class="dropdown-item border-radius-md">
                <i class="material-icons opacity-6 me-2 text-sm">slideshow</i>
                <span>Division IV &mdash; Slideshow</span>
              </a>
              <a href="${base}/pages/animals.html" class="dropdown-item border-radius-md">
                <i class="material-icons opacity-6 me-2 text-sm">cruelty_free</i>
                <span>Division V &mdash; Animals</span>
              </a>
            </div>
          </li>

          <li class="nav-item ms-lg-auto">
            <a class="nav-link nav-link-icon me-2" href="https://github.com/sjfcross" target="_blank">
              <i class="fa fa-github me-1"></i>
              <p class="d-inline text-sm z-index-1 font-weight-bold">GitHub</p>
            </a>
          </li>

          <li class="nav-item my-auto ms-3 ms-lg-0">
            <a href="${base}/index.html" class="btn btn-sm bg-white mb-0 me-1 mt-2 mt-md-0">Home</a>
          </li>

        </ul>
      </div>
    </div>
  </nav>`;

  // ── FOOTER ──
  const footer = `
  <footer class="footer pt-5 mt-5 bg-gray-400">
    <div class="container">
      <div class="row">

        <div class="col-md-4 mb-4 ms-auto">
          <h6 class="font-weight-bolder mb-2">SJFCROSS &mdash; Coding</h6>
          <p class="text-sm text-secondary">A personal logbook of coding adventures, experiments,
            and whatever else ends up here. Built from scratch (mostly).</p>
          <ul class="d-flex flex-row ms-n3 nav mt-3">
            <li class="nav-item">
              <a class="nav-link pe-1" href="https://github.com/sjfcross" target="_blank" title="GitHub">
                <i class="fab fa-github text-lg opacity-8"></i>
              </a>
            </li>
          </ul>
        </div>

        <div class="col-md-3 col-sm-6 mb-4">
          <h6 class="text-sm">Divisions</h6>
          <ul class="flex-column ms-n3 nav">
            <li class="nav-item"><a class="nav-link" href="${base}/pages/mdn1.html">Division I &mdash; MDN</a></li>
            <li class="nav-item"><a class="nav-link" href="${base}/pages/csb1.html">Division II &mdash; Colt Steele</a></li>
            <li class="nav-item"><a class="nav-link" href="${base}/pages/youtube1.html">Division III &mdash; YouTube</a></li>
            <li class="nav-item"><a class="nav-link" href="${base}/pages/test1.html">Division IV &mdash; Slideshow</a></li>
            <li class="nav-item"><a class="nav-link" href="${base}/pages/animals.html">Division V &mdash; Animals</a></li>
          </ul>
        </div>

        <div class="col-md-3 col-sm-6 mb-4 me-auto">
          <h6 class="text-sm">This site</h6>
          <ul class="flex-column ms-n3 nav">
            <li class="nav-item"><a class="nav-link" href="${base}/index.html">Home</a></li>
            <li class="nav-item"><a class="nav-link" href="${base}/index1.html">Old Page</a></li>
            <li class="nav-item">
              <a class="nav-link" href="https://github.com/sjfcross/sjfcross.github.io" target="_blank">
                View on GitHub
              </a>
            </li>
          </ul>
        </div>

        <div class="col-12">
          <div class="text-center">
            <p class="text-dark my-4 text-sm font-weight-normal">
              &copy; ${new Date().getFullYear()} SJFCROSS.
              Built with <a href="https://www.creative-tim.com/product/material-kit" target="_blank">Material Kit 2</a> by Creative Tim.
            </p>
          </div>
        </div>

      </div>
    </div>
  </footer>`;

  // ── Inject ──
  const navEl    = document.getElementById('site-nav');
  const footerEl = document.getElementById('site-footer');

  if (navEl)    navEl.innerHTML    = nav;
  if (footerEl) footerEl.innerHTML = footer;

})();
