/*
  Copyright 2017 Esri
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.​
*/

import ApplicationBase from 'ApplicationBase/ApplicationBase';
import Telemetry from 'telemetry/telemetry.dojo';
import Search from 'esri/widgets/Search';
import Graphic from 'esri/Graphic';
import Handles from 'esri/core/Handles';

import { getLookupLayers, getSearchGeometry } from './utilites/lookupLayerUtils';

import { addMapComponents } from './utilites/esriWidgetUtils';
import { displayError } from './utilites/errorUtils';
import { whenTrue, whenDefinedOnce, whenFalseOnce, init, watch } from 'esri/core/watchUtils';
import DisplayLookupResults from './components/DisplayLookupResults';
import Header from './components/Header';
import Footer from './components/Footer';
import MapPanel from './components/MapPanel';

import i18n = require('dojo/i18n!./nls/resources');

import esri = __esri;
const CSS = {
	loading: 'configurable-application--loading'
};

import { setPageLocale, setPageDirection, setPageTitle } from 'ApplicationBase/support/domHelper';
import ConfigurationSettings from "./ConfigurationSettings";
import DetailPanel from './components/DetailPanel';
import LookupGraphics = require('./components/LookupGraphics');
import FeatureLayer from 'esri/layers/FeatureLayer';
class LocationApp {
	_appConfig: ConfigurationSettings = null;
	telemetry: Telemetry = null;
	searchWidget: Search = null;
	initialSearchWidget: Search = null;
	view: esri.MapView;
	mapPanel: MapPanel = null;
	_detailPanel: DetailPanel = null;
	_clearButton: HTMLButtonElement = null;
	footer: Footer = null;
	_handles: Handles = new Handles();
	_searchFeature: Graphic;
	_results: Graphic[] = null;
	_homeButton: HTMLButtonElement = null;
	_closeResultsBtn: HTMLButtonElement = null;
	_modelPanel: HTMLElement = null;
	_initialSearchPanel: HTMLElement = null;
	_mapPanel: HTMLElement = null;
	_sidePanel: HTMLElement = null;
	_webAppBuilder: HTMLElement = null;
	_inerstitialDiv: HTMLElement = null;
	_inerstitialDivReset: HTMLElement = null;
	_inerstitialDivOpen: HTMLElement = null;
	_helpButton: HTMLElement = null;
	_helpContainer: HTMLElement = null;
	_helpContainerReset: HTMLElement = null;
	_searchInstruction: HTMLElement = null;
	_openSearchInstructions: HTMLElement = null;
	_closeSearchInstructions: HTMLElement = null;
	_aboutExpand: HTMLElement = null;
	_aboutCollapse: HTMLElement = null;
	_faqExpand: HTMLElement = null;
	_faqCollapse: HTMLElement = null;
	
	// DisplayLookupResults is the component that handles displaying the popup content
	// using the Feature widget for the features that match the lookup search requirements
	lookupResults: DisplayLookupResults;
	//----------------------------------
	//  ApplicationBase
	//----------------------------------
	base: ApplicationBase = null;
	_propertyButtonOne: HTMLButtonElement = null;
	_propertyButtonTwo: HTMLButtonElement = null;
	_aboutUsSection: HTMLElement = null;
	_faqSection: HTMLElement = null;
	_aboutUsHeader: HTMLElement = null;
	_faqHeader: HTMLElement = null;
	_faqSectionOne: HTMLElement = null;
	_faqSectionTwo: HTMLElement = null;
	_faqSectionThree: HTMLElement = null;
	_faqSectionOne_Header: HTMLElement = null;
	_faqSectionTwo_Header: HTMLElement = null;
	_faqSectionThree_Header: HTMLElement = null;
	_aboutUsSpan: HTMLElement = null;
	_faqSpan: HTMLElement = null;
	//--------------------------------------------------------------------------
	//
	//  Public Methods
	//
	//--------------------------------------------------------------------------

	public init(base: ApplicationBase): void {
		if (!base) {
			console.error('ApplicationBase is not defined');
			return;
		}

		this._updateMapVisibility(base.config);

		setPageLocale(base.locale);
		setPageDirection(base.direction);

		this.base = base;

		const { config, results, portal } = base;

		config.helperServices = { ...base.portal.helperServices };

		const { webMapItems } = results;

		// create and insert the shared theme styles 
		this._createSharedTheme();
		this._appConfig = new ConfigurationSettings(config);
		this._handles.add(init(this._appConfig, ["theme", "applySharedTheme"], () => {
			this.handleThemeUpdates();
		}), "configuration");


		// Setup Telemetry
		if (config.telemetry) {
			const { prod, qaext, devext } = config.telemetry;
			let options = prod;
			if (portal.customBaseUrl.indexOf('mapsdevext') !== -1) {
				// use devext credentials
				options = devext;
			} else if (portal.customBaseUrl.indexOf('mapsqa') !== -1) {
				// or qa
				options = qaext;
			}
			const { disabled, debug, amazon } = options;
			this.telemetry = new Telemetry({
				portal,
				disabled,
				debug,
				amazon
			});
			this.telemetry.logPageView();
		}

		// Get web map
		const allItems = webMapItems.map((item) => {
			return item;
		});
		let validWebMapItems = [];
		allItems.forEach((response) => {
			if (response?.error) {
				return;
			}
			validWebMapItems.push(response.value);
		});
		const item = validWebMapItems[0];

		if (!item) {
			const error = 'Could not load an item to display';
			displayError({
				title: 'Error',
				message: error
			});
			this.telemetry.logError({
				error
			});
			return;
		}
		this._createMap(item);
		(<HTMLIFrameElement>document.getElementById("modelResults")).src = "/blank.html";
		this._initialSearchPanel = <HTMLElement> document.getElementById("initialSearchPanel");
		this._sidePanel = <HTMLElement> document.getElementById("sidePanel");
		this._mapPanel = <HTMLElement> document.getElementById("mapPanel");
		this._initialSearchPanel = <HTMLElement> document.getElementById("searchPanelWrapper");
		this._inerstitialDiv = <HTMLElement> document.getElementById("interstitial-div");
		this._helpContainer = <HTMLElement> document.getElementById("abt-help-page-container");
		this._homeButton = document.getElementById("homeButton") as HTMLButtonElement;

		this._homeButton.addEventListener("click", () => {
			this._cleanUpResults();
			this._clearButton.classList.add("hide");
			this.searchWidget && this.searchWidget.clear();
			this._sidePanel.classList.add("hidden");
			this._searchFeature = null;
			this._mapPanel.classList.remove("mapPanelOn");
			this._inerstitialDiv.classList.add("hidden");
			this._modelPanel.classList.remove("shown");
			this._updateUrlParam();
			(<HTMLIFrameElement>document.getElementById("multiplePropertiesIFrame")).src = "blank.html";
			(<HTMLElement>document.getElementById("multiplePropertiesIFrame")).classList.remove("shown");
			(<HTMLElement>document.getElementById("interstitial-content")).classList.remove("hidden");
			(<HTMLElement>document.getElementById("body")).classList.add("background_image");
			(<HTMLElement>document.getElementById("searchIntro")).classList.remove("hidden");
			(<HTMLElement>document.getElementById("searchPanelWrapper")).classList.remove("top");
			(<HTMLElement>document.getElementById("searchPanel")).classList.remove("top");
			(<HTMLElement>document.getElementById("searchWidget")).classList.remove("top");
			this._helpContainer.classList.add("hidden");
		});

		let modeLabel = document.getElementById("ModeLabel") as HTMLElement;
		//modeLabel.innerHTML = "<h3>" + config.mode + "</h3>";

		this._propertyButtonOne = document.getElementById("label_1") as HTMLButtonElement;
		this._propertyButtonTwo = document.getElementById("label_2") as HTMLButtonElement;

		if (config.mode == "Convert Property") {
			this._propertyButtonTwo.style.backgroundColor = 'rgba(221, 200, 200, 0.8)';
			this._propertyButtonOne.style.backgroundColor = 'rgba(255, 165, 0, .8)';			
		}
		else {

			this._propertyButtonOne.style.backgroundColor = 'rgba(221, 200, 200, 0.8)';
			this._propertyButtonTwo.style.backgroundColor = 'rgba(255, 165, 0, .8)';
		}

		
		this._propertyButtonOne.addEventListener("click", () => {
			this._propertyButtonTwo = document.getElementById("label_2") as HTMLButtonElement;
			this._propertyButtonTwo.style.backgroundColor = 'rgba(221, 200, 200, 0.8)';
			this._propertyButtonOne.style.backgroundColor = 'rgba(255, 165, 0, .8)';
			window.location.href = "/index.html";

		});
		
		this._propertyButtonTwo.addEventListener("click", () => {
			this._propertyButtonOne = document.getElementById("label_1") as HTMLButtonElement;
			this._propertyButtonOne.style.backgroundColor = 'rgba(221, 200, 200, 0.8)';
			this._propertyButtonTwo.style.backgroundColor = 'rgba(255, 165, 0, .8)';
			window.location.href = "/newdev.html";
		});
        
        this._modelPanel = document.getElementById("modelPanel") as HTMLElement;

		this._closeResultsBtn = document.getElementById("modelPanelHeaderCloseBtn") as HTMLButtonElement;
		this._closeResultsBtn.addEventListener("click", () => {
			this._modelPanel.classList.remove("shown");
		});
		
		this._webAppBuilder = document.getElementById("explorerButton") as HTMLElement;
		this._webAppBuilder.addEventListener("click", () => {
			//this._mapPanel.classList.add("hide");
			///this._modelPanel.classList.add("hidden");
			//this._initialSearchPanel.classList.add("hidden");
			this._inerstitialDiv.classList.remove("hidden");
			this._helpContainer.classList.add('hidden');
		});

		this._inerstitialDivReset = <HTMLElement> document.getElementById("return-to-default");
		this._inerstitialDivReset.addEventListener("click", () => {
			this._inerstitialDiv.classList.add("hidden");
			this._mapPanel.classList.remove("hide");
			this._modelPanel.classList.remove("hidden");
			this._initialSearchPanel.classList.remove("hidden");
			this._initialSearchPanel.classList.add("click-to-hide")
		});
		//about + FAQ section appearance click event

		this._helpButton = document.getElementById("abt-faq-button") as HTMLElement;
		this._helpButton.addEventListener("click", () => {
			this._helpContainer.classList.remove("hidden");
		});

		//hide about + FAQ sections again
		this._helpContainerReset = <HTMLElement>document.getElementById("reset-abt-help-page");
		this._helpContainerReset.addEventListener("click", () => {
			this._helpContainer.classList.add("hidden");
			this._inerstitialDiv.classList.add("hidden");
		});
		this._aboutExpand = <HTMLElement>document.getElementById("about-expand");
		this._aboutUsSection = <HTMLElement>document.getElementById("about-us-main");
		this._aboutCollapse = <HTMLElement>document.getElementById("about-collapse");
		this._faqExpand = <HTMLElement>document.getElementById("faq-expand");
		this._faqCollapse = <HTMLElement>document.getElementById("faq-collapse");
		this._faqSection = <HTMLElement>document.getElementById("faq-main")
		this._aboutExpand.addEventListener("click", () => {
			this._aboutUsSection.classList.remove("hide")
			this._aboutCollapse.classList.remove("hide");
			this._aboutExpand.classList.add("hide");
		});
		this._aboutCollapse.addEventListener("click", () => {
			this._aboutCollapse.classList.add("hide");
			this._aboutUsSection.classList.add("hide");
			this._aboutExpand.classList.remove("hide");
		});
		this._faqExpand.addEventListener("click", () => {
			this._faqSection.classList.remove("hide")
			this._faqCollapse.classList.remove("hide");
			this._faqExpand.classList.add("hide");
		});
		this._faqCollapse.addEventListener("click", () => {
			this._faqCollapse.classList.add("hide");
			this._faqSection.classList.add("hide");
			this._faqExpand.classList.remove("hide");
		});


		this._inerstitialDivOpen = <HTMLElement> document.getElementById("showMultiplePropertiesButton");
		this._inerstitialDivOpen.addEventListener("click", () => {
			(<HTMLElement>document.getElementById("interstitial-content")).classList.add("hidden");
			(<HTMLIFrameElement>document.getElementById("multiplePropertiesIFrame")).src = "/gshp";
			(<HTMLElement>document.getElementById("multiplePropertiesIFrame")).classList.add("shown");
		})
		var isSearchInstructionOpen = false;
		this._searchInstruction = document.getElementById("search-instructions") as HTMLElement;
		this._openSearchInstructions = document.getElementById("open-instructions") as HTMLElement;
		//this._closeSearchInstructions = document.getElementById("close-instructions") as HTMLElement;
		this._openSearchInstructions.addEventListener("click", () => {
			if (!isSearchInstructionOpen) {
				this._searchInstruction.classList.remove("hidden");
				isSearchInstructionOpen = true;
			}
			else {
				this._searchInstruction.classList.add("hidden");
				this._searchInstruction.classList.remove("how-to-container");
				isSearchInstructionOpen = false;
			}
		})

	}
	async _createMap(item) {
		this.mapPanel = await new MapPanel({
			item,
			base: this.base,
			container: 'mapPanel'
		});
		this._handles.add(this.mapPanel.watch("isMobileView", (isMobile) => {
			// enable popup in mobile view 
			this.view.popup.autoOpenEnabled = isMobile;
		}), "popupvis");
		const panelHandle = this.mapPanel.watch('view', () => {
			panelHandle.remove();
			this.view = this.mapPanel.view;
			// watch properties that determine how results are displayed
			this._handles.add(init(this._appConfig, ["searchUnits", "includeDistance", "interactiveResults", "groupResultsByLayer"], () => {
				if (this._results) {
					this._displayResults(this._results);
				}
			}), "configuration");

			this.view.popup.autoOpenEnabled = false;
			this.view.popup.actions = null;
			document.body.classList.remove(CSS.loading);
			this._addWidgets();
			this._addHeader(item);
			this._addFooter();

		});
	}
	_addFooter() {

		const { hideMap } = this._appConfig;

		this.footer = new Footer({
			container: 'bottomNav',
			hideMap,
			mapPanel: this.mapPanel,
			config: this._appConfig
		});
		// dark background: #242424 color "#d1d1d1"
		this._handles.add(init(this._appConfig, "hideMap", () => {
			this._updateMapVisibility(this._appConfig);
		}), "configuration");
		if (this.mapPanel && !hideMap) {
			whenTrue(this.mapPanel, "isMobileView", (value) => {
				this._detailPanel && this._detailPanel.hidePanel();
			})
		}
	}
	_addHeader(item: esri.PortalItem) {
		// Add a page header
		this._appConfig.title = this._appConfig.title || item.title;
		setPageTitle(this._appConfig.title);

		new Header({
			config: this._appConfig,
			detailPanel: this._detailPanel,
			container: 'header'
		});
	}
	async _addWidgets() {
		// Add esri widgets to the app (legend, home etc)
		addMapComponents({
			view: this.view,
			config: this._appConfig,
			portal: this.base.portal
		});

		this._setupFeatureSearch();
	}


	async _setupFeatureSearch() {
		// Create the panel that contains the slider

		const RefineResults = await import("./components/RefineResults");
		if (!RefineResults) {
			return;
		}
		const container = document.getElementById("distanceOptions");

		if (this._appConfig?.sliderRange?.default && !isNaN(this._appConfig?.sliderRange?.default)) {
			this._appConfig.sliderRange.default = this._appConfig.sliderRange.default;
		}

		const refineResultsPanel = new RefineResults.default({
			config: this._appConfig,
			container
		});

		this._handles.add(init(this._appConfig, ["sliderRange", "searchUnits", "precision", "inputsEnabled"], (value, oldValue, propertyName) => {
			refineResultsPanel.updateSliderProps(propertyName, value);
		}), "configuration");

		refineResultsPanel.watch("value", (value) => {
			this._appConfig.sliderRange.default = value;

			this.lookupResults && this.lookupResults.clearResults();
			if (this._searchFeature) {
				this._generateSearchResults();
			}
			this._updateUrlParam();
		});


		const lookupGraphics = new LookupGraphics({
			view: this.view,
			config: this._appConfig
		});
		this._handles.add(init(this._appConfig, ["drawBuffer", "mapPinLabel", "mapPin"], (value, oldValue, propertyName) => {
			lookupGraphics.updateGraphics(propertyName, value);
		}), "configuration");
		this.lookupResults = new DisplayLookupResults({
			lookupGraphics,
			config: this._appConfig,
			view: this.view,
			mapPanel: this.mapPanel,
			portal: this.base.config.portal,
			container: 'resultsPanel',
			footer: this.footer ? this.footer : null
		});

		this._handles.add(init(this._appConfig, ["lookupLayers", "hideLayers"], async () => {

			// Get configured lookup layers or if none are configured get
			// all the feature layers in the map

			let parsedLayers = this._appConfig.lookupLayers?.layers ? this._appConfig.lookupLayers.layers : null;

			if (!Array.isArray(parsedLayers) || !parsedLayers.length) {
				parsedLayers = null;
			}
			const lookupLayers = await getLookupLayers({
				view: this.view,
				lookupLayers: parsedLayers,
				hideFeaturesOnLoad: this._appConfig.hideLayers
			});

			this.lookupResults.lookupLayers = lookupLayers;
			if (this._results) {
				this._displayResults(this._results);
			}
		}), "configuration")

		this._addSearchWidget();

		// Wait for view model 
		this._handles.add(init(this._appConfig, ["showDirections"], () => {
			if (this._appConfig.showDirections && !this.lookupResults?.directions) {
				this._createDirections();
				if (this._results) {
					// refresh the results to show directions
					this._displayResults(this._results);
				}
			}
		}), "configuration");


		this._cleanUpHandles();
	}


	private async _createDirections() {
		if (this.lookupResults.directions) return;
		const { url } = this.base.config.helperServices.route;
		const Directions = await import('esri/widgets/Directions');
		const container = document.createElement("div");
		container.setAttribute("role", "alertdialog");
		const directions = new Directions.default({
			routeServiceUrl: url,
			container
		});
		// add directions to the view's popup 
		whenDefinedOnce(directions, "viewModel", () => {
			directions.view = this.view;
			directions.viewModel.routeParameters.directionsLengthUnits = this._appConfig.searchUnits;
			directions.viewModel.routeParameters.returnDirections = true;
			directions.viewModel.load().catch((e) => {
				if (e && e.message) {
					console.log("Problem loading directions:", e.message);
				}
			});
		});
		this.lookupResults.directions = directions;
	}


	private _addSearchWidget(): void {
		const container = document.getElementById("search") as HTMLElement;
		const { searchConfiguration, find, findSource } = this._appConfig;
		let sources = searchConfiguration?.sources;
		if (sources) {
			sources.forEach((source) => {
				if (source?.layer?.url) {
					source.layer = new FeatureLayer(source?.layer?.url);
				}
			});
		}
		const searchProperties: esri.widgetsSearchProperties = {
			...{
				view: this.view,
				resultGraphicEnabled: false,
				autoSelect: false,
				popupEnabled: false,
				container: "search"
			}, ...searchConfiguration
		};
		if (searchProperties?.sources?.length > 0) {
			searchProperties.includeDefaultSources = false;
		}

		this.searchWidget = new Search(searchProperties);



		const handle = this.searchWidget.viewModel.watch('state', (state) => {
			if (state === 'ready') {
				(<HTMLElement>document.getElementById("searchLoader")).style.display = "none";
				handle.remove();
				// conditionally hide on tablet
				if (!this.view.container.classList.contains('tablet-show')) {
					this.view.container.classList.add('tablet-hide');
				}
				// force search within map if nothing is configured
				if (!searchConfiguration) {
					this.searchWidget.viewModel.allSources.forEach((source) => {
						source.withinViewEnabled = true;
					});
				}
			}
		});
		// in progress migrate search logic from lookup 
		// to nearby and work on rest of the props
		this.searchWidget.on('search-clear', () => {
			this._cleanUpResults();
			container.classList.remove("hide-search-btn");
			this._clearButton?.classList.add("hide");
			// Remove find url param
			this._updateUrlParam();
			this._searchFeature = null;
			let panelId = "mapPanel";
			if (this.view.zoom > 18) this.view.zoom = 18;
			this._mapPanel.classList.add("mapPanelOn");
			(<HTMLElement>document.getElementById("body")).classList.remove("background_image");
			(<HTMLElement>document.getElementById("searchPanelWrapper")).classList.add("top");
		});

		this.searchWidget.on('search-complete', async (results) => {
			this._cleanUpResults();
			if (this.view.zoom < 18) this.view.zoom = 18;
			let panelId = "mapPanel";
			this._mapPanel.classList.add("mapPanelOn");
			(<HTMLElement>document.getElementById("body")).classList.remove("background_image");
			(<HTMLElement>document.getElementById("searchPanelWrapper")).classList.add("top");
			(<HTMLElement>document.getElementById("searchPanel")).classList.add("top");
			(<HTMLElement>document.getElementById("searchWidget")).classList.add("top");
			(<HTMLElement>document.getElementById("searchIntro")).classList.add("hidden");
			(<HTMLIFrameElement>document.getElementById("modelResults")).src = "/blank.html";

			if (results.numResults > 0) {
				// Add find url param
				container.classList.add("hide-search-btn");
				this._displayResults(results);
			}
		});

		// this.searchWidget.on('suggest-start', async (results) => {
		// 	let panelId = "mapPanel";
		// 	this._mapPanel.classList.add("mapPanelOn");
		// 	(<HTMLElement>document.getElementById("body")).classList.remove("background_image");
		// 	(<HTMLElement>document.getElementById("searchPanelWrapper")).classList.add("top");
		// });

		// Search for location where user clicked on the map 
		this.view.on('click', async (e: esri.MapViewClickEvent) => {
			// document.getElementById("body").style.display = "none"
			const point = e.mapPoint;
			if (this.lookupResults.empty) {
				this._performSearch(point);
			} else {
				// User clicked on map do hit test to get feature 
				// and highlight in the results list 
				const screenPoint = this.view.toScreen(point);
				const results = await this.view.hitTest(screenPoint);

				// If we are in mobile view let's wait until we switch out
				this._getSelectedAccordionItem(results);
				if (this.mapPanel.isMobileView) {
					whenFalseOnce(this.mapPanel, "isMobileView", () => {
						this._getSelectedAccordionItem(results);
					});
				}
			}
			this._clearButton?.classList.remove("hide");
		});


		this.searchWidget.goToOverride = function(view, goToParams) {
			console.log("goToParams: ", goToParams);
			//goToParams.options.duration = 100;
			return view.goTo(goToParams.target, goToParams.options);
		};
		// add clear  button to map view 
		this._clearButton = document.createElement("button");
		this._clearButton.innerHTML = i18n.tools.clearLocation;
		this._clearButton.classList.add("btn");
		this._clearButton.classList.add("clear-btn");
		this._clearButton.classList.add('hide');
		this._clearButton.classList.add("app-button");
		this._clearButton.addEventListener("click", () => {
			this._clearButton.classList.add("hide");
			this.searchWidget && this.searchWidget.clear();
		});
		this.view.ui.add(this._clearButton, 'manual');
	}

	async _displayResults(results) {
		this._clearButton?.classList.remove("hide");
		const index = results && results.activeSourceIndex ? results.activeSourceIndex : null;
		this._results = results;
		this._updateUrlParam(index);

		// Get search geometry and add address location to the map
		const feature = await getSearchGeometry({
			config: this.base.config,
			view: this.view,
			results
		});
		this._searchFeature = feature;
		this._generateSearchResults();
	}
	_getSelectedAccordionItem(results) {

		if (this.lookupResults.accordion) {
			this.lookupResults.accordion.findAccordionItem(results)
		};
	}
	_performSearch(mapPoint) {
		this.searchWidget.search(mapPoint).then((response: any) => {
			if (response?.numResults < 1) {
				this._displayNoResultsMessage(mapPoint);
			}
			if (response?.numErrors > 0) {
				this._displayNoResultsMessage(mapPoint);
			}
		});
	}
	_displayNoResultsMessage(geometry: esri.Geometry) {
		// display no results message
		this._searchFeature = new Graphic({ geometry });
		this._generateSearchResults();
		this.searchWidget.activeMenu = null;
	}
	private async _generateSearchResults() {

		const location = this._searchFeature ? this._searchFeature : null;
		if (this._detailPanel) {
			this._detailPanel.hidePanel();
		}
		this.lookupResults && this.lookupResults.queryFeatures(location);
	}

	private _cleanUpResults() {
		// Clear the lookup results displayed in the side panel
		this.lookupResults && this.lookupResults.clearResults();
		this._results = null;
		this.view.graphics.removeAll();
		this.mapPanel && this.mapPanel.clearResults();
		if (!this.mapPanel.isMobileView) {
			this.view.popup.autoOpenEnabled = false;
		}
	}

	private _updateUrlParam(index?) {
		// if ('URLSearchParams' in window) {
		// 	const params = new URLSearchParams(document.location.search);
		// 	const searchTerm = encodeURIComponent(this.searchWidget.searchTerm);
		// 	if (searchTerm) {
		// 		if (index && (index > 0 || index === 0)) {
		// 			params.set('findSource', index);
		// 		} else {
		// 			params.delete('findSource');
		// 		}
		// 		if (this._appConfig.sliderRange?.default) {
		// 			params.set('sliderDistance', this._appConfig.sliderRange.default as any);
		// 		}
		// 		params.set('find', encodeURIComponent(this.searchWidget.searchTerm));
		// 	} else {
		// 		params.delete('find');
		// 		params.delete('findSource');
		// 		params.delete('sliderDistance');
		// 	}
		// 	if (params && params.toString()) {
		// 		window.history.replaceState({}, '', `${location.pathname}?${params}`);
		// 	} else {
		// 		window.history.replaceState({}, '', `${location.pathname}`);
		// 	}
		// }
	}
	private _createSharedTheme() {
		// use shared theme colors for header and buttons 
		const sharedTheme = this.base?.portal?.portalProperties?.sharedTheme;
		if (!sharedTheme) {
			return;
		}
		const { header, button } = sharedTheme;
		const styles = [];

		// Build and insert style
		styles.push(header?.background ?
			`.shared-theme #detailPanel svg{color:${header.background};}
			.shared-theme .app-header{background:${header.background};}
			.shared-theme .text-fade:after {
				background: linear-gradient(to left, ${header.background}, 40%, transparent 90%);
			  }
			  html[dir="rtl"] .shared-theme .text-fade:after {
				background: linear-gradient(to right, ${header.background} 40%, transparent 90%);
			  }
			`
			: null);
		styles.push(
			header?.text
				? `.shared-theme .app-header a{color:${header.text};}
				.shared-theme .app-header{color:${header.text};}
				.shared-theme .toolbar-buttons{color:${header.text}}`
				: null
		);
		styles.push(
			button?.background
				? `.shared-theme .esri-icon-close:before, .shared-theme .esri-icon-search:before, 
				.shared-theme .esri-clear-search,.shared-theme .esri-search__submit-button{
					color:${button?.background}
				}
					.shared-theme .app-button:hover, 
					.shared-theme .app-button{
						background:${button?.background};
						border-color:${button?.background};
					} 
					.shared-theme #detailPanel .svg-icon{
						color:${button?.background};
					}`
				: null
		);
		styles.push(
			button?.text
				? `.shared-theme .app-button, .shared-theme .app-button:hover{
					color:${button?.text};
				}`
				: null
		);
		const style = document.createElement('style');
		style.appendChild(document.createTextNode(styles.join('')));
		document.getElementsByTagName('head')[0].appendChild(style);

	}
	handleThemeUpdates() {
		// Check for a preferred color scheme and then
		// monitor updates to that color scheme and the
		// configuration panel updates.
		const { theme, applySharedTheme } = this._appConfig;
		if (theme) {
			const style = document.getElementById("esri-stylesheet") as any;
			style.href = style.href.indexOf("light") !== -1 ? style.href.replace(/light/g, theme) : style.href.replace(/dark/g, theme);
			// add light/dark class
			document.body.classList.add(theme === "light" ? "light" : "dark");

			document.body.classList.remove(theme === "light" ? "dark" : "light");
		}
		applySharedTheme ? document.body.classList.add("shared-theme") : document.body.classList.remove("shared-theme");

	}

	_updateMapVisibility(config) {
		// Hide the map when it is configured to display 
		// without a map option 
		const hide = config.hideMap;
		const hideMapClass = "no-map";
		const mapClassList = document.body.classList;
		hide ? mapClassList.add(hideMapClass) : mapClassList.remove(hideMapClass);
	}
	_cleanUpHandles() {
		// Remove configuration handles after load
		// if the app isn't within the config experience. 
		if (!this._appConfig.withinConfigurationExperience) {
			this._handles.remove("configuration");
		}
	}
}
export = LocationApp;
