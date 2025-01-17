import { recordTracksEvent } from '@automattic/calypso-analytics';
import { FEATURE_INSTALL_THEMES } from '@automattic/calypso-products';
import { localize, translate } from 'i18n-calypso';
import { compact, pickBy } from 'lodash';
import page from 'page';
import PropTypes from 'prop-types';
import { createRef, Component } from 'react';
import { connect } from 'react-redux';
import UpworkBanner from 'calypso/blocks/upwork-banner';
import { isUpworkBannerDismissed } from 'calypso/blocks/upwork-banner/selector';
import DocumentHead from 'calypso/components/data/document-head';
import QueryProductsList from 'calypso/components/data/query-products-list';
import QuerySitePlans from 'calypso/components/data/query-site-plans';
import QuerySitePurchases from 'calypso/components/data/query-site-purchases';
import QueryThemeFilters from 'calypso/components/data/query-theme-filters';
import InlineSupportLink from 'calypso/components/inline-support-link';
import ScreenOptionsTab from 'calypso/components/screen-options-tab';
import SearchThemes from 'calypso/components/search-themes';
import SelectDropdown from 'calypso/components/select-dropdown';
import { getOptionLabel } from 'calypso/landing/subscriptions/helpers';
import PageViewTracker from 'calypso/lib/analytics/page-view-tracker';
import { buildRelativeSearchUrl } from 'calypso/lib/build-url';
import ActivationModal from 'calypso/my-sites/themes/activation-modal';
import ThanksModal from 'calypso/my-sites/themes/thanks-modal';
import { isUserLoggedIn } from 'calypso/state/current-user/selectors';
import getSiteFeaturesById from 'calypso/state/selectors/get-site-features';
import isAtomicSite from 'calypso/state/selectors/is-site-automated-transfer';
import siteHasFeature from 'calypso/state/selectors/site-has-feature';
import { isSiteOnWooExpress, isSiteOnECommerceTrial } from 'calypso/state/sites/plans/selectors';
import { getSiteSlug } from 'calypso/state/sites/selectors';
import { setBackPath } from 'calypso/state/themes/actions';
import {
	arePremiumThemesEnabled,
	getThemeFilterTerms,
	getThemeFilterToTermTable,
	getThemeShowcaseDescription,
	getThemeShowcaseTitle,
	prependThemeFilterKeys,
	isUpsellCardDisplayed as isUpsellCardDisplayedSelector,
} from 'calypso/state/themes/selectors';
import { getThemesBookmark } from 'calypso/state/themes/themes-ui/selectors';
import EligibilityWarningModal from './atomic-transfer-dialog';
import {
	addTracking,
	appendStyleVariationToThemesPath,
	getSubjectsFromTermTable,
	trackClick,
	localizeThemesPath,
} from './helpers';
import InstallThemeButton from './install-theme-button';
import ThemePreview from './theme-preview';
import ThemesHeader from './themes-header';
import ThemesSelection from './themes-selection';
import ThemesToolbarGroup from './themes-toolbar-group';
import './theme-showcase.scss';

const optionShape = PropTypes.shape( {
	label: PropTypes.string,
	header: PropTypes.string,
	getUrl: PropTypes.func,
	action: PropTypes.func,
} );

const staticFilters = {
	MYTHEMES: {
		key: 'my-themes',
		text: translate( 'My Themes' ),
	},
	RECOMMENDED: {
		key: 'recommended',
		text: translate( 'Recommended' ),
	},
	ALL: {
		key: 'all',
		text: translate( 'All' ),
	},
};

class ThemeShowcase extends Component {
	constructor( props ) {
		super( props );
		this.scrollRef = createRef();
		this.bookmarkRef = createRef();

		this.subjectFilters = this.getSubjectFilters( props );
		this.subjectTermTable = getSubjectsFromTermTable( props.filterToTermTable );

		this.state = {
			tabFilter: this.getTabFilterFromUrl( props.filter ),
		};
	}

	static propTypes = {
		emptyContent: PropTypes.element,
		tier: PropTypes.oneOf( [ '', 'free', 'premium', 'marketplace' ] ),
		search: PropTypes.string,
		pathName: PropTypes.string,
		// Connected props
		options: PropTypes.objectOf( optionShape ),
		defaultOption: optionShape,
		secondaryOption: optionShape,
		getScreenshotOption: PropTypes.func,
		siteCanInstallThemes: PropTypes.bool,
		siteSlug: PropTypes.string,
		upsellBanner: PropTypes.any,
		loggedOutComponent: PropTypes.bool,
		isAtomicSite: PropTypes.bool,
		isJetpackSite: PropTypes.bool,
		isSiteECommerceFreeTrial: PropTypes.bool,
		isSiteWooExpress: PropTypes.bool,
		isSiteWooExpressOrEcomFreeTrial: PropTypes.bool,
	};

	static defaultProps = {
		tier: '',
		search: '',
		emptyContent: null,
		upsellBanner: false,
		showUploadButton: true,
	};

	componentDidMount() {
		const { themesBookmark } = this.props;
		// Scroll to bookmark if applicable.
		if ( themesBookmark ) {
			// Timeout to move this to the end of the event queue or it won't work here.
			setTimeout( () => {
				const lastTheme = this.bookmarkRef.current;
				if ( lastTheme ) {
					lastTheme.scrollIntoView( {
						behavior: 'auto',
						block: 'center',
						inline: 'center',
					} );
				}
			} );
		}
	}

	componentDidUpdate( prevProps ) {
		if (
			prevProps.search !== this.props.search ||
			prevProps.filter !== this.props.filter ||
			prevProps.tier !== this.props.tier
		) {
			this.scrollToSearchInput();
		}
	}

	componentWillUnmount() {
		this.props.setBackPath( this.constructUrl() );
	}

	isStaticFilter = ( tabFilter ) => {
		return Object.values( staticFilters ).some(
			( staticFilter ) => tabFilter.key === staticFilter.key
		);
	};

	getSubjectFilters = ( props ) => {
		const { subjects } = props;
		return Object.fromEntries(
			Object.entries( subjects ).map( ( [ key, filter ] ) => [ key, { key, text: filter.name } ] )
		);
	};

	getTabFilters = () => {
		if ( this.props.siteId && ! this.props.areSiteFeaturesLoaded ) {
			return null;
		}

		const shouldShowMyThemesFilter =
			( this.props.isJetpackSite && ! this.props.isAtomicSite ) ||
			( this.props.isAtomicSite && this.props.siteCanInstallThemes );

		return {
			...( shouldShowMyThemesFilter && {
				MYTHEMES: staticFilters.MYTHEMES,
			} ),
			RECOMMENDED: staticFilters.RECOMMENDED,
			...this.subjectFilters,
			ALL: staticFilters.ALL,
		};
	};

	getTiers = () => {
		const { isSiteWooExpressOrEcomFreeTrial } = this.props;
		const tiers = [
			{ value: 'all', label: this.props.translate( 'All' ) },
			{ value: 'free', label: this.props.translate( 'Free' ) },
		];

		if ( ! isSiteWooExpressOrEcomFreeTrial ) {
			tiers.push( { value: 'premium', label: this.props.translate( 'Premium' ) } );
		}

		tiers.push( {
			value: 'marketplace',
			label: this.props.translate( 'Partner', {
				context: 'This theme is developed and supported by a theme partner',
			} ),
		} );

		return tiers;
	};

	findTabFilter = ( tabFilters, filterKey ) =>
		Object.values( tabFilters ).find( ( filter ) => filter.key === filterKey ) ||
		staticFilters.RECOMMENDED;

	getTabFilterFromUrl = ( filterString = '' ) => {
		const filterArray = filterString.split( '+' );
		const matches = Object.values( this.subjectTermTable ).filter( ( value ) =>
			filterArray.includes( value )
		);

		if ( ! matches.length ) {
			return this.findTabFilter( staticFilters, this.state?.tabFilter.key );
		}

		const filterKey = matches[ matches.length - 1 ].split( ':' ).pop();
		return this.findTabFilter( this.subjectFilters, filterKey );
	};

	scrollToSearchInput = () => {
		if ( ! this.props.loggedOutComponent && this.scrollRef && this.scrollRef.current ) {
			// If you are a larger screen where the theme info is displayed horizontally.
			if ( window.innerWidth > 600 ) {
				return;
			}
			const headerHeight = document
				.getElementsByClassName( 'masterbar' )[ 0 ]
				?.getBoundingClientRect().height;
			const screenOptionTab = document
				.getElementsByClassName( 'screen-options-tab__button' )[ 0 ]
				?.getBoundingClientRect().height;

			const yOffset = -( headerHeight + screenOptionTab ); // Total height of admin bar and screen options on mobile.
			const elementBoundary = this.scrollRef.current.getBoundingClientRect();

			const y = elementBoundary.top + window.pageYOffset + yOffset;
			window.scrollTo( { top: y } );
		}
	};

	doSearch = ( searchBoxContent ) => {
		const filterRegex = /([\w-]*):([\w-]*)/g;
		const { filterToTermTable, search: prevSearch } = this.props;

		const filters = searchBoxContent.match( filterRegex ) || [];
		const validFilters = filters.map( ( filter ) => filterToTermTable[ filter ] );
		const filterString = compact( validFilters ).join( '+' );

		const search = searchBoxContent.replace( filterRegex, '' ).replace( /\s+/g, ' ' ).trim();

		const url = this.constructUrl( {
			filter: filterString,
			// Strip filters and excess whitespace
			search,
		} );

		let tabFilter = this.getTabFilterFromUrl( filterString );

		// Activate the "All" tab when searching on "Recommended", since the
		// search might include some results that are not in the recommended
		// themes (e.g. WP.org themes).
		if ( search && prevSearch !== search && tabFilter.key === staticFilters.RECOMMENDED.key ) {
			tabFilter = staticFilters.ALL;
		}

		this.setState( { tabFilter } );
		page( url );
		this.scrollToSearchInput();
	};

	/**
	 * Returns a full showcase url from current props.
	 *
	 * @param {Object} sections fields from this object will override current props.
	 * @param {string} sections.vertical override vertical prop
	 * @param {string} sections.tier override tier prop
	 * @param {string} sections.filter override filter prop
	 * @param {string} sections.siteSlug override siteSlug prop
	 * @param {string} sections.search override search prop
	 * @returns {string} Theme showcase url
	 */
	constructUrl = ( sections ) => {
		const { vertical, tier, filter, siteSlug, search, locale, isLoggedIn } = {
			...this.props,
			...sections,
		};
		const siteIdSection = siteSlug ? `/${ siteSlug }` : '';
		const verticalSection = vertical ? `/${ vertical }` : '';
		const tierSection = tier && tier !== 'all' ? `/${ tier }` : '';

		let filterSection = filter ? `/filter/${ filter }` : '';
		filterSection = filterSection.replace( /\s/g, '+' );
		const url = localizeThemesPath(
			`/themes${ verticalSection }${ tierSection }${ filterSection }${ siteIdSection }`,
			locale,
			! isLoggedIn
		);
		return buildRelativeSearchUrl( url, search );
	};

	onTierSelect = ( { value: tier } ) => {
		// Due to the search backend limitation, "My Themes" can only have "All" tier.
		if ( tier !== 'all' && this.state.tabFilter.key === staticFilters.MYTHEMES.key ) {
			this.setState( { tabFilter: staticFilters.RECOMMENDED } );
		}

		recordTracksEvent( 'calypso_themeshowcase_filter_pricing_click', { tier } );
		trackClick( 'search bar filter', tier );

		const url = this.constructUrl( { tier } );
		page( url );
		this.scrollToSearchInput();
	};

	onFilterClick = ( tabFilter ) => {
		recordTracksEvent( 'calypso_themeshowcase_filter_category_click', { category: tabFilter.key } );
		trackClick( 'section nav filter', tabFilter );

		let callback = () => null;
		// Due to the search backend limitation, "My Themes" can only have "All" tier.
		if ( tabFilter.key === staticFilters.MYTHEMES.key && this.props.tier !== 'all' ) {
			callback = () => {
				this.onTierSelect( { value: 'all' } );
				this.scrollToSearchInput();
			};
		}

		const { filter = '', filterToTermTable } = this.props;
		const subjectTerm = filterToTermTable[ `subject:${ tabFilter.key }` ];
		const subjectFilters = Object.values( this.subjectTermTable );
		const filterWithoutSubjects = filter
			.split( '+' )
			.filter( ( key ) => ! subjectFilters.includes( key ) )
			.join( '+' );

		const newFilter = ! this.isStaticFilter( tabFilter )
			? [ filterWithoutSubjects, subjectTerm ].join( '+' )
			: filterWithoutSubjects;

		page( this.constructUrl( { filter: newFilter } ) );

		this.setState( { tabFilter }, callback );
	};

	allThemes = ( { themeProps } ) => {
		const { isJetpackSite, children } = this.props;
		if ( isJetpackSite ) {
			return children;
		}

		return (
			<div className="theme-showcase__all-themes">
				<ThemesSelection { ...themeProps } />
			</div>
		);
	};

	recordSearchThemesTracksEvent = ( action, props ) => {
		let eventName;
		switch ( action ) {
			case 'search_clear_icon_click':
				eventName = 'calypso_themeshowcase_search_clear_icon_click';
				break;
			case 'search_dropdown_taxonomy_click':
				eventName = 'calypso_themeshowcase_search_dropdown_taxonomy_click';
				break;
			case 'search_dropdown_taxonomy_term_click':
				eventName = 'calypso_themeshowcase_search_dropdown_taxonomy_term_click';
				break;
			case 'search_dropdown_view_all_button_click':
				eventName = 'calypso_themeshowcase_search_dropdown_view_all_button_click';
				break;
			case 'search_dropdown_view_less_button_click':
				eventName = 'calypso_themeshowcase_search_dropdown_view_less_button_click';
				break;
		}

		if ( eventName ) {
			recordTracksEvent( eventName, props );
		}
	};

	renderBanner = () => {
		const {
			loggedOutComponent,
			isExpertBannerDissmissed,
			upsellBanner,
			isUpsellCardDisplayed,
			isSiteECommerceFreeTrial,
		} = this.props;

		// Don't show the banner if there is already an upsell card displayed
		if ( isUpsellCardDisplayed ) {
			return null;
		}

		// In ecommerce trial sites, we only want to show upsell banner.
		if ( isSiteECommerceFreeTrial ) {
			if ( upsellBanner ) {
				return upsellBanner;
			}
			return null;
		}

		const tabKey = this.state.tabFilter.key;

		if (
			tabKey !== staticFilters.MYTHEMES?.key &&
			! isExpertBannerDissmissed &&
			! loggedOutComponent
		) {
			// these are from the time we rely on the redirect.
			// See p2-pau2Xa-4nq#comment-12480
			let location = 'theme-banner';
			let refURLParam = 'built-by-wordpress-com-redirect';

			// See p2-pau2Xa-4nq#comment-12458 for the context regarding the utm campaign value.
			switch ( tabKey ) {
				case staticFilters.RECOMMENDED.key:
				case staticFilters.ALL.key:
					location = 'all-theme-banner';
					refURLParam = 'themes';
			}

			return <UpworkBanner location={ location } refURLParam={ refURLParam } />;
		}

		return upsellBanner;
	};

	renderThemes = ( themeProps ) => {
		const tabKey = this.state.tabFilter.key;
		switch ( tabKey ) {
			case staticFilters.MYTHEMES?.key:
				return <ThemesSelection { ...themeProps } />;
			default:
				return this.allThemes( { themeProps } );
		}
	};

	render() {
		const {
			siteId,
			options,
			getScreenshotOption,
			search,
			filter,
			isLoggedIn,
			pathName,
			title,
			filterString,
			isMultisite,
			locale,
			premiumThemesEnabled,
			isSiteWooExpressOrEcomFreeTrial,
		} = this.props;
		const canonicalUrl = 'https://wordpress.com' + pathName;

		const metas = [
			{ name: 'description', property: 'og:description', content: this.props.description },
			{ property: 'og:title', content: title },
			{ property: 'og:url', content: canonicalUrl },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: 'WordPress.com' },
		];

		const themeProps = {
			forceWpOrgSearch: true,
			filter: filter,
			vertical: this.props.vertical,
			siteId: this.props.siteId,
			upsellUrl: this.props.upsellUrl,
			upsellBanner: this.props.upsellBanner,
			search: search,
			tier: this.props.tier,
			tabFilter: this.state.tabFilter.key,
			defaultOption: this.props.defaultOption,
			secondaryOption: this.props.secondaryOption,
			placeholderCount: this.props.placeholderCount,
			bookmarkRef: this.bookmarkRef,
			getScreenshotUrl: ( theme, styleVariation ) => {
				if ( ! getScreenshotOption( theme ).getUrl ) {
					return null;
				}

				return localizeThemesPath(
					appendStyleVariationToThemesPath(
						getScreenshotOption( theme ).getUrl( theme ),
						styleVariation
					),
					locale,
					! isLoggedIn
				);
			},
			onScreenshotClick: ( themeId ) => {
				if ( ! getScreenshotOption( themeId ).action ) {
					return;
				}
				getScreenshotOption( themeId ).action( themeId );
			},
			getActionLabel: ( theme ) => getScreenshotOption( theme ).label,
			trackScrollPage: this.props.trackScrollPage,
			emptyContent: this.props.emptyContent,
			scrollToSearchInput: this.scrollToSearchInput,
			getOptions: ( theme ) =>
				pickBy(
					addTracking( options ),
					( option ) => ! ( option.hideForTheme && option.hideForTheme( theme, siteId ) )
				),
		};

		const tabFilters = this.getTabFilters();
		const tiers = this.getTiers();

		return (
			<div className="theme-showcase">
				<DocumentHead title={ title } meta={ metas } />
				<PageViewTracker
					path={ this.props.analyticsPath }
					title={ this.props.analyticsPageTitle }
					properties={ { is_logged_in: isLoggedIn } }
				/>
				<ThemesHeader
					title={
						isLoggedIn
							? translate( 'Themes' )
							: translate( 'Find the perfect theme for your website' )
					}
					description={
						isLoggedIn
							? translate(
									'Select or update the visual design for your site. {{learnMoreLink}}Learn more{{/learnMoreLink}}.',
									{
										components: {
											learnMoreLink: (
												<InlineSupportLink supportContext="themes" showIcon={ false } />
											),
										},
									}
							  )
							: translate(
									'Beautiful and responsive WordPress.com themes. Choose from free and premium options for all types of websites. Then, activate the one that is right for you.'
							  )
					}
				>
					{ isLoggedIn && (
						<>
							<div className="themes__install-theme-button-container">
								<InstallThemeButton />
							</div>
							<ScreenOptionsTab wpAdminPath="themes.php" />
						</>
					) }
				</ThemesHeader>
				<div className="themes__content" ref={ this.scrollRef }>
					<QueryThemeFilters />
					{ isSiteWooExpressOrEcomFreeTrial && (
						<div className="themes__showcase">{ this.renderBanner() }</div>
					) }
					<div className="themes__controls">
						<div className="theme__search">
							<div className="theme__search-input">
								<SearchThemes
									query={ filterString + search }
									onSearch={ this.doSearch }
									recordTracksEvent={ this.recordSearchThemesTracksEvent }
								/>
							</div>
							{ tabFilters && premiumThemesEnabled && ! isMultisite && (
								<SelectDropdown
									className="section-nav-tabs__dropdown"
									onSelect={ this.onTierSelect }
									selectedText={ translate( 'View: %s', {
										args: getOptionLabel( tiers, this.props.tier || 'all' ) || '',
									} ) }
									options={ tiers }
									initialSelected={ this.props.tier }
								></SelectDropdown>
							) }
						</div>
						{ tabFilters && ! isSiteWooExpressOrEcomFreeTrial && (
							<ThemesToolbarGroup
								items={ Object.values( tabFilters ) }
								selectedKey={ this.state.tabFilter.key }
								onSelect={ ( key ) =>
									this.onFilterClick(
										Object.values( tabFilters ).find( ( tabFilter ) => tabFilter.key === key )
									)
								}
							/>
						) }
					</div>
					<div className="themes__showcase">
						{ ! isSiteWooExpressOrEcomFreeTrial && this.renderBanner() }
						{ this.renderThemes( themeProps ) }
					</div>
					{ siteId && <QuerySitePlans siteId={ siteId } /> }
					{ siteId && <QuerySitePurchases siteId={ siteId } /> }
					<QueryProductsList />
					<ThanksModal source="list" />
					<ActivationModal source="list" />
					<EligibilityWarningModal />
					<ThemePreview />
				</div>
			</div>
		);
	}
}

const mapStateToProps = ( state, { siteId, filter, tier, vertical } ) => {
	return {
		isLoggedIn: isUserLoggedIn( state ),
		isAtomicSite: isAtomicSite( state, siteId ),
		isExpertBannerDissmissed: isUpworkBannerDismissed( state ),
		areSiteFeaturesLoaded: !! getSiteFeaturesById( state, siteId ),
		siteCanInstallThemes: siteHasFeature( state, siteId, FEATURE_INSTALL_THEMES ),
		siteSlug: getSiteSlug( state, siteId ),
		description: getThemeShowcaseDescription( state, { filter, tier, vertical } ),
		title: getThemeShowcaseTitle( state, { filter, tier, vertical } ),
		subjects: getThemeFilterTerms( state, 'subject' ) || {},
		premiumThemesEnabled: arePremiumThemesEnabled( state, siteId ),
		filterString: prependThemeFilterKeys( state, filter ),
		filterToTermTable: getThemeFilterToTermTable( state ),
		themesBookmark: getThemesBookmark( state ),
		isUpsellCardDisplayed: isUpsellCardDisplayedSelector( state ),
		isSiteECommerceFreeTrial: isSiteOnECommerceTrial( state, siteId ),
		isSiteWooExpress: isSiteOnWooExpress( state, siteId ),
		isSiteWooExpressOrEcomFreeTrial:
			isSiteOnECommerceTrial( state, siteId ) || isSiteOnWooExpress( state, siteId ),
	};
};

export default connect( mapStateToProps, { setBackPath } )( localize( ThemeShowcase ) );
