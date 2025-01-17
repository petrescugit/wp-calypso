import { Gridicon } from '@automattic/components';
import { useTranslate } from 'i18n-calypso';
import { useCallback } from 'react';
import ActionCard from 'calypso/components/action-card';
import useLicenseDownloadUrlMutation from 'calypso/components/data/query-jetpack-partner-portal-licenses/use-license-download-url-mutation';
import ClipboardButton from 'calypso/components/forms/clipboard-button';
import { useDispatch } from 'calypso/state';
import { recordTracksEvent } from 'calypso/state/analytics/actions';
import { infoNotice, errorNotice } from 'calypso/state/notices/actions';
import { APIProductFamilyProduct } from 'calypso/state/partner-portal/types';

interface WooProductDownloadProps {
	licenseKey: string;
	allProducts: APIProductFamilyProduct[] | undefined;
}

export default function WooProductDownload( { licenseKey, allProducts }: WooProductDownloadProps ) {
	const dispatch = useDispatch();
	const translate = useTranslate();
	const productSlug = licenseKey.split( '_' )[ 0 ];
	const product = allProducts && allProducts.find( ( product ) => product.slug === productSlug );
	const downloadUrl = useLicenseDownloadUrlMutation( licenseKey );

	const download = useCallback( () => {
		downloadUrl.mutate( null, {
			onSuccess: ( data ) => window.location.replace( data.download_url ),
			onError: ( error: Error ) => dispatch( errorNotice( error.message ) ),
		} );
		dispatch( recordTracksEvent( 'calypso_partner_portal_download_from_assign' ) );
	}, [ dispatch, downloadUrl ] );

	const onCopyLicense = useCallback( () => {
		dispatch( infoNotice( translate( 'License copied!' ), { duration: 2000 } ) );
		dispatch( recordTracksEvent( 'calypso_partner_portal_download_copy_license_key' ) );
	}, [ dispatch, translate ] );

	return (
		<div className="download-products-list">
			<ActionCard
				headerText={ product?.name ?? '' }
				mainText={
					<div className="license-key">
						<code className="license-details__license-key">{ licenseKey }</code>

						<ClipboardButton
							text={ licenseKey }
							className="license-details__clipboard-button"
							borderless
							compact
							onCopy={ onCopyLicense }
						>
							<Gridicon icon="clipboard" />
						</ClipboardButton>
					</div>
				}
				buttonText={ translate( 'Download' ) }
				buttonOnClick={ download }
				buttonDisabled={ downloadUrl.isLoading }
			/>
		</div>
	);
}
