
import { subclass, property } from 'esri/core/accessorSupport/decorators';
import Widget from 'esri/widgets/Widget';
import { displayError } from '../utilites/errorUtils';
import i18n = require('dojo/i18n!../nls/resources');
import { tsx, renderable } from 'esri/widgets/support/widget';
import { ApplicationConfig } from 'ApplicationBase/interfaces';
import ApplicationBase from 'ApplicationBase/ApplicationBase';
import { createMapFromItem, createView, getConfigViewProperties } from 'ApplicationBase/support/itemUtils';

import esri = __esri;

const CSS = {
	miniMap: {
		panel: 'mini-map-panel'
	},
	tabletShow: 'tablet-show',
	tabletHide: 'tablet-hide',
	configApp: 'configurable-application__view-container',
	hide: 'hide',
	theme: 'app-header',
	btnOpenMap: 'btn-open-map',
	appButton: 'app-button',

	calciteStyles: {
		alert: 'alert',
		active: 'is-active',
		alertRed: 'alert-red',
		alertGreen: 'alert-green',
		alertClose: 'alert-close',
		topNav: 'top-nav',
		topNavTitle: 'top-nav-title',
		//column14: 'column-14',
		//leader: 'leader-0',
		//trailer: 'trailer-0',
		//paddingLeft: 'padding-left-0',
		//paddingRight: 'padding-right-0',
		button: 'btn',
		buttonFill: 'btn-fill',
		right: 'right',
		panel: 'panel',
		iconDesc: 'icon-ui-description'
	}
};

interface MapPanelProps extends esri.WidgetProperties {
	base: ApplicationBase;
	item: esri.PortalItem;
	mainMapAccessoryClassName?: string;
	selectedItemTitle?: string;
	isMobileView?: boolean;
}
@subclass('app.MapPanel')
class MapPanel extends (Widget) {
	//--------------------------------------------------------------------------
	//
	//  Properties
	//
	//--------------------------------------------------------------------------

	@property() base: ApplicationBase;
	@property() item: __esri.PortalItem;
	@property() config: ApplicationConfig;
	@property() view: esri.MapView;
	@property() mainMapAccessoryClassName: string = 'main-map-content';

	@property() selectedItemTitle: string = null;

	@renderable()
	@property()
	isMobileView: boolean = false;

	@renderable()
	@property()
	message: string;

	//--------------------------------------------------------------------------
	//
	// Variables
	//
	//--------------------------------------------------------------------------
	_initialExtent: esri.Extent;

	//--------------------------------------------------------------------------
	//
	//  Public Methods
	//
	//--------------------------------------------------------------------------
	constructor(props: MapPanelProps) {
		super(props);
		const { config } = props.base;
		this.config = config;
	}
	render() {
		const allClasses = [
			//CSS.calciteStyles.paddingRight,
			//CSS.calciteStyles.paddingLeft,
			//CSS.calciteStyles.trailer,
			//CSS.calciteStyles.leader,
			//CSS.calciteStyles.trailer
		];
		const mainMapClasses = [
			//CSS.calciteStyles.column14
		];
		const miniMapClasses = [CSS.miniMap.panel, CSS.calciteStyles.panel];
		const mapPositionClasses = this.isMobileView
			? this.classes(...allClasses, ...miniMapClasses)
			: this.classes(...mainMapClasses, ...allClasses);
		const mapTabletClass = this.isMobileView ? this.classes(CSS.tabletShow) : null;

		const alertMessage =
			this.isMobileView && this.message ? (
				<div
					key="mobile-message"
					class={
						this.isMobileView && this.message ? (
							this.classes(CSS.calciteStyles.alert, CSS.calciteStyles.active, CSS.calciteStyles.alertRed)
						) : null
					}
				>
					<span innerHTML={this.message} />
					<button class={this.classes(CSS.calciteStyles.alertClose)} onclick={this._closeAlert}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 32 32"
							class="svg-icon"
						>
							<path d="M18.404 16l9.9 9.9-2.404 2.404-9.9-9.9-9.9 9.9L3.696 25.9l9.9-9.9-9.9-9.898L6.1 3.698l9.9 9.899 9.9-9.9 2.404 2.406-9.9 9.898z" />
						</svg>
					</button>
				</div>
			) : null;
		return (
			<div class={mapPositionClasses} role="application">
				<div class={this.classes(CSS.configApp)}>
					<div class={mapTabletClass} bind={this} afterCreate={this._createMap} />
				</div>
				{alertMessage}
			</div>
		);
	}
	private _closeAlert() {
		this.message = null;
		const alerts = document.getElementsByClassName('alert is-active');
		for (let j = 0; j < alerts.length; j++) {
			alerts[j].classList.remove('is-active');
		}
	}
	private async _createMap(container) {
		const portalItem: esri.PortalItem = this.base.results.applicationItem.value;
		const appProxies = portalItem && portalItem.applicationProxies ? portalItem.applicationProxies : null;

		appProxies && appProxies.forEach((proxy) => {
			const { url } = this.config.helperServices.route;
			if (proxy.sourceUrl === url) {
				this.config.helperServices.route.url = proxy.proxyUrl;
			}
		});
		const defaultViewProperties = getConfigViewProperties(this.config);
		const components = ["attribution"];
		const mapContainer = {
			container
		};

		const viewProperties = {
			...defaultViewProperties,
			ui: { components },
			...mapContainer
		};

		try {
			const map = (await createMapFromItem({ item: this.item, appProxies })) as esri.WebMap;

			this.view = (await createView({ ...viewProperties, map })) as esri.MapView;
			if (!this.config.mapZoom) {
				this.view.ui.remove("zoom");
			}

			this.view.highlightOptions.fillOpacity = 0;


			const handler = this.view.watch('extent', () => {
				handler.remove();
				this._initialExtent = this.view.extent.clone();
			});
			document.getElementById('mapDescription').innerHTML = i18n.map.description;

			const rootNode = document.getElementsByClassName('esri-view-surface');
			for (let k = 0; k < rootNode.length; k++) {
				rootNode[k].setAttribute('aria-describedby', 'mapDescription');
			}
		} catch (error) {
			const title = (this.item && this.item.title) || ' the application';
			displayError({ title: 'Error', message: `Unable to load ${title} ` });
		}
	}

	public clearResults() {
		this.message = null;
	}
	public resetExtent() {
		this.view.goTo(this._initialExtent);
	}

}
export = MapPanel;
