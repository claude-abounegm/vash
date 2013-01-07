/*jshint strict:false, asi: false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){

	vash = typeof vash === 'undefined' ? {} : vash;

	// only fully define if this is standalone
	if(!vash.compile){
		if(typeof define === 'function' && define['amd']){
			define(function(){ return vash }); // AMD
		} else if(typeof module === 'object' && module['exports']){
			module['exports'] = vash; // NODEJS
		} else {
			window['vash'] = vash; // BROWSER
		}
	}

	var helpers = vash['helpers'];

	var Helpers = function ( model ) {
		this.buffer = new Buffer();
		this.model  = model;

		this.vl = 0;
		this.vc = 0;
	};

	vash['helpers']
		= helpers
		= Helpers.prototype
		= { constructor: Helpers, config: {}, tplcache: {} };

	// this allows a template to return the context, and coercion
	// will handle it
	helpers.toString = helpers.toHtmlString = function(){
		return this.buffer.toString();
	}

	///////////////////////////////////////////////////////////////////////////
	// HTML ESCAPING

	var HTML_REGEX = /[&<>"'`]/g
		,HTML_REPLACER = function(match) { return HTML_CHARS[match]; }
		,HTML_CHARS = {
			"&": "&amp;"
			,"<": "&lt;"
			,">": "&gt;"
			,'"': "&quot;"
			,"'": "&#x27;"
			,"`": "&#x60;"
		};

	helpers.raw = function( val ) {
		var func = function() { return val; };

		val = val != null ? val : "";

		return {
			 toHtmlString: func
			,toString: func
		};
	};

	helpers.escape = function( val ) {
		var	func = function() { return val; };

		val = val != null ? val : "";

		if ( typeof val.toHtmlString !== "function" ) {

			val = val.toString().replace( HTML_REGEX, HTML_REPLACER );

			return {
				 toHtmlString: func
				,toString: func
			};
		}

		return val;
	};

	// HTML ESCAPING
	///////////////////////////////////////////////////////////////////////////


	///////////////////////////////////////////////////////////////////////////
	// BUFFER MANIPULATION
	//
	// These are to be used from within helpers, to allow for manipulation of
	// output in a sane manner.

	var Buffer = function() {
		this._vo = [];
	}

	Buffer.prototype.mark = function( debugName ) {
		var mark = new Mark( this, debugName );
		mark.markedIndex = this._vo.length;
		this._vo.push( mark.uid );
		return mark;
	};

	Buffer.prototype.fromMark = function( mark ) {
		var found = mark.findInBuffer();

		if( found > -1 ){
			// automatically destroy the mark from the buffer
			mark.destroy();
			// `found` will still be valid for a manual splice
			return this._vo.splice( found, this._vo.length );
		}

		return [];
	};

	Buffer.prototype.spliceMark = function( mark, numToRemove, add ){
		var found = mark.findInBuffer();

		if( found > -1 ){
			mark.destroy();
			arguments[0] = found;
			return this._vo.splice.apply( this._vo, arguments );
		}

		return [];
	};

	Buffer.prototype.empty = function() {
		return this._vo.splice( 0, this._vo.length );
	};

	Buffer.prototype.push = function( buffer ) {
		return this._vo.push( buffer );
	};

	Buffer.prototype.pushConcat = function( buffer ){
		if( buffer instanceof Array ) {
			this._vo.push.apply( this._vo, buffer );
		} else if ( arguments.length > 1 ) {
			this._vo.push.apply( this._vo, Array.prototype.slice.call( arguments ));
		} else {
			this._vo.push( buffer );
		}

		return this.__vo;
	}

	Buffer.prototype.indexOf = function( str ){

		for( var i = 0; i < this._vo.length; i++ ){
			if( this._vo[i] == str ){
				return i;
			}
		}

		return -1;
	}

	Buffer.prototype.splice = function(){
		return this._vo.splice.apply( this._vo, arguments );
	}

	Buffer.prototype.index = function( idx ){
		return this._vo[ idx ];
	}

	Buffer.prototype.flush = function() {
		return this.empty().join( "" );
	};

	Buffer.prototype.toString = Buffer.prototype.toHtmlString = function(){
		// not using flush because then console.log( tpl() ) would artificially
		// affect the output
		return this._vo.join( "" );
	}

	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// MARKS
	// These can be used to manipulate the existing entries in the rendering
	// context. For an example, see the highlight helper.

	var Mark = vash['Mark'] = function( buffer, debugName ){
		this.uid = '[VASHMARK-'
			+ ~~( Math.random() * 10000000 )
			+ (debugName ? ':' + debugName : '')
			+ ']';
		this.markedIndex = 0;
		this.buffer = buffer;
		this.destroyed = false;
	}

	var reMark = /\[VASHMARK\-\d{1,8}(?::[\s\S]+?)?]/g

	// tests if a string has a mark-like uid within it
	Mark.uidLike = function( str ){
		return (str || '').search( reMark ) > -1;
	}

	Mark.prototype.destroy = function(){

		var found = this.findInBuffer();

		if( found > -1 ){
			this.buffer.splice( found, 1 );
			this.markedIndex = -1;
		}

		this.destroyed = true;
	}

	Mark.prototype.findInBuffer = function(){

		if( this.destroyed ){
			return -1;
		}

		if( this.markedIndex && this.buffer.index( this.markedIndex ) === this.uid ){
			return this.markedIndex;
		}

		return this.markedIndex = this.buffer.indexOf( this.uid );
	}

	// MARKS
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// ERROR REPORTING

	// Liberally modified from https://github.com/visionmedia/jade/blob/master/jade.js
	helpers.constructor.reportError = function(e, lineno, chr, orig, lb){

		lb = lb || '!LB!';

		var lines = orig.split(lb)
			,contextSize = lineno === 0 && chr === 0 ? lines.length - 1 : 3
			,start = Math.max(0, lineno - contextSize)
			,end = Math.min(lines.length, lineno + contextSize);

		var contextStr = lines.slice(start, end).map(function(line, i, all){
			var curr = i + start + 1;

			return (curr === lineno ? '  > ' : '    ')
				+ (curr < 10 ? ' ' : '')
				+ curr
				+ ' | '
				+ line;
		}).join('\n');

		e.message = 'Problem while rendering template at line '
			+ lineno + ', character ' + chr
			+ '.\nOriginal message: ' + e.message + '.'
			+ '\nContext: \n\n' + contextStr + '\n\n';

		throw e;
	};

	helpers.reportError = function() {
		this.constructor.reportError.apply( this, arguments );
	};

	// ERROR REPORTING
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// VASH.LINK
	// Reconstitute precompiled functions

	vash['link'] = function( cmpFunc, modelName, helpersName ){

		var joined;

		if( typeof cmpFunc === 'string' ){
			joined = cmpFunc;
			try {
				cmpFunc = new Function(modelName, helpersName, '__vopts', 'vash', joined);
			} catch(e){
				helpers.reportError(e, 0, 0, joined, /\n/);
			}
		}

		// need this to enable `vash.batch` to reconstitute
		cmpFunc.options = { modelName: modelName, helpersName: helpersName };

		var linked = function( model, opts ){

			// allow for signature: model, callback
			if( typeof opts === 'function' ) {
				opts = { onRenderEnd: opts };
			}

			opts = opts || {};

			// allow for passing in onRenderEnd via model
			if( model && model.onRenderEnd && opts && !opts.onRenderEnd ){
				opts.onRenderEnd = model.onRenderEnd;
			}

			if( model && model.onRenderEnd ){
				delete model.onRenderEnd;
			}

			return cmpFunc( model, (opts && opts.context) || new Helpers( model ), opts, vash );
		};

		linked.toString = function(){
			return cmpFunc.toString();
		};

		linked.toClientString = function(){
			return 'vash.link( ' + cmpFunc.toString() + ', "' + modelName + '", "' + helpersName + '" )';
		};

		return linked;
	};

	// VASH.LINK
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// TPL CACHE

	vash.lookup = function( path, model ){
		var tpl = vash.helpers.tplcache[path];
		if( !tpl ){ throw new Error('Could not find template: ' + path); }
		if( model ){ return tpl(model); }
		else return tpl;
	};

	vash.install = function( path, tpl ){
		var cache = vash.helpers.tplcache;
		if( typeof tpl === 'string' ){
			if( !vash.compile ){ throw new Error('vash.install(path, [string]) is not available in the standalone runtime.') }
			tpl = vash.compile(tpl);
		}
		return cache[path] = tpl;
	};

	vash.uninstall = function( path ){
		var  cache = vash.helpers.tplcache
			,deleted = false;

		if( typeof path === 'string' ){
			return delete cache[path];
		} else {
			Object.keys(cache).forEach(function(key){
				if( cache[key] === path ){ deleted = delete cache[key]; }
			})
			return deleted;
		}
	};

}());
