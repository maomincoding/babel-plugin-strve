const MODE_SLASH = 0;
const MODE_TEXT = 1;
const MODE_WHITESPACE = 2;
const MODE_TAGNAME = 3;
const MODE_COMMENT = 4;
const MODE_PROP_SET = 5;
const MODE_PROP_APPEND = 6;
const CHILD_APPEND = 0;
const CHILD_RECURSE = 2;
const TAG_SET = 3;
const PROPS_ASSIGN = 4;
const PROP_SET = MODE_PROP_SET;
const PROP_APPEND = MODE_PROP_APPEND;

export const treeify = function (built, fields) {
	const _treeify = function (built) {
		let tag = '';
		let currentProps = null;
		const props = [];
		const children = [];

		for (let i = 1; i < built.length; i++) {
			const type = built[i++];
			const value = built[i] ? fields[built[i++] - 1] : built[++i];

			if (type === TAG_SET) {
				tag = value;
			} else if (type === PROPS_ASSIGN) {
				props.push(value);
				currentProps = null;
			} else if (type === PROP_SET) {
				if (!currentProps) {
					currentProps = Object.create(null);
					props.push(currentProps);
				}

				currentProps[built[++i]] = [value];
			} else if (type === PROP_APPEND) {
				currentProps[built[++i]].push(value);
			} else if (type === CHILD_RECURSE) {
				children.push(_treeify(value));
			} else if (type === CHILD_APPEND) {
				children.push(value);
			}
		}

		return {
			tag: tag,
			props: props,
			children: children,
		};
	};

	const { children } = _treeify(built);

	return children.length > 1 ? children : children[0];
};

export const build = function (statics) {
	let mode = MODE_TEXT;
	let buffer = '';
	let quote = '';
	let current = [0];
	let char, propName;

	const commit = function (field) {
		if (
			mode === MODE_TEXT &&
			(field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, '')))
		) {
			current.push(CHILD_APPEND, field, buffer);
		} else if (mode === MODE_TAGNAME && (field || buffer)) {
			current.push(TAG_SET, field, buffer);

			mode = MODE_WHITESPACE;
		} else if (mode === MODE_WHITESPACE && buffer === '...' && field) {
			current.push(PROPS_ASSIGN, field, 0);
		} else if (mode === MODE_WHITESPACE && buffer && !field) {
			current.push(PROP_SET, 0, true, buffer);
		} else if (mode >= MODE_PROP_SET) {
			if (buffer || (!field && mode === MODE_PROP_SET)) {
				current.push(mode, 0, buffer, propName);
				mode = MODE_PROP_APPEND;
			}

			if (field) {
				current.push(mode, field, 0, propName);
				mode = MODE_PROP_APPEND;
			}
		}

		buffer = '';
	};

	for (let i = 0; i < statics.length; i++) {
		if (i) {
			if (mode === MODE_TEXT) {
				commit();
			}

			commit(i);
		}

		for (let j = 0; j < statics[i].length; j++) {
			char = statics[i][j];

			if (mode === MODE_TEXT) {
				if (char === '<') {
					commit();

					current = [current];

					mode = MODE_TAGNAME;
				} else {
					buffer += char;
				}
			} else if (mode === MODE_COMMENT) {
				if (buffer === '--' && char === '>') {
					mode = MODE_TEXT;
					buffer = '';
				} else {
					buffer = char + buffer[0];
				}
			} else if (quote) {
				if (char === quote) {
					quote = '';
				} else {
					buffer += char;
				}
			} else if (char === '"' || char === "'") {
				quote = char;
			} else if (char === '>') {
				commit();
				mode = MODE_TEXT;
			} else if (!mode) {
				// Ignore everything until the tag ends
			} else if (char === '=') {
				mode = MODE_PROP_SET;
				propName = buffer;
				buffer = '';
			} else if (
				char === '/' &&
				(mode < MODE_PROP_SET || statics[i][j + 1] === '>')
			) {
				commit();

				if (mode === MODE_TAGNAME) {
					current = current[0];
				}

				mode = current;

				(current = current[0]).push(CHILD_RECURSE, 0, mode);

				mode = MODE_SLASH;
			} else if (
				char === ' ' ||
				char === '\t' ||
				char === '\n' ||
				char === '\r'
			) {
				// <a disabled>
				commit();
				mode = MODE_WHITESPACE;
			} else {
				buffer += char;
			}

			if (mode === MODE_TAGNAME && buffer === '!--') {
				mode = MODE_COMMENT;
				current = current[0];
			}
		}
	}

	commit();

	return current;
};
