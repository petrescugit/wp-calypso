import { isEmpty, last } from 'lodash';
import { mergePostEdits } from 'calypso/state/posts/utils/merge-post-edits';

/**
 * Appends a new edits object to existing edits log. If the last one is
 * an edits object, they will be merged. If the last one is a save marker,
 * the save marker will be left intact and a new edits object will be appended
 * at the end. This helps to keep the edits log as compact as possible.
 *
 * @param {?Array<Object>} postEditsLog Existing edits log to be appended to
 * @param {Object} newPostEdits New edits to be appended to the log
 * @returns {Array<Object>} Merged edits log
 */
export function appendToPostEditsLog( postEditsLog, newPostEdits ) {
	if ( isEmpty( postEditsLog ) ) {
		return [ newPostEdits ];
	}

	const lastEdits = last( postEditsLog );

	if ( typeof lastEdits === 'string' ) {
		return [ ...postEditsLog, newPostEdits ];
	}

	const newEditsLog = postEditsLog.slice( 0, -1 );
	newEditsLog.push( mergePostEdits( lastEdits, newPostEdits ) );
	return newEditsLog;
}
