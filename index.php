<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Smart Presentation</title>
        <link rel="icon" type="image/x-icon" href="assets/SR_logo_03_red.png">
        <meta charset="UTF-8">

        <!-- ============================== OFFLINE ============================== -->
        <script src="./vendor/gsap/gsap.js"></script>
        <script async src="./vendor/es-module-shims/es-module-shims.js"></script>
        <script type="importmap">
            {
                "imports": {
                    "three": "./vendor/three/build/three.module.js",
                    "three/addons/": "./vendor/three/examples/jsm/"
                }
            }
        </script>

        <!-- ============================== ONLINE =============================== -->
        <!-- <script src="https://cdn.jsdelivr.net/npm/gsap@3.2.4/dist/gsap.js"></script>
        <script async src="https://unpkg.com/es-module-shims@1.6.3/dist/es-module-shims.js"></script>
        <script type="importmap">
            {
                "imports": {
                    "three": "https://unpkg.com/three@0.154.0/build/three.module.js",
                    "three/addons/": "https://unpkg.com/three@0.154.0/examples/jsm/"
                }
            }
        </script> -->

        <link rel="stylesheet" href="./style/style.css" >
    </head>
    <body>
        <div class="home-page">
            <canvas id="myCanvas">    </canvas>
            <!-- line annotation -->
            <!-- <canvas id="lineCanvas" style="position: absolute; top: 0; left: 0;"></canvas> -->
            <svg id="rp-leader-line-svg" class="rp-leader-line-svg"></svg>
            <div class="container-top-left">
                <div class="pdf_container">
                    <img class="menu-pdf" src="./assets/Pdf.svg">
                    <img class="menu-video" src="./assets/Video.svg">
                </div>
                <div class="page-name-container">
                    <div class="page-name-text" data-i18n="page.name">Nakayama NE100JP + NAS1200T</div>
                </div>
            </div>

            <div class="container-top-right">
                <div class="tour-controls" id="tour-controls">
                    <button type="button" class="tour-button" id="tour-prev" aria-label="Previous">
                        <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
                    </button>
                    <button type="button" class="tour-button tour-play" id="tour-play" aria-label="Autoplay">
                        <svg class="tour-icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        <svg class="tour-icon-pause" viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>
                    </button>
                    <button type="button" class="tour-button tour-stop" id="tour-stop" aria-label="Stop">
                        <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                    </button>
                    <button type="button" class="tour-button" id="tour-next" aria-label="Next">
                        <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>
                <div class="lang-switch" id="lang-switch">
                    <button type="button" data-lang="en">EN</button>
                    <button type="button" data-lang="ja">JP</button>
                </div>
            </div>

            <div class="information-container" id="information-container" style="display:none;">
                <div class="information-description">
                    <p class="information-description-title">
                        VSI (Gyropactor) SR
                    </p>
                    <p class="information-description-model-number">SR100C</p>
                    <p class="information-description-description">SR type can accept large material and increase the crushing efficiency at high speed rotating range. <br><br> Two types of crushing chamber are available:<br>1. Anvil type is mainly for crushing.<br>2. Rock bed type is for better shaping.</p>
                    <p class="information-description-description">Features:<br>1. Anvil type can be adjusted both up and down side (reversible).<br>2. Assembled (sectionalized) rotor for easy parts replacement.<br>3. Hydraulic top cover opener for easy maintenance.<br>4. Vibration sensor to detect excessive vibration.<br>5. VSI unit can be loaded into a 40FT container.</p>
                    <p class="information-description-specification">Specifications Unit (mm)</p>
                    <!-- <p class="information-description-specification-detail" >Processing performance depends on quality of material, feeding chunks and particle size. <br><br> This machine’s spec and dimension might be changed without prior-notice for the improvement.</p> -->
                    <img class="information-specification-img" src="./files/dimension_vsi.png" />
                    <img class="information-specification-img" src="./files/dimension_vsi_platform.png" />
                    <img class="information-specification-img" src="./files/specification_2.png" />
                    <img class="information-specification-img" src="./files/specification.png" />
                    <img class="information-specification-img" src="./files/specification_3.png" />
                </div>
                <a class="information-link" target="_blank" href="https://www.ncjpn.com/en/products/crushers/">Crusher Series | Nakayama Iron Works (ncjpn.com)</a>
            </div>

            <div class="catalogue-container-2" id="catalogue-container-2">
                <div>
                    <p class="catalogue-description-title-2">VSI Gyropactor Series</p>
                </div>
                <div class="catalogue-description-2">
                    <div class="catalogue-product-list-2 active" id="model_name_1">
                        <div class="catalogue-product-list-text-2"> VSI Gyropactor </div>
                        <img class="catalogue-image-preview-2" src="./files/SR100C_v1_preview.png" />
                    </div>
                    <!-- <div class="catalogue-product-list-2" id="model_name_2">
                        <div class="catalogue-product-list-text-2"> VSI Gyropactor & Platform </div>
                        <img class="catalogue-image-preview-2" src="./files/SRユニット_v1_preview.png" />
                    </div> -->
                    <!-- <div class="catalogue-product-list-2" id="model_name_3">
                        <div class="catalogue-product-list-text-2"> Sand Manufacturing Plant </div>
                        <img class="catalogue-image-preview-2" src="./files/sand_manufacturing_plant.png" />
                    </div> -->
                </div>
            </div>

            <div class="container-bottom-left-ml2x">
                <div class="sound-expand" style="display:none;">
                    <div class="sound-expand-component">
                        <span data-i18n="sound.music">Music</span>
                        <div class="toggle-container">
                            <span data-i18n="toggle.off">Off</span>
                            <div class="toggle-music"></div>
                            <span data-i18n="toggle.on">On</span>
                        </div>
                    </div>
                    <div class="sound-expand-component">
                        <span data-i18n="sound.voiceOver">Voice Over</span>
                        <div class="toggle-container">
                            <span data-i18n="toggle.off">Off</span>
                            <div class="toggle-speech"></div>
                            <span data-i18n="toggle.on">On</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="container-bottom-right-mr2x" >
                <div class="menu-container-blue-lightning-expand" style="display: none">
                    <div class="menu-container-blue-lightning-expand-wrapper">
                        <div class="lightning-component">
                            <div class="lightning-title-2">
                                <span data-i18n="lighting.title">Lighting:</span>
                                <div class="opsi-container">
                                    <div class="opsi active" data-value="default" data-i18n="lighting.default">default</div>
                                    <div class="opsi" data-value="custom" data-i18n="lighting.custom">custom</div>
                                </div>
                            </div>
                            <div class="lightning-component-container custom-lightning" style="display:none;">
                                <div class="slider-group">
                                    <span data-i18n="lighting.envBrightness">Environment Brightness</span>
                                    <div class="slider-container">
                                        <span class="bar">
                                            <span class="fill" id="fill-env"></span>
                                        </span>
                                        <input type="range" min="0" max="2" value="0" step="0.1" class="slider" id="slider-env"/>
                                    </div>
                                </div>
                                <div class="slider-group">
                                    <span data-i18n="lighting.lampBrightness">Direct Lamp Brightness</span>
                                    <div class="slider-container">
                                        <span class="bar">
                                            <span class="fill" id="fill-lamp"></span>
                                        </span>
                                        <input type="range" min="0" max="40" value="0" step="0.1" class="slider" id="slider-lamp"/>
                                    </div>
                                </div>
                                <div class="slider-group">
                                    <span data-i18n="lighting.lampPosition">Direct Lamp Position</span>
                                    <div class="slider-container">
                                        <span class="bar">
                                            <span class="fill" id="fill-lamp-pos"></span>
                                        </span>
                                        <input type="range" min="0" max="400" value="210" step="1" class="slider" id="slider-lamp-pos"/>
                                    </div>   
                                </div>
                            </div>
                        </div>
                        <div class="lightning-component-center"> 
                            <div class="lightning-title" data-i18n="enlargement.title">Enlargement</div>
                            <div class="lightning-component-container">
                                <div class="slider-group">
                                    <span data-i18n="enlargement.zoom">Zoom</span>
                                    <div class="slider-container">
                                        <span class="bar">
                                            <span class="fill" id="fill-zoom"></span>
                                        </span>
                                        <input type="range" min="0.2" max="20" value="1" step="0.1" class="slider" id="slider-zoom"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="container-bottom-left">
                <button class="menu-container-blue-explode" id="explode-button" data-i18n="menu.animation">Animation</button>
                <!-- <div class="menu-container-blue-information">
                    <img src="./assets/Information-Button.png">
                </div> -->
                <div class="menu-container-blue-sound">
                    <img src="./assets/Sound-Off-Button.png" id="sound-off">
                    <img src="./assets/Sound-On-Button.png" id="sound-on" style="display: none;">
                </div>
                <div class="menu-container-blue-animation">
                    <img src="./assets/Animation-Off-Button.png" id="animation-off">
                    <img src="./assets/Animation-On-Button.png" id="animation-on" style="display: none;">
                </div>
            </div>

            <div class="rp-list-popup" id="rp-list-popup"></div>

            <div class="rp-info-popup" id="rp-info-popup">
                <div class="rp-info-popup-close" id="rp-info-popup-close">&times;</div>
                <div class="rp-info-popup-header">
                    <div class="rp-info-popup-badge" id="rp-info-popup-badge"></div>
                    <div>
                        <div class="rp-info-popup-title" id="rp-info-popup-title"></div>
                        <div class="rp-info-popup-title-en" id="rp-info-popup-title-en"></div>
                    </div>
                </div>
                <div class="rp-info-popup-body" id="rp-info-popup-body"></div>
                <div class="rp-info-popup-footer" id="rp-info-popup-footer"></div>
            </div>

            <div class="container-bottom-right">
                <!-- <div class="menu-container-blue-album">
                    <img src="./assets/Album-Button.png">
                </div> -->
                <div class="menu-container-blue-lightning">
                    <img src="./assets/Lightning-Button.png">
                </div>
                <div class="toggle"></div>
            </div>
            

            <div class="media-library" id="media-library">
                <div class="media-panel">
                    <div class="media-header">
                        <button type="button" class="media-icon-button media-back" id="media-back" aria-label="Back">
                            <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
                        </button>
                        <div class="media-title" id="media-title"></div>
                        <div class="media-counter" id="media-counter"></div>
                        <button type="button" class="media-icon-button" id="media-close" aria-label="Close">
                            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
                        </button>
                    </div>
                    <div class="media-grid" id="media-grid"></div>
                    <div class="media-viewer">
                        <button type="button" class="media-nav" id="media-prev" aria-label="Previous">
                            <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
                        </button>
                        <div class="media-stage" id="media-stage">
                            <iframe class="media-pdf" id="media-pdf" title="PDF"></iframe>
                            <video class="media-video" id="video" controls playsinline></video>
                        </div>
                        <button type="button" class="media-nav" id="media-next" aria-label="Next">
                            <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="loadingScreenContainer" style="display: none">
                <label for="loadingBar" id='loadingBarLabel' data-i18n="loading">Loading...</label>
                <progress id='loadingBar' max='100' value='0'></progress>
            </div>

            <script type="module" src="script.js"> </script>
            <script type="module" src="./js/home.js"></script>
            <script type="module" src="./js/recyclingPlant.js"></script>
            <script type="module" src="./js/recyclingPlantTour.js"></script>
        </div>
    </body>
</html>
