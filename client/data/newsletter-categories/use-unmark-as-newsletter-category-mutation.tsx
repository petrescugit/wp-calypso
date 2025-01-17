import { useMutation, useQueryClient } from '@tanstack/react-query';
import request from 'wpcom-proxy-request';

type UnmarkAsNewsletterCategoryResponse = {
	success: boolean;
};

const useUnmarkAsNewsletterCategoryMutation = ( siteId: string | number ) => {
	const queryClient = useQueryClient();
	const cacheKey = [ `newsletter-categories-${ siteId }` ];

	return useMutation( {
		mutationFn: async ( id: number ) => {
			if ( ! id ) {
				throw new Error( 'ID is missing.' );
			}

			const response = await request< UnmarkAsNewsletterCategoryResponse >( {
				path: `/sites/${ siteId }/newsletter-categories/${ id }`,
				method: 'DELETE',
				apiVersion: '2',
				apiNamespace: 'wpcom/v2',
			} );

			if ( ! response.success ) {
				throw new Error( 'Something went wrong while unmarking category as newsletter category.' );
			}

			return response;
		},
		onMutate: async () => {
			await queryClient.cancelQueries( cacheKey );
		},
		onSettled: () => {
			queryClient.invalidateQueries( cacheKey );
		},
	} );
};

export default useUnmarkAsNewsletterCategoryMutation;
