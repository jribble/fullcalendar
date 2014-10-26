/*
 * Responsible for Highlights.  Highlight source object is anything that provides
 * data about Highlights.  It can be function, a JSON object or URL to a JSON 
 * feed.
*/


function HighlightManager(options) {
    var t = this;
	
    // exports
    t.fetchHighlights = fetchHighlights;
    
    // local
    var sources = [];  // source array
    var cache;  // cached Highlights
    
    _addHighlightSources(options['highlights']);


    /**
     * ----------------------------------------------------------------
     * Categorize and add the provided sources
     * ----------------------------------------------------------------
     */
    function _addHighlightSources(_sources) {
        var source = {};
        
        if ($.isFunction(_sources)) {
            // is it a function?
            source = {
                highlights: _sources
            };
            sources.push(source);
        } else if (typeof _sources == 'string') {
            // is it a URL string?
            source = {
                url: _sources
            };
            sources.push(source);
        } else if (typeof _sources == 'object') {
            // is it json object?
            for (var i=0; i<_sources.length; i++) {
                var s = _sources[i];
                normalizeSource(s);
                source = {
                    highlights: s
                };
                sources.push(source);
            }
        }
    }


    /**
     * ----------------------------------------------------------------
     * Fetch highlights from source array
     * ----------------------------------------------------------------
     */
    function fetchHighlights(useCache) {
        // if useCache is not defined, default to true
        useCache = typeof useCache !== 'undefined' ? useCache : true;
        
        if (cache != undefined && useCache) {
            // get from cache
            return cache;
        } else {
            // do a fetch highlight from source, rebuild cache
            cache = [];
            var len = sources.length;
            for (var i = 0; i < len; i++) {
                var highlights = _fetchHighlightSource(sources[i]);
                cache = cache.concat(highlights);
            }
            return cache;
        }
    }
    
    
    /**
     * ----------------------------------------------------------------
     * Fetch highlights from each source.  If source is a function, call
     * the function and return the highlight.  If source is a URL, get
     * the data via synchronized ajax call.  If the source is an
     * object, return it as is.
     * ----------------------------------------------------------------
     */
    function _fetchHighlightSource(source) {
        var highlights = source.highlights;
        if (highlights) {
            if ($.isFunction(highlights)) {
                return highlights();
            }
        } else {
            var url = source.url;
            if (url) {
                $.ajax({
                    url: url,
                    dataType: 'json',
                    cache: false,
                    success: function(res) {
                        res = res || [];
                        highlights = res;
                    },
                    error: function() {
                        alert("ajax error");
                    },
                    async: false  // too much work coordinating callbacks so dumb it down
                });
            }
        }
        return highlights;
    }
    
    
    /**
     * ----------------------------------------------------------------
     * normalize the source object
     * ----------------------------------------------------------------
     */
    function normalizeSource(source) {
        if (source.className) {
            if (typeof source.className == 'string') {
                source.className = source.className.split(/\s+/);
            }
        }else{
            source.className = [];
        }
        var normalizers = fc.sourceNormalizers;
        for (var i=0; i<normalizers.length; i++) {
            normalizers[i](source);
        }
    }


}
