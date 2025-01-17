import { localizeUrl } from '@automattic/i18n-utils';
import { useTranslate } from 'i18n-calypso';
import { useState } from 'react';
import { DNS_ERROR, UNKNOWN_ERROR } from './constants';
import { ErrorNotice } from './error-notice';
import { useCheckJetpackConnectionHealth } from './use-check-jetpack-connection-health';

interface Props {
	siteId: number;
}

export const JetpackConnectionHealthBanner = ( { siteId }: Props ) => {
	const translate = useTranslate();

	const [ isErrorCheckJetpackConnectionHealth, setIsErrorCheckJetpackConnectionHealth ] =
		useState( false );

	const { data: jetpackConnectionHealth, isLoading: isLoadingJetpackConnectionHealth } =
		useCheckJetpackConnectionHealth( siteId, {
			onError: () => {
				setIsErrorCheckJetpackConnectionHealth( true );
			},
		} );

	if (
		isLoadingJetpackConnectionHealth ||
		isErrorCheckJetpackConnectionHealth ||
		jetpackConnectionHealth?.is_healthy
	) {
		return;
	}

	if ( jetpackConnectionHealth?.error === DNS_ERROR ) {
		return (
			<ErrorNotice
				errorType={ DNS_ERROR }
				errorText={ translate(
					"Jetpack is unable to connect to your domain. Please update your domain's DNS records so they're pointed properly to your site."
				) }
				noticeActionHref={ localizeUrl(
					'https://wordpress.com/support/why-is-my-site-down/#theres-an-issue-with-your-domain-name'
				) }
				noticeActionText={ translate( 'Learn how to fix' ) }
			/>
		);
	}

	return (
		<ErrorNotice
			errorType={ UNKNOWN_ERROR }
			errorText={ translate( 'Jetpack is unable to communicate with your site.' ) }
			noticeActionHref={ localizeUrl(
				'https://wordpress.com/support/why-is-my-site-down/#theres-an-issue-with-your-sites-jetpack-connection'
			) }
			noticeActionText={ translate( 'Learn how to fix' ) }
		/>
	);
};
